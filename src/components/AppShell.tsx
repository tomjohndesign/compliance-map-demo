import type { ReactNode } from "react";
import styles from "./shell.module.css";

export function AppShell({ left, right, children }: { left: ReactNode; right: ReactNode; children: ReactNode }) {
  return <div className={styles.shell}>{left}<div className={styles.center}>{children}</div>{right}</div>;
}
