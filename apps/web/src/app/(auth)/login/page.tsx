import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Login',
  description: 'Sign in to your Moffu account.',
};

export default function LoginPage() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="text-center mb-8">
        <h1 className="text-[1.75rem] font-bold text-[#111827] mb-2">Welcome back</h1>
        <p className="text-[#6B7280] text-sm">Sign in to your Moffu account</p>
      </div>
      <LoginForm />
    </div>
  );
}
