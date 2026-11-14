import { useEffect, useState } from 'react';
import { api, formatDate } from '../api';
import { useData } from '../context';
import { Modal, useConfirm, useToast } from '../components/ui';

interface Commit {
  sha: string;
  message: string;
  date: string;
  author: string;
}

export function HistoryPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const [target, setTarget] = useState('');
  const [commits, setCommits] = useState<Commit[]>([]);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<{ sha: string; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const options = [
    ...data.posts.map((post) => ({ value: `content/posts/${post.slug}.md`, label: `文章：${post.title}` })),
    ...data.pages.map((page) => ({ value: `content/pages/${page.slug}.md`, label: `页面：${page.title}` })),
    { value: 'content/site.json', label: '数据：网站设置' },
    { value: 'content/home.json', label: '数据：首页配置' },
    { value: 'content/categories.json', label: '数据：分类' },
    { value: 'content/tags.json', label: '数据：标签' },
    { value: 'content/nav.json', label: '数据：导航' },
  ];

  useEffect(() => {
    if (!target) {
      setCommits([]);
      return;
    }
    setLoading(true);
    api<{ commits: Commit[] }>(`history?path=${encodeURIComponent(target)}`)
      .then((result) => setCommits(result.commits || []))
      .catch((error) => toast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [target, toast]);

  const view = async (commit: Commit) => {
    try {
      const result = await api<{ text: string }>(
        `history/file?path=${encodeURIComponent(target)}&ref=${commit.sha}`
      );
      setPreview({ sha: commit.sha, text: result.text });
    } catch (error: any) {
      toast(error.message || '读取历史版本失败', 'error');
    }
  };

  const restore = async (commit: Commit) => {
    const ok = await confirm({
      title: '恢复历史版本',
      message: `确定把该文件恢复到提交 ${commit.sha.slice(0, 7)} 的内容吗？当前内容会作为一次新提交保存，可随时再恢复。`,
      confirmText: '恢复',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api('history/restore', { method: 'POST', body: { path: target, ref: commit.sha } });
      await refresh();
      toast('已恢复历史版本', 'success');
      setPreview(null);
      const result = await api<{ commits: Commit[] }>(`history?path=${encodeURIComponent(target)}`);
      setCommits(result.commits || []);
    } catch (error: any) {
      toast(error.message || '恢复失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>版本管理</h2>
        </div>
        <div className="card-body stack">
          <div className="field">
            <label>选择要查看历史的文件</label>
            <select className="select" value={target} onChange={(event) => setTarget(event.target.value)}>
              <option value="">请选择…</option>
              {options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          <div className="alert">
            所有修改都会自动提交到 GitHub，这里是每次提交的历史记录。恢复旧版本不会删除任何历史提交。
          </div>
        </div>
      </div>

      {target && (
        <div className="card">
          <div className="card-head">
            <h2>提交记录</h2>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {loading ? (
              <p className="muted" style={{ padding: 18 }}>
                正在读取提交记录…
              </p>
            ) : commits.length === 0 ? (
              <div className="empty">该文件还没有提交历史。</div>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>提交说明</th>
                      <th>作者</th>
                      <th>时间</th>
                      <th>编号</th>
                      <th>操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {commits.map((commit) => (
                      <tr key={commit.sha}>
                        <td>{commit.message}</td>
                        <td className="muted">{commit.author}</td>
                        <td className="muted">{formatDate(commit.date)}</td>
                        <td className="muted">{commit.sha.slice(0, 7)}</td>
                        <td>
                          <div className="row" style={{ gap: 4 }}>
                            <button className="btn btn-sm" onClick={() => view(commit)}>
                              查看
                            </button>
                            <button className="btn btn-sm" disabled={busy} onClick={() => restore(commit)}>
                              恢复此版本
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {preview && (
        <Modal
          title={`历史版本 ${preview.sha.slice(0, 7)}`}
          wide
          onClose={() => setPreview(null)}
          footer={
            <>
              <button className="btn" onClick={() => setPreview(null)}>
                关闭
              </button>
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() => {
                  const commit = commits.find((item) => item.sha === preview.sha);
                  if (commit) restore(commit);
                }}
              >
                恢复此版本
              </button>
            </>
          }
        >
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 12, maxHeight: 480, overflow: 'auto' }}>{preview.text}</pre>
        </Modal>
      )}
    </div>
  );
}
