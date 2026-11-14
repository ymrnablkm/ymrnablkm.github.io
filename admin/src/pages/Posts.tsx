import { useMemo, useState } from 'react';
import { api, formatDate } from '../api';
import { useData } from '../context';
import type { Post } from '../types';
import { navigate, useConfirm, useToast } from '../components/ui';

export function PostsPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [keyword, setKeyword] = useState('');
  const [category, setCategory] = useState('');
  const [status, setStatus] = useState('');
  const [sort, setSort] = useState('new');
  const [dateFrom, setDateFrom] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [batchCategory, setBatchCategory] = useState('');
  const [batchTag, setBatchTag] = useState('');
  const [batchTagMode, setBatchTagMode] = useState<'add' | 'remove'>('add');
  const [busy, setBusy] = useState(false);

  const filtered = useMemo(() => {
    let list = [...data.posts];
    if (keyword.trim()) {
      const key = keyword.trim().toLowerCase();
      list = list.filter(
        (post) =>
          post.title.toLowerCase().includes(key) ||
          post.description.toLowerCase().includes(key) ||
          post.tags.join(' ').toLowerCase().includes(key)
      );
    }
    if (category) list = list.filter((post) => post.category === category);
    if (status === 'draft') list = list.filter((post) => post.draft);
    if (status === 'published') list = list.filter((post) => !post.draft);
    if (status === 'pinned') list = list.filter((post) => post.pinned);
    if (status === 'featured') list = list.filter((post) => post.featured);
    if (dateFrom) list = list.filter((post) => post.date.slice(0, 10) >= dateFrom);
    if (sort === 'old') list.sort((a, b) => a.date.localeCompare(b.date));
    else if (sort === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'zh-CN'));
    else list.sort((a, b) => b.date.localeCompare(a.date));
    return list;
  }, [data.posts, keyword, category, status, sort, dateFrom]);

  const allSelected = filtered.length > 0 && filtered.every((post) => selected.includes(post.slug));

  const toggleAll = () => {
    if (allSelected) setSelected([]);
    else setSelected(filtered.map((post) => post.slug));
  };

  const run = async (task: () => Promise<void>, success: string) => {
    setBusy(true);
    try {
      await task();
      await refresh();
      toast(success, 'success');
    } catch (error: any) {
      toast(error.message || '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const updatePost = async (post: Post, changes: Partial<Post>) => {
    await api(`posts/${post.slug}`, {
      method: 'PUT',
      body: { post: { ...post, ...changes }, sha: post.sha },
    });
  };

  const toggleDraft = (post: Post) =>
    run(() => updatePost(post, { draft: !post.draft }), post.draft ? '已发布文章' : '已撤回为草稿');

  const togglePin = (post: Post) => run(() => updatePost(post, { pinned: !post.pinned }), post.pinned ? '已取消置顶' : '已置顶');

  const duplicate = (post: Post) =>
    run(async () => {
      const copy = { ...post, title: `${post.title}（副本）`, draft: true };
      await api('posts', {
        method: 'POST',
        body: { post: copy, slug: `${post.slug}-copy` },
      });
    }, '已复制为新草稿');

  const remove = async (post: Post) => {
    const ok = await confirm({
      title: '移入回收站',
      message: `确定把《${post.title}》移入回收站吗？可以随时恢复。`,
      confirmText: '移入回收站',
      danger: true,
    });
    if (!ok) return;
    await run(() => api(`posts/${post.slug}`, { method: 'DELETE' }), '已移入回收站');
    setSelected((prev) => prev.filter((slug) => slug !== post.slug));
  };

  const batchDelete = async () => {
    if (selected.length === 0) return;
    const ok = await confirm({
      title: '批量移入回收站',
      message: `确定移入回收站 ${selected.length} 篇文章吗？`,
      confirmText: '确定',
      danger: true,
    });
    if (!ok) return;
    await run(async () => {
      for (const slug of selected) {
        await api(`posts/${slug}`, { method: 'DELETE' });
      }
      setSelected([]);
    }, `已移入回收站 ${selected.length} 篇`);
  };

  const batchSetCategory = async () => {
    if (selected.length === 0 || !batchCategory) {
      toast('请先选择文章和目标分类', 'error');
      return;
    }
    await run(async () => {
      for (const slug of selected) {
        const post = data.posts.find((item) => item.slug === slug);
        if (!post) continue;
        await updatePost(post, { category: batchCategory === 'none' ? '' : batchCategory });
      }
      setSelected([]);
    }, '批量分类已更新');
  };

  const batchSetTag = async () => {
    if (selected.length === 0 || !batchTag) {
      toast('请先选择文章和标签', 'error');
      return;
    }
    await run(async () => {
      for (const slug of selected) {
        const post = data.posts.find((item) => item.slug === slug);
        if (!post) continue;
        const tags =
          batchTagMode === 'add'
            ? Array.from(new Set([...post.tags, batchTag]))
            : post.tags.filter((item) => item !== batchTag);
        await updatePost(post, { tags });
      }
      setSelected([]);
    }, batchTagMode === 'add' ? '已批量添加标签' : '已批量移除标签');
  };

  const batchPublish = async (draft: boolean) => {
    if (selected.length === 0) return;
    await run(async () => {
      for (const slug of selected) {
        const post = data.posts.find((item) => item.slug === slug);
        if (!post) continue;
        await updatePost(post, { draft });
      }
      setSelected([]);
    }, draft ? '已批量撤回为草稿' : '已批量发布');
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>文章列表（{filtered.length}）</h2>
          <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
            ＋ 新建文章
          </button>
        </div>
        <div className="card-body">
          <div className="grid-2">
            <input
              className="input"
              placeholder="搜索标题、简介或标签…"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <div className="row">
              <select className="select" value={category} onChange={(event) => setCategory(event.target.value)}>
                <option value="">全部分类</option>
                {data.categories.map((item) => (
                  <option key={item.id} value={item.slug}>
                    {item.name}
                  </option>
                ))}
              </select>
              <select className="select" value={status} onChange={(event) => setStatus(event.target.value)}>
                <option value="">全部状态</option>
                <option value="published">已发布</option>
                <option value="draft">草稿</option>
                <option value="pinned">置顶</option>
                <option value="featured">推荐</option>
              </select>
            </div>
            <div className="row">
              <select className="select" value={sort} onChange={(event) => setSort(event.target.value)}>
                <option value="new">最新优先</option>
                <option value="old">最早优先</option>
                <option value="title">按标题</option>
              </select>
              <input
                className="input"
                type="date"
                value={dateFrom}
                onChange={(event) => setDateFrom(event.target.value)}
                title="只看该日期之后发布的文章"
              />
            </div>
          </div>

          {selected.length > 0 && (
            <div className="alert" style={{ marginTop: 14 }}>
              <div className="row-between">
                <span>已选择 {selected.length} 篇</span>
                <div className="row">
                  <select className="select" value={batchCategory} onChange={(event) => setBatchCategory(event.target.value)}>
                    <option value="">修改分类为…</option>
                    <option value="none">清除分类</option>
                    {data.categories.map((item) => (
                      <option key={item.id} value={item.slug}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <button className="btn btn-sm" disabled={busy} onClick={batchSetCategory}>
                    应用分类
                  </button>
                  <button className="btn btn-sm" disabled={busy} onClick={() => batchPublish(false)}>
                    批量发布
                  </button>
                  <button className="btn btn-sm" disabled={busy} onClick={() => batchPublish(true)}>
                    撤回草稿
                  </button>
                  <button className="btn btn-sm btn-danger" disabled={busy} onClick={batchDelete}>
                    批量删除
                  </button>
                </div>
              </div>
              <div className="row" style={{ marginTop: 8, flexWrap: 'wrap' }}>
                <select
                  className="select"
                  style={{ maxWidth: 130 }}
                  value={batchTagMode}
                  onChange={(event) => setBatchTagMode(event.target.value as 'add' | 'remove')}
                >
                  <option value="add">添加标签</option>
                  <option value="remove">移除标签</option>
                </select>
                <select className="select" style={{ maxWidth: 180 }} value={batchTag} onChange={(event) => setBatchTag(event.target.value)}>
                  <option value="">选择标签…</option>
                  {data.tags.map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
                </select>
                <button className="btn btn-sm" disabled={busy} onClick={batchSetTag}>
                  应用标签
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="only-mobile">
          {filtered.map((post) => (
            <div className="mobile-item" key={post.slug}>
              <div className="top">
                <input
                  type="checkbox"
                  checked={selected.includes(post.slug)}
                  onChange={(event) =>
                    setSelected((prev) =>
                      event.target.checked ? [...prev, post.slug] : prev.filter((slug) => slug !== post.slug)
                    )
                  }
                  aria-label={`选择 ${post.title}`}
                />
                <div className="title">
                  {post.title}
                  <div className="muted">/{post.slug}</div>
                </div>
              </div>
              <div className="meta">
                <span className={`badge ${post.draft ? 'gray' : 'green'}`}>{post.draft ? '草稿' : '已发布'}</span>
                {post.pinned && <span className="badge orange">置顶</span>}
                {post.featured && <span className="badge">推荐</span>}
                <span className="muted">
                  {data.categories.find((item) => item.slug === post.category)?.name || '未分类'}
                </span>
                <span className="muted">{formatDate(post.date)}</span>
              </div>
              <div className="actions">
                <button className="btn btn-sm" onClick={() => navigate(`/posts/${post.slug}`)}>
                  编辑
                </button>
                <button className="btn btn-sm" disabled={busy} onClick={() => toggleDraft(post)}>
                  {post.draft ? '发布' : '撤回'}
                </button>
                <button className="btn btn-sm" disabled={busy} onClick={() => togglePin(post)}>
                  {post.pinned ? '取消置顶' : '置顶'}
                </button>
                <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(post)}>
                  删除
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="empty">
              <div className="icon">📝</div>
              <p>没有符合条件的文章</p>
            </div>
          )}
        </div>

        <div className="only-desktop table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: 34 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="全选" />
                </th>
                <th>标题</th>
                <th>分类</th>
                <th>标签</th>
                <th>发布时间</th>
                <th>状态</th>
                <th style={{ width: 200 }}>操作</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((post) => (
                <tr key={post.slug}>
                  <td>
                    <input
                      type="checkbox"
                      checked={selected.includes(post.slug)}
                      onChange={(event) =>
                        setSelected((prev) =>
                          event.target.checked ? [...prev, post.slug] : prev.filter((slug) => slug !== post.slug)
                        )
                      }
                      aria-label={`选择 ${post.title}`}
                    />
                  </td>
                  <td>
                    <button className="link-btn" onClick={() => navigate(`/posts/${post.slug}`)} style={{ textAlign: 'left' }}>
                      <span className="title-cell">{post.title}</span>
                    </button>
                    <span className="muted">/{post.slug}</span>
                  </td>
                  <td className="muted">
                    {data.categories.find((item) => item.slug === post.category)?.name || '未分类'}
                  </td>
                  <td>
                    <span className="muted">{post.tags.slice(0, 3).join('、') || '—'}</span>
                  </td>
                  <td className="muted">{formatDate(post.date)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <span className={`badge ${post.draft ? 'gray' : 'green'}`}>{post.draft ? '草稿' : '发布'}</span>
                      {post.pinned && <span className="badge orange">置顶</span>}
                      {post.featured && <span className="badge">推荐</span>}
                    </div>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-sm" onClick={() => navigate(`/posts/${post.slug}`)}>
                        编辑
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => toggleDraft(post)}>
                        {post.draft ? '发布' : '撤回'}
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => togglePin(post)}>
                        {post.pinned ? '取消置顶' : '置顶'}
                      </button>
                      <button className="btn btn-sm" disabled={busy} onClick={() => duplicate(post)}>
                        复制
                      </button>
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(post)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && (
            <div className="empty">
              <div className="icon">📝</div>
              <p>没有符合条件的文章</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
