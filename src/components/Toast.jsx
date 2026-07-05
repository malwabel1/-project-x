import React, { useEffect } from "react";

/**
 * Minimal toast. Self-contained (carries its own keyframes in a
 * scoped <style> tag so no global stylesheet/App.jsx change is
 * needed), auto-dismisses, respects prefers-reduced-motion via the
 * app's existing global rule (animations collapse to ~0ms there).
 *
 * Controlled by the parent: render it when `message` is set, clear
 * via `onDone` after the timeout. No portal -- position: fixed works
 * fine from anywhere in the tree.
 *
 * @param {{
 *   message: string|null,
 *   kind?: 'success'|'error',
 *   onDone: () => void,
 *   durationMs?: number,
 * }} props
 */
export function Toast({ message, kind = "success", onDone, durationMs = 2200 }) {
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(onDone, durationMs);
    return () => clearTimeout(t);
  }, [message, durationMs, onDone]);

  if (!message) return null;

  const isError = kind === "error";

  return (
    <>
      <style>{`
        @keyframes memoraToastIn {
          from { opacity: 0; transform: translate(-50%, 12px); }
          to   { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        style={{
          position: "fixed",
          left: "50%",
          bottom: 92, // clears the bottom nav
          transform: "translateX(-50%)",
          zIndex: 60,
          display: "flex",
          alignItems: "center",
          gap: 8,
          background: isError ? "#3A2222" : "#1C2B24",
          border: `1px solid ${isError ? "#5A3232" : "#2E5A46"}`,
          color: isError ? "#F2B5B5" : "#9AE6C0",
          borderRadius: 999,
          padding: "10px 18px",
          fontSize: 13,
          fontWeight: 500,
          boxShadow: "0 8px 24px rgba(0,0,0,0.45)",
          animation: "memoraToastIn 0.25s cubic-bezier(0.16,1,0.3,1) both",
          maxWidth: "calc(100vw - 40px)",
        }}
      >
        {message}
      </div>
    </>
  );
}
