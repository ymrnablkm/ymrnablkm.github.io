// ============================================================
// Aether Yard · 数据同步 API
// 架构：localStorage 缓存优先 + GitHub 后台同步
// 读取：先读缓存（0 延迟）→ 后台从 GitHub 刷新
// 写入：先写缓存（立即显示）→ 自动推 GitHub
// ============================================================

(function (global) {
  const OWNER = 'ymrnablkm';
  const REPO = 'ymrnablkm.github.io';
  const BRANCH = 'main';

  const CACHE_KEY = 'aether.software.local';
  const CACHE_TIME_KEY = 'aether.software.cacheAt';
  const TOKEN_KEY = 'aether.github.token';
  const SYNC_PENDING_KEY = 'aether.sync.pending'; // 是否有待推送的本地修改
  const SYNC_LOCK_KEY = 'aether.sync.lock'; // 防止重复同步
  const REMOTE_ETAG_KEY = 'aether.software.etag'; // 记录远端 ETag，节省带宽

  // ---- 基础工具 ----
  function getToken() { return localStorage.getItem(TOKEN_KEY) || ''; }
  function setToken(t) { localStorage.setItem(TOKEN_KEY, t); }
  function hasToken() { return !!getToken(); }

  function getCache() {
    try {
      const d = JSON.parse(localStorage.getItem(CACHE_KEY) || '[]');
      return Array.isArray(d) ? d : [];
    } catch (e) { return []; }
  }
  function setCache(data) {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data));
    localStorage.setItem(CACHE_TIME_KEY, Date.now().toString());
  }
  function getCacheAge() {
    const t = parseInt(localStorage.getItem(CACHE_TIME_KEY) || '0', 10);
    return t ? (Date.now() - t) : Infinity;
  }
  function markPending() { localStorage.setItem(SYNC_PENDING_KEY, '1'); }
  function clearPending() { localStorage.removeItem(SYNC_PENDING_KEY); }
  function isPending() { return localStorage.getItem(SYNC_PENDING_KEY) === '1'; }

  function escapeHTML(s) {
    return String(s || '').replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }

  function uid() {
    return 'r_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
  }

  // ---- 数据合并（本地 + 远端）----
  function merge(localData, remoteData) {
    const byId = {};
    // 远端数据作为基线
    (remoteData || []).forEach(function (item) { byId[item.id] = item; });
    // 本地数据覆盖（本地更新时间更新的优先）
    (localData || []).forEach(function (item) {
      const existing = byId[item.id];
      if (!existing) {
        byId[item.id] = item; // 本地新增
      } else {
        // 比较 updatedAt，取更新的
        const localT = new Date(item.updatedAt || item.createdAt || 0).getTime();
        const remoteT = new Date(existing.updatedAt || existing.createdAt || 0).getTime();
        if (localT >= remoteT) byId[item.id] = item;
      }
    });
    const merged = Object.values(byId);
    merged.sort(function (a, b) {
      return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
    });
    return merged;
  }

  // ---- GitHub API：读取 ----
  async function readFromGitHub(path) {
    const file = path || 'data/software.json';
    // 优先读同源 Cloudflare Pages（走 CDN，速度比 raw.githubusercontent 快得多）
    // 但 Cloudflare Pages 构建后才更新，所以也试 raw.githubusercontent
    const urls = [
      file + '?_=' + Date.now(),  // 同源 Cloudflare（最快）
      'https://raw.githubusercontent.com/' + OWNER + '/' + REPO + '/' + BRANCH + '/' + file + '?_=' + Date.now()
    ];
    let lastError = null;
    for (let i = 0; i < urls.length; i++) {
      try {
        const controller = new AbortController();
        setTimeout(function () { controller.abort(); }, 8000);
        const res = await fetch(urls[i], {
          cache: 'no-store',
          signal: controller.signal
        });
        if (res.ok) {
          const json = await res.json();
          return Array.isArray(json) ? json : [];
        }
        lastError = 'HTTP ' + res.status;
      } catch (e) {
        lastError = e.message;
      }
    }
    throw new Error('无法从 GitHub 读取：' + lastError);
  }

  // ---- GitHub API：写入 ----
  async function writeToGitHub(path, content, message) {
    const token = getToken();
    if (!token) throw new Error('未配置 Token · 请先到 sync.html 填入 Token');

    const baseUrl = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + path;
    const attempts = [
      { name: '直连', url: baseUrl },
      { name: '代理 1', url: 'https://corsproxy.io/?' + encodeURIComponent(baseUrl) },
      { name: '代理 2', url: 'https://api.allorigins.win/raw?url=' + encodeURIComponent(baseUrl) }
    ];

    // 1. 获取 SHA（检测文件是否存在）
    let sha = null;
    let lastErr = null;
    for (let i = 0; i < attempts.length; i++) {
      try {
        const controller = new AbortController();
        setTimeout(function () { controller.abort(); }, 10000);
        const res = await fetch(attempts[i].url + '?ref=' + BRANCH, {
          headers: { 'Authorization': 'Bearer ' + token, 'Accept': 'application/vnd.github.v3+json' },
          signal: controller.signal
        });
        if (res.ok) { sha = (await res.json()).sha; break; }
        if (res.status === 404) { break; } // 文件不存在，正常
        const err = await res.json().catch(function () { return {}; });
        lastErr = err.message || ('HTTP ' + res.status);
      } catch (e) { lastErr = e.message; }
    }

    // 2. 推送
    const body = {
      message: message || 'sync: 更新数据',
      content: btoa(unescape(encodeURIComponent(content))),
      branch: BRANCH
    };
    if (sha) body.sha = sha;

    for (let i = 0; i < attempts.length; i++) {
      try {
        const controller = new AbortController();
        setTimeout(function () { controller.abort(); }, 20000);
        const res = await fetch(attempts[i].url, {
          method: 'PUT',
          headers: {
            'Authorization': 'Bearer ' + token,
            'Accept': 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(body),
          signal: controller.signal
        });
        if (res.ok) return { ok: true };
        const err = await res.json().catch(function () { return {}; });
        lastErr = err.message || ('HTTP ' + res.status);
      } catch (e) { lastErr = e.message; }
    }
    throw new Error('GitHub 推送失败：' + lastErr);
  }

  // ---- 高级操作：读取（缓存优先）----
  // 返回 { data, from: 'cache'|'remote'|'empty', changed: boolean }
  async function loadSmart(skipRefresh) {
    const cached = getCache();
    const result = { data: cached, from: 'cache', changed: false };

    if (skipRefresh) return result;

    // 后台异步刷新
    try {
      const remote = await readFromGitHub('data/software.json');
      const merged = merge(cached, remote);
      // 比较是否有变化
      if (JSON.stringify(merged) !== JSON.stringify(cached)) {
        setCache(merged);
        result.data = merged;
        result.from = 'remote';
        result.changed = true;
      } else {
        result.from = 'remote'; // 远程返回，但无变化
      }
    } catch (e) {
      // 远程失败就用缓存，不报错
      result.error = e.message;
    }
    return result;
  }

  // ---- 高级操作：写入（乐观更新 + 后台推送）----
  // updater(data) => newData   （也可以直接传完整数组）
  // onProgress(msg, stage) 阶段：'local' | 'syncing' | 'done' | 'error'
  async function updateData(updater, onProgress) {
    // 1. 先从缓存读（保证快）
    const current = getCache();

    // 2. 应用更新
    const updated = typeof updater === 'function' ? updater(current) : updater;
    if (!Array.isArray(updated)) throw new Error('数据格式错误');

    // 3. 立即写缓存（乐观更新）
    setCache(updated);
    markPending(); // 标记有待同步
    if (onProgress) onProgress('本地已保存 ✓', 'local');

    // 4. 后台自动推送到 GitHub（如果有 Token）
    if (hasToken()) {
      // 防止重复同步
      const now = Date.now();
      const lockAt = parseInt(localStorage.getItem(SYNC_LOCK_KEY) || '0', 10);
      if (now - lockAt < 5000) return updated; // 5 秒内不重复
      localStorage.setItem(SYNC_LOCK_KEY, now.toString());

      if (onProgress) onProgress('正在同步到 GitHub...', 'syncing');
      try {
        await writeToGitHub(
          'data/software.json',
          JSON.stringify(updated, null, 2),
          'sync: 更新 software.json（' + updated.length + ' 条）'
        );
        clearPending();
        if (onProgress) onProgress('同步到 GitHub 成功 ✓', 'done');
      } catch (e) {
        if (onProgress) onProgress('同步 GitHub 失败：' + e.message + '（数据已保存在本地，点"同步"按钮重试）', 'error');
      } finally {
        localStorage.removeItem(SYNC_LOCK_KEY);
      }
    } else {
      if (onProgress) onProgress('本地已保存 · 需配置 Token 才能同步到 GitHub', 'error');
    }

    return updated;
  }

  // ---- 便利方法：发布新资源 ----
  async function publish(record, onProgress) {
    return updateData(function (list) {
      const full = Object.assign({}, record, {
        id: record.id || uid(),
        createdAt: record.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      return [full].concat(list);
    }, onProgress);
  }

  // ---- 便利方法：删除 ----
  async function remove(id, onProgress) {
    return updateData(function (list) {
      return list.filter(function (d) { return String(d.id) !== String(id); });
    }, onProgress);
  }

  // ---- 便利方法：更新一条 ----
  async function update(id, patch, onProgress) {
    return updateData(function (list) {
      return list.map(function (d) {
        if (String(d.id) !== String(id)) return d;
        return Object.assign({}, d, patch, { updatedAt: new Date().toISOString() });
      });
    }, onProgress);
  }

  // ---- 便利方法：手动触发完整同步（sync.html 用）----
  async function syncNow(onProgress) {
    const data = getCache();
    if (!hasToken()) throw new Error('未配置 Token');
    if (onProgress) onProgress('正在推送 ' + data.length + ' 条到 GitHub...', 'syncing');
    await writeToGitHub(
      'data/software.json',
      JSON.stringify(data, null, 2),
      'sync: 更新 software.json（' + data.length + ' 条）'
    );
    clearPending();
    if (onProgress) onProgress('同步成功 ✓', 'done');
    return data;
  }

  // ---- 导出 / 导入 ----
  function exportJSON() {
    const data = getCache();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'software.json';
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { document.body.removeChild(a); URL.revokeObjectURL(url); }, 300);
  }

  function importJSON(file) {
    return new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function (e) {
        try {
          const parsed = JSON.parse(e.target.result);
          const arr = Array.isArray(parsed) ? parsed : (parsed.software || []);
          if (arr.length === 0) return reject(new Error('文件为空或格式错误'));

          const current = getCache();
          const ids = new Set(current.map(function (d) { return d.id; }));
          const added = [];
          arr.forEach(function (it) {
            if (it.id && ids.has(it.id)) return;
            if (!it.id) it.id = uid();
            if (!it.createdAt) it.createdAt = new Date().toISOString();
            current.unshift(it);
            added.push(it);
          });
          current.sort(function (a, b) {
            return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
          });
          setCache(current);
          markPending();
          resolve({ count: added.length, data: current });
        } catch (err) { reject(err); }
      };
      reader.onerror = function () { reject(new Error('读取文件失败')); };
      reader.readAsText(file);
    });
  }

  // ---- 暴露 ----
  global.AetherAPI = {
    OWNER: OWNER, REPO: REPO, BRANCH: BRANCH,
    getToken: getToken, setToken: setToken, hasToken: hasToken,
    getCache: getCache, setCache: setCache, getCacheAge: getCacheAge,
    isPending: isPending, markPending: markPending, clearPending: clearPending,
    readFromGitHub: readFromGitHub, writeToGitHub: writeToGitHub,
    loadSmart: loadSmart, updateData: updateData,
    publish: publish, remove: remove, update: update, syncNow: syncNow,
    exportJSON: exportJSON, importJSON: importJSON,
    uid: uid, escapeHTML: escapeHTML
  };
})(typeof window !== 'undefined' ? window : this);
