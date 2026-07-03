import React, { useState } from "react";
import { ChevronDown, Moon, Globe, Bell, LogOut } from "lucide-react";
import { styles } from "../styles";

const ABOUT_TEXT =
  "Memora is your personal entertainment companion — track what you watch, discover what's next, and keep a running passport of your viewing history.";
const PRIVACY_TEXT =
  "Your library is private to your account and protected by row-level security in Supabase — no one else can read or edit it. Memora doesn't sell your data. A full privacy policy is coming soon.";
const TERMS_TEXT =
  "By using Memora you agree to use it respectfully and to keep your account credentials secure. Full terms of service are coming soon.";

/**
 * Settings screen (Milestone 2). Dark mode / Language / Notifications
 * are placeholders — Memora is dark-only today and neither preference
 * is wired to anything yet, shown honestly as "Coming soon" rather
 * than a toggle that silently does nothing. Sign out is the one
 * functional action, reusing the existing useAuth.signOut — no new
 * service.
 */
export function SettingsScreen({ onSignOut }) {
  return (
    <div>
      <p style={styles.settingsSectionTitle}>Preferences</p>
      <div style={styles.settingsSection}>
        <SettingsRow icon={Moon} label="Dark mode" value="Always on" />
        <SettingsRow icon={Globe} label="Language" value="English" />
        <SettingsRow icon={Bell} label="Notifications" value="Coming soon" last />
      </div>

      <p style={styles.settingsSectionTitle}>About</p>
      <div style={styles.settingsSection}>
        <ExpandableRow label="About Memora" text={ABOUT_TEXT} />
        <ExpandableRow label="Privacy Policy" text={PRIVACY_TEXT} />
        <ExpandableRow label="Terms of Service" text={TERMS_TEXT} last />
      </div>

      <button type="button" style={styles.settingsDangerBtn} onClick={onSignOut}>
        <LogOut size={14} style={{ verticalAlign: -2, marginRight: 6 }} />
        Sign out
      </button>
    </div>
  );
}

function SettingsRow({ icon: Icon, label, value, last }) {
  return (
    <div style={{ ...styles.settingsRow, ...(last ? styles.settingsRowLast : {}) }}>
      <span style={styles.settingsRowLabel}>
        <Icon size={15} style={{ verticalAlign: -3, marginRight: 8, color: "#8A8798" }} />
        {label}
      </span>
      <span style={styles.settingsRowValue}>{value}</span>
    </div>
  );
}

function ExpandableRow({ label, text, last }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button
        type="button"
        style={{
          ...styles.settingsRow,
          ...(!open && last ? styles.settingsRowLast : {}),
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          fontFamily: "inherit",
        }}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span style={styles.settingsRowLabel}>{label}</span>
        <ChevronDown size={16} color="#8A8798" style={{ transform: open ? "rotate(180deg)" : "none", transition: "transform 0.2s ease" }} />
      </button>
      {open && (
        <p style={{ ...styles.settingsAboutText, ...(last ? {} : { borderBottom: "1px solid #2B2A38" }), padding: "0 16px 14px" }}>{text}</p>
      )}
    </div>
  );
}
