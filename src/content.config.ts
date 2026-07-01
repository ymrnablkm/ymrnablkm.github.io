import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 资源文章集合 - 唯一内容源，纯 Markdown
const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
  }),
});

export const collections = { posts };
