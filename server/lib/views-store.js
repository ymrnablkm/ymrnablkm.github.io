// 浏览量存储层：KV（默认）+ D1（可选，绑定后自动启用）+ 本地内存（开发）
//
// 设计目标：
//   1) 每次「新访客首次阅读某篇文章」只写 1 次存储，避免 KV 免费额度（1000 写/天）被占满；
//   2) 同一访客重复阅读同一篇、刷新、重开浏览器都不再写入；
//   3) 完全兼容旧的 view:<slug> 纯数字值，历史阅读数原样保留。
//
// KV key 设计：
//   view:<slug> → JSON {"c": 计数, "v": ["访客哈希", ...]}；旧数据为纯数字字符串，读取时自动兼容
//   seen:<slug>:<vid> → 旧版去重标记，仅读取用于兼容，不再新增写入
//
// D1 表结构（绑定 VIEWS_DB 或 STATS_DB 后启用）：
//   view_counts(slug PRIMARY KEY, views INTEGER, updated_at TEXT)
//   view_seen(slug, visitor, created_at, PRIMARY KEY (slug, visitor))

const MAX_SEEN_HASHES = 5000;

// 访客标识做稳定哈希后再存储，避免原始标识出现在键值里
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

// 兼容：纯数字（旧格式）、JSON 对象（新格式）
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
        return { count: counts.get(slug) || 0, counted: false };
      }
      set.add(visitor);
      const next = (counts.get(slug) || 0) + 1;
      counts.set(slug, next);
      return { count: next, counted: true };
    },
  };
}

// ---------- Cloudflare KV ----------
function createKvStore(kv) {
  // 同一实例内对「同一文章 + 同一访客」的并发请求合并为一次写入，
  // 避免快速刷新/双击导致同一访客被重复计数。
  const inflight = new Map();

  async function doRecord(slug, visitorId) {
    const key = `view:${slug}`;
    const visitor = hashVisitor(visitorId);

    for (let attempt = 0; attempt < 3; attempt++) {
      const raw = await kv.get(key);
      const record = parseRecord(raw);

      if (record.seen.includes(visitor)) {
        return { count: record.count, counted: false };
      }

      // 兼容旧版去重标记（只读，不新增写入）：之前已计过数的访客不再 +1
      try {
        const legacy = await kv.get(`seen:${slug}:${visitorId}`);
        if (legacy !== null && legacy !== undefined) {
          return { count: record.count, counted: false };
        }
      } catch (error) {
        /* 旧标记读取失败不影响主流程 */
      }

      const nextCount = record.count + 1;
      try {
        await kv.put(key, serializeRecord(nextCount, [...record.seen, visitor]));
        return { count: nextCount, counted: true };
      } catch (error) {
        if (isQuotaError(error)) {
          // 额度耗尽时不再重试，保留已有计数并明确告知调用方未写入
          return { count: record.count, counted: false, error: 'quota' };
        }
        if (attempt === 2) {
          return { count: record.count, counted: false, error: String((error && error.message) || error) };
        }
        await new Promise((resolve) => setTimeout(resolve, 30 + attempt * 40));
      }
    }

    return { count: parseRecord(await kv.get(key)).count, counted: false };
  }

  return {
    kind: 'kv',

    async getViewCount(slug) {
      const raw = await kv.get(`view:${slug}`);
      return parseRecord(raw).count;
    },

    async getAllViewCounts() {
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

    async recordView(slug, visitorId) {
      const dedupeKey = `${slug}:${hashVisitor(visitorId)}`;
      const running = inflight.get(dedupeKey);
      if (running) return running;

      const task = doRecord(slug, visitorId).finally(() => {
        inflight.delete(dedupeKey);
      });
      inflight.set(dedupeKey, task);
      return task;
    },
  };
}

// ---------- Cloudflare D1（绑定 VIEWS_DB / STATS_DB 时启用） ----------
function createD1Store(db, legacyKv) {
  let schemaReady = null;

  const ensureSchema = () => {
    if (!schemaReady) {
      schemaReady = db
        .batch([
          db.prepare(
            `CREATE TABLE IF NOT EXISTS view_counts (
               slug TEXT PRIMARY KEY,
               views INTEGER NOT NULL DEFAULT 0,
               updated_at TEXT NOT NULL
             )`
          ),
          db.prepare(
            `CREATE TABLE IF NOT EXISTS view_seen (
               slug TEXT NOT NULL,
               visitor TEXT NOT NULL,
               created_at TEXT NOT NULL,
               PRIMARY KEY (slug, visitor)
             )`
          ),
        ])
        .catch((error) => {
          schemaReady = null;
          throw error;
        });
    }
    return schemaReady;
  };

  // 首次从旧 KV 迁移历史阅读数，避免清零
  const seedFromLegacy = async (slug, current) => {
    if (current > 0 || !legacyKv) return current;
    try {
      const raw = await legacyKv.get(`view:${slug}`);
      const legacy = parseRecord(raw).count;
      if (legacy <= 0) return current;
      await db
        .prepare(
          `INSERT INTO view_counts (slug, views, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(slug) DO UPDATE SET views = excluded.views, updated_at = excluded.updated_at`
        )
        .bind(slug, legacy, new Date().toISOString())
        .run();
      return legacy;
    } catch (error) {
      return current;
    }
  };

  return {
    kind: 'd1',

    async getViewCount(slug) {
      await ensureSchema();
      const row = await db.prepare('SELECT views FROM view_counts WHERE slug = ?').bind(slug).first();
      const views = Number(row && row.views) || 0;
      return seedFromLegacy(slug, views);
    },

    async getAllViewCounts() {
      await ensureSchema();
      const result = await db.prepare('SELECT slug, views FROM view_counts').all();
      return ((result && result.results) || []).map((row) => ({
        slug: row.slug,
        views: Number(row.views) || 0,
      }));
    },

    async recordView(slug, visitorId) {
      await ensureSchema();
      const visitor = hashVisitor(visitorId);
      const now = new Date().toISOString();

      const hit = await db
        .prepare('INSERT OR IGNORE INTO view_seen (slug, visitor, created_at) VALUES (?, ?, ?)')
        .bind(slug, visitor, now)
        .run();
      const changed = Number(hit && hit.meta && hit.meta.changes) || 0;

      if (!changed) {
        const row = await db.prepare('SELECT views FROM view_counts WHERE slug = ?').bind(slug).first();
        return { count: Number(row && row.views) || 0, counted: false };
      }

      // 保证旧 KV 历史值先迁移，再自增
      const existing = await db.prepare('SELECT views FROM view_counts WHERE slug = ?').bind(slug).first();
      if (!existing) await seedFromLegacy(slug, 0);

      const row = await db
        .prepare(
          `INSERT INTO view_counts (slug, views, updated_at) VALUES (?, 1, ?)
           ON CONFLICT(slug) DO UPDATE SET views = views + 1, updated_at = excluded.updated_at
           RETURNING views`
        )
        .bind(slug, now)
        .first();
      return { count: Number(row && row.views) || 1, counted: true };
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
