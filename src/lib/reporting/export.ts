import type { PayrollAllocation } from "./payroll.ts";
/** Quote CSV cells and neutralize spreadsheet formula prefixes in untrusted text. */
export function csvCell(value: string | number | undefined): string {
  const text = String(value ?? "");
  const safe = /^[=+@\-\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
}
export function allocationCSV(report: PayrollAllocation): string {
  const rows: (string | number | undefined)[][] = [
    ["period_start", "period_end", "state", "workdays", "hours", "allocated_wages", "money_source", "method", "rule_version", "review_status"],
    ...report.rows.map(r => [report.period.start, report.period.end, r.state, r.workdays, r.hours, r.wages, report.period.source, r.method, r.ruleVersion, report.issues.length ? "REVIEW REQUIRED" : "ALLOCATION RECONCILED"]),
  ];
  return rows.map(row => row.map(csvCell).join(",")).join("\r\n");
}
