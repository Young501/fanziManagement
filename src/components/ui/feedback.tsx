"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Info, Loader2, X } from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type ToastType = "success" | "error" | "warning" | "info";

type Toast = {
  id: number;
  type: ToastType;
  title: string;
  description?: string;
};

type ToastInput = Omit<Toast, "id" | "type"> & {
  duration?: number;
};

type ToastContextValue = {
  show: (toast: Omit<Toast, "id"> & { duration?: number }) => number;
  success: (toast: ToastInput) => number;
  error: (toast: ToastInput) => number;
  warning: (toast: ToastInput) => number;
  info: (toast: ToastInput) => number;
  dismiss: (id: number) => void;
};

type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "default" | "danger";
  requireText?: string;
  requireTextLabel?: string;
  requireTextPlaceholder?: string;
  busyLabel?: string;
};

type ConfirmState = ConfirmOptions & {
  resolve: (value: boolean) => void;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ToastContext = React.createContext<ToastContextValue | null>(null);
const ConfirmContext = React.createContext<ConfirmContextValue | null>(null);

const toastStyles: Record<ToastType, { icon: React.ElementType; className: string; iconClassName: string }> = {
  success: {
    icon: CheckCircle2,
    className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    iconClassName: "text-emerald-600",
  },
  error: {
    icon: AlertTriangle,
    className: "border-red-200 bg-red-50 text-red-950",
    iconClassName: "text-red-600",
  },
  warning: {
    icon: AlertTriangle,
    className: "border-amber-200 bg-amber-50 text-amber-950",
    iconClassName: "text-amber-600",
  },
  info: {
    icon: Info,
    className: "border-slate-200 bg-white text-slate-950",
    iconClassName: "text-blue-600",
  },
};

export function FeedbackProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<Toast[]>([]);
  const [confirmState, setConfirmState] = React.useState<ConfirmState | null>(null);
  const [confirmText, setConfirmText] = React.useState("");
  const [confirmBusy, setConfirmBusy] = React.useState(false);
  const nextToastId = React.useRef(1);

  const dismiss = React.useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = React.useCallback(
    ({ duration = 4200, ...toast }: Omit<Toast, "id"> & { duration?: number }) => {
      const id = nextToastId.current++;
      setToasts((current) => [{ id, ...toast }, ...current].slice(0, 4));

      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }

      return id;
    },
    [dismiss]
  );

  const toastApi = React.useMemo<ToastContextValue>(
    () => ({
      show,
      success: (toast) => show({ ...toast, type: "success" }),
      error: (toast) => show({ ...toast, type: "error" }),
      warning: (toast) => show({ ...toast, type: "warning" }),
      info: (toast) => show({ ...toast, type: "info" }),
      dismiss,
    }),
    [dismiss, show]
  );

  const confirm = React.useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmText("");
      setConfirmBusy(false);
      setConfirmState({ ...options, resolve });
    });
  }, []);

  const confirmApi = React.useMemo<ConfirmContextValue>(() => ({ confirm }), [confirm]);

  const closeConfirm = React.useCallback(
    (value: boolean) => {
      const resolver = confirmState?.resolve;
      setConfirmState(null);
      setConfirmText("");
      setConfirmBusy(false);
      resolver?.(value);
    },
    [confirmState]
  );

  const textMatches = !confirmState?.requireText || confirmText.trim() === confirmState.requireText;
  const isDanger = confirmState?.variant === "danger";

  return (
    <ToastContext.Provider value={toastApi}>
      <ConfirmContext.Provider value={confirmApi}>
        {children}

        <div
          aria-live="polite"
          aria-relevant="additions"
          className="fixed right-4 top-4 z-[80] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3"
        >
          {toasts.map((toast) => {
            const style = toastStyles[toast.type];
            const Icon = style.icon;

            return (
              <div
                key={toast.id}
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-lg shadow-slate-900/10 ${style.className}`}
              >
                <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${style.iconClassName}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold leading-5">{toast.title}</p>
                  {toast.description && (
                    <p className="mt-1 text-sm leading-5 text-slate-600">{toast.description}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(toast.id)}
                  className="rounded-md p-1 text-slate-400 transition hover:bg-white/70 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  aria-label="关闭提示"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>

        <Dialog open={!!confirmState} onOpenChange={(open) => !open && closeConfirm(false)}>
          <DialogContent showCloseButton={!confirmBusy} className="sm:max-w-md">
            <DialogHeader>
              <div
                className={`mb-1 flex h-10 w-10 items-center justify-center rounded-lg ${
                  isDanger ? "bg-red-50 text-red-600" : "bg-blue-50 text-blue-600"
                }`}
              >
                {confirmBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <AlertTriangle className="h-5 w-5" />}
              </div>
              <DialogTitle>{confirmState?.title}</DialogTitle>
              {confirmState?.description && (
                <DialogDescription className="leading-6">{confirmState.description}</DialogDescription>
              )}
            </DialogHeader>

            {confirmState?.requireText && (
              <div className="space-y-2">
                <label htmlFor="confirm-text" className="text-sm font-medium text-slate-700">
                  {confirmState.requireTextLabel || "输入确认文本"}
                </label>
                <input
                  id="confirm-text"
                  value={confirmText}
                  onChange={(event) => setConfirmText(event.target.value)}
                  placeholder={confirmState.requireTextPlaceholder || confirmState.requireText}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                  autoComplete="off"
                />
                <p className="text-xs text-slate-500">
                  需要完整输入：<span className="font-semibold text-slate-700">{confirmState.requireText}</span>
                </p>
              </div>
            )}

            <DialogFooter>
              <button
                type="button"
                disabled={confirmBusy}
                onClick={() => closeConfirm(false)}
                className="inline-flex h-9 items-center justify-center rounded-md border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {confirmState?.cancelLabel || "取消"}
              </button>
              <button
                type="button"
                disabled={!textMatches || confirmBusy}
                onClick={() => {
                  setConfirmBusy(true);
                  window.setTimeout(() => closeConfirm(true), 80);
                }}
                className={`inline-flex h-9 items-center justify-center rounded-md px-4 text-sm font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  isDanger ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {confirmBusy ? confirmState?.busyLabel || "处理中..." : confirmState?.confirmLabel || "确认"}
              </button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = React.useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within FeedbackProvider");
  }
  return context;
}

export function useConfirm() {
  const context = React.useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within FeedbackProvider");
  }
  return context.confirm;
}
