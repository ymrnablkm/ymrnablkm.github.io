// 下载点击统计存储层：Cloudflare D1（优先）+ KV（兜底）+ 本地内存（开发）
//
// 数据模型（D1）：
//   download_counts(slug PRIMARY KEY, download_count, updated_at)
//   download_hits(slug, visitor_id, created_at, PRIMARY KEY (slug, visitor_id))
//   唯一约束保证同一匿名访客对同一文章只计一次。
//
// KV 兜底（D1 未绑定时自动启用）：
//   download:<slug>            → 累计点击次数
//   dlseen:<slug>:<visitorId>  → 去重标记（TTL 365 天）

const SEEN_TTL = 365 * 24 * 60 * 60;

const D1_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS download_counts (
     slug TEXT PRIMARY KEY,
     download_count INTEGER NOT NULL DEFAULT 0,
     updated_at TEXT NOT NULL
   )`,
  `CREATE TABLE IF NOT EXISTS download_hits (
     slug TEXT NOT NULL,
     visitor_id TEXT NOT NULL,
     created_at TEXT NOT NULL,
     PRIMARY KEY (slug, visitor_id)
   )`,
  `CREATE INDEX IF NOT EXISTS idx_download_hits_slug ON download_hits (slug)`,
];

// ---------- 本地内存实现（dev-server 使用） ----------
function createMemoryStore() {
  const counts = new Map();
  const hits = new Set();

  return {
    kind: 'memory',

    async recordHit(slug, visitorId) {
      const hitKey = `${slug}:${visitorId}`;
      if (hits.has(hitKey)) {
        return { counted: false, count: counts.get(slug) || 0 };
      }
      hits.add(hitKey);
      const next = (counts.get(slug) || 0) + 1;
      counts.set(slug, next);
      return { counted: true, count: next };
    },

    async getAllCounts() {
      return Array.from(counts.entries()).map(([slug, count]) => ({ slug, count }));
    },
  };
}

// ---------- Cloudflare D1 实现 ----------
function createD1Store(db) {
  let schemaReady = null;

  const ensureSchema = () => {
    if (!schemaReady) {
      schemaReady = db
        .batch(D1_SCHEMA.map((sql) => db.prepare(sql)))
        .catch((error) => {
          schemaReady = null;
          throw error;
        });
    }
    return schemaReady;
  };

  return {
    kind: 'd1',

    async recordHit(slug, visitorId) {
      await ensureSchema();
      const now = new Date().toISOString();

      // 唯一约束去重：只有真正插入成功的一次才计数
      const hit = await db
        .prepare('INSERT OR IGNORE INTO download_hits (slug, visitor_id, created_at) VALUES (?, ?, ?)')
        .bind(slug, visitorId, now)
        .run();
      const changed = Number(hit && hit.meta && hit.meta.changes) || 0;

      if (!changed) {
        const row = await db
          .prepare('SELECT download_count FROM download_counts WHERE slug = ?')
          .bind(slug)
          .first();
        return { counted: false, count: Number(row && row.download_count) || 0 };
      }

      const row = await db
        .prepare(
          `INSERT INTO download_counts (slug, download_count, updated_at)
           VALUES (?, 1, ?)
           ON CONFLICT(slug) DO UPDATE SET
             download_count = download_count + 1,
             updated_at = excluded.updated_at
           RETURNING download_count`
        )
        .bind(slug, now)
        .first();
      return { counted: true, count: Number(row && row.download_count) || 1 };
    },

    async getAllCounts() {
      await ensureSchema();
      const result = await db.prepare('SELECT slug, download_count FROM download_counts').all();
      const rows = (result && result.results) || [];
      return rows.map((row) => ({ slug: row.slug, count: Number(row.download_count) || 0 }));
    },
  };
}

// ---------- 现有 KV 实现（D1 未绑定时兜底） ----------
function createKvStore(kv) {
  return {
    kind: 'kv',

    async recordHit(slug, visitorId) {
      const seenKey = `dlseen:${slug}:${visitorId}`;
      const countKey = `download:${slug}`;

      const already = await kv.get(seenKey);
      if (already !== null) {
        const val = await kv.get(countKey);
        return { counted: false, count: val ? parseInt(val, 10) || 0 : 0 };
      }

      await kv.put(seenKey, '1', { expirationTtl: SEEN_TTL });

      // CAS 自增，尽量降低并发多计的可能
      for (let attempt = 0; attempt < 3; attempt++) {
        const existing = await kv.getWithMetadata(countKey);
        const current = existing.value ? parseInt(existing.value, 10) || 0 : 0;
        const next = current + 1;
        const putOptions = {};
        if (existing.value !== null && existing.metadata && existing.metadata.version) {
          putOptions.ifVersionMatches = existing.metadata.version;
        }
        try {
          await kv.put(countKey, String(next), putOptions);
          return { counted: true, count: next };
        } catch (error) {
          if (attempt === 2) {
            const val = await kv.get(countKey);
            const fallback = (val ? parseInt(val, 10) || 0 : 0) + 1;
            await kv.put(countKey, String(fallback));
            return { counted: true, count: fallback };
          }
          await new Promise((resolve) => setTimeout(resolve, 20 + attempt * 20));
        }
      }
    },

    async getAllCounts() {
      const items = [];
      let cursor;
      do {
        const page = await kv.list({ prefix: 'download:', cursor });
        const keys = page.keys || [];
        const values = await Promise.all(keys.map((key) => kv.get(key.name)));
        keys.forEach((key, index) => {
          const raw = values[index];
          items.push({
            slug: key.name.slice('download:'.length),
            count: raw ? parseInt(raw, 10) || 0 : 0,
          });
        });
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return items;
    },
  };
}

// ---------- 工厂 ----------
export function createDownloadsStore(env) {
  if (env && env.DOWNLOADS_STORE) {
    return env.DOWNLOADS_STORE;
  }
  if (env && env.DOWNLOADS_DB) {
    try {
      return createD1Store(env.DOWNLOADS_DB);
    } catch (error) {
      console.warn('[downloads-store] D1 初始化失败，降级为 KV：', error.message);
    }
  }
  if (env && env.VIEWS_KV) {
    return createKvStore(env.VIEWS_KV);
  }
  return createMemoryStore();
}
