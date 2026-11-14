import { useState } from 'react';
import { api, formatDate } from '../api';
import { useData } from '../context';
import { navigate, useConfirm, useToast } from '../components/ui';

export function PagesPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [busy, setBusy] = useState(false);

  const remove = async (slug: string, title: string) => {
    const ok = await confirm({
      title: '删除页面',
      message: `确定把「${title}」移入回收站吗？可以在回收站中恢复。`,
      confirmText: '移入回收站',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`pages/${slug}`, { method: 'DELETE' });
      await refresh();
      toast('页面已移入回收站', 'success');
    } catch (error: any) {
      toast(error.message || '删除失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card">
      <div className="card-head">
        <h2>独立页面（{data.pages.length}）</h2>
        <button className="btn btn-primary" onClick={() => navigate('/pages/new')}>
          ＋ 新建页面
        </button>
      </div>
      <div className="card-body" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>页面标题</th>
                <th>URL</th>
                <th>导航</th>
                <th>更新时间</th>
                <th>状态</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {data.pages.map((page) => (
                <tr key={page.slug}>
                  <td>
                    <button className="link-btn" onClick={() => navigate(`/pages/${page.slug}`)}>
                      <span className="title-cell">{page.title}</span>
                    </button>
                  </td>
                  <td className="muted">/{page.slug}</td>
                  <td className="muted">{page.showInNav ? '显示' : '—'}</td>
                  <td className="muted">{formatDate(page.updated)}</td>
                  <td>
                    <span className={`badge ${page.draft ? 'gray' : 'green'}`}>{page.draft ? '草稿' : '已发布'}</span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn btn-sm" onClick={() => navigate(`/pages/${page.slug}`)}>
                        编辑
                      </button>
                      <a className="btn btn-sm" href={`/${page.slug}`} target="_blank" rel="noreferrer">
                        查看
                      </a>
                      <button className="btn btn-sm btn-danger" disabled={busy} onClick={() => remove(page.slug, page.title)}>
                        删除
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {data.pages.length === 0 && (
            <div className="empty">
              <div className="icon">📄</div>
              <p>还没有独立页面，可以创建「关于本站」「联系我们」等页面。</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
