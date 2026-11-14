import { useEffect, useRef, useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import type { Page } from '../types';
import { RichEditor, markdownToHtml } from '../components/RichEditor';
import { navigate, useConfirm, useToast } from '../components/ui';

function emptyPage(): Page {
  const now = new Date().toISOString();
  return {
    slug: '',
    title: '',
    description: '',
    date: now,
    updated: now,
    seoTitle: '',
    seoDescription: '',
    keywords: [],
    showInNav: false,
    draft: true,
    order: 0,
    body: '',
  };
}

export function PageEdit({ slug }: { slug: string }) {
  const { data } = useData();
  const isNew = slug === 'new';
  const original = isNew ? null : data.pages.find((item) => item.slug === slug) || null;

  if (!isNew && !original) {
    return (
      <div className="card">
        <div className="empty">
          <div className="icon">😵</div>
          <p>找不到这个页面。</p>
          <button className="btn btn-primary" onClick={() => navigate('/pages')}>
            返回页面列表
          </button>
        </div>
      </div>
    );
  }

  return <PageEditor key={slug} slug={slug} original={original} />;
}

function PageEditor({ slug, original }: { slug: string; original: Page | null }) {
  const { refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = slug === 'new';
  const [page, setPage] = useState<Page>(() => (original ? { ...original } : emptyPage()));
  const [saving, setSaving] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [error, setError] = useState('');
  const [savedAt, setSavedAt] = useState('');
  const backupKey = `cms-page-${isNew ? 'new' : slug}`;
  const initial = useRef(JSON.stringify(original || emptyPage()));
  const dirty = JSON.stringify(page) !== initial.current;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(backupKey, JSON.stringify(page));
        setSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
      } catch {
        /* ignore */
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [page, backupKey]);

  const update = <K extends keyof Page>(key: K, value: Page[K]) => setPage((prev) => ({ ...prev, [key]: value }));

  const save = async (publish?: boolean) => {
    if (!page.title.trim()) {
      setError('请填写页面标题');
      return;
    }
    const next = { ...page, draft: publish === undefined ? page.draft : !publish };
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const result = await api<{ slug: string }>('pages', {
          method: 'POST',
          body: { page: next, slug: next.slug || next.title },
        });
        localStorage.removeItem(backupKey);
        toast('页面已创建并同步到 GitHub', 'success');
        await refresh();
        navigate(`/pages/${result.slug}`);
      } else {
        const result = await api<{ slug: string; sha: string }>(`pages/${slug}`, {
          method: 'PUT',
          body: { page: next, sha: page.sha, newSlug: next.slug || slug },
        });
        localStorage.removeItem(backupKey);
        toast('页面已保存并同步到 GitHub', 'success');
        await refresh();
        if (result.slug !== slug) navigate(`/pages/${result.slug}`);
        else {
          const saved = { ...next, sha: result.sha };
          initial.current = JSON.stringify(saved);
          setPage(saved);
        }
      }
    } catch (err: any) {
      setError(err.message || '保存失败');
      toast(err.message || '保存失败', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isNew) {
      navigate('/pages');
      return;
    }
    const ok = await confirm({
      title: '删除页面',
      message: `确定把「${page.title}」移入回收站吗？`,
      confirmText: '移入回收站',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`pages/${slug}`, { method: 'DELETE' });
      localStorage.removeItem(backupKey);
      await refresh();
      toast('页面已移入回收站', 'success');
      navigate('/pages');
    } catch (err: any) {
      toast(err.message || '删除失败', 'error');
    }
  };

  return (
    <div className="stack">
      {error && <div className="alert error">{error}</div>}
      <div className="card">
        <div className="card-head">
          <h2>{isNew ? '新建页面' : '编辑页面'}</h2>
          {dirty && <span className="badge orange">未保存</span>}
          {savedAt && <span className="muted">本机自动保存：{savedAt}</span>}
        </div>
        <div className="card-body stack">
          <div className="grid-2">
            <div className="field">
              <label>页面标题 *</label>
              <input className="input" value={page.title} onChange={(event) => update('title', event.target.value)} />
            </div>
            <div className="field">
              <label>页面 URL（留空自动生成）</label>
              <input
                className="input"
                placeholder="about"
                value={page.slug}
                onChange={(event) => update('slug', event.target.value)}
              />
            </div>
          </div>
          <div className="field">
            <label>页面简介</label>
            <textarea
              className="textarea"
              value={page.description}
              onChange={(event) => update('description', event.target.value)}
            />
          </div>
          <div className="grid-2">
            <div className="field">
              <label>排序（数字越小越靠前）</label>
              <input
                className="input"
                type="number"
                value={page.order}
                onChange={(event) => update('order', Number(event.target.value))}
              />
            </div>
            <div className="row" style={{ alignItems: 'flex-end', gap: 16 }}>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={page.showInNav}
                  onChange={(event) => update('showInNav', event.target.checked)}
                />
                在导航中显示
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={page.draft} onChange={(event) => update('draft', event.target.checked)} />
                保存为草稿
              </label>
            </div>
          </div>
          <div className="grid-2">
            <div className="field">
              <label>SEO 标题</label>
              <input className="input" value={page.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} />
            </div>
            <div className="field">
              <label>SEO 描述</label>
              <input
                className="input"
                value={page.seoDescription}
                onChange={(event) => update('seoDescription', event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      <div>
        <h2 style={{ fontSize: 15, margin: '4px 0 10px' }}>页面内容</h2>
        <RichEditor value={page.body} onChange={(value) => update('body', value)} placeholder="写页面的内容…" />
      </div>

      <div className="card">
        <div className="sticky-actions" style={{ borderRadius: 12 }}>
          <button className="btn" onClick={() => navigate('/pages')}>
            返回列表
          </button>
          <button className="btn" onClick={() => setPreviewOpen(true)}>
            预览
          </button>
          {!isNew && (
            <button className="btn btn-danger" onClick={remove}>
              删除
            </button>
          )}
          <button className="btn" onClick={() => save()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button className="btn btn-primary" onClick={() => save(true)} disabled={saving}>
            保存并发布
          </button>
        </div>
      </div>

      {previewOpen && (
        <div className="modal-mask" onClick={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <div className="modal wide">
            <div className="modal-head">
              <span>页面预览</span>
              <button className="btn btn-sm" onClick={() => setPreviewOpen(false)}>
                关闭
              </button>
            </div>
            <div className="modal-body preview-body">
              <h1 style={{ marginTop: 0 }}>{page.title}</h1>
              <div dangerouslySetInnerHTML={{ __html: markdownToHtml(page.body) }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
