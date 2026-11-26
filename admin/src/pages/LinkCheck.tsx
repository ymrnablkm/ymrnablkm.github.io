import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import { useToast } from '../components/ui';
import type { Post } from '../types';

type CheckStatus = 'ok' | 'invalid' | 'failed' | 'unknown' | 'none';

interface LinkCheckResult {
  slug: string;
  status: CheckStatus;
  message: string;
  checkedAt: string;
  links: { name: string; url: string; status: string; message: string; ms?: number }[];
}

const STATUS_META: Record<string, { label: string; badge: string }> = {
  ok: { label: '正常', badge: 'green' },
  invalid: { label: '可能失效', badge: 'red' },
  failed: { label: '检测失败', badge: 'orange' },
  unknown: { label: '无法判断', badge: 'gray' },
  none: { label: '无下载链接', badge: 'gray' },
};

const hasDownload = (post: Post) => (post.resources || []).some((item) => item.visible && item.url);

export function LinkCheckPage() {
  const { data } = useData();
  const toast = useToast();
  const [results, setResults] = useState<Record<string, LinkCheckResult>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    api<{ results: Record<string, LinkCheckResult> }>('linkcheck')
      .then((res) => setResults(res.results || {}))
      .catch((err: any) => setError(err.message || '读取检测结果失败'))
      .finally(() => setLoading(false));
  }, []);

  const posts = useMemo(() => {
    const key = (filter || '').trim().toLowerCase();
    return data.posts
      .filter((post) => hasDownload(post))
      .filter((post) => {
        if (!key) return true;
        if (key === 'unchecked') return !results[post.slug];
        return (results[post.slug]?.status || '') === key;
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [data.posts, results, filter]);

  const pending = useMemo(
    () => data.posts.filter((post) => hasDownload(post) && !results[post.slug]),
    [data.posts, results]
  );

  const checkOne = async (slug: string) => {
    const res = await api<{ result: LinkCheckResult }>('linkcheck', { method: 'POST', body: { slug } });
    setResults((prev) => ({ ...prev, [res.result.slug]: res.result }));
    return res.result;
  };

  const runBatch = async (slugs: string[]) => {
    if (!slugs.length || running) return;
    setRunning(true);
    setError('');
    setProgress({ done: 0, total: slugs.length });
    const queue = slugs.slice();
    let done = 0;

    const worker = async () => {
      while (queue.length) {
        const slug = queue.shift();
        if (!slug) break;
        try {
          await checkOne(slug);
        } catch (err: any) {
          setError(err.message || '检测失败');
        }
        done += 1;
        setProgress({ done, total: slugs.length });
      }
    };

    await Promise.all([worker(), worker(), worker()]);
    setRunning(false);
    toast('链接检测完成', 'success');
  };

  const counts = useMemo(() => {
    const result = { ok: 0, invalid: 0, failed: 0, unknown: 0 };
    Object.values(results).forEach((item) => {
      if (item.status in result) result[item.status as keyof typeof result] += 1;
    });
    return result;
  }, [results]);

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat">
          <div className="label">可下载文章</div>
          <div className="value">{data.posts.filter(hasDownload).length}</div>
        </div>
        <div className="stat">
          <div className="label">可能失效</div>
          <div className="value">{counts.invalid}</div>
        </div>
        <div className="stat">
          <div className="label">无法判断 / 失败</div>
          <div className="value">{counts.unknown + counts.failed}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>资源链接检测</h2>
          <span className="muted">仅检测已填写下载地址的文章，不修改任何链接</span>
        </div>
        <div className="card-body">
          <div className="row-between" style={{ flexWrap: 'wrap', gap: 8 }}>
            <div className="row">
              <select className="select" value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="">全部</option>
                <option value="unchecked">未检测</option>
                <option value="ok">正常</option>
                <option value="invalid">可能失效</option>
                <option value="failed">检测失败</option>
                <option value="unknown">无法判断</option>
              </select>
              {running && (
                <span className="muted">
                  正在检测 {progress.done} / {progress.total}
                </span>
              )}
            </div>
            <div className="row">
              <button className="btn" disabled={running} onClick={() => runBatch(pending.map((post) => post.slug))}>
                检测全部未检测文章
              </button>
              <button className="btn btn-primary" disabled={running} onClick={() => runBatch(posts.map((post) => post.slug))}>
                重新检测当前列表
              </button>
            </div>
          </div>

          {error && <div className="alert error" style={{ marginTop: 12 }}>{error}</div>}

          {loading ? (
            <div className="empty"><p>正在读取检测结果…</p></div>
          ) : posts.length === 0 ? (
            <div className="empty">
              <div className="icon">🔗</div>
              <p>{filter ? '没有符合条件的文章' : '还没有带下载地址的文章'}</p>
            </div>
          ) : (
            <div className="table-wrap" style={{ marginTop: 12 }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>文章</th>
                    <th style={{ width: 120 }}>检测结果</th>
                    <th>说明</th>
                    <th style={{ width: 160 }}>上次检测</th>
                    <th style={{ width: 90 }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {posts.map((post) => {
                    const result = results[post.slug];
                    const meta = STATUS_META[result?.status || 'none'];
                    return (
                      <tr key={post.slug}>
                        <td>
                          <div className="title-cell">{post.title}</div>
                          <div className="muted" style={{ fontSize: 12 }}>
                            {(post.resources || []).filter((item) => item.visible && item.url).length} 个下载渠道
                          </div>
                        </td>
                        <td>
                          {result ? <span className={`badge ${meta.badge}`}>{meta.label}</span> : <span className="muted">未检测</span>}
                        </td>
                        <td className="muted">
                          {result?.message || '—'}
                          {result?.links && result.links.length > 0 && (
                            <div style={{ fontSize: 12, marginTop: 4 }}>
                              {result.links.map((link, index) => (
                                <a
                                  key={index}
                                  href={link.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  style={{ marginRight: 10 }}
                                >
                                  {link.name}（{STATUS_META[link.status]?.label || link.status}）
                                </a>
                              ))}
                            </div>
                          )}
                        </td>
                        <td className="muted">{result?.checkedAt ? new Date(result.checkedAt).toLocaleString('zh-CN', { hour12: false }) : '—'}</td>
                        <td>
                          <button className="btn btn-sm" disabled={running} onClick={() => checkOne(post.slug)}>
                            检测
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
