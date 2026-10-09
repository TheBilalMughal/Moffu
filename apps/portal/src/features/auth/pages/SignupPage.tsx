import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Label, Alert, AlertDescription } from '@moffu/ui';
import { authService } from '../auth.service';

export function SignupPage() {
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    const { error: err } = await authService.signup({ email, password, displayName });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    setDone(true);
  }

  if (done) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-success-DEFAULT">
            <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-900">Check your email</h2>
          <p className="text-sm text-neutral-500">
            We sent a verification link to <strong>{email}</strong>. Click the link to activate your
            account.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              await authService.resendVerification(email);
            }}
          >
            Resend verification email
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-500">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">Create account</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Start managing your Google reviews.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="displayName" required>
              Full name
            </Label>
            <Input
              id="displayName"
              type="text"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Smith"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email" required>
              Work email
            </Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="password" required>
              Password
            </Label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="8+ characters"
              required
              minLength={8}
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Create account
          </Button>
        </form>

        <p className="text-center text-sm text-neutral-500">
          Already have an account?{' '}
          <Link
            to="/auth/login"
            className="font-medium text-brand-500 hover:underline"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
