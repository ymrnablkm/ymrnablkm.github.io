import { useEffect, useRef, useState } from 'react';
import { api, formatDate } from '../api';
import { useData } from '../context';
import type { Post, Resource } from '../types';
import { MediaPicker } from '../components/MediaPicker';
import { RichEditor, markdownToHtml } from '../components/RichEditor';
import { navigate, useConfirm, useToast } from '../components/ui';

function emptyResource(index: number): Resource {
  return {
    name: `下载渠道 ${index + 1}`,
    channel: '',
    type: '',
    version: '',
    size: '',
    platform: '',
    language: '',
    updated: '',
    summary: '',
    url: '',
    code: '',
    password: '',
    instructions: '',
    buttonText: '',
    visible: true,
  };
}

function emptyPost(): Post {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  return {
    slug: '',
    title: '',
    subtitle: '',
    description: '',
    cover: '',
    category: '',
    tags: [],
    date: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`,
    author: '',
    body: '',
    seoTitle: '',
    seoDescription: '',
    keywords: [],
    featured: false,
    pinned: false,
    draft: true,
    resources: [],
  };
}

export function PostEdit({ slug }: { slug: string }) {
  const { data } = useData();
  const isNew = slug === 'new';
  const original = isNew ? null : data.posts.find((item) => item.slug === slug) || null;

  if (!isNew && !original) {
    return (
      <div className="card">
        <div className="empty">
          <div className="icon">😵</div>
          <p>找不到这篇文章，可能已被删除。</p>
          <button className="btn btn-primary" onClick={() => navigate('/posts')}>
            返回文章列表
          </button>
        </div>
      </div>
    );
  }

  return <PostEditor key={slug} slug={slug} original={original} />;
}

function PostEditor({ slug, original }: { slug: string; original: Post | null }) {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const isNew = slug === 'new';

  const [post, setPost] = useState<Post>(() => (original ? { ...original } : emptyPost()));
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  const [tagInput, setTagInput] = useState('');
  const [seoOpen, setSeoOpen] = useState(false);
  const [resourceOpen, setResourceOpen] = useState(false);
  const [autoSavedAt, setAutoSavedAt] = useState('');
  const [backup, setBackup] = useState<Post | null>(null);
  const initialSnapshot = useRef(JSON.stringify(original || emptyPost()));
  const dirty = JSON.stringify(post) !== initialSnapshot.current;
  const backupKey = `cms-post-${isNew ? 'new' : slug}`;

  useEffect(() => {
    try {
      const raw = localStorage.getItem(backupKey);
      if (!raw) return;
      const saved = JSON.parse(raw);
      if (saved && JSON.stringify(saved) !== initialSnapshot.current) setBackup(saved);
    } catch {
      /* 忽略损坏的本地备份 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      try {
        localStorage.setItem(backupKey, JSON.stringify(post));
        setAutoSavedAt(new Date().toLocaleTimeString('zh-CN', { hour12: false }));
      } catch {
        /* 本地存储已满时忽略 */
      }
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [post, backupKey]);

  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = <K extends keyof Post>(key: K, value: Post[K]) => setPost((prev) => ({ ...prev, [key]: value }));

  const updateResource = (index: number, key: keyof Resource, value: any) => {
    setPost((prev) => {
      const resources = prev.resources.map((item, i) => (i === index ? { ...item, [key]: value } : item));
      return { ...prev, resources };
    });
  };

  const save = async (publish?: boolean) => {
    if (!post.title.trim()) {
      setError('请先填写文章标题。');
      toast('请先填写文章标题', 'error');
      return;
    }
    if (publish && post.body.trim().length < 10) {
      setError('正文内容太短，至少写一点内容再发布。');
      toast('正文内容太短，无法发布', 'error');
      return;
    }
    const nextPost = { ...post, draft: publish === undefined ? post.draft : !publish };
    setSaving(true);
    setError('');
    try {
      if (isNew) {
        const result = await api<{ slug: string }>('posts', {
          method: 'POST',
          body: { post: nextPost, slug: nextPost.slug || nextPost.title },
        });
        localStorage.removeItem(backupKey);
        toast('文章已创建并同步到 GitHub', 'success');
        await refresh();
        navigate(`/posts/${result.slug}`);
      } else {
        const result = await api<{ slug: string; sha: string }>(`posts/${slug}`, {
          method: 'PUT',
          body: { post: nextPost, sha: post.sha, newSlug: nextPost.slug || slug },
        });
        localStorage.removeItem(backupKey);
        toast('已保存并同步到 GitHub', 'success');
        await refresh();
        if (result.slug !== slug) navigate(`/posts/${result.slug}`);
        else {
          const saved = { ...nextPost, sha: result.sha };
          initialSnapshot.current = JSON.stringify(saved);
          setPost(saved);
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
      navigate('/posts');
      return;
    }
    const ok = await confirm({
      title: '移入回收站',
      message: `确定把《${post.title}》移入回收站吗？可以在回收站中恢复。`,
      confirmText: '移入回收站',
      danger: true,
    });
    if (!ok) return;
    try {
      await api(`posts/${slug}`, { method: 'DELETE' });
      localStorage.removeItem(backupKey);
      toast('已移入回收站', 'success');
      await refresh();
      navigate('/posts');
    } catch (err: any) {
      toast(err.message || '删除失败', 'error');
    }
  };

  const addTag = (value: string) => {
    const tag = value.trim();
    if (!tag || post.tags.includes(tag)) return;
    update('tags', [...post.tags, tag]);
    setTagInput('');
  };

  const coverUrl = post.cover;

  return (
    <div className="stack">
      {backup && (
        <div className="alert">
          <div className="row-between">
            <span>发现上次未保存的本地草稿（自动保存于本机）。</span>
            <div className="row">
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  setPost(backup);
                  setBackup(null);
                  toast('已恢复本地草稿', 'success');
                }}
              >
                恢复草稿
              </button>
              <button
                className="btn btn-sm"
                onClick={() => {
                  localStorage.removeItem(backupKey);
                  setBackup(null);
                }}
              >
                忽略
              </button>
            </div>
          </div>
        </div>
      )}

      {error && <div className="alert error">{error}</div>}

      <div className="card">
        <div className="card-head">
          <h2>{isNew ? '新建文章' : '编辑文章'}</h2>
          <span className={`badge ${post.draft ? 'gray' : 'green'}`}>{post.draft ? '草稿' : '已发布'}</span>
          {dirty && <span className="badge orange">未保存</span>}
          {autoSavedAt && <span className="muted">本机自动保存：{autoSavedAt}</span>}
        </div>
        <div className="card-body">
          <div className="stack">
            <div className="field">
              <label>文章标题 *</label>
              <input
                className="input"
                value={post.title}
                placeholder="例如：2026 年最值得收藏的效率工具合集"
                onChange={(event) => update('title', event.target.value)}
              />
            </div>

            <div className="grid-2">
              <div className="field">
                <label>副标题</label>
                <input className="input" value={post.subtitle} onChange={(event) => update('subtitle', event.target.value)} />
              </div>
              <div className="field">
                <label>文章 URL（留空自动生成）</label>
                <input
                  className="input"
                  value={post.slug}
                  placeholder="例如：best-tools-2026"
                  onChange={(event) => update('slug', event.target.value)}
                />
              </div>
            </div>

            <div className="field">
              <label>文章简介</label>
              <textarea
                className="textarea"
                value={post.description}
                placeholder="一句话介绍这篇文章，会显示在列表和搜索引擎摘要中"
                onChange={(event) => update('description', event.target.value)}
              />
            </div>

            <div className="field">
              <label>封面图片</label>
              <div className="row">
                <input
                  className="input"
                  style={{ flex: 1, minWidth: 180 }}
                  value={post.cover}
                  placeholder="图片地址，例如 /images/2026/11/cover.webp"
                  onChange={(event) => update('cover', event.target.value)}
                />
                <button className="btn" type="button" onClick={() => setPickerOpen(true)}>
                  选择图片
                </button>
                {coverUrl && (
                  <button className="btn btn-danger" type="button" onClick={() => update('cover', '')}>
                    移除
                  </button>
                )}
              </div>
              {coverUrl && (
                <img
                  src={coverUrl}
                  alt="封面预览"
                  style={{ marginTop: 8, maxHeight: 180, borderRadius: 10, objectFit: 'cover' }}
                />
              )}
            </div>

            <div className="grid-2">
              <div className="field">
                <label>分类</label>
                <select className="select" value={post.category} onChange={(event) => update('category', event.target.value)}>
                  <option value="">未分类</option>
                  {data.categories.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.icon} {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>发布时间</label>
                <input
                  className="input"
                  type="datetime-local"
                  value={post.date.slice(0, 16)}
                  onChange={(event) => update('date', event.target.value)}
                />
              </div>
            </div>

            <div className="grid-2">
              <div className="field">
                <label>作者</label>
                <input className="input" value={post.author} onChange={(event) => update('author', event.target.value)} />
              </div>
              <div className="field">
                <label>标签（输入后回车添加）</label>
                <div className="row" style={{ gap: 6 }}>
                  <input
                    className="input"
                    style={{ flex: 1, minWidth: 120 }}
                    value={tagInput}
                    placeholder="例如：效率工具"
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ',') {
                        event.preventDefault();
                        addTag(tagInput);
                      }
                    }}
                  />
                  <button className="btn btn-sm" type="button" onClick={() => addTag(tagInput)}>
                    添加
                  </button>
                </div>
                <div className="row" style={{ gap: 6, marginTop: 6 }}>
                  {post.tags.map((tag) => (
                    <span className="tag-chip" key={tag}>
                      {tag}
                      <button type="button" onClick={() => update('tags', post.tags.filter((item) => item !== tag))}>
                        ✕
                      </button>
                    </span>
                  ))}
                  {data.tags
                    .filter((item) => !post.tags.includes(item.slug) && !post.tags.includes(item.name))
                    .slice(0, 8)
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        className="tag-chip"
                        style={{ cursor: 'pointer', border: 'none' }}
                        onClick={() => addTag(item.slug)}
                      >
                        ＋ {item.name}
                      </button>
                    ))}
                </div>
              </div>
            </div>

            <div className="row" style={{ gap: 18 }}>
              <label className="checkbox">
                <input type="checkbox" checked={post.pinned} onChange={(event) => update('pinned', event.target.checked)} />
                置顶文章
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={post.featured} onChange={(event) => update('featured', event.target.checked)} />
                推荐到首页
              </label>
              <label className="checkbox">
                <input type="checkbox" checked={post.draft} onChange={(event) => update('draft', event.target.checked)} />
                保存为草稿（不在前台显示）
              </label>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>SEO 设置</h2>
          <button className="link-btn" onClick={() => setSeoOpen((value) => !value)}>
            {seoOpen ? '收起' : '展开'}
          </button>
        </div>
        {seoOpen && (
          <div className="card-body stack">
            <div className="field">
              <label>SEO 标题</label>
              <input className="input" value={post.seoTitle} onChange={(event) => update('seoTitle', event.target.value)} />
            </div>
            <div className="field">
              <label>SEO 描述</label>
              <textarea
                className="textarea"
                value={post.seoDescription}
                onChange={(event) => update('seoDescription', event.target.value)}
              />
            </div>
            <div className="field">
              <label>关键词（逗号分隔）</label>
              <input
                className="input"
                value={post.keywords.join(',')}
                onChange={(event) =>
                  update(
                    'keywords',
                    event.target.value
                      .split(/[,，]/)
                      .map((item) => item.trim())
                      .filter(Boolean)
                  )
                }
              />
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div className="card-head">
          <h2>资源下载信息（{post.resources.length}）</h2>
          <div className="row">
            <button className="link-btn" onClick={() => setResourceOpen((value) => !value)}>
              {resourceOpen ? '收起' : '展开'}
            </button>
            <button
              className="btn btn-sm"
              onClick={() => {
                setResourceOpen(true);
                update('resources', [...post.resources, emptyResource(post.resources.length)]);
              }}
            >
              ＋ 添加下载渠道
            </button>
          </div>
        </div>
        {resourceOpen && (
          <div className="card-body stack">
            {post.resources.length === 0 && <p className="muted">还没有下载渠道，点击右上角添加。可以添加多个网盘链接。</p>}
            {post.resources.map((resource, index) => (
              <div className="card" key={index} style={{ boxShadow: 'none' }}>
                <div className="card-head">
                  <h2>{resource.name || `下载渠道 ${index + 1}`}</h2>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={resource.visible}
                      onChange={(event) => updateResource(index, 'visible', event.target.checked)}
                    />
                    显示
                  </label>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() =>
                      update(
                        'resources',
                        post.resources.filter((_, i) => i !== index)
                      )
                    }
                  >
                    删除
                  </button>
                </div>
                <div className="card-body stack">
                  <div className="grid-3">
                    <div className="field">
                      <label>资源名称</label>
                      <input
                        className="input"
                        value={resource.name}
                        onChange={(event) => updateResource(index, 'name', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>下载渠道</label>
                      <input
                        className="input"
                        placeholder="例如：夸克网盘"
                        value={resource.channel}
                        onChange={(event) => updateResource(index, 'channel', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>按钮文字</label>
                      <input
                        className="input"
                        placeholder="例如：立即下载"
                        value={resource.buttonText}
                        onChange={(event) => updateResource(index, 'buttonText', event.target.value)}
                      />
                    </div>
                  </div>
                  <div className="field">
                    <label>下载地址 *</label>
                    <input
                      className="input"
                      placeholder="https://…"
                      value={resource.url}
                      onChange={(event) => updateResource(index, 'url', event.target.value)}
                    />
                  </div>
                  <div className="grid-3">
                    <div className="field">
                      <label>提取码</label>
                      <input className="input" value={resource.code} onChange={(event) => updateResource(index, 'code', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>解压密码</label>
                      <input
                        className="input"
                        value={resource.password}
                        onChange={(event) => updateResource(index, 'password', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>资源类型</label>
                      <input className="input" value={resource.type} onChange={(event) => updateResource(index, 'type', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>版本</label>
                      <input className="input" value={resource.version} onChange={(event) => updateResource(index, 'version', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>大小</label>
                      <input className="input" value={resource.size} onChange={(event) => updateResource(index, 'size', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>适用平台</label>
                      <input
                        className="input"
                        placeholder="安卓 / iOS / Windows"
                        value={resource.platform}
                        onChange={(event) => updateResource(index, 'platform', event.target.value)}
                      />
                    </div>
                    <div className="field">
                      <label>语言</label>
                      <input className="input" value={resource.language} onChange={(event) => updateResource(index, 'language', event.target.value)} />
                    </div>
                    <div className="field">
                      <label>更新时间</label>
                      <input className="input" value={resource.updated} onChange={(event) => updateResource(index, 'updated', event.target.value)} />
                    </div>
                  </div>
                  <div className="field">
                    <label>资源简介</label>
                    <input className="input" value={resource.summary} onChange={(event) => updateResource(index, 'summary', event.target.value)} />
                  </div>
                  <div className="field">
                    <label>使用说明</label>
                    <textarea
                      className="textarea"
                      value={resource.instructions}
                      onChange={(event) => updateResource(index, 'instructions', event.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <h2 style={{ fontSize: 15, margin: '4px 0 10px' }}>正文内容</h2>
        <RichEditor value={post.body} onChange={(value) => update('body', value)} />
      </div>

      <div className="card">
        <div className="sticky-actions" style={{ borderRadius: 12 }}>
          <button className="btn" onClick={() => navigate('/posts')}>
            返回列表
          </button>
          <button className="btn" onClick={() => setPreviewOpen(true)}>
            预览
          </button>
          {!isNew && (
            <button className="btn btn-danger" onClick={remove} disabled={saving}>
              删除
            </button>
          )}
          <button className="btn" onClick={() => save()} disabled={saving}>
            {saving ? '保存中…' : '保存'}
          </button>
          <button className="btn btn-primary" onClick={() => save(true)} disabled={saving}>
            {saving ? '发布中…' : '保存并发布'}
          </button>
        </div>
      </div>

      <MediaPicker open={pickerOpen} onClose={() => setPickerOpen(false)} onPick={(url) => update('cover', url)} />

      {previewOpen && (
        <div className="modal-mask" onClick={(event) => event.target === event.currentTarget && setPreviewOpen(false)}>
          <div className="modal wide">
            <div className="modal-head">
              <span>文章预览（约 {formatDate(post.date)}）</span>
              <div className="row" style={{ gap: 4 }}>
                <button
                  className={`btn btn-sm ${previewDevice === 'desktop' ? 'btn-primary' : ''}`}
                  onClick={() => setPreviewDevice('desktop')}
                >
                  电脑端
                </button>
                <button
                  className={`btn btn-sm ${previewDevice === 'mobile' ? 'btn-primary' : ''}`}
                  onClick={() => setPreviewDevice('mobile')}
                >
                  手机端
                </button>
                <button className="btn btn-sm" onClick={() => setPreviewOpen(false)}>
                  关闭
                </button>
              </div>
            </div>
            <div className="modal-body" style={{ padding: 0, background: '#f2f4f8' }}>
              <div
                className="preview-body"
                style={{
                  maxWidth: previewDevice === 'mobile' ? 390 : 860,
                  margin: '0 auto',
                  background: '#fff',
                  minHeight: 300,
                  boxShadow: previewDevice === 'mobile' ? '0 0 0 1px var(--border)' : 'none',
                }}
              >
                <h1 style={{ marginTop: 0 }}>{post.title}</h1>
                {post.subtitle && <p className="muted">{post.subtitle}</p>}
                {post.cover && <img src={post.cover} alt={post.title} />}
                {post.description && <p style={{ fontStyle: 'italic' }}>{post.description}</p>}
                <div dangerouslySetInnerHTML={{ __html: markdownToHtml(post.body) }} />
                {post.resources.filter((item) => item.visible && item.url).length > 0 && (
                  <div>
                    <h2>下载地址</h2>
                    {post.resources
                      .filter((item) => item.visible && item.url)
                      .map((item, index) => (
                        <p key={index}>
                          <a className="download-btn" href={item.url} target="_blank" rel="noreferrer">
                            ⬇ {item.buttonText || item.name || '立即下载'}
                          </a>
                          {item.code && <span className="muted"> 提取码：{item.code}</span>}
                          {item.password && <span className="muted"> 解压密码：{item.password}</span>}
                        </p>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
