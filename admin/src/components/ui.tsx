import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

/* ---------------- 轻提示 ---------------- */
type ToastType = 'info' | 'success' | 'error';
interface ToastItem {
  id: number;
  text: string;
  type: ToastType;
}

const ToastContext = createContext<(text: string, type?: ToastType) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const counter = useRef(0);

  const push = useCallback((text: string, type: ToastType = 'info') => {
    counter.current += 1;
    const id = counter.current;
    setItems((prev) => [...prev, { id, text, type }]);
    window.setTimeout(() => {
      setItems((prev) => prev.filter((item) => item.id !== id));
    }, 3600);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-wrap">
        {items.map((item) => (
          <div key={item.id} className={`toast ${item.type}`}>
            {item.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);

/* ---------------- 二次确认 ---------------- */
interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  danger?: boolean;
}
type ConfirmFn = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn>(async () => false);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (value: boolean) => void }) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    return new Promise((resolve) => setState({ ...options, resolve }));
  }, []);

  const close = (value: boolean) => {
    state?.resolve(value);
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="modal-mask" role="dialog" aria-modal="true">
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modal-head">{state.title || '请确认'}</div>
            <div className="modal-body" style={{ whiteSpace: 'pre-wrap' }}>
              {state.message}
            </div>
            <div className="modal-foot">
              <button className="btn" onClick={() => close(false)}>
                取消
              </button>
              <button className={`btn ${state.danger ? 'btn-danger' : 'btn-primary'}`} onClick={() => close(true)}>
                {state.confirmText || '确定'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export const useConfirm = () => useContext(ConfirmContext);

/* ---------------- 弹窗 ---------------- */
export function Modal({
  title,
  children,
  footer,
  onClose,
  wide,
}: {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-mask" role="dialog" aria-modal="true" onClick={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div className={`modal ${wide ? 'wide' : ''}`}>
        <div className="modal-head">
          <span>{title}</span>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="关闭">
            ✕
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------------- 表单 ---------------- */
export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
}) {
  return (
    <label className="switch">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

export function Empty({ icon = '📭', text, action }: { icon?: string; text: string; action?: ReactNode }) {
  return (
    <div className="empty">
      <div className="icon">{icon}</div>
      <p style={{ margin: '0 0 12px' }}>{text}</p>
      {action}
    </div>
  );
}

export function Loading({ text = '加载中…' }: { text?: string }) {
  return (
    <div className="loading-screen">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}

/* ---------------- 简单哈希路由 ---------------- */
export function useHashRoute() {
  const [route, setRoute] = useState(() => window.location.hash.replace(/^#/, '') || '/');
  useEffect(() => {
    const handler = () => setRoute(window.location.hash.replace(/^#/, '') || '/');
    window.addEventListener('hashchange', handler);
    return () => window.removeEventListener('hashchange', handler);
  }, []);
  return route;
}

export function navigate(path: string) {
  window.location.hash = path.startsWith('#') ? path : `#${path}`;
}

export function useDebouncedCallback<T extends (...args: any[]) => void>(callback: T, delay: number) {
  const timer = useRef<number | null>(null);
  const latest = useRef(callback);
  latest.current = callback;
  return useCallback(
    (...args: Parameters<T>) => {
      if (timer.current) window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => latest.current(...args), delay);
    },
    [delay]
  );
}
