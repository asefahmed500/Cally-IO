// Serialized Lead shape passed between server and client components.
// `$id` / `$createdAt` follow the historical naming used across the UI.
// Stage values map to the LeadStage enum in prisma/schema.prisma.
export type LeadStage =
  | 'NEW'
  | 'CONTACTED'
  | 'QUALIFIED'
  | 'FOLLOW_UP'
  | 'PROPOSAL'
  | 'WON'
  | 'LOST';

export interface Lead {
  $id: string;
  contactId: string;
  userId: string | null;
  name: string;
  email: string;
  phone?: string;
  company?: string;
  jobTitle?: string;
  notes?: string;
  status: LeadStage;
  score: number;
  lastActivity: string; // ISO date string
  agentId: string | null;
  followUpDate?: string; // ISO date string
  followUpNotes?: string;
  $createdAt: string; // ISO date string
}
