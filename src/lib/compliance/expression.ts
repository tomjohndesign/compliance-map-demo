export type Truth = true | false | "unknown";
export type Metric = "workdays" | "state_wages" | "wage_percent";
export type Period = "calendar_year" | "quarter" | "pay_period";
export type Expression =
  | { type: "none" }
  | { type: "unknown"; reason: string }
  | { type: "condition"; metric: Metric; period: Period; comparison: "gt" | "gte"; value: number }
  | { type: "and" | "or"; children: Expression[] };
export type Facts = Partial<Record<`${Period}:${Metric}`, number>>;
export interface Evaluation { value: Truth; reasons: string[] }
export function evaluateExpression(expression: Expression, facts: Facts): Evaluation {
  if (expression.type === "none") return { value: false, reasons: ["No state wage-income-tax requirement in this rule."] };
  if (expression.type === "unknown") return { value: "unknown", reasons: [expression.reason] };
  if (expression.type === "condition") {
    const actual = facts[`${expression.period}:${expression.metric}`];
    if (actual === undefined || !Number.isFinite(actual) || actual < 0) return { value: "unknown", reasons: [`Missing ${expression.period} ${expression.metric}.`] };
    const value = expression.comparison === "gt" ? actual > expression.value : actual >= expression.value;
    return { value, reasons: [`${expression.period} ${expression.metric}: ${Number(actual.toFixed(4))} ${expression.comparison === "gt" ? ">" : "≥"} ${expression.value} → ${value ? "met" : "not met"}`] };
  }
  const results = expression.children.map(child => evaluateExpression(child, facts));
  if (!results.length) return { value: "unknown", reasons: ["Empty rule expression."] };
  const values = results.map(r => r.value);
  const value = expression.type === "and"
    ? values.includes(false) ? false : values.includes("unknown") ? "unknown" : true
    : values.includes(true) ? true : values.includes("unknown") ? "unknown" : false;
  return { value, reasons: results.flatMap(r => r.reasons) };
}
export const condition = (metric: Metric, value: number, comparison: "gt" | "gte" = "gt", period: Period = "calendar_year"): Expression => ({ type: "condition", metric, value, comparison, period });
