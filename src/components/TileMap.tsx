"use client";

import { useApp } from "@/lib/store";
import { useDerived } from "@/lib/derived";
import { GRID_ROWS, STATES } from "@/lib/states";
import { getEmployerPolicyStatus } from "@/lib/employer/demoEmployer";
import type { RiskLevel } from "@/lib/types";
import styles from "./map.module.css";

const PITCH = 62; // 56px tile + 6px gap
const HALF = 28;

const SOFT: Record<RiskLevel, string> = {
  clear: "var(--clear-soft)",
  caution: "var(--caution-soft)",
  triggered: "var(--triggered-soft)",
};
const DEEP: Record<RiskLevel, string> = {
  clear: "var(--clear-deep)",
  caution: "var(--caution-deep)",
  triggered: "var(--triggered-deep)",
};
const SOLID: Record<RiskLevel, string> = {
  clear: "var(--clear)",
  caution: "var(--caution)",
  triggered: "var(--triggered)",
};

export function TileMap() {
  const { mode, selected, select } = useApp();
  const { pastByState, outcomes, scheduled, clocks } = useDerived();

  // Future mode: first order index + totals per state on the route.
  const routeByState = new Map<
    string,
    { order: number; workDays: number; level: RiskLevel }
  >();
  if (mode === "future") {
    for (const s of scheduled) {
      const cur = routeByState.get(s.stop.state);
      const worse = (a: RiskLevel, b: RiskLevel): RiskLevel =>
        a === "triggered" || b === "triggered"
          ? "triggered"
          : a === "caution" || b === "caution"
            ? "caution"
            : "clear";
      routeByState.set(s.stop.state, {
        order: cur ? cur.order : s.index + 1,
        workDays: (cur?.workDays ?? 0) + s.workDays,
        level: worse(cur?.level ?? "clear", s.verdict.level),
      });
    }
  }

  // Journey path through the current location then each stop, skipping repeats.
  const pathStates: string[] = [];
  if (mode === "future") {
    if (clocks.run) pathStates.push(clocks.run.state);
    for (const s of scheduled) {
      if (pathStates[pathStates.length - 1] !== s.stop.state) pathStates.push(s.stop.state);
    }
  }
  const pathPoints = pathStates
    .map((code) => {
      const info = STATES[code];
      return `${(info.col - 1) * PITCH + HALF},${info.row * PITCH + HALF}`;
    })
    .join(" ");

  return (
    <main className={styles.mapArea}>
      <div className={styles.grid}>
        {GRID_ROWS.map((row, r) => (
          <div key={r} className={styles.row}>
            {row.map((code) => {
              const info = STATES[code];
              const leftPad = code === row[0] ? (info.col - 1) * PITCH : 0;
              // gap between this tile and the previous one in the row
              const prev = row[row.indexOf(code) - 1];
              const gapPad = prev ? (info.col - STATES[prev].col - 1) * PITCH : 0;
              return (
                <div
                  key={code}
                  className={styles.cell}
                  style={{ marginLeft: (prev ? gapPad : leftPad) || undefined }}
                >
                  <Tile code={code} />
                </div>
              );
            })}
          </div>
        ))}
        {mode === "future" && pathStates.length > 1 && (
          <svg
            className={styles.pathSvg}
            width={11 * PITCH - 6}
            height={8 * PITCH - 6}
            fill="none"
          >
            <polyline
              points={pathPoints}
              stroke="var(--path)"
              strokeWidth="1.5"
              strokeDasharray="4 4"
              fill="none"
            />
          </svg>
        )}
      </div>
      <Legend />
    </main>
  );

  function Tile({ code }: { code: string }) {
    const info = STATES[code];
    const isSelected = selected === code;
    const sel = isSelected ? ` ${styles.selected}` : "";
    const onClick = () => select(isSelected ? null : code);

    if (mode === "past") {
      const agg = pastByState.get(code);
      if (agg && agg.workDays >= 0 && agg.calDays > 0) {
        const level = outcomes.get(code)!.level;
        return (
          <button
            className={styles.tile + sel}
            style={{ background: SOFT[level] }}
            onClick={onClick}
            aria-label={`${info.name}, ${agg.workDays} work days`}
          >
            <div className={styles.tileTopRow}>
              <span className={styles.tileAbbrStrong} style={{ color: DEEP[level] }}>
                {code}
              </span>
            </div>
            <div className={styles.tileBottomRow}>
              <span />
              <span className={styles.tileCount} style={{ color: DEEP[level] }}>
                {agg.workDays || (agg.projectedDays ? "?" : 0)}
              </span>
            </div>
          </button>
        );
      }
    } else {
      const route = routeByState.get(code);
      if (route) {
        const borderColor = route.level === "triggered" ? "var(--triggered)" : "var(--navy)";
        return (
          <button
            className={styles.tile + sel}
            style={{
              background: "var(--surface)",
              border: `1.5px solid ${borderColor}`,
              padding: "5px 6px",
            }}
            onClick={onClick}
            aria-label={`${info.name}, stop ${route.order}`}
          >
            <div className={styles.tileTopRow}>
              <span
                className={styles.tileAbbrStrong}
                style={{ color: route.level === "triggered" ? "var(--triggered)" : "var(--navy)" }}
              >
                {code}
              </span>
              <span className={styles.tileOrder}>{route.order}</span>
            </div>
            <div className={styles.tileBottomRow}>
              <span className={styles.tileDot} style={{ background: SOLID[route.level] }} />
              <span className={styles.tileCount} style={{ color: "var(--slate)" }}>
                {route.workDays}
              </span>
            </div>
          </button>
        );
      }
      if (clocks.run?.state === code) {
        return (
          <button
            className={styles.tile + sel}
            style={{ background: "var(--navy-soft)" }}
            onClick={onClick}
            aria-label={`${info.name}, current location`}
          >
            <div className={styles.tileTopRow}>
              <span className={styles.tileAbbrStrong} style={{ color: "var(--navy)" }}>
                {code}
              </span>
            </div>
            <div className={styles.tileBottomRow}>
              <span />
              <span className={styles.tileCount} style={{ color: "var(--navy)" }}>
                now
              </span>
            </div>
          </button>
        );
      }
    }

    return (
      <button
        className={`${styles.tile} ${styles.tileCentered}${sel}`}
        onClick={onClick}
        aria-label={`${info.name}, ${getEmployerPolicyStatus(code) === "allowed" ? "work permitted" : "work not permitted"}`}
        style={{ opacity: getEmployerPolicyStatus(code) === "allowed" ? 1 : 0.55 }}
      >
        <span
          className={styles.abbr}
          style={info.country === "CA" ? { color: "var(--faint)" } : undefined}
        >
          {code}
        </span>
      </button>
    );
  }

  function Legend() {
    const items = [
      ["clear", "No modeled state tax action"],
      ["caution", "Review / active / approaching"],
      ["triggered", "Not permitted / payroll action"],
    ] as const;
    return (
      <div className={styles.legend}>
        {items.map(([level, label]) => (
          <span key={level} className={styles.legendItem}>
            <span className={styles.legendDot} style={{ background: SOLID[level] }} />
            {label}
          </span>
        ))}
        {mode === "future" && (
          <span className={styles.legendItem}>
            <svg width="22" height="2">
              <line
                x1="0"
                y1="1"
                x2="22"
                y2="1"
                stroke="var(--path)"
                strokeWidth="1.5"
                strokeDasharray="4 4"
              />
            </svg>
            Route order
          </span>
        )}
      </div>
    );
  }
}
