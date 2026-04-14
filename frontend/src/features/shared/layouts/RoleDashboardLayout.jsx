import React, { useMemo, useState } from 'react';
import { BrainIcon, BellIcon, LogOutIcon } from '../icons';

const RoleDashboardLayout = ({
  title,
  subtitle,
  userName,
  userSubtitle,
  notificationsCount = 0,
  onLogout,
  sidebarItems = [],
  activeKey,
  onSidebarSelect,
  children,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const initials = useMemo(() => {
    if (!userName) return 'U';
    const parts = userName.split(' ').filter(Boolean);
    return (parts[0]?.[0] || '') + (parts[1]?.[0] || '');
  }, [userName]);

  return (
    <div className="min-h-screen bg-[#0a0118] text-white">
      <div className="flex min-h-screen">
        <aside
          className={`fixed z-40 inset-y-0 left-0 w-72 bg-[#120624] border-r border-white/10 transform transition-transform duration-300 lg:translate-x-0 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="h-16 px-5 border-b border-white/10 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-purple-600 to-violet-600 flex items-center justify-center text-white">
              <BrainIcon />
            </div>
            <div>
              <h1 className="text-sm font-bold">ALZCare.eg</h1>
              <p className="text-xs text-gray-400">{subtitle}</p>
            </div>
          </div>

          <nav className="p-4 space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.key}
                onClick={() => {
                  onSidebarSelect?.(item.key);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all border ${
                  activeKey === item.key
                    ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                    : 'bg-transparent border-transparent text-gray-300 hover:bg-white/[0.04] hover:text-white'
                }`}
              >
                <item.icon />
                <span className="text-sm font-medium">{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        {mobileMenuOpen && (
          <button
            className="fixed inset-0 z-30 bg-black/60 lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close menu"
          />
        )}

        <div className="flex-1 lg:ml-72">
          <header className="sticky top-0 z-20 h-16 bg-[#0a0118]/90 backdrop-blur-xl border-b border-white/10 px-4 sm:px-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setMobileMenuOpen((v) => !v)}
                className="lg:hidden p-2 rounded-lg border border-white/10 text-gray-300 hover:text-white hover:bg-white/[0.05]"
                aria-label="Toggle menu"
              >
                <span className="block w-4 h-0.5 bg-current mb-1" />
                <span className="block w-4 h-0.5 bg-current mb-1" />
                <span className="block w-4 h-0.5 bg-current" />
              </button>
              <div>
                <p className="text-sm text-gray-400">{title}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                <BellIcon />
                {notificationsCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                )}
              </button>

              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium text-white">{userName}</p>
                <p className="text-xs text-gray-500">{userSubtitle}</p>
              </div>

              <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 to-violet-500 flex items-center justify-center text-white font-semibold">
                {initials || 'U'}
              </div>

              <button
                onClick={onLogout}
                className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                title="Logout"
              >
                <LogOutIcon />
              </button>
            </div>
          </header>

          <main className="p-4 sm:p-6 lg:p-8">{children}</main>
        </div>
      </div>
    </div>
  );
};

export default RoleDashboardLayout;
