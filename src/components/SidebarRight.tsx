"use client";

import { useState } from "react";
import { Slider } from "@base-ui/react/slider";
import {
  budgetWd,
  fmtMoney,
  fmtRange,
  fmtShort,
  futureVerdict,
  planTo,
} from "@/lib/engine";
import { useApp } from "@/lib/store";
import { useDerived } from "@/lib/derived";
import { STATES } from "@/lib/states";
import type { RiskLevel } from "@/lib/types";
import styles from "./panel.module.css";

const SOLID: Record<RiskLevel, string> = {
  clear: "var(--clear)",
  caution: "var(--caution)",
  triggered: "var(--triggered)",
};
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

export function SidebarRight() {
  const { mode, selected, pastView } = useApp();

  let body: React.ReactNode;
  if (mode === "past" && pastView === "report") body = <ReportPanel />;
  else if (selected && mode === "past") body = <PastStatePanel key={selected} code={selected} />;
  else if (selected && mode === "future")
    body = <FutureStatePanel key={selected} code={selected} />;
  else body = <DefaultPanel />;

  return <aside className={`${styles.panel} no-print`}>{body}</aside>;
}

function Badge({ level, children }: { level: RiskLevel; children: React.ReactNode }) {
  return (
    <span className={styles.badge} style={{ background: SOFT[level], color: DEEP[level] }}>
      <span className={styles.badgeDot} style={{ background: SOLID[level] }} />
      {children}
    </span>
  );
}

function PanelHeader({ title }: { title: string }) {
  const { select } = useApp();
  return (
    <div className={styles.headerRow}>
      <span className={styles.panelTitle}>{title}</span>
      <button className={styles.closeBtn} onClick={() => select(null)} aria-label="Close">
        ✕
      </button>
    </div>
  );
}

// ---------- default: route summary + policy clocks ----------

function DefaultPanel() {
  const { mode, settings, addHint, today } = useApp();
  const { scheduled, clocks, routeAlerts, past, outcomes } = useDerived();

  return (
    <>
      {mode === "future" ? (
        <div className={styles.stack}>
          <span className={styles.sectionLabel}>Route</span>
          {scheduled.length > 0 ? (
            <>
              <span className={styles.routeDates}>
                {fmtShort(settings.routeStart, true)} → {fmtShort(scheduled[scheduled.length - 1].endISO, true)}
              </span>
              <span className={styles.meta}>
                {scheduled.reduce((n, s) => n + s.stop.lengthDays, 0)} days ·{" "}
                {new Set(scheduled.map((s) => s.stop.state)).size} states
              </span>
              {routeAlerts > 0 && (
                <span className={styles.alertRow}>
                  <span className={styles.alertDot} style={{ background: "var(--triggered)" }} />
                  <b>
                    {routeAlerts} route alert{routeAlerts === 1 ? "" : "s"}
                  </b>
                  <span style={{ color: "var(--faint)" }}>— select the state to review</span>
                </span>
              )}
            </>
          ) : (
            <span className={styles.meta}>
              Starts {fmtShort(settings.routeStart)}. Pick a state on the map to add the first stop.
            </span>
          )}
          {addHint && (
            <div
              className={styles.note}
              style={{ background: "var(--navy-soft)", color: "var(--ink)" }}
            >
              Pick a state on the map — its demo thresholds and issues will show here before you
              add it to the route.
            </div>
          )}
        </div>
      ) : (
        <div className={styles.stack}>
          <span className={styles.sectionLabel}>2026 so far</span>
          <span className={styles.routeDates}>{fmtShort(past[0]?.firstDay ?? today)} → {fmtShort(today)}</span>
          <span className={styles.meta}>
            {past.length} states · {past.reduce((n, a) => n + a.workDays, 0)} work days logged
          </span>
          <span className={styles.alertRow}>
            <span className={styles.alertDot} style={{ background: "var(--triggered)" }} />
            <b>{[...outcomes.values()].filter((o) => o.coHit).length} states</b>
            <span style={{ color: "var(--faint)" }}>triggered withholding</span>
          </span>
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.stackLg}>
        <span className={styles.sectionLabel}>Policy clocks</span>
        {clocks.run && (
          <Clock
            name={`${STATES[clocks.run.state].name} — current stay`}
            value={clocks.run.workDays}
            cap={clocks.runPlanTo ?? clocks.runBudget ?? 0}
            capLabel={clocks.runPlanTo !== null ? `/ ${clocks.runPlanTo} wd margin` : "no limit"}
            max={clocks.runBudget ?? clocks.run.workDays}
            sub={
              clocks.runBudget !== null
                ? `Demo limit ${clocks.runBudget} · here since ${fmtShort(clocks.run.startISO)}`
                : `No demo limit — here since ${fmtShort(clocks.run.startISO)}`
            }
          />
        )}
        <Clock
          name={`Days outside ${settings.residence}`}
          value={mode === "future" ? clocks.outsideResidenceWithRoute : clocks.outsideResidence}
          cap={120}
          capLabel="/ 120 demo cap"
          max={120}
          sub={
            mode === "future" && scheduled.length > 0
              ? "Includes the planned route"
              : "All logged non-residence days to date"
          }
        />
        <Clock
          name="Days outside the U.S."
          value={mode === "future" ? clocks.foreignDaysWithRoute : clocks.foreignDays}
          cap={45}
          capLabel="/ 45 demo cap"
          max={45}
          sub={
            (mode === "future" ? clocks.foreignDaysWithRoute : clocks.foreignDays) === 0
              ? "No foreign work days"
              : "Illustrative cross-border policy — replace before real use"
          }
        />
      </div>

      <div className={styles.spacer} />
      <span className={styles.footnote}>
        Wage thresholds priced at {fmtMoney(settings.salary)} salary — change in Settings.
      </span>
    </>
  );
}

function Clock({
  name,
  value,
  cap,
  capLabel,
  max,
  sub,
}: {
  name: string;
  value: number;
  cap: number;
  capLabel: string;
  max: number;
  sub: string;
}) {
  const pct = max > 0 ? Math.min((value / max) * 100, 100) : 0;
  const color =
    max > 0 && value > cap ? "var(--triggered)" : pct > 55 ? "var(--caution)" : "var(--clear)";
  return (
    <div className={styles.clock}>
      <div className={styles.clockHead}>
        <span className={styles.clockName}>{name}</span>
        <span className={styles.clockValue}>
          {value} <span className={styles.clockValueDim}>{capLabel}</span>
        </span>
      </div>
      <div className={styles.gauge}>
        <div className={styles.gaugeFill} style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className={styles.clockSub}>{sub}</span>
    </div>
  );
}

// ---------- past: issues for the selected state ----------

function PastStatePanel({ code }: { code: string }) {
  const { setPastView, select } = useApp();
  const { pastByState, outcomes, rate } = useDerived();
  const info = STATES[code];
  const agg = pastByState.get(code);
  const outcome = agg ? outcomes.get(code) : undefined;

  return (
    <>
      <div className={styles.stack}>
        <PanelHeader title={info.name} />
        {outcome ? (
          <Badge level={outcome.level}>
            {outcome.coHit
              ? "Withholding triggered"
              : outcome.youHit
                ? "Your NR return required"
                : "No obligation"}
          </Badge>
        ) : (
          <Badge level="clear">Not visited in 2026</Badge>
        )}
        {agg && (
          <span className={styles.meta}>
            {agg.stays.map((s) => s.stay.location).filter((v, i, a) => a.indexOf(v) === i).join(" · ")}{" "}
            · {agg.workDays} wd · {fmtMoney(agg.workDays * rate)} sourced
          </span>
        )}
      </div>

      <div className={styles.divider} />

      {agg && outcome ? (
        <div className={styles.stackLg}>
          <span className={styles.sectionLabel}>
            Issues · {(outcome.coHit ? 1 : 0) + (outcome.youHit ? 1 : 0)}
          </span>
          {outcome.coHit && (
            <div className={styles.issueRow}>
              <span className={styles.issueDot} style={{ background: "var(--triggered)" }} />
              <div className={styles.issueBody}>
                <span className={styles.issueTitle}>
                  Employer withholding triggered
                </span>
                <span className={styles.issueText}>
                  Threshold: {info.withholdingText}.{" "}
                  {info.employerRegistered
                    ? "The fictional employer is registered — this demonstrates a payroll correction in an existing account."
                    : "The fictional employer is not registered — this demonstrates a new registration and recurring filings."}
                </span>
              </div>
            </div>
          )}
          {outcome.youHit && (
            <div className={styles.issueRow}>
              <span className={styles.issueDot} style={{ background: "var(--caution)" }} />
              <div className={styles.issueBody}>
                <span className={styles.issueTitle}>Your nonresident return</span>
                <span className={styles.issueText}>
                  Threshold: {info.filingText}. A return is due on the{" "}
                  {fmtMoney(outcome.wages)} sourced here.
                </span>
              </div>
            </div>
          )}
          {!outcome.coHit && !outcome.youHit && (
            <span className={styles.issueText}>
              {info.filing || info.withholding
                ? `Below every threshold — filing at ${info.filingText}, withholding at ${info.withholdingText}.`
                : "No threshold in the fictional demo profile."}
            </span>
          )}
        </div>
      ) : (
        <div className={styles.stackLg}>
          <span className={styles.sectionLabel}>Thresholds</span>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Your nonresident filing</span>
            <span className={styles.kvVal}>{info.filingText}</span>
          </div>
          <div className={styles.kvRow}>
            <span className={styles.kvKey}>Employer withholding</span>
            <span className={styles.kvVal}>{info.withholdingText}</span>
          </div>
        </div>
      )}

      {agg && outcome && (outcome.youHit || outcome.coHit) && (
        <>
          <div className={styles.divider} />
          <div className={styles.stackLg}>
            <span className={styles.sectionLabel}>What to do</span>
            {outcome.youHit && (
              <div className={styles.checkRow}>
                <span className={styles.checkbox} />
                <span>File {info.nrForm ?? `the ${code} nonresident return`} at year-end</span>
              </div>
            )}
            {outcome.coHit && (
              <div className={styles.checkRow}>
                <span className={styles.checkbox} />
                <span>
                  {info.employerRegistered
                    ? "Confirm the sample payroll correction"
                    : "Flag the sample employer registration"}
                </span>
              </div>
            )}
          </div>
        </>
      )}

      {info.flag && (
        <div
          className={styles.note}
          style={{ background: "var(--tile)", color: "var(--slate)" }}
        >
          {info.flag}
        </div>
      )}

      <div className={styles.spacer} />
      <button
        className={styles.ghostBtn}
        onClick={() => {
          setPastView("report");
          select(null);
        }}
      >
        View in full report
      </button>
    </>
  );
}

// ---------- future: add / edit a stop ----------

function FutureStatePanel({ code }: { code: string }) {
  const { addStop, updateStop, removeStop, select, settings } = useApp();
  const { scheduled, pastByState, rate } = useDerived();
  const info = STATES[code];

  // The panel is keyed by state code, so initial values reset on selection change.
  const existing = [...scheduled].reverse().find((s) => s.stop.state === code);
  const [length, setLength] = useState(existing?.stop.lengthDays ?? 14);
  const [location, setLocation] = useState(existing?.stop.location ?? "");

  const wdStay = Math.round(length * 5 / 7);
  const wdBefore = existing
    ? existing.wdBefore
    : (pastByState.get(code)?.workDays ?? 0) + scheduled.filter((s) => s.stop.state === code).reduce((n, s) => n + s.workDays, 0);
  const verdict = futureVerdict(code, wdBefore, wdStay, rate, settings.margin);
  const budget = budgetWd(info.withholding, rate);
  const pt = planTo(budget, settings.margin);

  return (
    <>
      <div className={styles.stack}>
        <PanelHeader title={info.name} />
        <Badge level={verdict.level}>{verdict.label}</Badge>
        {existing && (
          <span className={styles.meta}>
            Stop {existing.index + 1}
            {existing.stop.location ? ` · ${existing.stop.location}` : ""}
          </span>
        )}
      </div>

      <div className={styles.divider} />

      <div className={styles.stackLg}>
        <span className={styles.sectionLabel}>Thresholds</span>
        <div className={styles.kvRow}>
          <span className={styles.kvKey}>Your nonresident filing</span>
          <span className={styles.kvVal}>{info.filingText}</span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvKey}>Employer withholding</span>
          <span className={styles.kvVal}>{info.withholdingText}</span>
        </div>
        <div className={styles.kvRow}>
          <span className={styles.kvKey}>Registration</span>
          <span
            className={styles.kvVal}
            style={{
              fontFamily: "inherit",
              color: info.employerRegistered ? "var(--ink)" : "var(--triggered-deep)",
            }}
          >
            {info.country === "CA"
              ? "Canadian entity unverified"
              : info.employerRegistered
                ? "Demo: registered"
                : "Demo: not registered"}
          </span>
        </div>
        {budget !== null && pt !== null && (
          <span className={styles.footnote}>
            Budget ≈ {budget} demo work days · plan to {pt} at your {Math.round(settings.margin * 100)}%
            margin.
          </span>
        )}
      </div>

      {verdict.detail && (
        <div
          className={styles.note}
          style={{ background: SOFT[verdict.level], color: DEEP[verdict.level] }}
        >
          {verdict.detail}
        </div>
      )}
      {!verdict.detail && info.flag && (
        <div className={styles.note} style={{ background: "var(--tile)", color: "var(--slate)" }}>
          {info.flag}
        </div>
      )}

      <div className={styles.divider} />

      <div className={styles.stackLg}>
        <span className={styles.sectionLabel}>{existing ? "This stay" : "Plan a stay"}</span>
        <input
          className={styles.textInput}
          placeholder="Location (city or park, optional)"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
        />
        <div className={styles.kvRow}>
          <span className={styles.kvKey}>Length</span>
          <span className={styles.kvVal}>
            {length} days ≈ {wdStay} wd
          </span>
        </div>
        <Slider.Root
          className={styles.sliderRoot}
          value={length}
          min={1}
          max={56}
          onValueChange={(v) => setLength(v as number)}
        >
          <Slider.Control className={styles.sliderControl}>
            <Slider.Track className={styles.sliderTrack}>
              <Slider.Indicator className={styles.sliderIndicator} />
              <Slider.Thumb className={styles.sliderThumb} />
            </Slider.Track>
          </Slider.Control>
        </Slider.Root>
        {existing ? (
          <span className={styles.footnote}>
            {fmtRange(existing.startISO, existing.endISO)} — auto-chained; changing the length
            re-dates everything after it.
          </span>
        ) : (
          <span className={styles.footnote}>
            Chains onto the end of the route — starts{" "}
            {scheduled.length > 0
              ? `after ${STATES[scheduled[scheduled.length - 1].stop.state].name}`
              : fmtShort(settings.routeStart)}
            .
          </span>
        )}
      </div>

      <div className={styles.spacer} />
      <div className={styles.actions}>
        {existing ? (
          <>
            <button
              className={styles.primaryBtn}
              onClick={() => updateStop(existing.stop.id, { lengthDays: length, location })}
            >
              Save changes
            </button>
            <button
              className={styles.ghostBtn}
              onClick={() => {
                removeStop(existing.stop.id);
                select(null);
              }}
            >
              <span className={styles.dangerText}>Remove stop</span>
            </button>
            <button
              className={styles.ghostBtn}
              onClick={() => addStop({ state: code, location, lengthDays: length })}
            >
              Add another stay here
            </button>
          </>
        ) : (
          <button
            className={styles.primaryBtn}
            onClick={() => addStop({ state: code, location, lengthDays: length })}
          >
            Add to route
          </button>
        )}
      </div>
    </>
  );
}

// ---------- report actions ----------

function ReportPanel() {
  const { setPastView, today } = useApp();
  return (
    <>
      <div className={styles.stack}>
        <div className={styles.headerRow}>
          <span className={styles.panelTitle}>Report</span>
          <button
            className={styles.closeBtn}
            onClick={() => setPastView("map")}
            aria-label="Back to map"
          >
            ✕
          </button>
        </div>
        <span className={styles.meta}>Generated {fmtShort(today)} from the 2026 log</span>
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryBtn} onClick={() => window.print()}>
          Download PDF
        </button>
        <button className={styles.ghostBtn} onClick={() => setPastView("map")}>
          Back to map
        </button>
      </div>

      <div className={styles.divider} />

      <div className={styles.stackLg}>
        <span className={styles.sectionLabel}>Sources</span>
        <span className={styles.issueText}>
          Thresholds and employer registration statuses are fictional data designed to exercise the
          interface. Replace them with reviewed sources before real use.
        </span>
        <span className={styles.issueText}>
          Stays are fictional sample records. Work days = weekdays; PTO is not subtracted. This demo
          is not legal, payroll, or tax advice.
        </span>
      </div>
    </>
  );
}
