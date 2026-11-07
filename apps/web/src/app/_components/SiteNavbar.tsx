'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const NAV_LINKS = [
  { label: 'How It Works', href: '/#how-it-works', sectionId: 'how-it-works' },
  { label: 'Features',     href: '/feature',       sectionId: '' },
  { label: 'Pricing',      href: '/#pricing',      sectionId: 'pricing' },
  { label: 'FAQs',         href: '/#faq',           sectionId: 'faq' },
];

export function SiteNavbar({ portalUrl }: { portalUrl: string }) {
  const [scrolled,       setScrolled]       = useState(false);
  const [activeSection,  setActiveSection]  = useState('');

  /* ── scroll → compact mode ── */
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 72);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  /* ── IntersectionObserver → active section ── */
  useEffect(() => {
    const ids = NAV_LINKS.map(l => l.sectionId).filter(Boolean);
    const observers: IntersectionObserver[] = [];

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id); },
        { rootMargin: '-35% 0px -55% 0px' },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  return (
    <>
      <style>{`
        @keyframes navIn{
          from{opacity:0;transform:translateY(-8px) scale(0.98)}
          to  {opacity:1;transform:translateY(0)    scale(1)   }
        }
        @keyframes logoRope{
          0%   { transform:translateY(0) rotate(0deg); }
          15%  { transform:translateY(6px) rotate(2deg); }
          35%  { transform:translateY(28px) rotate(6deg); }
          50%  { transform:translateY(34px) rotate(8deg); }
          55%  { transform:translateY(32px) rotate(7deg); }
          70%  { transform:translateY(-18px) rotate(-4deg); }
          80%  { transform:translateY(-8px) rotate(-2deg); }
          88%  { transform:translateY(4px) rotate(1deg); }
          94%  { transform:translateY(-2px) rotate(0deg); }
          100% { transform:translateY(0) rotate(0deg); }
        }
        .nav-compact{ animation: navIn 0.25s ease forwards }
        .logo-bounce:hover{ animation:logoRope 0.9s cubic-bezier(0.25,0.46,0.45,0.94) }
      `}</style>

      <header
        className={`fixed top-0 left-0 right-0 z-50 flex justify-center pointer-events-none transition-all duration-300 ${
          scrolled ? 'pt-3' : 'pt-0'
        }`}
      >
        <div
          className={`pointer-events-auto flex items-center transition-all duration-300 ease-[cubic-bezier(0.25,0.46,0.45,0.94)] ${
            scrolled
              ? 'nav-compact bg-white/75 backdrop-blur-2xl shadow-[0_4px_24px_rgba(0,0,0,0.08)] border border-white/60 rounded-2xl mx-4 px-5 h-[52px] w-full max-w-[720px]'
              : 'bg-transparent w-full max-w-[1380px] px-6 lg:px-16 h-28'
          }`}
        >
          {/* Logo */}
          <Link href="/" className="flex-shrink-0">
            <div
              className={`overflow-hidden transition-all duration-300 ${!scrolled ? 'logo-bounce' : ''}`}
              style={scrolled
                ? { height: '26px', width: '50px' }
                : { height: '56px', width: '108px' }
              }
            >
              <img
                src="/images/moffu-logo-transparent.png"
                alt="Moffu"
                style={scrolled
                  ? { height: '66px', width: 'auto', marginTop: '-19px', marginLeft: '-8px' }
                  : { height: '142px', width: 'auto', marginTop: '-41px', marginLeft: '-17px' }
                }
              />
            </div>
          </Link>

          {/* Nav links */}
          <nav
            className={`hidden md:flex items-center transition-all duration-300 ml-auto ${
              scrolled ? 'gap-1' : 'gap-10'
            }`}
            aria-label="Main navigation"
          >
            {NAV_LINKS.map(({ label, href, sectionId }) => {
              const isActive = sectionId ? activeSection === sectionId : false;
              return (
                <Link
                  key={label}
                  href={href}
                  className={`relative transition-all duration-200 rounded-lg ${
                    scrolled
                      ? `px-3 py-1.5 text-sm font-medium ${
                          isActive
                            ? 'bg-[#111827]/8 text-[#111827]'
                            : 'text-[#111827]/55 hover:text-[#111827] hover:bg-[#111827]/5'
                        }`
                      : `text-sm text-[#111827] inline-block hover:opacity-70`
                  }`}
                >
                  {label}
                  {scrolled && isActive && (
                    <span className="absolute bottom-0.5 left-3 right-3 h-[2px] rounded-full bg-[#2ECC8A]" />
                  )}
                </Link>
              );
            })}
          </nav>

          {/* CTA */}
          <a
            href={`${portalUrl}/auth/signup`}
            className={`flex-shrink-0 font-black tracking-tight transition-all duration-300 ${
              scrolled
                ? 'ml-3 text-sm bg-[#111827] text-white px-4 py-2 rounded-lg hover:scale-105 active:scale-95 transition-transform'
                : 'ml-10 text-base bg-[#111827] text-white px-7 py-3.5 rounded-lg hover:scale-105 active:scale-95 transition-transform'
            }`}
          >
            Start Free →
          </a>
        </div>
      </header>
    </>
  );
}
