import type { MemberRole } from '@prisma/client';

/**
 * Central capability map — the single source of truth for what each workspace
 * role may do. Enforced in server actions, route handlers, and navigation.
 * See ARCHITECTURE.md §3.
 */

export const CAPABILITIES = [
  // Workspace administration
  'workspace.manage',
  'workspace.delete',
  'members.invite',
  'members.manage',
  'billing.manage',
  'integrations.manage',
  'audit.view',

  // Operations
  'liveops.monitor',
  'calls.view',
  'calls.initiate',
  'calls.manage',
  'recordings.view',

  // AI workforce
  'agents.view',
  'agents.manage',
  'knowledge.view',
  'knowledge.manage',
  'ai.manage', // publish/pause agents

  // CRM
  'contacts.view',
  'contacts.write',
  'leads.view',
  'leads.write',
  'tasks.view',
  'tasks.write',
  'campaigns.view',
  'campaigns.manage',

  // Automation
  'workflows.view',
  'workflows.manage',

  // Insights
  'analytics.view',
  'reports.export',
] as const;

export type Capability = (typeof CAPABILITIES)[number];

const ALL: Capability[] = [...CAPABILITIES];

const WORKSPACE_OWNER: Capability[] = ALL;

const ADMIN: Capability[] = ALL.filter(
  (c) => c !== 'billing.manage' && c !== 'workspace.delete'
);

const MANAGER: Capability[] = [
  'liveops.monitor',
  'calls.view',
  'calls.initiate',
  'calls.manage',
  'recordings.view',
  'agents.view',
  'knowledge.view',
  'contacts.view',
  'contacts.write',
  'leads.view',
  'leads.write',
  'tasks.view',
  'tasks.write',
  'campaigns.view',
  'campaigns.manage',
  'workflows.view',
  'analytics.view',
  'reports.export',
  'members.invite',
];

const SUPERVISOR: Capability[] = [
  'liveops.monitor',
  'calls.view',
  'calls.manage',
  'recordings.view',
  'agents.view',
  'knowledge.view',
  'contacts.view',
  'contacts.write',
  'leads.view',
  'leads.write',
  'tasks.view',
  'tasks.write',
  'campaigns.view',
  'workflows.view',
  'analytics.view',
];

const HUMAN_AGENT: Capability[] = [
  'calls.view',
  'calls.initiate',
  'recordings.view',
  'agents.view',
  'knowledge.view',
  'contacts.view',
  'contacts.write',
  'leads.view',
  'leads.write',
  'tasks.view',
  'tasks.write',
  'campaigns.view',
];

const AI_AGENT: Capability[] = [
  'calls.view',
  'contacts.view',
  'contacts.write',
  'leads.view',
  'leads.write',
  'tasks.view',
  'tasks.write',
  'knowledge.view',
];

const ANALYST: Capability[] = [
  'calls.view',
  'recordings.view',
  'agents.view',
  'contacts.view',
  'leads.view',
  'tasks.view',
  'campaigns.view',
  'workflows.view',
  'analytics.view',
  'reports.export',
];

const ROLE_CAPABILITIES: Record<MemberRole, Capability[]> = {
  WORKSPACE_OWNER,
  ADMIN,
  MANAGER,
  SUPERVISOR,
  HUMAN_AGENT,
  AI_AGENT,
  ANALYST,
};

export function can(role: MemberRole, capability: Capability): boolean {
  return ROLE_CAPABILITIES[role]?.includes(capability) ?? false;
}

export function canAny(role: MemberRole, capabilities: Capability[]): boolean {
  return capabilities.some((c) => can(role, c));
}
