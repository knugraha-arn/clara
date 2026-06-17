"use client";

import { useState, useEffect, useCallback, createContext, useContext, useRef } from "react";

export type ToastType = "success" | "error" | "warning" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
  duration?: number;
}

interface ToastContextValue {
  toast: (message: string, type?: ToastType, duration?: number) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  warning: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast harus dipakai di dalam ToastProvider");
  return ctx;
}

const TOAST_CFG: Record<ToastType, { bg: string; border: string; color: string; icon: string }> = {
  success: { bg: "#F0FDF4", border: "#BBF7D0", color: "#16A34A", icon: "✅" },
  error:   { bg: "#FEF2F2", border: "#FECACA", color: "#DC2626", icon: "❌" },
  warning: { bg: "#FFFBEB", border: "#FDE68A", color: "#D97706", icon: "⚠️" },
  info:    { bg: "#EEF2FF", border: "#C7D2FE", color: "#0344D8", icon: "ℹ️" },
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const toast = useCallback((message: string, type: ToastType = "info", duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts(prev => [...prev.slice(-4), { id, type, message, duration }]);
    const timer = setTimeout(() => dismiss(id), duration);
    timers.current.set(id, timer);
  }, [dismiss]);

  const success = useCallback((msg: string) => toast(msg, "success"), [toast]);
  const error   = useCallback((msg: string) => toast(msg, "error", 6000), [toast]);
  const warning = useCallback((msg: string) => toast(msg, "warning"), [toast]);
  const info    = useCallback((msg: string) => toast(msg, "info"), [toast]);

  useEffect(() => {
    const ref = timers.current;
    return () => { ref.forEach(t => clearTimeout(t)); };
  }, []);

  return (
    <ToastContext.Provider value={{ toast, success, error, warning, info }}>
      {children}
      {/* Toast container */}
      <div style={{
        position: "fixed", bottom: 24, right: 24,
        display: "flex", flexDirection: "column", gap: 8,
        zIndex: 9999, pointerEvents: "none",
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        {toasts.map(t => {
          const cfg = TOAST_CFG[t.type];
          return (
            <div key={t.id} style={{
              display: "flex", alignItems: "flex-start", gap: 10,
              backgroundColor: cfg.bg, border: `1px solid ${cfg.border}`,
              borderRadius: 12, padding: "12px 14px",
              boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
              minWidth: 280, maxWidth: 400,
              pointerEvents: "auto",
              animation: "toast-in 0.2s ease",
            }}>
              <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{cfg.icon}</span>
              <p style={{ fontSize: 13, color: cfg.color, margin: 0, flex: 1, lineHeight: 1.5, fontWeight: 500 }}>
                {t.message}
              </p>
              <button onClick={() => dismiss(t.id)} style={{
                background: "none", border: "none", cursor: "pointer",
                color: cfg.color, fontSize: 16, padding: 0, opacity: 0.6,
                flexShrink: 0, lineHeight: 1,
              }}>×</button>
            </div>
          );
        })}
      </div>
      <style>{`@keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }`}</style>
    </ToastContext.Provider>
  );
}
