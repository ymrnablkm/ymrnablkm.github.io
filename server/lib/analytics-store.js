// 访问统计存储：KV（生产）+ 内存（本地开发）
//
// key:
//   stat:day:<YYYY-MM-DD>  → { pv, uv, m, d }（北京时间自然日）
//   stat:pvtotal           → 累计浏览量
//   stat:uvall             → 累计独立访客（按浏览器匿名标识去重）
//   stat:uv:<date>:<vid>   → 当日访客去重标记（TTL 3 天）
//   stat:uvall:<vid>       → 全站访客去重标记（永久）

const UV_TTL = 3 * 24 * 60 * 60;

function beijingDate(offsetDays = 0) {
  const ts = Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000;
  return new Date(ts).toISOString().slice(0, 10);
}

function createMemoryBackend() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
  };
}

function createKvBackend(kv) {
  return {
    async get(key) {
      return kv.get(key);
    },
    async put(key, value, options) {
      await kv.put(key, value, options || {});
    },
  };
}

function buildStore(backend, kind) {
  const bump = async (key, options) => {
    const raw = await backend.get(key);
    const current = raw ? parseInt(raw, 10) || 0 : 0;
    const next = current + 1;
    await backend.put(key, String(next), options);
    return next;
  };

  return {
    kind,

    async recordVisit({ visitorId, isMobile }) {
      const today = beijingDate(0);
      const dayKey = `stat:day:${today}`;
      const raw = await backend.get(dayKey);
      let day = { pv: 0, uv: 0, m: 0, d: 0 };
      if (raw) {
        try {
          day = { ...day, ...JSON.parse(raw) };
        } catch (error) {
          /* 记录损坏时从 0 开始 */
        }
      }
      day.pv += 1;
      if (isMobile) day.m += 1;
      else day.d += 1;

      const uvKey = `stat:uv:${today}:${visitorId}`;
      const seenToday = await backend.get(uvKey);
      if (!seenToday) {
        await backend.put(uvKey, '1', { expirationTtl: UV_TTL });
        day.uv += 1;
      }

      await backend.put(dayKey, JSON.stringify(day));
      await bump('stat:pvtotal');

      const uvAllKey = `stat:uvall:${visitorId}`;
      const seenEver = await backend.get(uvAllKey);
      if (!seenEver) {
        await backend.put(uvAllKey, '1');
        await bump('stat:uvall');
      }

      return day;
    },

    async getOverview(days = 30) {
      const range = Math.min(Math.max(days, 1), 90);
      const daily = [];
      for (let offset = range - 1; offset >= 0; offset--) {
        const date = beijingDate(-offset);
        const raw = await backend.get(`stat:day:${date}`);
        let day = { pv: 0, uv: 0, m: 0, d: 0 };
        if (raw) {
          try {
            day = { ...day, ...JSON.parse(raw) };
          } catch (error) {
            /* 忽略损坏数据 */
          }
        }
        daily.push({ date, ...day });
      }

      const totalPv = parseInt((await backend.get('stat:pvtotal')) || '0', 10) || 0;
      const totalUv = parseInt((await backend.get('stat:uvall')) || '0', 10) || 0;
      const today = daily[daily.length - 1] || { pv: 0, uv: 0, m: 0, d: 0 };
      const yesterday = daily[daily.length - 2] || { pv: 0, uv: 0, m: 0, d: 0 };
      const sum = (list, key) => list.reduce((acc, item) => acc + (item[key] || 0), 0);

      return {
        daily,
        totalPv,
        totalUv,
        today,
        yesterday,
        last7: { pv: sum(daily.slice(-7), 'pv'), uv: sum(daily.slice(-7), 'uv') },
        last30: { pv: sum(daily.slice(-30), 'pv'), uv: sum(daily.slice(-30), 'uv') },
        devices: {
          mobile: sum(daily, 'm'),
          desktop: sum(daily, 'd'),
        },
      };
    },
  };
}

export function createAnalyticsStore(env) {
  if (env && env.ANALYTICS_STORE) return env.ANALYTICS_STORE;
  if (env && env.VIEWS_KV) return buildStore(createKvBackend(env.VIEWS_KV), 'kv');
  return buildStore(createMemoryBackend(), 'memory');
}
