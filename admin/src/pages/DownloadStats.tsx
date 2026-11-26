import { useEffect, useMemo, useState } from 'react';
import { api, formatDate } from '../api';
import { useData } from '../context';
import { navigate } from '../components/ui';

const PAGE_SIZE = 20;

export function DownloadStatsPage() {
  const { data } = useData();
  const [keyword, setKeyword] = useState('');
  const [page, setPage] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>(data.downloadCounts || {});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<{ counts: Record<string, number>; source: string }>('downloads/stats')
      .then((result) => {
        if (!alive) return;
        setCounts(result.counts || {});
        setError('');
      })
      .catch((err: any) => {
        if (alive) setError(err.message || '读取下载统计失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  // 固定按发布时间从新到旧；发布时间相同时用 slug 作为稳定次级排序
  const list = useMemo(() => {
    const key = keyword.trim().toLowerCase();
    return data.posts
      .filter((post) => !key || post.title.toLowerCase().includes(key))
      .map((post) => ({
        slug: post.slug,
        title: post.title,
        date: post.date,
        draft: post.draft,
        count: counts[post.slug] || 0,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || a.slug.localeCompare(b.slug));
  }, [data.posts, counts, keyword]);

  const total = useMemo(
    () => data.posts.reduce((sum, post) => sum + (counts[post.slug] || 0), 0),
    [data.posts, counts]
  );

  const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const shown = list.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat">
          <div className="label">全站累计下载次数</div>
          <div className="value">{total}</div>
        </div>
        <div className="stat">
          <div className="label">文章总数</div>
          <div className="value">{data.posts.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>文章下载统计（{list.length}）</h2>
          <span className="muted">按发布时间从新到旧</span>
        </div>
        <div className="card-body">
          <input
            className="input"
            placeholder="搜索文章标题…"
            value={keyword}
            onChange={(event) => {
              setKeyword(event.target.value);
              setPage(1);
            }}
          />

          {error && (
            <div className="alert error" style={{ marginTop: 12 }}>
              {error}
              {loading ? '' : '（当前显示的是上次读取的数据）'}
            </div>
          )}

          {shown.length === 0 ? (
            <div className="empty">
              <div className="icon">📥</div>
              <p>{keyword.trim() ? '没有找到匹配的文章' : '还没有文章'}</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>文章标题</th>
                    <th style={{ width: 170 }}>发布时间</th>
                    <th style={{ width: 110 }}>下载点击次数</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((item) => (
                    <tr key={item.slug}>
                      <td>
                        <button
                          className="link-btn"
                          style={{ textAlign: 'left' }}
                          onClick={() => navigate(`/posts/${item.slug}`)}
                        >
                          <span className="title-cell">{item.title}</span>
                        </button>
                        {item.draft && <span className="badge gray" style={{ marginLeft: 6 }}>草稿</span>}
                      </td>
                      <td className="muted">{formatDate(item.date)}</td>
                      <td>
                        <strong>{item.count}</strong>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {totalPages > 1 && (
            <div className="row-between" style={{ marginTop: 14 }}>
              <span className="muted">
                第 {currentPage} / {totalPages} 页
              </span>
              <div className="row">
                <button className="btn btn-sm" disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>
                  上一页
                </button>
                <button
                  className="btn btn-sm"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  下一页
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
