import { getLoggedInUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, MessageSquarePlus } from 'lucide-react';
import { DocumentList } from '@/components/knowledge/document-list';
import { FaqManager } from '@/components/knowledge/faq-manager';
import { getFaqs } from './actions';
import { ContentSuggestions } from '@/components/knowledge/content-suggestions';
import { PageHeader } from '@/components/layout/page-header';

// Serialized document shape consumed by <DocumentList/>.
export interface KnowledgeDocument {
  documentId: string;
  fileName: string;
  userId: string;
  $createdAt: string;
}

async function getKnowledgeDocuments(user: {
  $id: string;
  labels: string[];
}): Promise<KnowledgeDocument[]> {
  const isAdmin = user.labels.includes('admin');

  try {
    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.$id },
      orderBy: { createdAt: 'asc' },
      select: { workspaceId: true },
    });

    const documents = await prisma.knowledgeSource.findMany({
      where: isAdmin
        ? {}
        : membership
          ? { OR: [{ workspaceId: membership.workspaceId }, { workspaceId: null }] }
          : { workspaceId: null },
      orderBy: { createdAt: 'desc' },
      take: 500,
    });

    return documents.map((doc) => ({
      documentId: doc.id,
      fileName: doc.name,
      userId: doc.workspaceId ?? 'Shared',
      $createdAt: doc.createdAt.toISOString(),
    }));
  } catch (e) {
    console.error('Failed to fetch knowledge documents:', e);
    return [];
  }
}

export default async function KnowledgePage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect('/login');
  }

  const isAdmin = user.labels.includes('admin');

  const [documents, faqs] = await Promise.all([
    getKnowledgeDocuments(user),
    isAdmin ? getFaqs() : Promise.resolve([]),
  ]);

  return (
    <div className="space-y-8">
      <PageHeader
        title={isAdmin ? 'Knowledge hub' : 'My documents'}
        description={
          isAdmin
            ? "Oversee, manage, and analyze your AI's knowledge base."
            : "Manage the documents you've uploaded to the AI."
        }
      />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen /> {isAdmin ? 'All Documents' : 'My Uploaded Documents'}
          </CardTitle>
          <CardDescription>
            {isAdmin
              ? 'A list of all documents uploaded by users across the platform.'
              : 'A list of all documents you have uploaded.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DocumentList documents={documents} isAdmin={isAdmin} />
        </CardContent>
      </Card>

      {isAdmin && (
        <div className="grid gap-8 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquarePlus /> FAQ Management
              </CardTitle>
              <CardDescription>
                Create and manage a library of frequently asked questions for the AI to use as its
                primary source of truth.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <FaqManager initialFaqs={faqs} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Content suggestions</CardTitle>
              <CardDescription>
                Get AI-powered suggestions for new knowledge base content based on unanswered user
                questions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ContentSuggestions />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
