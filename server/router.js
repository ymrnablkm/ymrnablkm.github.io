// 管理后台 API 路由：所有写入都在服务端完成身份校验、CSRF 校验和 SHA 并发校验
import { json, fail, ok, readJson, getCookie, serializeCookie, requestOrigin, isSecureRequest } from './lib/http.js';
import { createSession, readSession, sessionCookieName, sessionMaxAge, randomToken } from './lib/session.js';
import { createViewsStore } from './lib/views-store.js';
import { createDownloadsStore } from './lib/downloads-store.js';
import { createLinkcheckStore } from './lib/linkcheck-store.js';
import { createAnalyticsStore } from './lib/analytics-store.js';
import { buildBackup, inspectBackup, restoreBackup } from './lib/backup.js';
// content 工具统一在下方导入
// eslint-disable-next-line
import {
  POSTS_DIR,
  PAGES_DIR,
  TRASH_DIR,
  MEDIA_DIR,
  parsePostFile,
  serializePost,
  parsePageFile,
  serializePage,
  normalizePost,
  normalizePage,
  normalizeCategory,
  normalizeTag,
  normalizeNavItem,
  normalizeSlug,
  toDateString,
  parseTrashFile,
  serializeTrashFile,
  isSafeRelativePath,
} from './lib/content.js';

const DEFAULT_SITE = {
  name: 'Aether Yard',
  subtitle: '优质资源分享站',
  description: 'Aether Yard - 优质资源分享站',
  logo: '/favicon.svg',
  icon: '/favicon.ico',
  domain: '',
  announcement: '',
  intro: '',
  footerText: '',
  copyright: 'All rights reserved.',
  contact: '',
  icp: '',
  defaultCover: '',
  social: [],
  seo: { title: '', description: '', keywords: [], ogImage: '' },
};

const DEFAULT_HOME = {
  announcement: { text: '', link: '', visible: false },
  hero: { title: '', subtitle: '', image: '', visible: true },
  slides: [],
  featured: [],
  footer: '',
  categories: [],
  modules: [
    { id: 'latest', type: 'latest', title: '最新发布', visible: true, limit: 12 },
    { id: 'categories', type: 'categories', title: '内容分类', visible: true },
  ],
};

const MEDIA_EXT = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'ico'];
const MAX_MEDIA_BYTES = 4 * 1024 * 1024;

// 图片上传内容校验：扩展名与文件头必须一致，SVG 不允许内联脚本
function decodeBase64Head(base64, length = 24) {
  try {
    return atob(String(base64).replace(/\s/g, '').slice(0, Math.ceil(length / 3) * 4));
  } catch (error) {
    return '';
  }
}

function matchesImageSignature(ext, base64) {
  const head = decodeBase64Head(base64, 16);
  if (!head) return false;
  const code = (index) => head.charCodeAt(index) || 0;
  if (ext === 'jpg' || ext === 'jpeg') return code(0) === 0xff && code(1) === 0xd8 && code(2) === 0xff;
  if (ext === 'png') return code(0) === 0x89 && head.slice(1, 4) === 'PNG';
  if (ext === 'gif') return head.slice(0, 3) === 'GIF';
  if (ext === 'webp') return head.slice(0, 4) === 'RIFF' && head.slice(8, 12) === 'WEBP';
  if (ext === 'avif') return head.slice(4, 8) === 'ftyp' && /avif|avis/.test(head.slice(8, 16));
  if (ext === 'ico') return code(0) === 0 && code(1) === 0 && code(2) === 1 && code(3) === 0;
  if (ext === 'svg') return /<svg/i.test(decodeBase64Head(base64, 400));
  return false;
}

// 下载统计公开接口：CORS 与文章可下载性校验（构建时生成的清单）
const PUBLIC_ORIGINS = ['https://ymrnablkm.github.io', 'https://ymrnablkm-github-io.pages.dev'];
let downloadManifestCache = { slugs: null, at: 0 };

function publicCorsHeaders(request) {
  const origin = request.headers.get('origin') || '';
  const isLocal = /^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin);
  if (!origin || (!PUBLIC_ORIGINS.includes(origin) && !isLocal)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

async function isDownloadableSlug(request, slug) {
  const now = Date.now();
  if (!downloadManifestCache.slugs || now - downloadManifestCache.at > 5 * 60 * 1000) {
    try {
      const response = await fetch(new URL('/download-manifest.json', request.url));
      if (response.ok) {
        const data = await response.json();
        if (data && Array.isArray(data.slugs)) {
          downloadManifestCache = { slugs: new Set(data.slugs), at: now };
        }
      }
    } catch (error) {
      /* 清单获取失败时保持上一份缓存（若没有缓存则拒绝计数） */
    }
  }
  return Boolean(downloadManifestCache.slugs && downloadManifestCache.slugs.has(slug));
}

// 公开接口的轻量限流（单 isolate 内存计数，不落地存储 IP）
const rateBuckets = new Map();
function allowPublicRequest(key, limit = 120, windowMs = 60 * 1000) {
  const bucket = Math.floor(Date.now() / windowMs);
  const mapKey = `${key}:${bucket}`;
  const current = rateBuckets.get(mapKey) || 0;
  if (current >= limit) return false;
  rateBuckets.set(mapKey, current + 1);
  if (rateBuckets.size > 5000) {
    const cutoff = bucket - 1;
    for (const [k] of rateBuckets) {
      if (k.endsWith(`:${cutoff}`)) rateBuckets.delete(k);
    }
  }
  return true;
}

function isMobileUserAgent(userAgent) {
  return /Android|iPhone|iPad|iPod|Mobile|HarmonyOS|Windows Phone/i.test(userAgent || '');
}

// 禁止检测内网/本机地址，避免链接检测被用作 SSRF
function isBlockedHost(hostname) {
  const host = String(hostname || '').toLowerCase();
  if (!host) return true;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) {
    return true;
  }
  if (host === '::1' || host === '[::1]') return true;
  const ipv4 = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 0 || a === 10 || a === 127) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
  }
  return false;
}

// ---------- 链接有效性检测 ----------
const BAD_LINK_WORDS = [
  '链接不存在',
  '分享的文件已经被取消',
  '分享已失效',
  '分享已取消',
  '分享内容已被删除',
  '文件已删除',
  '文件不存在',
  '链接已失效',
  '链接已过期',
  '该分享已被取消',
  '你访问的页面不存在',
];
const RISKY_LINK_WORDS = ['请输入提取码', '提取码', '访问码', '验证码', '安全验证', '请先登录', '登录后'];

async function checkOneLink(url) {
  const started = Date.now();
  let parsed;
  try {
    parsed = new URL(url);
  } catch (error) {
    return { status: 'invalid', message: '链接格式不正确', ms: 0 };
  }
  if (!/^https?:$/.test(parsed.protocol)) {
    return { status: 'invalid', message: '仅支持 http/https 链接', ms: 0 };
  }
  if (isBlockedHost(parsed.hostname)) {
    return { status: 'invalid', message: '不支持检测内网或本机地址', ms: 0 };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(parsed.toString(), {
      method: 'GET',
      redirect: 'follow',
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });

    const ms = Date.now() - started;
    if (response.status === 404 || response.status === 410) {
      return { status: 'invalid', message: `页面不存在（HTTP ${response.status}）`, ms };
    }
    if (response.status === 401 || response.status === 403) {
      return { status: 'unknown', message: `需要登录或触发风控（HTTP ${response.status}）`, ms };
    }
    if (response.status === 429) {
      return { status: 'unknown', message: '请求过于频繁（HTTP 429），无法判断', ms };
    }
    if (response.status >= 500) {
      return { status: 'unknown', message: `网盘服务器错误（HTTP ${response.status}）`, ms };
    }
    if (!response.ok) {
      return { status: 'unknown', message: `HTTP ${response.status}`, ms };
    }

    const contentType = response.headers.get('content-type') || '';
    let text = '';
    if (contentType.includes('text/html') || contentType.includes('text/plain')) {
      text = (await response.text()).slice(0, 200000);
    }
    const bad = BAD_LINK_WORDS.find((word) => text.includes(word));
    if (bad) return { status: 'invalid', message: `页面提示「${bad}」`, ms };
    const risky = RISKY_LINK_WORDS.find((word) => text.includes(word));
    if (risky) return { status: 'unknown', message: `需要提取码或登录确认（${risky}）`, ms };
    return { status: 'ok', message: '页面可正常访问', ms };
  } catch (error) {
    const ms = Date.now() - started;
    const timedOut = error && error.name === 'AbortError';
    return { status: 'failed', message: timedOut ? '检测超时（8 秒）' : `检测失败：${error.message || '网络错误'}`, ms };
  } finally {
    clearTimeout(timer);
  }
}

function mergeLinkStatus(links) {
  if (links.some((item) => item.status === 'invalid')) return 'invalid';
  if (links.some((item) => item.status === 'failed')) return 'failed';
  if (links.some((item) => item.status === 'unknown')) return 'unknown';
  return 'ok';
}


function toBodyText(store, path, fallback) {
  return store
    .getFile(path)
    .then((file) => (file && typeof file.text === 'string' ? file.text : fallback))
    .catch(() => fallback);
}

async function readJsonFile(store, path, fallback) {
  const file = await store.getFile(path);
  if (!file || typeof file.text !== 'string') {
    return { data: JSON.parse(JSON.stringify(fallback)), sha: null, exists: false };
  }
  try {
    return { data: JSON.parse(file.text), sha: file.sha, exists: true };
  } catch {
    return { data: JSON.parse(JSON.stringify(fallback)), sha: file.sha, exists: false };
  }
}

async function writeJsonFile(store, path, data, message, sha) {
  return store.putFile(path, `${JSON.stringify(data, null, 2)}\n`, message, sha || undefined);
}

async function listPostFiles(store) {
  const items = await store.listDir(POSTS_DIR);
  return items.filter((item) => item.type !== 'dir' && /\.md$/i.test(item.name));
}

async function loadPosts(store) {
  const files = await listPostFiles(store);
  const posts = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await store.getFile(`${POSTS_DIR}/${file.name}`);
        if (!content) return null;
        const slug = file.name.replace(/\.md$/i, '');
        const post = parsePostFile(content.text, slug);
        return { ...post, sha: content.sha, fileName: file.name };
      } catch {
        return null;
      }
    })
  );
  const pinnedOf = (post) => Boolean(post.pinnedHome || post.pinnedCategory);
  return posts
    .filter(Boolean)
    .sort((a, b) => {
      if (pinnedOf(a) !== pinnedOf(b)) return pinnedOf(a) ? -1 : 1;
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });
}

async function loadPages(store) {
  const items = await store.listDir(PAGES_DIR);
  const files = items.filter((item) => item.type !== 'dir' && /\.md$/i.test(item.name));
  const pages = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await store.getFile(`${PAGES_DIR}/${file.name}`);
        if (!content) return null;
        return { ...parsePageFile(content.text, file.name.replace(/\.md$/i, '')), sha: content.sha };
      } catch {
        return null;
      }
    })
  );
  return pages.filter(Boolean).sort((a, b) => a.order - b.order);
}

async function loadTrash(store) {
  const items = await store.listDir(TRASH_DIR);
  const files = items.filter((item) => item.type !== 'dir' && /\.md$/i.test(item.name));
  const entries = await Promise.all(
    files.map(async (file) => {
      try {
        const content = await store.getFile(`${TRASH_DIR}/${file.name}`);
        if (!content) return null;
        const parsed = parseTrashFile(content.text);
        return { id: file.name.replace(/\.md$/i, ''), sha: content.sha, ...parsed };
      } catch {
        return null;
      }
    })
  );
  return entries.filter(Boolean).sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
}

async function loadMedia(store) {
  let items = [];
  try {
    items = await store.listTree(MEDIA_DIR);
  } catch {
    items = [];
  }
  return items
    .filter((item) => MEDIA_EXT.includes((item.name.split('.').pop() || '').toLowerCase()))
    .map((item) => ({
      path: item.path,
      name: item.name,
      size: item.size || 0,
      sha: item.sha,
      url: `/${item.path.replace(/^public\//, '')}`,
    }))
    .sort((a, b) => a.path.localeCompare(b.path));
}

async function loadStatus(store) {
  const status = {
    storeKind: store.kind,
    repo: store.repo,
    branch: store.branch,
    repoInfo: null,
    commits: [],
    actions: { available: false, runs: [] },
  };
  try {
    status.repoInfo = await store.repoInfo();
  } catch (error) {
    status.repoError = error.message;
  }
  try {
    status.commits = await store.recentCommits(8);
  } catch (error) {
    status.commitsError = error.message;
  }
  try {
    status.actions = await store.workflowRuns(5);
  } catch (error) {
    status.actionsError = error.message;
  }
  return status;
}

function commitMessage(action, title) {
  const suffix = new Date().toLocaleString('zh-CN', { hour12: false });
  return `后台${action}：${title}（${suffix}）`;
}

async function updatePostsByCategory(store, fromSlug, toSlug) {
  const posts = await loadPosts(store);
  const affected = posts.filter((post) => post.category === fromSlug);
  for (const post of affected) {
    post.category = toSlug;
    await store.putFile(
      `${POSTS_DIR}/${post.slug}.md`,
      serializePost(post),
      commitMessage('调整分类', post.title),
      post.sha
    );
  }
  return affected.length;
}

async function updatePostsByTag(store, fromSlug, toSlug) {
  const posts = await loadPosts(store);
  const affected = posts.filter((post) => (post.tags || []).includes(fromSlug));
  for (const post of affected) {
    post.tags = post.tags.map((tag) => (tag === fromSlug ? toSlug : tag));
    await store.putFile(
      `${POSTS_DIR}/${post.slug}.md`,
      serializePost(post),
      commitMessage('调整标签', post.title),
      post.sha
    );
  }
  return affected.length;
}

function mediaUsageIn(text, url) {
  if (!text) return false;
  return text.includes(url) || text.includes(url.replace(/^\//, ''));
}

async function findMediaUsage(store, url) {
  const used = [];
  const posts = await loadPosts(store);
  for (const post of posts) {
    const haystack = [post.body, post.cover, ...(post.resources || []).map((r) => `${r.url} ${r.summary}`)].join('\n');
    if (mediaUsageIn(haystack, url)) used.push(`文章《${post.title}》`);
  }
  const pages = await loadPages(store);
  for (const page of pages) {
    if (mediaUsageIn(page.body, url)) used.push(`页面《${page.title}》`);
  }
  for (const file of ['content/site.json', 'content/home.json', 'content/nav.json']) {
    const text = await toBodyText(store, file, '');
    if (mediaUsageIn(text, url)) used.push(file);
  }
  return used;
}

async function handleLogin(context) {
  const { request, env } = context;
  const clientId = env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return fail('尚未配置 GITHUB_CLIENT_ID，无法使用 GitHub 登录。请参考教程配置环境变量。', 500);
  }
  const state = randomToken(18);
  const redirectUri = `${requestOrigin(request)}/api/auth/callback`;
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', clientId);
  authorize.searchParams.set('redirect_uri', redirectUri);
  authorize.searchParams.set('state', state);
  authorize.searchParams.set('scope', env.GITHUB_OAUTH_SCOPE || 'public_repo read:user');
  return new Response(null, {
    status: 302,
    headers: {
      Location: authorize.toString(),
      'Set-Cookie': serializeCookie('ay_oauth_state', state, {
        maxAge: 600,
        secure: isSecureRequest(request),
      }),
    },
  });
}

async function handleCallback(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const savedState = getCookie(request, 'ay_oauth_state');
  const clientId = env.GITHUB_CLIENT_ID;
  const clientSecret = env.GITHUB_CLIENT_SECRET;
  const secure = isSecureRequest(request);

  if (!clientId || !clientSecret) {
    return fail('服务端缺少 GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET，请先在部署平台配置环境变量。', 500);
  }
  if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 16) {
    return fail('服务端缺少 SESSION_SECRET（至少 16 位随机字符串），出于安全考虑已拒绝登录。', 500);
  }
  if (!code) return fail('GitHub 未返回授权码，请重新登录。', 400);
  if (!state || !savedState || state !== savedState) {
    return fail('登录状态校验失败（state 不匹配），请重新登录。', 400);
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });
  const tokenData = await tokenResponse.json();
  if (!tokenData.access_token) {
    return fail(`GitHub 授权失败：${tokenData.error_description || tokenData.error || '未知错误'}`, 400);
  }

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aether-yard-cms',
    },
  });
  if (!userResponse.ok) return fail('无法读取 GitHub 用户信息，请重试。', 400);
  const user = await userResponse.json();

  const allowList = String(env.ADMIN_GITHUB_LOGIN || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);
  if (allowList.length === 0) {
    return fail('尚未配置 ADMIN_GITHUB_LOGIN（允许登录的 GitHub 用户名），出于安全考虑已拒绝登录。', 500);
  }
  if (!allowList.includes(String(user.login).toLowerCase())) {
    return fail(`账号 ${user.login} 不在管理员白名单中，无权进入后台。`, 403);
  }

  const repo = env.GITHUB_REPO || 'ymrnablkm/ymrnablkm.github.io';
  const repoResponse = await fetch(`https://api.github.com/repos/${repo}`, {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'aether-yard-cms',
    },
  });
  if (!repoResponse.ok) {
    return fail(`无法访问仓库 ${repo}，请确认授权范围包含 repo 权限。`, 403);
  }
  const repoData = await repoResponse.json();
  if (!repoData.permissions || !repoData.permissions.push) {
    return fail(`账号 ${user.login} 没有仓库 ${repo} 的写入权限。`, 403);
  }

  const csrf = randomToken(24);
  const token = await createSession(
    {
      login: user.login,
      name: user.name || user.login,
      avatar: user.avatar_url || '',
      csrf,
      githubToken: tokenData.access_token,
    },
    env
  );

  const cookie = serializeCookie(sessionCookieName, token, {
    maxAge: sessionMaxAge,
    secure,
    sameSite: 'Lax',
  });

  return new Response(null, {
    status: 302,
    headers: [
      ['Location', '/admin/app/'],
      ['Set-Cookie', cookie],
      ['Set-Cookie', serializeCookie('ay_oauth_state', '', { maxAge: 0, secure })],
    ],
  });
}

function publicMe(session) {
  return {
    login: session.login,
    name: session.name,
    avatar: session.avatar,
    csrf: session.csrf,
  };
}

export async function handleApi(request, env, store) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api\/?/, '').replace(/\/+$/, '');
  const method = request.method.toUpperCase();
  const parts = path ? path.split('/') : [];

  if (method === 'OPTIONS') {
    const requestOriginHeader = request.headers.get('origin');
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': requestOriginHeader || requestOrigin(request),
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token',
        'Access-Control-Allow-Credentials': 'true',
        Vary: 'Origin',
      },
    });
  }

  try {
    // ---------- 无需登录的接口 ----------
    if (path === 'session' && method === 'GET') {
      const session = await readSession(request, env);
      return ok({
        me: session ? publicMe(session) : null,
        configured: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
        devLogin: env.ALLOW_DEV_LOGIN === '1',
        repo: store.repo,
        branch: store.branch,
        storeKind: store.kind,
      });
    }

    if (path === 'auth/login' && method === 'GET') {
      return handleLogin({ request, env });
    }

    if (path === 'auth/callback' && method === 'GET') {
      return handleCallback({ request, env });
    }

    if (path === 'auth/dev-login' && method === 'POST') {
      if (env.ALLOW_DEV_LOGIN !== '1') return fail('未开启本地开发登录。', 403);
      const session = {
        login: 'local-dev',
        name: '本地开发账号',
        avatar: '',
        csrf: randomToken(24),
        githubToken: '',
      };
      const token = await createSession(session, env);
      return json(
        { ok: true, me: publicMe(session) },
        200,
        {
          'Set-Cookie': serializeCookie(sessionCookieName, token, {
            maxAge: sessionMaxAge,
            secure: isSecureRequest(request),
            sameSite: 'Lax',
          }),
        }
      );
    }

    // ---------- 浏览量统计（公开接口，无需登录，支持跨域） ----------
    if (parts[0] === 'views') {
      const slug = parts[1] ? decodeURIComponent(parts[1]) : '';
      if (!slug) return fail('缺少文章标识', 400);

      const allowedOrigins = [
        'https://ymrnablkm.github.io',
        'https://ymrnablkm-github-io.pages.dev',
      ];
      const origin = request.headers.get('origin') || '';
      const corsHeaders = origin && allowedOrigins.includes(origin)
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
          }
        : {};

      // 预检请求
      if (method === 'OPTIONS') {
        return json({ ok: true }, 204, corsHeaders);
      }

      const viewsStore = createViewsStore(env);
      const corsWithVary = { ...corsHeaders, Vary: 'Origin' };

      if (method === 'GET') {
        try {
          const count = await viewsStore.getViewCount(slug);
          // CDN 缓存 5 秒（浏览器不缓存，避免读到旧值）
          return json({ ok: true, slug, views: count }, 200, {
            ...corsWithVary,
            'Cache-Control': 'public, max-age=0, s-maxage=5, stale-while-revalidate=30',
          });
        } catch (error) {
          return json({ ok: false, slug, views: null, error: '读取阅读数失败' }, 200, {
            ...corsWithVary,
            'Cache-Control': 'no-store',
          });
        }
      }

      if (method === 'POST') {
        // 访客标识优先级：Cookie → 请求体（浏览器 localStorage）→ 新生成
        // GitHub Pages 跨域调用时第三方 Cookie 可能被浏览器拦截，因此必须支持请求体回退，
        // 否则每次请求都会生成新标识，导致重复计数。
        const cookieName = 'ay_visitor_id';
        let visitorId = getCookie(request, cookieName) || '';
        const body = await readJson(request);
        const bodyVisitor = body && typeof body.visitor === 'string' ? body.visitor : '';

        if (!/^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) visitorId = '';
        const extraHeaders = { ...corsWithVary };

        if (!visitorId) {
          visitorId = /^[A-Za-z0-9_-]{8,64}$/.test(bodyVisitor) ? bodyVisitor : randomToken(16);
          extraHeaders['Set-Cookie'] = serializeCookie(cookieName, visitorId, {
            maxAge: 365 * 24 * 60 * 60,
            secure: true,
            sameSite: 'None',
          });
        }

        if (!allowPublicRequest(`view:${slug}:${visitorId}`, 60)) {
          const current = await viewsStore.getViewCount(slug).catch(() => 0);
          return json({ ok: true, slug, views: current, stored: false }, 200, extraHeaders);
        }

        try {
          const result = await viewsStore.recordView(slug, visitorId);
          const views = typeof result === 'number' ? result : result.count;
          return json(
            {
              ok: true,
              slug,
              views,
              counted: typeof result === 'number' ? true : Boolean(result.counted),
              // stored=true 表示该次访问已在服务端留痕（含此前已计过数），前端可写永久标记；
              // stored=false 表示这次写入失败（如额度耗尽），前端应保留重试机会。
              stored: typeof result === 'number' ? true : result.stored !== false,
            },
            200,
            extraHeaders
          );
        } catch (error) {
          // 写入失败也必须返回 200 + 已知计数，避免前端显示异常
          const current = await viewsStore.getViewCount(slug).catch(() => 0);
          return json(
            { ok: true, slug, views: current, counted: false, stored: false },
            200,
            { ...extraHeaders, 'Cache-Control': 'no-store' }
          );
        }
      }

      return fail('方法不允许', 405);
    }

    // ---------- 热门排行（公开接口，按浏览量倒序，支持跨域） ----------
    if (path === 'hot' && method === 'GET') {
      const allowedOrigins = [
        'https://ymrnablkm.github.io',
        'https://ymrnablkm-github-io.pages.dev',
      ];
      const origin = request.headers.get('origin') || '';
      const corsHeaders = origin && allowedOrigins.includes(origin)
        ? {
            'Access-Control-Allow-Origin': origin,
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Max-Age': '86400',
          }
        : {};

      const viewsStore = createViewsStore(env);
      const counts = await viewsStore.getAllViewCounts();
      counts.sort((a, b) => b.views - a.views);

      const rawLimit = parseInt(url.searchParams.get('limit') || '', 10);
      const limit = Math.min(Math.max(Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : 200, 1), 500);

      return json({ ok: true, items: counts.slice(0, limit) }, 200, {
        ...corsHeaders,
        'Cache-Control': 'public, s-maxage=15, stale-while-revalidate=60',
      });
    }

    // ---------- 下载点击统计上报（公开接口：只记录，不返回任何统计数据） ----------
    if (parts[0] === 'download' && method === 'POST') {
      const corsHeaders = publicCorsHeaders(request);
      const origin = request.headers.get('origin') || '';
      if (origin && !corsHeaders['Access-Control-Allow-Origin']) {
        return json({ ok: false, error: '请求来源不合法，已拒绝。' }, 403, corsHeaders);
      }

      let slug = '';
      try {
        slug = decodeURIComponent(parts[1] || '');
      } catch (error) {
        slug = '';
      }
      if (!slug || slug.length > 120 || /[\/\\\u0000-\u001f]/.test(slug) || slug === '.' || slug === '..') {
        return json({ ok: false, error: '文章标识不合法' }, 400, corsHeaders);
      }

      const downloadable = await isDownloadableSlug(request, slug);
      if (!downloadable) {
        return json({ ok: false, error: '文章不存在或没有可用的下载地址' }, 404, corsHeaders);
      }

      const cookieName = 'ay_visitor_id';
      let visitorId = getCookie(request, cookieName) || '';
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) visitorId = '';

      const body = await readJson(request);
      const bodyVisitor = body && typeof body.visitor === 'string' ? body.visitor : '';

      let setCookie = '';
      if (!visitorId) {
        visitorId = /^[A-Za-z0-9_-]{8,64}$/.test(bodyVisitor) ? bodyVisitor : randomToken(16);
        setCookie = serializeCookie(cookieName, visitorId, {
          maxAge: 365 * 24 * 60 * 60,
          secure: true,
          sameSite: 'None',
        });
      }

      if (!allowPublicRequest(`download:${visitorId}`, 120)) {
        return json({ ok: true }, 200, corsHeaders);
      }

      try {
        const downloadsStore = createDownloadsStore(env);
        await downloadsStore.recordHit(slug, visitorId);
      } catch (error) {
        return json({ ok: false, error: '统计暂时不可用' }, 500, corsHeaders);
      }
      const headers = { ...corsHeaders };
      if (setCookie) headers['Set-Cookie'] = setCookie;
      return json({ ok: true }, 200, headers);
    }

    // ---------- 全站访问统计上报（公开接口：只上报，不返回统计数据） ----------
    if (path === 'visit' && method === 'POST') {
      const corsHeaders = publicCorsHeaders(request);
      const origin = request.headers.get('origin') || '';
      if (origin && !corsHeaders['Access-Control-Allow-Origin']) {
        return json({ ok: false, error: '请求来源不合法，已拒绝。' }, 403, corsHeaders);
      }

      const cookieName = 'ay_visitor_id';
      let visitorId = getCookie(request, cookieName) || '';
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(visitorId)) visitorId = '';

      const body = await readJson(request);
      const bodyVisitor = body && typeof body.visitor === 'string' ? body.visitor : '';

      let setCookie = '';
      if (!visitorId) {
        visitorId = /^[A-Za-z0-9_-]{8,64}$/.test(bodyVisitor) ? bodyVisitor : randomToken(16);
        setCookie = serializeCookie(cookieName, visitorId, {
          maxAge: 365 * 24 * 60 * 60,
          secure: true,
          sameSite: 'None',
        });
      }

      if (!allowPublicRequest(`visit:${visitorId}`, 120)) {
        return json({ ok: true }, 200, corsHeaders);
      }

      try {
        const analytics = createAnalyticsStore(env);
        await analytics.recordVisit({
          visitorId,
          isMobile: isMobileUserAgent(request.headers.get('user-agent')),
        });
      } catch (error) {
        /* 统计失败不影响访客体验 */
      }

      const headers = { ...corsHeaders };
      if (setCookie) headers['Set-Cookie'] = setCookie;
      return json({ ok: true }, 200, headers);
    }

    // ---------- 以下接口必须登录 ----------
    const session = await readSession(request, env);
    if (!session) return fail('未登录或登录已过期，请重新登录。', 401);

    if (method !== 'GET') {
      const csrf = request.headers.get('x-csrf-token');
      if (!csrf || csrf !== session.csrf) {
        return fail('操作校验失败（CSRF），请刷新页面后重试。', 403);
      }
      const origin = request.headers.get('origin');
      if (origin && origin !== requestOrigin(request)) {
        return fail('请求来源不合法，已拒绝。', 403);
      }
    }

    if (path === 'auth/logout' && method === 'POST') {
      return json(
        { ok: true },
        200,
        { 'Set-Cookie': serializeCookie(sessionCookieName, '', { maxAge: 0, secure: isSecureRequest(request) }) }
      );
    }

    if (path === 'bootstrap' && method === 'GET') {
      const [siteFile, homeFile, categoryFile, tagFile, navFile] = await Promise.all([
        readJsonFile(store, 'content/site.json', DEFAULT_SITE),
        readJsonFile(store, 'content/home.json', DEFAULT_HOME),
        readJsonFile(store, 'content/categories.json', []),
        readJsonFile(store, 'content/tags.json', []),
        readJsonFile(store, 'content/nav.json', []),
      ]);
      const [posts, pages, trash, media, status] = await Promise.all([
        loadPosts(store),
        loadPages(store),
        loadTrash(store),
        loadMedia(store),
        loadStatus(store),
      ]);

      // 下载统计读取失败时不影响后台其它功能
      let downloadCounts = {};
      let downloadSource = 'unavailable';
      try {
        const downloadsStore = createDownloadsStore(env);
        const items = await downloadsStore.getAllCounts();
        for (const item of items) downloadCounts[item.slug] = item.count;
        downloadSource = downloadsStore.kind;
      } catch (error) {
        console.warn('[bootstrap] 下载统计读取失败：', error.message);
      }

      return ok({
        me: publicMe(session),
        site: siteFile.data,
        siteSha: siteFile.sha,
        home: homeFile.data,
        homeSha: homeFile.sha,
        categories: categoryFile.data,
        categoriesSha: categoryFile.sha,
        tags: tagFile.data,
        tagsSha: tagFile.sha,
        nav: navFile.data,
        navSha: navFile.sha,
        posts,
        pages,
        trash,
        media,
        status,
        downloadCounts,
        downloadSource,
      });
    }

    if (path === 'downloads/stats' && method === 'GET') {
      const downloadsStore = createDownloadsStore(env);
      const counts = {};
      const items = await downloadsStore.getAllCounts();
      for (const item of items) counts[item.slug] = item.count;
      return ok({ source: downloadsStore.kind, counts });
    }

    // ---------- 访问统计（仅后台可读） ----------
    if (path === 'analytics' && method === 'GET') {
      const rawDays = parseInt(url.searchParams.get('days') || '30', 10);
      const days = Math.min(Math.max(Number.isFinite(rawDays) ? rawDays : 30, 7), 90);
      const analytics = createAnalyticsStore(env);
      const overview = await analytics.getOverview(days);

      let topArticles = [];
      try {
        const viewsStore = createViewsStore(env);
        topArticles = (await viewsStore.getAllViewCounts())
          .sort((a, b) => b.views - a.views)
          .slice(0, 20);
      } catch (error) {
        console.warn('[analytics] 文章阅读量读取失败：', error.message);
      }

      return ok({ source: analytics.kind, overview, topArticles });
    }

    // ---------- 链接有效性检测 ----------
    if (path === 'linkcheck' && method === 'GET') {
      const linkcheckStore = createLinkcheckStore(env);
      return ok({ source: linkcheckStore.kind, results: await linkcheckStore.getAll() });
    }

    if (path === 'linkcheck' && method === 'POST') {
      const body = await readJson(request);
      const slug = String((body && body.slug) || '').trim();
      if (!slug || slug.length > 120 || /[\/\\\u0000-\u001f]/.test(slug)) {
        return fail('文章标识不合法', 400);
      }

      const file = await store.getFile(`content/posts/${slug}.md`);
      if (!file || typeof file.text !== 'string') return fail('文章不存在', 404);

      const post = parsePostFile(file.text, slug);
      const resources = (post.resources || [])
        .filter((item) => item.visible && item.url)
        .slice(0, 6);

      const links = [];
      for (const resource of resources) {
        const check = await checkOneLink(resource.url);
        links.push({
          name: resource.name || '下载渠道',
          url: resource.url,
          status: check.status,
          message: check.message,
          ms: check.ms,
        });
      }

      const status = links.length ? mergeLinkStatus(links) : 'none';
      const bad = links.find((item) => item.status === 'invalid' || item.status === 'failed');
      const missing = links.filter((item) => item.status !== 'ok').length;
      const message =
        status === 'none'
          ? '没有可检测的下载链接'
          : bad
            ? `${bad.name}：${bad.message}`
            : missing
              ? `${missing}/${links.length} 个链接无法确认`
              : `${links.length} 个链接均可访问`;

      const result = {
        slug,
        status,
        message,
        checkedAt: new Date().toISOString(),
        links,
      };
      await createLinkcheckStore(env).save(result);
      return ok({ result });
    }

    // ---------- 整站备份与恢复 ----------
    if (path === 'backup/export' && method === 'GET') {
      const includeImages = url.searchParams.get('images') !== '0';
      const { zip, manifest } = await buildBackup(store, { includeImages });
      const stamp = new Date().toISOString().slice(0, 10);
      return new Response(zip, {
        status: 200,
        headers: {
          'Content-Type': 'application/zip',
          'Content-Disposition': `attachment; filename="ymrnablkm-backup-${stamp}.zip"`,
          'Cache-Control': 'no-store',
          'X-Backup-Counts': `${manifest.counts.posts}/${manifest.counts.pages}/${manifest.counts.images}`,
        },
      });
    }

    if (path === 'backup/preview' && method === 'POST') {
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 25 * 1024 * 1024) {
        return fail('备份文件过大（上限 25MB）', 413);
      }
      if (buffer.byteLength === 0) return fail('没有收到备份文件', 400);

      try {
        const inspected = await inspectBackup(store, buffer);
        return ok({
          preview: {
            manifest: inspected.manifest,
            counts: {
              posts: inspected.posts.length,
              pages: inspected.pages.length,
              configs: inspected.configs.length,
              images: inspected.images.length,
            },
            posts: inspected.posts.slice(0, 50),
            conflicts: inspected.conflicts.slice(0, 100),
            conflictCount: inspected.conflicts.length,
            missingImages: inspected.missingImages.slice(0, 50),
            warnings: inspected.warnings,
          },
        });
      } catch (error) {
        return fail(error.message || '备份文件校验失败', 400);
      }
    }

    if (path === 'backup/restore' && method === 'POST') {
      if (request.headers.get('x-backup-confirm') !== 'RESTORE') {
        return fail('缺少恢复确认标记，已拒绝执行。', 400);
      }
      const overwrite = url.searchParams.get('overwrite') === '1';
      const buffer = await request.arrayBuffer();
      if (buffer.byteLength > 25 * 1024 * 1024) {
        return fail('备份文件过大（上限 25MB）', 413);
      }
      if (buffer.byteLength === 0) return fail('没有收到备份文件', 400);

      try {
        const inspected = await inspectBackup(store, buffer);
        const result = await restoreBackup(store, inspected, {
          overwrite,
          actor: session.login || '',
        });
        return ok({ ...result, warnings: inspected.warnings });
      } catch (error) {
        return fail(error.message || '恢复失败', 500);
      }
    }

    if (path === 'status' && method === 'GET') {
      return ok({ status: await loadStatus(store) });
    }

    if (path === 'site') {
      if (method === 'GET') {
        const file = await readJsonFile(store, 'content/site.json', DEFAULT_SITE);
        return ok({ site: file.data, sha: file.sha });
      }
      if (method === 'PUT') {
        const body = await readJson(request);
        if (!body || !body.site) return fail('缺少 site 数据');
        const result = await writeJsonFile(store, 'content/site.json', body.site, commitMessage('更新网站设置', '全局配置'), body.sha);
        return ok({ sha: result.sha, commit: result.commit });
      }
    }

    if (path === 'home') {
      if (method === 'GET') {
        const file = await readJsonFile(store, 'content/home.json', DEFAULT_HOME);
        return ok({ home: file.data, sha: file.sha });
      }
      if (method === 'PUT') {
        const body = await readJson(request);
        if (!body || !body.home) return fail('缺少 home 数据');
        const result = await writeJsonFile(store, 'content/home.json', body.home, commitMessage('更新首页', '首页配置'), body.sha);
        return ok({ sha: result.sha, commit: result.commit });
      }
    }

    // ---------- 文章 ----------
    if (parts[0] === 'posts') {
      if (parts.length === 1 && method === 'GET') {
        return ok({ posts: await loadPosts(store) });
      }
      if (parts.length === 1 && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.post) return fail('缺少文章数据');
        const post = normalizePost(body.post, body.post.body || '', '');
        post.slug = normalizeSlug(body.slug || post.title, 'post');
        post.date = toDateString(body.post.date);
        const filePath = `${POSTS_DIR}/${post.slug}.md`;
        const existing = await store.getFile(filePath);
        if (existing) return fail(`文章 URL「${post.slug}」已存在，请换一个。`, 409);
        const result = await store.putFile(filePath, serializePost(post), commitMessage('新建文章', post.title));
        return ok({ slug: post.slug, sha: result.sha, commit: result.commit });
      }
      if (parts.length === 2) {
        const slug = decodeURIComponent(parts[1]);
        const filePath = `${POSTS_DIR}/${slug}.md`;
        if (method === 'GET') {
          const file = await store.getFile(filePath);
          if (!file) return fail('文章不存在', 404);
          return ok({ post: parsePostFile(file.text, slug), sha: file.sha });
        }
        if (method === 'PUT') {
          const body = await readJson(request);
          if (!body || !body.post) return fail('缺少文章数据');
          const current = await store.getFile(filePath);
          if (!current) return fail('文章不存在，可能已被删除', 404);
          const post = normalizePost(body.post, body.post.body || '', slug);
          post.date = toDateString(body.post.date);
          const nextSlug = normalizeSlug(body.newSlug || body.post.slug || slug, slug);
          post.slug = nextSlug;
          if (nextSlug === slug) {
            const result = await store.putFile(filePath, serializePost(post), commitMessage('更新文章', post.title), body.sha || current.sha);
            return ok({ slug: nextSlug, sha: result.sha, commit: result.commit });
          }
          const conflict = await store.getFile(`${POSTS_DIR}/${nextSlug}.md`);
          if (conflict) return fail(`文章 URL「${nextSlug}」已被占用，请换一个。`, 409);
          const result = await store.putFile(`${POSTS_DIR}/${nextSlug}.md`, serializePost(post), commitMessage('修改文章链接', post.title));
          await store.deleteFile(filePath, commitMessage('删除旧链接', post.title), body.sha || current.sha);
          return ok({ slug: nextSlug, sha: result.sha, commit: result.commit });
        }
        if (method === 'DELETE') {
          const current = await store.getFile(filePath);
          if (!current) return fail('文章不存在', 404);
          const permanent = url.searchParams.get('permanent') === '1';
          if (permanent) {
            await store.deleteFile(filePath, commitMessage('彻底删除文章', slug));
            return ok({ deleted: true, permanent: true });
          }
          const post = parsePostFile(current.text, slug);
          const id = `post__${slug}__${Date.now()}`;
          const trashContent = serializeTrashFile({
            data: {
              title: post.title,
              originalPath: filePath,
              type: 'post',
              slug,
              deletedAt: new Date().toISOString(),
              category: post.category,
              date: post.date,
            },
            body: current.text,
          });
          await store.putFile(`${TRASH_DIR}/${id}.md`, trashContent, commitMessage('移入回收站', post.title));
          await store.deleteFile(filePath, commitMessage('移入回收站', post.title), current.sha);
          return ok({ deleted: true, trashId: id });
        }
      }
    }

    // ---------- 分类 ----------
    if (parts[0] === 'categories') {
      const file = await readJsonFile(store, 'content/categories.json', []);
      const list = Array.isArray(file.data) ? file.data : [];
      if (parts.length === 1 && method === 'GET') return ok({ categories: list, sha: file.sha });
      if (parts.length === 1 && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.category) return fail('缺少分类数据');
        const category = normalizeCategory(body.category, list.length);
        category.id = category.id || category.slug;
        if (list.some((item) => item.slug === category.slug || item.id === category.id)) {
          return fail('分类标识或 URL 已存在，请修改。', 409);
        }
        category.order = list.length + 1;
        list.push(category);
        const result = await writeJsonFile(store, 'content/categories.json', list, commitMessage('新增分类', category.name), file.sha);
        return ok({ category, sha: result.sha });
      }
      if (parts.length === 2) {
        const id = decodeURIComponent(parts[1]);
        const index = list.findIndex((item) => item.id === id || item.slug === id);
        if (index === -1) return fail('分类不存在', 404);
        if (method === 'PUT') {
          const body = await readJson(request);
          if (!body || !body.category) return fail('缺少分类数据');
          const previous = list[index];
          const next = normalizeCategory({ ...previous, ...body.category }, index);
          next.id = previous.id;
          list[index] = next;
          const result = await writeJsonFile(store, 'content/categories.json', list, commitMessage('更新分类', next.name), body.sha || file.sha);
          let moved = 0;
          if (previous.slug !== next.slug) {
            moved = await updatePostsByCategory(store, previous.slug, next.slug);
          }
          return ok({ category: next, sha: result.sha, movedPosts: moved });
        }
        if (method === 'DELETE') {
          const target = list[index];
          const posts = await loadPosts(store);
          const affected = posts.filter((post) => post.category === target.slug);
          if (affected.length > 0) {
            const reassign = url.searchParams.get('reassign');
            if (!reassign) {
              return fail(`该分类下还有 ${affected.length} 篇文章，请先选择要转移到的分类，或先修改这些文章的分类。`, 409, {
                affected: affected.map((post) => ({ slug: post.slug, title: post.title })),
              });
            }
            await updatePostsByCategory(store, target.slug, reassign === 'none' ? '' : reassign);
          }
          list.splice(index, 1);
          const result = await writeJsonFile(store, 'content/categories.json', list, commitMessage('删除分类', target.name), file.sha);
          return ok({ deleted: true, sha: result.sha });
        }
      }
    }

    // ---------- 标签 ----------
    if (parts[0] === 'tags') {
      const file = await readJsonFile(store, 'content/tags.json', []);
      const list = Array.isArray(file.data) ? file.data : [];
      if (parts.length === 1 && method === 'GET') return ok({ tags: list, sha: file.sha });
      if (parts.length === 1 && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.tag) return fail('缺少标签数据');
        const tag = normalizeTag(body.tag, list.length);
        if (list.some((item) => item.slug === tag.slug || item.name === tag.name)) {
          return fail('标签已存在。', 409);
        }
        list.push(tag);
        const result = await writeJsonFile(store, 'content/tags.json', list, commitMessage('新增标签', tag.name), file.sha);
        return ok({ tag, sha: result.sha });
      }
      if (parts.length === 2) {
        const id = decodeURIComponent(parts[1]);
        const index = list.findIndex((item) => item.id === id || item.slug === id);
        if (index === -1) return fail('标签不存在', 404);
        if (method === 'PUT') {
          const body = await readJson(request);
          if (!body || !body.tag) return fail('缺少标签数据');
          const previous = list[index];
          const next = normalizeTag({ ...previous, ...body.tag }, index);
          next.id = previous.id;
          list[index] = next;
          const result = await writeJsonFile(store, 'content/tags.json', list, commitMessage('更新标签', next.name), body.sha || file.sha);
          let moved = 0;
          if (previous.slug !== next.slug) {
            moved = await updatePostsByTag(store, previous.slug, next.slug);
          }
          return ok({ tag: next, sha: result.sha, movedPosts: moved });
        }
        if (method === 'DELETE') {
          const target = list[index];
          const posts = await loadPosts(store);
          const affected = posts.filter((post) => (post.tags || []).includes(target.slug));
          if (affected.length > 0) {
            const reassign = url.searchParams.get('reassign');
            if (!reassign) {
              return fail(`该标签下还有 ${affected.length} 篇文章，请先选择要转移到的标签，或直接在文章中移除该标签。`, 409, {
                affected: affected.map((post) => ({ slug: post.slug, title: post.title })),
              });
            }
            await updatePostsByTag(store, target.slug, reassign === 'none' ? '' : reassign);
          }
          list.splice(index, 1);
          const result = await writeJsonFile(store, 'content/tags.json', list, commitMessage('删除标签', target.name), file.sha);
          return ok({ deleted: true, sha: result.sha });
        }
      }
    }

    // ---------- 导航 ----------
    if (parts[0] === 'nav') {
      const file = await readJsonFile(store, 'content/nav.json', []);
      const list = Array.isArray(file.data) ? file.data : [];
      if (parts.length === 1 && method === 'GET') return ok({ nav: list, sha: file.sha });
      if (parts.length === 1 && method === 'PUT') {
        const body = await readJson(request);
        if (!body || !Array.isArray(body.nav)) return fail('缺少导航数据');
        const normalized = body.nav.map((item, index) => normalizeNavItem(item, index)).map((item, index) => ({
          ...item,
          order: index + 1,
        }));
        const result = await writeJsonFile(store, 'content/nav.json', normalized, commitMessage('调整导航', '导航菜单'), body.sha || file.sha);
        return ok({ nav: normalized, sha: result.sha });
      }
      if (parts.length === 1 && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.item) return fail('缺少导航数据');
        const item = normalizeNavItem(body.item, list.length);
        item.order = list.length + 1;
        list.push(item);
        const result = await writeJsonFile(store, 'content/nav.json', list, commitMessage('新增导航', item.label), file.sha);
        return ok({ item, sha: result.sha });
      }
      if (parts.length === 2) {
        const id = decodeURIComponent(parts[1]);
        const index = list.findIndex((item) => item.id === id);
        if (index === -1) return fail('导航不存在', 404);
        if (method === 'PUT') {
          const body = await readJson(request);
          if (!body || !body.item) return fail('缺少导航数据');
          const next = normalizeNavItem({ ...list[index], ...body.item }, index);
          next.id = list[index].id;
          list[index] = next;
          const result = await writeJsonFile(store, 'content/nav.json', list, commitMessage('更新导航', next.label), body.sha || file.sha);
          return ok({ item: next, sha: result.sha });
        }
        if (method === 'DELETE') {
          const [removed] = list.splice(index, 1);
          list.forEach((item) => {
            if (item.parent === removed.id) item.parent = null;
          });
          const result = await writeJsonFile(store, 'content/nav.json', list, commitMessage('删除导航', removed.label), file.sha);
          return ok({ deleted: true, sha: result.sha });
        }
      }
    }

    // ---------- 独立页面 ----------
    if (parts[0] === 'pages') {
      if (parts.length === 1 && method === 'GET') {
        return ok({ pages: await loadPages(store) });
      }
      if (parts.length === 1 && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.page) return fail('缺少页面数据');
        const page = normalizePage(body.page, body.page.body || '', '');
        page.slug = normalizeSlug(body.slug || page.title, 'page');
        page.date = toDateString(body.page.date);
        page.updated = toDateString(body.page.updated || new Date().toISOString());
        const filePath = `${PAGES_DIR}/${page.slug}.md`;
        if (await store.getFile(filePath)) return fail(`页面 URL「${page.slug}」已存在`, 409);
        const result = await store.putFile(filePath, serializePage(page), commitMessage('新建页面', page.title));
        return ok({ slug: page.slug, sha: result.sha });
      }
      if (parts.length === 2) {
        const slug = decodeURIComponent(parts[1]);
        const filePath = `${PAGES_DIR}/${slug}.md`;
        if (method === 'GET') {
          const file = await store.getFile(filePath);
          if (!file) return fail('页面不存在', 404);
          return ok({ page: parsePageFile(file.text, slug), sha: file.sha });
        }
        if (method === 'PUT') {
          const body = await readJson(request);
          if (!body || !body.page) return fail('缺少页面数据');
          const current = await store.getFile(filePath);
          if (!current) return fail('页面不存在', 404);
          const page = normalizePage(body.page, body.page.body || '', slug);
          page.updated = toDateString(new Date().toISOString());
          const nextSlug = normalizeSlug(body.newSlug || body.page.slug || slug, slug);
          page.slug = nextSlug;
          if (nextSlug === slug) {
            const result = await store.putFile(filePath, serializePage(page), commitMessage('更新页面', page.title), body.sha || current.sha);
            return ok({ slug: nextSlug, sha: result.sha });
          }
          if (await store.getFile(`${PAGES_DIR}/${nextSlug}.md`)) return fail('新页面 URL 已被占用', 409);
          const result = await store.putFile(`${PAGES_DIR}/${nextSlug}.md`, serializePage(page), commitMessage('修改页面链接', page.title));
          await store.deleteFile(filePath, commitMessage('删除旧页面链接', page.title), body.sha || current.sha);
          return ok({ slug: nextSlug, sha: result.sha });
        }
        if (method === 'DELETE') {
          const current = await store.getFile(filePath);
          if (!current) return fail('页面不存在', 404);
          const page = parsePageFile(current.text, slug);
          const id = `page__${slug}__${Date.now()}`;
          await store.putFile(
            `${TRASH_DIR}/${id}.md`,
            serializeTrashFile({
              data: {
                title: page.title,
                originalPath: filePath,
                type: 'page',
                slug,
                deletedAt: new Date().toISOString(),
                date: page.date,
              },
              body: current.text,
            }),
            commitMessage('页面移入回收站', page.title)
          );
          await store.deleteFile(filePath, commitMessage('页面移入回收站', page.title), current.sha);
          return ok({ deleted: true, trashId: id });
        }
      }
    }

    // ---------- 回收站 ----------
    if (parts[0] === 'trash') {
      if (parts.length === 1 && method === 'GET') {
        return ok({ trash: await loadTrash(store) });
      }
      if (parts.length === 3 && parts[2] === 'restore' && method === 'POST') {
        const id = decodeURIComponent(parts[1]);
        const filePath = `${TRASH_DIR}/${id}.md`;
        const file = await store.getFile(filePath);
        if (!file) return fail('回收站中找不到该内容', 404);
        const trash = parseTrashFile(file.text);
        if (!trash.originalPath || !isSafeRelativePath(trash.originalPath)) {
          return fail('回收站记录损坏，无法恢复', 400);
        }
        if (await store.getFile(trash.originalPath)) {
          return fail('原位置已存在同名文件，请先处理后再恢复。', 409);
        }
        await store.putFile(trash.originalPath, trash.body, commitMessage('恢复内容', trash.title));
        await store.deleteFile(filePath, commitMessage('恢复后清理回收站', trash.title), file.sha);
        return ok({ restored: true, path: trash.originalPath });
      }
      if (parts.length === 2 && method === 'DELETE') {
        const id = decodeURIComponent(parts[1]);
        const filePath = `${TRASH_DIR}/${id}.md`;
        const file = await store.getFile(filePath);
        if (!file) return fail('回收站中找不到该内容', 404);
        await store.deleteFile(filePath, commitMessage('彻底删除', id), file.sha);
        return ok({ deleted: true });
      }
    }

    // ---------- 媒体库 ----------
    if (parts[0] === 'media') {
      if (parts.length === 1 && method === 'GET') {
        return ok({ media: await loadMedia(store) });
      }
      if (parts.length === 1 && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.path || !body.data) return fail('缺少图片数据');
        const target = String(body.path);
        if (!target.startsWith(`${MEDIA_DIR}/`) || !isSafeRelativePath(target)) {
          return fail('图片路径不合法', 400);
        }
        const ext = (target.split('.').pop() || '').toLowerCase();
        if (!MEDIA_EXT.includes(ext)) return fail('不支持的图片格式', 400);
        const base64 = String(body.data).replace(/^data:[^;]+;base64,/, '');
        const bytes = Math.floor((base64.length * 3) / 4);
        if (bytes > MAX_MEDIA_BYTES) {
          return fail(`图片过大（${(bytes / 1024 / 1024).toFixed(1)} MB），请压缩到 4 MB 以内。`, 413);
        }
        if (!matchesImageSignature(ext, base64)) {
          return fail('文件内容与图片格式不一致，已拒绝上传。', 400);
        }
        if (ext === 'svg') {
          const svgText = decodeBase64Head(base64, 200000);
          if (/<script|javascript:|onload\s*=|onerror\s*=|<foreignObject/i.test(svgText)) {
            return fail('SVG 中包含不安全脚本内容，已拒绝上传。', 400);
          }
        }
        const existing = await store.getFile(target);
        const isReplace = body.replace === true;
        if (existing && !isReplace) return fail('同名图片已存在，请换一个文件名。', 409);
        if (isReplace && !existing) return fail('要替换的图片不存在，请刷新媒体库后重试。', 404);
        const result = await store.putBinary(
          target,
          base64,
          commitMessage(isReplace ? '替换图片' : '上传图片', target.split('/').pop()),
          existing?.sha
        );
        return ok({ path: target, url: `/${target.replace(/^public\//, '')}`, sha: result.sha });
      }
      if (parts.length === 1 && method === 'DELETE') {
        const target = url.searchParams.get('path');
        if (!target || !target.startsWith(`${MEDIA_DIR}/`) || !isSafeRelativePath(target)) {
          return fail('图片路径不合法', 400);
        }
        const file = await store.getFile(target);
        if (!file) return fail('图片不存在', 404);
        const urlPath = `/${target.replace(/^public\//, '')}`;
        const used = await findMediaUsage(store, urlPath);
        if (used.length > 0 && url.searchParams.get('force') !== '1') {
          return fail(`图片正在被使用：${used.join('、')}。确认要删除请勾选强制删除。`, 409, { usage: used });
        }
        await store.deleteFile(target, commitMessage('删除图片', target.split('/').pop()), file.sha);
        return ok({ deleted: true });
      }
      if (parts.length === 2 && parts[1] === 'rename' && method === 'PUT') {
        const body = await readJson(request);
        if (!body || !body.from || !body.to) return fail('缺少重命名参数');
        const from = String(body.from);
        const to = String(body.to);
        if (!from.startsWith(`${MEDIA_DIR}/`) || !to.startsWith(`${MEDIA_DIR}/`) || !isSafeRelativePath(to)) {
          return fail('图片路径不合法', 400);
        }
        const source = await store.getBase64(from);
        if (!source) return fail('原图片不存在', 404);
        if (await store.getFile(to)) return fail('目标文件名已存在', 409);
        await store.putBinary(to, source.base64, commitMessage('重命名图片', to.split('/').pop()));
        await store.deleteFile(from, commitMessage('重命名图片', from.split('/').pop()), source.sha);
        return ok({ path: to, url: `/${to.replace(/^public\//, '')}` });
      }
    }

    // ---------- 版本历史 ----------
    if (parts[0] === 'history') {
      if (parts.length === 1 && method === 'GET') {
        const target = url.searchParams.get('path');
        if (!target || !isSafeRelativePath(target)) return fail('缺少文件路径', 400);
        return ok({ commits: await store.commits(target, 20) });
      }
      if (parts.length === 2 && parts[1] === 'restore' && method === 'POST') {
        const body = await readJson(request);
        if (!body || !body.path || !body.ref) return fail('缺少恢复参数', 400);
        if (!isSafeRelativePath(body.path)) return fail('文件路径不合法', 400);
        const current = await store.getFile(body.path);
        const text = await store.fileAtRef(body.path, String(body.ref));
        const result = await store.putFile(
          body.path,
          text,
          commitMessage('恢复历史版本', body.path),
          current?.sha
        );
        return ok({ sha: result.sha, path: body.path });
      }
      if (parts.length === 2 && parts[1] === 'file' && method === 'GET') {
        const target = url.searchParams.get('path');
        const ref = url.searchParams.get('ref');
        if (!target || !isSafeRelativePath(target) || !ref) return fail('缺少参数', 400);
        const text = await store.fileAtRef(target, ref);
        return ok({ text });
      }
    }

    return fail(`接口不存在：${method} /api/${path}`, 404);
  } catch (error) {
    const message = error && error.message ? error.message : '未知错误';
    return fail(message, 500);
  }
}
