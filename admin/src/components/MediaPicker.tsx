import { useEffect, useRef, useState } from 'react';
import { api, formatBytes } from '../api';
import type { MediaItem } from '../types';
import { Modal, useToast } from './ui';
import { uploadImage } from '../lib/upload';

export function MediaPicker({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [keyword, setKeyword] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    api<{ media: MediaItem[] }>('media')
      .then((data) => setItems(data.media || []))
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
        setItems((prev) => [
          { path: result.path, name: result.path.split('/').pop() || '', size: file.size, url: result.url },
          ...prev,
        ]);
      }
      toast('图片已上传并同步到 GitHub', 'success');
    } catch (error: any) {
      toast(error.message || '上传失败', 'error');
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Modal
      title="选择图片"
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
          <button className="btn" onClick={onClose}>
            关闭
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
          {filtered.map((item) => (
            <button
              key={item.path}
              className="media-card"
              style={{ cursor: 'pointer', padding: 0, textAlign: 'left' }}
              onClick={() => {
                onPick(item.url);
                onClose();
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
    </Modal>
  );
}
