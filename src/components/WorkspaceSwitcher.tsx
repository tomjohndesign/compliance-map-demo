import Link from "next/link";
import styles from "./sidebar.module.css";

export function WorkspaceSwitcher({ active }: { active: "employee" | "employer" }) {
  return <nav className={styles.workspaceSwitch} aria-label="Workspace">
    <Link href="/" aria-current={active === "employee" ? "page" : undefined}>Employee</Link>
    <Link href="/employer" aria-current={active === "employer" ? "page" : undefined}>Employer</Link>
  </nav>;
}
