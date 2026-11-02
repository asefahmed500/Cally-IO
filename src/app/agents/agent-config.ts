import { z } from 'zod';

/**
 * AI Agent configuration schema — versioned as JSON on AIAgentVersion.config.
 * Capabilities gate which tools/behaviors the LangGraph runtime enables.
 * Plain module (not 'use server') so client components can import the type.
 */
export const AgentConfigSchema = z.object({
  identity: z.object({
    name: z.string().min(2).max(60),
    description: z.string().max(400).optional().default(''),
    purpose: z.string().max(400).optional().default(''),
    department: z.string().max(60).optional().default(''),
    language: z.string().default('en-US'),
  }),
  personality: z.object({
    tone: z.string().max(200).default('Professional and friendly'),
    style: z.string().max(200).default('Conversational but efficient'),
    speakingSpeed: z.enum(['slow', 'normal', 'fast']).default('normal'),
    greeting: z.string().max(600).default('Hello! How can I help you today?'),
    conversationRules: z.string().max(2000).optional().default(''),
    escalationBehavior: z.string().max(600).default('Politely offer to transfer to a human colleague.'),
  }),
  voice: z.object({
    provider: z.enum(['GEMINI_TTS', 'TWILIO']).default('GEMINI_TTS'),
    voiceName: z.string().default('Algenib'),
    speechRate: z.number().min(0.5).max(2).default(1),
  }),
  knowledge: z.object({
    sourceIds: z.array(z.string()).default([]),
    useWorkspaceFaqs: z.boolean().default(true),
  }),
  capabilities: z.object({
    answerFaqs: z.boolean().default(true),
    qualifyLeads: z.boolean().default(true),
    captureContactDetails: z.boolean().default(true),
    scheduleAppointments: z.boolean().default(false),
    createCrmRecords: z.boolean().default(true),
    createFollowUpTasks: z.boolean().default(false),
    transferToHuman: z.boolean().default(true),
    triggerWorkflows: z.boolean().default(false),
  }),
  callConfig: z.object({
    direction: z.enum(['INBOUND', 'OUTBOUND', 'BOTH']).default('OUTBOUND'),
    maxDurationMinutes: z.number().min(1).max(60).default(10),
    recordCalls: z.boolean().default(true),
    disclosureEnabled: z.boolean().default(true),
    transferDestination: z.string().max(40).optional().default(''),
  }),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
