export interface Me {
  login: string;
  name: string;
  avatar: string;
  csrf: string;
}

export interface SocialLink {
  label: string;
  href: string;
}

export interface SiteSettings {
  name: string;
  subtitle: string;
  description: string;
  logo: string;
  icon?: string;
  domain: string;
  announcement?: string;
  intro?: string;
  footerText: string;
  copyright: string;
  contact: string;
  icp: string;
  defaultCover: string;
  social: SocialLink[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
  };
}

export interface Resource {
  name: string;
  channel: string;
  updated: string;
  summary: string;
  url: string;
  code: string;
  password: string;
  instructions: string;
  buttonText: string;
  visible: boolean;
}

export interface Post {
  slug: string;
  title: string;
  subtitle: string;
  description: string;
  cover: string;
  category: string;
  tags: string[];
  date: string;
  body: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  featured: boolean;
  pinned: boolean;
  pinnedHome: boolean;
  pinnedCategory: boolean;
  hotPinned: boolean;
  draft: boolean;
  resources: Resource[];
  sha?: string;
}

export interface Page {
  slug: string;
  title: string;
  description: string;
  date: string;
  updated: string;
  seoTitle: string;
  seoDescription: string;
  keywords: string[];
  showInNav: boolean;
  draft: boolean;
  order: number;
  body: string;
  sha?: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string;
  description: string;
  cover: string;
  order: number;
  visible: boolean;
  seoTitle?: string;
  seoDescription?: string;
}

export interface Tag {
  id: string;
  name: string;
  slug: string;
  description?: string;
}

export interface NavItem {
  id: string;
  label: string;
  href: string;
  external: boolean;
  order: number;
  visible: boolean;
  parent: string | null;
}

export interface HomeModule {
  id: string;
  type: string;
  title: string;
  visible: boolean;
  limit?: number;
  text?: string;
  links?: { label: string; href: string }[];
}

export interface HomeConfig {
  announcement: { text: string; link: string; visible: boolean };
  hero: { title: string; subtitle: string; image: string; visible: boolean };
  slides: { id: string; image: string; title: string; link: string; visible: boolean }[];
  featured: string[];
  modules: HomeModule[];
  footer?: string;
  categories?: string[];
}

export interface TrashItem {
  id: string;
  title: string;
  originalPath: string;
  type: string;
  slug: string;
  deletedAt: string;
  sha?: string;
}

export interface MediaItem {
  path: string;
  name: string;
  size: number;
  url: string;
  sha?: string;
}

export interface StatusInfo {
  storeKind: string;
  repo: string;
  branch: string;
  repoInfo: {
    fullName: string;
    private: boolean;
    defaultBranch: string;
    pushedAt: string;
    htmlUrl: string;
  } | null;
  repoError?: string;
  commits: { sha: string; message: string; date: string; author: string }[];
  commitsError?: string;
  actions: {
    available: boolean;
    runs: {
      id: number;
      name: string;
      status: string;
      conclusion: string;
      createdAt: string;
      updatedAt: string;
      url: string;
      headSha: string;
    }[];
  };
  actionsError?: string;
}

export interface Bootstrap {
  me: Me;
  site: SiteSettings;
  siteSha: string | null;
  home: HomeConfig;
  homeSha: string | null;
  categories: Category[];
  categoriesSha: string | null;
  tags: Tag[];
  tagsSha: string | null;
  nav: NavItem[];
  navSha: string | null;
  posts: Post[];
  pages: Page[];
  trash: TrashItem[];
  media: MediaItem[];
  status: StatusInfo;
  downloadCounts: Record<string, number>;
  downloadSource: string;
}
