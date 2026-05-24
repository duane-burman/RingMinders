// Fixed sidebar navigation with branding, nav links, and sign out
import { NavLink, useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'

const navItems = [
  { label: 'Dashboard', icon: 'ti-layout-dashboard', to: '/dashboard' },
  { label: 'Users', icon: 'ti-users', to: '/users' },
  { label: 'Reminders', icon: 'ti-bell', to: '/reminders' },
  { label: 'Call Log', icon: 'ti-phone', to: '/call-log' },
  { label: 'Reports', icon: 'ti-chart-bar', to: '/reports' },
  { label: 'Settings', icon: 'ti-settings', to: '/settings' },
]

export function Sidebar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside className="fixed top-0 left-0 h-screen w-48 bg-sidebar-bg flex flex-col">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-text/20">
        <div className="text-sidebar-active font-semibold text-sm">RingMinder</div>
        <div className="text-sidebar-text text-xs mt-0.5">It actually calls you back.</div>
      </div>

      {/* Nav items */}
      <nav className="flex-1 py-3">
        {navItems.map(({ label, icon, to }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-2 text-sm border-l-2 transition-colors ${
                isActive
                  ? 'text-white border-sidebar-active bg-sidebar-active/10'
                  : 'text-sidebar-text border-transparent hover:text-white hover:bg-white/5'
              }`
            }
          >
            <i className={`ti ${icon} text-base`} />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* User + sign out */}
      <div className="px-4 py-4 border-t border-sidebar-text/20">
        <div className="text-sidebar-text text-xs truncate mb-2">{user?.email}</div>
        <button
          onClick={handleSignOut}
          className="text-sidebar-text text-xs hover:text-white transition-colors"
        >
          Sign out
        </button>
      </div>
    </aside>
  )
}
