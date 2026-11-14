import { useCallback, useEffect, useState } from 'react';
import { api, setCsrf } from './api';
import { DataContext } from './context';
import type { Bootstrap, Me } from './types';
import { MENU, Shell } from './components/Shell';
import { Loading, useHashRoute, useToast } from './components/ui';
import { Login, devLogin } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { PostsPage } from './pages/Posts';
import { PostEdit } from './pages/PostEdit';
import { CategoriesPage } from './pages/Categories';
import { TagsPage } from './pages/Tags';
import { NavPage } from './pages/NavPage';
import { HomePage } from './pages/HomePage';
import { PagesPage } from './pages/PagesPage';
import { PageEdit } from './pages/PageEdit';
import { MediaPage } from './pages/MediaPage';
import { ResourcesPage } from './pages/ResourcesPage';
import { SettingsPage } from './pages/SettingsPage';
import { SeoPage } from './pages/SeoPage';
import { TrashPage } from './pages/TrashPage';
import { HistoryPage } from './pages/HistoryPage';
import { StatusPage } from './pages/StatusPage';
import { AccountPage } from './pages/AccountPage';

function routeTitle(route: string) {
  if (route === '/posts/new') return '新建文章';
  if (route.startsWith('/posts/')) return '编辑文章';
  if (route === '/pages/new') return '新建页面';
  if (route.startsWith('/pages/')) return '编辑页面';
  const match = MENU.find((item) => item.path === route);
  return match ? match.label : '工作台';
}

export default function App() {
  const [ready, setReady] = useState(false);
  const [me, setMe] = useState<Me | null>(null);
  const [data, setData] = useState<Bootstrap | null>(null);
  const [configured, setConfigured] = useState(false);
  const [devLoginEnabled, setDevLoginEnabled] = useState(false);
  const [error, setError] = useState('');
  const route = useHashRoute();
  const toast = useToast();

  const loadSession = useCallback(async () => {
    const session = await api<{ me: Me | null; configured: boolean; devLogin: boolean }>('session');
    setConfigured(session.configured);
    setDevLoginEnabled(session.devLogin);
    if (session.me) {
      setCsrf(session.me.csrf);
      setMe(session.me);
    } else {
      setMe(null);
      setData(null);
    }
    return session.me;
  }, []);

  const refresh = useCallback(async () => {
    const result = await api<Bootstrap>('bootstrap');
    setCsrf(result.me.csrf);
    setMe(result.me);
    setData(result);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const current = await loadSession();
        if (current) await refresh();
      } catch (err: any) {
        setError(err.message || '无法连接后台接口');
      } finally {
        setReady(true);
      }
    })();
  }, [loadSession, refresh]);

  useEffect(() => {
    const handler = () => {
      setMe(null);
      setData(null);
      toast('登录已过期，请重新登录', 'error');
    };
    window.addEventListener('cms-auth-expired', handler);
    return () => window.removeEventListener('cms-auth-expired', handler);
  }, [toast]);

  const handleLogout = async () => {
    try {
      await api('auth/logout', { method: 'POST' });
    } catch {
      /* 忽略退出失败 */
    }
    setMe(null);
    setData(null);
  };

  if (!ready) return <Loading text="正在连接后台…" />;

  if (!me) {
    return (
      <Login
        configured={configured}
        devLogin={devLoginEnabled}
        error={error}
        onDevLogin={async () => {
          await devLogin();
          const current = await loadSession();
          if (current) await refresh();
        }}
      />
    );
  }

  if (!data) return <Loading text="正在读取网站数据…" />;

  let page = <Dashboard />;
  if (route === '/posts') page = <PostsPage />;
  else if (route === '/posts/new') page = <PostEdit key="new" slug="new" />;
  else if (route.startsWith('/posts/')) page = <PostEdit key={route} slug={decodeURIComponent(route.slice(7))} />;
  else if (route === '/categories') page = <CategoriesPage />;
  else if (route === '/tags') page = <TagsPage />;
  else if (route === '/nav') page = <NavPage />;
  else if (route === '/home') page = <HomePage />;
  else if (route === '/pages') page = <PagesPage />;
  else if (route === '/pages/new') page = <PageEdit key="new-page" slug="new" />;
  else if (route.startsWith('/pages/')) page = <PageEdit key={route} slug={decodeURIComponent(route.slice(7))} />;
  else if (route === '/media') page = <MediaPage />;
  else if (route === '/resources') page = <ResourcesPage />;
  else if (route === '/settings') page = <SettingsPage />;
  else if (route === '/seo') page = <SeoPage />;
  else if (route === '/trash') page = <TrashPage />;
  else if (route === '/history') page = <HistoryPage />;
  else if (route === '/status') page = <StatusPage />;
  else if (route === '/account') page = <AccountPage />;

  return (
    <DataContext.Provider value={{ data, me, refresh }}>
      <Shell route={route} title={routeTitle(route)} me={me} onLogout={handleLogout}>
        {page}
      </Shell>
    </DataContext.Provider>
  );
}
