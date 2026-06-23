# 资源分享站

一个现代化的资源分享博客网站模板，基于 Astro 4.x + Tailwind CSS 构建，支持 Decap CMS 后台管理，可直接部署到 Cloudflare Pages。

## 技术栈

- **Astro 7.x** - 快速、轻量的前端框架
- **Tailwind CSS 4.x** - 实用优先的 CSS 框架
- **Decap CMS** - 可视化内容管理后台

## 核心功能

### 博客文章系统
- ✅ 支持 6 大资源分类：绿化软件、影视/动漫、PC工具、游戏相关、实用教程、外站导航
- ✅ 文章置顶功能，置顶文章固定展示
- ✅ 文章草稿/发布状态切换
- ✅ 完整 Markdown 语法支持
- ✅ 全站文章实时搜索
- ✅ 相关资源推荐展示

### 外站分享导航系统
- ✅ 独立的外站导航页面 (`/sites`)
- ✅ 网站分类管理和筛选
- ✅ 卡片网格展示，hover 反馈效果
- ✅ 新标签页打开外部链接

### 后台管理系统
- ✅ Decap CMS 可视化管理
- ✅ GitHub 授权登录
- ✅ 支持文章和外站导航的增删改查

### 响应式适配
- ✅ 移动端优先设计
- ✅ 断点覆盖：手机(<640px)、平板(640-1024px)、桌面端(>1024px)
- ✅ 深色/浅色双主题自动切换

### 性能优化
- ✅ 纯静态 HTML 输出
- ✅ 自动生成 sitemap.xml 和 robots.txt

## 预设分类

1. **绿化软件** - 免安装软件合集
2. **影视动漫** - 高清影视资源
3. **PC工具** - 实用工具软件
4. **游戏相关** - 游戏资源分享
5. **实用教程** - 学习教程分享
6. **外站导航** - 优质网站推荐

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
│   │   ├── Navbar.astro     # 导航栏（含搜索功能）
│   │   └── Footer.astro     # 页脚
│   ├── data/                # 数据文件
│   │   ├── posts.ts         # 博客文章数据
│   │   └── sites.ts         # 外站导航数据
│   ├── layouts/             # 布局
│   │   └── Layout.astro     # 主布局
│   ├── pages/               # 页面
│   │   ├── index.astro      # 首页
│   │   ├── posts/[slug].astro # 文章详情页
│   │   ├── category/index.astro # 分类总览页
│   │   ├── category/[name].astro # 分类归档页
│   │   ├── sites.astro      # 外站导航页
│   │   ├── about.astro      # 关于页
│   │   └── search.json.ts   # 搜索 API
│   └── styles/              # 样式
│       └── global.css       # 全局样式
├── public/                  # 静态资源
│   ├── admin/               # Decap CMS 后台
│   └── robots.txt           # robots.txt
├── astro.config.mjs         # Astro 配置
├── tailwind.config.js       # Tailwind 配置
├── _redirects               # 重定向配置
└── package.json             # 项目依赖
```

## 示例内容

已内置 8 篇示例资源文章：
- 置顶文章 1 篇：2024年度精品软件合集
- 绿化软件 2 篇：Photoshop 2024、Office 2024
- 影视/动漫 2 篇：2024新番合集、经典电影合集
- PC工具 1 篇：Everything 文件搜索工具
- 游戏相关 1 篇：艾尔登法环
- 实用教程 1 篇：网盘资源搜索技巧

已内置 6 个示例外站：
- 资源网站：阿里云盘、百度网盘、夸克网盘
- 工具网站：在线解压、MD5加密、图片压缩工具

## 自定义配置

### 修改网站标题和描述

编辑 `src/layouts/Layout.astro` 文件中的标题和描述。

### 修改主题颜色

编辑 `src/styles/global.css` 文件中的颜色配置。

### 修改站点配置

编辑 `astro.config.mjs` 文件中的 `site` 配置。

## 许可证

MIT License
