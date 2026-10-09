import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Label, Alert, AlertDescription } from '@moffu/ui';
import { adminAuthService } from '../auth.service';

export function AdminLoginPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await adminAuthService.login({ email, password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-100 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <div>
          <div className="mb-1 flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-brand-500">
              <span className="text-sm font-bold text-white">M</span>
            </div>
            <span className="text-xs font-medium uppercase tracking-widest text-neutral-400">
              Admin
            </span>
          </div>
          <h1 className="text-xl font-semibold text-neutral-900">Internal access only</h1>
          <p className="mt-1 text-sm text-neutral-500">Platform team sign in.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="email" required>Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="password" required>Password</Label>
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
      </div>
    </div>
  );
}
