import siteData from '../../content/site.json';
import categoriesData from '../../content/categories.json';
import tagsData from '../../content/tags.json';
import navData from '../../content/nav.json';
import homeData from '../../content/home.json';

export interface SiteSettings {
  name: string;
  subtitle: string;
  description: string;
  logo: string;
  logoDark?: string;
  icon?: string;
  domain: string;
  announcement?: string;
  intro?: string;
  footerText: string;
  copyright: string;
  contact: string;
  icp: string;
  defaultCover: string;
  social: { label: string; href: string }[];
  seo: {
    title: string;
    description: string;
    keywords: string[];
    ogImage?: string;
  };
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

export interface HomeSettings {
  announcement: { text: string; link: string; visible: boolean };
  hero: { title: string; subtitle: string; image: string; visible: boolean };
  slides: { id: string; image: string; title: string; link: string; visible: boolean }[];
  featured: string[];
  modules: HomeModule[];
  footer?: string;
  categories?: string[];
}

const rawSite = (siteData || {}) as Partial<SiteSettings>;

export const site: SiteSettings = {
  name: rawSite.name || 'Aether Yard',
  subtitle: rawSite.subtitle || '',
  description: rawSite.description || '',
  logo: rawSite.logo || '/favicon.svg',
  logoDark: rawSite.logoDark || rawSite.logo || '/favicon.svg',
  icon: rawSite.icon || rawSite.logo || '/favicon.ico',
  domain: rawSite.domain || '',
  announcement: rawSite.announcement || '',
  intro: rawSite.intro || '',
  footerText: rawSite.footerText || '',
  copyright: rawSite.copyright || 'All rights reserved.',
  contact: rawSite.contact || '',
  icp: rawSite.icp || '',
  defaultCover: rawSite.defaultCover || '',
  social: Array.isArray(rawSite.social) ? rawSite.social : [],
  seo: {
    title: rawSite.seo?.title || rawSite.name || 'Aether Yard',
    description: rawSite.seo?.description || rawSite.description || '',
    keywords: Array.isArray(rawSite.seo?.keywords) ? rawSite.seo!.keywords : [],
    ogImage: rawSite.seo?.ogImage || '',
  },
};

export const allCategories: Category[] = Array.isArray(categoriesData) ? (categoriesData as Category[]) : [];

export const categories: Category[] = allCategories
  .filter((item) => item.visible)
  .sort((a, b) => a.order - b.order);

export const tags: Tag[] = Array.isArray(tagsData) ? (tagsData as Tag[]) : [];

export const navAll: NavItem[] = Array.isArray(navData) ? (navData as NavItem[]) : [];

export const nav: NavItem[] = navAll
  .filter((item) => item.visible && !item.parent)
  .sort((a, b) => a.order - b.order);

const rawHome = (homeData || {}) as Partial<HomeSettings>;

export const home: HomeSettings = {
  announcement: {
    text: rawHome.announcement?.text || '',
    link: rawHome.announcement?.link || '',
    visible: Boolean(rawHome.announcement?.visible),
  },
  hero: {
    title: rawHome.hero?.title || '',
    subtitle: rawHome.hero?.subtitle || '',
    image: rawHome.hero?.image || '',
    visible: rawHome.hero ? rawHome.hero.visible !== false : true,
  },
  slides: Array.isArray(rawHome.slides) ? rawHome.slides : [],
  featured: Array.isArray(rawHome.featured) ? rawHome.featured : [],
  categories: Array.isArray(rawHome.categories) ? rawHome.categories : [],
  footer: typeof rawHome.footer === 'string' ? rawHome.footer : '',
  modules: Array.isArray(rawHome.modules)
    ? rawHome.modules
    : [
        { id: 'latest', type: 'latest', title: '最新发布', visible: true, limit: 12 },
        { id: 'categories', type: 'categories', title: '内容分类', visible: true },
      ],
};

export function categoryBySlug(slug: string) {
  return allCategories.find((item) => item.slug === slug);
}

export function tagBySlug(slug: string) {
  return tags.find((item) => item.slug === slug);
}

export function navChildren(parentId: string) {
  return navAll
    .filter((item) => item.visible && item.parent === parentId)
    .sort((a, b) => a.order - b.order);
}
