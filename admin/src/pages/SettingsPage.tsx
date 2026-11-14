import { useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import type { SiteSettings } from '../types';
import { MediaPicker } from '../components/MediaPicker';
import { Field, useToast } from '../components/ui';

export function SettingsPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const [site, setSite] = useState<SiteSettings>(() => JSON.parse(JSON.stringify(data.site)));
  const [sha, setSha] = useState<string | null>(data.siteSha);
  const [picker, setPicker] = useState<null | 'logo' | 'icon' | 'defaultCover'>(null);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    setSite((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    if (!site.name.trim()) {
      toast('网站名称不能为空', 'error');
      return;
    }
    setBusy(true);
    try {
      const result = await api<{ sha: string }>('site', { method: 'PUT', body: { site, sha } });
      setSha(result.sha);
      await refresh();
      toast('网站设置已保存并同步到 GitHub', 'success');
    } catch (error: any) {
      toast(error.message || '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>基础信息</h2>
        </div>
        <div className="card-body stack">
          <div className="grid-2">
            <Field label="网站名称 *">
              <input className="input" value={site.name} onChange={(event) => update('name', event.target.value)} />
            </Field>
            <Field label="网站副标题">
              <input className="input" value={site.subtitle} onChange={(event) => update('subtitle', event.target.value)} />
            </Field>
          </div>
          <Field label="网站简介">
            <textarea className="textarea" value={site.description} onChange={(event) => update('description', event.target.value)} />
          </Field>
          <div className="grid-2">
            <Field label="网站域名" hint="例如 https://your-site.pages.dev">
              <input className="input" value={site.domain || ''} onChange={(event) => update('domain', event.target.value)} />
            </Field>
            <Field label="联系方式">
              <input className="input" value={site.contact} onChange={(event) => update('contact', event.target.value)} />
            </Field>
          </div>
          <Field label="首页介绍文字" hint="会显示在首页头部，可留空">
            <textarea className="textarea" value={site.intro || ''} onChange={(event) => update('intro', event.target.value)} />
          </Field>
          <Field label="全站公告" hint="留空则不显示公告条">
            <input className="input" value={site.announcement || ''} onChange={(event) => update('announcement', event.target.value)} />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>图标与封面</h2>
        </div>
        <div className="card-body stack">
          {(
            [
              ['logo', '网站 Logo', site.logo, (value: string) => update('logo', value)],
              ['icon', '网站图标（favicon）', site.icon || '', (value: string) => update('icon', value)],
              ['defaultCover', '默认封面图', site.defaultCover, (value: string) => update('defaultCover', value)],
            ] as const
          ).map(([key, label, value, setValue]) => (
            <Field label={label} key={key}>
              <div className="row">
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={value}
                  onChange={(event) => (setValue as (v: string) => void)(event.target.value)}
                />
                <button className="btn" onClick={() => setPicker(key)}>
                  选择图片
                </button>
              </div>
              {value && key !== 'icon' && (
                <img src={value} alt={label} style={{ maxHeight: 70, marginTop: 8, borderRadius: 8 }} />
              )}
            </Field>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>页脚与备案</h2>
        </div>
        <div className="card-body stack">
          <div className="grid-2">
            <Field label="页脚文字">
              <input className="input" value={site.footerText} onChange={(event) => update('footerText', event.target.value)} />
            </Field>
            <Field label="版权信息">
              <input className="input" value={site.copyright} onChange={(event) => update('copyright', event.target.value)} />
            </Field>
          </div>
          <Field label="备案信息">
            <input className="input" value={site.icp} onChange={(event) => update('icp', event.target.value)} />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>社交链接</h2>
          <button
            className="btn btn-sm"
            onClick={() => update('social', [...(site.social || []), { label: '', href: '' }])}
          >
            ＋ 添加链接
          </button>
        </div>
        <div className="card-body stack">
          {(site.social || []).length === 0 && <p className="muted">还没有社交链接。</p>}
          {(site.social || []).map((link, index) => (
            <div className="row" key={index}>
              <input
                className="input"
                style={{ flex: 1 }}
                placeholder="名称，例如 GitHub"
                value={link.label}
                onChange={(event) =>
                  update(
                    'social',
                    (site.social || []).map((item, i) => (i === index ? { ...item, label: event.target.value } : item))
                  )
                }
              />
              <input
                className="input"
                style={{ flex: 2 }}
                placeholder="https://…"
                value={link.href}
                onChange={(event) =>
                  update(
                    'social',
                    (site.social || []).map((item, i) => (i === index ? { ...item, href: event.target.value } : item))
                  )
                }
              />
              <button
                className="btn btn-sm btn-danger"
                onClick={() => update('social', (site.social || []).filter((_, i) => i !== index))}
              >
                删除
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="sticky-actions" style={{ borderRadius: 12 }}>
          <button className="btn" onClick={() => setSite(JSON.parse(JSON.stringify(data.site)))}>
            还原
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存设置'}
          </button>
        </div>
      </div>

      <MediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPick={(url) => {
          if (picker) update(picker, url);
        }}
      />
    </div>
  );
}
