'use client'

import { useActionState } from 'react'
import { useFormStatus } from 'react-dom'
import { forgotPassword } from '@/app/auth/actions'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Terminal, CheckCircle } from 'lucide-react'
import Link from 'next/link'

function SubmitButton() {
  const { pending } = useFormStatus()
  return <Button type="submit" className="w-full" disabled={pending}>{pending ? 'Sending Link...' : 'Send Password Reset Link'}</Button>
}

export default function ForgotPasswordPage() {
  const [state, formAction] = useActionState(forgotPassword, null)

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>
            Enter your email and we'll send you a link to reset your password.
          </CardDescription>
        </CardHeader>
        {state?.success ? (
          <CardContent>
            <Alert variant="default" className="border-green-500">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">Success!</AlertTitle>
              <AlertDescription className="text-green-700">{state.message}</AlertDescription>
            </Alert>
          </CardContent>
        ) : (
          <form action={formAction}>
            <CardContent className="grid gap-4">
              {state?.message && (
                 <Alert variant="destructive">
                    <Terminal className="h-4 w-4" />
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
                <Link href="/login">Back to Login</Link>
            </Button>
         </CardFooter>
      </Card>
    </div>
  )
}
