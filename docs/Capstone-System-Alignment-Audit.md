## Document Source Note

Audited against the updated paper:  
`EDTECH_ CREATION OF A WEB-BASED MENTORING SYSTEM (1).docx`

Key document change from the older PDF:
- Accessibility now requires **readable fonts** and **screen reader compatibility** only.
- **Dark mode is no longer required** in the updated scope.

The uploaded updated file still covers mainly Chapters 1–3 (plus references). ISO 25010 evaluation is still required by the paper, and the client confirmed evaluation results are not yet done.

---

## Critical Problems (Fix First)

### 1. Anyone authenticated can become admin — CRITICAL

**Where**
- RLS policy on `admins`: insert allowed for any authenticated user.

**Why it matters**
- Privilege escalation: a normal user can insert themselves into `admins` and gain admin rights.

**Fix**
- Remove open insert policy.
- Allow admin creation only via service role / secure seed script.
- Verify no extra rows exist in `admins` table.

---

### 2. Mentors can self-approve — CRITICAL

**Where**
- `Owner update mentor_profiles` lets mentors update their own row.
- Status field (`pending` / `approved` / `rejected`) is on that same table.

**Why it matters**
- A mentor can update `status` to `approved` without admin review.

**Fix**
- Restrict mentor updates to safe columns only (profile fields).
- Allow `status` changes only by admin policy / edge function.
- Add DB trigger or column-level protection if needed.

---

### 3. Learning materials are publicly downloadable — CRITICAL (scope + security)

**Document requirement**
- Mentees view materials only; no download (budget constraint).

**Current behavior**
- Storage bucket is public.
- Files use public URLs.
- UI “View” opens public link → download is still possible.

**Why it matters**
- Breaks documented limitation.
- Leaks materials to anyone with the URL.

**Fix**
- Make bucket private.
- Serve files via signed URLs or authenticated viewer.
- Prefer in-app PDF/video viewer; block direct download where possible.

---

### 4. Hardcoded Supabase project credentials in source

**Where**
- Supabase URL + anon key are hardcoded in config service.

**Notes**
- Anon key is designed to be public **with strong RLS**.
- Hardcoding still reduces flexibility and increases risk if secret keys ever leak into client code.
- Prefer environment injection for production builds.

**Fix**
- Load from environment / build-time env vars.
- Never place service-role / secret keys in frontend (currently `.env` is gitignored — keep it that way).

---

## Major Functional / Scope Gaps vs Document

### A. Students-only mentees (not enforced)

**Document:** mentees should be students; students may only apply as mentee unless allowed by mentor/client/admin.  
**Code:** any user can pick mentee freely; no student verification.

**Needed**
- Student verification (school email / student ID / university validation).
- Enforce that mentee registration is for students only.

---

### B. Mentor capacity limit (missing)

**Document:** mentors decide how many mentees they want.  
**Code:** unlimited connections; `looking_for_mentee` exists but is unused; no `max_mentees`.

**Needed**
- Add `max_mentees` to mentor profile.
- Enforce limit on connect.
- Hide full mentors when capacity is reached.

---

### C. Realtime chat (not truly realtime)

**Document:** realtime chat.  
**Code:** message polling every ~5 seconds; no Supabase Realtime channel.

**Needed**
- Subscribe to `messages` with Realtime.
- Instant insert/update for new messages and seen status.
- Optionally require connection before messaging (DB check).

---

### D. Accessibility features (incomplete)

**Updated document requirement:** readable fonts and screen reader compatibility.  
*(Dark mode is no longer required.)*

**Code:** some `aria-label`s only; no dedicated accessibility support/settings.

**Needed**
- Readable typography / contrast improvements.
- Keyboard navigation + ARIA audit.
- Basic screen-reader pass on major flows (login, register, dashboard, chat, materials).

---

### E. Structured mentor feedback (weak)

**Document:** evaluate teaching skills, effectiveness, and guidance.  
**Code:** single overall rating + free text.

**Needed**
- Separate scores for teaching / effectiveness / guidance.
- Show category averages on mentor cards.

---

### F. Client-chosen mentors only (partial)

**Document (Limitations):** mentors are only chosen by the client.  
**Document (Scope contradiction):** users “may also apply to be a mentor.”  
**Code (actual flow):**
1. Anyone can register and choose Mentor.
2. Mentor fills profile and uploads documents.
3. Status becomes pending.
4. Admin approves/rejects in Mentor Requests.
5. Only approved mentors appear to mentees.

**Interpretation**
- Admin approval exists (client’s claim is partly true).
- But this is **open mentor application + admin approval**, not strict **client-chosen mentors only**.

**Needed (choose one and keep paper + system consistent)**
- Preferred for paper wording: admin/client creates or invites mentors only (no public mentor self-apply).
- Or update paper wording to “admin-approved mentors” if open application stays.

---

## Security Audit Summary

| Issue | Severity | Status |
|-------|----------|--------|
| Open `admins` insert policy | Critical | Present |
| Mentor can update own `status` | Critical | Present |
| Public materials storage | Critical | Present |
| Public read of all profiles | High | Present |
| Messages insert without connection check | High | Present |
| Incomplete account deletion cleanup | High | Present |
| Edge function CORS `*` | Medium | Present |
| Many auth pages lack route guards | Medium | Present |
| Admin password change UI does not actually update password | Medium | Present |
| Debug queries loading all calendar events in mentee flow | Medium | Present |
| Hardcoded anon/config in client | Medium | Present |

### Additional security notes

1. **Profile privacy:** mentee/mentor profiles are world-readable (`using (true)`). Phone numbers and personal data can be scraped by any authenticated client.
2. **Messaging abuse:** any logged-in user can insert a message to any `receiver_id` if they know the UUID.
3. **Delete account incomplete:** edge function deletes profiles/connections/admins/auth user, but does not clearly clean messages, feedback, materials, calendar events, or storage files.
4. **Route protection gap:** only `/dashboard` and `/admin` use guards. Profile/onboarding/document pages can be opened directly without completed-auth checks (partially mitigated by client redirect logic, but not hard-guarded).
5. **Feedback rating aggregation may fail under RLS:** matchmaking tries to read all ratings for many mentors, but RLS only allows own/mentor-side feedback rows. Average ratings may be wrong or empty unless policies were changed outside the repo SQL.

---

## Research / Capstone Evaluation Gaps

The updated document still requires evaluation using **ISO 25010**:

- Compatibility
- Functional Suitability
- Interaction Capability
- Reliability
- Security
- Maintainability

Client status: **no ISO evaluation results yet** (high risk for defense).

### What is missing

1. No completed ISO 25010 survey results / weighted mean analysis.
2. No prepared Likert-scale evaluation evidence for Chapter 3/5 defense questions.
3. No formal respondent dataset matching the paper’s evaluation procedure.
4. Survey may be done outside the system (e.g., Google Forms), but results must still exist.

### Why this matters for defense

Even if features exist, the research method requires measurable evaluation after students use the system. Without ISO results, the study is incomplete for final defense.
