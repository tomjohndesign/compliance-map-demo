import { HYPOTHETICAL_EMPLOYER, type EmployerPolicy } from "./demoEmployer.ts";
import { DEFAULT_COSTS, EMPLOYER_CODES, SETUP_STEPS, estimateCosts, STATE_REQUIREMENTS, type CostInputs, type SetupStep } from "./stateRequirements.ts";
export const EMPLOYER_KEY = "sl-employer-v1";
export interface StatePlan { status: "planning" | "supported"; checks: SetupStep[]; evidence: string; updatedAt: string; costs: CostInputs }
export type EmployerWorkspace = Partial<Record<string, StatePlan>>;
export const INITIAL_WORKSPACE: EmployerWorkspace = Object.fromEntries(Object.keys(HYPOTHETICAL_EMPLOYER.supportedStates).map(code => [code, { status: "supported", checks: [], evidence: "Fictional demo approval; registrations not verified.", updatedAt: "2026-09-23", costs: { ...DEFAULT_COSTS } }]));
export function parseWorkspace(raw: string): EmployerWorkspace {
  const value: unknown = JSON.parse(raw);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Invalid employer data");
  const result: EmployerWorkspace = {};
  for (const [code, entry] of Object.entries(value)) {
    if (!EMPLOYER_CODES.includes(code) || !entry || typeof entry !== "object") throw new Error("Invalid state record");
    const p = entry as StatePlan;
    if (!["planning", "supported"].includes(p.status) || !Array.isArray(p.checks) || !p.checks.every(c => SETUP_STEPS.some(s => s.id === c)) || typeof p.evidence !== "string" || typeof p.updatedAt !== "string" || !p.costs) throw new Error("Invalid state plan");
    estimateCosts(STATE_REQUIREMENTS[code], p.costs);
    result[code] = p;
  }
  return result;
}
export function policyFromWorkspace(workspace: EmployerWorkspace): EmployerPolicy {
  return { name: HYPOTHETICAL_EMPLOYER.name, supportedStates: Object.fromEntries(Object.entries(workspace).map(([code, plan]) => [code, plan?.status === "supported" ? "allowed" : "approval_required"])) };
}
export function canActivate(plan: StatePlan) { return SETUP_STEPS.every(s => plan.checks.includes(s.id)) && plan.evidence.trim().length >= 10; }
