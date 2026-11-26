import { useEffect, useMemo, useState } from 'react';
import { api } from '../api';
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

export function AnalyticsPage() {
  const { data } = useData();
  const [days, setDays] = useState(30);
  const [overview, setOverview] = useState<Overview>(EMPTY);
  const [top, setTop] = useState<{ slug: string; views: number }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
    </div>
  );
}
