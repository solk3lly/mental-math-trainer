import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import PageIntro from 'components/PageIntro.js';
import { clearSignupVerification, getSignupVerification } from 'utils/supabaseClient.js';
import { useSupabaseAuth } from 'utils/supabaseAuthContext.js';

const REDIRECT_DELAY_MS = 2000;
const TITLES = {
  checking: 'Checking your link',
  confirmed: 'Email confirmed',
  invalid: 'Confirmation link could not be verified',
  signedIn: 'Already signed in',
  'no-link': 'Confirm your email'
};
const MESSAGES = {
  checking: 'Checking the email confirmation link.',
  confirmed: 'Your email was confirmed. Opening the trainer…',
  invalid: 'The link may be invalid or expired. Log in if you already confirmed your email, or request a new link.',
  signedIn: 'You already have an active session in this browser.',
  'no-link': 'Open the link sent to your email to confirm your account.'
};

function getVerificationView(isLoading, verification, user) {
  if (isLoading || !verification) return 'checking';
  if (verification.status === 'invalid') return 'invalid';
  if (verification.status === 'confirmed' && verification.userId === user?.id) return 'confirmed';
  return user ? 'signedIn' : 'no-link';
}

export default function VerifyPage() {
  const router = useRouter();
  const { isLoading, user } = useSupabaseAuth();
  const [verification, setVerification] = useState(null);
  const view = getVerificationView(isLoading, verification, user);

  useEffect(() => {
    let active = true;
    void getSignupVerification().then(result => {
      if (!active) return;
      clearSignupVerification();
      setVerification(result);
    });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (view !== 'confirmed') return undefined;
    const timeoutId = window.setTimeout(() => void router.replace('/'), REDIRECT_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [router, view]);

  return (
    <>
      <Head><title>Verify Email | Mental Math Studio</title></Head>
      <div className='verify-shell'>
        <PageIntro title={TITLES[view]} />
        <section className='panel paper-panel auth-panel verify-panel appear-up'>
          <div className={`verify-status ${view === 'confirmed' ? 'is-success' : 'is-idle'}`} role='status'>
            <p className='verify-status-copy'>{MESSAGES[view]}</p>
            {(view === 'confirmed' || view === 'signedIn') && user.email && (
              <p className='verify-user-pill'>{user.email}</p>
            )}
          </div>
          {view !== 'checking' && <VerificationActions user={user} />}
        </section>
      </div>
    </>
  );
}

function VerificationActions({ user }) {
  return (
    <div className='inline-actions verify-actions'>
      {user ? (
        <Link href='/' className='button button-strong'>Open trainer</Link>
      ) : (
        <Link href='/login' className='button button-strong'>Log in</Link>
      )}
      <Link href={user ? '/stats' : '/signup'} className='button button-quiet'>
        {user ? 'View progress' : 'Create account'}
      </Link>
    </div>
  );
}
