let csrfToken = '';

export function setCsrf(token: string) {
  csrfToken = token || '';
}

export class ApiError extends Error {
  status: number;
  detail: unknown;
  constructor(message: string, status: number, detail?: unknown) {
    super(message);
    this.status = status;
    this.detail = detail;
  }
}

export async function api<T = any>(
  path: string,
  options: { method?: string; body?: unknown; raw?: boolean } = {}
): Promise<T> {
  const method = (options.method || 'GET').toUpperCase();
  const headers = new Headers();
  if (method !== 'GET' && csrfToken) headers.set('X-CSRF-Token', csrfToken);
  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
    body = JSON.stringify(options.body);
  }

  const response = await fetch(`/api/${path.replace(/^\//, '')}`, {
    method,
    headers,
    body,
    credentials: 'same-origin',
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('服务器返回了无法识别的内容，请稍后重试。', response.status);
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('cms-auth-expired'));
    throw new ApiError(data.error || '登录已过期，请重新登录。', 401);
  }

  if (!response.ok || data.ok === false) {
    throw new ApiError(data.error || `请求失败（${response.status}）`, response.status, data.detail);
  }

  return data as T;
}

export function formatBytes(bytes: number) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / 1024 ** index).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
}

// 下载二进制文件（备份导出等）
export async function downloadFile(path: string, filename: string) {
  const response = await fetch(`/api/${path.replace(/^\//, '')}`, { credentials: 'same-origin' });
  if (!response.ok) {
    let message = `下载失败（${response.status}）`;
    try {
      const data = await response.json();
      if (data && data.error) message = data.error;
    } catch {
      /* 忽略非 JSON 错误 */
    }
    throw new ApiError(message, response.status);
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// 上传二进制内容（备份校验/恢复等）
export async function uploadBinary<T = any>(
  path: string,
  body: ArrayBuffer,
  extraHeaders: Record<string, string> = {}
): Promise<T> {
  const headers = new Headers(extraHeaders);
  if (csrfToken) headers.set('X-CSRF-Token', csrfToken);
  headers.set('Content-Type', 'application/zip');

  const response = await fetch(`/api/${path.replace(/^\//, '')}`, {
    method: 'POST',
    headers,
    body,
    credentials: 'same-origin',
  });

  const text = await response.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new ApiError('服务器返回了无法识别的内容，请稍后重试。', response.status);
  }

  if (response.status === 401) {
    window.dispatchEvent(new CustomEvent('cms-auth-expired'));
    throw new ApiError(data.error || '登录已过期，请重新登录。', 401);
  }
  if (!response.ok || data.ok === false) {
    throw new ApiError(data.error || `请求失败（${response.status}）`, response.status, data.detail);
  }
  return data as T;
}

export function formatDate(value: string) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('zh-CN', { hour12: false });
}

export function useNowString() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}
