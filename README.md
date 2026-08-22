# school-bloom-v2 — School Portal Sandbox

**Sandbox for:** School-Bloom (school.edubloom.com.ng)
**Sandbox-first rule:** All fixes proved here before production gets them.
**Last updated:** 2026-08-20

---

## Current Versions

| File | Version |
|------|---------|
| app.js | `?v=20260820-security` (added 2026-08-20 — was missing entirely) |
| sw.js CACHE_NAME | `edubloom-school-bloom-v2-20260820-security` (was static `school-bloom-v2-cache-v1`) |

---

## Session History

### 2026-08-20 — Backport from production + infrastructure fixes

Production School-Bloom received two significant fixes this session:

**1. Structural HTML fix (production only — not needed here):**
Production index.html had a premature `</body></html>` midway through the file at
line 1329, with app.js loading twice (once unversioned, once versioned). school-bloom-v2
does not have this issue — single script tag, clean structure.

**2. bannerEl.innerHTML XSS fix (production only — not applicable here):**
Production app.js line 2537 injected `name`, `userRole`, `classInfo` raw into innerHTML.
school-bloom-v2/app.js is a much earlier, lighter build (1,409 lines vs 10,030+ in
production) and does not contain `bannerEl.innerHTML` — the pattern does not exist here.
No fix needed.

**3. Cache-buster added (FIXED here):**
index.html had no `?v=` on the app.js script tag at all. Added `?v=20260820-security`.

**4. sw.js CACHE_NAME versioned (FIXED here):**
sw.js used a static cache key `school-bloom-v2-cache-v1` which would never bust.
Updated to `edubloom-school-bloom-v2-20260820-security`.

---

### Earlier sessions

This sandbox is a lighter, earlier build used for feature experimentation.
Key missing features vs production (not yet ported):
- Full RBAC multi-role login (staff_directory subcollection)
- Groq/HF OCR import pipeline
- End-of-term wizard
- Broadsheet/scorecard module
- Safety features (F1 morning alert, F2 collector list, F3 sign-out)

---

## Standing Rules (this repo)

- Sandbox-first: prove all features here before Bayo approves production port
- After every push, update this README in the same push
- Cache-bust: bump ?v= in index.html (no sw.js was previously versioned — now fixed)
- _isPremium() hardcoded true — TEMP BYPASS, do not relock without explicit go-ahead
- No Base44 anywhere
