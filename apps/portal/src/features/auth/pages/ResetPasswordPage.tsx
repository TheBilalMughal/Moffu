import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Input, Label, Alert, AlertDescription } from '@moffu/ui';
import { authService } from '../auth.service';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: err } = await authService.resetPassword({ password });
    setLoading(false);

    if (err) {
      setError(err.message);
      return;
    }

    navigate('/auth/login?reset=success', { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center">
          <div className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-md bg-brand-500">
            <span className="text-lg font-bold text-white">M</span>
          </div>
          <h1 className="text-2xl font-semibold text-neutral-900">Set new password</h1>
          <p className="mt-1 text-sm text-neutral-500">Choose a strong password for your account.</p>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="password" required>
              New password
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
          <div className="space-y-1.5">
            <Label htmlFor="confirm" required>
              Confirm password
            </Label>
            <Input
              id="confirm"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              error={confirm.length > 0 && password !== confirm}
              required
              disabled={loading}
            />
          </div>
          <Button type="submit" className="w-full" loading={loading}>
            Update password
          </Button>
        </form>
      </div>
    </div>
  );
}
