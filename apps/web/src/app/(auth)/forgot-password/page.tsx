import type { Metadata } from 'next';
import { ForgotPasswordForm } from './ForgotPasswordForm';

export const metadata: Metadata = {
  title: 'Forgot Password',
};

export default function ForgotPasswordPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-[2rem] font-bold text-[#111827] mb-2">Forgot your password?</h1>
        <p className="text-[#6B7280] text-[0.9375rem]">Enter your email and we'll send you a reset link.</p>
      </div>
      <ForgotPasswordForm />
    </>
  );
}
