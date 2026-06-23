# 资源分享博客 - GitHub 部署指南

## 第一步：创建 GitHub 仓库

1. 打开 GitHub 网站：https://github.com
2. 点击右上角的 `+` 号，选择 `New repository`
3. 填写仓库信息：
   - **Repository name**: `resource-blog`（或你喜欢的名字）
   - **Description**: `资源分享博客 - 高颜值高性能的静态网站`
   - 选择 **Public**（公开）或 **Private**（私有）
   - **不要**勾选 "Add a README file"（我们已有代码）
4. 点击 **Create repository**

## 第二步：推送代码到 GitHub

创建仓库后，GitHub 会显示推送指南，执行以下命令（注意替换你的用户名和仓库名）：

```bash
# 添加远程仓库（替换 YOUR_USERNAME 和 YOUR_REPO_NAME）
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# 推送代码到 GitHub
git branch -M main
git push -u origin main
```

## 第三步：配置 Decap CMS

1. 编辑 `public/admin/index.html`
2. 将 `your-username/your-repo` 替换为你的 GitHub 仓库地址（例如：`mygithub/resource-blog`）

```javascript
backend: {
  name: 'github',
  repo: 'mygithub/resource-blog',  // 改成你的
  branch: 'main',
}
```

## 第四步：创建 GitHub OAuth App（用于后台登录）

1. 打开 GitHub Settings → Developer settings → OAuth Apps
2. 点击 **New OAuth App**
3. 填写信息：
   - **Application name**: `资源分享博客 CMS`
   - **Homepage URL**: `https://your-site.pages.dev`
   - **Authorization callback URL**: `https://your-site.pages.dev/admin/auth`
4. 点击 **Register application**
5. 保存 **Client ID** 和 **Client Secret**

## 第五步：部署到 Cloudflare Pages

### 方法一：连接 GitHub 自动部署（推荐）

1. 登录 [Cloudflare Dashboard](https://dash.cloudflare.com)
2. 进入 **Workers & Pages** → **Create application** → **Pages**
3. 点击 **Connect to Git**
4. 选择你的 GitHub 仓库
5. 配置构建设置：
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
6. 点击 **Deploy site**

### 方法二：手动部署

```bash
# 构建项目
npm run build

# 安装 Wrangler
npm install -g wrangler

# 部署
wrangler pages deploy dist
```

## 第六步：配置自定义域名（可选）

1. 在 Cloudflare Pages 设置中点击 **Custom domains**
2. 添加你的域名
3. 按照提示配置 DNS

## 完成后访问

- 网站地址：`https://your-site.pages.dev`
- 后台地址：`https://your-site.pages.dev/admin`

## 后续使用

### 添加/编辑文章
1. 访问 `/admin`
2. 使用 GitHub 账号登录
3. 选择「博客文章」进行管理

### 添加/编辑外站导航
1. 访问 `/admin`
2. 选择「外站导航」进行管理

## 常见问题

### Q: 推送时提示权限错误？
A: 确保 GitHub 账号有仓库的推送权限，或者使用 Personal Access Token。

### Q: CMS 登录失败？
A: 检查 OAuth App 的 Callback URL 是否正确配置。

### Q: 构建失败？
A: 确保所有依赖已安装：`npm install`

## 快速命令汇总

```bash
# 安装依赖
npm install

# 本地开发
npm run dev

# 构建生产版本
npm run build

# 预览构建结果
npm run preview

# 推送到 GitHub
git add .
git commit -m "更新内容"
git push
```

---

**提示**：修改代码后推送到 GitHub，Cloudflare Pages 会自动重新部署！

有问题请提交 Issue 或联系开发者。
