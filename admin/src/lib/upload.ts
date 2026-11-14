// 图片压缩与上传（浏览器端）
import { api } from '../api';

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('读取图片失败'));
    reader.readAsDataURL(file);
  });
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('图片解析失败'));
    image.src = dataUrl;
  });
}

export async function compressImage(file: File): Promise<{ dataUrl: string; ext: string }> {
  const type = file.type || '';
  if (type === 'image/gif' || type === 'image/svg+xml' || file.size < 300 * 1024) {
    return { dataUrl: await fileToDataUrl(file), ext: (file.name.split('.').pop() || 'png').toLowerCase() };
  }

  const raw = await fileToDataUrl(file);
  const image = await loadImage(raw);
  const maxSide = 1600;
  const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) return { dataUrl: raw, ext: (file.name.split('.').pop() || 'png').toLowerCase() };
  context.drawImage(image, 0, 0, width, height);

  const useWebp = document.createElement('canvas').toDataURL('image/webp').startsWith('data:image/webp');
  if (useWebp) {
    return { dataUrl: canvas.toDataURL('image/webp', 0.85), ext: 'webp' };
  }
  return { dataUrl: canvas.toDataURL('image/jpeg', 0.85), ext: 'jpg' };
}

export function safeFileName(name: string) {
  const base = name
    .replace(/\.[^.]+$/, '')
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return base || 'image';
}

export async function uploadImage(file: File): Promise<{ url: string; path: string }> {
  const { dataUrl, ext } = await compressImage(file);
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const stamp = `${Date.now()}`;
  const path = `public/images/${now.getFullYear()}/${month}/${stamp}-${safeFileName(file.name)}.${ext}`;

  const data = await api<{ url: string; path: string }>('media', {
    method: 'POST',
    body: { path, data: dataUrl },
  });
  return { url: data.url, path: data.path };
}

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

async function convertDataUrl(dataUrl: string, ext: string): Promise<string> {
  const mime = MIME_BY_EXT[ext];
  if (!mime) return dataUrl;
  const image = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d');
  if (!context) return dataUrl;
  if (mime === 'image/jpeg') {
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0);
  return canvas.toDataURL(mime, 0.9);
}

/** 用新图片替换已有图片，保持原文件路径不变，避免文章中的图片地址失效。 */
export async function replaceImage(
  file: File,
  targetPath: string
): Promise<{ url: string; path: string; sha?: string }> {
  const ext = (targetPath.split('.').pop() || '').toLowerCase();
  if (!['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext)) {
    throw new Error('该图片格式不支持替换');
  }
  const { dataUrl } = await compressImage(file);
  let finalData = dataUrl;
  if (MIME_BY_EXT[ext]) {
    finalData = await convertDataUrl(dataUrl, ext);
  } else {
    const actual = /^data:([^;]+)/.exec(dataUrl)?.[1] || '';
    if (!actual.includes(ext)) {
      throw new Error(`请选择 ${ext.toUpperCase()} 格式的图片来替换`);
    }
  }
  const data = await api<{ url: string; path: string; sha?: string }>('media', {
    method: 'POST',
    body: { path: targetPath, data: finalData, replace: true },
  });
  return { url: data.url, path: data.path, sha: data.sha };
}
