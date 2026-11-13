'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'moffu_cookie_consent';

export type CookieConsent = 'all' | 'essential';

function getStoredConsent(): CookieConsent | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === 'all' || v === 'essential') return v;
  } catch {}
  return null;
}

function saveConsent(value: CookieConsent) {
  try { localStorage.setItem(STORAGE_KEY, value); } catch {}
}

// ─── Analytics loader ────────────────────────────────────────────────────────
// When you add Google Analytics, uncomment the block below and replace
// G-XXXXXXXXXX with your Measurement ID.
//
// function loadAnalytics() {
//   if (document.getElementById('ga-script')) return;
//   const s = document.createElement('script');
//   s.id  = 'ga-script';
//   s.src = 'https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX';
//   s.async = true;
//   document.head.appendChild(s);
//   window.dataLayer = window.dataLayer || [];
//   function gtag(...args: unknown[]) { window.dataLayer.push(args); }
//   gtag('js', new Date());
//   gtag('config', 'G-XXXXXXXXXX');
// }
// ─────────────────────────────────────────────────────────────────────────────

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!getStoredConsent()) setShow(true);
  }, []);

  function accept(choice: CookieConsent) {
    saveConsent(choice);
    setShow(false);
    // if (choice === 'all') loadAnalytics(); // uncomment when analytics is ready
  }

  if (!show) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[200] px-4 pb-4 sm:px-6 sm:pb-6"
    >
      <div className="max-w-2xl mx-auto bg-[#111827] border border-white/10 rounded-2xl shadow-2xl px-5 py-4 sm:px-6 sm:py-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">

          {/* Text */}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] text-white font-semibold mb-0.5">We use cookies</p>
            <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
              Essential cookies keep you logged in. We ask before setting any optional cookies.{' '}
              <Link href="/cookies" className="text-[#A78BFA] hover:underline underline-offset-2">
                Cookie Policy
              </Link>
            </p>
          </div>

          {/* Buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => accept('essential')}
              className="text-[12px] font-medium text-[#9CA3AF] hover:text-white px-3 py-2 rounded-lg hover:bg-white/10 transition-colors"
            >
              Essential only
            </button>
            <button
              onClick={() => accept('all')}
              className="text-[12px] font-bold text-white bg-[#6C55E8] hover:bg-[#5A42D1] px-4 py-2 rounded-lg transition-colors"
            >
              Accept all
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
