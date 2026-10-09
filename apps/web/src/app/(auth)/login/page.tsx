import type { Metadata } from 'next';
import { LoginForm } from './LoginForm';

export const metadata: Metadata = {
  title: 'Login',
};

export default function LoginPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-[2rem] font-bold text-[#111827] mb-2">Welcome back</h1>
        <p className="text-[#6B7280] text-[0.9375rem]">Log in to manage your reviews and replies.</p>
      </div>
      <LoginForm />
    </>
  );
}
