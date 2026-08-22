# school-bloom-v2 — School Portal Sandbox

**Sandbox for:** School-Bloom (school.edubloom.com.ng)
**Sandbox-first rule:** All fixes proved here before production gets them.
**Last updated:** 2026-08-20

---

## Current Versions

| File | Version |
|------|---------|
| app.js | `?v=20260820-health-compliance` |
| sw.js CACHE_NAME | `edubloom-school-bloom-v2-20260820-health-compliance` |

---

## Session History

### 2026-08-20 — Health Data Compliance Module (Sandbox Build)

Built the full health compliance module in this sandbox per three requirements:

**Requirement 1 — Encryption at rest and in transit:**
- In transit: TLS/HTTPS already enforced by GitHub Pages + Firebase (always on)
- At rest (application-level): AES-256-GCM field encryption via Web Crypto API
- Key: PBKDF2 from school password + schoolId, 100,000 iterations, SHA-256
- Key lives in `_healthKey` (memory only) — clears on tab close, never persisted
- Each PHI field encrypted with a unique 12-byte random IV
- Fields encrypted: studentName, incidentType, action, notes
- Fields NOT encrypted: status, date (needed for sorting/filtering)
- Database-level: Firebase encrypts all Firestore data at rest with AES-256 (always on)

**Requirement 2 — Access control + audit logging:**
- RBAC: Principal-only gate in `renderHealth()` — all other roles blocked + logged
- Two-factor: must be Principal AND must unlock vault with school password
- Audit entries written to `admin_activity` (Bayo-only Firestore) + localStorage ring buffer
- Events logged: VAULT_UNLOCK, VIEW_HEALTH_LIST, LOG_INCIDENT, DELETE_INCIDENT,
  VIEW_DENIED_RBAC, VIEW_BLOCKED_VAULT_LOCKED
- Audit entries never contain plaintext PHI — metadata only

**Requirement 3 — BAA/DPA with third parties:**
- Groq and HuggingFace OCR are code-blocked from health data (`logIncident()` never calls OCR)
- Firebase/Firestore: DPA available — Bayo must sign (see HEALTH_DATA_COMPLIANCE.md)
- Full requirements documented in: HEALTH_DATA_COMPLIANCE.md

**Files changed this session:**
- index.html — health section + vault unlock modal + nav button
- app.js — health compliance module appended (~220 lines)
- HEALTH_DATA_COMPLIANCE.md — created (BAA/DPA guide + pending actions for Bayo)
- sw.js — CACHE_NAME bumped

---

### 2026-08-20 — Cache-bust + security backport

Cache-buster `?v=20260820-security` added (was missing entirely).
sw.js CACHE_NAME versioned (was static `school-bloom-v2-cache-v1`).

---

## Health Compliance — What Needs Bayo's Action Before Port to Production

See HEALTH_DATA_COMPLIANCE.md for full details. Key items:
1. Sign Google Cloud DPA/BAA at cloud.google.com/terms/health
2. Register as Data Processor with NDPC (ndpc.gov.ng)
3. Add health data clause to school subscription agreement
4. Explicit go-ahead to port this module to production School-Bloom

---

## Standing Rules

- Sandbox-first: prove all features here before Bayo approves production port
- After every push, update this README in the same push
- _isPremium() hardcoded true — TEMP BYPASS, do not relock without explicit go-ahead
- No Base44 anywhere
- node --check not used as gate (pre-existing browser-only patterns in this file)
