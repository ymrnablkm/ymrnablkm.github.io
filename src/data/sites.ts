export interface Site {
  name: string;
  url: string;
  description: string;
  category: string;
  icon?: string;
}

export const siteCategories = [
  { name: '资源网站', color: '#3B82F6' },
  { name: '工具网站', color: '#10B981' },
];

export const sites: Site[] = [
  {
    name: '阿里云盘',
    url: 'https://www.alipan.com',
    description: '不限速的云存储服务',
    category: '资源网站',
    icon: 'https://www.alipan.com/favicon.ico'
  },
  {
    name: '百度网盘',
    url: 'https://pan.baidu.com',
    description: '国内最大的云盘服务',
    category: '资源网站',
    icon: 'https://pan.baidu.com/favicon.ico'
  },
  {
    name: '夸克网盘',
    url: 'https://pan.quark.cn',
    description: '轻量极速的云存储',
    category: '资源网站',
    icon: 'https://pan.quark.cn/favicon.ico'
  },
  {
    name: '在线解压',
    url: 'https://www.extract.me',
    description: '在线解压各种压缩包',
    category: '工具网站'
  },
  {
    name: 'MD5在线加密',
    url: 'https://md5hashgenerator.com',
    description: '在线生成MD5哈希值',
    category: '工具网站'
  },
  {
    name: '图片压缩工具',
    url: 'https://compresspng.com',
    description: '在线压缩图片大小',
    category: '工具网站'
  }
];

export function getCategories() {
  return siteCategories;
}
