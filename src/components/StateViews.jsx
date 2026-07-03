import React from "react";
import { styles } from "../styles";

export function LoadingState({ label = "Loading your titles…" }) {
  return (
    <div style={styles.loadingWrap}>
      <div style={styles.spinner} />
      <p>{label}</p>
    </div>
  );
}

export function ErrorBanner({ message, onRetry }) {
  if (!message) return null;
  return (
    <div style={styles.errorBanner}>
      <span>{message}</span>
      {onRetry && (
        <button style={styles.retryBtn} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  );
}
