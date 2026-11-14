import { api } from '../api';
import { useData } from '../context';

export function AccountPage() {
  const { data, me } = useData();

  const logout = async () => {
    try {
      await api('auth/logout', { method: 'POST' });
    } finally {
      window.location.hash = '/';
      window.location.reload();
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>当前账号</h2>
        </div>
        <div className="card-body">
          <div className="row" style={{ gap: 14 }}>
            <div className="avatar" style={{ width: 54, height: 54 }}>
              {me.avatar ? <img src={me.avatar} alt={me.login} /> : me.login.slice(0, 1)}
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{me.name || me.login}</div>
              <div className="muted">GitHub 账号：{me.login}</div>
            </div>
            <button className="btn btn-danger" style={{ marginLeft: 'auto' }} onClick={logout}>
              退出登录
            </button>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>安全说明</h2>
        </div>
        <div className="card-body stack">
          <div className="alert success">登录采用 GitHub OAuth，服务端校验账号白名单与仓库写入权限。</div>
          <div className="alert success">会话保存在加密的 HttpOnly Cookie 中，GitHub Token 不会出现在前端页面。</div>
          <div className="alert success">所有写操作都需要 CSRF 校验，未登录用户无法调用管理接口。</div>
          <div className="alert">
            如果你更换了 GitHub 账号或需要收回权限，请同时更新部署平台的环境变量
            ADMIN_GITHUB_LOGIN，并重启部署。
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>数据与仓库</h2>
        </div>
        <div className="card-body stack">
          <div className="row">
            <span className="muted">当前仓库：</span>
            <span>{data.status.repo}</span>
          </div>
          <div className="row">
            <span className="muted">分支：</span>
            <span>{data.status.branch}</span>
          </div>
          <div className="alert">
            数据备份建议：定期在 GitHub 仓库中下载 ZIP，或在「版本管理」中查看历史提交。删除文章默认进入回收站，不会直接丢失。
          </div>
        </div>
      </div>
    </div>
  );
}
