import React from "react";
import { Home, Search, User, Settings } from "lucide-react";
import { styles } from "../styles";

const NAV_ITEMS = [
  { key: "home", label: "Home", icon: Home },
  { key: "search", label: "Search", icon: Search },
  { key: "profile", label: "Profile", icon: User },
  { key: "settings", label: "Settings", icon: Settings },
];

/**
 * @param {{ current: 'home'|'search'|'profile'|'settings', onNavigate: (screen: string) => void }} props
 */
export function BottomNav({ current, onNavigate }) {
  return (
    <nav style={styles.bottomNav} aria-label="Primary">
      <div style={styles.bottomNavInner}>
        {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
          const active = current === key;
          return (
            <button
              key={key}
              type="button"
              style={{ ...styles.bottomNavItem, ...(active ? styles.bottomNavItemActive : {}) }}
              onClick={() => onNavigate(key)}
              aria-current={active ? "page" : undefined}
              aria-label={label}
            >
              <Icon size={20} strokeWidth={active ? 2.4 : 2} />
              {label}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
