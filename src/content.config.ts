import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 博客文章集合
const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    cover: z.string().optional(),
    category: z.string(),
    tags: z.array(z.string()).default([]),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    author: z.string().optional(),
    downloadLinks: z.array(z.object({
      name: z.string(),
      url: z.string(),
      password: z.string().optional(),
    })).optional(),
    // 兼容旧文章，不强制要求
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
  }),
});

export const collections = { blog };
