import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LearningPanel } from './chat-panel';
import React from "react";

export default async function LearningStudioPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <React.Fragment>
       <header className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Learning Studio</h1>
        <p className="text-muted-foreground">Your personal space to explore and learn new things.</p>
      </header>
      <LearningPanel />
    </React.Fragment>
  );
}
