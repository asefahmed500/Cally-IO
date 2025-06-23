import { DocumentList } from '@/components/knowledge-base/document-list';
import { FileUploader } from '@/components/knowledge-base/file-uploader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function KnowledgeBasePage() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Knowledge Base</h1>
        <p className="text-muted-foreground">
          Manage your company's documents to train the AI agent.
        </p>
      </header>
      
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Upload Documents</CardTitle>
                    <CardDescription>
                        Upload PDFs, Word documents, or text files.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader />
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-3">
           <DocumentList />
        </div>
      </div>
    </div>
  );
}
