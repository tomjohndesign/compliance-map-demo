import type { StateInfo } from "./types";

type MapMeta = Pick<StateInfo, "name" | "row" | "col" | "country">;

/** Public map labels and positions. The rule data is generated separately. */
const MAP: Record<string, MapMeta> = {
  AL: { name: "Alabama", row: 6, col: 7 },
  AK: { name: "Alaska", row: 7, col: 2 },
  AZ: { name: "Arizona", row: 5, col: 2 },
  AR: { name: "Arkansas", row: 5, col: 5 },
  CA: { name: "California", row: 4, col: 1 },
  CO: { name: "Colorado", row: 4, col: 3 },
  CT: { name: "Connecticut", row: 3, col: 10 },
  DE: { name: "Delaware", row: 4, col: 10 },
  FL: { name: "Florida", row: 7, col: 9 },
  GA: { name: "Georgia", row: 6, col: 8 },
  HI: { name: "Hawaii", row: 7, col: 1 },
  ID: { name: "Idaho", row: 2, col: 2 },
  IL: { name: "Illinois", row: 2, col: 6 },
  IN: { name: "Indiana", row: 3, col: 6 },
  IA: { name: "Iowa", row: 3, col: 5 },
  KS: { name: "Kansas", row: 5, col: 4 },
  KY: { name: "Kentucky", row: 4, col: 6 },
  LA: { name: "Louisiana", row: 6, col: 5 },
  ME: { name: "Maine", row: 1, col: 11 },
  MD: { name: "Maryland", row: 4, col: 9 },
  MA: { name: "Massachusetts", row: 2, col: 10 },
  MI: { name: "Michigan", row: 2, col: 7 },
  MN: { name: "Minnesota", row: 2, col: 5 },
  MS: { name: "Mississippi", row: 6, col: 6 },
  MO: { name: "Missouri", row: 4, col: 5 },
  MT: { name: "Montana", row: 2, col: 3 },
  NE: { name: "Nebraska", row: 4, col: 4 },
  NV: { name: "Nevada", row: 3, col: 2 },
  NH: { name: "New Hampshire", row: 1, col: 10 },
  NJ: { name: "New Jersey", row: 3, col: 9 },
  NM: { name: "New Mexico", row: 5, col: 3 },
  NY: { name: "New York", row: 2, col: 9 },
  NC: { name: "North Carolina", row: 5, col: 7 },
  ND: { name: "North Dakota", row: 2, col: 4 },
  OH: { name: "Ohio", row: 3, col: 7 },
  OK: { name: "Oklahoma", row: 6, col: 4 },
  OR: { name: "Oregon", row: 3, col: 1 },
  PA: { name: "Pennsylvania", row: 3, col: 8 },
  RI: { name: "Rhode Island", row: 3, col: 11 },
  SC: { name: "South Carolina", row: 5, col: 8 },
  SD: { name: "South Dakota", row: 3, col: 4 },
  TN: { name: "Tennessee", row: 5, col: 6 },
  TX: { name: "Texas", row: 7, col: 4 },
  UT: { name: "Utah", row: 4, col: 2 },
  VT: { name: "Vermont", row: 1, col: 9 },
  VA: { name: "Virginia", row: 4, col: 8 },
  WA: { name: "Washington", row: 2, col: 1 },
  WV: { name: "West Virginia", row: 4, col: 7 },
  WI: { name: "Wisconsin", row: 1, col: 6 },
  WY: { name: "Wyoming", row: 3, col: 3 },
  DC: { name: "District of Columbia", row: 5, col: 9 },
  BC: { name: "British Columbia · CAN", row: 0, col: 1, country: "CA" },
  AB: { name: "Alberta · CAN", row: 0, col: 2, country: "CA" },
};

/** Geography only. Policy and tax rules live in independent modules. */
export const STATES: Record<string, StateInfo> = MAP;

export const STATE_CODES = Object.keys(STATES);

/** Rows 0-7 of the tile map, each row listing codes in column order. */
export const GRID_ROWS: string[][] = (() => {
  const rows: string[][] = Array.from({ length: 8 }, () => []);
  for (const code of STATE_CODES) rows[STATES[code].row].push(code);
  for (const row of rows) row.sort((a, b) => STATES[a].col - STATES[b].col);
  return rows;
})();

export const GRID_COLS = 11;
