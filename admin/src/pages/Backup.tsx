import { useState } from 'react';
import { downloadFile, uploadBinary } from '../api';
import { useToast } from '../components/ui';

interface PreviewData {
  manifest: { createdAt?: string; counts?: Record<string, number>; warnings?: string[] };
  counts: { posts: number; pages: number; configs: number; images: number };
  posts: { slug: string; title: string; date: string }[];
  conflicts: string[];
  conflictCount: number;
  missingImages: string[];
  warnings: string[];
}

export function BackupPage() {
  const toast = useToast();
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [fileName, setFileName] = useState('');
  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [overwrite, setOverwrite] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<string>('');

  const exportBackup = async (withImages: boolean) => {
    setBusy(withImages ? 'export-images' : 'export');
    setError('');
    try {
      const stamp = new Date().toISOString().slice(0, 10);
      await downloadFile(
        `backup/export?images=${withImages ? '1' : '0'}`,
        `ymrnablkm-backup-${stamp}${withImages ? '' : '-no-images'}.zip`
      );
      toast('备份已开始下载', 'success');
    } catch (err: any) {
      setError(err.message || '导出失败');
    } finally {
      setBusy('');
    }
  };

  const pickFile = async (file: File | null) => {
    if (!file) return;
    setError('');
    setPreview(null);
    setResult('');
    setConfirmText('');
    setFileName(file.name);
    if (file.size > 25 * 1024 * 1024) {
      setError('备份文件过大（上限 25MB）');
      return;
    }
    const data = await file.arrayBuffer();
    setBuffer(data);
    setBusy('preview');
    try {
      const res = await uploadBinary<{ preview: PreviewData }>('backup/preview', data);
      setPreview(res.preview);
      toast('备份文件校验通过', 'success');
    } catch (err: any) {
      setError(err.message || '备份文件校验失败');
      setBuffer(null);
    } finally {
      setBusy('');
    }
  };

  const restore = async () => {
    if (!buffer || !preview) return;
    if (confirmText.trim() !== '恢复') {
      setError('请输入「恢复」两个字以确认操作');
      return;
    }
    setBusy('restore');
    setError('');
    setResult('');
    try {
      const res = await uploadBinary<{ written: number; skipped: number; commit: string | null; warnings: string[] }>(
        `backup/restore?overwrite=${overwrite ? '1' : '0'}`,
        buffer,
        { 'X-Backup-Confirm': 'RESTORE' }
      );
      setResult(
        `恢复完成：写入 ${res.written} 个文件，跳过 ${res.skipped} 个` +
          (res.commit ? `，提交 ${res.commit.slice(0, 10)}` : '') +
          '。GitHub Pages / Cloudflare Pages 通常需要 1-3 分钟重新部署。'
      );
      toast('恢复完成', 'success');
      setConfirmText('');
    } catch (err: any) {
      setError(err.message || '恢复失败');
    } finally {
      setBusy('');
    }
  };

  return (
    <div className="stack">
      <div className="card">
        <div className="card-head">
          <h2>导出备份</h2>
          <span className="muted">包含文章、页面、站点配置与可选图片</span>
        </div>
        <div className="card-body">
          <div className="row" style={{ flexWrap: 'wrap' }}>
            <button className="btn btn-primary" disabled={Boolean(busy)} onClick={() => exportBackup(true)}>
              {busy === 'export-images' ? '正在打包…' : '导出完整备份（含图片）'}
            </button>
            <button className="btn" disabled={Boolean(busy)} onClick={() => exportBackup(false)}>
              {busy === 'export' ? '正在打包…' : '仅导出文字内容（不含图片）'}
            </button>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            备份包为 ZIP（不压缩），包含 backup-manifest.json、全部文章/页面、站点配置和 public/images 下的图片。不包含密钥、账号信息或浏览器数据。
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>从备份恢复</h2>
          <span className="muted">先校验，再恢复；默认不覆盖现有文件</span>
        </div>
        <div className="card-body">
          <div className="field">
            <label>选择备份文件（.zip，≤ 25MB）</label>
            <input
              type="file"
              accept=".zip,application/zip"
              className="input"
              onChange={(event) => pickFile(event.target.files?.[0] || null)}
            />
            {fileName && <p className="muted">已选择：{fileName}</p>}
          </div>

          {busy === 'preview' && <p className="muted">正在校验备份文件…</p>}

          {preview && (
            <div className="stack" style={{ marginTop: 12 }}>
              <div className="alert">
                <strong>校验通过</strong>
                <div style={{ marginTop: 6 }}>
                  文章 {preview.counts.posts} 篇，页面 {preview.counts.pages} 个，配置 {preview.counts.configs} 个，图片 {preview.counts.images} 张
                </div>
                {preview.manifest.createdAt && (
                  <div className="muted">备份创建时间：{new Date(preview.manifest.createdAt).toLocaleString('zh-CN', { hour12: false })}</div>
                )}
                {preview.conflictCount > 0 && (
                  <div className="muted">与现有文件同名：{preview.conflictCount} 个{overwrite ? '（将覆盖）' : '（默认跳过）'}</div>
                )}
                {preview.warnings.map((warning, index) => (
                  <div key={index} className="muted">· {warning}</div>
                ))}
                {preview.missingImages.length > 0 && (
                  <div className="muted">缺失封面：{preview.missingImages.join('；')}</div>
                )}
              </div>

              <div className="row">
                <label className="checkbox">
                  <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
                  覆盖同名文件（危险：会替换现有文章/配置/图片）
                </label>
              </div>

              <div className="field">
                <label>恢复确认：请输入「恢复」</label>
                <input className="input" value={confirmText} onChange={(event) => setConfirmText(event.target.value)} placeholder="恢复" />
              </div>

              <div className="row">
                <button className="btn btn-primary" disabled={Boolean(busy) || confirmText.trim() !== '恢复'} onClick={restore}>
                  {busy === 'restore' ? '正在恢复…' : '开始恢复'}
                </button>
                <span className="muted">恢复会生成一次 GitHub 提交，可在版本管理中回滚。</span>
              </div>
            </div>
          )}

          {result && <div className="alert" style={{ marginTop: 12 }}>{result}</div>}
          {error && <div className="alert error" style={{ marginTop: 12 }}>{error}</div>}
        </div>
      </div>
    </div>
  );
}
