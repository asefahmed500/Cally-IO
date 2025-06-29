'use client'

import { Suspense } from 'react'
import { useFormState, useFormStatus } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import { resetPassword } from '@/app/auth/actions'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Terminal } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'


function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Resetting Password...' : 'Reset Password'}</Button>
}

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const userId = searchParams.get('userId')
    const secret = searchParams.get('secret')
    const [state, formAction] = useFormState(resetPassword, null)

    if (!userId || !secret) {
        return (
             <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle className="text-2xl">Invalid Link</CardTitle>
                    <CardDescription>
                        The password reset link is invalid or has expired. Please request a new one.
                    </CardDescription>
                </CardHeader>
                 <CardFooter className="justify-center">
                    <Button asChild>
                        <Link href="/forgot-password">Request a New Link</Link>
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Reset Password</CardTitle>
          <CardDescription>
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
           <input type="hidden" name="userId" value={userId} />
           <input type="hidden" name="secret" value={secret} />
          <CardContent className="grid gap-4">
            {state?.message && (
               <Alert variant="destructive">
                  <Terminal className="h-4 w-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="password">New Password</Label>
              <Input id="password" type="password" name="password" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="passwordConfirm">Confirm New Password</Label>
              <Input id="passwordConfirm" type="password" name="passwordConfirm" required />
            </div>
          </CardContent>
          <CardFooter>
            <SubmitButton />
          </CardFooter>
        </form>
      </Card>
    )
}

function ResetPasswordPageSkeleton() {
    return (
        <Card className="w-full max-w-sm">
            <CardHeader>
                <Skeleton className="h-8 w-3/4" />
                <Skeleton className="h-4 w-full mt-2" />
            </CardHeader>
            <CardContent className="grid gap-4">
                 <div className="grid gap-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
                 <div className="grid gap-2">
                    <Skeleton className="h-4 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                </div>
            </CardContent>
            <CardFooter>
                <Skeleton className="h-10 w-full" />
            </CardFooter>
        </Card>
    )
}

export default function ResetPasswordPage() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Suspense fallback={<ResetPasswordPageSkeleton />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  )
}
