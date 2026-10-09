import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button, Input, Label, Alert, AlertDescription } from '@moffu/ui';
import { authService } from '../auth.service';

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await authService.forgotPassword({ email });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setDone(true);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-500">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">Reset password</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Enter your email and we&apos;ll send a reset link.
          </p>
        </div>

        {done ? (
          <div className="space-y-3 rounded-lg border border-success-DEFAULT/30 bg-success-light p-4 text-sm text-success-dark">
            <p>
              If an account exists for <strong>{email}</strong>, you&apos;ll receive a password reset
              email shortly.
            </p>
            <Link to="/auth/login" className="font-medium underline underline-offset-2">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            {error && (
              <Alert variant="destructive">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email" required>
                  Email address
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
              <Button type="submit" className="w-full" loading={loading}>
                Send reset link
              </Button>
            </form>
            <p className="text-center text-sm text-neutral-500">
              <Link to="/auth/login" className="font-medium text-brand-500 hover:underline">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
