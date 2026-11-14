import { useState } from 'react';
import { api, formatDate } from '../api';
import { useData } from '../context';
import { useToast } from '../components/ui';

export function StatusPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const status = data.status;

  const reload = async () => {
    setBusy(true);
    try {
      await refresh();
      toast('状态已刷新', 'success');
    } catch (error: any) {
      toast(error.message || '刷新失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>GitHub 连接状态</h2>
          <button className="btn btn-sm" onClick={reload} disabled={busy}>
            {busy ? '刷新中…' : '刷新状态'}
          </button>
        </div>
        <div className="card-body stack">
          <div className="row">
            <span className={`badge ${status.repoError ? 'red' : 'green'}`}>
              {status.repoError ? '连接异常' : '连接正常'}
            </span>
            <span className="muted">
              {status.repo} / {status.branch}
            </span>
          </div>
          {status.storeKind === 'local' && (
            <div className="alert">
              当前是本地开发模式，修改只会写入本地文件，不会提交到 GitHub。部署到 Cloudflare Pages
              并配置 GITHUB_TOKEN 后即为真实同步。
            </div>
          )}
          {status.repoError && <div className="alert error">{status.repoError}</div>}
          {status.repoInfo && (
            <div className="grid-2">
              <div className="stat">
                <div className="label">仓库</div>
                <div className="value" style={{ fontSize: 16 }}>
                  {status.repoInfo.fullName}
                </div>
              </div>
              <div className="stat">
                <div className="label">最后推送</div>
                <div className="value" style={{ fontSize: 16 }}>
                  {formatDate(status.repoInfo.pushedAt)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>最近提交</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>说明</th>
                  <th>作者</th>
                  <th>时间</th>
                  <th>编号</th>
                </tr>
              </thead>
              <tbody>
                {status.commits.map((commit) => (
                  <tr key={commit.sha}>
                    <td>{commit.message}</td>
                    <td className="muted">{commit.author}</td>
                    <td className="muted">{formatDate(commit.date)}</td>
                    <td className="muted">{commit.sha.slice(0, 7)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {status.commits.length === 0 && <div className="empty">暂无提交记录。</div>}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>自动部署状态</h2>
        </div>
        <div className="card-body">
          {!status.actions.available ? (
            <div className="alert">
              无法读取部署状态。请确认 GITHUB_TOKEN 具备 Actions 读取权限（或者使用 Fine-grained Token
              时勾选 Actions: Read）。这不会影响内容保存。
            </div>
          ) : status.actions.runs.length === 0 ? (
            <p className="muted">还没有部署记录。</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>任务</th>
                    <th>状态</th>
                    <th>更新时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {status.actions.runs.map((run) => (
                    <tr key={run.id}>
                      <td>{run.name}</td>
                      <td>
                        <span
                          className={`badge ${
                            run.status !== 'completed'
                              ? 'orange'
                              : run.conclusion === 'success'
                                ? 'green'
                                : 'red'
                          }`}
                        >
                          {run.status !== 'completed'
                            ? '进行中'
                            : run.conclusion === 'success'
                              ? '成功'
                              : '失败'}
                        </span>
                      </td>
                      <td className="muted">{formatDate(run.updatedAt)}</td>
                      <td>
                        {run.url && (
                          <a href={run.url} target="_blank" rel="noreferrer">
                            查看日志 ↗
                          </a>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>保存与同步说明</h2>
        </div>
        <div className="card-body stack">
          <div className="alert">
            每次在后台保存，都会通过服务端 API 提交到 GitHub。提交成功即代表已同步；Cloudflare Pages / GitHub
            Actions 检测到新提交后会自动重新构建网站。
          </div>
          <div className="alert">
            常见错误：<br />
            401 / 403：登录过期或无仓库权限，请重新登录。<br />
            409：文件被其他操作修改，刷新页面后重试。<br />
            500：网络或 GitHub 接口异常，稍后重试即可。
          </div>
        </div>
      </div>
    </div>
  );
}
