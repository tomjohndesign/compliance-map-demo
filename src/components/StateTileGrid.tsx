import type { ReactNode } from "react";
import { GRID_ROWS, STATES } from "@/lib/states";
import styles from "./map.module.css";

/** Shared geography and tile spacing for both app modes. */
export function StateTileGrid({ codes, renderTile, children }: { codes?: string[]; renderTile: (code: string) => ReactNode; children?: ReactNode }) {
  const rows = codes ? GRID_ROWS.map(row => row.filter(code => codes.includes(code))).filter(row => row.length) : GRID_ROWS;
  return <div className={styles.grid}>
    {rows.map((row, index) => <div key={index} className={styles.row}>
      {row.map((code, i) => {
        const previousColumn = i ? STATES[row[i - 1]].col : 0;
        const margin = (STATES[code].col - previousColumn - 1) * 62;
        return <div key={code} className={styles.cell} style={{ marginLeft: margin || undefined }}>{renderTile(code)}</div>;
      })}
    </div>)}
    {children}
  </div>;
}
