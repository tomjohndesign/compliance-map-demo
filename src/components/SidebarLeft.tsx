"use client";

import { Tabs } from "@base-ui/react/tabs";
import { fmtRange, fmtShort } from "@/lib/engine";
import { useApp } from "@/lib/store";
import { useDerived } from "@/lib/derived";
import { STATES } from "@/lib/states";
import type { Mode, RiskLevel } from "@/lib/types";
import { SettingsMenu } from "./SettingsMenu";
import styles from "./sidebar.module.css";

const LEVEL_COLOR: Record<RiskLevel, string> = {
  clear: "var(--clear)",
  caution: "var(--caution)",
  triggered: "var(--triggered)",
};

export function SidebarLeft() {
  const { mode, setMode, selected, select, setPastView, setAddHint, pastView, today } = useApp();
  const { past, outcomes, scheduled, clocks, routeAlerts } = useDerived();
  const recentPast = past
    .map((agg) => ({
      ...agg,
      stays: [...agg.stays].sort((a, b) => b.to.localeCompare(a.to)),
    }))
    .sort((a, b) => b.stays[0].to.localeCompare(a.stays[0].to));

  const footer =
    mode === "past" ? (
      <>
        <button
          className={styles.primaryBtn}
          onClick={() => {
            setPastView(pastView === "report" ? "map" : "report");
            select(null);
          }}
        >
          {pastView === "report" ? "Back to map" : "Create report"}
        </button>
        <span className={styles.footerNote}>
          {fmtShort(past[0]?.firstDay ?? today)} – {fmtShort(today)} ·{" "}
          {[...outcomes.values()].filter((o) => o.coHit).length} states triggered withholding
        </span>
      </>
    ) : (
      <>
        <button className={styles.primaryBtn} onClick={() => setAddHint(true)}>
          Add stay
        </button>
        <span className={styles.footerNote}>
          {scheduled.length === 0
            ? "No stays planned yet"
            : `Route ends ${fmtShort(scheduled[scheduled.length - 1].endISO, true)} · ${
                new Set(scheduled.map((s) => s.stop.state)).size
              } states · ${routeAlerts} alert${routeAlerts === 1 ? "" : "s"}`}
        </span>
      </>
    );

  return (
    <aside className={`${styles.sidebar} no-print`}>
      <div className={styles.header}>
        <div className={styles.titleBlock}>
          <span className={styles.title}>State Lines</span>
          <span className={styles.subtitle}>Work-day routing &amp; tax exposure</span>
        </div>
        <SettingsMenu />
      </div>

      <div className={styles.segmentWrap}>
        <Tabs.Root value={mode} onValueChange={(v) => setMode(v as Mode)}>
          <Tabs.List className={styles.tabsList}>
            <Tabs.Indicator className={styles.tabIndicator} />
            <Tabs.Tab className={styles.tab} value="past">
              Past
            </Tabs.Tab>
            <Tabs.Tab className={styles.tab} value="future">
              Future
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.Root>
      </div>

      <div className={styles.list}>
        {mode === "past" ? (
          recentPast.map((agg) => {
            const outcome = outcomes.get(agg.state)!;
            return (
              <div
                key={agg.state}
                className={`${styles.group} ${selected === agg.state ? styles.groupSelected : ""}`}
              >
                <button
                  className={styles.groupHeader}
                  onClick={() => select(selected === agg.state ? null : agg.state)}
                >
                  <span
                    className={styles.dot}
                    style={{ background: LEVEL_COLOR[outcome.level] }}
                  />
                  <span className={styles.groupName}>{STATES[agg.state].name}</span>
                  <span className={styles.groupWd}>{agg.workDays} wd</span>
                </button>
                {agg.stays.map((sa) => (
                  <div key={sa.stay.id} className={styles.stayRow}>
                    <span className={styles.stayName}>{sa.stay.location}</span>
                    <span className={styles.stayDates}>
                      {sa.to >= today && sa.stay.end >= today
                        ? `${fmtShort(sa.from)} – now`
                        : fmtRange(sa.from, sa.to)}
                    </span>
                  </div>
                ))}
              </div>
            );
          })
        ) : (
          <FutureList />
        )}
        {mode === "future" && clocks.run && (
          <div className={styles.nowPill}>
            <span className={styles.nowPillLabel}>Now</span>
            <span className={styles.nowPillText}>
              {STATES[clocks.run.state].name} · until {fmtShort(clocks.run.endISO)}
            </span>
          </div>
        )}
      </div>

      <div className={styles.footer}>{footer}</div>
    </aside>
  );
}

function FutureList() {
  const { selected, select } = useApp();
  const { scheduled } = useDerived();

  if (scheduled.length === 0) {
    return (
      <div className={styles.emptyList}>
        No stays on the route yet. Pick a state on the map — the panel on the right shows its
        thresholds before you commit. Stays chain off each other: each starts the day after the
        last ends.
      </div>
    );
  }

  // Group scheduled stops by state, keeping route order of first appearance.
  const groups: { state: string; stops: typeof scheduled }[] = [];
  for (const s of scheduled) {
    const g = groups.find((g) => g.state === s.stop.state);
    if (g) g.stops.push(s);
    else groups.push({ state: s.stop.state, stops: [s] });
  }

  return (
    <>
      {groups.map((g) => {
        const wd = g.stops.reduce((n, s) => n + s.workDays, 0);
        const worst = g.stops.some((s) => s.verdict.level === "triggered")
          ? "triggered"
          : g.stops.some((s) => s.verdict.level === "caution")
            ? "caution"
            : "clear";
        return (
          <div
            key={g.state}
            className={`${styles.group} ${selected === g.state ? styles.groupSelected : ""}`}
          >
            <button
              className={styles.groupHeader}
              onClick={() => select(selected === g.state ? null : g.state)}
            >
              <span className={styles.dot} style={{ background: LEVEL_COLOR[worst] }} />
              <span className={styles.groupName}>{STATES[g.state].name}</span>
              <span className={styles.groupWd}>{wd} wd</span>
            </button>
            {g.stops.map((s) => (
              <div key={s.stop.id} className={styles.stayRow}>
                <span className={styles.stayName}>
                  {s.stop.location || `Stop ${s.index + 1}`}
                </span>
                <span className={styles.stayDates}>{fmtRange(s.startISO, s.endISO, true)}</span>
              </div>
            ))}
          </div>
        );
      })}
    </>
  );
}
