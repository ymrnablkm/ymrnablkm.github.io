import { getCollection } from 'astro:content';

export async function GET() {
  const posts = await getCollection('blog', ({ data }) => !data.draft);
  
  const searchData = posts.map(post => ({
    title: post.data.title,
    description: post.data.description,
    url: `/posts/${post.id}`,
    category: post.data.category,
    tags: post.data.tags,
    pubDate: post.data.pubDate,
  }));
  
  return new Response(JSON.stringify(searchData), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}