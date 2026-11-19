'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const STORAGE_KEY = 'moffu_cookie_consent';
const GA4_ID = 'G-KJ1XX07ZEE';
const PIXEL_ID = '1161577489720496';

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

function activateAllTracking() {
  if (typeof window === 'undefined') return;

  // Update GTM consent mode
  const dl = (window as any).dataLayer;
  if (dl) {
    dl.push(['consent', 'update', {
      analytics_storage: 'granted',
      ad_storage: 'granted',
    }]);
  }

  // Load GA4 directly
  if (!document.getElementById('ga4-script')) {
    const s = document.createElement('script');
    s.id = 'ga4-script';
    s.async = true;
    s.src = `https://www.googletagmanager.com/gtag/js?id=${GA4_ID}`;
    document.head.appendChild(s);
    (window as any).dataLayer = (window as any).dataLayer || [];
    function gtag(...args: unknown[]) { (window as any).dataLayer.push(args); }
    gtag('js', new Date());
    gtag('config', GA4_ID);
  }

  // Load Meta Pixel
  if (!document.getElementById('meta-pixel-fb')) {
    const w = window as any;
    if (!w.fbq) {
      const n: any = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      w.fbq = n; w._fbq = n;
      n.push = n; n.loaded = true; n.version = '2.0'; n.queue = [];
    }
    w.fbq('init', PIXEL_ID);
    w.fbq('track', 'PageView');

    const s = document.createElement('script');
    s.id = 'meta-pixel-fb';
    s.async = true;
    s.src = 'https://connect.facebook.net/en_US/fbevents.js';
    document.head.appendChild(s);
  }
}

export function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = getStoredConsent();
    if (!stored) {
      setShow(true);
    } else if (stored === 'all') {
      activateAllTracking();
    }
  }, []);

  function accept(choice: CookieConsent) {
    saveConsent(choice);
    setShow(false);
    if (choice === 'all') activateAllTracking();
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
