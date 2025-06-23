import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { BriefingPanel } from './chat-panel';
import React from "react";

export default async function BriefingPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <React.Fragment>
       <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your News Briefing</h1>
        <p className="text-muted-foreground">Generate a personalized summary of today's top stories.</p>
      </header>
      <BriefingPanel />
    </React.Fragment>
  );
}
