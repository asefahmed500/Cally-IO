# CODEBASE_AUDIT.md — Cally-IO

Audited: October 2026. Reflects the repository immediately before the multi-tenant SaaS transformation.

## 1. Stack

| Layer | Technology | Version |
|---|---|---|
| Framework | Next.js (App Router, RSC) | 14.2.5 |
| Language | TypeScript (strict) | 5.x |
| Database | PostgreSQL + Prisma ORM | 6.19.3 |
| UI | shadcn/ui (radix base) + Tailwind CSS | v3.4 |
| Icons | lucide-react | 0.395 |
| Auth | Custom: bcryptjs + DB-backed sessions + httpOnly cookie | — |
| AI | LangGraph 1.x + @langchain/google-genai 2.x (Gemini 2.5 Flash, text-embedding-004, TTS via REST) | — |
| Web search | Tavily REST (free tier) | — |
| Telephony | Twilio SDK 5.x (outbound calls + TwiML webhooks) | — |
| Fonts | Inter via next/font | — |

## 2. Current data model (prisma/schema.prisma)

11 models, all workspace-less (global scope):

- `User` (email, name, passwordHash, role: USER|ADMIN, emailVerified)
- `Session` (hashed token, userId, expiresAt)
- `PasswordResetToken`
- `Lead` (name, email, phone, company, jobTitle, notes, status New|Qualified|Called|Converted, score, agentId, followUp*)
- `Conversation` (one per user, JSON chat history)
- `KnowledgeDocument` + `EmbeddingChunk` (fileName, chunkText, Float[] embedding — in-JS cosine search)
- `Faq`
- `AISettings` (singleton row `default_config`)
- `Metric` (chat thumbs feedback)
- `CallLog` (leadId, callSid, status, duration, recordingUrl, leadResponse, speechConfidence)
- `AnalyticsLog` (DOCUMENT_USED events)

## 3. Application surface

Pages: `/` (landing), `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/dashboard` (KPI cards + streaming RAG chat), `/leads` (kanban), `/knowledge` (docs + FAQs + content suggestions), `/settings` (admin: analytics, users, AI settings, integration status).

API routes: `POST /api/chat` (streaming), `GET /api/chat/history`, `POST /api/chat/history/clear`, `POST /api/tts`, `POST /api/twilio/call`, `POST /api/twilio/handle-response`, `POST /api/twilio/status`.

AI layer:
- `src/ai/graphs/chat-graph.ts` — LangGraph ReAct agent (system prompt from settings + FAQs + embedding retrieval; webSearch tool via ToolNode; streamed token output)
- `src/ai/flows/interpret-spoken-response.ts` — LangGraph intent graph (classify → respond) used by Twilio handle-response
- `src/ai/flows/process-document.ts` — extract (pdf/docx/txt) → RecursiveCharacterTextSplitter → embedDocuments → Postgres
- `src/ai/flows/text-to-speech.ts` — Gemini TTS REST → WAV data URI
- `src/ai/flows/generate-call-script.ts`, `log-metrics.ts`

## 4. Auth & access control

- Sessions: random 32-byte token, SHA-256 hashed in DB, httpOnly cookie `cally_session`, 7-day expiry. `getLoggedInUser()` returns `SessionUser {$id, name, email, labels[], emailVerified, createdAt}`.
- Roles: only USER / ADMIN on the global user. **No workspace scoping, no granular roles.**
- Admin-gated server actions throw `Unauthorized` in settings/users actions. Route handlers check `getLoggedInUser()`.

## 5. Telephony reality

- Outbound only: `initiateCall` (lead actions) → Twilio `calls.create` + `CallLog` row.
- Webhooks: `/call` (TwiML script + Gather), `/handle-response` (AI intent → closing TwiML), `/status` (status/duration/recording updates).
- **Missing:** webhook signature verification, idempotency (duplicate SIDs), inbound call routing, call queueing, recordings storage model, provider abstraction, retry policies.

## 6. UI system

- shadcn/ui components installed: accordion, alert-dialog, alert, avatar, badge, button, calendar, card, dialog, dropdown-menu, input, label, popover, scroll-area, select, separator, sheet, sidebar, skeleton, switch, table, tabs, textarea, toast, tooltip.
- Theme: white/gray tokens, pill buttons (`rounded-full`) with gray-white gradient variants, Inter 400/500/600 + negative tracking, antialiased smoothing. Landing page: pill navbar, hero, demo dashboard preview, features, CTA, footer. Vector logo at `src/components/logo.tsx`.
- Charts: recharts wrapped by `src/components/settings/analytics-chart.tsx`.

## 7. Tooling & quality gates

- `npm run typecheck` (tsc --noEmit): 0 errors.
- `npm run lint` (eslint 8 + next/core-web-vitals): clean (all no-unescaped-entities fixed).
- `npm run build`: passes, 20 routes.
- Tests: **none** (no unit or E2E framework installed).
- postinstall: `prisma generate`.

## 8. Known limitations (driving the transformation)

1. Single-tenant: no Workspace model, no member model, all data global.
2. Two roles only; no capability map; sidebar not role-driven beyond admin.
3. Leads/CRM is minimal (4 statuses, no contacts, no tasks, no campaigns).
4. AI agents are implicit (settings singleton), not first-class configurable entities.
5. Telephony lacks verification/idempotency/inbound/queueing/abstraction.
6. No background job infrastructure (campaigns/workflows need one).
7. No live operations (no SSE/WebSocket channel).
8. No billing, usage metering, audit logs, rate limiting.
9. No tests.
10. Onboarding is a bare signup form.

## 9. Reusable foundation (kept)

- Session auth primitives (bcrypt + hashed session tokens) — will be extended with workspace membership claims.
- LangGraph chat + intent graphs — become the runtime for workspace AI agents.
- Document ingestion pipeline — becomes KnowledgeSource processing.
- Twilio outbound flow + TwiML routes — become the first TelephonyProvider implementation.
- shadcn design system, sidebar, kanban patterns, toast/feedback patterns.
