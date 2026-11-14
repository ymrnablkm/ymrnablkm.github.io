import { useState } from 'react';
import { api, formatDate } from '../api';
import { useData } from '../context';
import { navigate, useConfirm, useToast } from '../components/ui';

export function TrashPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  const restore = async (id: string, title: string) => {
    setBusy(true);
    try {
      await api(`trash/${id}/restore`, { method: 'POST' });
      await refresh();
      toast(`已恢复「${title}」`, 'success');
    } catch (error: any) {
      toast(error.message || '恢复失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string, title: string) => {
    const ok = await confirm({
      title: '永久删除',
      message: `确定永久删除「${title}」吗？此操作无法撤销（但 GitHub 提交历史中仍可找回）。`,
      confirmText: '永久删除',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`trash/${id}`, { method: 'DELETE' });
      await refresh();
      toast('已永久删除', 'success');
    } catch (error: any) {
      toast(error.message || '删除失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2>回收站（{data.trash.length}）</h2>
        <button className="btn" onClick={() => navigate('/posts')}>
          返回文章列表
        </button>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>标题</th>
                <th>类型</th>
                <th>原位置</th>
                <th>删除时间</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.trash.map((item) => (
                <tr key={item.id}>
                  <td>
                    <span className="title-cell">{item.title}</span>
                  </td>
                  <td>
                    <span className="badge gray">{item.type === 'page' ? '页面' : '文章'}</span>
                  </td>
                  <td className="muted">{item.originalPath}</td>
                  <td className="muted">{formatDate(item.deletedAt)}</td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-sm" disabled={busy} onClick={() => restore(item.id, item.title)}>
                        恢复
                      </button>
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(item.id, item.title)}>
                        永久删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.trash.length === 0 && (
            <div className="empty">
              <div className="icon">🗑</div>
              <p>回收站是空的。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
