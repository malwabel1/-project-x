// TEMPORARY - enrichment tracing overlay. Delete with traceLog.js.
import React, { useEffect, useState } from "react";
import { traceLog } from "../utils/traceLog";

export function TraceOverlay() {
  const [entries, setEntries] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => traceLog.subscribe(setEntries), []);

  if (!entries.length) return null;

  return (
    <div
      style={{
        position: "fixed", left: 8, right: 8, bottom: 86, zIndex: 70,
        background: "#12121A", border: "1px dashed #5A3232", borderRadius: 10,
        padding: "8px 10px", fontFamily: "monospace", fontSize: 10.5,
        color: "#B5B2C0", maxHeight: collapsed ? 30 : 240, overflowY: "auto",
        wordBreak: "break-all", boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", color: "#F2B5B5", marginBottom: 4 }}>
        <span>TEMP ENRICHMENT TRACE ({entries.length})</span>
        <span>
          <button onClick={() => setCollapsed((v) => !v)} style={btn}>{collapsed ? "expand" : "collapse"}</button>
          <button onClick={() => traceLog.clear()} style={btn}>clear</button>
        </span>
      </div>
      {!collapsed && entries.map((e, i) => (
        <div key={i} style={{ marginBottom: 3 }}>
          <span style={{ color: "#E8A33D" }}>{e.time} {e.label}:</span> {e.value}
        </div>
      ))}
    </div>
  );
}

const btn = { background: "none", border: "1px solid #5A3232", color: "#F2B5B5", borderRadius: 6, fontSize: 10, marginLeft: 6, padding: "1px 7px", fontFamily: "monospace" };
