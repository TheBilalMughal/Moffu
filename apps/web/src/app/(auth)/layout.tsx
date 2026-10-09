import Link from 'next/link';

function LogoMark() {
  return (
    <div className="w-8 h-8 bg-[#0D4C3C] rounded-lg flex items-center justify-center flex-shrink-0">
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
        <path d="M1 13V1l8 8L17 1v12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#F8FAFB] flex flex-col">
      <header className="px-8 py-5">
        <Link href="/" className="inline-flex items-center gap-2.5">
          <LogoMark />
          <span className="font-semibold text-[#111827] text-[15px]">Moffu</span>
        </Link>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        {children}
      </main>
      <footer className="px-8 py-5 text-center">
        <p className="text-[12px] text-[#9CA3AF]">
          © {new Date().getFullYear()} Moffu. All rights reserved. ·{' '}
          <Link href="/privacy" className="hover:text-[#374151] transition-colors">Privacy</Link>
          {' · '}
          <Link href="/terms" className="hover:text-[#374151] transition-colors">Terms</Link>
        </p>
      </footer>
    </div>
  );
}
