import { NavLink, Outlet } from 'react-router-dom';

const SETTINGS_NAV = [
  {
    to: '/settings/ai',
    label: 'AI Keys',
    description: 'Manage AI provider API keys',
    icon: (
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
      </svg>
    ),
  },
  {
    to: '/settings/google',
    label: 'Google API',
    description: 'Google Business Profile OAuth',
    icon: (
      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
      </svg>
    ),
  },
];

export function SettingsLayout() {
  return (
    <div className="flex h-full bg-[#F8FAF9]">
      {/* Settings left panel */}
      <aside className="w-60 flex-shrink-0 border-r border-[#E5EAE8] flex flex-col">
        <div className="px-5 py-5 border-b border-[#E5EAE8]">
          <h2 className="text-sm font-semibold text-[#111827]">Settings</h2>
          <p className="text-xs text-[#9CA3AF] mt-0.5">Platform configuration</p>
        </div>

        <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
          {SETTINGS_NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors border-l-2 group ${
                  isActive
                    ? 'bg-[#E6F2EE] text-[#0D4C3C] border-[#0D4C3C]'
                    : 'text-[#374151] hover:bg-[#F3F4F6] hover:text-[#111827] border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={isActive ? 'text-[#0D4C3C]' : 'text-[#6B7280] group-hover:text-[#374151]'}>
                    {item.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium leading-none">{item.label}</p>
                    <p className={`text-[11px] mt-0.5 truncate ${isActive ? 'text-[#2D7A5F]' : 'text-[#9CA3AF]'}`}>
                      {item.description}
                    </p>
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </nav>
      </aside>

      {/* Settings content area */}
      <div className="flex-1 overflow-hidden min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
