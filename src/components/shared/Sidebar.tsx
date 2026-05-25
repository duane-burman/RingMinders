// Fixed sidebar navigation with branding, nav links, and sign out
import { useEffect } from 'react'
import logo from '@/assets/logo-horizontal.png'
import { NavLink, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'

const navItems = [
  { label: 'Dashboard', icon: 'ti-layout-dashboard', to: '/dashboard' },
  { label: 'Users', icon: 'ti-users', to: '/users' },
  { label: 'Reminders', icon: 'ti-bell', to: '/reminders' },
  { label: 'Call Log', icon: 'ti-phone', to: '/call-log' },
  { label: 'Reports', icon: 'ti-chart-bar', to: '/reports' },
  { label: 'Settings', icon: 'ti-settings', to: '/settings' },
]

interface SidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Close sidebar on route change (mobile)
  useEffect(() => {
    onClose()
  }, [location.pathname, onClose])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <aside className={cn(
      'fixed top-0 left-0 h-full w-48 bg-sidebar-bg flex flex-col z-30 transition-transform duration-200',
      'lg:translate-x-0',
      isOpen ? 'translate-x-0' : '-translate-x-full'
    )}>
      {/* Logo */}
      <div className="px-4 py-5 border-b border-sidebar-text/20">
        <img src={logo} alt="RingMinders" className="h-20 w-auto" />
      </div>

      {/* Close button — mobile only */}
      <button
        className="lg:hidden absolute top-4 right-4 text-sidebar-text hover:text-white"
        onClick={onClose}
        aria-label="Close menu"
      >
        <i className="ti ti-x text-lg" />
      </button>

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
