'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { createWorkspace } from './actions'
import { Logo } from '@/components/logo'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Loader2, Building2, Users, Globe } from 'lucide-react'

const INDUSTRIES = [
  'Technology & SaaS',
  'E-commerce & Retail',
  'Financial Services',
  'Healthcare',
  'Real Estate',
  'Education',
  'Travel & Hospitality',
  'Professional Services',
  'Other',
]

const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-1000', '1000+']

const STEPS = [
  { title: 'Company', icon: Building2, description: 'Name your workspace.' },
  { title: 'Details', icon: Users, description: 'Tell us about your business.' },
  { title: 'Region', icon: Globe, description: 'Set your operating timezone.' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const [step, setStep] = React.useState(0)
  const [isPending, startTransition] = React.useTransition()
  const [error, setError] = React.useState<string | null>(null)
  const [timezones, setTimezones] = React.useState<string[]>([])

  React.useEffect(() => {
    try {
      setTimezones(Intl.supportedValuesOf('timeZone'))
    } catch {
      setTimezones(['UTC'])
    }
  }, [])

  const formRef = React.useRef<HTMLFormElement>(null)

  const handleNext = () => {
    if (step === 0) {
      const name = (formRef.current?.elements.namedItem('name') as HTMLInputElement)?.value
      if (!name || name.trim().length < 2) {
        setError('Please enter a workspace name (at least 2 characters).')
        return
      }
    }
    setError(null)
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleSubmit = (formData: FormData) => {
    startTransition(async () => {
      setError(null)
      const result = await createWorkspace(null, formData)
      if (result.status === 'success') {
        router.push('/dashboard')
        router.refresh()
      } else {
        setError(result.message || 'Something went wrong.')
        setStep(0)
      }
    })
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Logo />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-xl">Create your workspace</CardTitle>
            <CardDescription>
              Set up your AI contact center. You can invite your team right after.
            </CardDescription>
            <div className="flex items-center gap-2 pt-2">
              {STEPS.map((s, i) => (
                <React.Fragment key={s.title}>
                  <Badge variant={i === step ? 'default' : 'secondary'} className="gap-1.5">
                    <s.icon className="size-3" />
                    {s.title}
                  </Badge>
                  {i < STEPS.length - 1 && <span className="h-px w-6 bg-border" />}
                </React.Fragment>
              ))}
            </div>
          </CardHeader>
          <CardContent>
            <form
              ref={formRef}
              action={handleSubmit}
              onSubmit={(e) => {
                // Let our stepper control submission on intermediate steps.
                if (step < STEPS.length - 1) {
                  e.preventDefault()
                  handleNext()
                }
              }}
              className="flex flex-col gap-4"
            >
              {/* Step 1 — Company */}
              <div className={cnStep(step === 0)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="name">Workspace name</Label>
                  <Input id="name" name="name" placeholder="e.g. Acme Support" required minLength={2} maxLength={60} autoFocus />
                </div>
              </div>

              {/* Step 2 — Details */}
              <div className={cnStep(step === 1)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="industry">Industry</Label>
                  <Select name="industry" defaultValue={INDUSTRIES[0]}>
                    <SelectTrigger id="industry">
                      <SelectValue placeholder="Select an industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((industry) => (
                        <SelectItem key={industry} value={industry}>
                          {industry}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="companySize">Company size</Label>
                  <Select name="companySize" defaultValue={COMPANY_SIZES[0]}>
                    <SelectTrigger id="companySize">
                      <SelectValue placeholder="Select company size" />
                    </SelectTrigger>
                    <SelectContent>
                      {COMPANY_SIZES.map((size) => (
                        <SelectItem key={size} value={size}>
                          {size} people
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Step 3 — Region */}
              <div className={cnStep(step === 2)}>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="timezone">Operating timezone</Label>
                  <Select name="timezone" defaultValue="UTC">
                    <SelectTrigger id="timezone">
                      <SelectValue placeholder="Select a timezone" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {timezones.map((tz) => (
                        <SelectItem key={tz} value={tz}>
                          {tz}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setStep((s) => Math.max(s - 1, 0))}
                  disabled={step === 0 || isPending}
                >
                  Back
                </Button>
                {step < STEPS.length - 1 ? (
                  <Button type="submit" variant="brand">Continue</Button>
                ) : (
                  <Button type="submit" variant="brand" disabled={isPending}>
                    {isPending && <Loader2 className="size-4 animate-spin" />}
                    Create workspace
                  </Button>
                )}
              </div>
            </form>
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          Step {step + 1} of {STEPS.length} — you can change all of this later in Settings.
        </p>
      </div>
    </div>
  )
}

function cnStep(active: boolean): string {
  return active ? 'flex flex-col gap-4' : 'hidden'
}
