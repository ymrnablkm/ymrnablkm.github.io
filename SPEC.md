# Aether Yard 资源站 - 设计规格

## 1. Concept & Vision

一个极简主义黑白科技感软件资源分享站。设计灵感来自高端科技产品发布会和现代极简主义 UI，强调内容的纯粹性和专业感。整体氛围冷静、克制、高端，像一个精心策划的数字档案馆。

## 2. Design Language

### 色彩系统
- **背景主色**: `#0a0a0a` (纯黑)
- **背景次色**: `#111111` (深灰)
- **卡片背景**: `#161616` (略浅灰)
- **卡片悬停**: `#1a1a1a`
- **边框色**: `#2a2a2a` (暗灰边框)
- **主文字**: `#ffffff` (纯白)
- **次文字**: `#888888` (中灰)
- **辅助文字**: `#555555` (暗灰)
- **强调色**: `#00ff88` (科技绿)
- **强调悬停**: `#00cc6a`
- **警告色**: `#ff4444`
- **分割线**: `#222222`

### 字体
- **标题**: `"JetBrains Mono", "Fira Code", monospace` - 科技感等宽字体
- **正文**: `"Inter", "SF Pro", -apple-system, sans-serif`
- **代码/标签**: JetBrains Mono

### 空间系统
- 基础单位: 8px
- 页面最大宽度: 1400px
- 卡片圆角: 12px (整体保持锐利感但不过于生硬)
- 卡片内边距: 24px

### 动效哲学
- 入场动画: 元素从下方 fade + translate (400ms ease-out)
- 交错延迟: 每项 60ms 递增
- 悬停: 轻微上浮 + 边框高亮 (200ms)
- 页面切换: 淡入淡出 (300ms)
- 背景: 微妙的渐变动画 (20s 循环)

## 3. Layout & Structure

### 页面架构

```
/
├── index.html          # 主页 - 软件精选 + 关于
├── software.html       # 软件库 - 所有软件列表
├── software.html?id=X  # 软件详情 (URL参数)
├── sites.html          # 外站导航
├── admin/
│   ├── publish.html    # 发布软件 (不在主站暴露)
│   └── manage.html     # 管理软件
├── data/
│   └── software.json   # 软件数据
├── css/
│   └── style.css       # 全局样式
└── js/
    └── app.js          # 全局脚本
```

### 侧边栏导航 (所有页面)
- 左侧固定侧边栏 (宽度 260px)
- 内容：
  - Logo: "AY" 简洁文字标识
  - 导航链接: 首页 / 软件库 / 外站导航 / 关于
  - 分隔线
  - 外站快捷链接区域（可编辑的网站导航）

### 响应式策略
- 桌面 (>1024px): 侧边栏固定显示
- 平板/手机 (<1024px): 侧边栏隐藏，汉堡按钮触发抽屉式

## 4. Features & Interactions

### 首页 (index.html)
- Hero 区域: 大标题 + 一句话描述
- 精选软件区: 3-4 个置顶/最新软件卡片，横向滚动
- 统计数字: 软件总数、分类数
- 快速分类入口: 软件/工具/其他
- 底部关于简介

### 软件库 (software.html)
- 顶部搜索框 + 分类筛选
- 软件卡片网格 (每行 3-4 个)
- 卡片显示: 封面图、标题、简介、分类标签、下载按钮
- 点击卡片 → 软件详情页
- 分页或无限滚动

### 软件详情 (software.html?id=X)
- 大封面图 (可多张轮播)
- 软件名称 + 版本/大小
- 详细介绍 (Markdown 渲染)
- 截图预览区 (网格展示)
- 网盘下载链接区 (多个网盘选项)
- 相关推荐 (同类软件)
- 返回列表按钮

### 外站导航 (sites.html)
- 网站分类网格
- 每个网站: Logo/图标 + 名称 + 简介 + 链接
- 分类: 开发工具 / 设计工具 / 效率工具 / 学习资源 / 其他

### 发布页 (admin/publish.html)
- 完整表单: 标题、简介、详情、封面图、截图、网盘链接
- 支持多张图片上传
- 支持多个网盘链接
- 实时预览
- 提交后跳转 GitHub Issue

### 管理页 (admin/manage.html)
- 软件列表 (卡片形式)
- 搜索 + 筛选
- 每个软件: 编辑 / 置顶 / 删除 按钮
- 统计面板

## 5. Component Inventory

### 导航卡片 (NavCard)
- 默认: 深灰背景，浅灰文字
- 悬停: 边框变强调绿，轻微上浮

### 软件卡片 (SoftwareCard)
- 封面图 (16:9 比例，object-fit cover)
- 标题 (白色，粗体)
- 简介 (灰色，2行截断)
- 分类标签 (小标签，绿色文字)
- 悬停: 整体上浮，图片轻微放大

### 按钮 (Button)
- Primary: 绿色背景，白色文字
- Secondary: 透明背景，绿色边框，绿色文字
- Ghost: 透明背景，灰色文字
- 悬停: 所有按钮都有背景色变化和轻微放大

### 输入框 (Input)
- 深灰背景 (#1a1a1a)
- 浅灰边框 (#333)
- 聚焦: 绿色边框
- Placeholder: 深灰色

### 标签 (Tag)
- 小号，圆角
- 绿色边框，绿色文字
- 或: 深灰背景，白色文字

### 模态框 (Modal)
- 深黑背景遮罩 (rgba(0,0,0,0.8))
- 卡片式弹窗
- 关闭按钮右上角

## 6. Technical Approach

### 前端架构
- 纯静态 HTML/CSS/JS
- 无框架依赖
- CSS 变量管理主题
- ES6 模块化 JS

### 数据管理
- `data/software.json` 作为单一数据源
- 所有页面通过 fetch 加载数据
- URL 参数传递软件 ID

### GitHub Actions 工作流
- Issue 事件触发同步脚本
- 脚本解析 Issue 内容
- 更新 software.json
- 自动部署

### 数据模型
```json
{
  "id": "software-unique-id",
  "title": "软件名称",
  "slug": "software-slug",
  "category": "软件",
  "version": "1.0.0",
  "size": "666 MB",
  "cover": "https://...",
  "images": ["url1", "url2"],
  "desc": "简短描述",
  "content": "详细介绍（支持换行）",
  "drives": [
    {"name": "百度网盘", "url": "https://...", "code": "xxxx"}
  ],
  "tags": ["标签1", "标签2"],
  "featured": false,
  "pinned": false,
  "createdAt": "2026-01-01"
}
```

### 分类系统
- 软件 (主分类)
- 工具
- 游戏
- 其他

### 外站导航数据结构
```json
{
  "categories": [
    {
      "name": "开发工具",
      "sites": [
        {"name": "GitHub", "url": "https://github.com", "desc": "...", "icon": "..."}
      ]
    }
  ]
}
```
