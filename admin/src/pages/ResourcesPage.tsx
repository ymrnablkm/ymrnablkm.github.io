import { useState } from 'react';
import { useData } from '../context';
import { navigate } from '../components/ui';

export function ResourcesPage() {
  const { data } = useData();
  const [keyword, setKeyword] = useState('');

  const rows = data.posts.flatMap((post) =>
    (post.resources || []).map((resource) => ({ post, resource }))
  );

  const filtered = keyword
    ? rows.filter(
        ({ post, resource }) =>
          post.title.toLowerCase().includes(keyword.toLowerCase()) ||
          resource.name.toLowerCase().includes(keyword.toLowerCase()) ||
          resource.channel.toLowerCase().includes(keyword.toLowerCase())
      )
    : rows;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>资源管理（{rows.length} 个下载渠道）</h2>
        </div>
        <div className="card-body">
          <input
            className="input"
            placeholder="搜索文章标题、资源名称或渠道…"
            value={keyword}
            onChange={(event) => setKeyword(event.target.value)}
            style={{ marginBottom: 12 }}
          />
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>所属文章</th>
                  <th>资源名称</th>
                  <th>渠道</th>
                  <th>提取码</th>
                  <th>下载地址</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(({ post, resource }, index) => (
                  <tr key={`${post.slug}-${index}`}>
                    <td>
                      <button className="link-btn" onClick={() => navigate(`/posts/${post.slug}`)}>
                        <span className="title-cell">{post.title}</span>
                      </button>
                    </td>
                    <td>{resource.name}</td>
                    <td className="muted">{resource.channel || '—'}</td>
                    <td className="muted">{resource.code || '—'}</td>
                    <td>
                      {resource.url ? (
                        <a href={resource.url} target="_blank" rel="noreferrer">
                          打开链接 ↗
                        </a>
                      ) : (
                        <span className="muted">未填写</span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${resource.visible ? 'green' : 'gray'}`}>
                        {resource.visible ? '显示' : '隐藏'}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-sm" onClick={() => navigate(`/posts/${post.slug}`)}>
                        去编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="empty">
                <div className="icon">📦</div>
                <p>还没有下载渠道。进入任意文章，展开「资源下载信息」即可添加。</p>
                <button className="btn btn-primary" onClick={() => navigate('/posts/new')}>
                  新建资源文章
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
