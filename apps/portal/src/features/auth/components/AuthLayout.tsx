import { useLocation } from 'react-router-dom';
import { env } from '@/lib/env';

function LogoMark({ href }: { href: string }) {
  return (
    <a href={href} className="flex items-center w-fit">
      <img src="/images/logo.png" alt="Moffu" className="h-8 w-auto" />
    </a>
  );
}

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { pathname } = useLocation();

  return (
    <div className="h-screen overflow-hidden flex">
      {/* Left — hero panel */}
      <div className="hidden lg:flex lg:w-[48%] relative flex-col bg-[#0D4C3C]"
        style={{ background: 'linear-gradient(145deg, #0D4C3C 0%, #083F32 60%, #052D23 100%)' }}>
        {/* Logo */}
        <div className="relative z-10 p-8">
          <LogoMark href={env.webUrl} />
        </div>
        {/* Tagline */}
        <div className="relative z-10 mt-auto p-10 pb-14">
          <h2 className="text-white text-[2.1rem] font-bold leading-tight mb-3">
            Every review deserves a thoughtful reply.
          </h2>
          <p className="text-white/65 text-[0.9375rem] leading-relaxed">
            Keep your brand voice consistent, one response at a time.
          </p>
        </div>
        {/* Decorative circles */}
        <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-white/5 translate-x-1/3 translate-y-1/3 pointer-events-none" />
        <div className="absolute top-1/3 right-8 w-32 h-32 rounded-full bg-white/5 pointer-events-none" />
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col bg-white overflow-y-auto">
        <header className="flex items-center justify-between px-8 py-5 lg:justify-end">
          {/* Mobile logo */}
          <div className="flex items-center lg:hidden">
            <img src="/images/logo.png" alt="Moffu" className="h-7 w-auto" />
          </div>
          <a
            href={env.webUrl}
            className="text-sm text-[#6B7280] hover:text-[#111827] transition-colors flex items-center gap-1.5"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16l-4-4m0 0l4-4m-4 4h18" />
            </svg>
            Back to Moffu
          </a>
        </header>
        <main className="flex-1 flex items-center justify-center px-8 py-10">
          <div key={pathname} className="auth-animate w-full max-w-[420px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
