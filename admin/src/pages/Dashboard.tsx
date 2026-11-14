import { useData } from '../context';
import { navigate } from '../components/ui';
import { formatDate } from '../api';

export function Dashboard() {
  const { data } = useData();
  const posts = data.posts;
  const published = posts.filter((post) => !post.draft).length;
  const drafts = posts.filter((post) => post.draft).length;
  const resources = posts.reduce((total, post) => total + (post.resources?.length || 0), 0);
  const latest = posts.slice(0, 5);
  const status = data.status;

  return (
    <div className="stack">
      <div className="stat-grid">
        <div className="stat">
          <div className="label">文章总数</div>
          <div className="value">{posts.length}</div>
        </div>
        <div className="stat">
          <div className="label">已发布</div>
          <div className="value">{published}</div>
        </div>
        <div className="stat">
          <div className="label">草稿</div>
          <div className="value">{drafts}</div>
        </div>
        <div className="stat">
          <div className="label">分类 / 标签</div>
          <div className="value">
            {data.categories.length}
            <small>/ {data.tags.length}</small>
          </div>
        </div>
        <div className="stat">
          <div className="label">图片</div>
          <div className="value">{data.media.length}</div>
        </div>
        <div className="stat">
          <div className="label">下载渠道</div>
          <div className="value">{resources}</div>
        </div>
        <div className="stat">
          <div className="label">独立页面</div>
          <div className="value">{data.pages.length}</div>
        </div>
        <div className="stat">
          <div className="label">回收站</div>
          <div className="value">{data.trash.length}</div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>快捷操作</h2>
        </div>
        <div className="card-body">
          <div className="quick-grid">
            <button className="quick" onClick={() => navigate('/posts/new')}>
              <span>➕</span>新建文章
            </button>
            <button className="quick" onClick={() => navigate('/categories')}>
              <span>🗂</span>新建分类
            </button>
            <button className="quick" onClick={() => navigate('/media')}>
              <span>📤</span>上传图片
            </button>
            <button className="quick" onClick={() => navigate('/home')}>
              <span>🖼</span>编辑首页
            </button>
            <button className="quick" onClick={() => navigate('/settings')}>
              <span>⚙️</span>修改网站设置
            </button>
            <button className="quick" onClick={() => navigate('/pages/new')}>
              <span>📄</span>新建独立页面
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>最近发布</h2>
          <button className="link-btn" onClick={() => navigate('/posts')}>
            查看全部 →
          </button>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {latest.length === 0 ? (
            <p className="muted" style={{ padding: 18 }}>
              还没有文章，点击上方「新建文章」开始。
            </p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>标题</th>
                    <th>分类</th>
                    <th>时间</th>
                    <th>状态</th>
                  </tr>
                </thead>
                <tbody>
                  {latest.map((post) => (
                    <tr key={post.slug} style={{ cursor: 'pointer' }} onClick={() => navigate(`/posts/${post.slug}`)}>
                      <td>
                        <span className="title-cell">{post.title}</span>
                      </td>
                      <td className="muted">
                        {data.categories.find((item) => item.slug === post.category)?.name || '未分类'}
                      </td>
                      <td className="muted">{formatDate(post.date)}</td>
                      <td>
                        <span className={`badge ${post.draft ? 'gray' : 'green'}`}>
                          {post.draft ? '草稿' : '已发布'}
                        </span>
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
          <h2>最近编辑与操作记录</h2>
          <button className="link-btn" onClick={() => navigate('/status')}>
            更多 →
          </button>
        </div>
        <div className="card-body stack" style={{ gap: 8 }}>
          {status.commits.length === 0 ? (
            <p className="muted" style={{ margin: 0 }}>
              还没有操作记录，发布或修改内容后会显示在这里。
            </p>
          ) : (
            status.commits.slice(0, 8).map((commit) => {
              const post = posts.find((item) => item.title && commit.message.includes(item.title));
              const label = commit.message.replace(/^后台/, '').replace(/（[^（）]*）\s*$/, '');
              return (
                <div className="sortable-row" key={commit.sha} style={{ marginBottom: 0 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {label}
                    </div>
                    <div className="muted" style={{ fontSize: 12 }}>
                      {formatDate(commit.date)} · {commit.author}
                    </div>
                  </div>
                  {post && (
                    <button className="btn btn-sm" onClick={() => navigate(`/posts/${post.slug}`)}>
                      继续编辑
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>同步与部署</h2>
          <button className="link-btn" onClick={() => navigate('/status')}>
            系统状态 →
          </button>
        </div>
        <div className="card-body">
          <div className="stack" style={{ gap: 10 }}>
            <div className="row">
              <span className="badge gray">{status.storeKind === 'local' ? '本地开发模式' : 'GitHub 同步'}</span>
              <span className="muted">
                仓库：{status.repo} / 分支：{status.branch}
              </span>
            </div>
            {status.commits[0] ? (
              <div className="alert success">
                最近提交：{status.commits[0].message}（{formatDate(status.commits[0].date)}）
              </div>
            ) : (
              <div className="alert">暂无提交记录。</div>
            )}
            {status.actions.available && status.actions.runs[0] ? (
              <div className="row">
                <span>最近部署：</span>
                <span
                  className={`badge ${
                    status.actions.runs[0].conclusion === 'success'
                      ? 'green'
                      : status.actions.runs[0].status === 'in_progress'
                        ? 'orange'
                        : status.actions.runs[0].conclusion
                          ? 'red'
                          : 'gray'
                  }`}
                >
                  {status.actions.runs[0].status === 'completed'
                    ? status.actions.runs[0].conclusion === 'success'
                      ? '部署成功'
                      : '部署失败'
                    : '部署进行中'}
                </span>
                <span className="muted">{formatDate(status.actions.runs[0].updatedAt)}</span>
              </div>
            ) : (
              <p className="muted" style={{ margin: 0 }}>
                部署状态需要 GITHUB_TOKEN 具备 actions 读取权限，配置后会自动显示。
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
