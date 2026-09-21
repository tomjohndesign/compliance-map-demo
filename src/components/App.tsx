"use client";

import { AppProvider, useApp } from "@/lib/store";
import { SidebarLeft } from "./SidebarLeft";
import { SidebarRight } from "./SidebarRight";
import { TileMap } from "./TileMap";
import { LedgerView } from "./LedgerView";
import { ReportView } from "./ReportView";
import styles from "./shell.module.css";

function Shell() {
  const { mode, pastView } = useApp();
  const showReport = mode === "past" && pastView === "report";
  return (
    <div className={styles.shell}>
      <SidebarLeft />
      <div className={styles.center}>{showReport ? <ReportView /> : mode === "past" && pastView === "ledger" ? <LedgerView /> : <TileMap />}</div>
      <SidebarRight />
    </div>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
