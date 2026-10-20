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
  // Future sections slot in here:
  // { to: '/settings/notifications', label: 'Notifications', description: 'Email & alert preferences', icon: ... },
  // { to: '/settings/integrations', label: 'Integrations', description: 'Third-party connections', icon: ... },
];

export function SettingsLayout() {
  return (
    <div className="flex h-full bg-[#F8FAF9]">
      {/* Settings left panel */}
      <aside className="w-60 flex-shrink-0 bg-white border-r border-[#E5EAE8] flex flex-col">
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
