// Persistent layout wrapper for all authenticated pages
import { useCallback, useState } from 'react'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = useCallback(() => setSidebarOpen(false), [])

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={closeSidebar} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      <main className="flex-1 lg:ml-48 min-w-0 p-4 lg:p-8">
        <button
          className="lg:hidden mb-4 text-text-muted hover:text-text"
          onClick={() => setSidebarOpen(true)}
        >
          <i className="ti ti-menu-2 text-xl pointer-events-none" aria-label="Open menu" />
        </button>
        {children}
      </main>
    </div>
  )
}
