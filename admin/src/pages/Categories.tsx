import { useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import type { Category } from '../types';
import { MediaPicker } from '../components/MediaPicker';
import { Field, Modal, useConfirm, useToast } from '../components/ui';

const emptyCategory = (index: number): Category => ({
  id: '',
  name: '',
  slug: '',
  icon: '📁',
  description: '',
  cover: '',
  order: index + 1,
  visible: true,
  seoTitle: '',
  seoDescription: '',
});

export function CategoriesPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [editing, setEditing] = useState<Category | null>(null);
  const [picker, setPicker] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Category | null>(null);
  const [reassign, setReassign] = useState('none');
  const [busy, setBusy] = useState(false);

  const countPosts = (slug: string) => data.posts.filter((post) => post.category === slug).length;

  const freshCategories = async () => {
    const result = await api<{ categories: Category[]; sha: string }>('categories');
    return result;
  };

  const save = async () => {
    if (!editing) return;
    if (!editing.name.trim()) {
      toast('请填写分类名称', 'error');
      return;
    }
    setBusy(true);
    try {
      const fresh = await freshCategories();
      if (!editing.id) {
        await api('categories', { method: 'POST', body: { category: editing } });
      } else {
        await api(`categories/${editing.id}`, { method: 'PUT', body: { category: editing, sha: fresh.sha } });
      }
      setEditing(null);
      await refresh();
      toast('分类已保存并同步到 GitHub', 'success');
    } catch (error: any) {
      toast(error.message || '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const move = async (category: Category, direction: -1 | 1) => {
    const list = [...data.categories].sort((a, b) => a.order - b.order);
    const index = list.findIndex((item) => item.id === category.id);
    const target = list[index + direction];
    if (!target) return;
    setBusy(true);
    try {
      for (const [item, order] of [
        [category, target.order],
        [target, category.order],
      ] as [Category, number][]) {
        const fresh = await freshCategories();
        await api(`categories/${item.id}`, {
          method: 'PUT',
          body: { category: { ...item, order }, sha: fresh.sha },
        });
      }
      await refresh();
    } catch (error: any) {
      toast(error.message || '排序失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const toggleVisible = async (category: Category) => {
    setBusy(true);
    try {
      const fresh = await freshCategories();
      await api(`categories/${category.id}`, {
        method: 'PUT',
        body: { category: { ...category, visible: !category.visible }, sha: fresh.sha },
      });
      await refresh();
    } catch (error: any) {
      toast(error.message || '操作失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const startDelete = (category: Category) => {
    const count = countPosts(category.slug);
    if (count > 0) {
      setReassign('none');
      setDeleteTarget(category);
      return;
    }
    confirm({
      title: '删除分类',
      message: `确定删除分类「${category.name}」吗？`,
      confirmText: '删除',
      danger: true,
    }).then(async (ok) => {
      if (!ok) return;
      await doDelete(category, null);
    });
  };

  const doDelete = async (category: Category, reassignSlug: string | null) => {
    setBusy(true);
    try {
      const query = reassignSlug ? `?reassign=${encodeURIComponent(reassignSlug)}` : '';
      await api(`categories/${category.id}${query}`, { method: 'DELETE' });
      setDeleteTarget(null);
      await refresh();
      toast('分类已删除', 'success');
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
          <h2>分类管理（{data.categories.length}）</h2>
          <button className="btn btn-primary" onClick={() => setEditing(emptyCategory(data.categories.length))}>
            ＋ 新增分类
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>图标</th>
                  <th>名称</th>
                  <th>URL</th>
                  <th>文章数</th>
                  <th>显示</th>
                  <th>排序</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {data.categories.map((category) => (
                  <tr key={category.id}>
                    <td style={{ fontSize: 20 }}>{category.icon}</td>
                    <td>
                      <strong>{category.name}</strong>
                      {category.description && <div className="muted">{category.description}</div>}
                    </td>
                    <td className="muted">/category/{category.slug}</td>
                    <td>{countPosts(category.slug)}</td>
                    <td>
                      <span className={`badge ${category.visible ? 'green' : 'gray'}`}>
                        {category.visible ? '显示' : '隐藏'}
                      </span>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn btn-sm" disabled={busy} onClick={() => move(category, -1)}>
                          ↑
                        </button>
                        <button className="btn btn-sm" disabled={busy} onClick={() => move(category, 1)}>
                          ↓
                        </button>
                      </div>
                    </td>
                    <td>
                      <div className="row" style={{ gap: 4 }}>
                        <button className="btn btn-sm" onClick={() => setEditing({ ...category })}>
                          编辑
                        </button>
                        <button className="btn btn-sm" disabled={busy} onClick={() => toggleVisible(category)}>
                          {category.visible ? '隐藏' : '显示'}
                        </button>
                        <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => startDelete(category)}>
                          删除
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {data.categories.length === 0 && <div className="empty">还没有分类，点击右上角新增。</div>}
          </div>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? '编辑分类' : '新增分类'}
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
            <div className="grid-2">
              <Field label="分类名称 *">
                <input
                  className="input"
                  value={editing.name}
                  onChange={(event) => setEditing({ ...editing, name: event.target.value })}
                />
              </Field>
              <Field label="图标（emoji）">
                <input
                  className="input"
                  value={editing.icon}
                  onChange={(event) => setEditing({ ...editing, icon: event.target.value })}
                />
              </Field>
            </div>
            <Field label="分类 URL" hint="留空会根据名称自动生成，建议使用英文">
              <input
                className="input"
                value={editing.slug}
                onChange={(event) => setEditing({ ...editing, slug: event.target.value })}
              />
            </Field>
            <Field label="分类介绍">
              <textarea
                className="textarea"
                value={editing.description}
                onChange={(event) => setEditing({ ...editing, description: event.target.value })}
              />
            </Field>
            <Field label="分类封面">
              <div className="row">
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={editing.cover}
                  onChange={(event) => setEditing({ ...editing, cover: event.target.value })}
                />
                <button className="btn" onClick={() => setPicker(true)}>
                  选择
                </button>
              </div>
            </Field>
            <div className="row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editing.visible}
                  onChange={(event) => setEditing({ ...editing, visible: event.target.checked })}
                />
                在前台显示
              </label>
            </div>
            <div className="grid-2">
              <Field label="SEO 标题">
                <input
                  className="input"
                  value={editing.seoTitle || ''}
                  onChange={(event) => setEditing({ ...editing, seoTitle: event.target.value })}
                />
              </Field>
              <Field label="SEO 描述">
                <input
                  className="input"
                  value={editing.seoDescription || ''}
                  onChange={(event) => setEditing({ ...editing, seoDescription: event.target.value })}
                />
              </Field>
            </div>
          </div>
        </Modal>
      )}

      {deleteTarget && (
        <Modal
          title="删除分类"
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
              分类「{deleteTarget.name}」下还有 {countPosts(deleteTarget.slug)} 篇文章，删除后这些文章会需要重新归类。
            </div>
            <Field label="把这些文章转移到">
              <select className="select" value={reassign} onChange={(event) => setReassign(event.target.value)}>
                <option value="none">保持为空（未分类）</option>
                {data.categories
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

      <MediaPicker
        open={picker}
        onClose={() => setPicker(false)}
        onPick={(url) => editing && setEditing({ ...editing, cover: url })}
      />
    </div>
  );
}
