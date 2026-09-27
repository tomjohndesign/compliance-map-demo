"use client";
import { useMemo, useState } from "react";
import { fmtMoney, fmtRange } from "@/lib/dates";
import { useApp } from "@/lib/store";
import { useDerived } from "@/lib/derived";
import { STATES } from "@/lib/states";
import { getEmployerPolicyStatus } from "@/lib/employer/demoEmployer";
import { forecastRoute } from "@/lib/compliance/forecast";
import type { StateOutcome } from "@/lib/compliance/evaluate";
import { RuleDetails } from "./RuleDetails";
import styles from "./panel.module.css";
import w from "./workbench.module.css";

export function SidebarRight() {
  const { selected, mode, pastView, setPastView, select, storageError, employer } = useApp();
  const { scheduled, routeAlerts } = useDerived();
  return <aside className={`${styles.panel} no-print`}>
    {storageError && <p role="alert" className={w.notice}>{storageError}</p>}
    {selected && pastView === "map" ? <StatePanel key={`${mode}-${selected}`} code={selected} /> : <>
      <h2 className={styles.panelTitle}>{pastView === "report" ? "Payroll report" : pastView === "ledger" ? "Work records" : mode === "future" ? "Plan your route" : "Your work year"}</h2>
      <p className={styles.meta}>{employer.name} permits work in {Object.values(employer.supportedStates).filter(s => s === "allowed").length} states. Travel can include other locations, but work there is prohibited.</p>
      {mode === "future" ? <><p>{scheduled.length} planned stays · {routeAlerts} reviews / actions</p><p className={styles.meta}>Select a state to edit a stay. Dates chain automatically. Projections use weekdays and estimated salary; actual work replaces projections.</p></> : <>
        <p className={styles.meta}>Start by confirming the work ledger. The supplied travel itinerary is projected activity until you report or attest it.</p>
        <button className={styles.primaryBtn} onClick={() => { setPastView("ledger"); select(null); }}>Review work ledger</button>
        <button className={styles.ghostBtn} onClick={() => { setPastView("report"); select(null); }}>Open payroll report</button>
      </>}
      {pastView === "report" && <button className={styles.primaryBtn} onClick={() => window.print()}>Print / save PDF</button>}
      <div className={styles.divider} /><p className={styles.footnote}>Eight-state research prototype. State income-tax filing exposure and withholding are evaluated separately. Local taxes, residence changes, special compensation and assigned-office sourcing can require additional review.</p>
      <p className={styles.footnote}>Records are saved in this browser. Exports are snapshots; this prototype does not submit changes to a payroll provider.</p>
    </>}
  </aside>;
}
function OutcomeSummary({ outcome }: { outcome: StateOutcome }) {
  return <div className={styles.stackLg}>
    <span className={styles.badge} style={{ background: `var(--${outcome.level}-soft)`, color: `var(--${outcome.level}-deep)`, height: "auto", padding: "6px 10px" }}>{outcome.label}</span>
    {outcome.status === "not_permitted" ? <p className={styles.issueText}>{outcome.employeeAction}</p> : <>
      <div className={styles.kvRow}><span className={styles.kvKey}>Filing exposure</span><span className={styles.kvVal}>{outcome.filing.value === true ? "Potential return" : outcome.filing.value === false ? "Not identified" : "Review required"}</span></div>
      <div className={styles.kvRow}><span className={styles.kvKey}>Withholding</span><span className={styles.kvVal}>{outcome.withholding.value === true ? "Treatment applies" : outcome.withholding.value === false ? "Not triggered" : "Review required"}</span></div>
      {outcome.remaining !== undefined && <p className={styles.issueText}>{outcome.remaining} qualifying workdays before the modeled withholding threshold. Employer safety margin is separate from law.</p>}
      <p className={styles.issueText}><b>Payroll:</b> {outcome.payrollAction}</p>
    </>}
    <RuleDetails outcome={outcome} />
  </div>;
}
function StatePanel({ code }: { code: string }) {
  const { mode, select, today, payrollActive, setPayrollActive, employer } = useApp();
  const { outcomes } = useDerived();
  const outcome = outcomes.get(code)!;
  return <>
    <div className={styles.headerRow}><h2 className={styles.panelTitle}>{STATES[code].name}</h2><button className={styles.closeBtn} aria-label="Close state details" onClick={() => select(null)}>×</button></div>
    <p className={styles.meta}>Employer policy: {getEmployerPolicyStatus(code, employer).replaceAll("_", " ")}{STATES[code].country === "CA" ? " · International work requires separate review" : ""}</p>
    {mode === "future" ? <FutureEditor code={code} /> : <>
      <p className={styles.meta}>{outcome.workDays} reported workdays · {outcome.hours} hours · {outcome.projectedDays} projected workdays awaiting confirmation</p>
      <p className={styles.meta}>{outcome.wages === undefined ? "Sourced wages pending complete payroll data" : `${fmtMoney(outcome.wages)} provisional wage allocation`}</p>
      <OutcomeSummary outcome={outcome} />
      {outcome.reasons.length > 0 && <details className={w.details}><summary>Data and review needs</summary><ul className={w.list}>{outcome.reasons.map(r => <li key={r}>{r}</li>)}</ul></details>}
      {outcome.withholding.value === true && getEmployerPolicyStatus(code, employer) === "allowed" && <label className={w.check}><input type="checkbox" checked={payrollActive.includes(`${today.slice(0, 4)}:${code}`)} onChange={e => setPayrollActive(`${today.slice(0, 4)}:${code}`, e.target.checked)} />Payroll has confirmed this year’s state treatment is active (record only; no payroll submission).</label>}
    </>}
  </>;
}
function FutureEditor({ code }: { code: string }) {
  const { planned, settings, addStop, updateStop, removeStop, moveStop, payrollActive, employer } = useApp();
  const { days } = useDerived();
  const choices = planned.filter(p => p.state === code);
  const [stopId, setStopId] = useState(choices.at(-1)?.id ?? "new");
  const existing = planned.find(p => p.id === stopId);
  const [length, setLength] = useState(existing?.lengthDays ?? 14);
  const [location, setLocation] = useState(existing?.location ?? "");
  const preview = useMemo(() => {
    const candidate = { id: stopId, state: code, location, lengthDays: length };
    const route = existing ? planned.map(p => p.id === stopId ? candidate : p) : [...planned, candidate];
    return forecastRoute(route, days, settings, payrollActive, employer).find(s => s.stop.id === stopId)!;
  }, [planned, days, settings, payrollActive, stopId, length, location, code, existing, employer]);
  const permitted = getEmployerPolicyStatus(code, employer) === "allowed";
  return <>
    {choices.length > 0 && <label className={w.field}>Stay to edit<select className={w.input} value={stopId} onChange={e => {
      setStopId(e.target.value); const stop = planned.find(p => p.id === e.target.value); setLength(stop?.lengthDays ?? 14); setLocation(stop?.location ?? "");
    }}><option value="new">Add another stay</option>{choices.map(p => <option key={p.id} value={p.id}>{p.location || "Unnamed stay"} · {p.lengthDays} days</option>)}</select></label>}
    <OutcomeSummary outcome={preview.outcome} />
    {permitted && <>
      <p className={styles.meta}>{preview.wdBefore} workdays before stay · +{preview.workDays} projected · {preview.outcome.workDays} in ending tax year</p>
      {preview.withholdingTriggerDate && <p className={w.notice}>Withholding treatment projected to change {preview.withholdingTriggerDate}.</p>}
      {preview.filingTriggerDate && <p className={styles.meta}>Filing exposure projected {preview.filingTriggerDate}.</p>}
      <p className={styles.meta}>Estimated state wages: {fmtMoney(preview.outcome.wages ?? 0)} in {preview.endISO.slice(0, 4)}. Based on salary / 2,080 hours, not payroll actuals.</p>
      {preview.years.some(y => y !== "2026") && <p className={w.notice}>This stay reaches a year without reviewed rules. Annual counters reset; 2026 rules are not carried forward.</p>}
      <p className={styles.footnote}>Forecast assumes projected weekdays occurred as planned. Unreported past work must be reconciled before relying on dates.</p>
    </>}
    <label className={w.field}>Location<input className={w.input} value={location} onChange={e => setLocation(e.target.value)} /></label>
    <label className={w.field}>Stay length (calendar days)<input className={w.input} type="number" min="1" max="366" value={length} onChange={e => setLength(Math.max(1, Math.min(366, Number(e.target.value) || 1)))} /></label>
    <p className={styles.meta}>{fmtRange(preview.startISO, preview.endISO, true)} · dates chain automatically</p>
    {existing ? <>
      <button className={styles.primaryBtn} onClick={() => updateStop(existing.id, { location, lengthDays: length })}>Save stay changes</button>
      <div className={w.row}><button className={w.secondary} onClick={() => moveStop(existing.id, -1)}>Move earlier</button><button className={w.secondary} onClick={() => moveStop(existing.id, 1)}>Move later</button></div>
      <button className={styles.ghostBtn} onClick={() => { removeStop(existing.id); setStopId("new"); }}>Remove stay</button>
    </> : <button className={styles.primaryBtn} disabled={!permitted} onClick={() => addStop({ state: code, location, lengthDays: length })}>Add permitted work stay</button>}
  </>;
}
