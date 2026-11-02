'use client'

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Delete, PhoneCall, Search, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useTransition } from 'react';
import { dialNumber } from '@/app/dialer/actions';
import type { ContactDto } from '@/app/contacts/actions';

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '*', '0', '#'];

export function Dialer({
  contacts,
  twilioConfigured,
  callerId,
}: {
  contacts: ContactDto[];
  twilioConfigured: boolean;
  callerId: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [number, setNumber] = React.useState('');
  const [search, setSearch] = React.useState('');
  const [isPending, startTransition] = useTransition();

  const filteredContacts = contacts
    .filter((c) => {
      const q = search.trim().toLowerCase();
      if (!q) return false;
      return (
        c.name.toLowerCase().includes(q) ||
        (c.phone ?? '').includes(q) ||
        (c.company ?? '').toLowerCase().includes(q)
      );
    })
    .slice(0, 6);

  const call = (target: string, contactId?: string) => {
    startTransition(async () => {
      const result = await dialNumber(target, contactId);
      if (result.success) {
        toast({
          title: 'Call placed',
          description: `The AI is dialing ${target}. Track progress in Call History.`,
        });
        setNumber('');
        router.refresh();
      } else {
        toast({ variant: 'destructive', title: 'Call failed', description: result.error });
      }
    });
  };

  const handleKey = (key: string) => setNumber((prev) => (prev + key).slice(0, 18));

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Keypad */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Manual dialer</CardTitle>
          <CardDescription>
            Outbound calls run through your AI flow (script + speech gather). Caller ID: {callerId}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="min-h-12 w-full border px-4 py-3 text-center text-xl font-medium tracking-widest">
            {number || <span className="text-muted-foreground">Enter a number</span>}
          </div>
          <div className="grid w-full max-w-64 grid-cols-3 gap-2">
            {KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => handleKey(key)}
                className="flex h-14 items-center justify-center border text-lg font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {key}
              </button>
            ))}
          </div>
          <div className="flex w-full max-w-64 items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setNumber((prev) => prev.slice(0, -1))}
              disabled={!number}
            >
              <Delete className="size-4" />
              <span className="sr-only">Delete digit</span>
            </Button>
            <Button
              variant="brand"
              className="flex-1"
              disabled={isPending || number.replace(/\D/g, '').length < 7}
              onClick={() => call(number)}
            >
              <PhoneCall />
              {isPending ? 'Dialing...' : 'Call'}
            </Button>
          </div>
          {!twilioConfigured && (
            <Alert variant="destructive" className="w-full">
              <AlertCircle className="size-4" />
              <AlertTitle>Twilio not configured</AlertTitle>
              <AlertDescription>
                Add TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN and TWILIO_PHONE_NUMBER to place real
                calls.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Contact search + click-to-call */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Click-to-call</CardTitle>
          <CardDescription>Search contacts and dial their saved number.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search contacts by name, phone, company..."
              className="pl-9"
            />
          </div>
          <div className="flex flex-col gap-2">
            {search.trim() && filteredContacts.length === 0 && (
              <p className="py-4 text-center text-sm text-muted-foreground">
                No matching contacts with phone numbers.
              </p>
            )}
            {filteredContacts.map((contact) => (
              <div key={contact.$id} className="flex items-center gap-3 border p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{contact.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {contact.phone || 'No phone number'}
                  </p>
                </div>
                <Badge variant="outline">{contact.consentStatus}</Badge>
                <Button
                  size="sm"
                  disabled={isPending || !contact.phone}
                  onClick={() => contact.phone && call(contact.phone, contact.$id)}
                >
                  <PhoneCall />
                  Call
                </Button>
              </div>
            ))}
            {!search.trim() && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                Type at least one character to search your contacts.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
