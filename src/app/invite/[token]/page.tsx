import { acceptInvitationFormAction, getInvitationPreview } from '@/app/settings/members_actions';
import { getLoggedInUser } from '@/lib/auth';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';

export default async function InvitePage({
  params,
  searchParams,
}: {
  params: { token: string };
  searchParams: { accepted?: string; error?: string };
}) {
  const user = await getLoggedInUser();
  const preview = await getInvitationPreview(params.token);

  const accepted = searchParams.accepted === '1';
  const failed = searchParams.error === '1';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Workspace invitation</CardTitle>
            <CardDescription>
              {accepted
                ? 'Your invitation has been accepted.'
                : user
                  ? 'Review the invitation below before accepting.'
                  : 'Log in or create an account with the invited email address to accept this invitation.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {accepted ? (
              <Alert className="border-success/40 bg-success/5">
                <CheckCircle2 className="size-4 text-success" />
                <AlertTitle>Invitation accepted</AlertTitle>
                <AlertDescription>You are now a member of the workspace.</AlertDescription>
              </Alert>
            ) : failed ? (
              <Alert variant="destructive">
                <XCircle className="size-4" />
                <AlertTitle>Cannot accept invitation</AlertTitle>
                <AlertDescription>
                  The invitation is invalid, expired, or was revoked.
                </AlertDescription>
              </Alert>
            ) : preview ? (
              <div className="border p-4">
                <p className="text-sm">
                  You have been invited to join{' '}
                  <span className="font-semibold">{preview.workspaceName}</span>
                </p>
                <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Invited email:</span>
                  <span className="font-medium text-foreground">{preview.email}</span>
                </div>
                <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Role:</span>
                  <Badge variant="secondary">{preview.role.replace(/_/g, ' ').toLowerCase()}</Badge>
                </div>
                {!user && (
                  <p className="mt-3 text-xs text-muted-foreground">
                    Log in with {preview.email} to accept.
                  </p>
                )}
              </div>
            ) : (
              <Alert variant="destructive">
                <XCircle className="size-4" />
                <AlertTitle>Invitation unavailable</AlertTitle>
                <AlertDescription>
                  This invitation is invalid, expired, or was revoked. Ask an admin to send a new
                  one.
                </AlertDescription>
              </Alert>
            )}
          </CardContent>
          <CardFooter className="gap-2">
            {accepted ? (
              <Button asChild variant="brand" className="w-full">
                <Link href="/dashboard">Go to dashboard</Link>
              </Button>
            ) : preview && user ? (
              <form action={acceptInvitationFormAction} className="w-full">
                <input type="hidden" name="token" value={params.token} />
                <Button type="submit" variant="brand" className="w-full">
                  Accept invitation
                </Button>
              </form>
            ) : preview && !user ? (
              <div className="flex w-full flex-col gap-2">
                <Button asChild variant="brand" className="w-full">
                  <Link href="/login">Log in</Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href="/signup">Create account</Link>
                </Button>
              </div>
            ) : (
              <Button asChild variant="outline" className="w-full">
                <Link href={user ? '/dashboard' : '/'}>Back</Link>
              </Button>
            )}
          </CardFooter>
        </Card>
      </div>
    </div>
  );
}
