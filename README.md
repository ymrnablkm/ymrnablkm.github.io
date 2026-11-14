# Aether Yard 资源分享站 · 全能可视化内容管理系统

一个基于 **Astro + Tailwind CSS** 的静态资源分享站，内置**手机优先的可视化后台**：
文章、分类、标签、导航、首页、独立页面、媒体库、下载资源、网站设置、SEO、回收站、版本管理、系统状态、账号安全，共 15 个模块。

后台的所有保存操作都通过服务端 API 直接提交到 GitHub 仓库，触发自动部署，无需在本地改代码。

---

## 一、技术栈

| 层 | 技术 |
| --- | --- |
| 前台 | Astro 7、Tailwind CSS 4、Markdown 内容集合 |
| 后台 | React 19、TypeScript、Vite 7、Tiptap 3 富文本编辑器 |
| 服务端 | Cloudflare Pages Functions（或 Vercel Serverless） |
| 鉴权 | GitHub OAuth + AES-GCM 加密 Session Cookie + 管理员白名单 |
| 内容存储 | GitHub 仓库（Markdown 与 JSON 文件） |
| 图片 | 浏览器端压缩后上传到 `public/images/` |

---

## 二、目录结构

```
.
├─ admin/                     # 后台前端源码（React + Vite）
│  ├─ src/
│  │  ├─ components/          # 布局、编辑器、媒体选择器、UI 组件
│  │  ├─ pages/               # 15 个管理模块
│  │  └─ lib/                 # 图片压缩上传
│  └─ vite.config.ts          # 构建输出到 public/admin/app
├─ content/
│  ├─ posts/                  # 文章（Markdown + Frontmatter）
│  ├─ pages/                  # 独立页面
│  ├─ trash/                  # 回收站
│  ├─ site.json               # 网站设置 / SEO
│  ├─ home.json               # 首页配置（公告、Hero、轮播、模块）
│  ├─ categories.json         # 分类
│  ├─ tags.json               # 标签
│  └─ nav.json                # 导航
├─ functions/api/[[path]].js  # Cloudflare Pages Functions 入口
├─ api/[...path].js           # Vercel Serverless 入口（可选）
├─ server/                    # 与平台无关的服务端代码
│  ├─ router.js               # 全部管理 API
│  └─ lib/                    # 会话、GitHub 存储、本地存储、内容解析
├─ scripts/dev-server.mjs     # 本地全栈联调服务器
├─ public/admin/              # 后台入口页与构建产物
├─ src/                       # 前台 Astro 页面与组件
└─ .github/workflows/deploy.yml
```

---

## 三、本地运行（3 步）

```bash
# 1. 安装依赖（Node.js 22+）
npm install

# 2. 构建前台 + 后台
npm run build

# 3. 启动本地全栈服务器
npm run dev:local
```

打开：

- 前台：<http://127.0.0.1:4322/>
- 后台：<http://127.0.0.1:4322/admin/app/>

本地模式会显示「本地开发登录（仅本机可用）」按钮，直接进入后台。
本地模式下所有修改只写入本机文件，**不会提交到 GitHub**；修改完成后需要重新执行 `npm run build` 才能在前台看到新页面。

> 只调试后台界面时可以运行 `npm run dev:admin`（Vite 开发服务器，默认 <http://127.0.0.1:5174>，需同时运行 `npm run dev:local` 提供 API）。

---

## 四、后台使用教程

后台入口：`https://你的域名/admin/app/`（访问 `/admin` 会自动跳转）。
手机浏览器可以直接使用，也可以「添加到主屏幕」当作 App 打开。

### 1. 工作台

显示文章总数、已发布、草稿、分类/标签、图片、下载渠道、独立页面、回收站数量，以及最近发布、同步与部署状态、快捷操作。

### 2. 文章管理

- 新建：填写标题、简介、封面、分类、标签、发布时间、作者。
- 正文：可视化编辑器，支持标题、加粗/斜体/下划线/删除线、颜色、字号、对齐、列表、引用、代码块、分割线、表格、图片、视频、超链接、**信息提示框**、**折叠内容**、**下载按钮**。
- 资源：展开「资源下载信息」，可为同一篇文章添加多个网盘渠道，填写名称、渠道、下载地址、提取码、解压密码、类型、版本、大小、平台、语言、更新时间、资源简介、使用说明、按钮文字，并可单独隐藏某个渠道。
- SEO：展开「SEO 设置」，填写 SEO 标题、SEO 描述、关键词。
- 保存：点「保存」保存草稿，点「保存并发布」立即发布。保存即同步到 GitHub。
- 自动保存：编辑过程中每 1.2 秒自动保存到本机浏览器，刷新或误关页面后可恢复。
- 列表页支持搜索、按分类/状态/日期筛选、排序、批量改分类、批量发布/撤回、批量删除、复制、置顶、撤回。
- 删除默认进入回收站，可随时恢复。

### 3. 分类管理

新增、编辑、删除、排序、显示/隐藏分类。删除有文章的分类时，会要求选择把这些文章转移到哪个分类或置空，避免出现「孤儿文章」。修改分类 URL 会自动同步更新文章里的分类引用。

### 4. 标签管理

新增、编辑、删除、搜索标签。删除使用中的标签时，可选择把文章里的该标签替换为其他标签或直接移除。

### 5. 导航管理

新增导航项、设置跳转地址、外链、显示/隐藏、排序、设置父级（子导航）。保存后前台导航立即生效。
`showInNav` 的独立页面也会自动出现在导航里。

### 6. 首页管理

- 公告条：内容、链接、是否显示。
- Hero 头部：主标题、副标题、背景图。
- 轮播图：图片、标题、跳转链接、显示开关。
- 推荐文章：勾选并调整顺序。
- 首页模块：从已实现的模块（最新文章、推荐文章、分类导航、资源下载、自定义文字、友情链接）中添加、排序、显示/隐藏、设置条数。

### 7. 页面管理

创建「关于本站」「联系我们」「免责声明」等独立页面，可设置 URL、简介、排序、是否显示在导航、草稿状态与 SEO。页面同样自动保存、支持预览和回收站。

### 8. 媒体库

上传图片（自动压缩到合适尺寸并转为 WebP/JPEG，单张不超过 4 MB）、搜索、复制地址、重命名、删除。
删除正在被文章使用的图片时会提示引用位置，确认后才强制删除。

### 9. 资源管理

汇总全站所有下载渠道，可按文章标题、资源名、渠道搜索，一键跳转到对应文章编辑。

### 10. 网站设置

网站名称、副标题、简介、域名、联系方式、首页介绍、全站公告、Logo、图标、默认封面、页脚文字、版权、备案号、社交链接。

### 11. SEO 管理

网站级 SEO 标题、描述、关键词、Open Graph 分享图；同时列出缺少 SEO 信息的文章，方便逐个补齐。
前台会自动输出：`<title>`、`description`、`keywords`、Canonical、Open Graph、Twitter Card、JSON-LD 结构化数据、`sitemap-index.xml`、`rss.xml`。

### 12. 回收站

删除的文章和页面先进入回收站，可恢复或永久删除。永久删除后仍能在 GitHub 提交历史中找到。

### 13. 版本管理

选择任意文章、页面或数据文件，查看它的每次提交记录，可查看历史内容并一键恢复。恢复本身也是一次新提交，不会丢失任何历史。

### 14. 系统状态

查看 GitHub 连接状态、最近提交、自动部署（GitHub Actions）运行结果。出现保存或部署异常时先看这里。

### 15. 账号与安全

查看当前 GitHub 账号、退出登录、了解会话与权限机制。

---

## 五、部署到 Cloudflare Pages（推荐）

后台需要服务端 API，推荐使用 Cloudflare Pages（原生支持 Pages Functions）。

1. 把仓库推送到 GitHub。
2. Cloudflare 控制台 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**，选择仓库。
3. 构建设置：
   - Framework preset：`Astro`（或 None）
   - Build command：`npm run build`
   - Build output directory：`dist`
   - 环境变量（Production 与 Preview 都建议配置）：见下一节。
4. 保存并部署。部署完成后访问 `https://<项目名>.pages.dev/admin/app/`。

> `functions/` 目录会被自动识别为 Pages Functions，无需额外配置。
> 每次在后台保存，都会提交到 GitHub，Cloudflare Pages 检测到新提交后自动重新部署。

### 必填环境变量

| 变量 | 说明 |
| --- | --- |
| `GITHUB_CLIENT_ID` | GitHub OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | GitHub OAuth App 的 Client Secret |
| `ADMIN_GITHUB_LOGIN` | 允许登录的 GitHub 用户名，多个用英文逗号分隔 |
| `SESSION_SECRET` | 至少 16 位的随机字符串，用于加密登录 Cookie |
| `GITHUB_TOKEN` | 有仓库写入权限的 GitHub Token，用于保存内容 |

### 可选环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `GITHUB_REPO` | `ymrnablkm/ymrnablkm.github.io` | 内容仓库 |
| `GITHUB_BRANCH` | `main` | 内容分支 |
| `GITHUB_OAUTH_SCOPE` | `public_repo read:user` | OAuth 授权范围 |

详细的 OAuth 与 Token 申请步骤见 [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)。

### 部署到 Vercel（可选）

项目同时提供 `api/[...path].js` 适配器与 `vercel.json`，在 Vercel 导入仓库并配置同样的环境变量即可。
注意：Vercel 的 Serverless 函数运行环境同样通过 GitHub API 读写内容，不依赖本地文件系统。

### 关于 GitHub Pages

仓库里保留了 `.github/workflows/deploy.yml`，可以继续把**前台**发布到 GitHub Pages。
但 GitHub Pages 是纯静态托管，**不运行 `functions/`**，因此后台的保存/登录接口不可用。
需要在 GitHub Pages 上使用后台时，请把后台 API 部署到 Cloudflare Pages 或 Vercel，并让前台与后台使用同一个域名。

---

## 六、内容存储与同步

- 文章保存在 `content/posts/<slug>.md`，Frontmatter + Markdown 正文。
- 独立页面保存在 `content/pages/<slug>.md`。
- 分类、标签、导航、网站设置、首页配置均为 `content/*.json`。
- 图片保存在 `public/images/年/月/`。
- 删除的文章进入 `content/trash/`。
- 每次保存都会生成一条 Git 提交，提交信息形如 `后台更新文章：标题（时间）`。
- 保存时使用文件 SHA 做并发校验：如果同一文件在别处被修改，会提示「文件已被其他操作修改」，刷新后重试即可。

---

## 七、备份与恢复

1. **自动备份**：GitHub 仓库本身就是完整备份，所有历史版本都可追溯。
2. **版本恢复**：后台「版本管理」可把任意文件恢复到任意一次提交。
3. **回收站**：误删文章/页面可在回收站恢复。
4. **整站备份**：在 GitHub 仓库页面 → Code → Download ZIP。
5. **整站恢复**：把备份中的 `content/`、`public/images/` 覆盖回仓库后提交即可。

---

## 八、常见问题

**后台提示「尚未配置 GitHub 登录」**
部署平台缺少 `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`，配置后重新部署。

**点击登录后跳回 GitHub 或提示 state 不匹配**
OAuth App 的 Authorization callback URL 必须与访问域名一致，格式为 `https://你的域名/api/auth/callback`。

**提示「账号 xxx 不在管理员白名单中」**
把该 GitHub 用户名加入 `ADMIN_GITHUB_LOGIN`（大小写不敏感，多个用逗号分隔）。

**提示「服务端缺少 SESSION_SECRET」**
配置一个至少 16 位的随机字符串，例如用 `openssl rand -hex 32` 生成。

**保存失败（500 / 401 / 403）**
- 401：登录过期，重新登录。
- 403：`GITHUB_TOKEN` 权限不足或仓库不对。
- 500：检查 `GITHUB_TOKEN` 是否配置、仓库名是否正确，或稍后重试。

**图片上传失败**
单张图片压缩后不能超过 4 MB；格式支持 JPG、PNG、WebP、GIF、SVG、AVIF。

**部署后前台没变化**
到「系统状态」查看部署是否成功；Cloudflare Pages 可能需要 1–2 分钟重新构建。

**手机端怎么用**
直接访问 `https://你的域名/admin/app/`，用 GitHub 登录即可；也可以「添加到主屏幕」。

---

## 九、安全说明

- 登录使用 GitHub OAuth，服务端校验管理员白名单与仓库写入权限。
- GitHub Token 只存在于服务端加密的 HttpOnly Cookie 中，不会出现在前端页面或接口响应里。
- 所有写操作都要求 `X-CSRF-Token` 校验和同源检查。
- 未登录用户访问管理 API 一律返回 401。
- `/admin/` 已在 `robots.txt` 中禁止收录，后台页面带有 `noindex`。
- 删除文章默认进入回收站，降低误操作风险。

---

## 十、常用命令

```bash
npm run dev          # 仅前台开发服务器（无后台 API）
npm run dev:admin    # 后台 Vite 开发服务器
npm run dev:local    # 本地全栈（前台 + 后台 + API），推荐
npm run build:admin  # 只构建后台
npm run build        # 构建后台 + 前台（部署时使用）
npm run preview      # 预览 Astro 构建结果（无 API）
```
