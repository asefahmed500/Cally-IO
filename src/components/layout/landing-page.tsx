"use client"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Logo } from "@/components/logo"
import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Menu,
  ArrowRight,
  Radio,
  PhoneCall,
  PhoneIncoming,
  Voicemail,
  Bot,
  Target,
  Workflow,
  BrainCircuit,
  ShieldCheck,
  Check,
  ChevronRight,
  Play,
  Mic,
  BookOpen,
} from "lucide-react"
import React from "react"

const navLinks = [
  { label: "Product", href: "#product" },
  { label: "How it works", href: "#flow" },
  { label: "Roles", href: "#roles" },
]

function Navbar() {
  const [isOpen, setIsOpen] = React.useState(false)
  return (
    <header className="sticky top-0 z-50 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-4 sm:px-6">
        <Link href="/" prefetch={false}>
          <Logo />
        </Link>
        <nav className="ml-auto hidden items-center gap-6 md:flex">
          {navLinks.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              prefetch={false}
            >
              {link.label}
            </Link>
          ))}
          <Separator orientation="vertical" className="h-5" />
          <Link
            href="/login"
            className="text-sm font-medium underline-offset-4 hover:underline"
            prefetch={false}
          >
            Log in
          </Link>
          <Button asChild variant="brand" size="sm">
            <Link href="/signup" prefetch={false}>
              Start free
            </Link>
          </Button>
        </nav>
        <Sheet open={isOpen} onOpenChange={setIsOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="ml-auto md:hidden">
              <Menu className="size-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          </SheetTrigger>
          <SheetContent side="right">
            <SheetHeader>
              <SheetTitle asChild>
                <Link href="/" onClick={() => setIsOpen(false)} prefetch={false}>
                  <Logo />
                </Link>
              </SheetTitle>
            </SheetHeader>
            <nav className="mt-6 flex flex-col gap-4 text-lg font-medium">
              {navLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="text-muted-foreground hover:text-foreground"
                  onClick={() => setIsOpen(false)}
                  prefetch={false}
                >
                  {link.label}
                </Link>
              ))}
              <Separator />
              <Link href="/login" className="text-muted-foreground hover:text-foreground" onClick={() => setIsOpen(false)}>
                Log in
              </Link>
              <Button asChild variant="brand" className="mt-2" onClick={() => setIsOpen(false)}>
                <Link href="/signup" prefetch={false}>
                  Start free
                </Link>
              </Button>
            </nav>
          </SheetContent>
        </Sheet>
      </div>
    </header>
  )
}

/** Decorative voice waveform — represents a live AI call. */
function Waveform({ className, live }: { className?: string; live?: boolean }) {
  const bars = [6, 12, 18, 10, 22, 14, 8, 16, 20, 9, 13, 5]
  return (
    <div className={cn("flex h-8 items-center gap-1", className)} aria-hidden="true">
      {bars.map((height, i) => (
        <span
          key={i}
          className={cn("w-1", live ? "bg-success/60" : "bg-primary/25")}
          style={{ height: `${height}px` }}
        />
      ))}
    </div>
  )
}

const demoStats = [
  { label: "Calls today", value: "128" },
  { label: "AI handled", value: "96%" },
  { label: "Answer rate", value: "71%" },
  { label: "Avg. handle", value: "1m 52s" },
]

const demoCalls = [
  { icon: Bot, name: "Aria — Sales", meta: "Connected · 2m 14s", status: "Qualified", live: true },
  { icon: PhoneIncoming, name: "Inbound — Support line", meta: "Connected · 0m 48s", status: "Answered", live: true },
  { icon: Voicemail, name: "Nova — Renewals", meta: "No answer · Voicemail left", status: "Retry scheduled", live: false },
]

function MiniLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </span>
  )
}

/* ---------------------------------------------------------------- panels */

function LiveOpsPane() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <Radio className="size-4 text-success" />
        <span className="text-sm font-medium">Live operations</span>
        <Badge variant="success" className="ml-auto">3 live</Badge>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {demoStats.map((stat) => (
          <div key={stat.label} className="border p-3">
            <MiniLabel>{stat.label}</MiniLabel>
            <p className="tabular mt-1 text-lg font-semibold leading-none">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 divide-y border">
        {demoCalls.map((call) => (
          <div key={call.name} className="flex items-center gap-3 p-3">
            <span className="flex size-8 shrink-0 items-center justify-center bg-secondary">
              <call.icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-[13px] font-medium">{call.name}</span>
              <span className="truncate text-[11px] text-muted-foreground">{call.meta}</span>
            </div>
            <Waveform live={call.live} className="hidden sm:flex" />
            <Badge variant={call.live ? "success" : "secondary"} className="shrink-0">
              {call.status}
            </Badge>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>Queue 12</span>
        <span>3 agents online</span>
        <span>Updated just now</span>
      </div>
    </div>
  )
}

function AgentPane() {
  return (
    <div className="grid gap-3 p-4 md:grid-cols-[minmax(0,220px)_1fr]">
      <div className="border p-3">
        <div className="flex items-center gap-2">
          <span className="flex size-9 items-center justify-center bg-foreground text-xs font-semibold text-background">
            AR
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">Aria</p>
            <p className="truncate text-[11px] text-muted-foreground">Sales qualification</p>
          </div>
          <Badge variant="success" className="ml-auto">Active</Badge>
        </div>
        <dl className="mt-3 divide-y text-[12px]">
          {[
            ["Voice", "Rachel · ElevenLabs"],
            ["Model", "Gemini 1.5 Pro"],
            ["Script", "Inbound sales v3"],
            ["Knowledge", "18 documents"],
          ].map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-2 py-1.5">
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="truncate font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <BookOpen className="size-3.5" />
          Grounded in your knowledge base
        </div>
      </div>

      <div className="flex flex-col border">
        <div className="flex items-center gap-2 border-b px-3 py-2">
          <Mic className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Test call</span>
          <span className="tabular ml-auto text-[11px] text-muted-foreground">00:42</span>
        </div>
        <div className="flex flex-1 flex-col justify-center gap-2 p-3">
          <div className="max-w-[85%] bg-secondary px-3 py-2 text-[13px]">
            Hi, this is Aria from Cally. Is now still a good time?
          </div>
          <div className="ml-auto max-w-[80%] border px-3 py-2 text-[13px]">
            Sure — what is this about?
          </div>
          <div className="max-w-[85%] bg-secondary px-3 py-2 text-[13px]">
            You asked for a demo of the call center. I can book 30 minutes this week.
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 border-t px-3 py-2">
          <Badge variant="secondary">Intent: book a demo</Badge>
          <Badge variant="success">Sentiment: positive</Badge>
          <Badge variant="outline">Stage: qualified</Badge>
          <span className="ml-auto flex items-center gap-1 text-[11px] font-medium">
            <Play className="size-3" />
            Replay
          </span>
        </div>
      </div>
    </div>
  )
}

function CampaignPane() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <Target className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">Q3 demo outreach</span>
        <Badge variant="success" className="ml-auto">Running</Badge>
      </div>

      <div className="mt-4 border p-3">
        <div className="flex items-baseline justify-between">
          <MiniLabel>Dialed</MiniLabel>
          <span className="tabular text-sm font-semibold">744 / 1,200</span>
        </div>
        <div className="mt-2 h-2 w-full bg-secondary">
          <div className="h-full w-[62%] bg-foreground" />
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          {[
            ["Connected", "61%"],
            ["Voicemail", "22%"],
            ["No answer", "17%"],
          ].map(([label, value]) => (
            <div key={label} className="border py-2">
              <p className="tabular text-sm font-semibold">{value}</p>
              <p className="text-[10px] text-muted-foreground">{label}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-3 divide-y border text-[12px]">
        {[
          ["Calling hours", "09:00–17:00 · Mon–Fri"],
          ["Retry rule", "No answer → 3 attempts, 2h apart"],
          ["Assigned agent", "Aria — Sales"],
          ["Consent check", "Skipped 4 opted-out contacts"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="truncate font-medium">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function WorkflowNode({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 border p-3">
      <MiniLabel>{label}</MiniLabel>
      <p className="mt-1 text-[12px] font-medium leading-snug">{value}</p>
    </div>
  )
}

function Arrow() {
  return (
    <ChevronRight className="mx-auto size-4 shrink-0 text-muted-foreground md:mx-0 md:rotate-0" aria-hidden="true" />
  )
}

function WorkflowPane() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <Workflow className="size-4 text-muted-foreground" />
        <span className="text-sm font-medium">No-answer recovery</span>
        <Badge variant="secondary" className="ml-auto">Active</Badge>
      </div>

      <div className="mt-4 flex flex-col gap-2 md:flex-row md:items-center">
        <WorkflowNode label="Trigger" value="Call outcome = No answer" />
        <Arrow />
        <WorkflowNode label="Condition" value="Attempts < 3" />
        <Arrow />
        <div className="flex flex-1 flex-col gap-2">
          <WorkflowNode label="Action" value="Create callback task" />
          <WorkflowNode label="Action" value="Notify the owner" />
        </div>
      </div>

      <div className="mt-3 divide-y border text-[12px]">
        {[
          ["Last run", "12 seconds ago"],
          ["Runs today", "47"],
          ["Success rate", "100%"],
        ].map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-2">
            <span className="text-muted-foreground">{label}</span>
            <span className="tabular font-medium">{value}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Check className="size-3.5 text-success" />
        Runs automatically on every call outcome.
      </p>
    </div>
  )
}

function CallPane() {
  return (
    <div className="p-4">
      <div className="flex items-center gap-2">
        <PhoneIncoming className="size-4 text-muted-foreground" />
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">Inbound · +1 (415) 555-0132</p>
          <p className="tabular text-[11px] text-muted-foreground">2m 14s · Aria — Sales</p>
        </div>
        <Badge variant="success" className="ml-auto">Qualified</Badge>
      </div>

      <div className="mt-3 divide-y border">
        {[
          ["AI", "Happy to help — are you still comparing vendors?"],
          ["Caller", "Yes, we need after-hours coverage."],
          ["AI", "Got it. I can book a walkthrough for Thursday at 10."],
        ].map(([speaker, line], i) => (
          <div key={i} className="flex gap-3 px-3 py-2">
            <span className="w-10 shrink-0 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {speaker}
            </span>
            <p className="text-[12px] leading-relaxed">{line}</p>
          </div>
        ))}
      </div>

      <div className="mt-3 border p-3">
        <MiniLabel>AI summary</MiniLabel>
        <p className="mt-1 text-[12px] leading-relaxed">
          Buyer needs after-hours coverage. Budget confirmed, walkthrough booked for Thursday.
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge variant="success">Positive</Badge>
          <Badge variant="secondary">Budget confirmed</Badge>
          <Badge variant="secondary">Demo booked</Badge>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between text-[11px]">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Play className="size-3" />
          Recording · 2m 14s
        </span>
        <span className="flex items-center gap-1.5 font-medium">
          <Check className="size-3.5 text-success" />
          Follow-up task created
        </span>
      </div>
    </div>
  )
}

function DemoWindow() {
  return (
    <div className="overflow-hidden border bg-background text-left shadow-sm">
      <div className="flex h-9 items-center gap-1.5 border-b bg-muted/60 px-3">
        <span className="size-2 bg-border" />
        <span className="size-2 bg-border" />
        <span className="size-2 bg-border" />
        <span className="ml-2 hidden truncate border bg-background px-2 py-0.5 text-[11px] text-muted-foreground sm:block">
          app.cally-io.com
        </span>
        <Badge variant="secondary" className="ml-auto">Preview</Badge>
      </div>
      <Tabs defaultValue="live">
        <div className="border-b px-2 py-2">
          <TabsList className="h-auto w-full justify-start gap-1 overflow-x-auto bg-transparent p-0">
            {[
              ["live", "Live ops"],
              ["agent", "AI agent"],
              ["campaign", "Campaign"],
              ["workflow", "Workflow"],
              ["call", "Call detail"],
            ].map(([value, label]) => (
              <TabsTrigger
                key={value}
                value={value}
                className="h-7 shrink-0 px-3 text-xs data-[state=active]:bg-secondary data-[state=active]:shadow-none"
              >
                {label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>
        <div className="min-h-[400px]">
          <TabsContent value="live" className="m-0">
            <LiveOpsPane />
          </TabsContent>
          <TabsContent value="agent" className="m-0">
            <AgentPane />
          </TabsContent>
          <TabsContent value="campaign" className="m-0">
            <CampaignPane />
          </TabsContent>
          <TabsContent value="workflow" className="m-0">
            <WorkflowPane />
          </TabsContent>
          <TabsContent value="call" className="m-0">
            <CallPane />
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}

/* ------------------------------------------------------- feature visuals */

function MiniAgentVisual() {
  return (
    <div className="flex items-center gap-2">
      <span className="flex size-7 items-center justify-center bg-foreground text-[10px] font-semibold text-background">
        AR
      </span>
      <div className="min-w-0">
        <p className="truncate text-[11px] font-medium">Aria</p>
        <p className="text-[10px] text-muted-foreground">Sales · active</p>
      </div>
      <Waveform live className="ml-auto scale-75" />
    </div>
  )
}

function MiniLifecycleVisual() {
  return (
    <div className="flex items-center gap-1 text-[10px] font-medium">
      <span className="border px-1.5 py-0.5 text-muted-foreground">Ringing</span>
      <ChevronRight className="size-3 text-muted-foreground" />
      <span className="border border-success/40 bg-success/10 px-1.5 py-0.5 text-success">Connected</span>
      <ChevronRight className="size-3 text-muted-foreground" />
      <span className="border px-1.5 py-0.5 text-muted-foreground">Wrapped</span>
    </div>
  )
}

function MiniProgressVisual() {
  return (
    <div className="w-full">
      <div className="flex items-baseline justify-between text-[10px]">
        <span className="text-muted-foreground">Dialed</span>
        <span className="tabular font-semibold">744 / 1,200</span>
      </div>
      <div className="mt-1.5 h-1.5 w-full bg-secondary">
        <div className="h-full w-[62%] bg-foreground" />
      </div>
    </div>
  )
}

function MiniWorkflowVisual() {
  return (
    <div className="flex w-full items-center gap-1 text-[10px]">
      <span className="flex-1 border px-1.5 py-1 text-center">No answer</span>
      <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
      <span className="flex-1 border px-1.5 py-1 text-center">Attempt &lt; 3</span>
      <ChevronRight className="size-3 shrink-0 text-muted-foreground" />
      <span className="flex-1 border px-1.5 py-1 text-center">Callback</span>
    </div>
  )
}

function MiniTranscriptVisual() {
  return (
    <div className="w-full space-y-1.5">
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 bg-success" />
        <span className="h-1.5 w-4/5 bg-secondary" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 bg-muted-foreground" />
        <span className="h-1.5 w-3/5 bg-secondary" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="size-1.5 bg-success" />
        <span className="h-1.5 w-2/3 bg-secondary" />
      </div>
    </div>
  )
}

function MiniRolesVisual() {
  return (
    <div className="flex flex-wrap gap-1 text-[10px] font-medium">
      {["Owner", "Admin", "Manager", "Agent"].map((role) => (
        <span key={role} className="border px-1.5 py-0.5 text-muted-foreground">
          {role}
        </span>
      ))}
    </div>
  )
}

const features = [
  {
    icon: Bot,
    title: "AI voice agents",
    description: "Answer, qualify, and book on their own.",
    visual: <MiniAgentVisual />,
  },
  {
    icon: PhoneCall,
    title: "Calling engine",
    description: "Every call from ringing to wrap-up.",
    visual: <MiniLifecycleVisual />,
  },
  {
    icon: Target,
    title: "Campaigns",
    description: "Consent, hours, retries handled for you.",
    visual: <MiniProgressVisual />,
  },
  {
    icon: Workflow,
    title: "Workflow automation",
    description: "Outcomes turn into tasks automatically.",
    visual: <MiniWorkflowVisual />,
  },
  {
    icon: BrainCircuit,
    title: "Conversation intelligence",
    description: "Transcript, summary, and sentiment per call.",
    visual: <MiniTranscriptVisual />,
  },
  {
    icon: ShieldCheck,
    title: "Roles and permissions",
    description: "Every screen respects the signed-in role.",
    visual: <MiniRolesVisual />,
  },
]

function Features() {
  return (
    <section id="product" className="w-full py-16 md:py-24">
      <div className="container px-4 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">See how each piece works</h2>
        </div>
        <div className="mx-auto grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="flex flex-col border bg-card">
              <div className="bg-gradient-cream flex min-h-24 items-center justify-center border-b p-4">
                {feature.visual}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2">
                  <feature.icon className="size-4 text-muted-foreground" />
                  <h3 className="text-sm font-semibold">{feature.title}</h3>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{feature.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const flowSteps = [
  {
    title: "Import contacts",
    description: "CSV or manual, with consent flags.",
  },
  {
    title: "Build an agent",
    description: "Role, script, and knowledge base.",
  },
  {
    title: "Launch a campaign",
    description: "Audience, hours, retry rules.",
  },
  {
    title: "Automate the follow-up",
    description: "Outcomes become tasks and alerts.",
  },
]

function Flow() {
  return (
    <section id="flow" className="w-full border-t bg-muted py-16 md:py-20">
      <div className="container px-4 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">Four steps, then it runs</h2>
        </div>
        <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {flowSteps.map((step, i) => (
            <div key={step.title} className="flex gap-3 border bg-card p-4">
              <span className="tabular flex size-7 shrink-0 items-center justify-center bg-foreground text-xs font-semibold text-background">
                {i + 1}
              </span>
              <div>
                <h3 className="text-sm font-semibold">{step.title}</h3>
                <p className="mt-1 text-xs text-muted-foreground">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const roles = [
  { title: "Owner", capabilities: ["Billing", "Members", "All capabilities"] },
  { title: "Admin", capabilities: ["Agents", "Campaigns", "Members"] },
  { title: "Manager", capabilities: ["Campaigns", "Workflows", "Live ops"] },
  { title: "Supervisor", capabilities: ["Live calls", "Reviews", "Labels"] },
  { title: "Agent", capabilities: ["Dialer", "Contacts", "Tasks"] },
  { title: "Analyst", capabilities: ["Analytics", "Exports", "Read-only"] },
]

function Roles() {
  return (
    <section id="roles" className="w-full border-t py-16 md:py-20">
      <div className="container px-4 md:px-6">
        <div className="mx-auto mb-10 max-w-2xl text-center">
          <h2 className="text-3xl font-semibold md:text-4xl">Built for the whole floor</h2>
        </div>
        <div className="mx-auto grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => (
            <div key={role.title} className="border bg-card p-4">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold">{role.title}</h3>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {role.capabilities.map((capability) => (
                  <Badge key={capability} variant="secondary" className="font-normal">
                    {capability}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function CtaSection() {
  return (
    <section id="cta" className="w-full">
      <div className="bg-foreground text-background">
        <div className="container flex flex-col items-start justify-between gap-6 px-4 py-14 md:flex-row md:items-center md:px-6">
          <div>
            <h2 className="text-2xl font-semibold md:text-3xl">Put your first AI agent on the phone</h2>
            <p className="mt-2 text-sm opacity-70">Free to start. No credit card.</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/signup" prefetch={false}>
                Create free account
                <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-background/30 bg-transparent text-background hover:bg-background/10 hover:text-background"
            >
              <Link href="/login" prefetch={false}>
                Log in
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}

function Footer() {
  const columns = [
    { title: "Product", links: ["AI agents", "Calling", "Campaigns", "Workflows"] },
    { title: "Company", links: ["About", "Careers", "Contact", "Blog"] },
    { title: "Legal", links: ["Terms of service", "Privacy policy", "Cookie policy"] },
  ]
  return (
    <footer className="border-t bg-background">
      <div className="container mx-auto grid grid-cols-1 gap-8 px-4 py-12 md:grid-cols-2 md:px-6 lg:grid-cols-4">
        <div className="flex flex-col gap-4">
          <Logo />
          <p className="max-w-xs text-sm text-muted-foreground">
            The automated call center, run by AI agents.
          </p>
        </div>
        {columns.map((column) => (
          <div key={column.title}>
            <h4 className="mb-4 text-sm font-semibold text-foreground">{column.title}</h4>
            <nav className="flex flex-col gap-2">
              {column.links.map((link) => (
                <Link key={link} href="#" className="text-sm text-muted-foreground hover:underline" prefetch={false}>
                  {link}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </div>
      <Separator />
      <div className="container mx-auto flex flex-col items-center justify-between gap-3 px-4 py-6 text-xs text-muted-foreground sm:flex-row md:px-6">
        <p>&copy; {new Date().getFullYear()} Cally-IO. All rights reserved.</p>
        <p>Next.js · Prisma · LangGraph · Gemini</p>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar />
      <main className="flex-1">
        <section className="bg-gradient-cream w-full pb-16 pt-14 md:pb-24 md:pt-20">
          <div className="container px-4 md:px-6">
            <div className="mx-auto max-w-3xl text-center">
              <h1 className="text-4xl sm:text-5xl md:text-6xl">
                The call center that runs itself
              </h1>
              <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
                AI agents dial, answer, qualify, and follow up — while you watch it live.
              </p>
              <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
                <Button asChild variant="brand" size="lg">
                  <Link href="/signup" prefetch={false}>
                    Start for free
                  </Link>
                </Button>
                <Button asChild size="lg">
                  <Link href="#demo" prefetch={false}>
                    See the product
                  </Link>
                </Button>
              </div>
            </div>

            <div id="demo" className="mx-auto mt-12 max-w-5xl scroll-mt-20">
              <DemoWindow />
            </div>
          </div>
        </section>
        <Features />
        <Flow />
        <Roles />
        <CtaSection />
      </main>
      <Footer />
    </div>
  )
}
