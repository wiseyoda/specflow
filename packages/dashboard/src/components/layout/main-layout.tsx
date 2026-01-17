import { Sidebar } from "./sidebar"
import { Header } from "./header"

interface MainLayoutProps {
  children: React.ReactNode
  headerActions?: React.ReactNode
}

export function MainLayout({ children, headerActions }: MainLayoutProps) {
  return (
    <div className="flex h-screen bg-white dark:bg-neutral-950">
      <Sidebar />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header>{headerActions}</Header>
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
