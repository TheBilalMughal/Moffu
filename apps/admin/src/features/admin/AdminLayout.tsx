import { useState, useRef, useEffect, useCallback } from 'react';
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAdminAuthStore } from '@/features/auth/auth.store';
import { adminAuthService } from '@/features/auth/auth.service';
import { supabase } from '@/lib/supabase';
import { ToastContainer } from '@/components/ToastContainer';

// -- Nav Items -----------------------------------------------------------------

const NAV_DASHBOARD = [
  {
    to: '/',
    label: 'Overview',
    end: true,
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
      </svg>
    ),
  },
];

const NAV_CLIENTS = [
  {
    to: '/clients',
    label: 'Clients',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    to: '/usage',
    label: 'Usage',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    to: '/billing',
    label: 'Subscriptions',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    to: '/reports',
    label: 'Reports',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
  },
];

const NAV_FINANCE = [
  {
    to: '/mrr',
    label: 'MRR',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
  },
  {
    to: '/payments',
    label: 'Payments',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
      </svg>
    ),
  },
  {
    to: '/coupons',
    label: 'Coupons',
    allowedRoles: ['owner', 'super_admin'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 5v2m0 4v2m0 4v2M5 5a2 2 0 00-2 2v3a2 2 0 110 4v3a2 2 0 002 2h14a2 2 0 002-2v-3a2 2 0 110-4V7a2 2 0 00-2-2H5z" />
      </svg>
    ),
  },
  {
    to: '/refunds',
    label: 'Refunds',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
  },
];

const NAV_PLATFORM = [
  {
    to: '/broadcasts',
    label: 'Broadcasts',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
  {
    to: '/waitlist',
    label: 'Waitlist',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    to: '/flags',
    label: 'Feature Flags',
    allowedRoles: ['owner', 'super_admin'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9" />
      </svg>
    ),
  },
  {
    to: '/integrations',
    label: 'Integrations',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
      </svg>
    ),
  },
];

const NAV_ADMINISTRATION = [
  {
    to: '/users',
    label: 'Users & Roles',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    to: '/roles',
    label: 'Roles',
    allowedRoles: ['owner', 'super_admin'],
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    to: '/audit',
    label: 'Audit Logs',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
      </svg>
    ),
  },
];

type NavItemData = { to: string; label: string; icon: React.ReactNode; end?: boolean; allowedRoles?: string[] };

interface SettingsSection {
  label: string;
  to: string;
  icon: React.ReactNode;
  subItems?: NavItemData[];
}

const NAV_SETTINGS_GROUPS: SettingsSection[] = [
  {
    label: 'General',
    to: '/settings/general',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
  {
    label: 'Packages',
    to: '/settings/packages',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 10V7" />
      </svg>
    ),
  },
  {
    label: 'Website',
    to: '/settings/website/client-logo',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
      </svg>
    ),
    subItems: [
      {
        to: '/settings/website/client-logo',
        label: 'Client Logo',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'API & Keys',
    to: '/settings/api/ai',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
    subItems: [
      {
        to: '/settings/api/ai',
        label: 'AI Keys',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
          </svg>
        ),
      },
      {
        to: '/settings/api/google',
        label: 'Google API',
        icon: (
          <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
        ),
      },
      {
        to: '/settings/api/sync',
        label: 'Review Sync',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Notifications',
    to: '/settings/notifications/email',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
      </svg>
    ),
    subItems: [
      {
        to: '/settings/notifications/email',
        label: 'Email',
        icon: (
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
        ),
      },
    ],
  },
  {
    label: 'Security',
    to: '/settings/security',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
  },
];

// -- Group ? Sidebar Nav mapping ----------------------------------------------

const GROUP_NAV_CONFIG: Record<string, { label: string | null; items: NavItemData[] }> = {
  Overview:  { label: null,            items: NAV_DASHBOARD },
  Clients:   { label: 'Clients',       items: NAV_CLIENTS },
  Finance:   { label: 'Finance',       items: NAV_FINANCE },
  Platform:  { label: 'Platform',      items: NAV_PLATFORM },
  Admin:     { label: 'Administration',items: NAV_ADMINISTRATION },
  Settings:  { label: 'Settings',      items: [] },
};

// -- Icon Rail Groups ----------------------------------------------------------

const RAIL_GROUPS = [
  {
    label: 'Overview',
    to: '/',
    end: true,
    test: (p: string) => p === '/',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v5a1 1 0 01-1 1H5a1 1 0 01-1-1V5zm10 0a1 1 0 011-1h4a1 1 0 011 1v2a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4zm10-3a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1v-7z" />
      </svg>
    ),
  },
  {
    label: 'Clients',
    to: '/clients',
    end: false,
    test: (p: string) => ['/clients', '/usage', '/billing', '/reports'].some(x => p === x || p.startsWith(x + '/')),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
      </svg>
    ),
  },
  {
    label: 'Finance',
    to: '/mrr',
    end: false,
    allowedRoles: ['owner', 'super_admin', 'finance'],
    test: (p: string) => ['/mrr', '/payments', '/coupons', '/refunds'].some(x => p === x || p.startsWith(x + '/')),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    label: 'Platform',
    to: '/broadcasts',
    end: false,
    allowedRoles: ['owner', 'super_admin', 'admin'],
    test: (p: string) => ['/broadcasts', '/waitlist', '/flags', '/integrations'].some(x => p === x || p.startsWith(x + '/')),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
      </svg>
    ),
  },
  {
    label: 'Admin',
    to: '/users',
    end: false,
    allowedRoles: ['owner', 'super_admin', 'admin'],
    test: (p: string) => ['/users', '/roles', '/audit'].some(x => p === x || p.startsWith(x + '/')),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Settings',
    to: '/settings/general',
    end: false,
    allowedRoles: ['owner', 'super_admin'],
    test: (p: string) => p.startsWith('/settings'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
  },
];

const ROLE_LABEL: Record<string, string> = {
  owner: 'Owner',
  super_admin: 'Super Admin',
  admin: 'Admin',
  finance: 'Finance',
  support: 'Support',
  operations: 'Operations',
  viewer: 'Viewer',
};

// -- Admin Search --------------------------------------------------------------

interface AdminSearchResult {
  id: string;
  kind: 'org' | 'member';
  title: string;
  sub: string;
}

function AdminSearch() {
  const [focused, setFocused] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<AdminSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const open = focused && (query.trim().length > 0 || loading);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); inputRef.current?.focus(); setFocused(true); }
      if (e.key === 'Escape') { inputRef.current?.blur(); setFocused(false); setQuery(''); setResults([]); }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const fn = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setFocused(false);
    };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  const search = useCallback(async (q: string) => {
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    const [orgs, members] = await Promise.all([
      supabase.from('organizations').select('id, name').ilike('name', `%${q}%`).limit(5),
      supabase.from('profiles').select('id, display_name, email').or(`display_name.ilike.%${q}%,email.ilike.%${q}%`).limit(4),
    ]);
    const list: AdminSearchResult[] = [
      ...(orgs.data ?? []).map((o: any) => ({ id: o.id, kind: 'org' as const, title: o.name, sub: 'Client' })),
      ...(members.data ?? []).map((m: any) => ({ id: m.id, kind: 'member' as const, title: m.display_name ?? m.email, sub: m.email })),
    ];
    setResults(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => search(query), 280);
    return () => clearTimeout(t);
  }, [query, search]);

  return (
    <div ref={wrapRef} className="relative">
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border border-transparent transition-all duration-200 ${
        focused ? 'bg-[#F3F4F6] border-[#E5E7EB] w-56' : 'bg-transparent w-40 hover:bg-[#F3F4F6]'
      }`}>
        {loading
          ? <svg className="w-3.5 h-3.5 text-[#9CA3AF] animate-spin flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          : <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0"/></svg>
        }
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          placeholder={focused ? 'Search anything…' : 'Search  ?K'}
          className="flex-1 text-xs text-[#111827] placeholder-[#9CA3AF] focus:outline-none bg-transparent min-w-0"
        />
        {query && (
          <button onClick={() => { setQuery(''); setResults([]); inputRef.current?.focus(); }}
            className="text-[#9CA3AF] hover:text-[#374151] transition-colors flex-shrink-0">
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12"/></svg>
          </button>
        )}
      </div>

      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-72 bg-white rounded-xl shadow-lg overflow-hidden z-[200] border border-[#E5E7EB]"
          style={{ animation: 'slideDown 0.15s ease' }}>
          <style>{`@keyframes slideDown{from{opacity:0;transform:translateY(-6px)}to{opacity:1;transform:translateY(0)}}`}</style>
          {results.length > 0 ? (
            <div className="max-h-64 overflow-y-auto divide-y divide-[#F9FAFB]">
              {results.map(r => (
                <button key={r.id}
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => {
                    navigate(r.kind === 'org' ? '/clients' : '/users');
                    setFocused(false); setQuery(''); setResults([]);
                  }}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#FAFAF7] transition-colors text-left">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${r.kind === 'org' ? 'bg-[#D8CCFF] text-[#111111]' : 'bg-[#EDE9FE] text-[#5B21B6]'}`}>
                    {r.title[0]?.toUpperCase() ?? '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-[#111827] truncate">{r.title}</p>
                    <p className="text-xs text-[#9CA3AF] truncate">{r.sub}</p>
                  </div>
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${r.kind === 'org' ? 'bg-[#D8CCFF] text-[#111111]' : 'bg-[#EDE9FE] text-[#5B21B6]'}`}>
                    {r.kind === 'org' ? 'Org' : 'Member'}
                  </span>
                </button>
              ))}
            </div>
          ) : query.trim() && !loading ? (
            <div className="px-4 py-6 text-center text-xs text-[#9CA3AF]">No results for "{query}"</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

// -- Admin Notifications Bell --------------------------------------------------

interface AdminNotif {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

const NOTIF_ICON = {
  new_client: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/>
    </svg>
  ),
  subscription_up: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 10l7-7m0 0l7 7m-7-7v18"/>
    </svg>
  ),
  subscription_cancel: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/>
    </svg>
  ),
  google: (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 2.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
    </svg>
  ),
  default: (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
    </svg>
  ),
};

const NOTIF_STYLE: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  new_client:               { bg: 'bg-[#D8CCFF]',  text: 'text-[#111111]', icon: NOTIF_ICON.new_client },
  subscription_changed:     { bg: 'bg-[#EFF6FF]',  text: 'text-[#1D4ED8]', icon: NOTIF_ICON.subscription_up },
  subscription_cancelled:   { bg: 'bg-[#FEF2F2]',  text: 'text-[#DC2626]', icon: NOTIF_ICON.subscription_cancel },
  google_connected:         { bg: 'bg-[#F0F9FF]',  text: 'text-[#0369A1]', icon: NOTIF_ICON.google },
  google_disconnected:      { bg: 'bg-[#FFF7ED]',  text: 'text-[#C2410C]', icon: NOTIF_ICON.google },
};

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function notifRoute(type: string) {
  if (type === 'new_client') return '/clients';
  if (type.startsWith('subscription')) return '/billing';
  if (type.startsWith('google')) return '/clients';
  return '/';
}

function AdminNotificationsBell() {
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<AdminNotif[]>([]);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  useEffect(() => {
    supabase
      .from('admin_notifications')
      .select('id, type, title, body, is_read, created_at')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => { if (data) setNotifs(data as AdminNotif[]); });
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('admin_notifications_realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'admin_notifications' },
        (payload) => { setNotifs(prev => [payload.new as AdminNotif, ...prev].slice(0, 30)); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const unread = notifs.filter(n => !n.is_read).length;

  async function markAllRead() {
    const unreadIds = notifs.filter(n => !n.is_read).map(n => n.id);
    if (unreadIds.length === 0) return;
    await supabase.from('admin_notifications').update({ is_read: true }).in('id', unreadIds);
    setNotifs(prev => prev.map(n => ({ ...n, is_read: true })));
  }

  async function markRead(id: string) {
    await supabase.from('admin_notifications').update({ is_read: true }).eq('id', id);
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
  }

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg text-[#6B7280] hover:text-[#111827] hover:bg-[#F3F4F6] transition-colors"
        title="Notifications">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/>
        </svg>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-xl shadow-lg z-50 flex flex-col border border-[#E5E7EB]" style={{ maxHeight: '420px' }}>
          <div className="px-4 py-3 border-b border-[#F3F4F6] flex items-center justify-between flex-shrink-0">
            <p className="text-sm font-semibold text-[#111827]">Notifications</p>
            <button
              onClick={markAllRead}
              disabled={unread === 0}
              className="flex items-center gap-1.5 text-xs font-medium text-[#6C55E8] hover:text-[#5A42D1] disabled:text-[#D1D5DB] disabled:cursor-default transition-colors">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7"/>
              </svg>
              All read
            </button>
          </div>
          {notifs.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-[#9CA3AF]">All caught up!</div>
          ) : (
            <div className="divide-y divide-[#F9FAFB] overflow-y-auto">
              {notifs.map(n => {
                const style = NOTIF_STYLE[n.type] ?? { bg: 'bg-[#F3F4F6]', text: 'text-[#374151]', icon: NOTIF_ICON.default };
                return (
                  <button key={n.id}
                    onClick={() => { markRead(n.id); navigate(notifRoute(n.type)); setOpen(false); }}
                    className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-[#FAFAF7] transition-colors text-left ${!n.is_read ? 'bg-[#FDFCFF]' : ''}`}>
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 ${style.bg} ${style.text}`}>
                      {style.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <p className="text-xs font-semibold text-[#111827] truncate">{n.title}</p>
                        {!n.is_read && <span className="w-1.5 h-1.5 rounded-full bg-[#6C55E8] flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-[#6B7280] mt-0.5 line-clamp-2">{n.body}</p>
                    </div>
                    <span className="text-[10px] text-[#9CA3AF] flex-shrink-0 mt-0.5 whitespace-nowrap">{timeAgo(n.created_at)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// -- Admin Profile -------------------------------------------------------------

function AdminProfile() {
  const { user, platformRole } = useAdminAuthStore();
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user?.id) return;
    supabase.from('profiles').select('display_name, avatar_url').eq('id', user.id).maybeSingle()
      .then(({ data }) => {
        if (data?.display_name) setProfileName(data.display_name);
        if (data?.avatar_url)   setAvatarUrl(data.avatar_url);
      });
  }, [user?.id]);

  const email = user?.email ?? '';
  const displayName = profileName
    ?? user?.user_metadata?.display_name
    ?? user?.user_metadata?.full_name
    ?? email.split('@')[0]
    ?? '';
  const initials = displayName
    ? displayName.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
    : email.slice(0, 2).toUpperCase();
  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
    : null;
  const roleLabel = ROLE_LABEL[platformRole ?? ''] ?? platformRole ?? '';

  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);

  async function handleSignOut() {
    setSigningOut(true);
    await adminAuthService.logout();
    navigate('/auth/login', { replace: true });
  }

  const Avatar = ({ size }: { size: 'sm' | 'lg' }) => {
    const dim = size === 'sm' ? 'w-7 h-7 text-[11px]' : 'w-11 h-11 text-sm';
    return avatarUrl ? (
      <img src={avatarUrl} alt="avatar" className={`${dim} rounded-full object-cover flex-shrink-0`} />
    ) : (
      <div className={`${dim} rounded-full bg-[#111111] text-white flex items-center justify-center font-semibold flex-shrink-0`}>
        {initials}
      </div>
    );
  };

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-[#F3F4F6] transition-colors"
        title={displayName || email}>
        <Avatar size="sm" />
        <span className="text-sm font-medium text-[#111827] max-w-[120px] truncate">{displayName || email}</span>
        <svg className="w-3.5 h-3.5 text-[#9CA3AF] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-xl shadow-lg overflow-hidden z-50 border border-[#E5E7EB]">
          <div className="px-4 py-4 bg-[#FAFAF7] border-b border-[#E5E7EB] flex items-center gap-3">
            <Avatar size="lg" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-[#111827] truncate">{displayName}</p>
              <p className="text-xs text-[#6B7280] truncate mt-0.5">{email}</p>
              {roleLabel && (
                <span className="inline-block mt-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#D8CCFF] text-[#111111]">{roleLabel}</span>
              )}
              {memberSince && <p className="text-[10px] text-[#9CA3AF] mt-1">Member since {memberSince}</p>}
            </div>
          </div>
          <button
            onClick={() => { navigate('/profile'); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-[#374151] hover:bg-[#F9FAFB] transition-colors">
            <svg className="w-4 h-4 text-[#9CA3AF]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
            </svg>
            My Profile
          </button>
          <button onClick={handleSignOut} disabled={signingOut}
            className="w-full flex items-center gap-2.5 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50 border-t border-[#F3F4F6]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/>
            </svg>
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      )}
    </div>
  );
}

// -- Rail Profile + Logout Buttons --------------------------------------------

function RailProfileButton() {
  const { user } = useAdminAuthStore();
  const navigate  = useNavigate();
  const location  = useLocation();
  const isActive  = location.pathname === '/profile';

  async function handleLogout() {
    await adminAuthService.logout();
    navigate('/auth/login', { replace: true });
  }

  return (
    <div className="flex flex-col items-center gap-1 mb-1">
      {/* Profile */}
      <button
        onClick={() => navigate('/profile')}
        title="My Profile"
        className={`relative group w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${
          isActive
            ? 'bg-[#6C55E8] text-white'
            : 'text-white/40 hover:text-white hover:bg-white/10'
        }`}>
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/>
        </svg>
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-[#111111] border border-white/10 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
          My Profile
        </span>
      </button>

      {/* Logout */}
      <button
        onClick={handleLogout}
        title="Sign out"
        className="relative group w-10 h-10 rounded-lg flex items-center justify-center transition-colors text-white/40 hover:text-red-400 hover:bg-red-500/10">
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/>
        </svg>
        <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-[#111111] border border-white/10 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
          Sign out
        </span>
      </button>
    </div>
  );
}

// -- Settings Grouped Nav ------------------------------------------------------

function SettingsGroupedNav() {
  return (
    <div className="space-y-0.5">
      {NAV_SETTINGS_GROUPS.map(section => {
        if (!section.subItems) {
          return <NavItem key={section.to} to={section.to} label={section.label} icon={section.icon} end />;
        }
        return (
          <div key={section.label}>
            <p className="px-3 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
              {section.label}
            </p>
            <div className="ml-3 pl-3 border-l border-[#E5E7EB] space-y-0.5">
              {section.subItems.map(item => (
                <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} end={item.end} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// -- Layout --------------------------------------------------------------------

function NavItem({ to, label, icon, end }: { to: string; label: string; icon: React.ReactNode; end?: boolean | undefined }) {
  return (
    <NavLink
      to={to}
      {...(end !== undefined ? { end } : {})}
      className={({ isActive }) =>
        `relative flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          isActive
            ? 'bg-[#D8CCFF]/70 text-[#111111]'
            : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827]'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <span className={isActive ? 'text-[#6C55E8]' : 'text-[#9CA3AF]'}>{icon}</span>
          {label}
        </>
      )}
    </NavLink>
  );
}

export function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { platformRole } = useAdminAuthStore();

  const visibleRailGroups = RAIL_GROUPS.filter(g => !g.allowedRoles || g.allowedRoles.includes(platformRole ?? ''));
  const activeGroup = visibleRailGroups.find(g => g.test(location.pathname)) ?? visibleRailGroups[0]!;
  const navConfig = GROUP_NAV_CONFIG[activeGroup.label];
  const activeNavItems = (navConfig?.items ?? []).filter(item => !item.allowedRoles || item.allowedRoles.includes(platformRole ?? ''));
  const activeNavLabel = navConfig?.label ?? null;

  // Derive current page label for breadcrumb
  const allFlatItems: NavItemData[] = [
    ...NAV_DASHBOARD, ...NAV_CLIENTS, ...NAV_FINANCE,
    ...NAV_PLATFORM, ...NAV_ADMINISTRATION,
    ...NAV_SETTINGS_GROUPS.flatMap(g =>
      g.subItems ? g.subItems : [{ to: g.to, label: g.label, icon: g.icon }]
    ),
  ];
  const currentPage = allFlatItems.find(item =>
    location.pathname === item.to || location.pathname.startsWith(item.to + '/')
  )?.label ?? null;

  return (
    <div className="flex h-screen bg-[#F3F4F6] overflow-hidden">
      <ToastContainer />

      {/* -- Icon Rail -- */}
      <aside className="w-14 flex-shrink-0 bg-[#111111] flex flex-col items-center py-4 gap-1 z-20">
        {/* Logo */}
        <div className="mb-5 flex items-center justify-center">
          <img src="/images/fevicon.png" alt="Moffu" className="w-8 h-8 rounded-lg object-contain" />
        </div>

        {/* Group icons */}
        <div className="flex-1 flex flex-col items-center gap-1">
          {visibleRailGroups.map(group => {
            const isActive = group.test(location.pathname);
            return (
              <button
                key={group.label}
                onClick={() => navigate(group.to)}
                className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors relative group ${
                  isActive
                    ? 'bg-[#6C55E8] text-white'
                    : 'text-white/40 hover:text-white hover:bg-white/10'
                }`}
              >
                {group.icon}
                <span className="pointer-events-none absolute left-full ml-2 px-2 py-1 rounded-md bg-[#111111] border border-white/10 text-white text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity z-50 shadow-lg">
                  {group.label}
                </span>
              </button>
            );
          })}
        </div>

        {/* Profile avatar at bottom of rail */}
        <RailProfileButton />

      </aside>

      {/* -- Nav Sidebar -- */}
      <aside className="w-52 flex-shrink-0 bg-white border-r border-[#E5E7EB] flex flex-col z-10">
        {/* Header */}
        <div className="px-4 py-5 flex items-center justify-center flex-shrink-0">
          <img src="/images/logo.png" alt="Moffu" className="h-8 w-auto" />
        </div>

        {/* Nav — contextual: shows only the active group's items */}
        <nav className="flex-1 overflow-y-auto px-2.5 py-4 flex flex-col">
          <div className="flex-1">
            {activeGroup.label === 'Settings' ? (
              <SettingsGroupedNav />
            ) : (
              <div className="space-y-0.5">
                {activeNavLabel && (
                  <p className="px-3 mb-2 text-[9px] font-semibold uppercase tracking-[0.12em] text-[#9CA3AF]">
                    {activeNavLabel}
                  </p>
                )}
                {activeNavItems.map(item => (
                  <NavItem key={item.to} to={item.to} label={item.label} icon={item.icon} end={item.end} />
                ))}
              </div>
            )}
          </div>

          {/* Settings at bottom */}
        </nav>
      </aside>

      {/* -- Main Content -- */}
      <main className="flex-1 overflow-hidden flex flex-col min-w-0 z-30">
        {/* Topbar */}
        <div className="flex-shrink-0 h-14 flex items-center justify-between px-6 gap-4">
          {/* Left: breadcrumb */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-sm font-semibold text-[#111111]">{activeGroup.label}</span>
            {currentPage && (
              <>
                <svg className="w-3 h-3 text-[#D1D5DB] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7"/>
                </svg>
                <span className="text-sm text-[#6B7280] truncate">{currentPage}</span>
              </>
            )}
          </div>
          {/* Right: actions */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <AdminSearch />
            <AdminNotificationsBell />
            <AdminProfile />
          </div>
        </div>

        {/* Page area */}
        <div className="flex-1 overflow-hidden min-h-0">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
