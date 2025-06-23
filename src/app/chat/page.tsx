import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { ContentPanel } from './content-panel';
import React from "react";

export default async function ContentStudioPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <React.Fragment>
       <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Content Studio</h1>
        <p className="text-muted-foreground">Your AI-powered content creation workspace.</p>
      </header>
      <ContentPanel />
    </React.Fragment>
  );
}
