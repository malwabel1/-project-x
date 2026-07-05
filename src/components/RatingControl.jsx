import React, { useState } from "react";
import { Star } from "lucide-react";

/**
 * 10-star rating control.
 *
 * IMPORTANT -- persistence honesty (no schema changes allowed):
 * the `user_titles.rating` column is a smallint constrained to 0–5.
 * A 10-point value cannot be stored without a schema change, so this
 * control maps between the two scales at the edge:
 *
 *   display value  = stored rating × 2          (0–5 → 0–10)
 *   stored rating  = Math.ceil(selected / 2)    (0–10 → 0–5)
 *
 * Consequence, stated plainly: selecting an odd star count (e.g. 7)
 * persists ceil(7/2)=4 and re-displays as 8. The UI "snaps" to even
 * values after save. Exact 10-point fidelity requires widening the
 * DB constraint later -- the mapping lives only here, so that future
 * change touches this one file plus the check constraint.
 *
 * Controlled component: `value` is the STORED 0–5 rating; `onSelect`
 * receives the STORED 0–5 rating to save. Callers never deal with
 * the 10-point scale directly.
 *
 * @param {{
 *   value: number,                    // stored 0–5
 *   onSelect: (stored: number) => void,
 *   disabled?: boolean,
 *   size?: number,
 * }} props
 */
export function RatingControl({ value, onSelect, disabled, size = 22 }) {
  const [hovered, setHovered] = useState(0); // 0 = no hover, else 1–10
  const displayValue = hovered || (value || 0) * 2;

  return (
    <div
      style={{ display: "flex", gap: 3, flexWrap: "wrap" }}
      role="radiogroup"
      aria-label="Your rating, out of 10"
      onMouseLeave={() => setHovered(0)}
    >
      {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => {
        const filled = n <= displayValue;
        return (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={n === displayValue}
            aria-label={`${n} out of 10`}
            disabled={disabled}
            onMouseEnter={() => setHovered(n)}
            onFocus={() => setHovered(n)}
            onBlur={() => setHovered(0)}
            onClick={() => onSelect(Math.ceil(n / 2))}
            style={{
              background: "none",
              border: "none",
              padding: 2,
              cursor: disabled ? "wait" : "pointer",
              lineHeight: 0,
              transition: "transform 0.12s ease",
              transform: hovered === n ? "scale(1.2)" : "none",
            }}
          >
            <Star
              size={size}
              fill={filled ? "#E8A33D" : "none"}
              color={filled ? "#E8A33D" : "#4A4756"}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
