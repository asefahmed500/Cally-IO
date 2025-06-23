import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadList } from "@/components/leads/lead-list";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Lead Management</h1>
        <p className="text-muted-foreground">
          View, manage, and score your sales leads.
        </p>
      </header>
      
      <Suspense fallback={<Skeleton className="h-96 w-full" />}>
        <LeadList />
      </Suspense>
    </div>
  )
}
