import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadManager } from "@/components/leads/lead-manager";

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Welcome to LeadKit, {user.name}!</h1>
        <p className="text-muted-foreground">
          Your AI-powered sales co-pilot.
        </p>
      </header>

      <LeadManager />
    </div>
  )
}
