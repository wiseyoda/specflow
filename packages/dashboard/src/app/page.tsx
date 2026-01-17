import { MainLayout } from "@/components/layout/main-layout"
import { ProjectList } from "@/components/projects/project-list"

export default function Home() {
  return (
    <MainLayout>
      <div className="max-w-4xl">
        <ProjectList />
      </div>
    </MainLayout>
  )
}
