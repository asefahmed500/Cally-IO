'use server';

import { prisma } from '@/lib/prisma';
import { requireWorkspace, requireCapability } from '@/lib/tenant';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { Contact, Priority, ConsentStatus } from '@prisma/client';

export type ContactDto = {
  $id: string;
  name: string;
  phone?: string;
  email?: string;
  company?: string;
  jobTitle?: string;
  source?: string;
  tags: string[];
  ownerId?: string;
  ownerName?: string;
  priority: Priority;
  consentStatus: ConsentStatus;
  lastContactedAt?: string;
  nextFollowUpAt?: string;
  notes?: string;
  createdAt: string;
};

function toDto(contact: Contact & { owner?: { name: string } | null }): ContactDto {
  return {
    $id: contact.id,
    name: contact.name,
    phone: contact.phone ?? undefined,
    email: contact.email ?? undefined,
    company: contact.company ?? undefined,
    jobTitle: contact.jobTitle ?? undefined,
    source: contact.source ?? undefined,
    tags: contact.tags,
    ownerId: contact.ownerId ?? undefined,
    ownerName: contact.owner?.name,
    priority: contact.priority,
    consentStatus: contact.consentStatus,
    lastContactedAt: contact.lastContactedAt?.toISOString(),
    nextFollowUpAt: contact.nextFollowUpAt?.toISOString(),
    notes: contact.notes ?? undefined,
    createdAt: contact.createdAt.toISOString(),
  };
}

export type ContactFilters = {
  search?: string;
  priority?: Priority | 'ALL';
  consent?: ConsentStatus | 'ALL';
  mineOnly?: boolean;
  page?: number;
  pageSize?: number;
};

export async function getContacts(filters: ContactFilters = {}): Promise<{
  contacts: ContactDto[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const ctx = await requireWorkspace();
  const page = Math.max(1, filters.page ?? 1);
  const pageSize = Math.min(100, Math.max(10, filters.pageSize ?? 25));

  const where: Record<string, unknown> = { workspaceId: ctx.workspaceId, deletedAt: null };
  if (filters.search) {
    const q = filters.search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { email: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q } },
      { company: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (filters.priority && filters.priority !== 'ALL') where.priority = filters.priority;
  if (filters.consent && filters.consent !== 'ALL') where.consentStatus = filters.consent;
  if (filters.mineOnly) where.ownerId = ctx.user.$id;

  const [contacts, total] = await Promise.all([
    prisma.contact.findMany({
      where,
      include: { owner: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.contact.count({ where }),
  ]);

  return { contacts: contacts.map(toDto), total, page, pageSize };
}

const ContactSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, 'Name must be at least 2 characters.').max(120),
  phone: z.string().optional(),
  email: z.string().email('Please enter a valid email address.').optional().or(z.literal('')),
  company: z.string().optional(),
  jobTitle: z.string().optional(),
  source: z.string().optional(),
  tags: z.string().optional(), // comma-separated in the form
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  consentStatus: z.enum(['UNKNOWN', 'GRANTED', 'DENIED', 'OPTED_OUT']).default('UNKNOWN'),
  notes: z.string().optional(),
});

export async function saveContact(prevState: any, formData: FormData) {
  const ctx = await requireCapability('contacts.write');

  const validated = ContactSchema.safeParse({
    id: formData.get('id') || undefined,
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    company: formData.get('company') || undefined,
    jobTitle: formData.get('jobTitle') || undefined,
    source: formData.get('source') || undefined,
    tags: formData.get('tags') || undefined,
    priority: formData.get('priority') || 'MEDIUM',
    consentStatus: formData.get('consentStatus') || 'UNKNOWN',
    notes: formData.get('notes') || undefined,
  });

  if (!validated.success) {
    return {
      status: 'error',
      message: 'Please check the form.',
      errors: validated.error.flatten().fieldErrors,
    };
  }

  const { id, tags, email, phone, ...data } = validated.data;
  const tagList = tags
    ? tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12)
    : [];

  try {
    // Duplicate detection: same phone or email within the workspace.
    const duplicateWhere = {
      workspaceId: ctx.workspaceId,
      deletedAt: null,
      ...(id ? { id: { not: id } } : {}),
      OR: [
        ...(phone ? [{ phone }] : []),
        ...(email ? [{ email: email.toLowerCase() }] : []),
      ],
    };
    if (phone || email) {
      const duplicate = await prisma.contact.findFirst({ where: duplicateWhere });
      if (duplicate) {
        return {
          status: 'error',
          message: `Duplicate: a contact with the same ${duplicate.phone === phone && phone ? 'phone number' : 'email'} already exists ("${duplicate.name}").`,
        };
      }
    }

    const payload = {
      ...data,
      phone: phone ?? null,
      email: email ? email.toLowerCase() : null,
      tags: tagList,
    };

    if (id) {
      const existing = await prisma.contact.findFirst({
        where: { id, workspaceId: ctx.workspaceId, deletedAt: null },
      });
      if (!existing) return { status: 'error', message: 'Contact not found.' };
      await prisma.contact.update({ where: { id }, data: payload });
    } else {
      await prisma.contact.create({
        data: { ...payload, workspaceId: ctx.workspaceId, ownerId: ctx.user.$id },
      });
    }

    revalidatePath('/contacts');
    return { status: 'success', message: `Contact ${id ? 'updated' : 'created'}.` };
  } catch (e: any) {
    console.error('Failed to save contact:', e);
    return { status: 'error', message: 'A database error occurred. Please try again.' };
  }
}

export async function deleteContact(contactId: string) {
  const ctx = await requireCapability('contacts.write');
  try {
    // Soft delete.
    const result = await prisma.contact.updateMany({
      where: { id: contactId, workspaceId: ctx.workspaceId, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    if (result.count === 0) return { error: 'Contact not found.' };
    revalidatePath('/contacts');
    return { success: true };
  } catch (e: any) {
    console.error('Failed to delete contact:', e);
    return { error: 'A database error occurred. Please try again.' };
  }
}

/** CSV export: all non-deleted contacts for the active workspace. */
export async function exportContactsCsv(): Promise<{ csv: string | null; error?: string }> {
  try {
    const ctx = await requireCapability('reports.export');
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: ctx.workspaceId, deletedAt: null },
      include: { owner: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take: 5000,
    });

    const header = 'Name,Phone,Email,Company,Job Title,Source,Tags,Owner,Priority,Consent,Notes,Created At';
    const rows = contacts.map((c) =>
      [
        c.name,
        c.phone ?? '',
        c.email ?? '',
        c.company ?? '',
        c.jobTitle ?? '',
        c.source ?? '',
        c.tags.join(';'),
        c.owner?.name ?? '',
        c.priority,
        c.consentStatus,
        (c.notes ?? '').replace(/[\r\n,]+/g, ' '),
        c.createdAt.toISOString(),
      ]
        .map((v) => `"${String(v).replace(/"/g, '""')}"`)
        .join(',')
    );
    return { csv: [header, ...rows].join('\n') };
  } catch (e: any) {
    return { csv: null, error: 'Could not export contacts. Please try again.' };
  }
}

const IMPORT_ROW_SCHEMA = z.object({
  Name: z.string().min(1),
  Phone: z.string().optional().default(''),
  Email: z.string().optional().default(''),
  Company: z.string().optional().default(''),
  JobTitle: z.string().optional().default(''),
  Source: z.string().optional().default(''),
  Tags: z.string().optional().default(''),
  Notes: z.string().optional().default(''),
});

export type ImportResult = {
  imported: number;
  skippedDuplicates: number;
  errors: string[];
};

/** Guards against oversized or runaway imports before any parsing work. */
const MAX_CSV_BYTES = 2 * 1024 * 1024;
const MAX_CSV_ROWS = 1000;
const MAX_CELL_LENGTH = 500;

/** CSV import with per-row validation and duplicate skipping. */
export async function importContactsCsv(csv: string): Promise<ImportResult> {
  const ctx = await requireCapability('contacts.write');
  const result: ImportResult = { imported: 0, skippedDuplicates: 0, errors: [] };

  if (typeof csv !== 'string' || csv.trim().length === 0) {
    result.errors.push('No CSV content was provided.');
    return result;
  }
  if (Buffer.byteLength(csv, 'utf8') > MAX_CSV_BYTES) {
    result.errors.push(
      `CSV exceeds the ${Math.round(MAX_CSV_BYTES / 1024 / 1024)}MB upload limit. Split the file and retry.`
    );
    return result;
  }

  const lines = csv.trim().split(/\r?\n/);
  if (lines.length < 2) {
    result.errors.push('CSV must include a header row and at least one data row.');
    return result;
  }
  if (lines.length - 1 > MAX_CSV_ROWS) {
    result.errors.push(`CSV has ${lines.length - 1} rows; the limit is ${MAX_CSV_ROWS} per import.`);
    return result;
  }

  const parseCsvLine = (line: string): string[] => {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          cur += ch;
        }
      } else if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        out.push(cur);
        cur = '';
      } else {
        cur += ch;
      }
    }
    out.push(cur);
    return out.map((cell) => (cell.length > MAX_CELL_LENGTH ? cell.slice(0, MAX_CELL_LENGTH) : cell));
  };

  const headers = parseCsvLine(lines[0]).map((h) => h.trim());
  const nameIdx = headers.findIndex((h) => /^name$/i.test(h));
  if (nameIdx === -1) {
    result.errors.push('CSV must contain a "Name" column.');
    return result;
  }
  const idx = (re: RegExp) => headers.findIndex((h) => re.test(h));

  const phoneIdx = idx(/^phone$/i);
  const emailIdx = idx(/^email$/i);
  const companyIdx = idx(/^company$/i);
  const jobTitleIdx = idx(/^job ?title$/i);
  const sourceIdx = idx(/^source$/i);
  const tagsIdx = idx(/^tags$/i);
  const notesIdx = idx(/^notes$/i);

  // Validate and build all rows first (no DB round trips per row).
  type ValidRow = {
    name: string;
    phone: string | null;
    email: string | null;
    company: string | null;
    jobTitle: string | null;
    source: string | null;
    tags: string[];
    notes: string | null;
  };
  const rows: ValidRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]);
    const row = {
      Name: cells[nameIdx]?.trim() ?? '',
      Phone: phoneIdx >= 0 ? cells[phoneIdx]?.trim() ?? '' : '',
      Email: emailIdx >= 0 ? cells[emailIdx]?.trim() ?? '' : '',
      Company: companyIdx >= 0 ? cells[companyIdx]?.trim() ?? '' : '',
      JobTitle: jobTitleIdx >= 0 ? cells[jobTitleIdx]?.trim() ?? '' : '',
      Source: sourceIdx >= 0 ? cells[sourceIdx]?.trim() ?? 'CSV Import' : 'CSV Import',
      Tags: tagsIdx >= 0 ? cells[tagsIdx]?.trim() ?? '' : '',
      Notes: notesIdx >= 0 ? cells[notesIdx]?.trim() ?? '' : '',
    };

    const parsed = IMPORT_ROW_SCHEMA.safeParse(row);
    if (!parsed.success) {
      result.errors.push(`Row ${i + 1}: missing or invalid Name.`);
      continue;
    }

    rows.push({
      name: row.Name,
      phone: row.Phone || null,
      email: row.Email ? row.Email.toLowerCase() : null,
      company: row.Company || null,
      jobTitle: row.JobTitle || null,
      source: row.Source || null,
      tags: row.Tags
        ? row.Tags.split(/[;|]/).map((t) => t.trim().toLowerCase()).filter(Boolean).slice(0, 12)
        : [],
      notes: row.Notes || null,
    });
  }

  // Pre-fetch existing phones/emails for this workspace in two queries, then
  // de-duplicate in memory (in-file duplicates included).
  const phones = rows.map((r) => r.phone).filter((p): p is string => p !== null);
  const emails = rows.map((r) => r.email).filter((e): e is string => e !== null);
  const [existingByPhone, existingByEmail] = await Promise.all([
    phones.length
      ? prisma.contact.findMany({
          where: { workspaceId: ctx.workspaceId, deletedAt: null, phone: { in: phones } },
          select: { phone: true },
        })
      : Promise.resolve([] as { phone: string | null }[]),
    emails.length
      ? prisma.contact.findMany({
          where: { workspaceId: ctx.workspaceId, deletedAt: null, email: { in: emails } },
          select: { email: true },
        })
      : Promise.resolve([] as { email: string | null }[]),
  ]);
  const existingPhones = new Set(existingByPhone.map((c) => c.phone));
  const existingEmails = new Set(existingByEmail.map((c) => c.email));

  const seenPhones = new Set<string>();
  const seenEmails = new Set<string>();
  const toInsert: ValidRow[] = [];

  for (const row of rows) {
    const dupeInFile =
      (row.phone && seenPhones.has(row.phone)) || (row.email && seenEmails.has(row.email));
    const dupeInDb =
      (row.phone && existingPhones.has(row.phone)) || (row.email && existingEmails.has(row.email));
    if (dupeInFile || dupeInDb) {
      result.skippedDuplicates++;
      continue;
    }
    if (row.phone) seenPhones.add(row.phone);
    if (row.email) seenEmails.add(row.email);
    toInsert.push(row);
  }

  // One atomic batch write — a failure leaves no half-imported file.
  if (toInsert.length > 0) {
    try {
      await prisma.$transaction(
        toInsert.map((row) =>
          prisma.contact.create({
            data: {
              workspaceId: ctx.workspaceId,
              name: row.name,
              phone: row.phone,
              email: row.email,
              company: row.company,
              jobTitle: row.jobTitle,
              source: row.source,
              tags: row.tags,
              notes: row.notes,
              ownerId: ctx.user.$id,
            },
          })
        )
      );
      result.imported = toInsert.length;
    } catch (e: unknown) {
      console.error('CSV import failed:', e);
      result.errors.push('Import failed while writing to the database. No rows were added — please retry.');
    }
  }

  revalidatePath('/contacts');
  return result;
}
