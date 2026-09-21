"use client";
import { useState } from "react";
import { useApp } from "@/lib/store";
import { useDerived } from "@/lib/derived";
import { STATES } from "@/lib/states";
import { addDays, parseISO, toISO } from "@/lib/dates";
import { datesBetween, validateDay, type WorkDay, type WorkSession, type Activity } from "@/lib/ledger/model";
import styles from "./workbench.module.css";

export function LedgerView() {
  const { today, ledger, storageError, saveDay } = useApp();
  const { days } = useDerived();
  const [start, setStart] = useState(toISO(addDays(parseISO(today), -13)));
  const [selected, setSelected] = useState(today);
  const end = toISO(addDays(parseISO(start), 13));
  const visible = datesBetween(start, end > today ? today : end);
  const byDate = new Map(days.map(d => [d.date, d]));
  const complete = visible.length > 0 && visible.every(date => byDate.has(date) && !validateDay(byDate.get(date)!).length);
  const revisions = ledger.revisions.filter(r => r.date === selected).toReversed();
  return <main className={styles.wrap}>
    <div className={styles.card}>
      <h1 className={styles.title}>Work-location ledger</h1>
      <p className={styles.subtitle}>Confirm where you actually worked. Itinerary weekdays start as projections. PTO, holidays and travel without work do not count as workdays.</p>
      {storageError && <p role="alert" className={styles.notice}>{storageError}</p>}
      <div className={styles.row}>
        <label className={styles.field}>Two-week view starts<input className={styles.input} type="date" value={start} max={today} onChange={e => e.target.value && setStart(e.target.value)} /></label>
        <button className={styles.secondary} onClick={() => setStart(toISO(addDays(parseISO(start), -14)))}>Previous 14 days</button>
        <button className={styles.secondary} disabled={end >= today} onClick={() => setStart(toISO(addDays(parseISO(start), 14)))}>Next 14 days</button>
      </div>
      <div className={styles.tableWrap}><table className={styles.table}>
        <thead><tr><th>Date</th><th>Location / activity</th><th>Hours</th><th>Record</th><th>Edit</th></tr></thead>
        <tbody>{visible.map(date => { const day = byDate.get(date); return <tr key={date}>
          <td>{date}</td><td>{day?.sessions.map(s => `${s.state || "Location missing"} · ${s.activity}`).join(" / ") ?? "Missing — confirm work or non-work"}</td>
          <td>{day?.sessions.reduce((n, s) => n + s.hours, 0) ?? "—"}</td><td>{day?.status ?? "missing"}</td>
          <td><button className={styles.secondary} aria-label={`Edit ${date}`} onClick={() => setSelected(date)}>Edit</button></td>
        </tr>; })}</tbody>
      </table></div>
      <p className={styles.small}>By attesting, I certify that the displayed work locations and activities accurately reflect services I performed. Review and correct each day first.</p>
      <button className={styles.secondary} disabled={!complete || !!storageError} onClick={() => visible.forEach(date => {
        const day = byDate.get(date)!;
        if (day.status !== "attested") saveDay({ ...day, status: "attested" }, "Employee attested displayed two-week records", day);
      })}>Attest displayed days</button>
    </div>
    <DayEditor key={selected} date={selected} initial={byDate.get(selected)} />
    <div className={styles.card}><h2 className={styles.heading}>Correction history · {selected}</h2>
      {!revisions.length && <p className={styles.small}>No saved revisions for this day.</p>}
      {revisions.map(r => <details className={styles.details} key={r.id}><summary>{r.changedAt} · {r.reason}</summary>
        <p>Before: {r.before?.sessions.map(s => `${s.state} ${s.activity} ${s.hours}h`).join("; ") ?? "No record"} ({r.before?.status ?? "missing"})</p>
        <p>After: {r.after.sessions.map(s => `${s.state} ${s.activity} ${s.hours}h`).join("; ")} ({r.after.status})</p>
      </details>)}
    </div>
  </main>;
}
function DayEditor({ date, initial }: { date: string; initial?: WorkDay }) {
  const { saveDay, storageError } = useApp();
  const [sessions, setSessions] = useState<WorkSession[]>(initial?.sessions ?? [{ id: `work-${date}`, state: "", country: "US", municipality: "", activity: "work", hours: 8 }]);
  const [reason, setReason] = useState("");
  const [attest, setAttest] = useState(false);
  const [message, setMessage] = useState("");
  const patch = (id: string, value: Partial<WorkSession>) => setSessions(current => current.map(s => s.id === id ? { ...s, ...value } : s));
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const day: WorkDay = { date, sessions, status: attest ? "attested" : "reported" };
    const issues = validateDay(day);
    if (issues.length) { setMessage(issues.join(" ")); return; }
    if (!reason.trim()) { setMessage("Add a reason for this record or correction."); return; }
    saveDay(day, reason, initial); setMessage(attest ? "Day saved and attested." : "Day saved; attestation pending.");
  };
  return <form className={styles.card} onSubmit={save}>
    <h2 className={styles.heading}>Edit day · {date}</h2>
    {sessions.map((s, index) => <div key={s.id} className={styles.session}>
      <div className={styles.row}>
        <label className={styles.field}>State / jurisdiction {index + 1}<select required={s.activity === "work"} className={styles.input} value={s.state} onChange={e => patch(s.id, { state: e.target.value, country: STATES[e.target.value]?.country === "CA" ? "CA" : "US" })}>
          <option value="">Select location</option>{Object.entries(STATES).map(([code, state]) => <option key={code} value={code}>{state.name}</option>)}
        </select></label>
        <label className={styles.field}>Activity {index + 1}<select className={styles.input} value={s.activity} onChange={e => patch(s.id, { activity: e.target.value as Activity, hours: e.target.value === "work" ? 8 : 0 })}>
          {(["work", "pto", "holiday", "sick", "weekend", "travel_nonwork"] as const).map(a => <option key={a} value={a}>{a.replaceAll("_", " ")}</option>)}
        </select></label>
        <label className={styles.field}>Hours {index + 1}<input className={styles.input} type="number" min="0" max="24" step="0.25" required value={s.hours} disabled={s.activity !== "work"} onChange={e => patch(s.id, { hours: Number(e.target.value) })} /></label>
      </div>
      <label className={styles.field}>City / municipality {index + 1}<input className={styles.input} value={s.municipality} onChange={e => patch(s.id, { municipality: e.target.value })} /></label>
      {sessions.length > 1 && <button type="button" className={styles.secondary} onClick={() => setSessions(current => current.filter(v => v.id !== s.id))}>Remove session {index + 1}</button>}
    </div>)}
    <button className={styles.secondary} type="button" onClick={() => setSessions(current => [...current, { id: crypto.randomUUID(), country: "US", state: "", municipality: "", activity: "work", hours: 0 }])}>Add split-day work session</button>
    <label className={styles.field}>Reason / correction note<input className={styles.input} required value={reason} onChange={e => setReason(e.target.value)} /></label>
    <label className={styles.check}><input type="checkbox" checked={attest} onChange={e => setAttest(e.target.checked)} />I attest that these locations, activities and hours accurately reflect this day.</label>
    <button className={styles.button} disabled={!!storageError}>Save work day</button>
    {message && <p role="status" className={styles.notice}>{message}</p>}
  </form>;
}
