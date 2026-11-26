// 浏览量存储层：Cloudflare D1（主）+ KV（历史数据兼容/只读兜底）+ 本地内存（开发）
//
// D1 表结构见 migrations/0001_views.sql：
//   view_counts(slug PRIMARY KEY, views INTEGER, updated_at TEXT)
//   view_seen(slug, visitor, created_at, PRIMARY KEY (slug, visitor))
//
// 统计规则：
//   - 同一访客对同一篇文章只计一次（view_seen 主键唯一约束，并发安全）
//   - 同一访客访问不同文章分别统计
//   - 不同访客访问同一篇文章分别统计
//
// 兼容策略：
//   - D1 中不存在该文章记录时，先读取旧 KV 的 view:<slug>（纯数字或新 JSON 格式），
//     把历史阅读数写入 D1 后再自增，绝不清零；
//   - D1 读取失败时退回 KV 读取；两者都不可用时返回 null（前端保留原显示，不显示 0）；
//   - 旧 KV 数据只读不删。

const MAX_SEEN_HASHES = 5000;

// 访客标识做稳定哈希后再存储，避免原始标识出现在数据库里
export function hashVisitor(visitorId) {
  const source = String(visitorId || '');
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  for (let i = 0; i < source.length; i++) {
    const code = source.charCodeAt(i);
    h1 = ((h1 ^ code) * 16777619) >>> 0;
    h2 = (h2 + Math.imul(code, i + 7)) >>> 0;
  }
  return h1.toString(36) + h2.toString(36);
}

// 兼容：纯数字（旧 KV 格式）、JSON 对象（上一版 KV 格式）
function parseRecord(raw) {
  if (raw === null || raw === undefined || raw === '') return { count: 0, seen: [] };
  const text = typeof raw === 'string' ? raw : String(raw);
  if (text.trim().startsWith('{')) {
    try {
      const data = JSON.parse(text);
      const count = Number(data && data.c);
      const seen = Array.isArray(data && data.v) ? data.v.map((item) => String(item)) : [];
      return { count: Number.isFinite(count) && count >= 0 ? Math.floor(count) : 0, seen };
    } catch (error) {
      return { count: 0, seen: [] };
    }
  }
  const num = parseInt(text, 10);
  return { count: Number.isFinite(num) && num >= 0 ? num : 0, seen: [] };
}

function serializeRecord(count, seen) {
  return JSON.stringify({ c: count, v: seen.slice(-MAX_SEEN_HASHES) });
}

// 供后台展示旧 KV 数值时复用同一套解析规则
export function parseViewValue(raw) {
  return parseRecord(raw);
}

function isQuotaError(error) {
  return /limit exceeded|quota|429/i.test(String(error && (error.message || error)));
}

// ---------- 本地内存（dev-server） ----------
function createMemoryStore() {
  const counts = new Map();
  const seen = new Map();

  return {
    kind: 'memory',

    async getViewCount(slug) {
      return counts.get(slug) || 0;
    },

    async getAllViewCounts() {
      return Array.from(counts.entries()).map(([slug, views]) => ({ slug, views }));
    },

    async recordView(slug, visitorId) {
      const visitor = hashVisitor(visitorId);
      let set = seen.get(slug);
      if (!set) {
        set = new Set();
        seen.set(slug, set);
      }
      if (set.has(visitor)) {
        return { count: counts.get(slug) || 0, counted: false, stored: true };
      }
      set.add(visitor);
      const next = (counts.get(slug) || 0) + 1;
      counts.set(slug, next);
      return { count: next, counted: true, stored: true };
    },
  };
}

// ---------- Cloudflare KV（只读兜底 + 历史数据来源） ----------
function createKvReader(kv) {
  return {
    async count(slug) {
      const raw = await kv.get(`view:${slug}`);
      return parseRecord(raw).count;
    },
    async all() {
      const items = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: 'view:', cursor });
        const keys = page.keys || [];
        const values = await Promise.all(keys.map((key) => kv.get(key.name)));
        keys.forEach((key, index) => {
          items.push({
            slug: key.name.slice('view:'.length),
            views: parseRecord(values[index]).count,
          });
        });
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return items;
    },
  };
}

function createKvStore(kv) {
  const inflight = new Map();

  async function doRecord(slug, visitorId) {
    const key = `view:${slug}`;
    const visitor = hashVisitor(visitorId);

    const raw = await kv.get(key);
    const record = parseRecord(raw);
    if (record.seen.includes(visitor)) {
      return { count: record.count, counted: false, stored: true };
    }
    try {
      const legacy = await kv.get(`seen:${slug}:${visitorId}`);
      if (legacy !== null && legacy !== undefined) {
        return { count: record.count, counted: false, stored: true };
      }
    } catch (error) {
      /* 旧标记读取失败不影响主流程 */
    }

    const nextCount = record.count + 1;
    try {
      await kv.put(key, serializeRecord(nextCount, [...record.seen, visitor]));
      return { count: nextCount, counted: true, stored: true };
    } catch (error) {
      if (isQuotaError(error)) {
        return { count: record.count, counted: false, stored: false, error: 'quota' };
      }
      return {
        count: record.count,
        counted: false,
        stored: false,
        error: String((error && error.message) || error),
      };
    }
  }

  return {
    kind: 'kv',

    async getViewCount(slug) {
      return parseRecord(await kv.get(`view:${slug}`)).count;
    },

    async getAllViewCounts() {
      return createKvReader(kv).all();
    },

    async recordView(slug, visitorId) {
      const dedupeKey = `${slug}:${hashVisitor(visitorId)}`;
      const running = inflight.get(dedupeKey);
      if (running) return running;
      const task = doRecord(slug, visitorId).finally(() => inflight.delete(dedupeKey));
      inflight.set(dedupeKey, task);
      return task;
    },
  };
}

// ---------- Cloudflare D1 ----------
export const D1_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS view_counts (
     slug TEXT PRIMARY KEY,
     views INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS view_seen (
     slug TEXT NOT NULL,
     visitor TEXT NOT NULL,
     created_at TEXT NOT NULL,
     PRIMARY KEY (slug, visitor)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_view_seen_slug ON view_seen (slug)`,
];

function createD1Store(db, legacyKv) {
  let schemaReady = null;
  let legacySeedTried = false;

  const ensureSchema = () => {
    if (!schemaReady) {
      schemaReady = db.batch(D1_SCHEMA.map((sql) => db.prepare(sql))).catch((error) => {
        schemaReady = null;
        throw error;
      });
    }
    return schemaReady;
  };

  const readCount = async (slug) => {
    const row = await db.prepare('SELECT views FROM view_counts WHERE slug = ?').bind(slug).first();
    if (!row) return null;
    return Number(row.views) || 0;
  };

  // D1 中没有该文章时，把旧 KV 的历史阅读数迁进来，避免从 0 开始
  const seedFromLegacy = async (slug) => {
    if (!legacyKv) return null;
    let legacy = 0;
    try {
      legacy = parseRecord(await legacyKv.get(`view:${slug}`)).count;
    } catch (error) {
      return null;
    }
    if (legacy <= 0) return null;
    await db
      .prepare(
        `INSERT INTO view_counts (slug, views, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(slug) DO NOTHING`
      )
      .bind(slug, legacy, new Date().toISOString())
      .run();
    return legacy;
  };

  return {
    kind: 'd1',

    async getViewCount(slug) {
      try {
        await ensureSchema();
        const existing = await readCount(slug);
        if (existing !== null) return existing;
        const seeded = await seedFromLegacy(slug);
        if (seeded !== null) return seeded;
        return (await readCount(slug)) ?? 0;
      } catch (error) {
        if (!legacyKv) throw error;
        // D1 暂时不可用时退回旧 KV 读取，避免显示为 0
        try {
          return parseRecord(await legacyKv.get(`view:${slug}`)).count;
        } catch (inner) {
          return null;
        }
      }
    },

    async getAllViewCounts() {
      await ensureSchema();
      let rows = ((await db.prepare('SELECT slug, views FROM view_counts').all()).results) || [];

      // D1 还是空的（刚绑定 / 刚清库）时，自动把旧 KV 历史数据整体导入，
      // 保证热门榜、后台排行在绑定后立刻正确，不需要手动迁移。
      if (rows.length === 0 && legacyKv && !legacySeedTried) {
        legacySeedTried = true;
        try {
          const items = (await createKvReader(legacyKv).all()).slice(0, 500);
          for (const item of items) {
            if (item.views > 0) {
              await db
                .prepare(
                  `INSERT INTO view_counts (slug, views, updated_at) VALUES (?, ?, ?)
                   ON CONFLICT(slug) DO NOTHING`
                )
                .bind(item.slug, item.views, new Date().toISOString())
                .run();
            }
          }
          rows = ((await db.prepare('SELECT slug, views FROM view_counts').all()).results) || [];
        } catch (error) {
          /* 自动导入失败时保持空结果，管理员仍可用迁移按钮重试 */
        }
      }

      return rows.map((row) => ({ slug: row.slug, views: Number(row.views) || 0 }));
    },

    async recordView(slug, visitorId) {
      await ensureSchema();
      const visitor = hashVisitor(visitorId);
      const now = new Date().toISOString();

      // 唯一约束去重：并发时只有一个请求能插入成功
      const hit = await db
        .prepare('INSERT OR IGNORE INTO view_seen (slug, visitor, created_at) VALUES (?, ?, ?)')
        .bind(slug, visitor, now)
        .run();
      const changed = Number(hit && hit.meta && hit.meta.changes) || 0;

      if (!changed) {
        const current = await readCount(slug);
        if (current !== null) return { count: current, counted: false, stored: true };
        const seeded = await seedFromLegacy(slug);
        return { count: seeded ?? (await readCount(slug)) ?? 0, counted: false, stored: true };
      }

      // 首次统计该文章时，先把旧 KV 历史值迁移过来（DO NOTHING 不会覆盖 D1 已有值）
      const existing = await readCount(slug);
      if (existing === null) await seedFromLegacy(slug);

      try {
        const row = await db
          .prepare(
            `INSERT INTO view_counts (slug, views, updated_at) VALUES (?, 1, ?)
             ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = excluded.updated_at
             RETURNING views`
          )
          .bind(slug, now)
          .first();
        return { count: Number(row && row.views) || 1, counted: true, stored: true };
      } catch (error) {
        // 自增失败时撤销去重标记，保证下次访问还能补记，不会永久漏计
        try {
          await db
            .prepare('DELETE FROM view_seen WHERE slug = ? AND visitor = ?')
            .bind(slug, visitor)
            .run();
        } catch (inner) {
          /* 撤销失败时保留现状即可 */
        }
        throw error;
      }
    },
  };
}

// ---------- 工厂 ----------
export function createViewsStore(env) {
  if (env && env.VIEWS_STORE) return env.VIEWS_STORE;

  const d1 = env && (env.VIEWS_DB || env.STATS_DB);
  if (d1) {
    try {
      return createD1Store(d1, env.VIEWS_KV || null);
    } catch (error) {
      console.warn('[views-store] D1 初始化失败，降级为 KV：', error.message);
    }
  }

  if (env && env.VIEWS_KV) return createKvStore(env.VIEWS_KV);
  return createMemoryStore();
}

// 存储状态：供后台确认当前是否真的在用 D1
export function getViewsStorageInfo(env) {
  const d1Bound = Boolean(env && (env.VIEWS_DB || env.STATS_DB));
  const kvAvailable = Boolean(env && env.VIEWS_KV);
  return {
    kind: d1Bound ? 'd1' : kvAvailable ? 'kv' : 'memory',
    d1Bound,
    kvAvailable,
    bindingName: env && env.VIEWS_DB ? 'VIEWS_DB' : env && env.STATS_DB ? 'STATS_DB' : '',
  };
}

// 历史数据迁移：KV → D1，只升不降，绝不清零
// 返回逐篇对比结果，便于核对迁移前后数量与阅读数。
export async function migrateViewsFromKv(env, { dryRun = false } = {}) {
  const db = env && (env.VIEWS_DB || env.STATS_DB);
  if (!db) throw new Error('尚未绑定 D1（VIEWS_DB），无法迁移。');
  if (!env.VIEWS_KV) throw new Error('当前环境没有可读取的旧 KV（VIEWS_KV）。');

  await db.batch(D1_SCHEMA.map((sql) => db.prepare(sql)));

  const legacyItems = await createKvReader(env.VIEWS_KV).all();
  const currentRows = ((await db.prepare('SELECT slug, views FROM view_counts').all()).results) || [];
  const current = new Map(currentRows.map((row) => [row.slug, Number(row.views) || 0]));

  const plan = [];
  let inserted = 0;
  let updated = 0;
  let unchanged = 0;
  let legacyTotal = 0;
  let targetTotal = 0;

  for (const item of legacyItems) {
    legacyTotal += item.views;
    const before = current.has(item.slug) ? current.get(item.slug) : null;
    let after = before;
    let action = 'unchanged';

    if (before === null) {
      after = item.views;
      action = 'insert';
      inserted += 1;
    } else if (item.views > before) {
      after = item.views;
      action = 'update';
      updated += 1;
    } else {
      unchanged += 1;
    }

    targetTotal += after || 0;
    plan.push({ slug: item.slug, kv: item.views, d1Before: before, d1After: after, action });

    if (!dryRun && action !== 'unchanged') {
      await db
        .prepare(
          `INSERT INTO view_counts (slug, views, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET
             views = MAX(view_counts.views, excluded.views),
             updated_at = excluded.updated_at`
        )
        .bind(item.slug, item.views, new Date().toISOString())
        .run();
    }
  }

  // 迁移后核对
  const afterRows = dryRun
    ? currentRows
    : ((await db.prepare('SELECT slug, views FROM view_counts').all()).results) || [];
  let d1Total = 0;
  for (const row of afterRows) d1Total += Number(row.views) || 0;

  return {
    dryRun,
    kvArticles: legacyItems.length,
    kvTotalViews: legacyTotal,
    d1Articles: afterRows.length,
    d1TotalViews: d1Total,
    inserted,
    updated,
    unchanged,
    plan: plan.slice(0, 200),
  };
}
