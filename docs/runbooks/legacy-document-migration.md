# Legacy Document Migration Runbook

TASK-042 provides a manual migration path for legacy Supabase row data. It is not part of the Closed Beta product flow and must not run automatically.

## When To Use

- Use only after the new document-primary flow is stable.
- Use for selected legacy trips or templates owned by the signed-in user.
- Do not use it as a silent compatibility layer for product screens.

## Tool

Open the web app with a signed-in owner account, then visit:

```text
/dev/legacy-migration
```

The tool runs in the browser because it must use the current Web device key material to create a usable encrypted snapshot and `document_keys` entry.

## Procedure

1. Click `Scan` to list row-only legacy trips/templates.
2. Select one item.
3. Click `Dry Run` and inspect entity counts and validation messages.
4. Click `Migrate Selected`.
5. Confirm the result shows `status=migrated` and `restore=restored`.

Already migrated documents are shown as `already migrated` and are not overwritten.

## Rollback

Legacy rows are not deleted. If a migration must be rolled back, remove generated rows for the document id from:

- `document_updates`
- `document_keys`
- `document_members`
- `documents`

Then clear the same document id from local IndexedDB for the testing browser profile.

## Notes

- Public/default templates are not migrated by this tool; only current-user owned templates are candidates.
- Warnings in dry-run reports do not block migration unless marked as `error`.
- A failed migration should leave the original legacy rows unchanged.
