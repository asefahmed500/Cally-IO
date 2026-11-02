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
import { AlertCircle } from 'lucide-react'
import Link from 'next/link'
import { Skeleton } from '@/components/ui/skeleton'
import { Logo } from '@/components/logo'


function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" variant="brand" className="w-full" disabled={pending}>{pending ? 'Resetting password...' : 'Reset password'}</Button>
}

function ResetPasswordForm() {
    const searchParams = useSearchParams()
    const userId = searchParams.get('userId')
    const token = searchParams.get('token')
    const [state, formAction] = useFormState(resetPassword, null)

    if (!userId || !token) {
        return (
             <Card className="w-full max-w-sm">
                <CardHeader>
                    <Link href="/" className="mb-2 block" prefetch={false}>
                      <Logo />
                    </Link>
                    <CardTitle className="text-2xl">Invalid link</CardTitle>
                    <CardDescription>
                        The password reset link is invalid or has expired. Please request a new one.
                    </CardDescription>
                </CardHeader>
                 <CardFooter className="justify-center">
                    <Button asChild>
                        <Link href="/forgot-password">Request a new link</Link>
                    </Button>
                </CardFooter>
            </Card>
        )
    }

    return (
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Link href="/" className="mb-2 block" prefetch={false}>
            <Logo />
          </Link>
          <CardTitle className="text-2xl">Reset password</CardTitle>
          <CardDescription>
            Enter your new password below.
          </CardDescription>
        </CardHeader>
        <form action={formAction}>
           <input type="hidden" name="userId" value={userId} />
           <input type="hidden" name="token" value={token} />
          <CardContent className="grid gap-4">
            {state?.message && (
               <Alert variant="destructive">
                  <AlertCircle className="size-4" />
                  <AlertTitle>Error</AlertTitle>
                  <AlertDescription>{state.message}</AlertDescription>
                </Alert>
            )}
            <div className="grid gap-2">
              <Label htmlFor="password">New password</Label>
              <Input id="password" type="password" name="password" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="passwordConfirm">Confirm password</Label>
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
