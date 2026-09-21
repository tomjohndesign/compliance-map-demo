/**
 * Research import from the State Lines handoff, sections 13–18 (2026 baseline).
 * Not a production evaluator or verified statement of current law. This module
 * deliberately has no dependency on employer policy, map metadata, or demo rules.
 * All entries remain baseline until assertion-level primary review is recorded.
 */
export type RuleKind =
  | "none"
  | "day"
  | "wage"
  | "wage_percent"
  | "day_and_wage"
  | "day_or_wage_or_percent"
  | "special";

export interface Threshold2026 {
  kind: RuleKind;
  display: string;
  days?: number;
  wages?: number;
  /** Fraction of wages: 0.05 means 5%. Denominator needs primary review. */
  wagePercent?: number;
  /** True = strictly greater than; false = inclusive. Applies to every numeric leg. */
  greaterThan?: boolean;
}

export type ResearchStatus = "baseline" | "primary_reviewed" | "legal_reviewed";

export interface MobileWorkerStateRule2026 {
  code: string;
  state: string;
  filing: Threshold2026;
  withholding: Threshold2026;
  mutualityRequired?: boolean;
  /** Research flags only; absence does not establish that an issue cannot apply. */
  localTaxResearchRequired?: boolean;
  convenienceReviewRequired?: boolean;
  reciprocityReviewRequired?: boolean;
  notes?: string;
  effectiveAsOf: "2026-01-01";
  researchStatus: ResearchStatus;
}

/** Attribution supplied by the handoff, not an independent source verification. */
export const RULES_2026_PROVENANCE = {
  importedFrom: "State Lines project handoff, sections 13–18",
  compilation: {
    publisher: "Tax Foundation",
    title: "Nonresident Income Tax Filing and Withholding Laws by State, 2026",
    url: "https://taxfoundation.org/data/all/state/nonresident-income-tax-filing/",
  },
  effectiveAsOf: "2026-01-01",
  scope: "Nonresident regular W-2 wage filing and state income-tax withholding",
  primarySourceReviewComplete: false,
} as const;

const none = (): Threshold2026 => ({
  kind: "none",
  display: "No state individual wage-income tax",
});

const day = (days: number, greaterThan = false): Threshold2026 => ({
  kind: "day",
  days,
  greaterThan,
  display: greaterThan
    ? `More than ${days} work days`
    : `${days} work day${days === 1 ? "" : "s"}`,
});

const wage = (wages: number, greaterThan = false): Threshold2026 => ({
  kind: "wage",
  wages,
  greaterThan,
  display: `${greaterThan ? "More than " : ""}$${wages.toLocaleString("en-US")} of wages`,
});

const dayAndWage = (days: number, wages: number): Threshold2026 => ({
  kind: "day_and_wage",
  days,
  wages,
  greaterThan: true,
  display: `More than ${days} work days AND more than $${wages.toLocaleString("en-US")} of wages`,
});

/** Conditions missing from this import shape are not zero-valued conditions. */
const georgia = (days?: number): Threshold2026 => ({
  kind: "day_or_wage_or_percent",
  ...(days === undefined ? {} : { days }),
  wages: 5_000,
  wagePercent: 0.05,
  greaterThan: true,
  display: `${days === undefined ? "" : `More than ${days} work days OR `}more than $5,000 of wages OR more than 5% of wages`,
});

/** Preserve unsupported metrics/periods in text; do not evaluate as annual wages. */
const special = (display: string): Threshold2026 => ({ kind: "special", display });

type RuleDetails = Pick<MobileWorkerStateRule2026,
  "notes" | "mutualityRequired" | "localTaxResearchRequired" |
  "convenienceReviewRequired" | "reciprocityReviewRequired"
>;

const rule = (
  code: string,
  state: string,
  filing: Threshold2026,
  withholding: Threshold2026,
  details: RuleDetails = {},
): MobileWorkerStateRule2026 => ({
  code,
  state,
  filing,
  withholding,
  ...details,
  effectiveAsOf: "2026-01-01",
  researchStatus: "baseline",
});

/**
 * 50 states plus DC. "First workday" is baseline shorthand, not a complete
 * personal filing determination. Day definitions, exceptions, sourcing and
 * treatment after crossing a threshold still require primary review.
 * Never treat a missing entry or a `special` threshold as `none`.
 */
export const MOBILE_WORKER_RULES_2026: Readonly<Partial<Record<string, MobileWorkerStateRule2026>>> = {
  AL: rule("AL", "Alabama", day(30, true), day(30, true), {
    mutualityRequired: true,
    localTaxResearchRequired: true,
    notes: "Safe harbor depends on mutuality. After crossing, Alabama wages for the year may become subject to withholding; review retroactive treatment.",
  }),
  AK: rule("AK", "Alaska", none(), none()),
  AZ: rule("AZ", "Arizona", day(1), day(60, true), {
    notes: "Filing and withholding differ. Verify the withholding rule's definition of days.",
  }),
  AR: rule("AR", "Arkansas", day(1), day(1)),
  CA: rule("CA", "California", day(1), wage(1_500, true), {
    notes: "Physical services can create California-source wages. Filing and withholding thresholds differ.",
  }),
  CO: rule("CO", "Colorado", day(1), day(1), {
    localTaxResearchRequired: true,
    notes: "Review pay-period work-location allocation when services are performed inside and outside Colorado.",
  }),
  CT: rule("CT", "Connecticut", dayAndWage(15, 6_000), day(15, true), {
    convenienceReviewRequired: true,
    notes: "Convenience-of-employer sourcing may apply in specified cases.",
  }),
  DE: rule("DE", "Delaware", day(1), day(1), {
    convenienceReviewRequired: true,
    localTaxResearchRequired: true,
    notes: "Convenience-of-employer sourcing can affect wages beyond physical presence.",
  }),
  FL: rule("FL", "Florida", none(), none()),
  GA: rule("GA", "Georgia", georgia(), georgia(23), {
    notes: "Track state workdays, state-source wages and percentage of total wages; verify the percentage denominator and measurement period.",
  }),
  HI: rule("HI", "Hawaii", day(1), day(60, true), {
    notes: "Filing and withholding differ. Verify the withholding rule's definition of days.",
  }),
  ID: rule("ID", "Idaho", wage(2_500, true), wage(1_000), {
    notes: "Withholding can begin before the filing threshold.",
  }),
  IL: rule("IL", "Illinois", day(30, true), day(30, true), {
    notes: "Track exact workdays. Review IL-W-6 / IL-W-6-WS work-date and physical-location reporting.",
  }),
  IN: rule("IN", "Indiana", day(30, true), day(30, true), {
    localTaxResearchRequired: true,
  }),
  IA: rule("IA", "Iowa", wage(1_000), day(1), {
    localTaxResearchRequired: true,
  }),
  KS: rule("KS", "Kansas", day(1), day(1)),
  KY: rule("KY", "Kentucky", day(1), day(1), {
    reciprocityReviewRequired: true,
    notes: "Residence in a reciprocal state can change treatment.",
  }),
  LA: rule("LA", "Louisiana", day(30, true), day(30, true), {
    notes: "Handoff reports a 2026 30-day threshold and repeal of prior mutuality. Crossing may affect all Louisiana workdays for the year; verify current treatment.",
  }),
  ME: rule("ME", "Maine", dayAndWage(12, 3_000), dayAndWage(12, 3_000)),
  MD: rule("MD", "Maryland", day(1), day(1), {
    reciprocityReviewRequired: true,
    localTaxResearchRequired: true,
    notes: "Reciprocity can alter withholding; local taxes also require review.",
  }),
  MA: rule("MA", "Massachusetts", day(1), day(1), {
    notes: "Services physically performed in Massachusetts generally create state-source wages.",
  }),
  MI: rule("MI", "Michigan", day(1), day(1), {
    reciprocityReviewRequired: true,
    localTaxResearchRequired: true,
    notes: "Review reciprocity and city income taxes.",
  }),
  MN: rule("MN", "Minnesota",
    special("$15,300 Minnesota-source income (2026 baseline)"),
    special("$15,300 all-source income (2026 baseline)"), {
      notes: "Inflation-adjusted amounts. Filing and withholding use different income concepts; do not substitute state wages for all-source income.",
    }),
  MS: rule("MS", "Mississippi", day(1), day(1)),
  MO: rule("MO", "Missouri", wage(600), day(1), {
    localTaxResearchRequired: true,
    notes: "Local earnings taxes may apply in certain cities.",
  }),
  MT: rule("MT", "Montana", day(30, true), day(30, true)),
  NE: rule("NE", "Nebraska", day(1), day(1), {
    notes: "Special conference/training relief may apply around 7 days or fewer and no more than $5,000, subject to conditions not modeled here.",
  }),
  NV: rule("NV", "Nevada", none(), none()),
  NH: rule("NH", "New Hampshire", none(), none()),
  NJ: rule("NJ", "New Jersey", day(1), day(1), {
    convenienceReviewRequired: true,
    localTaxResearchRequired: true,
    notes: "Convenience sourcing can matter in specified circumstances.",
  }),
  NM: rule("NM", "New Mexico", day(1), day(15, true)),
  NY: rule("NY", "New York", day(1), day(14, true), {
    convenienceReviewRequired: true,
    localTaxResearchRequired: true,
    notes: "14-day withholding policy is conditional and administrative, including expected workdays. Review assigned office, convenience sourcing, allocation and IT-2104.1; this is not a universal 14-day exemption.",
  }),
  NC: rule("NC", "North Carolina", day(1), day(1), {
    notes: "Services physically performed in North Carolina generally create state-source wages.",
  }),
  ND: rule("ND", "North Dakota", day(20, true), day(20, true), {
    mutualityRequired: true,
    notes: "Safe harbor depends on the employee's residence satisfying mutuality.",
  }),
  OH: rule("OH", "Ohio", day(1), special("$300 per calendar quarter"), {
    localTaxResearchRequired: true,
    notes: "Quarterly withholding metric must not use YTD wages. Municipal income taxes require separate review.",
  }),
  OK: rule("OK", "Oklahoma", wage(1_000), special("More than $300 per calendar quarter"), {
    notes: "Quarterly withholding metric must not use YTD wages.",
  }),
  OR: rule("OR", "Oregon", special("More than $2,910 for a 2026 single filer; depends on filing status"), day(1), {
    localTaxResearchRequired: true,
    notes: "Filing threshold is inflation-adjusted and filing-status-dependent. Do not apply the single-filer amount universally.",
  }),
  PA: rule("PA", "Pennsylvania", day(1), day(1), {
    reciprocityReviewRequired: true,
    localTaxResearchRequired: true,
    notes: "Review reciprocity, EIT, LST, PSD codes and work-location/residence certification. State-only location can be insufficient.",
  }),
  RI: rule("RI", "Rhode Island", day(1), day(1)),
  SC: rule("SC", "South Carolina", day(1), wage(2_000, true)),
  SD: rule("SD", "South Dakota", none(), none()),
  TN: rule("TN", "Tennessee", none(), none()),
  TX: rule("TX", "Texas", none(), none()),
  UT: rule("UT", "Utah", day(20, true), day(20, true), {
    mutualityRequired: true,
    notes: "Safe harbor depends on the employee's residence satisfying mutuality.",
  }),
  VT: rule("VT", "Vermont", wage(100, true), day(30), {
    notes: "Baseline withholding comparison is inclusive (30 workdays); filing and withholding differ substantially.",
  }),
  VA: rule("VA", "Virginia", day(1), day(1), {
    reciprocityReviewRequired: true,
    notes: "Residence in a reciprocal jurisdiction can alter withholding.",
  }),
  WA: rule("WA", "Washington", none(), none(), {
    notes: "Other employer/payroll programs exist outside this state wage-income-tax dataset.",
  }),
  WV: rule("WV", "West Virginia", day(30, true), day(30, true), {
    mutualityRequired: true,
    reciprocityReviewRequired: true,
    localTaxResearchRequired: true,
    notes: "Review mutuality for the safe harbor separately from reciprocity.",
  }),
  WI: rule("WI", "Wisconsin", wage(2_000), wage(2_000)),
  WY: rule("WY", "Wyoming", none(), none()),
  DC: rule("DC", "District of Columbia",
    special("No filing for nonresident wage income"),
    special("No withholding for nonresident wage income"), {
      notes: "Separate nonresident compensation exception under federal law; do not classify DC as having no individual income tax.",
    }),
};

/** Unknown/international jurisdictions stay unknown, rather than becoming `none`. */
export function getRule2026(code: string): MobileWorkerStateRule2026 | undefined {
  return Object.hasOwn(MOBILE_WORKER_RULES_2026, code)
    ? MOBILE_WORKER_RULES_2026[code]
    : undefined;
}
