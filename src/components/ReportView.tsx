"use client";
import { useMemo, useState } from "react";
import { useApp } from "@/lib/store";
import { useDerived } from "@/lib/derived";
import { allocatePayPeriod, validatePeriod, type PayPeriod } from "@/lib/reporting/payroll";
import { allocationCSV } from "@/lib/reporting/export";
import { coverageIssues } from "@/lib/ledger/model";
import { fmtMoney } from "@/lib/dates";
import { RuleDetails } from "./RuleDetails";
import styles from "./workbench.module.css";

function download(name: string, text: string, type: string) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function ReportView() {
  const { today, settings, payPeriods, savePeriod, periodRevisions, ledger, payrollActive, storageError, employer } = useApp();
  const { days, outcomes, workedStates } = useDerived();
  const [start, setStart] = useState(`${today.slice(0, 7)}-01`);
  const [end, setEnd] = useState(today);
  const [gross, setGross] = useState("");
  const [selected, setSelected] = useState(payPeriods.at(-1)?.id ?? "");
  const [error, setError] = useState("");
  const period = payPeriods.find(p => p.id === selected);
  const report = useMemo(() => period ? allocatePayPeriod(days, period, employer) : undefined, [days, period, employer]);
  const [generatedAt] = useState(() => new Date().toISOString());
  const year = today.slice(0, 4);
  const startYear = settings.trackingStart > `${year}-01-01` ? settings.trackingStart : `${year}-01-01`;
  const coverage = coverageIssues(days, startYear, today);
  const stateResults = [...outcomes.values()].filter(o => o.workDays || o.projectedDays || o.code === settings.assignedWorkState);
  const snapshot = () => ({ generatedAt: new Date().toISOString(), employee: "Alex Morgan (fictional demo)", settings, dataThrough: today,
    ruleVersions: [...new Set(stateResults.map(o => o.rule?.version).filter(Boolean))],
    employer, report, annualOutcomes: stateResults, ledger, days, payPeriods, periodRevisions, payrollActive,
    scope: "Nonresident regular W-2 wages; state income-tax exposure and withholding; no payroll submission", coverageIssues: coverage });
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const next: PayPeriod = { id: `period-${start}-${end}`, start, end, grossWages: gross.trim() ? Number(gross) : undefined, source: "employee_entered" };
    const issues = validatePeriod(next);
    if (end > today) issues.push("Enter a completed pay period, not future wages.");
    if (payPeriods.some(p => p.id !== next.id && p.start <= end && p.end >= start)) issues.push("This period overlaps a saved period. Use the original dates to correct its gross wages.");
    if (issues.length) { setError(issues.join(" ")); return; }
    savePeriod(next); setSelected(next.id); setError("");
  };
  return <main className={styles.wrap} id="report">
    <div className={styles.card}><h1 className={styles.title}>Mobile employee payroll report</h1>
      <p className={styles.subtitle}>Alex Morgan · {settings.residence} domicile · {settings.assignedWorkState} assigned work state<br />{year} through {today} · generated {generatedAt}</p>
      <div className={styles.metrics}><span className={styles.metric}><strong>{workedStates.size}</strong>states with reported work</span><span className={styles.metric}><strong>{stateResults.filter(o => o.withholding.value === true).length}</strong>withholding treatments identified</span><span className={styles.metric}><strong>{ledger.revisions.length}</strong>ledger revisions</span></div>
      <p className={styles.small}>Includes recorded and unconfirmed activity, identified separately. Employee-entered gross wages are not payroll-provider verified. State income tax is the scope; local tax, resident returns, corporate nexus, unemployment, insurance and international employment are not calculated.</p>
      <div className={`${styles.row} no-print`}><button className={styles.button} onClick={() => download(`state-lines-${today}.json`, JSON.stringify(snapshot(), null, 2), "application/json")}>Export audit JSON</button><button className={styles.secondary} onClick={() => window.print()}>Print / save PDF</button></div>
      {storageError && <p role="alert" className={styles.notice}>{storageError}</p>}
    </div>
    <form className={`${styles.card} no-print`} onSubmit={save}>
      <h2 className={styles.heading}>Pay-period gross wages</h2>
      <p className={styles.small}>Regular salary only. Use actual gross wages from the pay statement. The same dates replace a saved amount; overlapping periods are rejected.</p>
      <div className={styles.row}><label className={styles.field}>Pay period starts<input className={styles.input} required type="date" value={start} max={today} onChange={e => setStart(e.target.value)} /></label>
        <label className={styles.field}>Pay period ends<input className={styles.input} required type="date" value={end} max={today} onChange={e => setEnd(e.target.value)} /></label>
        <label className={styles.field}>Gross regular wages ($)<input className={styles.input} required type="number" min="0" step="0.01" value={gross} onChange={e => setGross(e.target.value)} /></label>
        <button className={styles.button} disabled={!!storageError}>Save pay period</button></div>
      {error && <p className={styles.notice} role="alert">{error}</p>}
      {payPeriods.length > 0 && <label className={styles.field}>Saved pay period<select className={styles.input} value={selected} onChange={e => { setSelected(e.target.value); const p = payPeriods.find(p => p.id === e.target.value); if (p) { setStart(p.start); setEnd(p.end); setGross(String(p.grossWages ?? "")); } }}><option value="">Select period</option>{payPeriods.map(p => <option key={p.id} value={p.id}>{p.start} – {p.end}</option>)}</select></label>}
    </form>
    {report && <div className={styles.card}>
      <h2 className={styles.heading}>Work-location allocation · {report.period.start} – {report.period.end}</h2>
      <p className={styles.small}>Gross regular wages {fmtMoney(report.period.grossWages ?? 0)} · employee entered. This is allocation data for payroll review, not the tax amount withheld.</p>
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>State</th><th>Workdays</th><th>Hours</th><th>Allocation fraction</th><th>Wages ($)</th></tr></thead>
        <tbody>{report.rows.map(r => <tr key={r.state}><td>{r.state}</td><td>{r.workdays}</td><td>{r.hours}</td><td>{r.numerator} / {r.denominator}</td><td>{r.wages?.toFixed(2) ?? "Pending review"}</td></tr>)}</tbody>
        <tfoot><tr><th>Total</th><td>{report.totalWorkdays} distinct days</td><td>{report.totalHours}</td><td>{report.reconciled ? "100% reconciled" : "Unresolved"}</td><td>{report.allocatedWages?.toFixed(2) ?? "—"}</td></tr></tfoot>
      </table></div>
      {report.issues.length ? <div className={styles.notice}><b>Review required</b><ul className={styles.list}>{report.issues.map(issue => <li key={issue}>{issue}</li>)}</ul></div> : <p className={styles.success}>Work-location allocation reconciles to gross wages. Review the state outcomes below before processing payroll.</p>}
      {report.rows.map(row => <p key={row.state} className={styles.small}>{row.state}: {row.method} · {row.ruleVersion ?? "No reviewed rule"}</p>)}
      <button className={`${styles.secondary} no-print`} onClick={() => download(`allocation-${report.period.start}.csv`, allocationCSV(report), "text/csv")}>Export allocation CSV</button>
    </div>}
    {periodRevisions.length > 0 && <details className={styles.card}><summary className={styles.heading}>Pay-period correction history</summary>
      {periodRevisions.map((r, i) => <p className={styles.small} key={`${r.changedAt}-${i}`}>{r.changedAt} · {r.after.start}–{r.after.end} · {r.before ? fmtMoney(r.before.grossWages ?? 0) : "New period"} → {fmtMoney(r.after.grossWages ?? 0)}</p>)}
    </details>}
    <div className={styles.card}><h2 className={styles.heading}>Annual activity and obligations</h2>
      {coverage.length > 0 && <div className={styles.notice}>Incomplete year-to-date data<ul className={styles.list}>{coverage.map(issue => <li key={issue}>{issue}</li>)}</ul></div>}
      <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>State</th><th>Reported wd / hours</th><th>Projected wd</th><th>Filing exposure</th><th>Withholding</th><th>Policy / status</th></tr></thead>
        <tbody>{stateResults.map(o => <tr key={o.code}><td>{o.code}</td><td>{o.workDays} / {o.hours}</td><td>{o.projectedDays}</td><td>{o.filing.value === true ? "Potential return" : o.filing.value === false ? "Not identified" : "Review"}</td><td>{o.withholding.value === true ? "Treatment applies" : o.withholding.value === false ? "Not triggered" : "Review"}</td><td>{o.label}</td></tr>)}</tbody>
      </table></div>
    </div>
    {stateResults.map(o => <section key={o.code} className={styles.card}><h2 className={styles.heading}>{o.code} · {o.label}</h2>
      <p className={styles.small}><b>Employee:</b> {o.employeeAction}</p><p className={styles.small}><b>Payroll:</b> {o.payrollAction}</p>
      <RuleDetails outcome={o} expanded />
    </section>)}
    <p className={styles.small}>State Lines provides workflow information and recordkeeping tools, not legal or tax advice. Primary review covers the linked assertions; unresolved conditions remain visible. No final tax liability is calculated.</p>
  </main>;
}
