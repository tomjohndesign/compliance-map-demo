# Employer expansion reference — reviewed September 23, 2026

## Scope and coverage

A general private employer hiring regular W-2 staff in the 50 US states. The
registration benchmark is a **standard foreign LLC**, meaning an LLC formed in
another state. It is not a corporation, domestic formation, series LLC, staffing
license or EOR price. DC and international jurisdictions remain outside this
employer directory. Existing employee geography and tax data retain DC.

All 50 entries contain government-reference foreign-LLC filing costs, unemployment
(UI) taxable wage bases and new-employer base rates (or an explicit industry-rate
requirement), plus general wage floors. See [50-state matrix](states.md).
Each fee includes its state source and exceptions. Costs are dated references,
not claims of complete business authority or a legal opinion.

## Primary references and dates

- [DOL unemployment provisions](https://oui.doleta.gov/unemploy/content/sigpros/2020-2029/January2026.pdf): January 1, 2026 snapshot, Taxes columns on pages 1–5. Footnote 4: new-employer rates are base rates; industry and other exceptions apply. Fiscal-year rate states must recheck their notice. No rate is invented for LA, MN, MT, NM, UT, WA or WY.
- [DOL wage table](https://www.dol.gov/agencies/whd/mw-consolidated): July 1, 2026 reference. General non-tipped rates, with regional/small-employer variations documented. Federal $7.25 floor used for FLSA-covered employment where state law is lower or absent. This is not a salary-exemption test or a local wage calculator.
- [Florida wage schedule](https://floridajobs.org/florida-minimum-wage): $14 through September 29, $15 from September 30, 2026. The UI labels the snapshot and upcoming change.
- [Alaska 2026 first-time filers](https://dol.alaska.gov/estax/forms/2026_First_Time_Filers.pdf) and [Wisconsin rates](https://dwd.wisconsin.gov/ui/employers/taxrates.htm) illustrate why published base UI rates differ from actual total rates. The estimator deliberately labels the base and allows an assigned-rate override.
- Foreign LLC fees: assertion-specific sources in `filingFees.ts` and the matrix. Publication/service/agent fees are excluded unless explicitly included in the row. Tennessee uses the minimum; actual fee depends on LLC members, not employees.
- [Louisiana Act 921](https://www.legis.la.gov/Legis/ViewDocument.aspx?d=1481829), pages 3 and 5: foreign LLC application increases from $150 to $185 October 1, 2026. Current snapshot retains $150 and displays the upcoming change.
- [SBA registration](https://www.sba.gov/business-guide/launch-your-business/register-your-business): qualification depends on activities, entity and jurisdiction; fees differ by business structure.
- [State labor offices](https://www.dol.gov/agencies/whd/state/contacts), [workers’ compensation offices](https://www.dol.gov/agencies/owcp/wc), [paid leave programs](https://www.dol.gov/agencies/wb/featured-paid-leave): review directories, not proof that a particular rule applies or is absent.

## Cost model and terms

- **Setup administration**: editable 12 hours × $75/hour = $900 default. Product planning assumption, identical across states; not an observed market rate.
- **Filing benchmark**: state-specific foreign-LLC application fee, unless the user supplies a total one-time fees override. Zero is an explicit override, useful when no qualification is required. It is not an all-in setup quote; certificates, publication, licenses, service charges and agent service may be additional.
- **Recurring administration**: editable 2 hours/month × 12 × $75/hour = $1,800/year. Assumed internal labor, not a state charge.
- **Base UI**: employee count × min(annual wages per employee, state wage base) × rate / 100; rounded to cents. Assumes equal wages, a full year, no prior taxable wages and UI localization to this state. Actual multi-state UI localization is not inferred from the employee travel map.
- **Annual overhead quote**: user-entered annual aggregate for insurance, paid family leave/disability, provider, registered agent, annual reports and UI assessments not included in the base. It is unknown until supplied, never represented as a verified zero.
- **Partial subtotal**: known/modelled components only. The UI always flags missing one-time confirmation, missing annual overhead and/or industry-specific UI rate. Monthly equivalents are annual budgets divided by 12, not filing frequencies.
- **Excluded**: salary, FICA, FUTA/credit reductions, benefits and replacement labor, business/franchise/sales taxes, industry licenses and other non-entered items. Income-tax withholding is employee tax remittance, not incremental employer tax expense.

## Rules and approval boundaries

The four setup reviews cover business authority, payroll/UI, insurance/benefits,
and employment policies. Required rules such as state/local sick leave, overtime,
final pay, notices, payroll schedules, workers’ compensation thresholds and
paid-family-leave premiums are **review tasks, not a comprehensive encoded legal
database**. Do not claim they have been researched in full for every state.
The existing nonresident income-tax engine remains primary-reviewed for eight
states only. All other baseline thresholds are prominently unverified. Employer
approval never upgrades those legal rule versions.

Supported = employer's recorded permission to work. In setup = approval required.
Not added = prohibited in employer policy. Initial 13 supported states are
fictional demo entries with no verified registrations. New approvals require all
four reviews and an evidence reference. Moving back to setup revokes permission.
No payment, government filing, payroll submission, actual legal sign-off or
registration verification occurs.

## Storage and maintenance

Employer data uses versioned localStorage (`sl-employer-v1`), validates state codes,
costs and record shapes, and synchronizes same-tab and cross-tab changes. A corrupt
record fails closed and reports a storage error. This is not authenticated access
control, a secure audit store, or shared organization persistence. Existing
employee evaluation, forecasts and report policy checks receive the same policy.

Update the dated datasets and matrix when sources change; there is no live rate
feed. Recheck all assigned tax rates, fee portals, effective dates, locations and
entity-specific obligations before activation. Never replace unknown rates with
zero or label a minimum fee an all-in price.
