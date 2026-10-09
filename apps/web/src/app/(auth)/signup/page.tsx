import type { Metadata } from 'next';
import { SignupForm } from './SignupForm';

export const metadata: Metadata = {
  title: 'Sign Up',
  description: 'Create your Moffu account and start managing reviews.',
};

export default function SignupPage() {
  return (
    <div className="w-full max-w-[400px]">
      <div className="text-center mb-8">
        <h1 className="text-[1.75rem] font-bold text-[#111827] mb-2">Start your free trial</h1>
        <p className="text-[#6B7280] text-sm">No credit card required · 14-day free trial</p>
      </div>
      <SignupForm />
    </div>
  );
}
