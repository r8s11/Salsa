# Task 1 report

## Test-first sequence

1. Created `supabase/functions/_shared/invitation.test.ts` before creating the implementation file. The tests cover email normalization and invalid boundaries, optional display-name normalization and bounds, the exact local/production invite redirect allowlist, rejected redirect variants, and the request contract excluding a supplied role.
2. Ran the required focused command before implementation:

```text
$ deno test --allow-env supabase/functions/_shared/invitation.test.ts
error: command not found: deno

Wall time: 0.00 seconds
Process exited with code 127
```

3. Created `supabase/functions/_shared/invitation.ts` with dependency-free deterministic helpers and the requested contract types.
4. Re-ran the required focused command after implementation; the runtime blocker remained unchanged:

```text
$ deno test --allow-env supabase/functions/_shared/invitation.test.ts
error: command not found: deno

Wall time: 0.00 seconds
Process exited with code 127
```

No repository-configured Edge Function test command exists in `package.json`, so no weaker substitute was run.

## Commit

```text
6b1700a feat(auth): add invitation validation contracts
```

## Required command outputs

```text
$ git status --short

$ git log -1 --oneline
6b1700a feat(auth): add invitation validation contracts

$ test -f supabase/functions/_shared/invitation.ts
$ test -f supabase/functions/_shared/invitation.test.ts
file checks: passed

## Review-fix report

Added test-first coverage for a valid normalized 254-character email, a 100-character display name, and malformed domains (`a@b..com`, `a@.example.com`, and `a@example..com`). The focused command was run before and after the validator change:

```text
$ deno test --allow-env supabase/functions/_shared/invitation.test.ts
error: command not found: deno
```

Deno is unavailable in this environment, and no weaker substitute was run.

Commit:

```text
c8a28e2 fix(auth): tighten invitation email validation
```
```
