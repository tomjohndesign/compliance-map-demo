import type { StateOutcome } from "@/lib/compliance/evaluate";
import { getRule2026 } from "@/lib/compliance/rules2026";
import styles from "./workbench.module.css";
export function RuleDetails({ outcome, expanded = false }: { outcome: StateOutcome; expanded?: boolean }) {
  const rule = outcome.rule;
  if (!rule) {
    const baseline = getRule2026(outcome.code);
    return <details className={styles.details} open={expanded}><summary>Research baseline · review required</summary>
      <p>{baseline ? `${baseline.filing.display} (filing); ${baseline.withholding.display} (withholding).` : "No US rule is available for this jurisdiction."}</p>
      <p>{baseline?.notes}</p><p>Unverified baseline only. It is not used to give clearance.</p>
    </details>;
  }
  return <details className={styles.details} open={expanded}><summary>Why this result? Sources &amp; rule details</summary>
    <p className={styles.small}>{rule.version} · {rule.effectiveFrom}–{rule.effectiveTo} · Primary sources reviewed; no professional legal review.</p>
    <p><b>Filing exposure:</b> {rule.filingSummary}</p><p><b>Withholding:</b> {rule.withholdingSummary}</p>
    <p><b>Allocation:</b> {rule.allocationSummary}</p><p><b>After crossing:</b> {rule.afterCrossing}</p>
    <p><b>Employee forms to review:</b> {rule.forms.join("; ") || "None identified for state wage income tax."}</p>
    <ul className={styles.list}>{rule.openQuestions.map(q => <li key={q}>{q}</li>)}</ul>
    {rule.sources.map(source => <p key={source.id} className={styles.small}>
      <a className={styles.link} href={source.url} target="_blank" rel="noreferrer">{source.agency} — {source.title}</a><br />
      Supports {source.supports.join(", ")} · checked {source.lastVerified}
    </p>)}
    <p className={styles.small}>Filing: {outcome.filing.reasons.join(" ")}<br />Withholding: {outcome.withholding.reasons.join(" ")}</p>
  </details>;
}
