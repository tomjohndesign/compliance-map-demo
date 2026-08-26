export type Mode = "past" | "future";

export type RiskLevel = "clear" | "caution" | "triggered";

/** A logged stay. `trip` stays are short overlays on top of a `ground` stay
 *  (for example, a work trip during a longer home stay) and win day attribution. */
export interface Stay {
  id: string;
  state: string;
  location: string;
  /** ISO date, inclusive */
  start: string;
  /** ISO date, inclusive */
  end: string;
  kind: "ground" | "trip";
  note?: string;
  booked?: boolean;
}

/** A future stop. Dates are derived by chaining from the route start. */
export interface PlannedStop {
  id: string;
  state: string;
  location: string;
  lengthDays: number;
}

export type ThemePref = "system" | "light" | "dark";

export interface Settings {
  salary: number;
  /** fraction of each illustrative threshold treated as the personal ceiling */
  margin: number;
  residence: "PA" | "FL";
  /** ISO date the future route chains from */
  routeStart: string;
  theme: ThemePref;
}

/** Illustrative threshold rule used by the demo data:
 *  d = day count (d: 1 means "from day 1"), usd = wage amount,
 *  and/any = compound rules. Null = no demo trigger. */
export interface Rule {
  d?: number;
  usd?: number;
  and?: { d: number; usd: number };
  any?: { d: number; usd: number };
}

export interface StateInfo {
  name: string;
  /** geofacet us_state_grid1 position (row 1-7, col 1-11); Canada on row 0 */
  row: number;
  col: number;
  /** personal nonresident filing trigger */
  filing: Rule | null;
  /** employer withholding trigger */
  withholding: Rule | null;
  /** display strings for the illustrative demo rules */
  filingText: string;
  withholdingText: string;
  /** fictional employer registration status used only for the demo */
  employerRegistered: boolean;
  flag?: string;
  /** nonresident return name, when known */
  nrForm?: string;
  /** rough effective NR rate used for liability estimates */
  estRate?: number;
  country?: "US" | "CA";
}
