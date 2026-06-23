export interface Post {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  category: string;
  tags: string[];
  isFeatured: boolean;
  isDraft: boolean;
  content: string;
}

export const posts: Post[] = [
  {
    id: 'featured-post',
    title: '推荐一个超实用的资源分享平台',
    description: '今天给大家推荐一个我一直在用的资源分享平台，里面有大量优质的学习资料和实用工具。',
    pubDate: '2024-01-15',
    category: '资源分享',
    tags: ['推荐', '资源', '学习'],
    isFeatured: true,
    isDraft: false,
    content: `## 平台介绍

这个平台汇集了来自各行各业的优质资源，无论是学习资料、软件工具还是实用技巧，你都能在这里找到。

### 主要特点

- **资源丰富**：涵盖编程、设计、写作等多个领域
- **更新及时**：每天都有新资源上线
- **完全免费**：所有资源均可免费获取

## 网盘链接

如果你想获取更多资源，可以访问我的网盘：

> [点击下载](https://pan.example.com/s/abc123)

## 总结

这个平台真的非常棒，强烈推荐给大家！`
  },
  {
    id: 'regular-post',
    title: '前端开发必备工具推荐',
    description: '分享一些我在前端开发过程中经常使用的工具，提升开发效率。',
    pubDate: '2024-01-10',
    category: '技术分享',
    tags: ['前端', '工具', '开发'],
    isFeatured: false,
    isDraft: false,
    content: `## 代码编辑器

- **VS Code**：功能强大，插件丰富
- **Sublime Text**：轻量级，启动速度快

## 浏览器工具

- **Chrome DevTools**：调试神器
- **Firefox DevTools**：某些功能更强大

## 在线工具

- **CodePen**：在线代码演示
- **JSFiddle**：快速原型开发

## 学习资源

推荐大家多关注一些优质的技术博客和教程网站，不断提升自己的技术能力。`
  },
  {
    id: 'cloud-storage-guide',
    title: '云盘资源分享指南',
    description: '详细介绍如何高效地分享和管理云盘资源，包括百度网盘、阿里云盘等主流云存储服务。',
    pubDate: '2024-01-05',
    category: '教程',
    tags: ['云盘', '资源', '教程'],
    isFeatured: false,
    isDraft: false,
    content: `## 百度网盘

百度网盘是国内最常用的云存储服务之一，分享资源非常方便。

### 分享技巧

1. 创建分享链接时可以设置提取码
2. 支持批量分享多个文件
3. 可以设置分享有效期

### 下载加速

> [百度网盘客户端](https://pan.baidu.com/)

## 阿里云盘

阿里云盘是后起之秀，速度快，空间大。

### 优势

- **下载速度快**：不限速下载
- **空间大**：新用户赠送大量空间
- **界面简洁**：操作简单易用

> [阿里云盘](https://www.alipan.com/)

## 总结

选择适合自己的云盘服务，合理管理和分享资源。`
  }
];

export function getPosts() {
  return posts.filter(p => !p.isDraft);
}

export function getPostById(id: string) {
  return posts.find(p => p.id === id && !p.isDraft);
}

export function getCategories() {
  return [...new Set(posts.filter(p => !p.isDraft).map(p => p.category))];
}

export function getPostsByCategory(category: string) {
  return posts.filter(p => p.category === category && !p.isDraft);
}

export function getFeaturedPosts() {
  return posts.filter(p => p.isFeatured && !p.isDraft);
}

export function getRegularPosts() {
  return posts.filter(p => !p.isFeatured && !p.isDraft).sort((a, b) => 
    new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );
}
