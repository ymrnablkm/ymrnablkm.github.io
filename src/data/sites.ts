export interface Site {
  name: string;
  url: string;
  description: string;
  category: string;
  icon?: string;
}

export const sites: Site[] = [
  {
    name: 'GitHub',
    url: 'https://github.com',
    description: '全球最大的代码托管平台',
    category: '开发工具',
    icon: 'https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png'
  },
  {
    name: 'Stack Overflow',
    url: 'https://stackoverflow.com',
    description: '程序员问答社区',
    category: '开发工具'
  },
  {
    name: 'CodePen',
    url: 'https://codepen.io',
    description: '前端代码在线演示平台',
    category: '开发工具',
    icon: 'https://cpwebassets.codepen.io/assets/packs/codepen-logo-a32d711142.svg'
  },
  {
    name: 'MDN Web Docs',
    url: 'https://developer.mozilla.org',
    description: '权威的Web技术文档',
    category: '学习资源'
  },
  {
    name: 'FreeCodeCamp',
    url: 'https://www.freecodecamp.org',
    description: '免费编程学习平台',
    category: '学习资源',
    icon: 'https://cdn.freecodecamp.org/platform/universal/fcc_primary.svg'
  },
  {
    name: 'DEV Community',
    url: 'https://dev.to',
    description: '开发者社区',
    category: '学习资源'
  }
];

export function getCategories() {
  return [...new Set(sites.map(s => s.category))];
}
