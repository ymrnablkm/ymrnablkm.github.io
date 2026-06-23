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
    tags: z.array(z.string()),
    pubDate: z.coerce.date(),
    updatedDate: z.coerce.date().optional(),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
  }),
});

// 外站导航集合 - 使用自定义 loader 处理 JSON 数组
const sites = defineCollection({
  loader: {
    name: 'sites-loader',
    load: async () => {
      // 直接读取 JSON 文件并展开数组
      const sites = [];
      
      // 手动加载 JSON 文件
      const devTools = [
        {
          "name": "GitHub",
          "url": "https://github.com",
          "description": "全球最大的代码托管平台，开源项目聚集地",
          "category": "开发工具",
          "icon": "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png"
        },
        {
          "name": "Stack Overflow",
          "url": "https://stackoverflow.com",
          "description": "程序员问答社区，技术问题解决方案库",
          "category": "开发工具"
        },
        {
          "name": "CodePen",
          "url": "https://codepen.io",
          "description": "前端代码在线演示平台，分享创意代码",
          "category": "开发工具"
        }
      ];
      
      const learning = [
        {
          "name": "MDN Web Docs",
          "url": "https://developer.mozilla.org",
          "description": "权威的Web技术文档，前端开发必备参考",
          "category": "学习资源"
        },
        {
          "name": "FreeCodeCamp",
          "url": "https://www.freecodecamp.org",
          "description": "免费编程学习平台，从零开始学编程",
          "category": "学习资源"
        },
        {
          "name": "DEV Community",
          "url": "https://dev.to",
          "description": "开发者社区，分享技术文章和经验",
          "category": "学习资源"
        },
        {
          "name": "阿里云盘",
          "url": "https://www.alipan.com",
          "description": "不限速的云存储服务，下载体验极佳",
          "category": "资源网站"
        },
        {
          "name": "百度网盘",
          "url": "https://pan.baidu.com",
          "description": "国内最大的云盘服务，资源丰富",
          "category": "资源网站"
        }
      ];
      
      [...devTools, ...learning].forEach((site, index) => {
        sites.push({
          id: `site-${index}`,
          data: site,
        });
      });
      
      return sites;
    },
  },
  schema: z.object({
    name: z.string(),
    url: z.string().url(),
    description: z.string(),
    category: z.string(),
    icon: z.string().optional(),
  }),
});

export const collections = { blog, sites };