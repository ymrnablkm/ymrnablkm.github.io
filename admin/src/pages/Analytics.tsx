import { useEffect, useMemo, useState } from 'react';
import { api, downloadFile } from '../api';
import { useData } from '../context';

interface DailyItem {
  date: string;
  pv: number;
  uv: number;
  m: number;
  d: number;
}

interface Overview {
  daily: DailyItem[];
  totalPv: number;
  totalUv: number;
  today: { pv: number; uv: number };
  yesterday: { pv: number; uv: number };
  last7: { pv: number; uv: number };
  last30: { pv: number; uv: number };
  devices: { mobile: number; desktop: number };
}

interface AnalyticsResponse {
  overview: Overview;
  topArticles: { slug: string; views: number }[];
}

const EMPTY: Overview = {
  daily: [],
  totalPv: 0,
  totalUv: 0,
  today: { pv: 0, uv: 0 },
  yesterday: { pv: 0, uv: 0 },
  last7: { pv: 0, uv: 0 },
  last30: { pv: 0, uv: 0 },
  devices: { mobile: 0, desktop: 0 },
};

interface StorageInfo {
  kind: string;
  d1Bound: boolean;
  kvAvailable: boolean;
  bindingName: string;
  d1Count: number;
  d1Total: number;
  kvCount: number;
  kvTotal: number;
}

const EMPTY_STORAGE: StorageInfo = {
  kind: 'unknown',
  d1Bound: false,
  kvAvailable: false,
  bindingName: '',
  d1Count: 0,
  d1Total: 0,
  kvCount: 0,
  kvTotal: 0,
};

export function AnalyticsPage() {
  const { data } = useData();
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview>(EMPTY);
  const [top, setTop] = useState<{ slug: string; views: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storage, setStorage] = useState<StorageInfo>(EMPTY_STORAGE);
  const [migrating, setMigrating] = useState('');
  const [migrateResult, setMigrateResult] = useState('');

  const loadStorage = () => {
    api<StorageInfo>('views/storage')
      .then((res) => setStorage({ ...EMPTY_STORAGE, ...res }))
      .catch(() => setStorage(EMPTY_STORAGE));
  };

  const runMigrate = async (dryRun: boolean) => {
    setMigrating(dryRun ? 'dry' : 'run');
    setMigrateResult('');
    try {
      const res = await api<{ result: any }>('views/migrate', { method: 'POST', body: { dryRun } });
      const r = res.result || {};
      setMigrateResult(
        `${dryRun ? '预演结果' : '迁移完成'}：KV 文章 ${r.kvArticles} 篇 / 阅读数 ${r.kvTotalViews}；` +
          `D1 现有 ${r.d1Articles} 篇 / 阅读数 ${r.d1TotalViews}；` +
          `本次写入 ${r.inserted} 篇、更新 ${r.updated} 篇、无需变更 ${r.unchanged} 篇。`
      );
      if (!dryRun) loadStorage();
    } catch (err: any) {
      setMigrateResult(err.message || '迁移失败');
    } finally {
      setMigrating('');
    }
  };

  useEffect(() => {
    loadStorage();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    api<AnalyticsResponse>(`analytics?days=${days}`)
      .then((res) => {
        if (!alive) return;
        setOverview(res.overview || EMPTY);
        setTop(res.topArticles || []);
        setError('');
      })
      .catch((err: any) => {
        if (alive) setError(err.message || '读取访问统计失败');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [days]);

  const titles = useMemo(() => {
    const map: Record<string, string> = {};
    data.posts.forEach((post) => {
      map[post.slug] = post.title;
    });
    return map;
  }, [data.posts]);

  const maxPv = Math.max(1, ...overview.daily.map((item) => item.pv));
  const deviceTotal = overview.devices.mobile + overview.devices.desktop;
  const mobilePercent = deviceTotal ? Math.round((overview.devices.mobile / deviceTotal) * 100) : 0;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>访问统计</h2>
          <select className="select" value={days} onChange={(event) => setDays(Number(event.target.value))}>
            <option value={7}>近 7 天</option>
            <option value={30}>近 30 天</option>
            <option value={90}>近 90 天</option>
          </select>
        </div>
        <div className="card-body">
          {error && <div className="alert error">{error}</div>}
          <div className="stat-grid">
            <div className="stat">
              <div className="label">今日浏览量</div>
              <div className="value">{overview.today.pv}</div>
            </div>
            <div className="stat">
              <div className="label">今日访客数</div>
              <div className="value">{overview.today.uv}</div>
            </div>
            <div className="stat">
              <div className="label">昨日浏览量</div>
              <div className="value">{overview.yesterday.pv}</div>
            </div>
            <div className="stat">
              <div className="label">近 7 天浏览量</div>
              <div className="value">{overview.last7.pv}</div>
            </div>
            <div className="stat">
              <div className="label">近 30 天浏览量</div>
              <div className="value">{overview.last30.pv}</div>
            </div>
            <div className="stat">
              <div className="label">累计浏览量</div>
              <div className="value">{overview.totalPv}</div>
            </div>
            <div className="stat">
              <div className="label">累计独立访客</div>
              <div className="value">{overview.totalUv}</div>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            统计从本功能上线后开始累计；访客按浏览器匿名标识去重，不记录 IP、正文或第三方脚本。{loading ? ' 正在刷新…' : ''}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>每日浏览趋势</h2>
          <span className="muted">共 {overview.daily.length} 天</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 160 }}>
            {overview.daily.map((item) => (
              <div
                key={item.date}
                title={`${item.date}：浏览 ${item.pv}，访客 ${item.uv}`}
                style={{
                  flex: 1,
                  minWidth: 4,
                  height: `${Math.max(2, Math.round((item.pv / maxPv) * 100))}%`,
                  background: '#165DFF',
                  borderRadius: 2,
                  opacity: item.pv ? 1 : 0.15,
                }}
              />
            ))}
          </div>
          <div className="row-between" style={{ marginTop: 6 }}>
            <span className="muted">{overview.daily[0]?.date || ''}</span>
            <span className="muted">{overview.daily[overview.daily.length - 1]?.date || ''}</span>
          </div>
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-head">
            <h2>设备类型</h2>
          </div>
          <div className="card-body">
            <div className="row-between">
              <span>手机</span>
              <strong>{overview.devices.mobile}（{mobilePercent}%）</strong>
            </div>
            <div style={{ height: 8, background: '#F2F3F5', borderRadius: 4, margin: '6px 0 12px' }}>
              <div style={{ width: `${mobilePercent}%`, height: '100%', background: '#165DFF', borderRadius: 4 }} />
            </div>
            <div className="row-between">
              <span>桌面</span>
              <strong>{overview.devices.desktop}（{100 - mobilePercent}%）</strong>
            </div>
            <div style={{ height: 8, background: '#F2F3F5', borderRadius: 4, marginTop: 6 }}>
              <div style={{ width: `${100 - mobilePercent}%`, height: '100%', background: '#00B42A', borderRadius: 4 }} />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>文章阅读排行</h2>
            <span className="muted">仅后台可见</span>
          </div>
          <div className="card-body">
            {top.length === 0 ? (
              <div className="empty"><p>暂无阅读数据</p></div>
            ) : (
              <div className="stack" style={{ gap: 8 }}>
                {top.slice(0, 10).map((item, index) => (
                  <div key={item.slug} className="row-between" style={{ gap: 12 }}>
                    <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      <span className="muted" style={{ marginRight: 8 }}>{index + 1}</span>
                      {titles[item.slug] || item.slug}
                    </span>
                    <strong>{item.views}</strong>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>阅读数存储</h2>
          <span className={`badge ${storage.kind === 'd1' ? 'green' : 'orange'}`}>
            {storage.kind === 'd1' ? 'D1 数据库' : storage.kind === 'kv' ? 'KV（旧）' : '本地内存'}
          </span>
        </div>
        <div className="card-body">
          <div className="row-between">
            <span>当前写入后端</span>
            <strong>{storage.kind === 'd1' ? `D1（绑定名 ${storage.bindingName}）` : storage.kind === 'kv' ? 'Cloudflare KV' : '本地内存'}</strong>
          </div>
          <div className="row-between" style={{ marginTop: 6 }}>
            <span>D1 文章数 / 阅读数</span>
            <strong>{storage.d1Count} / {storage.d1Total}</strong>
          </div>
          <div className="row-between" style={{ marginTop: 6 }}>
            <span>旧 KV 文章数 / 阅读数</span>
            <strong>{storage.kvCount} / {storage.kvTotal}</strong>
          </div>
          {!storage.d1Bound && (
            <p className="muted" style={{ marginTop: 8 }}>
              尚未绑定 D1（变量名 VIEWS_DB），阅读数仍在用 KV，受每日 1000 次写入限制。绑定后此处会显示「D1 数据库」。
            </p>
          )}
          <div className="row" style={{ marginTop: 10 }}>
            <button
              className="btn"
              disabled={Boolean(migrating) || !storage.kvAvailable}
              onClick={() =>
                downloadFile('views/export', `kv-views-backup-${new Date().toISOString().slice(0, 10)}.json`).catch(
                  (err: any) => setMigrateResult(err.message || '导出失败')
                )
              }
            >
              导出旧 KV 备份
            </button>
            <button className="btn" disabled={Boolean(migrating) || !storage.d1Bound} onClick={() => runMigrate(true)}>
              {migrating === 'dry' ? '预演中…' : '预演迁移'}
            </button>
            <button className="btn btn-primary" disabled={Boolean(migrating) || !storage.d1Bound} onClick={() => runMigrate(false)}>
              {migrating === 'run' ? '迁移中…' : '迁移历史阅读数到 D1'}
            </button>
          </div>
          {migrateResult && <div className="alert" style={{ marginTop: 10 }}>{migrateResult}</div>}
          <p className="muted" style={{ marginTop: 8 }}>
            迁移只升不降：D1 中已有更高值时不会被覆盖，旧 KV 数据不会被删除。
          </p>
        </div>
      </div>
    </div>
  );
}
