'use client'

import React, { useState, useCallback } from "react";
import { DocumentList } from '@/components/knowledge-base/document-list';
import { FileUploader } from '@/components/knowledge-base/file-uploader';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function KnowledgeBasePage() {
  const [refreshKey, setRefreshKey] = useState(0);

  const handleUploadComplete = useCallback(() => {
    setRefreshKey(prevKey => prevKey + 1);
  }, []);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Data Sources</h1>
        <p className="text-muted-foreground">
          Manage your documents to provide context to the AI analyst.
        </p>
      </header>
      
      <div className="grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-2">
            <Card>
                <CardHeader>
                    <CardTitle>Upload Documents</CardTitle>
                    <CardDescription>
                        Upload CSVs, PDFs, or text files to Appwrite.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <FileUploader onUploadComplete={handleUploadComplete} />
                </CardContent>
            </Card>
        </div>

        <div className="lg:col-span-3">
           <DocumentList key={refreshKey} />
        </div>
      </div>
    </div>
  );
}
