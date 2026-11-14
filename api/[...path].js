import { handleApi } from '../server/router.js';
import { createGitHubStore } from '../server/lib/github-store.js';

// Vercel Serverless 适配器（如果使用 Vercel 部署）
export default async function handler(req, res) {
  const protocol = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost';
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (Array.isArray(value)) value.forEach((item) => headers.append(key, item));
    else if (value !== undefined) headers.set(key, String(value));
  }

  let body;
  if (!['GET', 'HEAD'].includes(req.method || 'GET')) {
    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    if (chunks.length) body = Buffer.concat(chunks);
  }

  const request = new Request(url, { method: req.method, headers, body });
  const env = { ...process.env };
  const response = await handleApi(request, env, createGitHubStore(env));

  res.statusCode = response.status;
  response.headers.forEach((value, key) => {
    if (key.toLowerCase() === 'set-cookie') return;
    res.setHeader(key, value);
  });
  const cookies = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie() : [];
  if (cookies.length) res.setHeader('Set-Cookie', cookies);

  const buffer = Buffer.from(await response.arrayBuffer());
  res.end(buffer);
}
