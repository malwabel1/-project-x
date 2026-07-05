// TEMPORARY -- search debugging aid. Delete together with
// src/utils/searchDebug.js once the tmdb-search issue is resolved.
import React, { useEffect, useState } from "react";
import { searchDebug, debugFormat } from "../utils/searchDebug";

const wrap = {
  marginTop: 10,
  background: "#12121A",
  border: "1px dashed #5A3232",
  borderRadius: 8,
  padding: "10px 12px",
  fontSize: 11,
  lineHeight: 1.5,
  color: "#B5B2C0",
  fontFamily: "monospace",
  wordBreak: "break-all",
  whiteSpace: "pre-wrap",
  maxHeight: 260,
  overflowY: "auto",
};
const keyStyle = { color: "#E8A33D" };

const ROWS = [
  ["query", "1. Current query"],
  ["debounced", "2. Debounced query"],
  ["effectRan", "3. useEffect executed"],
  ["serviceCalled", "4. GlobalTitleSearchService.search() called"],
  ["repoReturned", "5. TMDBRepository.searchMulti() returned"],
  ["invokeError", "6. invoke() error object"],
];

export function SearchDebugPanel({ query }) {
  const [state, setState] = useState({});

  useEffect(() => searchDebug.subscribe(setState), []);

  // "Current query" comes straight from the component prop so it
  // updates on every keystroke, independent of the debounced flow.
  const merged = { ...state, query };

  return (
    <div style={wrap} aria-label="Search debug panel">
      <div style={{ color: "#F2B5B5", marginBottom: 4 }}>⚠ TEMPORARY DEBUG PANEL</div>
      {ROWS.map(([key, label]) => (
        <div key={key}>
          <span style={keyStyle}>{label}:</span> {debugFormat(merged[key])}
        </div>
      ))}
    </div>
  );
}
