# PRODUCT_REQUIREMENTS.md — Cally-IO

**Tagline:** The AI Workforce for Every Customer Conversation.
**Product:** Multi-tenant AI-powered contact center SaaS. Human agents and AI voice agents working side by side.

## 1. Product principles

1. AI-first — agents are first-class workers with configs, versions, and metrics, not a decorative feature.
2. Multi-tenant — every datum belongs to a workspace; isolation enforced at the query layer.
3. Real workflows — calling, CRM, campaigns, tasks, automations that operate end to end.
4. Honest UI — no fabricated metrics or simulated live activity; explicit connection states.
5. Enterprise design — Linear/Stripe-grade restraint: `#F7F8FA` bg, `#635BFF` primary, thin borders, minimal radius, Inter typography.
6. Secure by default — role-based access, webhook verification, audit logs, consent tracking.

## 2. Roles & capabilities

| Role | Scope |
|---|---|
| SUPER_ADMIN | Platform: organizations, plans, usage, system monitoring |
| WORKSPACE_OWNER | Full control of workspace: billing, members, agents, data |
| ADMIN | Operations, teams, campaigns, workflows, reporting |
| MANAGER | Teams, live monitoring, lead distribution, tasks, evaluation |
| SUPERVISOR | Live monitoring, QA, coaching, escalations |
| HUMAN_AGENT | Assigned calls, contacts, tasks, follow-ups |
| AI_AGENT | Automated worker; explicit capability/tool permissions, logged execution |
| ANALYST | Read-only reporting within permitted scope |

Permissions are enforced in server actions, route handlers, DB queries, and navigation — never UI-only.

## 3. Module requirements (summary)

### 3.1 Workspace & onboarding
Sign up → create workspace (name, industry, size, timezone, hours) → invite team → first AI agent → telephony connection (or skip) → dashboard. Multiple workspaces per user, switcher, branding, member management, activity logs, deletion/export.

### 3.2 Dashboard
Header: workspace selector, global search, date range, notifications, help, profile. KPIs: total/active calls, AI vs human handled, answer rate, AHT, conversion rate, pending follow-ups. Visualizations from real rows only; onboarding empty states when no data.

### 3.3 AI agent builder
8-step wizard: Identity → Personality → Voice → Knowledge → Capabilities → Call config → Testing → Publish. States: DRAFT/TESTING/ACTIVE/PAUSED/ERROR/ARCHIVED. Per-agent versions, knowledge sources, usage, metrics. Tools execute only via a validated, permission-gated registry with execution logs.

### 3.4 Telephony
Provider-independent adapter (Twilio first). Inbound: webhook → caller identify → hours check → AI/human/voicemail routing → queueing → transfers. Outbound: click-to-call, manual, campaign, scheduled; retries; caller ID. Lifecycle states: QUEUED, RINGING, ANSWERED, IN_PROGRESS, ON_HOLD, TRANSFERRED, COMPLETED, FAILED, NO_ANSWER, BUSY, CANCELLED. Webhook signature verification + CallSid idempotency + event reconciliation.

### 3.5 Dialer
Keypad, contact search, caller ID, status, mute/hold/transfer/end, notes, disposition, follow-up scheduling. Campaign modes: manual, preview, progressive (predictive only with provider support + safeguards).

### 3.6 CRM
Contacts (full field set incl. consent, tags, custom fields), detail page (calls, summaries, notes, tasks, timeline, AI insights), 7-stage pipeline (NEW → CONTACTED → QUALIFIED → FOLLOW_UP → PROPOSAL → WON → LOST), search/filter/sort/pagination, bulk assign, CSV import/export, dedupe.

### 3.7 Campaigns
Objective, audience, assigned AI agent + human team, schedule/timezone, retries, max attempts, priority, scripts, follow-up rules. Dashboard counters; pause/resume/stop. Consent, opt-out, and operating-hours gating.

### 3.8 Tasks
Types: call back, send follow-up, review conversation, verify lead, escalation, support, appointment confirmation. Statuses: TODO/IN_PROGRESS/WAITING/COMPLETED/CANCELLED. AI may create tasks only via authorized workflows.

### 3.9 Workflows
Visual node builder. Triggers (call completed, missed call, new lead, disposition changed, qualified, follow-up due, appointment approaching), conditions, actions (assign, task, callback, email/SMS via configured provider, CRM update, notify, transfer, invoke agent, summary). Draft/publish, versions, execution history, retries, idempotency, audit trail; queue-backed execution.

### 3.10 Conversation intelligence
Per completed call: transcription, summary, intent, sentiment, outcome, qualification, action items, follow-up recommendation, escalation detection. AI assessments clearly labeled; manager review/correction; processing status + model metadata stored.

### 3.11 Live operations
Active calls, queue, agent availability (human + AI), missed calls, wait time, escalations. Manager controls: assign/reassign/transfer/escalate/priority. SSE-driven updates; provider-confirmed states only.

### 3.12 Knowledge base
Sources: PDF, DOCX, TXT, URL, FAQ, structured info. Pipeline: UPLOAD → VALIDATE → EXTRACT → CHUNK → EMBED → INDEX → READY with failure tracking + retry. Tenant-scoped retrieval with citations.

### 3.13 Analytics
Reports: volume, inbound/outbound, AI vs human, outcomes, funnel, campaign effectiveness, agent performance, follow-up completion, missed calls, usage. Filters: date, team, member, agent, campaign, direction, outcome. CSV export.

### 3.14 Billing & usage
Plans: FREE, STARTER, GROWTH, BUSINESS, ENTERPRISE. Metered: AI minutes, telephony minutes, numbers, agents, members, storage, transcription, automation runs. Stripe test-mode checkout; usage tracking, limits, over-limit behavior, billing history. Never simulate payment success.

### 3.15 Security
Secure auth, httpOnly cookies, server-side authorization, tenant isolation, input validation (zod), rate limiting, webhook verification, secret management, audit logs, upload validation, secure recordings, consent/opt-out tracking, retention policies.

## 4. Acceptance criteria (final)

A workspace owner can: register + create workspace; invite + assign roles; create/configure an AI agent; upload knowledge; test the agent; connect telephony; complete a real provider-backed call; view call records; manage contacts/leads; run a campaign; assign tasks; configure automation; review call summaries; see real analytics; monitor usage; manage settings. Cross-tenant access must be rejected at the API/DB layer. Missing external credentials surface as explicit "not connected" states.
