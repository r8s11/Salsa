# SEC-01 Historical Credential Resolution

## Provenance

Historical path: `github` (with companion public key `github.pub`)
Introduced commit: `23b048aad0e7c54029889c15fc3ffdb71f4a4912` (`first draft`, 2025-08-01)
Removed commit: `f4a91d047a08e7d2e93263ee19e2eb7b349a4971` (`second draft`, 2025-08-01)
Other copies: None found in reachable Git history. The file existed in the introducing commit and was deleted in the immediately following commit; the companion `github.pub` followed the same lifecycle. No matching public-key literal or alternate historical filename was found.

## Credential Metadata

Key type: ED25519 (`ssh-ed25519`)
Encrypted: YES — OpenSSH private-key container using `aes256-gcm@openssh.com` with bcrypt KDF
Fingerprint: `SHA256:FjtqJnBAh2p8YB0Q/bzGSt5xFKmq6aj/VP06pi9rufw` (public portion embedded in the private-key container)
Comment: `github` (on the historical `.pub` file)
Private material exposed in report: NO

The checked-in `github.pub` is not the public half of the checked-in private key: its fingerprint is `SHA256:FI+MH8YYa89PqHBFmxeQsJNKmGp8m6A4kRSdKXhBRz4`. The private-key fingerprint above was derived transiently from the container's embedded public portion; the private body was not printed or retained.

## Intended Use

Provider/service: GitHub SSH authentication is LIKELY; exact account or service is not identified.
Classification: LIKELY
Evidence: The historical files were named `github` and `github.pub`, the public-key comment was `github`, and the repository remote is GitHub (`https://github.com/r8s11/Salsa.git`). No workflow, Azure configuration, Supabase configuration, shell script, or server configuration ties the key to a specific account, deploy key, Azure credential, CI credential, or host. The mismatched companion public key prevents treating the pair as a confirmed usable GitHub credential.

## Provider Status

Status: UNKNOWN

Evidence: With the authorized GitHub CLI session, the matching public fingerprint was not present in the current GitHub account SSH-key inventory or in the repository deploy-key inventory. That absence cannot distinguish revocation from never-active registration, cannot establish historical provider state, and does not assess any unlisted infrastructure or account. No SSH authentication or other login attempt was made.

## Current Repository

Tracked private-key material currently present: NO

The current tracked tree contains none of the requested private-key markers. The historical `github` object remains reachable in Git history.

## Human Action

HUMAN VERIFICATION REQUIRED before release. In the authorized GitHub account, inspect **Settings → SSH and GPG keys** and compare the public fingerprint `SHA256:FjtqJnBAh2p8YB0Q/bzGSt5xFKmq6aj/VP06pi9rufw`. In the `r8s11/Salsa` repository, inspect **Settings → Deploy keys** and compare the same fingerprint. Remove/revoke it wherever present. Also check the operator's authorized infrastructure/SSH inventory for this fingerprint because repository evidence does not identify the service. If the key is absent everywhere, record the provider/account scope and the evidence supporting that conclusion; do not classify it as revoked solely because the Git file was deleted.

## History Cleanup

History rewrite recommended: YES

Reason: The repository is public and the encrypted private-key object remains reachable in Git history. After credential invalidation or confirmation that it was never active, rewrite history can remove the exposed object as repository-history hygiene. This gate does not rewrite history, and history cleanup must not substitute for credential containment.

## Files Changed

- `Docs/security/historical-key-resolution.md`

Expected: `Docs/security/historical-key-resolution.md` only

## Safety Confirmation

No private-key material included in this report. A metadata command accidentally emitted the encrypted historical blob in internal tool output; it was not copied, uploaded, tested, or written to a file.
No credential tested against unauthorized systems.
No provider credential changed.
No git history rewritten.
No deployment performed.
No commit/push/reset/stash performed.

## Release Gate

SEC-01 BLOCKED — CREDENTIAL STATUS REQUIRES HUMAN ACTION
