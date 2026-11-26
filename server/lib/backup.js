// 整站备份 / 校验 / 恢复
// 备份包内使用仓库相对路径（content/...、public/images/...），便于校验与恢复。
import { createZip, parseZip } from './zip.js';
import { parsePostFile } from './content.js';

export const BACKUP_VERSION = 1;
export const BACKUP_MANIFEST = 'backup-manifest.json';
const MAX_BACKUP_BYTES = 25 * 1024 * 1024;
const MAX_IMAGE_BYTES = 2.5 * 1024 * 1024;
const CONFIG_FILES = [
  'content/site.json',
  'content/home.json',
  'content/categories.json',
  'content/tags.json',
  'content/nav.json',
];

function base64ToBytes(base64) {
  const binary = atob(String(base64 || '').replace(/\s/g, ''));
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

function safePath(name) {
  return (
    typeof name === 'string' &&
    name.length > 0 &&
    name.length < 300 &&
    !name.startsWith('/') &&
    !name.includes('\\') &&
    !name.split('/').some((part) => part === '..' || part === '' || part === '.') &&
    !/[\u0000-\u001f]/.test(name)
  );
}

function isAllowedPath(name) {
  return (
    name === BACKUP_MANIFEST ||
    name.startsWith('content/posts/') ||
    name.startsWith('content/pages/') ||
    CONFIG_FILES.includes(name) ||
    name.startsWith('public/images/')
  );
}

export async function buildBackup(store, { includeImages = true } = {}) {
  const files = [];
  const warnings = [];
  let imagesCount = 0;

  const postFiles = (await store.listTree('content/posts')).filter((item) => item.name.endsWith('.md'));
  for (const item of postFiles) {
    const file = await store.getFile(item.path);
    if (file && typeof file.text === 'string') files.push({ name: item.path, data: file.text });
  }

  const pageFiles = (await store.listTree('content/pages')).filter((item) => item.name.endsWith('.md'));
  for (const item of pageFiles) {
    const file = await store.getFile(item.path);
    if (file && typeof file.text === 'string') files.push({ name: item.path, data: file.text });
  }

  for (const path of CONFIG_FILES) {
    const file = await store.getFile(path);
    if (file && typeof file.text === 'string') files.push({ name: path, data: file.text });
  }

  if (includeImages) {
    let imageBytes = 0;
    const imageFiles = (await store.listTree('public/images')).filter((item) => item.type !== 'dir');
    for (const item of imageFiles) {
      if (item.size && item.size > MAX_IMAGE_BYTES) {
        warnings.push(`图片过大已跳过：${item.path}`);
        continue;
      }
      if (imageBytes > MAX_BACKUP_BYTES - 2 * 1024 * 1024) {
        warnings.push('图片总量超过上限，其余图片未包含在本次备份中');
        break;
      }
      const base64 = await store.getBase64(item.path);
      if (!base64) continue;
      const bytes = base64ToBytes(base64);
      imageBytes += bytes.length;
      files.push({ name: item.path, data: bytes });
      imagesCount += 1;
    }
  }

  const manifest = {
    format: 'ymrnablkm-backup',
    version: BACKUP_VERSION,
    createdAt: new Date().toISOString(),
    imagesIncluded: imagesCount > 0,
    counts: {
      posts: postFiles.length,
      pages: pageFiles.length,
      images: imagesCount,
    },
    warnings,
  };

  const zip = createZip([{ name: BACKUP_MANIFEST, data: JSON.stringify(manifest, null, 2) }, ...files]);
  return { zip, manifest, size: zip.length };
}

export async function inspectBackup(store, buffer) {
  const entries = parseZip(buffer, { maxBytes: 30 * 1024 * 1024, maxEntries: 1000 });
  const decoder = new TextDecoder();
  const warnings = [];

  if (entries.length > 600) throw new Error('备份包文件数量过多');

  const entryMap = new Map(entries.map((entry) => [entry.name, entry]));
  const manifestEntry = entryMap.get(BACKUP_MANIFEST);
  if (!manifestEntry) throw new Error('备份包缺少 backup-manifest.json，可能不是本站导出的备份');

  let manifest;
  try {
    manifest = JSON.parse(decoder.decode(manifestEntry.data));
  } catch (error) {
    throw new Error('备份清单格式损坏');
  }
  if (!manifest || manifest.format !== 'ymrnablkm-backup' || Number(manifest.version) !== BACKUP_VERSION) {
    throw new Error('备份格式或版本不受支持');
  }

  const existing = new Set();
  for (const prefix of ['content/', 'public/images/']) {
    const items = await store.listTree(prefix);
    items.forEach((item) => existing.add(item.path));
  }

  const posts = [];
  const pages = [];
  const configs = [];
  const images = [];
  const targets = [];
  const seen = new Set();
  const zipPaths = new Set(entries.map((entry) => entry.name));

  for (const entry of entries) {
    if (entry.name === BACKUP_MANIFEST) continue;
    if (!safePath(entry.name) || !isAllowedPath(entry.name)) {
      throw new Error(`备份包包含不允许的路径：${entry.name}`);
    }
    if (seen.has(entry.name)) throw new Error(`备份包存在重复文件：${entry.name}`);
    seen.add(entry.name);

    const conflict = existing.has(entry.name);

    if (entry.name.startsWith('content/posts/')) {
      if (!entry.name.endsWith('.md')) throw new Error(`文章文件格式不正确：${entry.name}`);
      const slug = entry.name.slice('content/posts/'.length, -3);
      const post = parsePostFile(decoder.decode(entry.data), slug);
      if (!post.title) throw new Error(`文章缺少标题：${entry.name}`);
      posts.push({ slug, title: post.title, date: post.date, cover: post.cover || '' });
    } else if (entry.name.startsWith('content/pages/')) {
      if (!entry.name.endsWith('.md')) throw new Error(`页面文件格式不正确：${entry.name}`);
      pages.push(entry.name.slice('content/pages/'.length, -3));
    } else if (entry.name.startsWith('public/images/')) {
      images.push(entry.name);
    } else {
      try {
        JSON.parse(decoder.decode(entry.data));
      } catch (error) {
        throw new Error(`配置文件不是合法 JSON：${entry.name}`);
      }
      configs.push(entry.name);
    }

    targets.push({
      path: entry.name,
      type: entry.name.startsWith('public/images/')
        ? 'image'
        : entry.name.endsWith('.json')
          ? 'config'
          : entry.name.startsWith('content/posts/')
            ? 'post'
            : 'page',
      conflict,
    });
  }

  // 检查文章封面是否在仓库或备份中
  const missingImages = [];
  for (const post of posts) {
    if (!post.cover || !post.cover.startsWith('/images/')) continue;
    const target = `public${post.cover}`;
    if (!existing.has(target) && !zipPaths.has(target)) missingImages.push(`${post.slug}：${post.cover}`);
  }
  if (missingImages.length) warnings.push(`有 ${missingImages.length} 篇文章的封面图片在仓库和备份中都不存在`);

  const conflicts = targets.filter((item) => item.conflict).map((item) => item.path);
  if (conflicts.length) warnings.push(`有 ${conflicts.length} 个文件与现有站内文件同名`);

  return {
    manifest,
    entries,
    posts,
    pages,
    configs,
    images,
    targets,
    conflicts,
    missingImages,
    warnings,
  };
}

export async function restoreBackup(store, inspected, { overwrite = false, actor = '' } = {}) {
  const decoder = new TextDecoder();
  const files = [];
  let skipped = 0;

  for (const entry of inspected.entries) {
    if (entry.name === BACKUP_MANIFEST) continue;
    const conflict = inspected.conflicts.includes(entry.name);
    if (conflict && !overwrite) {
      skipped += 1;
      continue;
    }
    const isImage = entry.name.startsWith('public/images/');
    files.push({ path: entry.name, base64: bytesToBase64(entry.data) });
  }

  if (files.length === 0) {
    return { written: 0, skipped, commit: null };
  }

  const stamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const result = await store.commitFiles(
    files,
    `恢复备份（${actor || '管理员'}，${stamp}，${files.length} 个文件${overwrite ? '，覆盖同名' : ''}）`
  );
  return { written: files.length, skipped, commit: result.commit };
}
