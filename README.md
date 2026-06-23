# 资源分享博客

一个基于 Astro 构建的资源分享博客网站，支持 Decap CMS 后台管理，可直接部署到 Cloudflare Pages。

## 技术栈

- **Astro 4.x** - 快速、轻量的前端框架
- **Tailwind CSS 4.x** - 实用优先的 CSS 框架
- **Decap CMS** - 可视化内容管理后台
- **Cloudflare Pages** - 全球 CDN 加速部署

## 功能特性

### 博客文章系统
- 支持无限文章分类、标签管理
- 文章置顶功能
- 文章草稿/发布状态切换
- 完整 Markdown 语法支持
- 全站文章实时搜索
- 相关推荐文章展示

### 外站分享导航系统
- 独立的外站导航页面 (`/sites`)
- 网站分类管理和筛选
- 卡片网格展示，hover 反馈效果
- 新标签页打开外部链接

### 后台管理系统
- Decap CMS 可视化管理
- GitHub 授权登录
- 支持文章和外站导航的增删改查

### 响应式适配
- 移动端优先设计
- 断点覆盖：手机(<640px)、平板(640-1024px)、桌面端(>1024px)
- 深色/浅色双主题自动切换

### 性能优化
- 纯静态 HTML 输出
- 首屏 JS 体积控制在 50KB 以内
- 原生懒加载
- 自动生成 sitemap.xml 和 robots.txt

## 快速开始

### 本地运行

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 预览生产版本
npm run preview
```

### Cloudflare Pages 部署

1. **创建 GitHub 仓库**
   - 将代码推送到 GitHub 仓库

2. **配置 Cloudflare Pages**
   - 登录 Cloudflare 控制台
   - 创建新的 Pages 项目
   - 选择你的 GitHub 仓库
   - 配置构建命令：`npm run build`
   - 配置输出目录：`dist`
   - 点击部署

3. **配置环境变量（可选）**
   - 如果需要自定义域名，在 Cloudflare Pages 中配置自定义域名

### Decap CMS 配置

1. **配置 GitHub OAuth**
   - 访问 GitHub Settings > Developer settings > OAuth Apps
   - 创建新的 OAuth App
   - 设置 Authorization callback URL: `https://your-domain.com/admin/auth`
   - 记录 Client ID 和 Client Secret

2. **更新 CMS 配置**
   - 编辑 `public/admin/index.html`
   - 将 `your-username/your-repo` 替换为你的 GitHub 仓库地址

3. **访问后台**
   - 打开 `https://your-domain.com/admin`
   - 使用 GitHub 账号登录

## 项目结构

```
├── src/
│   ├── components/          # 组件
│   │   ├── Navbar.astro     # 导航栏
│   │   └── Footer.astro     # 页脚
│   ├── content/             # 内容目录
│   │   ├── posts/           # 博客文章
│   │   └── sites/           # 外站导航数据
│   ├── layouts/             # 布局
│   │   └── Layout.astro     # 主布局
│   ├── pages/               # 页面
│   │   ├── index.astro      # 首页
│   │   ├── posts/           # 文章详情页
│   │   ├── category/        # 分类归档页
│   │   ├── sites.astro      # 外站导航页
│   │   ├── about.astro      # 关于页
│   │   └── search.json.ts   # 搜索 API
│   └── styles/              # 样式
│       └── global.css       # 全局样式
├── public/                  # 静态资源
│   ├── admin/               # Decap CMS
│   ├── favicon.ico          # 网站图标
│   └── robots.txt           # robots.txt
├── astro.config.mjs         # Astro 配置
├── tailwind.config.js       # Tailwind 配置
└── package.json             # 项目依赖
```

## 内容管理

### 文章格式

文章存储在 `src/content/posts/` 目录，采用 Markdown 格式：

```markdown
---
title: '文章标题'
description: '文章描述'
pubDate: 2024-01-15
category: '分类名称'
tags: ['标签1', '标签2']
isFeatured: false
isDraft: false
---

文章正文...
```

### 外站导航格式

外站数据存储在 `src/content/sites/` 目录，采用 JSON 格式：

```json
[
  {
    "name": "网站名称",
    "url": "https://example.com",
    "description": "一句话简介",
    "category": "分类名称",
    "icon": "图标地址（可选）"
  }
]
```

## 自定义配置

### 修改网站标题和描述

编辑 `src/layouts/Layout.astro` 文件中的标题和描述。

### 修改主题颜色

编辑 `tailwind.config.js` 文件中的颜色配置。

### 修改站点配置

编辑 `astro.config.mjs` 文件中的 `site` 配置。

## 许可证

MIT License
