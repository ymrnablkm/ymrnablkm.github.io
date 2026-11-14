import { useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import type { NavItem } from '../types';
import { Field, Modal, useConfirm, useToast } from '../components/ui';

export function NavPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [items, setItems] = useState<NavItem[]>(() => [...data.nav].sort((a, b) => a.order - b.order));
  const [sha, setSha] = useState<string | null>(data.navSha);
  const [editing, setEditing] = useState<NavItem | null>(null);
  const [busy, setBusy] = useState(false);

  const persist = async (next: NavItem[], message = '导航已保存') => {
    setBusy(true);
    try {
      const result = await api<{ nav: NavItem[]; sha: string }>('nav', {
        method: 'PUT',
        body: { nav: next, sha },
      });
      setItems(result.nav);
      setSha(result.sha);
      await refresh();
      toast(message, 'success');
    } catch (error: any) {
      toast(error.message || '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    setItems(next);
    persist(next);
  };

  const saveItem = async () => {
    if (!editing) return;
    if (!editing.label.trim() || !editing.href.trim()) {
      toast('请填写导航名称和地址', 'error');
      return;
    }
    const exists = items.some((item) => item.id === editing.id);
    const next = exists
      ? items.map((item) => (item.id === editing.id ? editing : item))
      : [...items, { ...editing, id: `nav-${Date.now()}`, order: items.length + 1 }];
    setEditing(null);
    await persist(next, '导航项已保存');
  };

  const remove = async (item: NavItem) => {
    const children = items.filter((child) => child.parent === item.id);
    const ok = await confirm({
      title: '删除导航',
      message: children.length
        ? `「${item.label}」下还有 ${children.length} 个子导航，删除后它们会变成一级导航。确定继续吗？`
        : `确定删除导航「${item.label}」吗？`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    const next = items
      .filter((child) => child.id !== item.id)
      .map((child) => (child.parent === item.id ? { ...child, parent: null } : child));
    await persist(next, '导航已删除');
  };

  const toggleVisible = async (item: NavItem) => {
    await persist(
      items.map((child) => (child.id === item.id ? { ...child, visible: !child.visible } : child)),
      item.visible ? '已隐藏该导航' : '已显示该导航'
    );
  };

  const topLevel = items.filter((item) => !item.parent);

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>导航管理</h2>
          <button
            className="btn btn-primary"
            onClick={() =>
              setEditing({
                id: '',
                label: '',
                href: '/',
                external: false,
                order: items.length + 1,
                visible: true,
                parent: null,
              })
            }
          >
            ＋ 新增导航
          </button>
        </div>
        <div className="card-body">
          <div className="stack">
            {items.length === 0 && <p className="muted">还没有导航项。</p>}
            {items.map((item, index) => (
              <div className="sortable-row" key={item.id}>
                <div className="stack" style={{ gap: 0 }}>
                  <button className="btn btn-sm" disabled={busy || index === 0} onClick={() => move(index, -1)}>
                    ↑
                  </button>
                  <button className="btn btn-sm" disabled={busy || index === items.length - 1} onClick={() => move(index, 1)}>
                    ↓
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row" style={{ gap: 8 }}>
                    <strong>{item.label}</strong>
                    {item.parent && <span className="badge gray">子导航</span>}
                    {item.external && <span className="badge">外链</span>}
                    <span className={`badge ${item.visible ? 'green' : 'gray'}`}>{item.visible ? '显示' : '隐藏'}</span>
                  </div>
                  <div className="muted">{item.href}</div>
                </div>
                <div className="row" style={{ gap: 4 }}>
                  <button className="btn btn-sm" onClick={() => setEditing({ ...item })}>
                    编辑
                  </button>
                  <button className="btn btn-sm" disabled={busy} onClick={() => toggleVisible(item)}>
                    {item.visible ? '隐藏' : '显示'}
                  </button>
                  <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(item)}>
                    删除
                  </button>
                </div>
              </div>
            ))}
          </div>
          <p className="muted" style={{ marginTop: 10 }}>
            提示：保存后前台导航会立即生效；子导航需要把「父级导航」设置为某个一级导航。
          </p>
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? '编辑导航' : '新增导航'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                取消
              </button>
              <button className="btn btn-primary" onClick={saveItem} disabled={busy}>
                保存
              </button>
            </>
          }
        >
          <div className="stack">
            <Field label="导航名称 *">
              <input
                className="input"
                value={editing.label}
                onChange={(event) => setEditing({ ...editing, label: event.target.value })}
              />
            </Field>
            <Field label="跳转地址 *" hint="站内地址以 / 开头，例如 /about；外链请填写完整网址">
              <input
                className="input"
                value={editing.href}
                onChange={(event) => setEditing({ ...editing, href: event.target.value })}
              />
            </Field>
            <Field label="父级导航">
              <select
                className="select"
                value={editing.parent || ''}
                onChange={(event) => setEditing({ ...editing, parent: event.target.value || null })}
              >
                <option value="">无（一级导航）</option>
                {topLevel
                  .filter((item) => item.id !== editing.id)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
              </select>
            </Field>
            <div className="row">
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editing.external}
                  onChange={(event) => setEditing({ ...editing, external: event.target.checked })}
                />
                外部链接（新窗口打开）
              </label>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={editing.visible}
                  onChange={(event) => setEditing({ ...editing, visible: event.target.checked })}
                />
                显示
              </label>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
