import React, { useState } from "react";
import { styles } from "../styles";

export function AuthScreen({ onSignIn, onSignUp, authError }) {
  const [mode, setMode] = useState("signin"); // "signin" | "signup"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setNotice(null);
    const ok = mode === "signin" ? await onSignIn(email, password) : await onSignUp(email, password);
    setSubmitting(false);
    if (ok && mode === "signup") {
      setNotice("Check your inbox to confirm your email, then sign in.");
    }
  }

  return (
    <div style={styles.authWrap}>
      <form style={styles.formCard} onSubmit={handleSubmit}>
        <h2 style={styles.formTitle}>{mode === "signin" ? "Sign in to Memora" : "Create your account"}</h2>

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            type="email"
            required
            autoFocus
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
        </label>

        <label style={styles.label}>
          Password
          <input
            style={styles.input}
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 6 characters"
          />
        </label>

        {authError && <p style={styles.errorText}>{authError}</p>}
        {notice && <p style={styles.noticeText}>{notice}</p>}

        <button style={styles.addBtn} type="submit" disabled={submitting}>
          {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Sign up"}
        </button>

        <button
          type="button"
          style={styles.linkBtn}
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
        >
          {mode === "signin" ? "New here? Create an account" : "Already have an account? Sign in"}
        </button>
      </form>
    </div>
  );
}
