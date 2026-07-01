# GitHub OAuth 配置步骤（5分钟搞定）

## 第一步：创建 GitHub OAuth App

1. 打开浏览器，访问：https://github.com/settings/developers
2. 点击左侧 **"OAuth Apps"** → 点击右上角 **"New OAuth App"**
3. 填写以下信息：

| 字段 | 填写内容 |
|------|----------|
| **Application name** | `Aether Yard CMS`（随便起个名字） |
| **Homepage URL** | `https://ymrnablkm.github.io` |
| **Application description** | （可选，填不填都行） |
| **Authorization callback URL** | `https://ymrnablkm.github.io/api/callback` |

4. 点击 **"Register application"**

## 第二步：获取 Client ID 和 Client Secret

创建完成后，你会看到：

- **Client ID**：直接显示，是一串字符（比如 `Iv1.abc123...`）
- **Client Secret**：点击 **"Generate a new client secret"** 按钮，会生成一串字符

**重要：Client Secret 只显示一次，复制保存好！**

## 第三步：发给我

把 Client ID 和 Client Secret 发给我（格式如下）：

```
Client ID: Iv1.xxxxxxxx
Client Secret: xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

我会立刻设置到 Vercel 环境变量，后台就能用了。

---

## 完成后你能得到什么？

- 访问 `https://ymrnablkm.github.io/admin/`
- 用 GitHub 账号登录
- 在后台编辑文章、上传图片、管理所有内容
- 所有改动自动同步到 GitHub，自动触发部署
- 全平台都能用（手机、电脑、平板）

---

## 安全说明

- Client Secret 只有你能看到，我设置到 Vercel 后是加密存储的
- OAuth 权限只限于你自己的仓库，不会影响其他仓库
- 你可以随时在 GitHub 删除这个 OAuth App， revoke 所有权限

---

**有问题随时问我，我一步步带你过。**