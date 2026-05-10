# Expense Tracker

A collaborative household expense management product. Households are the unit of data ownership; users can belong to multiple households.

## Language

**User**:
A person with an account. Authenticates, belongs to one or more **Households**.
_Avoid_: Account (account is reserved for future financial-account concepts like bank accounts).

**Household**:
The data ownership boundary for expenses, categories, recurring schedules, and reports. A user collaborates inside one Household at a time (the *active* Household), but may switch.
_Avoid_: Workspace, Family, Group.

**Personal Household**:
A single-member Household auto-created at signup *only if the user opts in during onboarding*. Not the default — most users start by creating or joining a shared Household.

**Membership**:
The link between a **User** and a **Household**, carrying a **Role** and a `status` (`active` or `removed`). Removal is a soft delete — flipping `status` to `removed` — so historical references (Expense.recordedBy, audit log entries) remain valid and readable. Re-adding flips `status` back to `active`.

When a Member is removed:
- Their User Payment Methods become unselectable in this Household's pickers; historical Expenses keep their references.
- Recurring Schedules they created are auto-paused.
- Their User row and User Payment Methods remain owned by them — visible in any *other* Household they remain a Member of.

**Role**:
- **Owner**: full control, including deleting the Household and removing members. The Household creator is the Owner; ownership is **non-transferable** in v1. An Owner cannot leave their own Household — they delete it instead.
- **Member**: can add, edit, and delete *any* expense in the Household (shared hygiene), manage Household payment methods, categories, and recurring schedules.
- **Viewer**: read-only. (Deferred post-MVP.)

**Expense**:
A single recorded spend within a Household. Atomic — not splittable across members in v1. Carries `recorded_by` (who entered it), `paid_by` (whose money left, defaults to `recorded_by`), one Category, and a **Justification Flag**. Optionally references one **Payment Method**.
_Avoid_: Transaction (reserved for future bank-feed concepts), Spend.

**Category**:
A Household-scoped grouping for Expenses (e.g., Groceries, Rent). Carries a name, color/icon, and a default **Justification Flag**. On Household creation, the system clones a starter set of 11 default Categories into the new Household; thereafter the Household owns them fully — rename, recolor, add, or soft-delete. Soft-deleting a Category hides it from pickers but preserves historical Expense references.

**Tag**:
A free-text label on an Expense; an Expense can carry many. Stored as a string array on the Expense, with autocomplete suggestions drawn from prior Tags used in the same Household. Tags carry no config (no color, no default flag).

**Justification Flag**:
A per-Expense label — `Justified`, `Unjustified`, or `Neutral` — used by the insights layer to compute discretionary-spending metrics. Any Member or Owner of the Household can change it (shared hygiene, consistent with cross-member expense editing). Default resolution order on new Expense:
1. If created from a **Recurring Schedule** with a prior occurrence, inherit the prior occurrence's current flag.
2. Otherwise, inherit the **Category**'s default flag.
3. If neither set, `Neutral`.

**Payment Method**:
A label for how an expense was paid (card, cash float, UPI account, etc.). Two scopes:
- **Household Payment Method** — owned by a Household, visible and selectable to all members of that Household.
- **User Payment Method** — owned by a User; visible and selectable to all members of any Household that user is in (rationale: members of shared households commonly use each other's cards). Labels always display with the owner's name (e.g., "Alice's Visa").

**Recurring Schedule**:
A definition of a repeating Expense (frequency, next due date, amount, category, payment method, default justification flag, optional tags). The system *auto-materialises* a real Expense at midnight Household-local time on each due date. Members can edit or delete the auto-created Expense after the fact, "Skip this occurrence" to cancel a single materialisation, or "Pause" the schedule to halt all future ones. The first occurrence materialises on the next due date — never retroactively at schedule-creation time.

**Household Timezone**:
A timezone set on each Household, defaulting to **Asia/Kolkata (IST)** and explicitly editable at creation. Anchors recurring-schedule materialisation, monthly report boundaries, and "today" semantics. A user travelling does not change their Household's timezone.

**Household Currency**:
A single ISO 4217 currency code per Household, set at creation and **immutable**. Defaults to **INR**. Every Expense in the Household is denominated in this currency; multi-currency support is deferred post-MVP. To change currency, a user creates a new Household.

**Invite Link**:
A reusable, non-expiring URL generated by an Owner that lets any signed-in (or freshly signing-up) **User** claim **Membership** of the **Household**. New members default to the **Member** role. The link is regenerable; regenerating invalidates the previous one.

## Relationships

- A **User** has 0..N **Memberships**; each **Membership** points to one **Household**.
- A **Household** has exactly one **Owner** **Membership** (non-transferable in v1) and 0..N other Memberships.
- All Expense, Category, Tag, Recurring Schedule, and Household Payment Method records belong to exactly one **Household**.
- A **User Payment Method** belongs to a **User**; it is selectable inside any Household that User is an active **Member** of.
- An **Expense** is owned by the Household it was recorded in; `paid_by` defaults to `recorded_by` but is editable.
- A **Recurring Schedule** belongs to a Household; the worker materialises it into Expenses at midnight in the Household's timezone.

## Onboarding flows

**Cold signup (Household Manager persona)**:
1. Sign up via email + password or Google.
2. If a pending invite exists for this email, surface it first ("Alice invited you to *Mahapatra Family*. Accept?").
3. Otherwise: choose between *Create a shared Household* or *Just track my own* (auto-creates a Personal Household behind the scenes).
4. If creating a shared Household: name, currency (default INR, immutable), timezone (default IST, editable).
5. Optional invite step (skippable).
6. Drop into the empty-state dashboard with Quick Add prominent. First expense is an empty-state CTA, not a gate.

**Invite-link claim (Casual Contributor persona)**:
1. Land on the invite URL → sign in (or sign up).
2. Confirm joining the named Household.
3. Drop into the Household dashboard with Quick Add prominent.

## Example dialogue

> **Dev:** "When Alice records groceries paid on Bob's card, who's the **paid_by**?"
> **Domain expert:** "Bob — `paid_by` is whose money left, regardless of who entered it. Alice is `recorded_by`."

> **Dev:** "Bob's card is a **User Payment Method**. If Carol joins the **Household** later, can she pick Bob's card on her own expenses?"
> **Domain expert:** "Yes — User Payment Methods are visible to anyone in any Household the owner is in. We assume members of a shared Household sometimes use each other's cards."

> **Dev:** "Alice flags last month's rent as Unjustified — does this month's rent inherit that?"
> **Domain expert:** "Yes — a **Recurring Schedule**'s next occurrence inherits the prior occurrence's current **Justification Flag**. If Alice changes her mind on this month's, next month follows."

> **Dev:** "What if Alice leaves the **Household**?"
> **Domain expert:** "Soft-remove — her **Membership** flips to `removed`. Historical Expenses keep her as `recorded_by`. Her Recurring Schedules in this Household pause automatically. She keeps her User Payment Methods; they just stop appearing in this Household's pickers."

## Flagged ambiguities

- "household" and "workspace" were used interchangeably in the spec — resolved: **Household** is canonical.
- "account" was avoided — reserved for future bank-account concepts; we use **User** for the person.
- **Invite-link permanence**: chosen non-expiring + regenerable for MVP simplicity; a leaked link permits unauthorised joins until regenerated. Acceptable v1 trade-off; revisit if abuse appears.
- **Owner non-transferability**: chosen for v1 simplicity. Bus-factor risk is real (only the Owner can delete the Household); revisit when the user base supports it.
