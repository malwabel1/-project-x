import React from "react";
import { Star } from "lucide-react";

export function FilmstripIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
      <rect x="1" y="4" width="26" height="20" rx="2" stroke="#E8A33D" strokeWidth="1.5" />
      {[3, 8, 13, 18, 23].map((x) => (
        <rect key={x} x={x} y="1" width="2" height="3" fill="#E8A33D" />
      ))}
      {[3, 8, 13, 18, 23].map((x) => (
        <rect key={"b" + x} x={x} y="24" width="2" height="3" fill="#E8A33D" />
      ))}
      <circle cx="14" cy="14" r="4.5" stroke="#4FB3A9" strokeWidth="1.5" />
    </svg>
  );
}

export function StarRating({ value, onChange, readOnly }) {
  return (
    <div style={{ display: "flex", gap: 2 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={readOnly}
          onClick={() => onChange && onChange(n)}
          style={{ background: "none", border: "none", padding: 0, cursor: readOnly ? "default" : "pointer", lineHeight: 0 }}
          aria-label={`${n} star`}
        >
          <Star size={16} fill={n <= value ? "#E8A33D" : "none"} color={n <= value ? "#E8A33D" : "#4A4756"} strokeWidth={1.5} />
        </button>
      ))}
    </div>
  );
}

export const PALETTE = ["#E8A33D", "#4FB3A9", "#C9667A", "#7C8CD9", "#8FAD5C", "#D9A0DE"];

export function colorForTitle(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return PALETTE[Math.abs(hash) % PALETTE.length];
}

export function initials(str) {
  return str.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
}
