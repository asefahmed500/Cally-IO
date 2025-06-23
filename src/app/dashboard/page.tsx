import { getLoggedInUser } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeadList } from "@/components/dashboard/lead-list";

export default async function DashboardPage() {
  const user = await getLoggedInUser();
  if (!user) {
    redirect("/login");
  }

  // In a real application, you would fetch these leads from your database.
  const mockLeads = [
    {
      id: "1",
      name: "Alice Johnson",
      title: "CTO",
      company: "Innovate Inc.",
      companyDescription: "A leading provider of cloud-based enterprise solutions.",
      score: 92,
      status: "Hot",
    },
    {
      id: "2",
      name: "Bob Williams",
      title: "Marketing Director",
      company: "Growth Co.",
      companyDescription: "A fast-growing startup in the digital marketing space.",
      score: 85,
      status: "Warm",
    },
    {
        id: "3",
        name: "Charlie Brown",
        title: "Product Manager",
        company: "Synergy Corp.",
        companyDescription: "Develops productivity software for remote teams.",
        score: 78,
        status: "Warm",
    },
    {
        id: "4",
        name: "Diana Miller",
        title: "VP of Sales",
        company: "Solutions LLC",
        companyDescription: "Offers bespoke software development services for the finance industry.",
        score: 65,
        status: "Cold",
    }
  ];

  return (
    <div className="flex flex-col gap-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight">Lead Dashboard</h1>
        <p className="text-muted-foreground">
          Manage and engage with your qualified leads.
        </p>
      </header>
      
      <LeadList leads={mockLeads} />
    </div>
  )
}
