"use client";

import { fmtMoney, fmtRange, fmtShort } from "@/lib/engine";
import { useApp } from "@/lib/store";
import { useDerived } from "@/lib/derived";
import { STATES } from "@/lib/states";
import type { RiskLevel } from "@/lib/types";
import styles from "./report.module.css";

const SOLID: Record<RiskLevel, string> = {
  clear: "var(--clear)",
  caution: "var(--caution)",
  triggered: "var(--triggered)",
};

export function ReportView() {
  const { today, settings } = useApp();
  const { past, outcomes, rate } = useDerived();

  const totalWd = past.reduce((n, a) => n + a.workDays, 0);
  const withholding = past.filter((a) => outcomes.get(a.state)!.coHit);
  const filings = past.filter((a) => outcomes.get(a.state)!.youHit);
  const netNew = withholding.filter(
    (a) => !STATES[a.state].employerRegistered && STATES[a.state].country !== "CA"
  );

  // Chronological stop list (each attributed stay segment).
  const stops = past
    .flatMap((agg) => agg.stays.map((sa) => ({ agg, sa })))
    .sort((a, b) => a.sa.from.localeCompare(b.sa.from));

  const issueLine = (state: string): string => {
    const info = STATES[state];
    const o = outcomes.get(state)!;
    if (o.coHit && !info.employerRegistered)
      return "Demo: crosses the withholding trigger in an unregistered state — new employer registration.";
    if (o.coHit && o.youHit)
      return `Demo withholding triggered (${info.withholdingText}) + a sample NR return; employer already registered.`;
    if (o.coHit) return `Demo withholding triggered (${info.withholdingText}) — employer already registered.`;
    if (o.youHit) return `Sample NR return triggered; employer side clear (${info.withholdingText}).`;
    if (!info.filing && !info.withholding) return "No demo trigger.";
    return `Below demo thresholds (filing ${info.filingText} · withholding ${info.withholdingText}).`;
  };

  const estFor = (state: string, wages: number) =>
    wages * (STATES[state].estRate ?? 0.05);

  const totalWages = filings.reduce((n, a) => n + a.workDays * rate, 0);
  const totalEst = filings.reduce((n, a) => n + estFor(a.state, a.workDays * rate), 0);

  return (
    <main className={styles.wrap}>
      <div className={styles.doc} id="report">
        <div>
          <h1 className={styles.title}>Compliance report — 2026</h1>
          <p className={styles.sub}>
            Jan 1 – {fmtShort(today)} · prepared {fmtShort(today)} · fictional demo thresholds · salary{" "}
            {fmtMoney(settings.salary)} ≈ {fmtMoney(rate)}/work day
          </p>
          <div className={styles.statRow}>
            <Stat value={String(past.length)} label="states visited" />
            <Stat value={String(totalWd)} label="work days logged" />
            <Stat
              value={String(withholding.length)}
              label="withholding triggered"
              color="var(--triggered-deep)"
            />
            <Stat
              value={String(filings.length)}
              label="nonresident returns"
              color="var(--caution-deep)"
            />
            <Stat value={String(netNew.length)} label="net-new registration" />
          </div>
        </div>

        <div>
          <span className={styles.sectionLabel}>Stops · issues &amp; limitations</span>
          {stops.map(({ agg, sa }) => (
            <div key={sa.stay.id} className={styles.stopRow}>
              <span
                className={styles.stopDot}
                style={{ background: SOLID[outcomes.get(agg.state)!.level] }}
              />
              <span className={styles.stopName}>
                {STATES[agg.state].name} <span className={styles.stopCity}>{sa.stay.location}</span>
              </span>
              <span className={styles.stopDates}>
                {sa.to >= today ? `${fmtShort(sa.from)} – now` : fmtRange(sa.from, sa.to)}
              </span>
              <span className={styles.stopWd}>{sa.workDays} wd</span>
              <span className={styles.stopIssue}>{issueLine(agg.state)}</span>
            </div>
          ))}
          <p className={styles.limits}>
            Limitations: work days = weekdays attributed to one state per day (air trips override
            the ground stay); PTO not subtracted · wages priced at {fmtMoney(rate)}/wd from your
            salary · all thresholds, registration statuses, and estimates are illustrative.
          </p>
        </div>

        <div>
          <span className={styles.sectionLabel}>Your obligations — what you file</span>
          <div className={styles.thead}>
            <span className={styles.cState}>State</span>
            <span className={styles.cNum}>Work days</span>
            <span className={styles.cNum}>Wages</span>
            <span className={styles.cWide} style={{ paddingLeft: 16 }}>
              Return
            </span>
            <span className={styles.cRight}>Est. liability</span>
          </div>
          {filings.map((a) => {
            const wages = a.workDays * rate;
            return (
              <div key={a.state} className={styles.trow}>
                <span className={styles.cState}>{STATES[a.state].name}</span>
                <span className={styles.cNum}>{a.workDays}</span>
                <span className={styles.cNum}>{fmtMoney(wages)}</span>
                <span className={styles.cWide} style={{ paddingLeft: 16 }}>
                  {STATES[a.state].nrForm ?? `${a.state} sample nonresident return`}
                </span>
                <span className={styles.cRight}>≈ {fmtMoney(estFor(a.state, wages))}</span>
              </div>
            );
          })}
          <div className={styles.trowTotal}>
            <span className={styles.cState}>Total</span>
            <span className={styles.cNum}>{filings.reduce((n, a) => n + a.workDays, 0)}</span>
            <span className={styles.cNum}>{fmtMoney(totalWages)}</span>
            <span className={styles.cWide} style={{ paddingLeft: 16 }}>
              {filings.length} returns
            </span>
            <span className={styles.cRight}>≈ {fmtMoney(totalEst)}</span>
          </div>
          <p className={styles.limits}>
            Demo estimates use a fictional flat rate and are not legal, payroll, or tax guidance.
          </p>
        </div>

        <div>
          <span className={styles.sectionLabel}>Employer implications — sample obligations</span>
          <div className={styles.thead}>
            <span className={styles.cState}>State</span>
            <span className={styles.cWide}>Trigger crossed</span>
            <span className={styles.cWide}>Registration status</span>
            <span className={styles.cFlex}>Action on their side</span>
          </div>
          {withholding.map((a) => {
            const info = STATES[a.state];
            const netNewRow = !info.employerRegistered && info.country !== "CA";
            return (
              <div key={a.state} className={styles.trow}>
                <span className={`${styles.cState} ${netNewRow ? styles.danger : ""}`}>
                  {info.name}
                </span>
                <span className={styles.cWide} style={{ fontFamily: "var(--font-geist-mono)", fontSize: 12 }}>
                  {info.withholdingText}
                </span>
                <span className={`${styles.cWide} ${netNewRow ? styles.danger : ""}`}>
                  {netNewRow
                    ? "Demo: not registered"
                    : "Demo: registered"}
                </span>
                <span className={styles.cFlex}>
                  {netNewRow
                    ? "Sample registration + recurring filings"
                    : "Sample payroll correction in existing account"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </main>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color?: string }) {
  return (
    <div className={styles.stat}>
      <span className={styles.statValue} style={color ? { color } : undefined}>
        {value}
      </span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  );
}
