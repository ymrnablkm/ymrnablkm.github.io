// 链接检测结果存储：KV（生产）+ 内存（本地开发）
// key: linkcheck:<slug> → { slug, status, message, checkedAt, links: [...] }

function createMemoryBackend() {
  const map = new Map();
  return {
    async get(key) {
      return map.has(key) ? map.get(key) : null;
    },
    async put(key, value) {
      map.set(key, value);
    },
    async list(prefix) {
      return [...map.keys()].filter((key) => key.startsWith(prefix)).map((name) => ({ name }));
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
    async list(prefix) {
      const keys = [];
      let cursor;
      do {
        const page = await kv.list({ prefix, cursor });
        keys.push(...(page.keys || []));
        cursor = page.list_complete ? undefined : page.cursor;
      } while (cursor);
      return keys;
    },
  };
}

function buildStore(backend, kind) {
  return {
    kind,

    async getAll() {
      const keys = await backend.list('linkcheck:');
      const values = await Promise.all(keys.map((key) => backend.get(key.name)));
      const results = {};
      keys.forEach((key, index) => {
        const raw = values[index];
        if (!raw) return;
        try {
          const item = JSON.parse(raw);
          if (item && item.slug) results[item.slug] = item;
        } catch (error) {
          /* 忽略损坏的单条记录 */
        }
      });
      return results;
    },

    async get(slug) {
      const raw = await backend.get(`linkcheck:${slug}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (error) {
        return null;
      }
    },

    async save(result) {
      await backend.put(`linkcheck:${result.slug}`, JSON.stringify(result));
      return result;
    },

    async remove(slug) {
      await backend.put(`linkcheck:${slug}`, '');
    },
  };
}

export function createLinkcheckStore(env) {
  if (env && env.LINKCHECK_STORE) return env.LINKCHECK_STORE;
  if (env && env.VIEWS_KV) return buildStore(createKvBackend(env.VIEWS_KV), 'kv');
  return buildStore(createMemoryBackend(), 'memory');
}
