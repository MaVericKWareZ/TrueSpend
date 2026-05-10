# Encryption at rest, not end-to-end

The PRS originally listed both "end-to-end encrypted sensitive data" (10.1) and a server-side insight engine producing aggregates like "Dining expenses increased 32%" (9.6). True E2E means only client devices hold keys, which precludes server-computed aggregates without homomorphic encryption or secure enclaves — neither viable for an MVP. We chose **encryption at rest + TLS in transit + role-based access** and dropped the E2E claim, because the product's core value is server-driven insights ("Insights Over Raw Data" — Principle 6.5) and the target personas have no threat model that requires E2E.

## Consequences

- The server has plaintext access to expense rows; privacy commitments must be enforced via policy, audit, and access control rather than cryptography.
- Household sharing is straightforward (no shared-key management, no rekeying when a member is removed).
- Insights, reports, and notification triggers all run server-side.
- If a future regulatory or product requirement mandates E2E, this is a major architectural reversal — not a config flip.
- Public privacy copy must be precise: "encrypted in transit and at rest, never sold, role-based access" — never "end-to-end encrypted."
