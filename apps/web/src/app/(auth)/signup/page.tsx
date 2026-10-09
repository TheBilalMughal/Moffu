import type { Metadata } from 'next';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = {
  title: 'Sign Up',
};

export default function SignupPage() {
  return (
    <>
      <div className="mb-8">
        <h1 className="text-[2rem] font-bold text-[#111827] mb-2">Create your account</h1>
        <p className="text-[#6B7280] text-[0.9375rem]">Start managing your reviews with confidence.</p>
      </div>
      <SignupForm />
    </>
  );
}
