import { condition, type Expression } from "./expression.ts";

export interface Authority {
  id: string;
  agency: string;
  title: string;
  url: string;
  supports: ("filing" | "withholding" | "allocation" | "forms" | "reciprocity" | "sourcing" | "local_tax")[];
  lastVerified: string;
  authorityType: "agency-guidance" | "statute";
}
export interface ReviewedRule {
  code: string;
  version: string;
  effectiveFrom: string;
  effectiveTo: string;
  researchStatus: "primary_reviewed";
  filing: Expression;
  withholding: Expression;
  filingSummary: string;
  withholdingSummary: string;
  dayDefinition: "any" | "majority";
  allocation: "pay_period_workdays" | "annual_workdays" | "none";
  allocationSummary: string;
  afterCrossing: string;
  forms: string[];
  localReview: boolean;
  reciprocalResidents: string[];
  openQuestions: string[];
  sources: Authority[];
}
const source = (id: string, agency: string, title: string, url: string, supports: Authority["supports"], authorityType: Authority["authorityType"] = "agency-guidance"): Authority => ({
  id, agency, title, url, supports, authorityType, lastVerified: "2026-09-21",
});
const first = condition("workdays", 1, "gte");
const noTax: Expression = { type: "none" };
const incomeOr: Expression = { type: "or", children: [condition("state_wages", 5000), condition("wage_percent", 0.05)] };
const make = (code: string, data: Omit<ReviewedRule, "code" | "version" | "effectiveFrom" | "effectiveTo" | "researchStatus">): ReviewedRule => ({
  code, version: `US-${code}-2026-v1`, effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31", researchStatus: "primary_reviewed", ...data,
});
/** Primary-source review of the stated assertions, not legal approval or a complete tax-return engine. */
export const REVIEWED_RULES: Record<string, ReviewedRule> = {
  CA: make("CA", {
    filing: first, withholding: first, dayDefinition: "any", allocation: "annual_workdays",
    filingSummary: "Physical work creates filing exposure; personal income, age and filing-status tests still apply.",
    withholdingSummary: "California wages enter PIT withholding treatment; no general $1,500 employee safe harbor is modeled.",
    allocationSummary: "California workdays / total workdays. Pay-period values are provisional pending annual reconciliation.",
    afterCrossing: "Review California wages from the first workday and employee withholding allowances; no flat tax rate is calculated.",
    forms: ["DE 4 — employee withholding allowances", "540NR — potential nonresident return"], localReview: false, reciprocalResidents: [],
    openQuestions: ["Final 2026 filing tables and personal filing facts must be checked before determining a return is required.", "Split-day allocation requires payroll review."],
    sources: [
      source("ca-wages", "California EDD", "Employer's Guide — nonresident wages", "https://edd.ca.gov/siteassets/files/pdf_pub_ctr/de44.pdf", ["withholding", "allocation", "forms"]),
      source("ca-source", "California FTB", "Part-year resident and nonresident", "https://www.ftb.ca.gov/file/personal/residency-status/part-year-and-nonresident.html", ["filing", "sourcing", "allocation"]),
      source("ca-file", "California FTB", "540NR filing tests (2025 reference; 2026 tables pending)", "https://www.ftb.ca.gov/forms/2025/2025-540nr-booklet.html", ["filing"]),
    ],
  }),
  CO: make("CO", {
    filing: first, withholding: first, dayDefinition: "majority", allocation: "pay_period_workdays",
    filingSummary: "Colorado-source income plus a federal filing requirement or Colorado tax liability.",
    withholdingSummary: "Wages for Colorado services enter withholding treatment.",
    allocationSummary: "Pay-period workday ratio; Colorado counts a day when the majority of services occur there.",
    afterCrossing: "Apply Colorado work-location allocation to the pay period.",
    forms: ["Review W-4 / optional Colorado DR 0004 with payroll"], localReview: true, reciprocalResidents: [],
    openQuestions: ["Travel to Colorado has special day-count treatment; travel-service sessions require review.", "Local occupational taxes are not calculated."],
    sources: [
      source("co-withholding", "Colorado DOR", "Wage Withholding Tax Guide — January 2026", "https://tax.colorado.gov/sites/tax/files/documents/Wage_Withholding_Tax_Guide_Jan_2026.pdf", ["withholding", "allocation", "forms"]),
      source("co-filing", "Colorado DOR", "Individual Income Tax Guide", "https://tax.colorado.gov/sites/tax/files/documents/Individual_Income_Tax_Guide_Mar_2024.pdf", ["filing"]),
    ],
  }),
  GA: make("GA", {
    filing: incomeOr,
    withholding: { type: "or", children: [incomeOr, { type: "unknown", reason: "The handoff's 23-day withholding leg is not corroborated by the reviewed 2026 guide; review needed below the wage tests." }] },
    dayDefinition: "any", allocation: "annual_workdays",
    filingSummary: "Wage-only nonresident: more than $5,000 or 5% of annual income, with a federal filing requirement.",
    withholdingSummary: "More than $5,000 or 5% of wages; the baseline's separate 23-day leg remains unresolved.",
    allocationSummary: "Georgia workdays / total annual workdays; period allocations need annual reconciliation.",
    afterCrossing: "Review all Georgia-source compensation and any earlier payroll corrections; retroactive timing is unresolved.",
    forms: ["G-4 — employee withholding", "Form 500 — potential nonresident return"], localReview: false, reciprocalResidents: [],
    openQuestions: ["23-day leg and catch-up withholding timing require further authority.", "The 5% denominator requires full-year income, not a YTD fraction; other income is out of scope."],
    sources: [
      source("ga-filing", "Georgia DOR", "Residents and nonresidents FAQ", "https://dor.georgia.gov/filing-residents-nonresidents-and-part-year-residents-faq", ["filing", "allocation"]),
      source("ga-withholding", "Georgia DOR", "2026 Employer's Tax Guide — June update", "https://dor.georgia.gov/document/document-document/2026-employers-tax-guide-updated-june-2026/download", ["withholding"]),
      source("ga-forms", "Georgia DOR", "Withholding tax for employers", "https://dor.georgia.gov/taxes/withholding-tax-employers", ["forms"]),
    ],
  }),
  IL: make("IL", {
    filing: condition("workdays", 30), withholding: condition("workdays", 30), dayDefinition: "majority", allocation: "annual_workdays",
    filingSummary: "More than 30 qualifying workdays creates wage filing exposure; final liability/exemptions still need review.",
    withholdingSummary: "More than 30 significant, nonincidental workdays for qualifying mobile employees.",
    allocationSummary: "Illinois qualifying workdays / total annual workdays, including earlier days after crossing.",
    afterCrossing: "Review the full year's Illinois wage allocation, including earlier workdays, and catch-up withholding.",
    forms: ["IL-W-4", "IL-W-6 / IL-W-6-WS when employer records do not satisfy requirements", "IL-W-5-NR for reciprocity"], localReview: false,
    reciprocalResidents: ["IA", "KY", "MI", "WI"],
    openQuestions: ["Employer must confirm compensation is not localized elsewhere and Illinois services qualify for the mobile-worker rule.", "Travel-only service days need review."],
    sources: [
      source("il-withholding", "Illinois DOR", "Publication 130 — employee withholding", "https://tax.illinois.gov/research/publications/pubs/who-is-required-to-withhold-illinois-income-tax/withholding-illinois-income-tax-for-my-employees.html", ["withholding", "allocation", "forms", "reciprocity", "sourcing"]),
      source("il-filing", "Illinois DOR", "Individual filing requirements", "https://tax.illinois.gov/individuals/filingrequirements.html", ["filing", "reciprocity"]),
    ],
  }),
  NY: make("NY", {
    filing: first, withholding: condition("workdays", 14), dayDefinition: "any", allocation: "annual_workdays",
    filingSummary: "New York-source income creates exposure; NY adjusted gross income and standard deduction determine filing.",
    withholdingSummary: "14-day administrative relief is conditional; expecting more than 14 days can require withholding from the first day.",
    allocationSummary: "Annual workday allocation subject to assigned-office and convenience sourcing review.",
    afterCrossing: "Review withholding on all New York wages for the year, including earlier days.",
    forms: ["IT-2104.1 — nonresidence and allocation", "IT-203 — potential nonresident return"], localReview: true, reciprocalResidents: [],
    openQuestions: ["NY-assigned offices require convenience-of-employer analysis.", "Training and special occupations are outside this prototype.", "Yonkers/local obligations and final filing tests require review."],
    sources: [
      source("ny-14", "New York DTF", "TSB-M-12(5)I — conditional 14-day withholding policy", "https://www.tax.ny.gov/pdf/memos/income/m12_5i.pdf", ["withholding"]),
      source("ny-convenience", "New York DTF", "TSB-M-06(5)I — convenience of the employer", "https://www.tax.ny.gov/pdf/memos/income/m06_5i.pdf", ["sourcing", "allocation"]),
      source("ny-filing", "New York DTF", "Filing information for nonresidents", "https://www.tax.ny.gov/pit/file/nonresidents.htm", ["filing"]),
      source("ny-forms", "New York DTF", "NYS-50 employer guide", "https://www.tax.ny.gov/pdf/publications/withholding/nys50_1223.pdf", ["forms", "allocation"]),
    ],
  }),
  PA: make("PA", {
    filing: condition("state_wages", 33), withholding: first, dayDefinition: "any", allocation: "pay_period_workdays",
    filingSummary: "More than $33 of PA taxable income under the regular-wages-only scope; reciprocity can exempt compensation.",
    withholdingSummary: "PA service wages enter withholding unless reciprocal-state requirements are satisfied.",
    allocationSummary: "Workday allocation for nonresident salary with adequate records; assigned-office sourcing and localities require review.",
    afterCrossing: "Apply PA wage allocation and review local EIT/LST and residency certification.",
    forms: ["REV-419 — reciprocal-state nonwithholding certificate where applicable", "Residency Certification Form / PSD codes", "PA-40 — potential return"], localReview: true,
    reciprocalResidents: ["IN", "MD", "NJ", "OH", "VA", "WV"],
    openQuestions: ["PA-assigned remote work can require sourcing review.", "Local EIT/LST calculations and temporary-worksite rules remain outside the engine."],
    sources: [
      source("pa-withholding", "Pennsylvania DOR", "Income subject to withholding", "https://www.pa.gov/agencies/revenue/forms-and-publications/pa-personal-income-tax-guide/income-subject-withholding-estimated-payments-penalties-interest-other-additions", ["withholding", "allocation", "reciprocity", "forms"]),
      source("pa-filing", "Pennsylvania DOR", "PA-40 filing requirements", "https://revenue-pa.custhelp.com/app/answers/detail/a_id/281/~/who-must-file-a-personal-income-tax-return%253F", ["filing"]),
      source("pa-source", "Pennsylvania DOR", "Gross compensation", "https://www.pa.gov/agencies/revenue/forms-and-publications/pa-personal-income-tax-guide/gross-compensation", ["sourcing", "reciprocity"]),
      source("pa-local", "Pennsylvania DCED", "Local withholding FAQs", "https://dced.pa.gov/local-government/local-income-tax-information/local-withholding-tax-faqs/", ["local_tax", "forms"]),
    ],
  }),
  TN: make("TN", {
    filing: noTax, withholding: noTax, dayDefinition: "any", allocation: "none",
    filingSummary: "No state individual wage-income tax.", withholdingSummary: "No state wage-income-tax withholding.",
    allocationSummary: "Retain work-location allocation for payroll records.", afterCrossing: "No wage-income-tax trigger.", forms: [], localReview: false, reciprocalResidents: [], openQuestions: [],
    sources: [source("tn-no-tax", "Tennessee DOR", "HIT-18 — income not subject to individual tax", "https://revenue.support.tn.gov/hc/en-us/articles/360057371832-HIT-18-Pension-Income-Social-Security-401-k-and-IRA-Distributions", ["filing", "withholding"])],
  }),
  TX: make("TX", {
    filing: noTax, withholding: noTax, dayDefinition: "any", allocation: "none",
    filingSummary: "No state individual wage-income tax.", withholdingSummary: "No state wage-income-tax withholding.",
    allocationSummary: "Retain work-location allocation for payroll records.", afterCrossing: "No wage-income-tax trigger.", forms: [], localReview: false, reciprocalResidents: [], openQuestions: [],
    sources: [source("tx-no-tax", "Texas Legislature", "Texas Constitution Article VIII, section 24-a", "https://statutes.capitol.texas.gov/docs/cn/pdf/cn.8.pdf", ["filing", "withholding"], "statute")],
  }),
};
export function getReviewedRule(code: string, date: string): ReviewedRule | undefined {
  const rule = Object.hasOwn(REVIEWED_RULES, code) ? REVIEWED_RULES[code] : undefined;
  return rule && date >= rule.effectiveFrom && date <= rule.effectiveTo ? rule : undefined;
}
