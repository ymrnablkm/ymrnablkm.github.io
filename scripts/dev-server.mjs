// 本地联调服务器：同时提供 dist 静态站点、后台 SPA 和真实可用的管理 API
import http from 'node:http';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from '../server/router.js';
import { createLocalStore } from '../server/lib/local-store.js';
import { createViewsStore } from '../server/lib/views-store.js';
import { createDownloadsStore } from '../server/lib/downloads-store.js';
import { createLinkcheckStore } from '../server/lib/linkcheck-store.js';
import { createAnalyticsStore } from '../server/lib/analytics-store.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.join(root, 'dist');
const port = Number(process.env.PORT || 4322);

const env = {
  LOCAL_ROOT: root,
  ALLOW_DEV_LOGIN: '1',
  SESSION_SECRET: process.env.SESSION_SECRET || 'local-dev-secret-change-me',
  GITHUB_REPO: 'ymrnablkm/ymrnablkm.github.io',
  GITHUB_BRANCH: 'main',
  VIEWS_STORE: createViewsStore({}), // 共享实例，进程内持久化浏览量
  DOWNLOADS_STORE: createDownloadsStore({}), // 共享实例，进程内持久化下载点击数
  LINKCHECK_STORE: createLinkcheckStore({}),
  ANALYTICS_STORE: createAnalyticsStore({}),
};

const store = createLocalStore(env);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
};

async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
}

function sendFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const type = MIME[ext] || 'application/octet-stream';
  return fs.readFile(filePath).then((buffer) => {
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
    res.end(buffer);
  });
}

async function serveStatic(res, pathname) {
  const decoded = decodeURIComponent(pathname);
  const relative = decoded.replace(/^\/+/, '');
  const target = path.resolve(dist, relative);
  if (!target.startsWith(dist)) {
    res.writeHead(403).end('Forbidden');
    return;
  }
  const candidates = [];
  if (decoded === '/') candidates.push(path.join(dist, 'index.html'));
  else candidates.push(target, `${target}.html`, path.join(target, 'index.html'));
  for (const candidate of candidates) {
    try {
      const info = await fs.stat(candidate);
      if (info.isFile()) return sendFile(res, candidate);
    } catch {
      /* 继续尝试下一个候选路径 */
    }
  }
  // 后台 SPA 路由回退
  if (decoded.startsWith('/admin/app')) {
    try {
      return await sendFile(res, path.join(dist, 'admin/app/index.html'));
    } catch {
      /* 后台尚未构建 */
    }
  }
  if (decoded.startsWith('/admin')) {
    try {
      return await sendFile(res, path.join(dist, 'admin/index.html'));
    } catch {
      /* ignore */
    }
  }
  const notFound = path.join(dist, '404.html');
  try {
    await fs.access(notFound);
    res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(await fs.readFile(notFound));
  } catch {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('404 Not Found');
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || `127.0.0.1:${port}`}`);

  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(req.headers)) {
        if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
        else if (value !== undefined) headers.set(key, String(value));
      }
      const body = await readBody(req);
      const request = new Request(url.toString(), { method: req.method, headers, body });
      const response = await handleApi(request, env, store);

      res.statusCode = response.status;
      response.headers.forEach((value, key) => {
        if (key.toLowerCase() === 'set-cookie') return;
        res.setHeader(key, value);
      });
      const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
      if (cookies.length) res.setHeader('Set-Cookie', cookies);
      res.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ ok: false, error: error.message }));
    }
    return;
  }

  if (url.pathname === '/admin') {
    res.writeHead(302, { Location: '/admin/app/' });
    res.end();
    return;
  }

  serveStatic(res, url.pathname).catch((error) => {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(`本地服务器错误：${error.message}`);
  });
});

server.listen(port, '127.0.0.1', () => {
  console.log(`本地联调服务器已启动：http://127.0.0.1:${port}`);
  console.log(`前台首页：http://127.0.0.1:${port}/`);
  console.log(`管理后台：http://127.0.0.1:${port}/admin/app/`);
});
