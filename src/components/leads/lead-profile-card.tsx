import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Lead } from "@/app/leads/page";
import { User, Mail, Star, Activity, Calendar } from 'lucide-react';

const statusColors: { [key: string]: 'default' | 'secondary' | 'success' | 'warning' } = {
  New: 'secondary',
  Qualified: 'warning',
  Contacted: 'default',
  Converted: 'success',
};

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType, label: string, value: React.ReactNode }) {
    return (
        <div className="flex items-start gap-3">
            <Icon className="h-5 w-5 text-muted-foreground mt-1" />
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
            <CardTitle className="flex items-center gap-2">
                <User /> {lead.name}
            </CardTitle>
            <CardDescription>{lead.email}</CardDescription>
        </CardHeader>
      <CardContent className="space-y-4">
        <InfoRow 
            icon={Badge}
            label="Status"
            value={<Badge variant={statusColors[lead.status] || 'default'}>{lead.status}</Badge>}
        />
        <InfoRow 
            icon={Star}
            label="Lead Score"
            value={lead.score}
        />
        <InfoRow 
            icon={Activity}
            label="Last Activity"
            value={new Date(lead.lastActivity).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        />
        <InfoRow 
            icon={Calendar}
            label="Signed Up"
            value={new Date(lead.$createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
        />
      </CardContent>
    </Card>
  );
}
