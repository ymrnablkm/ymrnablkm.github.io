// 内容文件处理：Frontmatter 解析/序列化、文章与页面数据结构、校验
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

export const POSTS_DIR = 'content/posts';
export const PAGES_DIR = 'content/pages';
export const TRASH_DIR = 'content/trash';
export const MEDIA_DIR = 'public/images';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

export function splitFrontmatter(text) {
  const source = (text || '').replace(/^\uFEFF/, '');
  const match = source.match(FRONTMATTER_RE);
  if (!match) return { data: {}, body: source.trim() };
  let data = {};
  try {
    data = parseYaml(match[1]) || {};
  } catch (error) {
    throw new Error(`Frontmatter 格式错误：${error.message}`);
  }
  return { data, body: source.slice(match[0].length).replace(/^\s*\n/, '') };
}

export function joinFrontmatter(data, body = '') {
  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    clean[key] = value;
  }
  const yaml = stringifyYaml(clean, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_SINGLE',
  }).trimEnd();
  return `---\n${yaml}\n---\n\n${(body || '').trim()}\n`;
}

export function slugify(input, fallback = 'post') {
  const base = String(input || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^\p{L}\p{N}-]+/gu, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || fallback;
}

export function normalizeSlug(input, fallback = 'post') {
  const slug = slugify(input, fallback);
  return slug.replace(/\.\./g, '').slice(0, 120) || fallback;
}

export function toDateString(value, fallback = new Date().toISOString()) {
  if (!value) return fallback;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return fallback;
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export function toDateOnly(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function toArray(value) {
  if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,，]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

function normalizeResource(item = {}, index = 0) {
  return {
    name: String(item.name || `下载渠道 ${index + 1}`).trim(),
    channel: String(item.channel || '').trim(),
    type: String(item.type || '').trim(),
    version: String(item.version || '').trim(),
    size: String(item.size || '').trim(),
    platform: String(item.platform || '').trim(),
    language: String(item.language || '').trim(),
    updated: String(item.updated || '').trim(),
    summary: String(item.summary || '').trim(),
    url: String(item.url || '').trim(),
    code: String(item.code || '').trim(),
    password: String(item.password || '').trim(),
    instructions: String(item.instructions || '').trim(),
    buttonText: String(item.buttonText || '').trim(),
    visible: item.visible !== false,
  };
}

// 新置顶字段是否已写入（用于决定是否回退旧 pinned）
function hasPinFields(data) {
  return data.pinnedHome !== undefined || data.pinnedCategory !== undefined;
}

export function normalizePost(data, body, slug) {
  const rawDate = data.date instanceof Date ? data.date.toISOString() : data.date;
  return {
    slug,
    title: String(data.title || '').trim() || '未命名文章',
    subtitle: String(data.subtitle || '').trim(),
    description: String(data.description || '').trim(),
    cover: String(data.cover || '').trim(),
    category: String(data.category || '').trim(),
    tags: toArray(data.tags),
    date: toDateString(rawDate),
    author: String(data.author || '').trim(),
    body: body || '',
    seoTitle: String(data.seoTitle || '').trim(),
    seoDescription: String(data.seoDescription || '').trim(),
    keywords: toArray(data.keywords),
    featured: Boolean(data.featured),
    pinned: Boolean(data.pinned),
    // 仅当两个新字段都未写入时才回退到旧 pinned（旧行为为首页与分类同时置顶）
    pinnedHome: hasPinFields(data) ? Boolean(data.pinnedHome) : Boolean(data.pinned),
    pinnedCategory: hasPinFields(data) ? Boolean(data.pinnedCategory) : Boolean(data.pinned),
    draft: Boolean(data.draft),
    resources: Array.isArray(data.resources) ? data.resources.map(normalizeResource) : [],
  };
}

export function parsePostFile(text, slug) {
  const { data, body } = splitFrontmatter(text);
  const post = normalizePost(data, body, slug);
  return post;
}

export function serializePost(post) {
  const data = {
    title: post.title,
    date: post.date,
    description: post.description || undefined,
    cover: post.cover || undefined,
    subtitle: post.subtitle || undefined,
    category: post.category || undefined,
    tags: post.tags && post.tags.length ? post.tags : undefined,
    author: post.author || undefined,
    featured: post.featured || undefined,
    pinned: post.pinned || undefined,
    pinnedHome: post.pinnedHome || undefined,
    pinnedCategory: post.pinnedCategory || undefined,
    draft: post.draft || undefined,
    seoTitle: post.seoTitle || undefined,
    seoDescription: post.seoDescription || undefined,
    keywords: post.keywords && post.keywords.length ? post.keywords : undefined,
    resources:
      post.resources && post.resources.length
        ? post.resources.map((item) => ({
            name: item.name,
            channel: item.channel || undefined,
            type: item.type || undefined,
            version: item.version || undefined,
            size: item.size || undefined,
            platform: item.platform || undefined,
            language: item.language || undefined,
            updated: item.updated || undefined,
            summary: item.summary || undefined,
            url: item.url,
            code: item.code || undefined,
            password: item.password || undefined,
            instructions: item.instructions || undefined,
            buttonText: item.buttonText || undefined,
            visible: item.visible === false ? false : undefined,
          }))
        : undefined,
  };
  return joinFrontmatter(data, post.body);
}

export function normalizePage(data, body, slug) {
  return {
    slug,
    title: String(data.title || '').trim() || '未命名页面',
    description: String(data.description || '').trim(),
    date: toDateString(data.date),
    updated: toDateString(data.updated || data.date),
    seoTitle: String(data.seoTitle || '').trim(),
    seoDescription: String(data.seoDescription || '').trim(),
    keywords: toArray(data.keywords),
    showInNav: Boolean(data.showInNav),
    draft: Boolean(data.draft),
    order: Number(data.order) || 0,
    body: body || '',
  };
}

export function parsePageFile(text, slug) {
  const { data, body } = splitFrontmatter(text);
  return normalizePage(data, body, slug);
}

export function serializePage(page) {
  return joinFrontmatter(
    {
      title: page.title,
      date: page.date,
      updated: page.updated,
      description: page.description || undefined,
      seoTitle: page.seoTitle || undefined,
      seoDescription: page.seoDescription || undefined,
      keywords: page.keywords && page.keywords.length ? page.keywords : undefined,
      showInNav: page.showInNav || undefined,
      draft: page.draft || undefined,
      order: page.order || undefined,
    },
    page.body
  );
}

export function normalizeCategory(item = {}, index = 0) {
  const name = String(item.name || '').trim();
  const slug = normalizeSlug(item.slug || item.id || name, `category-${index + 1}`);
  return {
    id: String(item.id || slug).trim(),
    name: name || '未命名分类',
    slug,
    icon: String(item.icon || '').trim(),
    description: String(item.description || '').trim(),
    cover: String(item.cover || '').trim(),
    order: Number(item.order) || index + 1,
    visible: item.visible !== false,
    seoTitle: String(item.seoTitle || '').trim(),
    seoDescription: String(item.seoDescription || '').trim(),
  };
}

export function normalizeTag(item = {}, index = 0) {
  const name = String(item.name || '').trim();
  const slug = normalizeSlug(item.slug || item.id || name, `tag-${index + 1}`);
  return {
    id: String(item.id || slug).trim(),
    name: name || '未命名标签',
    slug,
    description: String(item.description || '').trim(),
  };
}

export function normalizeNavItem(item = {}, index = 0) {
  return {
    id: String(item.id || `nav-${Date.now()}-${index}`).trim(),
    label: String(item.label || '').trim() || '未命名导航',
    href: String(item.href || '/').trim() || '/',
    external: Boolean(item.external),
    order: Number(item.order) || index + 1,
    visible: item.visible !== false,
    parent: item.parent ? String(item.parent) : null,
  };
}

export function parseTrashFile(text) {
  const { data, body } = splitFrontmatter(text);
  return {
    title: String(data.title || '未命名'),
    originalPath: String(data.originalPath || ''),
    type: String(data.type || 'post'),
    slug: String(data.slug || ''),
    deletedAt: String(data.deletedAt || ''),
    body,
  };
}

export function serializeTrashFile({ data, body }) {
  return joinFrontmatter(
    {
      title: data.title,
      originalPath: data.originalPath,
      type: data.type,
      slug: data.slug,
      deletedAt: data.deletedAt,
      category: data.category || undefined,
      date: data.date || undefined,
    },
    body
  );
}

export function isSafeRelativePath(path) {
  if (!path || typeof path !== 'string') return false;
  if (path.includes('..') || path.startsWith('/') || path.includes('\\')) return false;
  return /^[a-zA-Z0-9._\-\u4e00-\u9fa5/]+$/.test(path);
}

export function stripExtension(name) {
  return String(name || '').replace(/\.[^./]+$/, '');
}
