// Persistent layout wrapper for all authenticated pages
import { useState } from 'react'
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-20 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <main className="flex-1 lg:ml-48 min-w-0 p-4 lg:p-8">
        <button
          className="lg:hidden mb-4 text-text-muted hover:text-text"
          onClick={() => setSidebarOpen(true)}
        >
          <i className="ti ti-menu-2 text-xl" aria-label="Open menu" />
        </button>
        {children}
      </main>
    </div>
  )
}
