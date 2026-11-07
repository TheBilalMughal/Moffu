import Image from 'next/image';
import Link from 'next/link';

function LogoMark() {
  return (
    <div className="w-8 h-8 bg-[#111111] rounded-lg flex items-center justify-center flex-shrink-0">
      <svg width="18" height="14" viewBox="0 0 18 14" fill="none" aria-hidden="true">
        <path d="M1 13V1l8 8L17 1v12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Left — image panel */}
      <div className="hidden lg:flex lg:w-[48%] relative flex-col">
        <Image
          src="/images/hero-bg.jpg"
          alt=""
          fill
          className="object-cover object-center"
          priority
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-black/55" />

        {/* Logo top-left */}
        <div className="relative z-10 p-8">
          <Link href="/" className="inline-flex items-center gap-2.5">
            <LogoMark />
            <span className="font-semibold text-white text-[15px]">Moffu</span>
          </Link>
        </div>

        {/* Tagline bottom-left */}
        <div className="relative z-10 mt-auto p-10 pb-14">
          <h2 className="text-white text-[2.25rem] font-bold leading-[1.15] mb-4">
            Every review deserves a thoughtful reply.
          </h2>
          <p className="text-white/65 text-[1rem] leading-relaxed">
            Keep your brand voice consistent,<br />one response at a time.
          </p>
        </div>
      </div>

      {/* Right — form panel */}
      <div className="flex-1 flex flex-col bg-white">
        {/* Top bar */}
        <header className="flex items-center justify-between px-8 py-5 lg:justify-end">
          {/* Mobile logo */}
          <Link href="/" className="inline-flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <span className="font-semibold text-[#111827] text-[15px]">Moffu</span>
          </Link>
          <Link
            href="/"
            className="flex items-center gap-1.5 text-sm text-[#6C55E8] font-medium hover:opacity-80 transition-opacity"
          >
            Back to website
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
            </svg>
          </Link>
        </header>

        {/* Form area */}
        <main className="flex-1 flex items-center justify-center px-8 py-10">
          <div className="w-full max-w-[420px]">
            {children}
          </div>
        </main>

        {/* Bottom */}
        <footer className="px-8 py-5 text-center">
          <p className="text-[12px] text-[#9CA3AF]">
            © {new Date().getFullYear()} Moffu ·{' '}
            <Link href="/privacy" className="hover:text-[#374151] transition-colors">Privacy</Link>
            {' · '}
            <Link href="/terms" className="hover:text-[#374151] transition-colors">Terms</Link>
          </p>
        </footer>
      </div>
    </div>
  );
}
