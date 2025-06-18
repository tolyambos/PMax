"use client";

import { useRouter } from "next/navigation";
import MainNavigation from "@/app/components/navigation/main-nav";
import ProjectLauncher from "@/app/components/project-creation/project-launcher";

export default function CreatePage() {
  const router = useRouter();

  const handleProjectSelect = (projectId: string) => {
    // Navigate to the editor with the selected project
    router.push(`/editor/${projectId}`);
  };

  return (
    <div className="min-h-screen bg-background">
      <MainNavigation />
      <ProjectLauncher onProjectSelect={handleProjectSelect} />
    </div>
  );
}
