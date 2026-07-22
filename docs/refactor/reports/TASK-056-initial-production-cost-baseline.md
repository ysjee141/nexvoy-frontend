# TASK-056 Initial Production Cost Baseline

## Decision

The authority architecture is appropriate for Initial Production: normalized rows are canonical,
clients send entity commands, Realtime carries invalidations, and assets bypass database/RPC payloads.
At the approved 1,000 MAU model, expected traffic is well below Supabase Pro allowances. This is a
capacity model, not a substitute for seven days of DEV measurements.

## Initial Workload Model

| Input | Assumption |
|---|---:|
| Monthly active users | 1,000 |
| Domain mutations | 20/user/month = 20,000 |
| Active recipients per invalidation | 3 average |
| Full bundle refresh | 5/user/month |
| Representative bundle | 200 KB |
| Stored place photos | 10/user, 500 KB combined original/thumb average |

Automated protocol tests enforce a representative command at no more than 2 KiB and an invalidation
at no more than 1 KiB. The resulting upper estimates are about 40 MB command ingress, 60 MB Realtime
delivery, 1 GB full-bundle egress, and 5 GB Storage. Photo viewing remains the dominant variable and
must be read from cached/uncached egress reports rather than inferred from database traffic.

## Plan Fit

As of 2026-07-23, Supabase Pro starts at $25/month and includes 100,000 MAU, 8 GB database disk,
250 GB uncached egress, 250 GB cached egress, 100 GB file storage, 5 million Realtime messages, and
500 peak Realtime connections. Overages and plan details can change, so operators must confirm the
[official pricing page](https://supabase.com/pricing) before release. Egress is unified across
Database, Auth, Storage, Functions, and Realtime; cached and uncached egress have separate quotas
([egress documentation](https://supabase.com/docs/guides/platform/manage-your-usage/egress)).

The model is below 10% of the main storage/egress quotas and far below MAU/message quotas. No custom
sync gateway, permanent delta log, paid Log Drain, or read replica is justified at Initial scale.

## Cost Controls

- Keep 1-second/32-command batching and operation-id idempotency.
- Keep invalidations metadata-only; never include bundle, memo, title, or asset bytes.
- Use `_w240` thumbnails in lists and immutable CDN paths; inspect cache-hit egress separately.
- Alert at 70% forecast usage. Keep the Pro spend cap enabled until an approved capacity change.
- Use GA4/Firebase aggregate client events plus Supabase Usage/Realtime reports. Realtime reports
  expose connections, events, payload size, errors, and lag
  ([Realtime Reports](https://supabase.com/docs/guides/realtime/reports)).
- Export DB and Storage separately. Managed database backups do not contain Storage object bytes.

## Growth Triggers

Re-evaluate architecture or plan when any condition holds for two consecutive billing periods:

- DB, Storage, egress, messages, or peak connections exceed 70% of quota.
- Full-bundle fallback exceeds 5% of received invalidations or produces > 25 GB/month egress.
- RPC p95 exceeds 2 seconds after query/index tuning.
- A typical trip exceeds 2 MB or 500 active entities, making fallback bundles expensive.
- Collaborator fanout or mutation rate is more than five times the Initial model.

At Growth, first add targeted change retention and query/index tuning. Consider a sync gateway or
specialized collaboration transport only after measured traffic shows that managed Supabase paths are
the limiting cost or reliability factor.
