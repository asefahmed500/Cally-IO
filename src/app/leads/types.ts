
import type { Models } from "node-appwrite";

export interface Lead extends Models.Document {
    userId: string | null; // Can be null for manually created leads
    name: string;
    email: string;
    phone?: string;
    company?: string;
    jobTitle?: string;
    notes?: string;
    status: 'New' | 'Qualified' | 'Called' | 'Converted';
    score: number;
    lastActivity: string;
    agentId: string | null; // The agent who owns this lead
    followUpDate?: string;
    followUpNotes?: string;
}
