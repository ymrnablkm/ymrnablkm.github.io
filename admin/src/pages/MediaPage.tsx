import { useRef, useState } from 'react';
import { api, formatBytes } from '../api';
import { useData } from '../context';
import type { MediaItem } from '../types';
import { Field, Modal, useConfirm, useToast } from '../components/ui';
import { uploadImage, replaceImage, safeFileName } from '../lib/upload';

export function MediaPage() {
  const { data, refresh } = useData();
  const toast = useToast();
  const confirm = useConfirm();
  const fileRef = useRef<HTMLInputElement>(null);
  const replaceRef = useRef<HTMLInputElement>(null);
  const [keyword, setKeyword] = useState('');
  const [folder, setFolder] = useState('');
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState<{ current: number; total: number; name: string } | null>(null);
  const [selected, setSelected] = useState<MediaItem | null>(null);
  const [dimensions, setDimensions] = useState<{ width: number; height: number } | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const [busy, setBusy] = useState(false);

  const folders = Array.from(
    new Set(data.media.map((item) => item.path.slice(0, item.path.lastIndexOf('/')).replace('public/images/', '')))
  ).sort();

  const filtered = data.media.filter((item) => {
    if (folder && !item.path.includes(`/${folder}/`)) return false;
    if (keyword && !item.path.toLowerCase().includes(keyword.toLowerCase())) return false;
    return true;
  });

  const handleUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    let success = 0;
    const list = Array.from(files);
    try {
      for (const [index, file] of list.entries()) {
        setProgress({ current: index + 1, total: list.length, name: file.name });
        try {
          await uploadImage(file);
          success += 1;
        } catch (error: any) {
          toast(`${file.name}：${error.message}`, 'error');
        }
      }
      if (success) {
        await refresh();
        toast(`已上传 ${success} 张图片并同步到 GitHub`, 'success');
      }
    } finally {
      setUploading(false);
      setProgress(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleReplace = async (files: FileList | null) => {
    if (!files || !files.length || !selected) return;
    setBusy(true);
    try {
      const result = await replaceImage(files[0], selected.path);
      setSelected({ ...selected, sha: result.sha });
      await refresh();
      setDimensions(null);
      toast('图片已替换，文章中的旧地址仍然有效', 'success');
    } catch (error: any) {
      toast(error.message || '替换失败', 'error');
    } finally {
      setBusy(false);
      if (replaceRef.current) replaceRef.current.value = '';
    }
  };

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      toast('图片地址已复制', 'success');
    } catch {
      toast(`复制失败，请手动复制：${url}`, 'error');
    }
  };

  const rename = async () => {
    if (!selected) return;
    const dir = selected.path.slice(0, selected.path.lastIndexOf('/') + 1);
    const ext = selected.name.split('.').pop() || '';
    const nextName = `${safeFileName(renameValue)}.${ext}`;
    if (!renameValue.trim()) {
      toast('请输入新的文件名', 'error');
      return;
    }
    setBusy(true);
    try {
      await api('media/rename', {
        method: 'PUT',
        body: { from: selected.path, to: `${dir}${nextName}` },
      });
      setSelected(null);
      await refresh();
      toast('图片已重命名', 'success');
    } catch (error: any) {
      toast(error.message || '重命名失败', 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (item: MediaItem) => {
    const ok = await confirm({
      title: '删除图片',
      message: `确定删除图片「${item.name}」吗？如果图片正在被文章使用，系统会提示。`,
      confirmText: '删除',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await api(`media?path=${encodeURIComponent(item.path)}`, { method: 'DELETE' });
      setSelected(null);
      await refresh();
      toast('图片已删除', 'success');
    } catch (error: any) {
      if (error.status === 409) {
        const detail = error.detail as { usage?: string[] } | undefined;
        const force = await confirm({
          title: '图片仍在使用',
          message: `${error.message}\n\n继续删除会导致这些位置图片失效，确定强制删除吗？`,
          confirmText: '强制删除',
          danger: true,
        });
        if (force) {
          try {
            await api(`media?path=${encodeURIComponent(item.path)}&force=1`, { method: 'DELETE' });
            setSelected(null);
            await refresh();
            toast('图片已强制删除', 'success');
          } catch (err: any) {
            toast(err.message || '删除失败', 'error');
          }
        }
        void detail;
      } else {
        toast(error.message || '删除失败', 'error');
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>媒体库（{data.media.length}）</h2>
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? `上传中 ${progress?.current || 1}/${progress?.total || 1}…` : '＋ 上传图片'}
          </button>
        </div>
        <div className="card-body">
          <div className="row" style={{ marginBottom: 14 }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder="搜索图片…"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
            />
            <select className="select" style={{ maxWidth: 170 }} value={folder} onChange={(event) => setFolder(event.target.value)}>
              <option value="">全部目录</option>
              {folders.map((item) => (
                <option key={item} value={item}>
                  {item || '根目录'}
                </option>
              ))}
            </select>
          </div>
          {uploading && progress && (
            <div className="alert" style={{ marginBottom: 12 }}>
              正在上传第 {progress.current} / {progress.total} 张：{progress.name}
            </div>
          )}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => handleUpload(event.target.files)}
          />
          <input
            ref={replaceRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(event) => handleReplace(event.target.files)}
          />

          {filtered.length === 0 ? (
            <div className="empty">
              <div className="icon">📷</div>
              <p>还没有图片，点击右上角从手机相册或电脑上传。</p>
            </div>
          ) : (
            <div className="media-grid">
              {filtered.map((item) => (
                <button
                  key={item.path}
                  className="media-card"
                  style={{ padding: 0, cursor: 'pointer', textAlign: 'left', border: '1px solid var(--border)' }}
                  onClick={() => {
                    setSelected(item);
                    setDimensions(null);
                    setRenameValue(item.name.replace(/\.[^.]+$/, ''));
                  }}
                >
                  <div className="thumb">
                    <img src={item.url} alt={item.name} loading="lazy" />
                  </div>
                  <div className="meta">
                    <span className="name">{item.name}</span>
                    <span>{formatBytes(item.size)}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {selected && (
        <Modal
          title="图片详情"
          wide
          onClose={() => setSelected(null)}
          footer={
            <>
              <button className="btn" onClick={() => copy(selected.url)}>
                复制地址
              </button>
              <button className="btn" onClick={() => replaceRef.current?.click()} disabled={busy}>
                替换图片
              </button>
              <a className="btn" href={selected.url} target="_blank" rel="noreferrer">
                查看原图
              </a>
              <button className="btn btn-danger" onClick={() => remove(selected)} disabled={busy}>
                删除
              </button>
            </>
          }
        >
          <div className="stack">
            <img
              src={selected.sha ? `${selected.url}?v=${selected.sha}` : selected.url}
              alt={selected.name}
              style={{ maxHeight: 320, objectFit: 'contain' }}
              onLoad={(event) =>
                setDimensions({
                  width: event.currentTarget.naturalWidth,
                  height: event.currentTarget.naturalHeight,
                })
              }
            />
            <div className="field">
              <label>图片地址</label>
              <input className="input" value={selected.url} readOnly onFocus={(event) => event.currentTarget.select()} />
            </div>
            <div className="grid-2">
              <Field label="文件路径">
                <input className="input" value={selected.path} readOnly />
              </Field>
              <Field label="文件大小">
                <input className="input" value={formatBytes(selected.size)} readOnly />
              </Field>
              <Field label="图片尺寸">
                <input
                  className="input"
                  value={dimensions ? `${dimensions.width} × ${dimensions.height} px` : '读取中…'}
                  readOnly
                />
              </Field>
              <Field label="存放目录">
                <input className="input" value={selected.path.slice(0, selected.path.lastIndexOf('/'))} readOnly />
              </Field>
            </div>
            <Field label="重命名">
              <div className="row">
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={renameValue}
                  onChange={(event) => setRenameValue(event.target.value)}
                />
                <button className="btn" onClick={rename} disabled={busy}>
                  保存名称
                </button>
              </div>
            </Field>
          </div>
        </Modal>
      )}
    </div>
  );
}
