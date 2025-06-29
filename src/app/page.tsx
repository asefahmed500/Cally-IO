import { getLoggedInUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { LandingPage as LandingPageUI } from '@/components/layout/landing-page';

export default async function HomePage() {
  const user = await getLoggedInUser();

  if (user) {
    redirect('/dashboard');
  }

  return <LandingPageUI />;
}
