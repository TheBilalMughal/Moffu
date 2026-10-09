import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Button, Input, Label, Alert, AlertDescription } from '@moffu/ui';
import { authService } from '../auth.service';

export function LoginPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('next') ?? '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: err } = await authService.login({ email, password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    navigate(redirectTo, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand mark */}
        <div className="text-center">
          {/* TBD: Final logo/brand name */}
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-500">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">Sign in</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Welcome back. Enter your credentials to continue.
          </p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" required>
              Email
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
            <div className="flex items-center justify-between">
              <Label htmlFor="password" required>
                Password
              </Label>
              <Link
                to="/auth/forgot-password"
                className="text-xs text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 rounded"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <Button type="submit" className="w-full" loading={loading}>
            Sign in
          </Button>
        </form>

        <p className="text-center text-sm text-neutral-500">
          Don&apos;t have an account?{' '}
          <Link
            to="/auth/signup"
            className="font-medium text-brand-500 hover:underline focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-500 rounded"
          >
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
