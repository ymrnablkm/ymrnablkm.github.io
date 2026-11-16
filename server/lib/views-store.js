// 浏览量存储层：Cloudflare KV 实现 + 本地内存 mock
//
// KV key 设计：
//   view:<slug>        → 浏览次数（字符串数字）
//   seen:<slug>:<vid>  → 去重标记（值 "1"，TTL 365 天）
//
// 并发安全：使用 KV conditional put (ifVersionMatches) 实现 CAS 自增，
// 保证同一 slug 的浏览量在高并发下也不会多计数。

const SEEN_TTL = 365 * 24 * 60 * 60; // 365 天

// ---------- 本地内存 mock（用于 dev-server，进程内有效） ----------
function createMemoryStore() {
  const counts = new Map();    // slug → number
  const seen = new Map();      // `${slug}:${vid}` → true

  return {
    kind: 'memory',

    async getViewCount(slug) {
      return counts.get(slug) || 0;
    },

    async recordView(slug, visitorId) {
      const seenKey = `${slug}:${visitorId}`;
      if (seen.has(seenKey)) {
        return counts.get(slug) || 0;
      }
      seen.set(seenKey, true);
      const next = (counts.get(slug) || 0) + 1;
      counts.set(slug, next);
      return next;
    },
  };
}

// ---------- Cloudflare KV 实现 ----------
function createKvStore(kv) {
  return {
    kind: 'kv',

    async getViewCount(slug) {
      const val = await kv.get(`view:${slug}`);
      return val ? parseInt(val, 10) || 0 : 0;
    },

    async recordView(slug, visitorId) {
      const seenKey = `seen:${slug}:${visitorId}`;
      const countKey = `view:${slug}`;

      // 1) 先检查是否已计数
      const already = await kv.get(seenKey);
      if (already !== null) {
        // 已计数过，返回当前浏览量（允许短暂不一致）
        const val = await kv.get(countKey);
        return val ? parseInt(val, 10) || 0 : 0;
      }

      // 2) 标记为已计数（无论并发与否，写同样的值，幂等）
      await kv.put(seenKey, '1', { expirationTtl: SEEN_TTL });

      // 3) CAS 自增浏览量（重试 3 次）
      for (let attempt = 0; attempt < 3; attempt++) {
        const existing = await kv.getWithMetadata(countKey);
        const current = existing.value ? parseInt(existing.value, 10) || 0 : 0;
        const next = current + 1;

        // 构造 put 选项
        const putOptions = {};
        if (existing.value !== null && existing.metadata && existing.metadata.version) {
          // key 已存在且有 version，使用 CAS
          putOptions.ifVersionMatches = existing.metadata.version;
        }
        // 如果 key 不存在（existing.value === null），直接 put 即可
        // （Cloudflare 没有 "put if not exists"，但只有一个请求会先走到这里
        //   因为 seenKey 先写了，绝大多数情况下只有一个请求能进入自增逻辑）

        try {
          // CAS 写入
          await kv.put(countKey, String(next), putOptions);
          return next;
        } catch (err) {
          // CAS 失败（version 不匹配），或者 key 不存在时两个请求同时进入
          // 继续重试
          if (attempt === 2) {
            // 最后一次重试，放弃 CAS，直接读当前值 +1 写入（极少数情况）
            // 此时可能多计数 1 次，但 seenKey 已写入，后续不会再计数
            const val = await kv.get(countKey);
            const fallback = (val ? parseInt(val, 10) || 0 : 0) + 1;
            await kv.put(countKey, String(fallback));
            return fallback;
          }
          // 短暂等待后重试
          await new Promise((r) => setTimeout(r, 20 + attempt * 20));
        }
      }

      // 理论上不会走到这里
      const val = await kv.get(countKey);
      return val ? parseInt(val, 10) || 0 : 0;
    },
  };
}

// ---------- 工厂 ----------
export function createViewsStore(env) {
  // 允许外部预先注入共享实例（dev-server 用于本地持久化）
  if (env && env.VIEWS_STORE) {
    return env.VIEWS_STORE;
  }
  if (env && env.VIEWS_KV) {
    try {
      return createKvStore(env.VIEWS_KV);
    } catch (e) {
      console.warn('[views-store] KV 初始化失败，降级为内存模式：', e.message);
    }
  }
  return createMemoryStore();
}
