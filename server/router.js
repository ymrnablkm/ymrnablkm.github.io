// 管理后台 API 路由：所有写入都在服务端完成身份校验、CSRF 校验和 SHA 并发校验
import { json, fail, ok, readJson, getCookie, serializeCookie, requestOrigin, isSecureRequest } from './lib/http.js';
import { createSession, readSession, sessionCookieName, sessionMaxAge, randomToken } from './lib/session.js';
import { createViewsStore } from './lib/views-store.js';
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
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': requestOrigin(request),
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-CSRF-Token',
        'Access-Control-Allow-Credentials': 'true',
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

      if (method === 'GET') {
        const count = await viewsStore.getViewCount(slug);
        // CDN 缓存 5 秒：重复 GET 命中 Cloudflare 边缘缓存，延迟 <50ms
        return json({ ok: true, slug, views: count }, 200, {
          ...corsHeaders,
          'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=30',
        });
      }

      if (method === 'POST') {
        // 获取或生成访客标识（Cookie 持久化 1 年）
        // sameSite=None + Secure 允许跨域（GitHub Pages → Cloudflare Pages 调用）
        const cookieName = 'ay_visitor_id';
        let visitorId = getCookie(request, cookieName);
        const extraHeaders = { ...corsHeaders };

        if (!visitorId || visitorId.length < 8) {
          visitorId = randomToken(16);
          extraHeaders['Set-Cookie'] = serializeCookie(cookieName, visitorId, {
            maxAge: 365 * 24 * 60 * 60,
            secure: true,
            sameSite: 'None',
          });
        }

        const count = await viewsStore.recordView(slug, visitorId);
        return json({ ok: true, slug, views: count }, 200, extraHeaders);
      }

      return fail('方法不允许', 405);
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
      });
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
