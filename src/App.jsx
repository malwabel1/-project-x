import React, { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { useMediaQuery, BREAKPOINTS } from "./hooks/useMediaQuery";
import { AuthScreen } from "./components/AuthScreen";
import { HomeScreen } from "./components/HomeScreen";
import { LibraryScreen } from "./components/LibraryScreen";
import { SearchScreen } from "./components/SearchScreen";
import { ProfileScreen } from "./components/ProfileScreen";
import { SettingsScreen } from "./components/SettingsScreen";
import { BottomNav } from "./components/BottomNav";
import { LoadingState } from "./components/StateViews";
import { FilmstripIcon } from "./components/Shared";
import { styles } from "./styles";

export default function App() {
  const { user, loading: authLoading, error: authError, signIn, signUp, signOut } = useAuth();

  return (
    <div style={styles.app}>
      <GlobalStyle />
      {authLoading ? (
        <LoadingState label="Checking your session…" />
      ) : !user ? (
        <AuthScreen onSignIn={signIn} onSignUp={signUp} authError={authError} />
      ) : (
        <MemoraApp user={user} onSignOut={signOut} />
      )}
    </div>
  );
}

/**
 * Top-level shell (Milestone 2): a thin screen switcher plus bottom
 * navigation. Deliberately owns no data hooks of its own — every
 * screen (HomeScreen, LibraryScreen, SearchScreen, ProfileScreen,
 * SettingsScreen) is fully self-contained, owning whichever
 * repository→service→hook chain it needs. That keeps this file
 * simple and means each screen's data only loads while that screen
 * is actually mounted.
 *
 * "Library" isn't a bottom-nav destination — the bottom nav is
 * exactly Home / Search / Profile / Settings, per spec — it's reached
 * via "View All" from the Watchlist Preview, and remounts fresh
 * (via the `key`) every time it's entered so it never shows stale
 * data from a previous visit.
 */
function MemoraApp({ user, onSignOut }) {
  const [screen, setScreen] = useState("home"); // 'home' | 'library' | 'search' | 'profile' | 'settings'
  const [libraryTab, setLibraryTab] = useState("watching");
  const [libraryKey, setLibraryKey] = useState(0);
  const isLargeDesktop = useMediaQuery(BREAKPOINTS.largeDesktop);

  function goToLibrary(tab) {
    setLibraryTab(tab);
    setLibraryKey((k) => k + 1);
    setScreen("library");
  }

  function navigate(next) {
    setScreen(next);
  }

  return (
    <>
      <header style={styles.header}>
        <div style={{ ...styles.headerInner, maxWidth: isLargeDesktop ? 1100 : undefined }}>
          <div>
            <div style={styles.logoRow}>
              <FilmstripIcon />
              <h1 style={styles.logo}>MEMORA</h1>
            </div>
            <p style={styles.tagline}>your personal reel of everything you've watched</p>
          </div>
        </div>
        <div style={styles.marqueeLine} />
      </header>

      <main style={{ ...styles.main, maxWidth: isLargeDesktop ? 1100 : undefined }}>
        <div key={screen} className="memora-page-in">
          {screen === "home" && (
            <HomeScreen userId={user.id} onViewWatchlist={() => goToLibrary("watchlist")} onViewProfile={() => navigate("profile")} />
          )}
          {screen === "library" && <LibraryScreen key={libraryKey} userId={user.id} initialTab={libraryTab} onBack={() => navigate("home")} />}
          {screen === "search" && <SearchScreen userId={user.id} />}
          {screen === "profile" && <ProfileScreen user={user} />}
          {screen === "settings" && <SettingsScreen onSignOut={onSignOut} />}
        </div>
      </main>

      <div style={styles.bottomNavSpacer} />
      <BottomNav current={screen} onNavigate={navigate} />
    </>
  );
}

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Space+Grotesk:wght@400;500;600;700&display=swap');
      * { box-sizing: border-box; }
      body { margin: 0; }
      ::selection { background: #E8A33D; color: #12121A; }
      .memora-scroll::-webkit-scrollbar { width: 6px; height: 6px; }
      .memora-scroll::-webkit-scrollbar-thumb { background: #34323f; border-radius: 4px; }
      .memora-card { transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease; }
      .memora-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(0,0,0,0.35); border-color: #3A3848; }
      .memora-card:active { transform: translateY(-1px) scale(0.985); box-shadow: 0 4px 12px rgba(0,0,0,0.3); }
      .memora-page-in { animation: pageFadeIn 0.28s ease both; }
      .memora-modal-in { animation: modalPopIn 0.22s cubic-bezier(0.16,1,0.3,1) both; }
      button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
        outline: 2px solid #E8A33D; outline-offset: 2px;
      }
      @keyframes riseIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes memoraSpin { to { transform: rotate(360deg); } }
      @keyframes pageFadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      @keyframes modalPopIn { from { opacity: 0; transform: scale(0.96) translateY(8px); } to { opacity: 1; transform: none; } }
      @media (prefers-reduced-motion: reduce) {
        * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
      }
    `}</style>
  );
}
