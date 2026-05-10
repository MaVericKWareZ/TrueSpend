# Password hashing: argon2id with OWASP-2024 parameters

The `users` collection introduced in issue 02 stores password hashes for the Credentials provider. We chose **argon2id** (via the `argon2` Node package) over bcrypt with parameters `memoryCost: 19456` (19 MiB), `timeCost: 2`, `parallelism: 1` — the OWASP 2024 baseline and IETF RFC 9106 recommendation for new systems.

## Why argon2id over bcrypt

- **Memory-hardness.** argon2id forces the cracker to allocate ~19 MiB per guess; bcrypt is purely CPU-bound. GPU-based attacks are economically much harder against argon2id at equivalent perceived strength.
- **Standardisation.** OWASP's 2024 password-storage cheat sheet and IETF RFC 9106 both recommend argon2id as the default for new systems; bcrypt is listed as acceptable for legacy / constrained environments only.
- **No 72-byte input cap.** bcrypt silently truncates inputs past 72 bytes — a real footgun. Pre-hashing with SHA-256 to dodge it has its own subtle issues (null-byte inclusion, double-hash reasoning). argon2id has no such cap.
- **Mature Node binding.** The `argon2` package ships prebuilt binaries for Linux, macOS, and Windows on Node 20; install is reliable.

## Parameters and rationale

| Param | Value | Source |
|---|---|---|
| `type` | `argon2id` | OWASP — hybrid resistance to side-channel and GPU attacks |
| `memoryCost` | 19456 (19 MiB) | OWASP 2024 baseline for argon2id |
| `timeCost` | 2 | OWASP 2024 baseline; ~25–50 ms per hash on Fly.io free-tier shared CPU |
| `parallelism` | 1 | OWASP 2024 baseline; matches single-threaded Node workers |

These parameters target ~100 ms hash time on moderate hardware. On Fly.io's shared-CPU free tier the time will be higher; that's acceptable on signup / sign-in (single hash per request) and rate-limits prevent a hash-flood DoS.

## Consequences

- **Migration cost is real.** Changing parameters or algorithms later requires rehashing on next sign-in (read the encoded params from the stored hash, compare to current target, rehash if mismatched). The implementation should anticipate this — store the full encoded `$argon2id$v=19$m=…,t=…,p=…$…$…` string so parameter introspection is trivial.
- **A native module is now in the dependency tree.** Build environments without a C toolchain depend on the prebuilt binary working; if Node is upgraded to a major version not yet covered, builds break. Pin Node 20 in `engines` (already done at the root).
- **Parameter tuning is host-specific.** OWASP defaults are conservative; if signup latency becomes an issue, the right move is to lower `memoryCost` rather than fall back to bcrypt. Document the reasoning in the migration note when it happens.
- **Pepper / HMAC-with-secret is not used.** A server-side pepper would force key management we don't otherwise need at MVP scale. argon2id with a per-row salt is sufficient against the threats we face (DB leak, offline cracking).
- Public copy may state "passwords are hashed using argon2id" if needed; never claim "encrypted" — encryption is reversible, hashing is not.
