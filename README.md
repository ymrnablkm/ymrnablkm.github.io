# 资源分享博客

一个高颜值、高性能、功能完整的资源分享博客网站，基于 Astro 4.x + Tailwind CSS 构建，支持 Decap CMS 后台管理，可直接部署到 Cloudflare Pages。

## 技术栈

- **Astro 4.x** - 快速、轻量的静态站点生成框架
- **Tailwind CSS v3** - 原子化 CSS 框架
- **Decap CMS** - 可视化内容管理后台
- **纯静态输出** - 所有页面预渲染为 HTML

## 功能特性

### 博客文章系统
- ✅ 文章分类、标签管理
- ✅ 文章置顶功能
- ✅ 草稿/发布状态切换
- ✅ 完整 Markdown 语法支持
- ✅ 全站文章实时搜索
- ✅ 相关文章推荐
- ✅ 文章目录导航

### 外站导航系统
- ✅ 独立的外站导航页面 `/sites`
- ✅ 分类筛选功能
- ✅ 搜索功能
- ✅ 卡片网格布局

### 通用功能
- ✅ 深色/浅色双主题切换
- ✅ 响应式布局（移动端/平板/桌面端）
- ✅ 回到顶部按钮
- ✅ 面包屑导航
- ✅ 侧边栏组件（分类、热门文章、公告）

### 后台管理
- ✅ Decap CMS 可视化管理
- ✅ GitHub OAuth 登录
- ✅ 中文界面

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

3. **配置 Decap CMS**
   - 编辑 `public/admin/index.html`
   - 将 `your-username/your-repo` 替换为你的 GitHub 仓库地址
   - 在 GitHub 创建 OAuth App（Settings > Developer settings > OAuth Apps）
   - 设置 Authorization callback URL：`https://your-domain.com/admin`
   - 在 Cloudflare Pages 设置环境变量（可选）

4. **访问后台**
   - 打开 `https://your-domain.com/admin`
   - 使用 GitHub 账号登录

## 项目结构

```
├── src/
│   ├── content/           # 内容目录
│   │   ├── blog/          # 博客文章
│   │   ├── sites/         # 外站导航
│   │   └── config.ts      # 内容集合配置
│   ├── components/        # 组件
│   │   ├── Navbar.astro   # 导航栏
│   │   └── Footer.astro   # 页脚
│   ├── layouts/           # 布局
│   │   └── Layout.astro   # 主布局
│   ├── pages/             # 页面
│   │   ├── index.astro    # 首页
│   │   ├── posts/         # 文章详情页
│   │   ├── categories/    # 分类页
│   │   ├── sites.astro    # 外站导航页
│   │   ├── about.astro    # 关于页
│   │   └── search.json.ts # 搜索 API
│   └── styles/            # 样式
│       └── global.css     # 全局样式
├── public/                # 静态资源
│   ├── admin/             # Decap CMS 后台
│   ├── uploads/           # 上传文件目录
│   └── robots.txt         # robots.txt
├── astro.config.mjs       # Astro 配置
├── tailwind.config.js     # Tailwind 配置
└── package.json           # 项目依赖
```

## 内容管理

### 添加文章

1. 访问 `/admin` 后台
2. 选择「博客文章」集合
3. 点击「新建博客文章」
4. 填写文章信息：
   - 标题、摘要、封面图
   - 分类、标签
   - 发布日期
   - 是否置顶、是否草稿
   - 正文内容（Markdown 格式）
5. 点击「发布」

### 添加外站导航

1. 访问 `/admin` 后台
2. 选择「外站导航」集合
3. 编辑网站列表
4. 添加新网站：
   - 网站名称、官网链接
   - 一句话介绍
   - 所属分类
   - 网站图标（可选）
5. 点击「保存」

## 自定义配置

### 修改网站标题

编辑 `src/layouts/Layout.astro` 和 `src/components/Navbar.astro` 中的标题。

### 修改主题颜色

编辑 `tailwind.config.js` 中的颜色配置。

### 修改网站域名

编辑 `astro.config.mjs` 中的 `site` 配置。

## 示例内容

项目内置以下示例内容：

- **3篇示例文章**：置顶文章、普通文章、带网盘链接的文章
- **8个示例外站**：开发工具、学习资源、资源网站等分类
- **关于页面**：网站介绍内容

## 许可证

MIT License