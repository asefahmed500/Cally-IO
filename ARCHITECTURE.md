# ARCHITECTURE.md — Cally-IO

## 1. System overview

```
┌────────────────────────── Browser ──────────────────────────┐
│  Next.js App Router (RSC-first) + shadcn/ui + Tailwind      │
│  Server Components for data · Client Components for UX      │
└──────────────┬─────────────────────────────┬────────────────┘
               │ Server Actions / fetch       │ SSE (live ops)
┌──────────────▼─────────────────────────────▼────────────────┐
│                    Next.js (Node runtime)                    │
│  ┌────────────┐ ┌──────────────┐ ┌───────────────────────┐  │
│  │ Auth       │ │ Tenant guard │ │ Zod validation        │  │
│  │ (sessions) │ │ requireWs()  │ │ (all boundaries)      │  │
│  └────────────┘ └──────────────┘ └───────────────────────┘  │
│  ┌────────────────────┐  ┌──────────────────────────────┐   │
│  │ Domain services    │  │ AI runtime (LangGraph)       │   │
│  │ leads·calls·tasks  │  │ chat graph · call intent ·   │   │
│  │ campaigns·workflow │  │ embeddings · TTS · tools     │   │
│  └────────┬───────────┘  └──────────────┬───────────────┘   │
│  ┌────────▼───────────┐  ┌──────────────▼───────────────┐   │
│  │ Job queue worker   │  │ TelephonyProvider adapter    │   │
│  │ /api/jobs/tick     │  │ (Twilio impl; SIP later)     │   │
│  └────────┬───────────┘  └──────────────┬───────────────┘   │
└───────────┼──────────────────────────────┼──────────────────┘
            ▼                              ▼
   ┌──────────────────┐          ┌────────────────────┐
   │ PostgreSQL       │          │ Twilio / Gemini /  │
   │ (Prisma, all     │          │ Tavily (external,  │
   │ tenant-scoped)   │          │ server-only keys)  │
   └──────────────────┘          └────────────────────┘
```

## 2. Tenancy model

- `Workspace` is the tenant root. Every domain table carries `workspaceId` FK.
- Access path: session → `User` → `WorkspaceMember(workspaceId, role)` → all queries filtered by `workspaceId`.
- `src/lib/tenant.ts` exposes `requireWorkspaceMember(minimumRole?)` returning `{ user, workspaceId, member }`; **every** server action and route handler starts here. No query may omit the workspace filter.
- Cross-tenant IDs in URLs/body are resolved through this guard; unknown or foreign IDs behave as 404.
- The active workspace is stored in a signed cookie (`cally_ws`); switching validates membership first.

## 3. RBAC

- `WorkspaceMember.role`: SUPER_ADMIN* (platform, on User), WORKSPACE_OWNER, ADMIN, MANAGER, SUPERVISOR, HUMAN_AGENT, AI_AGENT, ANALYST.
- `src/lib/permissions.ts`: central capability map (`can(role, capability)`), capabilities like `contacts.write`, `campaigns.manage`, `liveops.monitor`, `billing.manage`.
- Enforced in: server actions (guard), route handlers (guard), sidebar/nav (visibility), and Prisma query helpers (scope).
- Platform SUPER_ADMIN lives on `User.role` and uses a separate `/platform` surface.

## 4. Data architecture (Prisma / PostgreSQL)

Core groups:
- **Identity**: User, Session, PasswordResetToken, Workspace, WorkspaceMember, Invitation
- **CRM**: Contact, Lead, Team, Task
- **Comms**: PhoneNumber, Call, CallEvent, CallRecording, Transcript, ConversationSummary, CallQueue
- **AI**: AIAgent, AIAgentVersion, KnowledgeSource, KnowledgeChunk
- **Growth**: Campaign, CampaignContact
- **Automation**: Workflow, WorkflowVersion, WorkflowExecution, Job
- **Platform**: Subscription, UsageRecord, Integration, Notification, AuditLog

Conventions: cuid ids, `createdAt/updatedAt` timestamps, soft delete (`deletedAt`) on Contacts/Leads/Agents/Workflows, composite indexes on `(workspaceId, …)` hot paths, unique constraints (e.g. `Call.providerCallSid`, `Invitation.token`), cascading deletes scoped inside the workspace.

## 5. Telephony abstraction

```ts
interface TelephonyProvider {
  initiateCall(input): Promise<{ providerCallSid }>
  verifyWebhook(req): Promise<boolean>
  parseWebhook(req): Promise<TelephonyEvent>
  buildTwiML(instruction): string
  listNumbers?(): Promise<PhoneNumber[]>
}
```

- `TwilioProvider` is the first implementation; webhook routes verify signatures, then reconcile events onto `Call` + append `CallEvent` rows (idempotent by `providerCallSid` + event type).
- Inbound flow: webhook → identify caller (Contact lookup) → workspace hours → route (AI agent / human member / voicemail) → TwiML.
- Live call state is provider-derived; the UI never asserts an active call without a provider event.

## 6. AI runtime

- Existing LangGraph graphs remain the engine. `AIAgent` configuration (personality, greeting, knowledge bindings, capabilities) compiles into the system prompt + allowed tool set.
- Tool registry: `src/ai/tools/registry.ts` — each tool declares required agent capability + zod schema; execution is logged (`ToolExecutionLog` via AIAgentVersion metrics or WorkflowExecution for flows).
- RAG: KnowledgeChunks embedded at ingest (text-embedding-004), cosine retrieval tenant-scoped at query time, citations returned with answers.
- Voice: Gemini TTS REST for previews and in-call speech where the provider TTS is not used.

## 7. Background jobs

- `Job` table (type, payload JSON, workspaceId, runAt, attempts, maxAttempts, status, lastError).
- `POST /api/jobs/tick` (secret header) claims due jobs with `updateMany` optimistic claim → executes handler → marks done/failed/retry with backoff.
- Cron: platform cron (e.g. Vercel Cron / system crontab / cron-job.org) hits the tick route every minute.
- Handlers registered in `src/lib/jobs/handlers.ts`: campaign dialer tick, workflow executor, transcript processing, usage rollup, webhook reconciliation.

## 8. Real-time (live ops)

- SSE route `GET /api/live/stream` (Node runtime): authenticated, workspace-scoped; emits snapshots of active calls/queue/agents every 2–5s from DB state (provider webhooks keep DB fresh). Client uses EventSource with polling fallback.

## 9. Billing

- `Subscription` (plan, status, stripeCustomerId, stripeSubscriptionId) + `UsageRecord` (workspaceId, metric, quantity, period).
- Metering points: AI graph invocations (minutes), telephony call durations, agent/member counts, storage (knowledge bytes), automation runs.
- Limit checks run in the job/action layer (`assertWithinLimits`); Stripe test-mode checkout via `stripe` SDK, webhook-verified subscription changes. Without keys → Integration row `NOT_CONNECTED`, UI shows explicit state.

## 10. Security

- httpOnly secure cookies; bcrypt(12) passwords; session rotation on login.
- All mutation actions + route handlers: session → tenant guard → zod parse → capability check.
- Twilio webhook signature verification; Stripe signature verification; idempotency keys on external events.
- Rate limiting: in-memory sliding window per IP+route for auth/公 APIs (upgradeable to Upstash later).
- AuditLog records privileged mutations (member/role/billing/agent publish/webhook config).
- Uploads: size + MIME validation; text extraction server-side only.

## 11. Conventions

- Server Actions for mutations; Route Handlers for webhooks/SSE/streams.
- `Promise.all` for parallel reads; `revalidatePath` after mutations.
- Serialized DTOs (ISO date strings) cross the RSC boundary; never raw Prisma models with heavy relations.
- Empty/loading/error states are mandatory UI deliverables per module.
