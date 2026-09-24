import { FILING_FEES } from "./filingFees.ts";
/** 2026 planning reference. Source dates are separate from retrieval dates. */
export const REVIEWED_ON = "2026-09-23";
export const SOURCES = {
  ui: { title: "U.S. DOL · January 2026 unemployment provisions", url: "https://oui.doleta.gov/unemploy/content/sigpros/2020-2029/January2026.pdf", effective: "2026-01-01" },
  wage: { title: "U.S. DOL · July 2026 minimum wage table", url: "https://www.dol.gov/agencies/whd/mw-consolidated", effective: "2026-07-01" },
  registration: { title: "SBA · Business registration and foreign qualification", url: "https://www.sba.gov/business-guide/launch-your-business/register-your-business", effective: "See state filing office" },
  labor: { title: "U.S. DOL · State labor offices", url: "https://www.dol.gov/agencies/whd/state/contacts", effective: "2026 directory" },
  leave: { title: "U.S. DOL · State paid leave programs", url: "https://www.dol.gov/agencies/wb/featured-paid-leave", effective: "Program-specific; confirm current rules" },
  compensation: { title: "U.S. DOL · State workers’ compensation offices", url: "https://www.dol.gov/agencies/owcp/wc", effective: "State-specific coverage" },
} as const;

export interface StateRequirement {
  code: string;
  uiWageBase: number;
  /** Percent, not fraction. Null means an industry-specific rate is required. */
  uiRate: number | null;
  wageFloor: number;
  page: number;
  note: string;
  wageNote: string;
}
// DOL January 2026, Taxes columns, pages 1–5. Rates are base rates only.
const ROWS: [string, number, number | null, number, number][] = [
  ["AL",8000,2.7,7.25,1], ["AK",54200,1,14,1], ["AZ",8000,2,15.15,1],
  ["AR",7000,1.8,11,1], ["CA",7000,3.4,16.9,1], ["CO",30600,1.53,15.16,1],
  ["CT",27000,1.9,16.94,1], ["DE",14500,1,15,1], ["FL",7000,2.7,14,2],
  ["GA",9500,2.64,7.25,2], ["HI",64500,2.4,16,2], ["ID",58300,1,7.25,2],
  ["IL",14250,2.8,15,2], ["IN",9500,2.5,7.25,2], ["IA",20400,1,7.25,2],
  ["KS",15100,1.75,7.25,2], ["KY",12000,2.7,7.25,2], ["LA",7000,null,7.25,2],
  ["ME",12000,2.23,15.1,2], ["MD",8500,2.6,15,2], ["MA",15000,2.42,15,2],
  ["MI",9000,2.7,13.73,3], ["MN",44000,null,11.41,3], ["MS",14000,1,7.25,3],
  ["MO",9000,2.376,15,3], ["MT",47300,null,10.85,3], ["NE",9000,1.25,15,3],
  ["NV",43700,2.95,12,3], ["NH",14000,2.7,7.25,3], ["NJ",44800,2.8,15.92,3],
  ["NM",34800,null,12,3], ["NY",17600,4.025,16,4], ["NC",34200,1,7.25,4],
  ["ND",46600,1,7.25,4], ["OH",9000,2.7,11,4], ["OK",25000,1.5,7.25,4],
  ["OR",56700,2.4,15.55,4], ["PA",10000,3.822,7.25,4], ["RI",30800,1,16,4],
  ["SC",14000,1,7.25,4], ["SD",15000,1.2,11.85,4], ["TN",7000,2.7,7.25,5],
  ["TX",9000,2.7,7.25,5], ["UT",50700,null,7.25,5], ["VT",15400,1,14.42,5],
  ["VA",8000,2.5,12.77,5], ["WA",78200,null,17.13,5], ["WV",9500,2.7,8.75,5],
  ["WI",14000,2.5,7.25,5], ["WY",33800,null,7.25,5],
];
const UI_NOTES: Record<string, string> = {
  AK: "DOL lists a 1% base rate. Alaska’s first-time filer notice adds 0.5% to reach 1.5%; other assigned rates can differ.",
  MI: "Delinquent employers have a $9,500 wage base instead of $9,000.",
  NE: "The high-tax group uses a $24,000 wage base instead of $9,000.",
  RI: "High-tax employers use a $32,300 wage base. The rate year starts July 1; confirm the current notice.",
  NH: "The rate year starts July 1; confirm the current notice and reductions.",
  NJ: "The rate year starts July 1; confirm the current notice and additional disability/family-leave charges.",
  TN: "The rate year starts July 1; confirm the current notice.",
  VT: "The rate year starts July 1; confirm the current notice.",
  WI: "The DOL base rate excludes the solvency component; payroll size changes the total assigned rate.",
};
const WAGE_NOTES: Record<string, string> = {
  AK: "$14 applies from July 1, 2026; $13 applied earlier in 2026.",
  AR: "State coverage generally starts at four employees; federal coverage is a separate test.",
  FL: "$14 through September 29, 2026; $15 from September 30, 2026.",
  MT: "A $4 exception exists for some very small businesses outside federal coverage.",
  NJ: "$15.23 for employers with fewer than six employees and seasonal employment; additional industry exceptions apply.",
  NY: "$17 in NYC, Long Island and Westchester; $16 elsewhere in the state.",
  OH: "$7.25 for employers below $405,000 annual gross receipts; otherwise $11.",
  OR: "$16.80 Portland metro; $15.55 standard; $14.55 nonurban counties, from July 1, 2026.",
  VT: "State coverage generally starts at two employees; federal coverage is a separate test.",
  WV: "State coverage generally starts at six employees at one location; federal coverage is a separate test.",
};
export const STATE_REQUIREMENTS: Record<string, StateRequirement> = Object.fromEntries(ROWS.map(([code, uiWageBase, uiRate, wageFloor, page]) => [code, {
  code, uiWageBase, uiRate, wageFloor, page,
  note: UI_NOTES[code] ?? (uiRate === null ? "The new-employer rate depends on industry. Enter the assigned rate to calculate UI." : "Base new-employer rate; industry exceptions, assessments and your assigned rate may differ."),
  wageNote: WAGE_NOTES[code] ?? (wageFloor === 7.25 ? "Federal floor for FLSA-covered employment; state coverage and exceptions must also be checked." : "General non-tipped rate. Local and industry rates, exemptions and coverage may differ."),
}]));
export const EMPLOYER_CODES = ROWS.map(r => r[0]);

export const SETUP_STEPS = [
  { id: "entity", title: "Entity & business authority", detail: "Resolve foreign qualification, registered agent, licenses, nexus, filing fees and annual reports for this entity.", source: "registration" },
  { id: "payroll", title: "Payroll & unemployment", detail: "Confirm withholding and UI accounts, assigned rates, localization, local taxes, remittance schedules and new-hire reporting.", source: "ui" },
  { id: "insurance", title: "Insurance & benefits", detail: "Confirm workers’ compensation coverage or exemption, disability / paid-family-leave contributions and benefits coverage.", source: "compensation" },
  { id: "people", title: "Employment policies", detail: "Review state and local wages, overtime, sick leave, breaks, pay frequency, final pay, notices and required training.", source: "labor" },
] as const;
export type SetupStep = typeof SETUP_STEPS[number]["id"];

export interface CostInputs {
  employees: number;
  salary: number;
  hourlyRate: number;
  setupHours: number;
  monthlyHours: number;
  filingFees: number | null;
  annualOther: number | null;
  assignedUiRate: number | null;
}
export const DEFAULT_COSTS: CostInputs = { employees: 1, salary: 100000, hourlyRate: 75, setupHours: 12, monthlyHours: 2, filingFees: null, annualOther: null, assignedUiRate: null };
export function estimateCosts(rule: StateRequirement, input: CostInputs) {
  const values = [input.employees, input.salary, input.hourlyRate, input.setupHours, input.monthlyHours];
  if (values.some(v => !Number.isFinite(v) || v < 0) || !Number.isInteger(input.employees) || input.employees < 1 || input.employees > 100000 || [input.filingFees, input.annualOther, input.assignedUiRate].some(v => v !== null && (!Number.isFinite(v) || v < 0)) || (input.assignedUiRate ?? 0) > 100) throw new Error("Invalid cost assumptions");
  const rate = input.assignedUiRate ?? rule.uiRate;
  const ui = rate === null ? null : Math.round(input.employees * Math.min(input.salary, rule.uiWageBase) * rate) / 100;
  const setupLabor = input.setupHours * input.hourlyRate;
  const annualLabor = input.monthlyHours * 12 * input.hourlyRate;
  return { ui, rate, setupLabor, annualLabor, filing: input.filingFees ?? FILING_FEES[rule.code].amount, setup: setupLabor + (input.filingFees ?? FILING_FEES[rule.code].amount), annual: annualLabor + (ui ?? 0) + (input.annualOther ?? 0), incomplete: ui === null || input.filingFees === null || input.annualOther === null };
}
