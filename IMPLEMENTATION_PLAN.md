# IMPLEMENTATION_PLAN.md — Cally-IO

Delivery is phased. Each phase ends with: `tsc --noEmit` ✓ · `next lint` ✓ · `next build` ✓ · permission spot-checks ✓ — before the next phase starts.

| Phase | Scope | Key deliverables |
|---|---|---|
| **0 — Foundation** | Docs + schema + design tokens | CODEBASE_AUDIT / PRODUCT_REQUIREMENTS / IMPLEMENTATION_PLAN / ARCHITECTURE; full tenant-scoped Prisma schema; dev DB reset; PRD palette tokens (`#F7F8FA` / `#635BFF`); tenant guard + permissions capability map (types ready for Phase 1 use) |
| **1 — Tenancy & RBAC** | Workspace system | Workspace CRUD, onboarding wizard (7 steps), invitations, member management, 8-role enforcement, workspace switcher + app shell header, audit log basics |
| **2 — Dashboard shell** | Core experience | Header (selector, search, range, notifications, profile), KPI cards + charts from real rows, operational panels, onboarding empty states, rebase existing chat/dashboard |
| **3 — CRM, tasks, teams** | Customer management | Contacts (fields, detail page, CSV import/export, dedupe), 7-stage pipeline (migrate current leads), tasks (types × statuses), teams + availability |
| **4 — AI agent builder** | AI workforce | 8-step wizard, agent versions/states, per-agent knowledge binding, capability-gated tool registry + execution logs, test console, AI performance page |
| **5 — Telephony engine** | Calling | TelephonyProvider abstraction + Twilio impl, webhook verification + idempotency + reconciliation, 11-state call lifecycle, call history/recordings/dialer/queue, inbound routing |
| **6 — Campaigns & live ops** | Scale calling | Campaign CRUD + counters + pause/resume/stop, consent/hours gating, retry policies, preview/progressive dialing; Live Operations screen over SSE with manager controls |
| **7 — Workflows & follow-ups** | Automation | Node-based builder (triggers/conditions/actions), publish/versioning, Job-queue execution with retries + idempotency + logs, follow-up automation |
| **8 — Conversation intelligence** | Post-call AI | Transcripts, summaries, intent/sentiment/outcome via Gemini, AI-vs-verified labeling, manager review/correction, processing statuses |
| **9 — Analytics & billing** | Insight + monetization | Report center (filters + CSV export), usage metering + plan limits + over-limit behavior, Stripe test-mode checkout + subscription state machine, integrations page |
| **10 — Hardening & E2E** | Production readiness | Rate limiting, upload validation, audit log UI, retention policies, Playwright E2E covering the 17 acceptance criteria (incl. cross-tenant rejection, webhook idempotency), responsive + performance pass |

## Out-of-scope / deferred

- Predictive dialing (provider + regulation dependent) — interface reserved.
- SIP/other providers beyond Twilio — adapter interface only.
- Real Stripe live charges — test mode only until keys are provided.
- Email/SMS delivery providers — Integration rows with "not connected" states until configured.

## Verification protocol (per phase)

1. Inspect changed files.
2. `npm run typecheck`, `npm run lint`, `npm run build`.
3. Manual permission checks (role matrix spot tests).
4. Responsive check (desktop/tablet/mobile breakpoints).
5. Document incomplete integrations explicitly.
