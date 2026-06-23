export interface Post {
  id: string;
  title: string;
  description: string;
  pubDate: string;
  updatedDate?: string;
  category: string;
  categoryColor: string;
  tags: string[];
  isFeatured: boolean;
  isDraft: boolean;
  downloadUrl: string;
  content: string;
}

export const categories = [
  { name: '绿化软件', color: '#10B981' },
  { name: '影视动漫', color: '#8B5CF6' },
  { name: 'PC工具', color: '#3B82F6' },
  { name: '游戏相关', color: '#F59E0B' },
  { name: '实用教程', color: '#EF4444' },
];

export const posts: Post[] = [
  {
    id: 'featured-resource',
    title: '【强烈推荐】2024年度精品软件合集',
    description: '精选本年度最实用的10款绿化软件，涵盖办公、设计、开发等多个领域，全部免费可用。',
    pubDate: '2024-01-20',
    category: '绿化软件',
    categoryColor: '#10B981',
    tags: ['推荐', '合集', '精品'],
    isFeatured: true,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/abc123',
    content: `## 资源介绍

本年度精选合集包含以下软件：

### 办公效率
- **Office 2024** - 完整办公套件
- **PDF编辑器** - 专业PDF处理工具

### 设计工具
- **Photoshop 2024** - 图像处理神器
- **Figma** - 在线设计协作工具

### 开发工具
- **VS Code** - 代码编辑器
- **Git** - 版本控制工具

## 下载地址

> [点击下载](https://pan.example.com/s/abc123)

**提取码**: 6666

## 注意事项

- 部分软件需要关闭杀毒软件后解压
- 建议使用最新版本的解压工具
- 如有问题请在评论区反馈`
  },
  {
    id: 'green-software-1',
    title: '【绿化版】Adobe Photoshop 2024 中文版',
    description: '最新版PS绿化版，免安装免激活，解压即可使用，功能完整无限制。',
    pubDate: '2024-01-18',
    category: '绿化软件',
    categoryColor: '#10B981',
    tags: ['Photoshop', '设计', '图片处理'],
    isFeatured: false,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/def456',
    content: `## 软件介绍

Adobe Photoshop 2024 是一款专业的图像处理软件，广泛应用于平面设计、摄影后期等领域。

### 主要功能
- 强大的图像编辑工具
- 丰富的滤镜和效果
- 支持多种格式导入导出
- 智能对象和图层管理

## 下载地址

> [点击下载](https://pan.example.com/s/def456)

**提取码**: 8888

## 安装说明

1. 下载后解压到任意目录
2. 双击运行 Photoshop.exe
3. 无需安装，直接使用`
  },
  {
    id: 'video-anime-1',
    title: '【4K超清】2024新番动漫合集',
    description: '精选2024年热门新番，包含进击的巨人最终季、咒术回战第二季等热门作品。',
    pubDate: '2024-01-15',
    category: '影视动漫',
    categoryColor: '#8B5CF6',
    tags: ['动漫', '4K', '新番'],
    isFeatured: false,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/ghi789',
    content: `## 资源介绍

2024年新番动漫合集，包含多部热门作品：

### 包含作品
- **进击的巨人 最终季** - 完结篇
- **咒术回战 第二季** - 怀玉·玉折篇
- **鬼灭之刃 第三季** - 刀匠村篇
- **间谍过家家 第二季** - 继续冒险

## 下载地址

> [点击下载](https://pan.example.com/s/ghi789)

**提取码**: 9999

## 说明

- 全部为4K超清画质
- 内嵌中文字幕
- 支持多种播放器`
  },
  {
    id: 'pc-tool-1',
    title: '【神器】Everything 文件搜索工具',
    description: '最快的文件搜索工具，秒级定位电脑中的任何文件，效率提升神器。',
    pubDate: '2024-01-12',
    category: 'PC工具',
    categoryColor: '#3B82F6',
    tags: ['工具', '搜索', '效率'],
    isFeatured: false,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/jkl012',
    content: `## 软件介绍

Everything 是一款超快的文件搜索工具，可以在几秒钟内搜索整个硬盘。

### 主要特点
- 闪电般的搜索速度
- 支持正则表达式
- 小巧轻便，不占资源
- 支持快捷键操作

## 下载地址

> [点击下载](https://pan.example.com/s/jkl012)

**提取码**: 1111

## 使用技巧

- 按 Ctrl+E 快速打开搜索框
- 支持模糊搜索和通配符
- 可以自定义快捷键`
  },
  {
    id: 'game-1',
    title: '【大型游戏】艾尔登法环 中文版',
    description: '魂系大作艾尔登法环完整中文版，包含全部DLC，完美运行。',
    pubDate: '2024-01-10',
    category: '游戏相关',
    categoryColor: '#F59E0B',
    tags: ['游戏', 'RPG', '开放世界'],
    isFeatured: false,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/mno345',
    content: `## 游戏介绍

艾尔登法环是FromSoftware开发的一款开放世界魂系RPG游戏。

### 游戏特色
- 广阔的开放世界
- 深度的战斗系统
- 丰富的角色养成
- 多个结局可供探索

## 下载地址

> [点击下载](https://pan.example.com/s/mno345)

**提取码**: 2222

## 配置要求

- 操作系统: Windows 10/11
- 处理器: Intel i5-8400
- 内存: 16GB RAM
- 显卡: GTX 1070`
  },
  {
    id: 'tutorial-1',
    title: '【教程】网盘资源搜索技巧大全',
    description: '分享高效搜索网盘资源的技巧和方法，让你轻松找到想要的资源。',
    pubDate: '2024-01-08',
    category: '实用教程',
    categoryColor: '#EF4444',
    tags: ['教程', '技巧', '搜索'],
    isFeatured: false,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/pqr678',
    content: `## 教程介绍

网盘资源搜索是一项非常实用的技能，掌握这些技巧可以大大提高搜索效率。

### 搜索技巧
1. **关键词组合** - 使用多个关键词精确搜索
2. **site语法** - 限定特定网站搜索
3. **文件格式** - 指定文件类型搜索
4. **时间限定** - 搜索最新资源

### 常用搜索引擎
- **百度搜索** - 综合搜索
- **Bing搜索** - 国际搜索
- **网盘搜索** - 专用网盘搜索引擎

## 实用工具

> [点击下载](https://pan.example.com/s/pqr678)

**提取码**: 3333

## 注意事项

- 注意资源的安全性
- 遵守相关法律法规
- 支持正版资源`
  },
  {
    id: 'green-software-2',
    title: '【绿化版】Microsoft Office 2024',
    description: 'Office 2024完整绿化版，包含Word、Excel、PowerPoint等全部组件。',
    pubDate: '2024-01-05',
    category: '绿化软件',
    categoryColor: '#10B981',
    tags: ['Office', '办公', '套件'],
    isFeatured: false,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/stu901',
    content: `## 软件介绍

Microsoft Office 2024 是微软最新的办公套件，包含以下组件：

### 组件列表
- **Word** - 文字处理
- **Excel** - 电子表格
- **PowerPoint** - 演示文稿
- **Outlook** - 邮件管理

## 下载地址

> [点击下载](https://pan.example.com/s/stu901)

**提取码**: 4444

## 使用说明

1. 解压到任意目录
2. 运行激活工具
3. 完成后即可使用`
  },
  {
    id: 'video-anime-2',
    title: '【蓝光原盘】经典电影收藏合集',
    description: '精选100部经典电影蓝光原盘资源，包含奥斯卡获奖影片、经典大片等。',
    pubDate: '2024-01-03',
    category: '影视动漫',
    categoryColor: '#8B5CF6',
    tags: ['电影', '蓝光', '经典'],
    isFeatured: false,
    isDraft: false,
    downloadUrl: 'https://pan.example.com/s/vwx234',
    content: `## 资源介绍

经典电影收藏合集，包含多种类型的经典影片：

### 分类目录
- **奥斯卡获奖影片** - 历年获奖作品
- **动作大片** - 精彩动作电影
- **喜剧电影** - 轻松搞笑影片
- **科幻电影** - 经典科幻巨作

## 下载地址

> [点击下载](https://pan.example.com/s/vwx234)

**提取码**: 5555

## 说明

- 蓝光原盘画质
- 多国语言字幕
- 支持蓝光播放器`
  }
];

export function getPosts() {
  return posts.filter(p => !p.isDraft);
}

export function getPostById(id: string) {
  return posts.find(p => p.id === id && !p.isDraft);
}

export function getCategories() {
  return categories;
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

export function getHotPosts() {
  return posts.filter(p => !p.isDraft).sort((a, b) => 
    new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  ).slice(0, 5);
}
