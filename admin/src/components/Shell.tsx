import { useEffect, useState, type ReactNode } from 'react';
import { navigate } from './ui';

export const MENU: { path: string; label: string; icon: string }[] = [
  { path: '/', label: '工作台', icon: '🏠' },
  { path: '/posts', label: '文章管理', icon: '📝' },
  { path: '/categories', label: '分类管理', icon: '🗂' },
  { path: '/tags', label: '标签管理', icon: '🏷' },
  { path: '/nav', label: '导航管理', icon: '🧭' },
  { path: '/home', label: '首页管理', icon: '🖼' },
  { path: '/pages', label: '页面管理', icon: '📄' },
  { path: '/media', label: '媒体库', icon: '📷' },
  { path: '/resources', label: '资源管理', icon: '📦' },
  { path: '/downloads', label: '下载统计', icon: '📥' },
  { path: '/linkcheck', label: '链接检测', icon: '🔗' },
  { path: '/analytics', label: '访问统计', icon: '📈' },
  { path: '/backup', label: '数据备份', icon: '💾' },
  { path: '/settings', label: '网站设置', icon: '⚙️' },
  { path: '/seo', label: 'SEO 管理', icon: '🔍' },
  { path: '/trash', label: '回收站', icon: '🗑' },
  { path: '/history', label: '版本管理', icon: '🕘' },
  { path: '/status', label: '系统状态', icon: '📡' },
  { path: '/account', label: '账号与安全', icon: '🔐' },
];

export function isActive(route: string, path: string) {
  if (path === '/') return route === '/' || route === '';
  return route === path || route.startsWith(`${path}/`);
}

export function Shell({
  route,
  title,
  me,
  onLogout,
  children,
}: {
  route: string;
  title: string;
  me: { login: string; name: string; avatar: string };
  onLogout: () => void;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [route]);

  return (
    <div className="shell">
      {open && <div className="sidebar-mask" onClick={() => setOpen(false)} />}
      <aside className={`sidebar ${open ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <span className="badge-logo">⌘</span>
          <span>网站管理中心</span>
        </div>
        <nav className="sidebar-nav">
          {MENU.map((item) => (
            <button
              key={item.path}
              className={`sidebar-item ${isActive(route, item.path) ? 'active' : ''}`}
              onClick={() => {
                navigate(item.path);
                setOpen(false);
              }}
            >
              <span className="icon">{item.icon}</span>
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">
          <div style={{ marginBottom: 6 }}>{me.name || me.login}</div>
          <button className="link-btn" style={{ color: 'rgba(255,255,255,0.5)' }} onClick={onLogout}>
            退出登录
          </button>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="menu-toggle" onClick={() => setOpen(true)} aria-label="打开菜单">
            ☰
          </button>
          <div className="topbar-title">{title}</div>
          <a className="btn btn-sm" href="/" target="_blank" rel="noreferrer">
            查看网站 ↗
          </a>
          <div className="avatar" title={me.name || me.login}>
            {me.avatar ? <img src={me.avatar} alt={me.login} /> : (me.name || me.login || 'A').slice(0, 1)}
          </div>
        </header>
        <div className="content">{children}</div>
      </div>
    </div>
  );
}
