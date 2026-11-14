import { useState } from 'react';
import { api } from '../api';
import { useData } from '../context';
import type { HomeConfig, HomeModule } from '../types';
import { MediaPicker } from '../components/MediaPicker';
import { Field, useToast } from '../components/ui';

const MODULE_TYPES: { type: string; label: string; hint: string }[] = [
  { type: 'latest', label: '最新文章', hint: '按发布时间展示最新文章列表' },
  { type: 'featured', label: '推荐文章', hint: '展示你在下方勾选的文章' },
  { type: 'categories', label: '分类导航', hint: '展示所有开启显示的分类' },
  { type: 'resources', label: '资源下载', hint: '展示带下载渠道的文章' },
  { type: 'text', label: '自定义文字', hint: '一段说明文字，支持换行' },
  { type: 'links', label: '友情链接', hint: '一组外部链接' },
];

function newModule(type: string, index: number): HomeModule {
  const meta = MODULE_TYPES.find((item) => item.type === type);
  return {
    id: `module-${Date.now()}-${index}`,
    type,
    title: meta?.label || '内容模块',
    visible: true,
    limit: type === 'latest' || type === 'resources' ? 6 : undefined,
    text: type === 'text' ? '' : undefined,
    links: type === 'links' ? [{ label: '示例链接', href: 'https://' }] : undefined,
  };
}

export function HomePage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const [home, setHome] = useState<HomeConfig>(() => ({
    ...data.home,
    categories: data.home.categories || [],
    footer: data.home.footer || '',
  }));
  const [sha, setSha] = useState<string | null>(data.homeSha);
  const [picker, setPicker] = useState<null | { target: 'hero' | { slide: number } }>(null);
  const [busy, setBusy] = useState(false);

  const update = <K extends keyof HomeConfig>(key: K, value: HomeConfig[K]) =>
    setHome((prev) => ({ ...prev, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      const result = await api<{ sha: string }>('home', { method: 'PUT', body: { home, sha } });
      setSha(result.sha);
      await refresh();
      toast('首页配置已保存并同步到 GitHub', 'success');
    } catch (error: any) {
      toast(error.message || '保存失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const moveModule = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= home.modules.length) return;
    const next = [...home.modules];
    [next[index], next[target]] = [next[target], next[index]];
    update('modules', next);
  };

  const updateModule = (index: number, changes: Partial<HomeModule>) => {
    update(
      'modules',
      home.modules.map((item, i) => (i === index ? { ...item, ...changes } : item))
    );
  };

  const moveFeatured = (slug: string, direction: -1 | 1) => {
    const index = home.featured.indexOf(slug);
    const target = index + direction;
    if (index === -1 || target < 0 || target >= home.featured.length) return;
    const next = [...home.featured];
    [next[index], next[target]] = [next[target], next[index]];
    update('featured', next);
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>首页公告</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={home.announcement.visible}
              onChange={(event) =>
                update('announcement', { ...home.announcement, visible: event.target.checked })
              }
            />
            在首页顶部显示
          </label>
        </div>
        <div className="card-body stack">
          <Field label="公告内容">
            <input
              className="input"
              value={home.announcement.text}
              placeholder="例如：本站资源全部免费，持续更新中…"
              onChange={(event) => update('announcement', { ...home.announcement, text: event.target.value })}
            />
          </Field>
          <Field label="公告链接（可选）">
            <input
              className="input"
              value={home.announcement.link}
              placeholder="https://…"
              onChange={(event) => update('announcement', { ...home.announcement, link: event.target.value })}
            />
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>首页头部（Hero）</h2>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={home.hero.visible}
              onChange={(event) => update('hero', { ...home.hero, visible: event.target.checked })}
            />
            显示
          </label>
        </div>
        <div className="card-body stack">
          <div className="grid-2">
            <Field label="主标题" hint="留空时使用网站名称">
              <input
                className="input"
                value={home.hero.title}
                onChange={(event) => update('hero', { ...home.hero, title: event.target.value })}
              />
            </Field>
            <Field label="副标题" hint="留空时使用网站副标题">
              <input
                className="input"
                value={home.hero.subtitle}
                onChange={(event) => update('hero', { ...home.hero, subtitle: event.target.value })}
              />
            </Field>
          </div>
          <Field label="头部背景图（可选）">
            <div className="row">
              <input
                className="input"
                style={{ flex: 1 }}
                value={home.hero.image}
                onChange={(event) => update('hero', { ...home.hero, image: event.target.value })}
              />
              <button className="btn" onClick={() => setPicker({ target: 'hero' })}>
                选择图片
              </button>
            </div>
          </Field>
          {home.hero.image && <img src={home.hero.image} alt="头部背景" style={{ maxHeight: 160, borderRadius: 10 }} />}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>首页轮播图（{home.slides.length}）</h2>
          <button
            className="btn btn-sm"
            onClick={() =>
              update('slides', [
                ...home.slides,
                { id: `slide-${Date.now()}`, image: '', title: '', link: '', visible: true },
              ])
            }
          >
            ＋ 添加轮播图
          </button>
        </div>
        <div className="card-body stack">
          {home.slides.length === 0 && <p className="muted">还没有轮播图。建议尺寸 16:9。</p>}
          {home.slides.map((slide, index) => (
            <div className="card" key={slide.id} style={{ boxShadow: 'none' }}>
              <div className="card-body stack">
                <div className="row">
                  <input
                    className="input"
                    style={{ flex: 1 }}
                    placeholder="图片地址"
                    value={slide.image}
                    onChange={(event) =>
                      update(
                        'slides',
                        home.slides.map((item, i) => (i === index ? { ...item, image: event.target.value } : item))
                      )
                    }
                  />
                  <button className="btn" onClick={() => setPicker({ target: { slide: index } })}>
                    选择
                  </button>
                  <button
                    className="btn btn-danger"
                    onClick={() => update('slides', home.slides.filter((_, i) => i !== index))}
                  >
                    删除
                  </button>
                </div>
                <div className="grid-2">
                  <input
                    className="input"
                    placeholder="轮播标题"
                    value={slide.title}
                    onChange={(event) =>
                      update(
                        'slides',
                        home.slides.map((item, i) => (i === index ? { ...item, title: event.target.value } : item))
                      )
                    }
                  />
                  <input
                    className="input"
                    placeholder="跳转链接"
                    value={slide.link}
                    onChange={(event) =>
                      update(
                        'slides',
                        home.slides.map((item, i) => (i === index ? { ...item, link: event.target.value } : item))
                      )
                    }
                  />
                </div>
                <label className="checkbox">
                  <input
                    type="checkbox"
                    checked={slide.visible}
                    onChange={(event) =>
                      update(
                        'slides',
                        home.slides.map((item, i) => (i === index ? { ...item, visible: event.target.checked } : item))
                      )
                    }
                  />
                  显示这张轮播图
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>推荐文章顺序（{home.featured.length}）</h2>
        </div>
        <div className="card-body stack">
          {home.featured.length > 0 && (
            <div className="stack" style={{ gap: 6 }}>
              {home.featured.map((slug, index) => {
                const post = data.posts.find((item) => item.slug === slug);
                return (
                  <div className="sortable-row" key={slug} style={{ marginBottom: 0 }}>
                    <span className="muted">{index + 1}</span>
                    <span style={{ flex: 1 }}>{post?.title || slug}</span>
                    <button className="btn btn-sm" onClick={() => moveFeatured(slug, -1)}>
                      ↑
                    </button>
                    <button className="btn btn-sm" onClick={() => moveFeatured(slug, 1)}>
                      ↓
                    </button>
                    <button
                      className="btn btn-sm btn-danger"
                      onClick={() => update('featured', home.featured.filter((item) => item !== slug))}
                    >
                      移除
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          <Field label="勾选要推荐的文章">
            <div className="stack" style={{ gap: 6, maxHeight: 260, overflowY: 'auto' }}>
              {data.posts.map((post) => (
                <label className="checkbox" key={post.slug}>
                  <input
                    type="checkbox"
                    checked={home.featured.includes(post.slug)}
                    onChange={(event) => {
                      if (event.target.checked) update('featured', [...home.featured, post.slug]);
                      else update('featured', home.featured.filter((item) => item !== post.slug));
                    }}
                  />
                  {post.title}
                  {post.draft && <span className="badge gray">草稿</span>}
                </label>
              ))}
              {data.posts.length === 0 && <span className="muted">还没有文章。</span>}
            </div>
          </Field>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>首页展示分类</h2>
          <button className="btn btn-sm" onClick={() => update('categories', [])}>
            显示全部
          </button>
        </div>
        <div className="card-body">
          <p className="muted" style={{ marginTop: 0 }}>
            不勾选任何分类时，首页「分类导航」模块会显示所有开启显示的分类。
          </p>
          <div className="stack" style={{ gap: 6 }}>
            {(home.categories || []).length === 0 && <span className="muted">当前：显示全部分类</span>}
            {data.categories.map((category) => {
              const checked = (home.categories || []).includes(category.slug);
              return (
                <label className="checkbox" key={category.id}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(event) => {
                      const current = home.categories || [];
                      update(
                        'categories',
                        event.target.checked
                          ? [...current, category.slug]
                          : current.filter((slug) => slug !== category.slug)
                      );
                    }}
                  />
                  {category.icon} {category.name}
                  {!category.visible && <span className="badge gray">前台已隐藏</span>}
                </label>
              );
            })}
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>首页底部介绍</h2>
        </div>
        <div className="card-body">
          <textarea
            className="textarea"
            placeholder="显示在首页内容模块下方的一段说明文字，可留空"
            value={home.footer || ''}
            onChange={(event) => update('footer', event.target.value)}
          />
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>首页模块</h2>
          <select
            className="select"
            style={{ width: 200 }}
            value=""
            onChange={(event) => {
              if (!event.target.value) return;
              update('modules', [...home.modules, newModule(event.target.value, home.modules.length)]);
              event.target.value = '';
            }}
          >
            <option value="">＋ 添加模块…</option>
            {MODULE_TYPES.map((item) => (
              <option key={item.type} value={item.type}>
                {item.label}
              </option>
            ))}
          </select>
        </div>
        <div className="card-body stack">
          {home.modules.map((module, index) => {
            const meta = MODULE_TYPES.find((item) => item.type === module.type);
            return (
              <div className="card" key={module.id} style={{ boxShadow: 'none' }}>
                <div className="card-head">
                  <h2>{module.title}</h2>
                  <span className="badge gray">{meta?.label || module.type}</span>
                  <label className="checkbox">
                    <input
                      type="checkbox"
                      checked={module.visible}
                      onChange={(event) => updateModule(index, { visible: event.target.checked })}
                    />
                    显示
                  </label>
                  <button className="btn btn-sm" onClick={() => moveModule(index, -1)}>
                    ↑
                  </button>
                  <button className="btn btn-sm" onClick={() => moveModule(index, 1)}>
                    ↓
                  </button>
                  <button
                    className="btn btn-sm btn-danger"
                    onClick={() => update('modules', home.modules.filter((_, i) => i !== index))}
                  >
                    删除
                  </button>
                </div>
                <div className="card-body stack">
                  <div className="grid-2">
                    <Field label="模块标题">
                      <input
                        className="input"
                        value={module.title}
                        onChange={(event) => updateModule(index, { title: event.target.value })}
                      />
                    </Field>
                    {(module.type === 'latest' || module.type === 'resources') && (
                      <Field label="最多显示条数">
                        <input
                          className="input"
                          type="number"
                          min={1}
                          max={30}
                          value={module.limit || 6}
                          onChange={(event) => updateModule(index, { limit: Number(event.target.value) })}
                        />
                      </Field>
                    )}
                  </div>
                  <p className="muted" style={{ margin: 0 }}>
                    {meta?.hint}
                  </p>
                  {module.type === 'text' && (
                    <textarea
                      className="textarea"
                      placeholder="模块文字内容"
                      value={module.text || ''}
                      onChange={(event) => updateModule(index, { text: event.target.value })}
                    />
                  )}
                  {module.type === 'links' && (
                    <div className="stack" style={{ gap: 8 }}>
                      {(module.links || []).map((link, linkIndex) => (
                        <div className="row" key={linkIndex}>
                          <input
                            className="input"
                            style={{ flex: 1 }}
                            placeholder="名称"
                            value={link.label}
                            onChange={(event) =>
                              updateModule(index, {
                                links: (module.links || []).map((item, i) =>
                                  i === linkIndex ? { ...item, label: event.target.value } : item
                                ),
                              })
                            }
                          />
                          <input
                            className="input"
                            style={{ flex: 2 }}
                            placeholder="https://…"
                            value={link.href}
                            onChange={(event) =>
                              updateModule(index, {
                                links: (module.links || []).map((item, i) =>
                                  i === linkIndex ? { ...item, href: event.target.value } : item
                                ),
                              })
                            }
                          />
                          <button
                            className="btn btn-sm btn-danger"
                            onClick={() =>
                              updateModule(index, {
                                links: (module.links || []).filter((_, i) => i !== linkIndex),
                              })
                            }
                          >
                            删除
                          </button>
                        </div>
                      ))}
                      <button
                        className="btn btn-sm"
                        onClick={() =>
                          updateModule(index, { links: [...(module.links || []), { label: '', href: 'https://' }] })
                        }
                      >
                        ＋ 添加链接
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="card">
        <div className="sticky-actions" style={{ borderRadius: 12 }}>
          <button
            className="btn"
            onClick={() =>
              setHome({
                ...JSON.parse(JSON.stringify(data.home)),
                categories: data.home.categories || [],
                footer: data.home.footer || '',
              })
            }
          >
            还原
          </button>
          <button className="btn btn-primary" onClick={save} disabled={busy}>
            {busy ? '保存中…' : '保存首页配置'}
          </button>
        </div>
      </div>

      <MediaPicker
        open={picker !== null}
        onClose={() => setPicker(null)}
        onPick={(url) => {
          if (!picker) return;
          if (picker.target === 'hero') update('hero', { ...home.hero, image: url });
          else {
            const index = picker.target.slide;
            update(
              'slides',
              home.slides.map((item, i) => (i === index ? { ...item, image: url } : item))
            );
          }
        }}
      />
    </div>
  );
}
