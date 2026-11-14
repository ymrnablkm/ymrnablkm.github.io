# GitHub 登录与同步配置教程（新后台）

本教程对应新版「网站管理中心」（`/admin/app/`）。全部配置完成后，才能在手机上用 GitHub 账号登录并在后台保存内容。

需要准备 4 个环境变量：

| 变量 | 用途 |
| --- | --- |
| `GITHUB_CLIENT_ID` | OAuth App 的 Client ID |
| `GITHUB_CLIENT_SECRET` | OAuth App 的 Client Secret |
| `ADMIN_GITHUB_LOGIN` | 允许登录的 GitHub 用户名（白名单） |
| `SESSION_SECRET` | 加密登录 Cookie 的随机密钥 |
| `GITHUB_TOKEN` | 保存内容到仓库的 Token |

---

## 第 1 步：创建 GitHub OAuth App

1. 登录 GitHub，点击右上角头像 → **Settings**。
2. 左侧最下方 → **Developer settings** → **OAuth Apps** → **New OAuth App**。
3. 填写：

   - **Application name**：`Aether Yard 管理中心`（随意）
   - **Homepage URL**：`https://你的域名`
   - **Authorization callback URL**：`https://你的域名/api/auth/callback`
     （⚠️ 必须完全一致，包括 `https` 和结尾路径，**不能**是 `/admin/`）

4. 点击 **Register application**。
5. 在应用详情页复制 **Client ID**。
6. 点击 **Generate a new client secret**，复制生成的 **Client Secret**（只显示一次）。

> 使用 Cloudflare Pages 时，域名可以是 `https://项目名.pages.dev`，也可以是绑定后的自定义域名。
> 一个 OAuth App 只能填一个回调地址，请选择你实际访问后台的域名。

---

## 第 2 步：创建内容同步 Token（GITHUB_TOKEN）

推荐使用 Fine-grained Token：

1. GitHub → **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**。
2. Token name：`aether-yard-cms`，有效期按需选择。
3. **Repository access** → Only select repositories → 选择你的站点仓库（例如 `ymrnablkm/ymrnablkm.github.io`）。
4. **Permissions**：
   - `Contents`：**Read and write**（必须，用于读写文章与图片）
   - `Actions`：**Read**（可选，用于显示部署状态）
   - `Metadata`：Read（自动勾选）
5. 生成并复制 Token。

也可以使用 Classic Token，勾选 `repo`（私有仓库还需 `workflow`）。

---

## 第 3 步：生成 SESSION_SECRET

任意 16 位以上的随机字符串即可，例如：

```bash
openssl rand -hex 32
```

或者自己输入一串足够长的随机字母数字。**不要使用示例值，也不要泄露。**

---

## 第 4 步：在部署平台配置环境变量

### Cloudflare Pages

1. Cloudflare 控制台 → **Workers & Pages** → 选择你的 Pages 项目。
2. **Settings** → **Environment variables** → **Add variable**。
3. 依次添加：

   ```
   GITHUB_CLIENT_ID      = 第 1 步的 Client ID
   GITHUB_CLIENT_SECRET  = 第 1 步的 Client Secret
   ADMIN_GITHUB_LOGIN    = 你的 GitHub 用户名（多个用英文逗号分隔）
   SESSION_SECRET        = 第 3 步的随机字符串
   GITHUB_TOKEN          = 第 2 步的 Token
   ```

4. 建议同时配置到 **Production** 和 **Preview** 环境。
5. 保存后重新部署一次（Deployments → Retry deployment，或推送一次提交）。

### Vercel

Project → **Settings** → **Environment Variables**，添加同样的 5 个变量，然后 **Redeploy**。

> 注意：Cloudflare Pages 的预览域名每次不同，OAuth 回调地址固定，因此**预览环境通常无法登录**。
> 请在正式域名上测试登录，或为预览域名单独创建一个 OAuth App。

---

## 第 5 步：验证登录

1. 打开 `https://你的域名/admin/app/`。
2. 点击「使用 GitHub 登录」。
3. 授权后会回到后台，左侧显示 15 个管理模块。
4. 打开「工作台」，查看「同步与部署」是否正常。
5. 新建一篇草稿并保存，到 GitHub 仓库确认出现新提交。

---

## 本地开发模式（不需要 OAuth）

```bash
npm install
npm run build
npm run dev:local
```

访问 `http://127.0.0.1:4322/admin/app/`，点击「本地开发登录（仅本机可用）」。
本地模式直接读写本机 `content/` 与 `public/images/`，不会提交 GitHub，也不会校验白名单。

---

## 常见问题排查

| 现象 | 原因与解决 |
| --- | --- |
| 后台显示「尚未配置 GitHub 登录」 | `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` 未配置，或配置后没有重新部署 |
| 点击登录 404 / 跳转失败 | 回调地址必须写成 `https://你的域名/api/auth/callback` |
| 提示「登录状态校验失败（state 不匹配）」 | 回调域名与当前访问域名不一致，或 Cookie 被浏览器拦截；请用同一个域名访问 |
| 提示「不在管理员白名单中」 | 把当前 GitHub 用户名加入 `ADMIN_GITHUB_LOGIN` |
| 提示「没有仓库写入权限」 | 登录账号本身不是仓库协作者；换仓库所有者账号登录，或添加协作者 |
| 提示「服务端缺少 SESSION_SECRET」 | 配置至少 16 位随机字符串 |
| 保存提示 401 | 登录过期，重新登录 |
| 保存提示 403 | `GITHUB_TOKEN` 权限不足或仓库不对 |
| 保存提示「文件已被其他操作修改」 | 同一文件在别处被改动（如直接改仓库），刷新页面后重试 |
| 部署状态一直「无法读取」 | `GITHUB_TOKEN` 没有 Actions 读取权限；不影响内容保存 |

---

## 安全检查清单

- [ ] `ADMIN_GITHUB_LOGIN` 只包含自己的账号
- [ ] `SESSION_SECRET` 足够长且未写进仓库
- [ ] `GITHUB_TOKEN` 只授权了站点仓库
- [ ] OAuth 回调地址只填正式域名
- [ ] 不再使用旧版 Sveltia 回调（旧版入口已归档到 `/admin/legacy/`）
- [ ] 定期在「版本管理」中检查异常提交
