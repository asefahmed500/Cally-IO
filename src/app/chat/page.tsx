import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { AnalysisPanel } from './analysis-panel';
import React from "react";

export default async function AnalysisStudioPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <React.Fragment>
       <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Analysis Studio</h1>
        <p className="text-muted-foreground">Your AI-powered business intelligence workspace.</p>
      </header>
      <AnalysisPanel />
    </React.Fragment>
  );
}
