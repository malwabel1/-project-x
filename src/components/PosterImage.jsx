import React, { useState } from "react";
import { colorForTitle, initials } from "./Shared";

/**
 * Shared poster/thumbnail renderer used by every card that shows a
 * title image (TitleCard, ContinueWatchingRow, RecentlyAddedRow,
 * WatchlistPreviewRow, GlobalSearchTab, TitleDetailsModal). Centralizes
 * the three image-loading requirements in one place instead of
 * repeating them per component:
 *
 *  - placeholder: the gradient + initials render immediately, so
 *    there's never a blank box before the network responds.
 *  - fade-in: the real image crossfades in over that placeholder via
 *    opacity once it's loaded (and lazy-loads via the `loading`
 *    attribute).
 *  - fallback: if the image 404s or otherwise errors, it never shows
 *    a broken-image icon — the gradient + initials placeholder simply
 *    stays visible, indistinguishable from "no poster available".
 *
 * @param {{
 *   src?: string|null, title: string, style?: object, imgStyle?: object,
 *   badge?: React.ReactNode, initialsSize?: number
 * }} props
 */
export function PosterImage({ src, title, style, imgStyle, badge, initialsSize = 17 }) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const color = colorForTitle(title || "");
  const showImage = !!src && !failed;

  return (
    <div
      style={{
        position: "relative",
        overflow: "hidden",
        background: `linear-gradient(160deg, ${color}, #12121A)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        ...style,
      }}
    >
      <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: initialsSize, color: "#12121A" }}>{initials(title || "")}</span>
      {showImage && (
        <img
          src={src}
          alt={title ? `${title} poster` : ""}
          loading="lazy"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: loaded ? 1 : 0,
            transition: "opacity 0.35s ease",
            ...imgStyle,
          }}
        />
      )}
      {badge}
    </div>
  );
}
