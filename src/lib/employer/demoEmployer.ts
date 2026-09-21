/** Employer decisions are independent of jurisdiction tax rules. */
export type EmployerPolicyStatus = "allowed" | "approval_required" | "prohibited";

export interface EmployerPolicy {
  name: string;
  /** US state codes only. An absent jurisdiction is prohibited. */
  supportedStates: Readonly<Partial<Record<string, EmployerPolicyStatus>>>;
}

/** Fictional allowlist, not a claim about registrations or state tax complexity. */
export const HYPOTHETICAL_EMPLOYER: EmployerPolicy = {
  name: "Example Remote Co.",
  supportedStates: {
    CA: "allowed",
    CO: "allowed",
    FL: "allowed",
    GA: "allowed",
    IL: "allowed",
    MA: "allowed",
    NC: "allowed",
    NY: "allowed",
    PA: "allowed",
    TN: "allowed",
    TX: "allowed",
    VA: "allowed",
    WA: "allowed",
  },
};

/** Exact US codes are expected; unknown and international codes fail closed. */
export function getEmployerPolicyStatus(
  state: string,
  employer: EmployerPolicy = HYPOTHETICAL_EMPLOYER,
): EmployerPolicyStatus {
  return Object.hasOwn(employer.supportedStates, state)
    ? employer.supportedStates[state] ?? "prohibited"
    : "prohibited";
}
