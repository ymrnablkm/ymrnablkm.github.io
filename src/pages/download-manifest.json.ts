import { getCollection } from 'astro:content';

// 提供给下载统计接口的校验清单：只包含“已发布且存在有效下载地址”的文章 slug
export async function GET() {
  const posts = await getCollection('posts');
  const slugs = posts
    .filter((post) => !post.data.draft)
    .filter((post) => (post.data.resources || []).some((item) => item.visible && item.url))
    .map((post) => post.id);

  return new Response(JSON.stringify({ slugs }), {
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
  });
}
