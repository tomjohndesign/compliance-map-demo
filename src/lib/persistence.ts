import { validateDay, type LedgerState, type WorkDay } from "./ledger/model.ts";
import { validatePeriod, type PayPeriod } from "./reporting/payroll.ts";
export interface PeriodRevision { before?: PayPeriod; after: PayPeriod; changedAt: string }
export interface SavedWork {
  ledger: LedgerState;
  payPeriods: PayPeriod[];
  payrollActive: string[];
  periodRevisions: PeriodRevision[];
}
function object(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function day(value: unknown): value is WorkDay {
  if (!object(value) || typeof value.date !== "string" || !["reported", "attested", "projected"].includes(String(value.status)) || !Array.isArray(value.sessions)) return false;
  if (!value.sessions.every(s => object(s) && typeof s.id === "string" && typeof s.state === "string" && typeof s.municipality === "string" && typeof s.hours === "number")) return false;
  if (value.status === "attested" && typeof value.attestedAt !== "string") return false;
  return !validateDay(value as unknown as WorkDay).length;
}
function period(value: unknown): value is PayPeriod {
  return object(value) && typeof value.id === "string" && typeof value.start === "string" && typeof value.end === "string" && ["employee_entered", "payroll_actual"].includes(String(value.source)) && !validatePeriod(value as unknown as PayPeriod).length;
}
export function readSavedWork(text: string): SavedWork {
  const value: unknown = JSON.parse(text);
  if (!object(value) || !object(value.ledger) || !object(value.ledger.days) || !Array.isArray(value.ledger.revisions) || !Array.isArray(value.payPeriods) || !Array.isArray(value.payrollActive)) throw new Error("Invalid saved work data");
  for (const [date, entry] of Object.entries(value.ledger.days)) if (!day(entry) || date !== entry.date) throw new Error("Invalid saved work day");
  for (const revision of value.ledger.revisions) if (!object(revision) || !day(revision.after) || (revision.before !== undefined && !day(revision.before)) || typeof revision.reason !== "string" || typeof revision.changedAt !== "string" || typeof revision.id !== "string") throw new Error("Invalid saved revision");
  if (!value.payPeriods.every(period) || !value.payrollActive.every(k => typeof k === "string" && /^\d{4}:[A-Z]{2}$/.test(k))) throw new Error("Invalid saved payroll data");
  const periodRevisions = value.periodRevisions ?? [];
  if (!Array.isArray(periodRevisions) || !periodRevisions.every(r => object(r) && period(r.after) && (r.before === undefined || period(r.before)) && typeof r.changedAt === "string")) throw new Error("Invalid pay-period history");
  return { ...value, periodRevisions } as unknown as SavedWork;
}
