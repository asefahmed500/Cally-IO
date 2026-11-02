# Cally-IO: The Automated Call Center, Run by AI Agents

Cally-IO is a production-ready, multi-tenant SaaS platform for running an automated call
center. AI voice agents dial, answer, qualify, and follow up on their own — wrapped in a
role-based workspace with campaigns, workflow automation, live operations, conversation
intelligence, usage metering, and billing.

## Tech stack

| Layer | Technology |
|---|---|
| Framework | Next.js 14 (App Router, React Server Components) |
| Language | TypeScript (strict) |
| Database | PostgreSQL + Prisma ORM |
| UI | shadcn/ui (Radix primitives) + Tailwind CSS, Inter via `next/font` |
| Auth | Custom: bcryptjs + DB-backed sessions + httpOnly cookie |
| AI | LangGraph 1.x + `@langchain/google-genai` (Gemini for chat, intent, embeddings, TTS) |
| Telephony | Twilio SDK 5.x (outbound + inbound, TwiML webhooks, recordings) |
| Payments | Stripe (test mode, checkout + webhook subscription state machine) |

## Core features

- **AI voice agents** — 8-step builder, versioning, draft/active/paused states, per-agent
  knowledge binding, capability-gated tools, and a test console.
- **Calling engine** — provider abstraction with a Twilio implementation, webhook signature
  verification, idempotency, reconciliation, and an 11-state call lifecycle with
  recordings, transcripts, and event timelines.
- **Campaigns** — audience selection, consent and calling-hours gating, retry policies,
  preview/progressive dialing, pause/resume/stop, live counters.
- **Live operations** — real-time SSE view of active calls, the dial queue, and team
  availability, with manager controls.
- **Workflow automation** — trigger/condition/action builder, published versions, and a
  queue-backed execution engine with retries and idempotency.
- **CRM** — contacts with CSV import/export and dedupe, a 7-stage lead pipeline, and
  tasks across types and statuses.
- **Knowledge base** — document ingestion (PDF/DOCX/TXT) → chunking → embeddings, plus a
  company-wide FAQ and retrieval-augmented answers.
- **Conversation intelligence** — transcripts, AI summaries, sentiment and intent on every
  call, with manager review and correction.
- **Roles** — 8 workspace roles (owner, admin, manager, supervisor, human agent, AI agent,
  analyst) enforced by a central capability map on the server, in navigation, and in the UI.
- **Billing and usage** — metered usage, plan limits, over-limit behavior, Stripe
  test-mode checkout, and a subscription state machine.
- **Trust** — audit log, retention policies, rate limiting, and tenant isolation on every
  query.

## Getting started

### 1. Prerequisites

- Node.js 18+
- A PostgreSQL database
- A Google AI API key (Gemini)
- A Twilio account with a purchased phone number
- (Optional) A Stripe account for test-mode billing
- (For local Twilio webhooks) [ngrok](https://ngrok.com/) or another tunnel

### 2. Install

```bash
npm install
```

### 3. Environment variables

Create a `.env` file. See `.env.example` for the full list. Key variables:

- `DATABASE_URL` — PostgreSQL connection string
- `GOOGLE_API_KEY` — Gemini API key (chat, embeddings, TTS)
- `TWILIO_ACCOUNT_SID` / `TWILIO_AUTH_TOKEN` / `TWILIO_PHONE_NUMBER`
- `NEXT_PUBLIC_BASE_URL` — your public URL, required for Twilio webhooks
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — optional, for billing

### 4. Database

```bash
npm run db:push
```

### 5. Run

```bash
npm run dev
```

Open [http://localhost:9002](http://localhost:9002). Sign up to create your account and
workspace. If you are testing Twilio locally, run `ngrok http 9002` in a second terminal
and set the public URL as `NEXT_PUBLIC_BASE_URL`.

## Quality gates

```bash
npm run typecheck   # tsc --noEmit
npm run lint        # next lint
npm run build       # next build
npm run test:e2e    # Playwright (requires npx playwright install chromium)
```
