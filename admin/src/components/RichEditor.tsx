import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle, Color, FontSize } from '@tiptap/extension-text-style';
import { TableKit } from '@tiptap/extension-table';
import Youtube from '@tiptap/extension-youtube';
import Placeholder from '@tiptap/extension-placeholder';
import DragHandle from '@tiptap/extension-drag-handle-react';
import { Node, mergeAttributes } from '@tiptap/core';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import { marked } from 'marked';
import { MediaPicker } from './MediaPicker';
import { Modal } from './ui';

/* ---------------- Markdown 与编辑器 HTML 互转 ---------------- */
export function markdownToHtml(markdown: string): string {
  if (!markdown) return '<p></p>';
  return marked.parse(markdown, { gfm: true, breaks: false }) as string;
}

function createTurndown() {
  const service = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });
  const gfmPlugin = (gfm as any)?.gfm || gfm;
  if (gfmPlugin) service.use(gfmPlugin);

  const keepHtml = (node: any) => node.nodeName === 'DIV' && node.classList && node.classList.contains('notice');
  service.addRule('noticeBlock', {
    filter: keepHtml,
    replacement: (_content: string, node: any) => `\n\n${node.outerHTML}\n\n`,
  });
  service.addRule('downloadBlock', {
    filter: (node: any) => node.nodeName === 'DIV' && node.classList && node.classList.contains('download-row'),
    replacement: (_content: string, node: any) => `\n\n${node.outerHTML}\n\n`,
  });
  service.addRule('collapseBlock', {
    filter: (node: any) => node.nodeName === 'DETAILS',
    replacement: (_content: string, node: any) => `\n\n${String(node.outerHTML).replace(/\sopen=""/g, '')}\n\n`,
  });
  service.addRule('iframeBlock', {
    filter: (node: any) => node.nodeName === 'IFRAME',
    replacement: (_content: string, node: any) => `\n\n${node.outerHTML}\n\n`,
  });
  service.addRule('sizedImage', {
    filter: (node: any) => node.nodeName === 'IMG' && node.getAttribute && node.getAttribute('width'),
    replacement: (_content: string, node: any) => `\n\n${node.outerHTML}\n\n`,
  });
  service.addRule('styledText', {
    filter: (node: any) =>
      node.nodeName === 'SPAN' && node.getAttribute && Boolean(node.getAttribute('style')),
    replacement: (_content: string, node: any) => node.outerHTML,
  });
  service.addRule('alignedBlock', {
    filter: (node: any) =>
      ['P', 'H1', 'H2', 'H3'].includes(node.nodeName) &&
      /text-align/.test(node.getAttribute ? node.getAttribute('style') || '' : ''),
    replacement: (_content: string, node: any) => `\n\n${node.outerHTML}\n\n`,
  });
  return service;
}

export function htmlToMarkdown(html: string): string {
  const service = createTurndown();
  return service
    .turndown(html || '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/* ---------------- 自定义节点 ---------------- */
const Notice = Node.create({
  name: 'notice',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-type') || 'info',
        renderHTML: (attributes: Record<string, any>) => ({ 'data-type': attributes.type }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div.notice' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: `notice notice-${node.attrs.type}` }),
      0,
    ];
  },
});

const Collapse = Node.create({
  name: 'collapse',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      title: {
        default: '点击展开',
        parseHTML: (element: HTMLElement) =>
          element.querySelector('summary')?.textContent?.trim() || '点击展开',
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'details.collapse' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'details',
      mergeAttributes(HTMLAttributes, { class: 'collapse', open: '' }),
      ['summary', {}, node.attrs.title],
      ['div', { class: 'collapse-body' }, 0],
    ];
  },
});

const DownloadButton = Node.create({
  name: 'downloadButton',
  group: 'block',
  atom: true,
  addAttributes() {
    return {
      label: {
        default: '立即下载',
        parseHTML: (element: HTMLElement) =>
          element.querySelector('a')?.textContent?.trim() || '立即下载',
        renderHTML: () => ({}),
      },
      href: {
        default: '',
        parseHTML: (element: HTMLElement) => element.querySelector('a')?.getAttribute('href') || '',
        renderHTML: () => ({}),
      },
      password: {
        default: '',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-password') || '',
        renderHTML: () => ({}),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div.download-row' }];
  },
  renderHTML({ node, HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, { class: 'download-row' }),
      [
        'a',
        {
          class: 'download-btn',
          href: node.attrs.href || '#',
          'data-password': node.attrs.password || undefined,
        },
        node.attrs.label || '立即下载',
      ],
    ];
  },
});

const SizedImage = Image.extend({
  addAttributes() {
    return {
      ...(this.parent?.() || {}),
      width: {
        default: null,
        renderHTML: (attributes: Record<string, any>) =>
          attributes.width ? { width: attributes.width } : {},
      },
    };
  },
});

/* ---------------- 工具栏按钮 ---------------- */
function ToolButton({
  active,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className={`tool-btn ${active ? 'active' : ''}`}
      onClick={onClick}
      title={title}
      aria-label={title}
    >
      {children}
    </button>
  );
}

const FONT_SIZES = ['13px', '15px', '16px', '18px', '20px', '24px', '30px'];

export function RichEditor({
  value,
  onChange,
  placeholder = '在这里写正文，支持标题、加粗、图片、表格、视频、下载按钮…',
}: {
  value: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
}) {
  const lastMarkdown = useRef(value);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [imageDialog, setImageDialog] = useState<{ alt: string; width: string } | null>(null);
  const [downloadDialog, setDownloadDialog] = useState<{ label: string; href: string; password: string } | null>(
    null
  );
  const [collapseDialog, setCollapseDialog] = useState<{ title: string } | null>(null);
  const [linkDialog, setLinkDialog] = useState<{ href: string } | null>(null);
  const [videoDialog, setVideoDialog] = useState<{ url: string } | null>(null);

  const extensions = useMemo(
    () => [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        link: { openOnClick: false, autolink: true },
      }),
      SizedImage.configure({ inline: false, allowBase64: false }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      FontSize,
      TableKit.configure({ table: { resizable: true } }),
      Youtube.configure({ nocookie: true, width: 640, height: 360 }),
      Placeholder.configure({ placeholder }),
      Notice,
      Collapse,
      DownloadButton,
    ],
    [placeholder]
  );

  const editor = useEditor({
    extensions,
    content: markdownToHtml(value),
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: { class: 'tiptap' },
    },
    onUpdate: ({ editor: instance }) => {
      const markdown = htmlToMarkdown(instance.getHTML());
      lastMarkdown.current = markdown;
      onChange(markdown);
    },
  });

  useEffect(() => {
    if (!editor) return;
    if (value === lastMarkdown.current) return;
    lastMarkdown.current = value;
    editor.commands.setContent(markdownToHtml(value), { emitUpdate: false });
  }, [value, editor]);

  if (!editor) return <div className="loading-screen">编辑器加载中…</div>;

  const chain = () => editor.chain().focus();

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="editor-toolbar">
        <ToolButton title="撤销" onClick={() => chain().undo().run()}>
          ↶
        </ToolButton>
        <ToolButton title="重做" onClick={() => chain().redo().run()}>
          ↷
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton
          title="一级标题"
          active={editor.isActive('heading', { level: 1 })}
          onClick={() => chain().toggleHeading({ level: 1 }).run()}
        >
          H1
        </ToolButton>
        <ToolButton
          title="二级标题"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => chain().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolButton>
        <ToolButton
          title="三级标题"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => chain().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolButton>
        <ToolButton
          title="正文"
          active={editor.isActive('paragraph')}
          onClick={() => chain().setParagraph().run()}
        >
          正文
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton title="加粗" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}>
          <strong>B</strong>
        </ToolButton>
        <ToolButton title="斜体" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}>
          <em>I</em>
        </ToolButton>
        <ToolButton title="删除线" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}>
          <span style={{ textDecoration: 'line-through' }}>S</span>
        </ToolButton>
        <ToolButton
          title="下划线"
          active={editor.isActive('underline')}
          onClick={() => chain().toggleUnderline().run()}
        >
          <span style={{ textDecoration: 'underline' }}>U</span>
        </ToolButton>
        <span className="tool-sep" />
        <label className="tool-btn" title="文字颜色" style={{ position: 'relative' }}>
          <span style={{ borderBottom: '3px solid #f53f3f', lineHeight: 1 }}>A</span>
          <input
            type="color"
            value={editor.getAttributes('textStyle').color || '#f53f3f'}
            onChange={(event) => chain().setColor(event.target.value).run()}
            style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
          />
        </label>
        <select
          className="tool-btn"
          title="字号"
          style={{ width: 82, border: 'none' }}
          value={editor.getAttributes('textStyle').fontSize || ''}
          onChange={(event) => {
            const size = event.target.value;
            if (size) chain().setFontSize(size).run();
            else chain().unsetFontSize().run();
          }}
        >
          <option value="">字号</option>
          {FONT_SIZES.map((size) => (
            <option key={size} value={size}>
              {size.replace('px', '')}
            </option>
          ))}
        </select>
        <span className="tool-sep" />
        <ToolButton
          title="左对齐"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => chain().setTextAlign('left').run()}
        >
          ⬅
        </ToolButton>
        <ToolButton
          title="居中"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => chain().setTextAlign('center').run()}
        >
          ↔
        </ToolButton>
        <ToolButton
          title="右对齐"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => chain().setTextAlign('right').run()}
        >
          ➡
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton
          title="无序列表"
          active={editor.isActive('bulletList')}
          onClick={() => chain().toggleBulletList().run()}
        >
          • 列表
        </ToolButton>
        <ToolButton
          title="有序列表"
          active={editor.isActive('orderedList')}
          onClick={() => chain().toggleOrderedList().run()}
        >
          1. 列表
        </ToolButton>
        <ToolButton
          title="引用"
          active={editor.isActive('blockquote')}
          onClick={() => chain().toggleBlockquote().run()}
        >
          ❝
        </ToolButton>
        <ToolButton
          title="代码块"
          active={editor.isActive('codeBlock')}
          onClick={() => chain().toggleCodeBlock().run()}
        >
          {'</>'}
        </ToolButton>
        <ToolButton title="分割线" onClick={() => chain().setHorizontalRule().run()}>
          ―
        </ToolButton>
        <span className="tool-sep" />
        <ToolButton
          title="超链接"
          active={editor.isActive('link')}
          onClick={() => setLinkDialog({ href: editor.getAttributes('link').href || '' })}
        >
          🔗
        </ToolButton>
        <ToolButton title="插入图片" onClick={() => setPickerOpen(true)}>
          🖼
        </ToolButton>
        <ToolButton title="嵌入视频" onClick={() => setVideoDialog({ url: '' })}>
          ▶
        </ToolButton>
        <ToolButton title="插入表格" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          ▦
        </ToolButton>
        <ToolButton
          title="信息提示框"
          onClick={() =>
            chain()
              .insertContent({
                type: 'notice',
                attrs: { type: 'info' },
                content: [{ type: 'paragraph' }],
              })
              .run()
          }
        >
          💡
        </ToolButton>
        <ToolButton title="折叠内容" onClick={() => setCollapseDialog({ title: '点击展开' })}>
          ▾
        </ToolButton>
        <ToolButton title="下载按钮" onClick={() => setDownloadDialog({ label: '立即下载', href: '', password: '' })}>
          ⬇ 下载
        </ToolButton>
        <ToolButton title="清除格式" onClick={() => chain().unsetAllMarks().clearNodes().run()}>
          清除
        </ToolButton>
      </div>

      {editor.isActive('image') && (
        <div className="row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <span className="muted">已选中图片</span>
          <button
            className="btn btn-sm"
            onClick={() =>
              setImageDialog({
                alt: editor.getAttributes('image').alt || '',
                width: String(editor.getAttributes('image').width || ''),
              })
            }
          >
            图片设置
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => chain().deleteSelection().run()}>
            删除图片
          </button>
        </div>
      )}

      {editor.isActive('table') && (
        <div className="row" style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)' }}>
          <span className="muted">表格工具</span>
          <button className="btn btn-sm" onClick={() => chain().addRowAfter().run()}>
            下方加行
          </button>
          <button className="btn btn-sm" onClick={() => chain().addColumnAfter().run()}>
            右侧加列
          </button>
          <button className="btn btn-sm" onClick={() => chain().deleteRow().run()}>
            删除行
          </button>
          <button className="btn btn-sm" onClick={() => chain().deleteColumn().run()}>
            删除列
          </button>
          <button className="btn btn-sm btn-danger" onClick={() => chain().deleteTable().run()}>
            删除表格
          </button>
        </div>
      )}

      <EditorContent editor={editor} />
      <DragHandle editor={editor} className="drag-handle">
        <span title="按住拖动可调整内容顺序">⠿</span>
      </DragHandle>

      <div className="row-between" style={{ padding: '8px 14px', borderTop: '1px solid var(--border)' }}>
        <span className="muted">{editor.getText().replace(/\s/g, '').length} 字</span>
        <span className="muted">内容以 Markdown 保存，兼容原有文章格式<span className="drag-hint">；拖动左侧 ⠿ 可调整段落顺序</span></span>
      </div>

      <MediaPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={(url) => {
          if (editor.isActive('image')) {
            chain().updateAttributes('image', { src: url }).run();
          } else {
            chain().setImage({ src: url }).run();
          }
        }}
      />

      {imageDialog && (
        <Modal
          title="图片设置"
          onClose={() => setImageDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setImageDialog(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  chain()
                    .updateAttributes('image', {
                      alt: imageDialog.alt,
                      width: imageDialog.width ? Number(imageDialog.width) : null,
                    })
                    .run();
                  setImageDialog(null);
                }}
              >
                确定
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="field">
              <label>图片说明（alt，利于 SEO）</label>
              <input
                className="input"
                value={imageDialog.alt}
                onChange={(event) => setImageDialog({ ...imageDialog, alt: event.target.value })}
              />
            </div>
            <div className="field">
              <label>显示宽度（像素，留空为自适应）</label>
              <input
                className="input"
                type="number"
                value={imageDialog.width}
                onChange={(event) => setImageDialog({ ...imageDialog, width: event.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {downloadDialog && (
        <Modal
          title="插入下载按钮"
          onClose={() => setDownloadDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setDownloadDialog(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!downloadDialog.href.trim()) return;
                  chain()
                    .insertContent({
                      type: 'downloadButton',
                      attrs: {
                        label: downloadDialog.label || '立即下载',
                        href: downloadDialog.href.trim(),
                        password: downloadDialog.password.trim(),
                      },
                    })
                    .run();
                  setDownloadDialog(null);
                }}
              >
                插入
              </button>
            </>
          }
        >
          <div className="stack">
            <div className="field">
              <label>按钮文字</label>
              <input
                className="input"
                value={downloadDialog.label}
                onChange={(event) => setDownloadDialog({ ...downloadDialog, label: event.target.value })}
              />
            </div>
            <div className="field">
              <label>下载地址</label>
              <input
                className="input"
                placeholder="https://…"
                value={downloadDialog.href}
                onChange={(event) => setDownloadDialog({ ...downloadDialog, href: event.target.value })}
              />
            </div>
            <div className="field">
              <label>提取码（可选，显示在按钮下方）</label>
              <input
                className="input"
                value={downloadDialog.password}
                onChange={(event) => setDownloadDialog({ ...downloadDialog, password: event.target.value })}
              />
            </div>
          </div>
        </Modal>
      )}

      {collapseDialog && (
        <Modal
          title="插入折叠内容"
          onClose={() => setCollapseDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setCollapseDialog(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  chain()
                    .insertContent({
                      type: 'collapse',
                      attrs: { title: collapseDialog.title || '点击展开' },
                      content: [{ type: 'paragraph' }],
                    })
                    .run();
                  setCollapseDialog(null);
                }}
              >
                插入
              </button>
            </>
          }
        >
          <div className="field">
            <label>折叠标题</label>
            <input
              className="input"
              value={collapseDialog.title}
              onChange={(event) => setCollapseDialog({ title: event.target.value })}
            />
          </div>
        </Modal>
      )}

      {linkDialog && (
        <Modal
          title="设置超链接"
          onClose={() => setLinkDialog(null)}
          footer={
            <>
              <button
                className="btn"
                onClick={() => {
                  chain().unsetLink().run();
                  setLinkDialog(null);
                }}
              >
                移除链接
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  const href = linkDialog.href.trim();
                  if (!href) return;
                  chain().setLink({ href }).run();
                  setLinkDialog(null);
                }}
              >
                确定
              </button>
            </>
          }
        >
          <div className="field">
            <label>链接地址</label>
            <input
              className="input"
              placeholder="https://…"
              value={linkDialog.href}
              onChange={(event) => setLinkDialog({ href: event.target.value })}
            />
          </div>
        </Modal>
      )}

      {videoDialog && (
        <Modal
          title="嵌入视频"
          onClose={() => setVideoDialog(null)}
          footer={
            <>
              <button className="btn" onClick={() => setVideoDialog(null)}>
                取消
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  if (!videoDialog.url.trim()) return;
                  chain().setYoutubeVideo({ src: videoDialog.url.trim() }).run();
                  setVideoDialog(null);
                }}
              >
                插入
              </button>
            </>
          }
        >
          <div className="field">
            <label>视频地址（支持 YouTube 链接）</label>
            <input
              className="input"
              placeholder="https://www.youtube.com/watch?v=…"
              value={videoDialog.url}
              onChange={(event) => setVideoDialog({ url: event.target.value })}
            />
            <span className="hint">国内视频建议先在「下载按钮」里放外链，或插入视频封面图。</span>
          </div>
        </Modal>
      )}
    </div>
  );
}

export type { Editor };
