import { getEmployerPolicyStatus, type EmployerPolicy } from "../employer/demoEmployer.ts";
import { getRule2026 } from "./rules2026.ts";
import { getReviewedRule, type ReviewedRule } from "./reviewed2026.ts";
import { evaluateExpression, type Evaluation, type Facts } from "./expression.ts";
import { aggregateActivity } from "../ledger/aggregate.ts";
import { coverageIssues, dayCount, jurisdiction, type WorkDay } from "../ledger/model.ts";
import type { Settings, RiskLevel } from "../types";

export interface StateOutcome {
  code: string;
  status: "not_permitted" | "approval_required" | "review_required" | "payroll_action" | "active" | "approaching" | "clear";
  label: string;
  level: RiskLevel;
  filing: Evaluation;
  withholding: Evaluation;
  workDays: number;
  hours: number;
  projectedDays: number;
  wages?: number;
  wageSource: "estimated_salary" | "employee_entered" | "unknown";
  reasons: string[];
  rule?: ReviewedRule;
  remaining?: number;
  employeeAction: string;
  payrollAction: string;
}
export interface EvaluationOptions {
  employer?: EmployerPolicy;
  forecast?: boolean;
  stateWages?: number;
  annualTotalWages?: number;
  payrollActive?: boolean;
}
const unknown = (reason: string): Evaluation => ({ value: "unknown", reasons: [reason] });
export function evaluateState(code: string, days: WorkDay[], settings: Settings, through: string, options: EvaluationOptions = {}): StateOutcome {
  const year = through.slice(0, 4);
  const start = settings.trackingStart > `${year}-01-01` ? settings.trackingStart : `${year}-01-01`;
  const selected = days.filter(d => d.date >= start && d.date <= through);
  const rule = getReviewedRule(code, through);
  const relevant = selected.filter(d => d.sessions.some(s => jurisdiction(s) === code));
  const usable = selected.filter(d => options.forecast || d.status !== "projected");
  const activity = aggregateActivity(usable, code, start, through, rule?.dayDefinition, !!options.forecast);
  const workDays = activity.workdays;
  const hours = activity.hours;
  const projectedDays = relevant.filter(d => d.status === "projected").reduce((n, d) => n + dayCount(d, code, rule?.dayDefinition), 0);
  const reasons: string[] = [];
  const wages = options.stateWages;
  const facts: Facts = { "calendar_year:workdays": workDays, "calendar_year:state_wages": wages };
  if (wages !== undefined && options.annualTotalWages && options.annualTotalWages > 0) facts["calendar_year:wage_percent"] = wages / options.annualTotalWages;
  let filing = rule ? evaluateExpression(rule.filing, facts) : unknown("No reviewed rule version for this jurisdiction and year.");
  let withholding = rule ? evaluateExpression(rule.withholding, facts) : unknown("No reviewed rule version for this jurisdiction and year.");
  const noTax = rule?.withholding.type === "none";
  if (!settings.regularWagesOnly) {
    filing = withholding = unknown("Special compensation or employee categories require review.");
  } else if (rule && !noTax) {
    if (!settings.residence || !settings.assignedWorkState) filing = withholding = unknown("Residence and assigned work state are required.");
    else if (settings.residence === code) filing = withholding = unknown("Resident treatment is outside this nonresident engine.");
    else if (rule.reciprocalResidents.includes(settings.residence)) {
      filing = { value: false, reasons: ["Reciprocity excludes regular employee compensation; other income and refund claims are not evaluated."] };
      withholding = unknown("Confirm the reciprocity certificate and resident-state withholding with payroll.");
    } else if (code === "IL" && !settings.ilMobileWorkerConfirmed) {
      filing = withholding = unknown("Confirm eligibility for Illinois's nonlocalized, nonincidental mobile-worker rule in Settings.");
    } else if (code === "NY") {
      if (settings.assignedWorkState === "NY") filing = withholding = unknown("NY-assigned office: convenience sourcing review is required, including days outside NY.");
      else if (workDays > 0 && (settings.nyExpectedDays ?? 0) > 14) withholding = { value: true, reasons: ["Expected NY workdays exceed 14: relief does not apply from the first NY workday."] };
      else if (settings.nyExpectedDays === undefined && workDays <= 14) withholding = unknown("Employer's expected annual NY workdays are missing.");
    } else if (code === "PA" && settings.assignedWorkState === "PA") filing = withholding = unknown("PA-assigned remote work requires sourcing review.");
    if (["CO", "GA"].includes(code) && filing.value === true && settings.federalReturnRequired !== "yes") filing = unknown("Confirm federal filing requirement or applicable state liability before concluding filing exposure.");
  }
  const coverage = coverageIssues(selected, start, through);
  // In forecast mode projected records are expected, but gaps and unconfirmed past data remain visible.
  if (coverage.length) {
    reasons.push(...coverage);
    if ((!options.forecast || coverage.some(r => r.includes("no record"))) && !noTax) {
      if (filing.value === false) filing = unknown("Incomplete activity could change the filing result.");
      if (withholding.value === false) withholding = unknown("Incomplete activity could change the withholding result.");
    }
  }
  if (settings.trackingStart > through) {
    reasons.push("Tracking begins after the evaluation date; employment history requires review.");
    filing = withholding = unknown("Tracking period does not include this date.");
  }
  if (rule?.localReview && hours > 0) reasons.push("Local tax treatment requires separate payroll review; municipality is recorded in the ledger.");
  if (settings.assignedWorkState && ["NY", "PA", "DE", "CT", "NJ"].includes(settings.assignedWorkState)) reasons.push("Assigned-office sourcing review may affect wages earned outside that state.");
  if (rule?.allocation === "annual_workdays" && wages !== undefined) reasons.push("Wages use provisional pay-period allocation; reconcile the annual workday formula.");
  if (!rule && getRule2026(code)) reasons.push("Only an unverified research baseline exists for this state/year.");
  const policy = getEmployerPolicyStatus(code, options.employer);
  const simpleDay = rule?.withholding.type === "condition" && rule.withholding.metric === "workdays" ? rule.withholding : undefined;
  const budget = simpleDay ? simpleDay.value - (simpleDay.comparison === "gte" ? 1 : 0) : undefined;
  const remaining = budget !== undefined && policy === "allowed" && withholding.value !== "unknown" ? Math.max(0, budget - workDays) : undefined;
  let status: StateOutcome["status"] = "clear";
  if (policy === "prohibited") status = "not_permitted";
  else if (policy === "approval_required") status = "approval_required";
  else if (filing.value === "unknown" || withholding.value === "unknown" || (!options.forecast && coverage.length) || (rule?.localReview && hours > 0) || reasons.some(r => r.includes("sourcing review"))) status = "review_required";
  else if (withholding.value === true) status = options.payrollActive ? "active" : "payroll_action";
  else if (filing.value === true || (budget !== undefined && workDays > Math.floor(budget * settings.margin))) status = "approaching";
  const labels: Record<StateOutcome["status"], string> = { not_permitted: "Work not permitted", approval_required: "Employer approval required", review_required: "Review required", payroll_action: "Payroll action", active: "Payroll treatment active", approaching: "Filing exposure / approaching", clear: "No modeled state income-tax action" };
  return { code, status, label: labels[status], level: status === "not_permitted" || status === "payroll_action" ? "triggered" : status === "clear" ? "clear" : "caution",
    filing, withholding, workDays, hours, projectedDays, wages, wageSource: options.forecast ? "estimated_salary" : wages === undefined ? "unknown" : "employee_entered",
    reasons: [...new Set(reasons)], rule, remaining,
    employeeAction: policy !== "allowed" ? "Do not work here without an employer policy change; report any past work accurately." : "Confirm work locations and non-work days; review applicable employee forms and filing facts.",
    payrollAction: withholding.value === true ? options.payrollActive ? "Continue state allocation; review corrections and reconciliation." : rule?.afterCrossing ?? "Review withholding treatment." : withholding.value === "unknown" ? "Resolve missing information and rule conditions before payroll use." : "Retain allocation and review any local obligations.",
  };
}
