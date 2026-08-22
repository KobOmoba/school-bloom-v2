# EduBloom Health Data Compliance Guide
AariNAT Company Limited | Last updated: 2026-08-20

---

## Legal Framework

**Primary law:** Nigeria Data Protection Act 2023 (NDPA 2023)
**Regulator:** Nigeria Data Protection Commission (NDPC) — ndpc.gov.ng
**Lawful basis:** Contract (school management services)
**Classification:** Health data = Sensitive Personal Data under NDPA 2023 Section 30
**Data Controller:** AariNAT Company Limited, RC-1732521

---

## Requirement 1 — Encryption At Rest and In Transit

### In Transit ✅ DONE
All EduBloom apps run on HTTPS only:
- GitHub Pages enforces TLS 1.2+ for all domains
- Firebase/Firestore enforces TLS for all SDK and REST connections
- No plaintext HTTP path exists in any app

### At Rest — Application-Level (Field Encryption) ✅ DONE (school-bloom-v2, 2026-08-20)
PHI fields encrypted before leaving the browser using Web Crypto API (built into all modern browsers — zero external dependencies, zero key exposure to third parties).

**Algorithm:** AES-256-GCM
**Key derivation:** PBKDF2(password + schoolId, 100,000 iterations, SHA-256, 16-byte salt)
**Unique IV:** Generated per field per write (crypto.getRandomValues, 12 bytes)
**Key storage:** Memory only (_healthKey variable) — clears when tab closes, never written to disk or Firestore

**Encrypted fields per health record:**
- studentName_enc — student's full name
- type_enc — incident type (e.g. "Epileptic Seizure")
- action_enc — medical action taken
- notes_enc — clinical notes (most sensitive)

**Not encrypted (needed for filtering/sorting):**
- status ("open" / "closed")
- date (ISO string)

### At Rest — Database Level ✅ ALREADY DONE BY FIREBASE
Google Firebase/Firestore encrypts all stored data with AES-256 at the database level. This is automatic and always on. Application-level encryption above adds a second layer so that even Firebase cannot read the plaintext PHI.

---

## Requirement 2 — Access Control and Audit Logging

### Access Control ✅ DONE (school-bloom-v2, 2026-08-20)

| Role | Health Tab | Health Records |
|------|-----------|----------------|
| Principal | ✅ Access (vault unlock required) | Read + Write + Delete |
| Bursar | ❌ Blocked at RBAC gate | None |
| Class Teacher | ❌ Blocked at RBAC gate | None |
| Subject Teacher | ❌ Blocked at RBAC gate | None |

Two-factor access model:
1. Must be logged in as Principal (RBAC)
2. Must unlock Health Vault with school password (derives decryption key)

### Audit Logging ✅ DONE (school-bloom-v2, 2026-08-20)

Every health data interaction writes an audit entry containing:
- schoolId
- action (VAULT_UNLOCK / VIEW_HEALTH_LIST / LOG_INCIDENT / DELETE_INCIDENT / VIEW_DENIED_RBAC / VIEW_BLOCKED_VAULT_LOCKED)
- performedBy.name + performedBy.role
- timestamp (ISO 8601)
- metadata (record count, studentId, incidentType — never plaintext PHI content)

**Written to:**
1. `admin_activity` Firestore collection (Bayo-only read — permanent audit trail)
2. `localStorage['p_health_audit']` (last 200 entries — offline access)

---

## Requirement 3 — Business Associate Agreements (BAA) / Data Processing Agreements (DPA)

### Under NDPA 2023
NDPA 2023 Section 43 requires a written Data Processing Agreement (DPA) between
the Data Controller (AariNAT) and every Data Processor that handles personal data.
Health data triggers enhanced obligations (Sensitive Personal Data — Section 30).

### Third-Party Services — Status

#### 1. Google Firebase / Cloud Firestore
**Role:** Primary data processor — stores all health records (encrypted ciphertext)
**DPA available:** YES — Google Cloud Data Processing Addendum (DPA) is available
**BAA for HIPAA:** YES — available via Google Cloud Console (requires Blaze plan)

**ACTION REQUIRED (Bayo):**
1. Upgrade Firebase project to Blaze plan (pay-as-you-go) if not already done
2. Go to: https://cloud.google.com/terms/health/hipaa
3. Sign the Google Cloud BAA / DPA
4. Download and store the signed agreement

Note: Even though EduBloom operates under NDPA (not HIPAA), signing the Google Cloud
DPA satisfies the NDPA Section 43 processor agreement requirement and demonstrates
a higher standard of care for sensitive data.

---

#### 2. Groq (Groq Vision — OCR)
**Role:** Processes images via OCR API for student register import
**Health data exposure:** BLOCKED BY CODE — health records use manual text entry only.
The `logIncident()` function never calls Groq. OCR functions are only available in
the student import flow, which has no health data.
**DPA available:** Groq does not currently offer a public HIPAA BAA or NDPA DPA.
**Status:** ✅ Isolated — health data never reaches Groq

---

#### 3. HuggingFace Inference API
**Role:** OCR fallback (Qwen2.5-VL-7B-Instruct)
**Health data exposure:** BLOCKED BY CODE — same isolation as Groq above
**DPA available:** HuggingFace offers a GDPR DPA but no specific HIPAA BAA
**Status:** ✅ Isolated — health data never reaches HuggingFace

---

#### 4. OCR.space
**Role:** Last-resort OCR fallback
**Health data exposure:** BLOCKED BY CODE — same isolation as above
**DPA available:** Check https://ocr.space/privacy before using for any PHI
**Status:** ✅ Isolated — health data never reaches OCR.space

---

#### 5. GitHub Pages
**Role:** Serves the static PWA files (HTML, JS, CSS)
**Health data exposure:** None — GitHub Pages serves code, not data
**DPA required:** No — GitHub Pages does not process or store health records
**Status:** ✅ No action needed

---

## Pending Actions (Bayo Only)

| Priority | Action | Where |
|---------|--------|-------|
| HIGH | Sign Google Cloud DPA/BAA | cloud.google.com/terms/health |
| HIGH | Register as a Data Processor with NDPC | ndpc.gov.ng |
| MEDIUM | Add health data clause to school subscription agreement | Legal template |
| MEDIUM | Write and publish a Privacy Notice covering health data | edubloom.com.ng |
| LOW | Review Tesseract.js (local OCR) — runs entirely in browser, no server contact | No action needed |

---

## Technical Implementation Summary

Built in school-bloom-v2 sandbox (2026-08-20).
Port to production School-Bloom only after Bayo's explicit go-ahead.

Files changed:
- school-bloom-v2/app.js — health compliance module appended (~220 lines)
- school-bloom-v2/index.html — health section UI + vault unlock modal added
- school-bloom-v2/HEALTH_DATA_COMPLIANCE.md — this document

Functions added:
- _deriveHealthKey(password) — PBKDF2 key derivation
- _encryptField(plaintext) — AES-256-GCM encrypt
- _decryptField(obj) — AES-256-GCM decrypt
- _logHealthAudit(action, context) — dual-write audit log
- unlockHealthVault() — RBAC + vault unlock flow
- renderHealth() — Principal-only, audit-logged display
- logIncident() — encrypts before save, OCR blocked
- deleteIncident(idx) — audit-logged deletion
- openLogIncidentModal() — vault-check before modal opens
