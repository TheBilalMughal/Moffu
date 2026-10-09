import { useAuthStore } from '@/features/auth/auth.store';

export function SettingsPage() {
  const { user } = useAuthStore();

  return (
    <div className="px-8 py-8 max-w-2xl">
      <div className="mb-7">
        <h1 className="text-[1.5rem] font-bold text-[#111827]">Settings</h1>
        <p className="text-sm text-[#6B7280] mt-0.5">Manage your account and preferences.</p>
      </div>

      {/* Account section */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Account</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Email</label>
            <p className="text-sm text-[#111827] bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg px-4 py-3">
              {user?.email ?? '—'}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-1.5">Display Name</label>
            <p className="text-sm text-[#111827] bg-[#F8FAF9] border border-[#E5EAE8] rounded-lg px-4 py-3">
              {user?.user_metadata?.display_name ?? '—'}
            </p>
          </div>
        </div>
      </div>

      {/* Integrations placeholder */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden mb-5">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Integrations</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg border border-[#E5EAE8] flex items-center justify-center bg-white">
                <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden="true">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-medium text-[#111827]">Google Business Profile</p>
                <p className="text-xs text-[#9CA3AF]">Connect to sync reviews automatically</p>
              </div>
            </div>
            <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2.5 py-1 rounded-md font-medium">Coming soon</span>
          </div>
        </div>
      </div>

      {/* Billing placeholder */}
      <div className="bg-white rounded-xl border border-[#E5EAE8] overflow-hidden">
        <div className="px-6 py-4 border-b border-[#F3F4F6]">
          <h2 className="text-sm font-semibold text-[#111827]">Billing</h2>
        </div>
        <div className="px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-[#111827]">Current Plan</p>
              <p className="text-xs text-[#9CA3AF] mt-0.5">Free trial</p>
            </div>
            <span className="text-xs text-[#9CA3AF] bg-[#F3F4F6] px-2.5 py-1 rounded-md font-medium">Coming soon</span>
          </div>
        </div>
      </div>
    </div>
  );
}
