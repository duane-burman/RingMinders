// Persistent layout wrapper for all authenticated pages
import { Sidebar } from './Sidebar'

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 ml-48 p-8">
        {children}
      </main>
    </div>
  )
}
