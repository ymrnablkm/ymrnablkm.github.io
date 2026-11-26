// 访问统计存储：KV（生产）+ 内存（本地开发）
//
// 写入量控制：每次页面访问只写 1 个键（当日汇总），避免占满 KV 免费额度（1000 写/天）。
//   stat:day:<YYYY-MM-DD> → {"pv":n,"uv":n,"m":n,"d":n,"v":["访客哈希"...]}
// 兼容旧数据：
//   stat:pvtotal / stat:uvall / stat:uv:<date>:<vid> / stat:uvall:<vid> 只读不写，
//   累计值取「按日累加」与「旧累计键」中的较大值，历史数据不会丢失。

const MAX_DAY_HASHES = 5000;

function hashVisitor(visitorId) {
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

function beijingDate(offsetDays = 0) {
  const ts = Date.now() + 8 * 3600 * 1000 + offsetDays * 86400 * 1000;
  return new Date(ts).toISOString().slice(0, 10);
}

function parseDay(raw) {
  const empty = { pv: 0, uv: 0, m: 0, d: 0, v: [] };
  if (!raw) return empty;
  try {
    const data = JSON.parse(raw);
    const uvs = Array.isArray(data.v) ? data.v.map(String) : [];
    const pv = Number(data.pv) || 0;
    const m = Number(data.m) || 0;
    const d = Number(data.d) || 0;
    return { pv, uv: uvs.length || Number(data.uv) || 0, m, d, v: uvs };
  } catch (error) {
    return empty;
  }
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
    async put(key, value) {
      await kv.put(key, value);
    },
  };
}

function buildStore(backend, kind) {
  return {
    kind,

    async recordVisit({ visitorId, isMobile }) {
      const today = beijingDate(0);
      const key = `stat:day:${today}`;
      const day = parseDay(await backend.get(key));

      day.pv += 1;
      if (isMobile) day.m += 1;
      else day.d += 1;

      const visitor = hashVisitor(visitorId);
      if (!day.v.includes(visitor) && day.v.length < MAX_DAY_HASHES) {
        day.v.push(visitor);
      }
      day.uv = day.v.length;

      try {
        await backend.put(key, JSON.stringify(day));
      } catch (error) {
        // 额度耗尽或瞬时失败时不影响页面，返回内存中的结果
        if (!/limit exceeded|quota/i.test(String(error && error.message))) throw error;
        return { pv: day.pv, uv: day.uv };
      }
      return { pv: day.pv, uv: day.uv };
    },

    async getOverview(days = 30) {
      const range = Math.min(Math.max(days, 7), 90);
      const span = Math.max(range, 90);

      const dates = [];
      for (let offset = span - 1; offset >= 0; offset--) dates.push(beijingDate(-offset));

      const raws = await Promise.all(dates.map((date) => backend.get(`stat:day:${date}`)));
      const all = dates.map((date, index) => ({ date, ...parseDay(raws[index]) })).map((item) => ({
        date: item.date,
        pv: item.pv,
        uv: item.uv,
        m: item.m,
        d: item.d,
      }));

      const daily = all.slice(all.length - range);
      const sum = (list, key) => list.reduce((acc, item) => acc + (item[key] || 0), 0);

      // 兼容旧累计键：取按日累加与旧累计值中的较大者，确保历史数据不减少
      const [legacyPvRaw, legacyUvRaw] = await Promise.all([
        backend.get('stat:pvtotal'),
        backend.get('stat:uvall'),
      ]);
      const legacyPv = parseInt(legacyPvRaw || '0', 10) || 0;
      const legacyUv = parseInt(legacyUvRaw || '0', 10) || 0;
      const dailyPv = sum(all, 'pv');
      const dailyUv = sum(all, 'uv');

      return {
        daily,
        totalPv: Math.max(legacyPv, dailyPv),
        totalUv: Math.max(legacyUv, dailyUv),
        today: {
          pv: daily[daily.length - 1]?.pv || 0,
          uv: daily[daily.length - 1]?.uv || 0,
        },
        yesterday: {
          pv: daily[daily.length - 2]?.pv || 0,
          uv: daily[daily.length - 2]?.uv || 0,
        },
        last7: { pv: sum(all.slice(-7), 'pv'), uv: sum(all.slice(-7), 'uv') },
        last30: { pv: sum(all.slice(-30), 'pv'), uv: sum(all.slice(-30), 'uv') },
        devices: { mobile: sum(all, 'm'), desktop: sum(all, 'd') },
      };
    },
  };
}

export function createAnalyticsStore(env) {
  if (env && env.ANALYTICS_STORE) return env.ANALYTICS_STORE;
  if (env && env.VIEWS_KV) return buildStore(createKvBackend(env.VIEWS_KV), 'kv');
  return buildStore(createMemoryBackend(), 'memory');
}
