'use client'

import { useFormState, useFormStatus } from 'react-dom'
import { forgotPassword } from '@/app/auth/actions'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, CheckCircle2 } from 'lucide-react'
import Link from 'next/link'
import { Logo } from '@/components/logo'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" variant="brand" className="w-full" disabled={pending}>{pending ? 'Sending link...' : 'Send reset link'}</Button>
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useFormState(forgotPassword, null)

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <Link href="/" className="mb-2 block" prefetch={false}>
            <Logo />
          </Link>
          <CardTitle className="text-2xl">Forgot password</CardTitle>
          <CardDescription>
            Enter your email and we&apos;ll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        {state?.success ? (
          <CardContent>
            <Alert variant="default" className="border-success">
              <CheckCircle2 className="size-4 text-success" />
              <AlertTitle className="text-success">Success</AlertTitle>
              <AlertDescription className="text-success break-words">{state.message}</AlertDescription>
            </Alert>
          </CardContent>
        ) : (
          <form action={formAction}>
            <CardContent className="grid gap-4">
              {state?.message && (
                 <Alert variant="destructive">
                    <AlertCircle className="size-4" />
                    <AlertTitle>Error</AlertTitle>
                    <AlertDescription>{state.message}</AlertDescription>
                  </Alert>
              )}
              <div className="grid gap-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" name="email" placeholder="m@example.com" required />
              </div>
            </CardContent>
            <CardFooter>
              <SubmitButton />
            </CardFooter>
          </form>
        )}
         <CardFooter className="justify-center">
            <Button variant="link" asChild>
                <Link href="/login">Back to login</Link>
            </Button>
         </CardFooter>
      </Card>
    </div>
  )
}
