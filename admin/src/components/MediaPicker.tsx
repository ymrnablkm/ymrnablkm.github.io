import { useEffect, useRef, useState } from 'react';
import { api, formatBytes } from '../api';
import type { MediaItem } from '../types';
import { Modal, useToast } from './ui';
import { uploadImage } from '../lib/upload';

/** 上传文件名前缀为 Date.now() 时间戳；优先按真实上传时间（文件名时间戳）倒序，缺失时回退路径倒序。 */
function newestFirst(a: MediaItem, b: MediaItem) {
  const stampOf = (name: string) => Number((name.match(/^(\d{10,})/) || [])[1] || 0);
  const ta = stampOf(a.name);
  const tb = stampOf(b.name);
  if (ta !== tb) return tb - ta;
  return b.path.localeCompare(a.path);
}

export function MediaPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (urls: string[]) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setPicked([]);
    setFailed({});
    setLoading(true);
    api<{ media: MediaItem[] }>('media')
      .then((data) => setItems([...(data.media || [])].sort(newestFirst)))
      .catch((error) => toast(error.message, 'error'))
      .finally(() => setLoading(false));
  }, [open, toast]);

  if (!open) return null;

  const filtered = keyword
    ? items.filter((item) => item.path.toLowerCase().includes(keyword.toLowerCase()))
    : items;

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const result = await uploadImage(file);
        setItems((prev) =>
          [
            { path: result.path, name: result.path.split('/').pop() || '', size: file.size, url: result.url },
            ...prev,
          ].sort(newestFirst)
        );
      }
      toast('图片已上传并同步到 GitHub', 'success');
    } catch (error: any) {
      toast(error.message || '上传失败', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const toggle = (url: string) => {
    setPicked((prev) => (prev.includes(url) ? prev.filter((item) => item !== url) : [...prev, url]));
  };

  const insert = () => {
    if (picked.length === 0) return;
    onPick(picked);
    onClose();
  };

  return (
    <Modal
      title="选择图片（可多选）"
      wide
      onClose={onClose}
      footer={
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => handleFiles(event.target.files)}
          />
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? '上传中…' : '📤 上传新图片'}
          </button>
          <span className={`pick-count${picked.length ? ' has' : ''}`}>已选择 {picked.length} 张</span>
          <button className="btn" onClick={onClose}>
            取消
          </button>
          <button className="btn btn-primary" onClick={insert} disabled={picked.length === 0}>
            插入所选图片（{picked.length}）
          </button>
        </>
      }
    >
      <input
        className="input"
        placeholder="搜索图片名称…"
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        style={{ marginBottom: 14 }}
      />
      {loading ? (
        <p className="muted">正在读取图片列表…</p>
      ) : filtered.length === 0 ? (
        <p className="muted">还没有图片，点击左下角「上传新图片」从手机相册或电脑选择。</p>
      ) : (
        <div className="media-grid">
          {filtered.map((item) => {
            const order = picked.indexOf(item.url);
            const active = order !== -1;
            return (
              <button
                key={item.path}
                type="button"
                className={`media-card${active ? ' selected' : ''}`}
                aria-pressed={active}
                style={{ cursor: 'pointer', padding: 0, textAlign: 'left' }}
                onClick={() => toggle(item.url)}
              >
                <div className="thumb">
                  {failed[item.path] ? (
                    <div className="thumb-error">
                      <span className="thumb-error-icon">🖼️</span>
                      <span>图片加载失败</span>
                    </div>
                  ) : (
                    <img
                      src={item.url}
                      alt={item.name}
                      loading="lazy"
                      onError={() => setFailed((prev) => ({ ...prev, [item.path]: true }))}
                    />
                  )}
                  {active && <span className="pick-badge">{order + 1}</span>}
                </div>
                <div className="meta">
                  <span className="name">{item.name}</span>
                  <span>{formatBytes(item.size)}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
