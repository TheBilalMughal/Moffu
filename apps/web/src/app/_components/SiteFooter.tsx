import Link from 'next/link';

const FOOTER_NAV = [
  {
    heading: 'Product',
    links: [
      { label: 'Features', href: '/feature' },
      { label: 'How It Works', href: '/#how-it-works' },
      { label: 'Pricing', href: '/#pricing' },
    ],
  },
  {
    heading: 'Company',
    links: [
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Changelog', href: '/changelog' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '/privacy' },
      { label: 'Terms of Service', href: '/terms' },
      { label: 'Refund Policy', href: '/refund' },
      { label: 'Cookie Policy', href: '/cookies' },
      { label: 'GDPR', href: '/gdpr' },
    ],
  },
  {
    heading: 'Support',
    links: [
      { label: 'Help Center', href: '/help' },
      { label: 'Contact Us', href: '/contact' },
    ],
  },
];


export function SiteFooter({ portalUrl = 'https://app.moffu.pro' }: { portalUrl?: string }) {
  return (
    <footer className="bg-[#111827] text-white min-h-screen flex flex-col">

      {/* ── CTA ── */}
      <div className="flex-1 flex items-center px-8 lg:px-16 py-20">
        <div className="max-w-[1380px] mx-auto w-full">
          <h2 className="text-[clamp(3rem,9vw,7rem)] font-black leading-[1.0] text-[#D8CCFF] mb-8">
            Start answering.<br />Stop ignoring.
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <a
              href={`${portalUrl}/auth/signup`}
              className="inline-flex items-center gap-2 bg-[#D8CCFF] text-[#111111] font-bold text-sm px-7 py-3.5 rounded-lg hover:scale-105 active:scale-95 transition-transform duration-150"
            >
              Start Free →
            </a>
            <a href="#pricing" className="text-sm font-medium text-white/50 hover:text-white transition-colors">
              View pricing →
            </a>
          </div>
          <p className="text-xs text-white/25 mt-5">No credit card required · Free plan available · Cancel anytime</p>
        </div>
      </div>

      {/* ── Footer nav + bottom bar ── */}
      <div className="px-8 lg:px-16 pt-12 pb-10 border-t border-white/10">
        <div className="max-w-[1380px] mx-auto w-full">
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-10 mb-14">
          {/* Brand col */}
          <div className="col-span-2">
            <Link href="/" className="inline-block mb-4">
              <img
                src="/images/logo-transparent.png"
                alt="Moffu"
                style={{ height: '28px', width: 'auto', filter: 'invert(1)' }}
              />
            </Link>
            <p className="text-[13px] text-[#9CA3AF] leading-relaxed mb-6 max-w-[220px]">
              AI-powered Google review responses that sound like your brand.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3 mb-6">
              <a href="https://linkedin.com/company/moffu" target="_blank" rel="noopener noreferrer" aria-label="Moffu on LinkedIn" className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors duration-150">
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                </svg>
              </a>
            </div>

            {/* Contact */}
            <div className="flex flex-col gap-2">
              {[
                { label: 'Hello@moffu.pro', href: 'mailto:Hello@moffu.pro' },
                { label: 'Sales@moffu.pro', href: 'mailto:Sales@moffu.pro' },
                { label: 'Support@moffu.pro', href: 'mailto:Support@moffu.pro' },
              ].map(({ label, href }) => (
                <a key={label} href={href} className="flex items-center gap-2 text-[13px] text-[#9CA3AF] hover:text-white transition-colors duration-150">
                  <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          {FOOTER_NAV.map(({ heading, links }) => (
            <div key={heading}>
              <h3 className="text-[11px] font-semibold text-white uppercase tracking-[0.1em] mb-4">{heading}</h3>
              <ul className="space-y-3">
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <Link href={href} className="text-[13px] text-[#9CA3AF] hover:text-white transition-colors duration-150">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="text-[12px] text-[#6B7280]">© {new Date().getFullYear()} Moffu. All rights reserved.</p>
          <div className="flex items-center gap-6">
            <Link href="/privacy" className="text-[12px] text-[#6B7280] hover:text-white transition-colors duration-150">Privacy</Link>
            <Link href="/terms" className="text-[12px] text-[#6B7280] hover:text-white transition-colors duration-150">Terms</Link>
            <Link href="/refund" className="text-[12px] text-[#6B7280] hover:text-white transition-colors duration-150">Refunds</Link>
            <Link href="/cookies" className="text-[12px] text-[#6B7280] hover:text-white transition-colors duration-150">Cookies</Link>
          </div>
        </div>
        </div>
      </div>
    </footer>
  );
}
