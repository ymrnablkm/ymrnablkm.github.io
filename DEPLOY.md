# 部署指南（新版后台）

本项目的后台需要服务端 API，推荐部署到 **Cloudflare Pages**；也可部署到 Vercel。
前台可以继续使用 GitHub Pages，但 GitHub Pages 不运行 Functions，后台登录与保存不可用。

---

## 一、Cloudflare Pages（推荐）

### 1. 推送代码到 GitHub

```bash
git add .
git commit -m "升级可视化内容管理系统"
git push
```

### 2. 创建 Pages 项目

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. **Workers & Pages** → **Create** → **Pages** → **Connect to Git**
3. 选择仓库
4. 构建配置：
   - **Framework preset**：Astro（或 None）
   - **Build command**：`npm run build`
   - **Build output directory**：`dist`
5. 点击 **Save and Deploy**

> `npm run build` 会先构建后台（Vite），再构建前台（Astro），无需额外命令。
> 根目录的 `functions/` 会被自动识别为 Pages Functions。

### 3. 配置环境变量

项目 → **Settings** → **Environment variables**，添加：

```
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
ADMIN_GITHUB_LOGIN
SESSION_SECRET
GITHUB_TOKEN
```

详细申请步骤见 [OAUTH_SETUP_GUIDE.md](./OAUTH_SETUP_GUIDE.md)。

配置完成后重新部署。

### 4. 访问

- 网站：`https://<项目名>.pages.dev/`
- 后台：`https://<项目名>.pages.dev/admin/app/`
- 旧地址 `/admin` 会自动跳转到新后台。

### 5. 绑定自定义域名（可选）

Pages 项目 → **Custom domains** → 添加域名 → 按提示配置 DNS。
绑定后请把 OAuth App 的 **Authorization callback URL** 改为：

```
https://你的域名/api/auth/callback
```

---

## 二、Vercel（可选）

1. 导入仓库，Framework 选择 Astro（或 Other）。
2. Build Command：`npm run build`
3. Output Directory：`dist`
4. 配置同样的 5 个环境变量。
5. `api/[...path].js` 会自动作为 Serverless Function 处理 `/api/*`。

OAuth 回调地址：`https://你的域名/api/auth/callback`。

---

## 三、GitHub Pages（仅前台）

仓库中的 `.github/workflows/deploy.yml` 会把构建结果发布到 GitHub Pages。
它包含前台与后台静态文件，但由于没有服务端：

- 后台页面可以打开，但登录与保存接口不可用；
- 适合只发布前台内容。

如需完整后台，请使用 Cloudflare Pages 或 Vercel，并把域名指向该平台。

---

## 四、本地构建与部署检查

```bash
npm install
npm run build        # 后台 + 前台
npm run dev:local    # 本地全栈验证（127.0.0.1:4322）
```

部署前确认：

- `dist/` 中包含 `admin/app/index.html` 与 `admin/app/assets/*`
- `dist/` 中包含 `_headers`、`robots.txt`、`sitemap-index.xml`、`rss.xml`
- `functions/api/[[path]].js` 存在
- 环境变量已配置且已重新部署

---

## 五、常见问题

**构建失败**
`npm ci` 后执行 `npm run build` 本地复现，优先检查 Node 版本（需 22+）。

**后台登录后 404**
OAuth 回调地址应为 `https://你的域名/api/auth/callback`，注意不是 `/admin/`。

**保存提示 403/500**
检查 `GITHUB_TOKEN` 是否有目标仓库的 Contents 读写权限，以及 `GITHUB_REPO` 是否正确。

**部署成功但前台没更新**
Cloudflare Pages 重新构建需要 1–2 分钟；到后台「系统状态」查看部署运行结果。

**预览域名无法登录**
预览域名每次不同，OAuth 回调地址固定，建议只在正式域名使用后台。
