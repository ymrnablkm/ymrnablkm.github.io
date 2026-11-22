import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 兼容手工编辑时把日期/数字写成非字符串的情况，避免整站构建失败
const optionalText = z.preprocess((value) => {
  if (value === null || value === undefined || value === '') return undefined;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}, z.string().optional());

const downloadSchema = z.object({
  name: z.coerce.string(),
  channel: optionalText,
  updated: optionalText,
  summary: optionalText,
  url: z.coerce.string(),
  code: optionalText,
  password: optionalText,
  instructions: optionalText,
  buttonText: optionalText,
  visible: z.boolean().default(true),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/posts' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    description: z.string().optional(),
    cover: z.string().optional(),
    subtitle: z.string().optional(),
    category: z.string().optional(),
    tags: z.array(z.string()).default([]),
    featured: z.boolean().default(false),
    // 旧字段：保留以兼容历史文章，未设置新字段时按原行为（首页+分类同时置顶）处理
    pinned: z.boolean().optional(),
    pinnedHome: z.boolean().optional(),
    pinnedCategory: z.boolean().optional(),
    draft: z.boolean().default(false),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    resources: z.array(downloadSchema).default([]),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './content/pages' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.date().optional(),
    updated: z.coerce.date().optional(),
    description: z.string().optional(),
    seoTitle: z.string().optional(),
    seoDescription: z.string().optional(),
    keywords: z.array(z.string()).default([]),
    showInNav: z.boolean().default(false),
    draft: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { posts, pages };
