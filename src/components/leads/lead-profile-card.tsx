import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { Lead } from "@/app/leads/page";
import { User, Star, Activity, Calendar, ClipboardList, Phone, Building, Briefcase, StickyNote } from 'lucide-react';
import { Separator } from "../ui/separator";

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) {
    if (!value) return null;
    return (
        <div className="flex items-start gap-4">
            <Icon className="h-5 w-5 text-muted-foreground mt-1 shrink-0" />
            <div className="flex flex-col">
                <span className="text-sm text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
            </div>
        </div>
    );
}

export function LeadProfileCard({ lead }: { lead: Lead }) {
  return (
    <Card className="border-none shadow-none">
        <CardHeader>
            <CardTitle className="flex items-center gap-3">
                <User className="w-8 h-8 p-1.5 bg-muted rounded-full" /> {lead.name}
            </CardTitle>
            <CardDescription>{lead.email}</CardDescription>
        </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
            <InfoRow 
                icon={ClipboardList}
                label="Status"
                value={lead.status}
            />
            <InfoRow 
                icon={Star}
                label="Lead Score"
                value={lead.score}
            />
             <InfoRow 
                icon={Phone}
                label="Phone"
                value={lead.phone || 'N/A'}
            />
            <InfoRow 
                icon={Building}
                label="Company"
                value={lead.company || 'N/A'}
            />
             <InfoRow 
                icon={Briefcase}
                label="Job Title"
                value={lead.jobTitle || 'N/A'}
            />
        </div>
        <Separator />
         <InfoRow 
            icon={StickyNote}
            label="Notes"
            value={lead.notes ? <p className="whitespace-pre-wrap">{lead.notes}</p> : 'No notes'}
        />
        <Separator />
        <div className="grid grid-cols-2 gap-4 text-sm">
             <InfoRow 
                icon={Activity}
                label="Last Activity"
                value={new Date(lead.lastActivity).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            />
            <InfoRow 
                icon={Calendar}
                label="Date Created"
                value={new Date(lead.$createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
            />
        </div>
      </CardContent>
    </Card>
  );
}
