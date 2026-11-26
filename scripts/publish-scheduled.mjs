// 定时发布：扫描 content/posts 下 draft=true 且 scheduledAt 已到点的文章，
// 将 draft 改为 false 并移除 scheduledAt。由 GitHub Actions 每 10 分钟执行。
import fs from 'node:fs';
import path from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';

const POSTS_DIR = path.join(process.cwd(), 'content', 'posts');
const FM_RE = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/;

function beijingTimestamp(value) {
  const raw = String(value || '').trim();
  if (!raw) return NaN;
  let base = raw.length === 16 ? `${raw}:00` : raw;
  if (!/[zZ]|[+-]\d{2}:\d{2}$/.test(base)) base += '+08:00';
  return new Date(base).getTime();
}

if (!fs.existsSync(POSTS_DIR)) {
  console.log('没有 content/posts 目录，跳过');
  process.exit(0);
}

const now = Date.now();
const published = [];
const files = fs.readdirSync(POSTS_DIR).filter((name) => name.endsWith('.md'));

for (const name of files) {
  const full = path.join(POSTS_DIR, name);
  const text = fs.readFileSync(full, 'utf8').replace(/^\uFEFF/, '');
  const match = text.match(FM_RE);
  if (!match) continue;

  let data;
  try {
    data = parseYaml(match[1]) || {};
  } catch (error) {
    console.warn(`跳过 ${name}：frontmatter 解析失败（${error.message}）`);
    continue;
  }

  if (data.draft !== true || !data.scheduledAt) continue;
  const ts = beijingTimestamp(data.scheduledAt);
  if (!Number.isFinite(ts) || ts > now) continue;

  const slug = name.replace(/\.md$/, '');
  delete data.draft;
  delete data.scheduledAt;

  const clean = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value) && value.length === 0) continue;
    clean[key] = value;
  }

  const yamlText = stringifyYaml(clean, {
    lineWidth: 0,
    defaultKeyType: 'PLAIN',
    defaultStringType: 'QUOTE_SINGLE',
  }).trimEnd();
  const body = text.slice(match[0].length).replace(/^\s*\n/, '').trim();
  const next = `---\n${yamlText}\n---\n\n${body}\n`;

  if (next !== text) {
    fs.writeFileSync(full, next, 'utf8');
    published.push(slug);
  }
}

if (published.length) {
  console.log(`已自动发布 ${published.length} 篇文章：${published.join('、')}`);
} else {
  console.log('没有到点的定时文章');
}
