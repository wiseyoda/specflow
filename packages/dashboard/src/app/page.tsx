'use client'

import { GridBackground, FloatingOrbs } from '@/components/design-system'
import { ProjectList } from '@/components/projects/project-list'
import { Plus } from 'lucide-react'

export default function Home() {
  return (
    <div className="min-h-screen bg-surface-50 text-white relative overflow-hidden">
      {/* Background decorations */}
      <GridBackground />
      <FloatingOrbs />

      {/* Header */}
      <header className="relative z-10 border-b border-surface-300 px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Logo */}
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent-dark flex items-center justify-center">
              <span className="text-sm font-bold text-white">SF</span>
            </div>
            <h1 className="text-lg font-semibold text-white">SpecFlow Dashboard</h1>
          </div>

          {/* Actions */}
          <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-accent/20 border border-accent/30 text-sm font-medium text-accent-light hover:bg-accent/30 transition-colors">
            <Plus className="w-4 h-4" />
            <span>New Project</span>
          </button>
        </div>
      </header>

      {/* Main content */}
      <main className="relative z-10 px-6 py-8">
        <div className="max-w-5xl mx-auto">
          <ProjectList />
        </div>
      </main>
    </div>
  )
}
