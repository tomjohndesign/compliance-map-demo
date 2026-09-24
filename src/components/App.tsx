"use client";

import { AppProvider, useApp } from "@/lib/store";
import { SidebarLeft } from "./SidebarLeft";
import { SidebarRight } from "./SidebarRight";
import { TileMap } from "./TileMap";
import { LedgerView } from "./LedgerView";
import { ReportView } from "./ReportView";
import { AppShell } from "./AppShell";

function Shell() {
  const { mode, pastView } = useApp();
  const showReport = mode === "past" && pastView === "report";
  return (
    <AppShell left={<SidebarLeft />} right={<SidebarRight />}>
      {showReport ? <ReportView /> : mode === "past" && pastView === "ledger" ? <LedgerView /> : <TileMap />}
    </AppShell>
  );
}

export function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
