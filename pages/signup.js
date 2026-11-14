import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useState } from 'react';
import PageIntro from 'components/PageIntro.js';
import { useSupabaseAuth } from 'utils/supabaseAuthContext.js';
import {
  calculateStrength,
  getPasswordRuleIndicator,
  isPasswordValid,
  validatePassword
} from 'utils/passwordValidation.js';

const PASSWORD_RULES = [
  { key: 'uppercase', label: 'Contains an uppercase letter' },
  { key: 'lowercase', label: 'Contains a lowercase letter' },
  { key: 'number', label: 'Contains a number' },
  { key: 'special', label: 'Contains a special character' },
  { key: 'minLength', label: 'Has at least 8 characters' }
];

function signupRequestError(error) {
  if (!error || /already\s*(registered|exists)|already\s*been\s*registered/i.test(error.message)) return '';
  return error.status === 429
    ? 'Too many requests. Wait a little and try again.'
    : 'Could not process this request right now. Please try again.';
}

export default function SignupPage() {
  const router = useRouter();
  const { client, user, isConfigured } = useSupabaseAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (user) {
      router.replace('/');
    }
  }, [router, user]);

  const passwordValidation = useMemo(() => validatePassword(password), [password]);
  const strength = useMemo(
    () => calculateStrength(passwordValidation),
    [passwordValidation]
  );
  const passwordIsValid = isPasswordValid(passwordValidation);
  const passwordsMatch = confirmPassword.length > 0 && password === confirmPassword;
  const canSubmit =
    Boolean(email.trim()) && passwordIsValid && passwordsMatch && !isSubmitting && isConfigured;

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!client) {
      setErrorMessage('Account services are not configured.');
      return;
    }

    if (!passwordIsValid) {
      setErrorMessage('Password does not meet all required rules yet.');
      return;
    }

    if (!passwordsMatch) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage('');
    setSuccessMessage('');

    const response = await client.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo:
          typeof window === 'undefined' ? undefined : `${window.location.origin}/verify`
      }
    });

    setIsSubmitting(false);

    const requestError = signupRequestError(response.error);
    if (requestError) {
      setErrorMessage(requestError);
      return;
    }

    if (response.data?.session) {
      await router.push('/');
      return;
    }

    setSuccessMessage(
      'Check your inbox for any confirmation steps. If you already have an account, log in or request a password reset.'
    );
  };

  return (
    <>
      <Head>
        <title>Sign Up | Mental Math Studio</title>
        <meta
          name='description'
          content='Create your account for Mental Math Studio and keep your training history.'
        />
      </Head>

      <div className='auth-shell'>
        <PageIntro title='Sign up' description='Create an account for synced progress.' />

        <section className='panel paper-panel auth-panel appear-up'>
          {!isConfigured && (
            <p className='inline-warning'>
              Accounts are unavailable right now. You can still practice as a guest.
            </p>
          )}

          <form className='auth-form' onSubmit={handleSubmit}>
            <label htmlFor='signup-email'>Email</label>
            <input
              id='signup-email'
              type='email'
              autoComplete='email'
              required
              disabled={isSubmitting || !isConfigured}
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setErrorMessage('');
                setSuccessMessage('');
              }}
            />

            <label htmlFor='signup-password'>Password</label>
            <div className='password-field'>
              <input
                id='signup-password'
                type={showPassword ? 'text' : 'password'}
                autoComplete='new-password'
                required
                disabled={isSubmitting || !isConfigured}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                aria-describedby='password-guidance'
              />
              <button
                type='button'
                className='password-toggle'
                disabled={isSubmitting || !isConfigured}
                onClick={() => setShowPassword((current) => !current)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <div id='password-guidance' className='password-guidance' aria-live='polite'>
              <div className='strength-row'>
                <span>Password strength: {strength.label}</span>
                <span>
                  {strength.score}/{strength.maxScore}
                </span>
              </div>
              <div className='strength-track' aria-hidden='true'>
                {Array.from({ length: strength.maxScore }, (_unused, index) => {
                  const isPassed = index < strength.score;
                  return <span key={index} className={isPassed ? 'is-pass' : ''} />;
                })}
              </div>
              <ul className='password-rules'>
                {PASSWORD_RULES.map((rule) => {
                  const isPassed = passwordValidation[rule.key];
                  return (
                    <li key={rule.key} className={isPassed ? 'is-pass' : ''}>
                      <span aria-hidden='true'>{getPasswordRuleIndicator(isPassed)}</span>
                      <span>{rule.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>

            <label htmlFor='signup-confirm-password'>Confirm password</label>
            <div className='password-field'>
              <input
                id='signup-confirm-password'
                type={showConfirmPassword ? 'text' : 'password'}
                autoComplete='new-password'
                required
                disabled={isSubmitting || !isConfigured}
                value={confirmPassword}
                onChange={(event) => {
                  setConfirmPassword(event.target.value);
                  setErrorMessage('');
                  setSuccessMessage('');
                }}
                aria-describedby='confirm-password-note'
              />
              <button
                type='button'
                className='password-toggle'
                disabled={isSubmitting || !isConfigured}
                onClick={() => setShowConfirmPassword((current) => !current)}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                {showConfirmPassword ? 'Hide' : 'Show'}
              </button>
            </div>

            <p
              id='confirm-password-note'
              className={`confirm-note ${passwordsMatch ? 'is-pass' : ''}`.trim()}
            >
              {confirmPassword.length === 0
                ? 'Confirm your password.'
                : passwordsMatch
                ? 'Passwords match.'
                : 'Passwords do not match yet.'}
            </p>

            <button
              type='submit'
              className='button button-strong button-full'
              disabled={!canSubmit}
            >
              {isSubmitting ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          {errorMessage && <p className='feedback warning' role='alert'>{errorMessage}</p>}
          {successMessage && <p className='feedback success'>{successMessage}</p>}

          <p className='auth-helper'>
            Already have an account?{' '}
            <Link href='/login' className='text-link'>
              Log in
            </Link>
          </p>
          <p className='auth-helper'><Link href='/forgot-password' className='text-link'>Reset password</Link></p>
          {!isConfigured && <Link href='/' className='text-link'>Practice as a guest</Link>}
        </section>
      </div>
    </>
  );
}
