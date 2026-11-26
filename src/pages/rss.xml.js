import { getCollection } from 'astro:content';
import { site } from '../lib/site';

function escapeXml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function GET() {
  const base = (site.domain || 'https://example.com').replace(/\/$/, '');
  const posts = (await getCollection('posts'))
    .filter((post) => !post.data.draft && !post.data.offline)
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime());

  const items = posts
    .map((post) => {
      const url = `${base}/posts/${post.id}`;
      return `<item>
  <title>${escapeXml(post.data.title)}</title>
  <link>${escapeXml(url)}</link>
  <guid>${escapeXml(url)}</guid>
  <pubDate>${new Date(post.data.date).toUTCString()}</pubDate>
  <description>${escapeXml(post.data.description || '')}</description>
</item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(site.name)}</title>
  <link>${escapeXml(base)}</link>
  <description>${escapeXml(site.seo?.description || site.description)}</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
${items}
</channel>
</rss>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
}
