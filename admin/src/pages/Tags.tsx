import { useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import type { Tag } from '../types';
import { Field, Modal, navigate, useConfirm, useToast } from '../components/ui';

export function TagsPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Tag | null>(null);
  const [keyword, setKeyword] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<Tag | null>(null);
  const [linkTarget, setLinkTarget] = useState<Tag | null>(null);
  const [reassign, setReassign] = useState('none');
  const [busy, setBusy] = useState(false);

  const countPosts = (slug: string) => data.posts.filter((post) => post.tags.includes(slug)).length;

  const filtered = keyword
    ? data.tags.filter((tag) => tag.name.toLowerCase().includes(keyword.toLowerCase()))
    : data.tags;

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast('请填写标签名称', 'error');
      return;
    }
    setBusy(true);
    try {
      const fresh = await api<{ tags: Tag[]; sha: string }>('tags');
      if (!editing.id) {
        await api('tags', { method: 'POST', body: { tag: editing } });
      } else {
        await api(`tags/${editing.id}`, { method: 'PUT', body: { tag: editing, sha: fresh.sha } });
      }
      setEditing(null);
      await refresh();
      toast('标签已保存并同步到 GitHub', 'success');
    } catch (error: any) {
      toast(error.message || '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const startDelete = (tag: Tag) => {
    if (countPosts(tag.slug) > 0) {
      setReassign('none');
      setDeleteTarget(tag);
      return;
    }
    confirm({
      title: '删除标签',
      message: `确定删除标签「${tag.name}」吗？`,
      confirmText: '删除',
      danger: true,
    }).then((ok) => {
      if (ok) doDelete(tag, null);
    });
  };

  const doDelete = async (tag: Tag, reassignSlug: string | null) => {
    setBusy(true);
    try {
      const query = reassignSlug ? `?reassign=${encodeURIComponent(reassignSlug)}` : '';
      await api(`tags/${tag.id}${query}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await refresh();
      toast('标签已删除', 'success');
    } catch (error: any) {
      toast(error.message || '删除失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>标签管理（{data.tags.length}）</h2>
          <button
            className="btn btn-primary"
            onClick={() =>
              setEditing({ id: '', name: '', slug: '', description: '' })
            }
          >
            ＋ 新增标签
          </button>
        </div>
        <div className="card-body">
          <input
            className="input"
            placeholder="搜索标签…"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>URL</th>
                  <th>关联文章</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tag) => (
                  <tr key={tag.id}>
                    <td>
                      <strong>{tag.name}</strong>
                    </td>
                    <td className="muted">/tag/{tag.slug}</td>
                    <td>
                      {countPosts(tag.slug) > 0 ? (
                        <button className="link-btn" onClick={() => setLinkTarget(tag)}>
                          {countPosts(tag.slug)} 篇
                        </button>
                      ) : (
                        <span className="muted">0 篇</span>
                      )}
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => setEditing({ ...tag })}>
                          编辑
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => startDelete(tag)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && <div className="empty">没有标签，点击右上角新增。</div>}
          </div>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? '编辑标签' : '新增标签'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={save} disabled={busy}>
                {busy ? '保存中…' : '保存'}
              </button>
            </>
          }
        >
          <div className="stack">
            <Field label="标签名称 *">
              <input
                className="input"
                value={editing.name}
                onChange={(event) => setEditing({ ...editing, name: event.target.value })}
              />
            </Field>
            <Field label="标签 URL" hint="留空自动生成，建议英文">
              <input
                className="input"
                value={editing.slug}
                onChange={(event) => setEditing({ ...editing, slug: event.target.value })}
              />
            </Field>
            <Field label="标签说明（可选）">
              <input
                className="input"
                value={editing.description || ''}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </Field>
          </div>
        </Modal>
      )}

      {linkTarget && (
        <Modal
          title={`使用「${linkTarget.name}」的文章`}
          onClose={() => setLinkTarget(null)}
          footer={
            <button className="btn" onClick={() => setLinkTarget(null)}>
              关闭
            </button>
          }
        >
          <div className="stack" style={{ gap: 8 }}>
            {data.posts
              .filter((post) => post.tags.includes(linkTarget.slug))
              .map((post) => (
                <div className="sortable-row" key={post.slug} style={{ marginBottom: 0 }}>
                  <span style={{ flex: 1 }}>{post.title}</span>
                  <span className={`badge ${post.draft ? 'gray' : 'green'}`}>{post.draft ? '草稿' : '已发布'}</span>
                  <button
                    className="btn btn-sm"
                    onClick={() => {
                      setLinkTarget(null);
                      navigate(`/posts/${post.slug}`);
                    }}
                  >
                    编辑
                  </button>
                </div>
              ))}
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="删除标签"
          onClose={() => setDeleteTarget(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDeleteTarget(null)}>
                取消
              </button>
              <button className="btn btn-danger" disabled={busy} onClick={() => doDelete(deleteTarget, reassign)}>
                确认删除
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="alert">
              标签「{deleteTarget.name}」正被 {countPosts(deleteTarget.slug)} 篇文章使用。
            </div>
            <Field label="把这些文章中的该标签替换为">
              <select className="select" value={reassign} onChange={(event) => setReassign(event.target.value)}>
                <option value="none">直接移除该标签</option>
                {data.tags
                  .filter((item) => item.id !== deleteTarget.id)
                  .map((item) => (
                    <option key={item.id} value={item.slug}>
                      {item.name}
                    </option>
                  ))}
              </select>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
