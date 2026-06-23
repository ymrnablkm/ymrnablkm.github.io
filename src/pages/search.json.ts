import { getPosts } from '../data/posts';

export async function GET() {
  const posts = getPosts();
  
  const searchData = posts.map(post => ({
    title: post.title,
    description: post.description,
    url: `/posts/${post.id}`,
    category: post.category,
    tags: post.tags,
  }));
  
  return new Response(JSON.stringify(searchData), {
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
