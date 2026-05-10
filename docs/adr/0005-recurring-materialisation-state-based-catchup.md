# Recurring expense materialisation: state-based catch-up

Recurring Schedules auto-materialise into real Expenses at midnight Household-local time. We chose a **state-based catch-up worker** rather than a time-precise cron-per-schedule:

- Every 5 minutes, the worker queries for active schedules whose `nextDue` ≤ now-in-Household-timezone and which lack an Expense for that occurrence, then materialises the missing ones.
- Idempotency via a unique compound index on `(scheduleId, occurrenceDate)` in the Expense collection. Double-runs surface as harmless duplicate-key errors.
- Past `nextDue` on schedule creation auto-advances forward — never retroactive materialisation.
- Runs as a `@nestjs/schedule` cron inside the existing NestJS backend, not a separate worker. A Mongo-based distributed lock serialises across replicas if scaled.

## Why state-based, not time-based

Time-precise crons (one per schedule, fired exactly at midnight) require either an external scheduler service or a much heavier in-process design, and they fail invisibly when the worker is down. State-based catch-up is self-healing — when the worker comes back after an outage, the next tick processes everything that was missed. No backfill mode, no replay logic.

## Consequences

- Up to 5 minutes of latency between midnight Household-local and the Expense becoming visible. Acceptable for a recurring expense the user expects to see "today."
- DST transitions are handled by the date library (luxon / date-fns-tz) using the Household's IANA timezone identifier. Ambiguous local times resolve to the first occurrence (standard library default).
- The lock means only one backend replica processes recurring at a time. Acceptable — recurring throughput is tiny.
