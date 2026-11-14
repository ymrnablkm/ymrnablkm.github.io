import { useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import { MediaPicker } from '../components/MediaPicker';
import { Field, useToast } from '../components/ui';
import { navigate } from '../components/ui';

export function SeoPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const [site, setSite] = useState(() => JSON.parse(JSON.stringify(data.site)));
  const [sha, setSha] = useState<string | null>(data.siteSha);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);

  const seo = site.seo || { title: '', description: '', keywords: [], ogImage: '' };

  const updateSeo = (key: string, value: any) =>
    setSite((prev: any) => ({ ...prev, seo: { ...(prev.seo || {}), [key]: value } }));

  const save = async () => {
    setBusy(true);
    try {
      const result = await api<{ sha: string }>('site', { method: 'PUT', body: { site, sha } });
      setSha(result.sha);
      await refresh();
      toast('SEO 设置已保存', 'success');
    } catch (error: any) {
      toast(error.message || '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const missing = data.posts.filter(
    (post) => !post.seoTitle || !post.seoDescription || post.keywords.length === 0
  );

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>网站 SEO</h2>
        </div>
        <div className="card-body stack">
          <Field label="网站标题">
            <input className="input" value={seo.title || ''} onChange={(event) => updateSeo('title', event.target.value)} />
          </Field>
          <Field label="网站描述">
            <textarea
              className="textarea"
              value={seo.description || ''}
              onChange={(event) => updateSeo('description', event.target.value)}
            />
          </Field>
          <Field label="关键词（逗号分隔）">
            <input
              className="input"
              value={(seo.keywords || []).join(',')}
              onChange={(event) =>
                updateSeo(
                  'keywords',
                  event.target.value
                    .split(/[,，]/)
                    .map((item: string) => item.trim())
                    .filter(Boolean)
                )
              }
            />
          </Field>
          <Field label="Open Graph 分享图" hint="分享到社交平台时显示的图片">
            <div className="row">
              <input
                className="input"
                style={{ flex: 1 }}
                value={seo.ogImage || ''}
                onChange={(event) => updateSeo('ogImage', event.target.value)}
              />
              <button className="btn" onClick={() => setPicker(true)}>
                选择图片
              </button>
            </div>
            {seo.ogImage && <img src={seo.ogImage} alt="OG" style={{ maxHeight: 150, marginTop: 8, borderRadius: 8 }} />}
          </Field>
          <div className="alert">
            Sitemap 会自动生成：<a href="/sitemap-index.xml" target="_blank" rel="noreferrer">/sitemap-index.xml</a>。
            RSS 与 Canonical 由页面自动输出。修改后保存即可同步。
          </div>
        </div>
        <div className="sticky-actions" style={{ borderRadius: 12 }}>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存 SEO 设置'}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>文章 SEO 检查（{missing.length} 篇待完善）</h2>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>文章</th>
                  <th>SEO 标题</th>
                  <th>SEO 描述</th>
                  <th>关键词</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {missing.map((post) => (
                  <tr key={post.slug}>
                    <td>
                      <span className="title-cell">{post.title}</span>
                    </td>
                    <td>{post.seoTitle ? <span className="badge green">已填</span> : <span className="badge orange">缺失</span>}</td>
                    <td>{post.seoDescription ? <span className="badge green">已填</span> : <span className="badge orange">缺失</span>}</td>
                    <td>{post.keywords.length ? <span className="badge green">已填</span> : <span className="badge orange">缺失</span>}</td>
                    <td>
                      <button className="btn btn-sm" onClick={() => navigate(`/posts/${post.slug}`)}>
                        去编辑
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {missing.length === 0 && <div className="empty">所有文章的 SEO 信息都已完善。</div>}
          </div>
        </div>
      </div>

      <MediaPicker open={picker} onClose={() => setPicker(false)} onPick={(url) => updateSeo('ogImage', url)} />
    </div>
  );
}
