"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ProjectLauncher from "@/app/components/project-creation/project-launcher";

export default function CreatePage() {
  const router = useRouter();

  const handleProjectSelect = (projectId: string) => {
    // Navigate to the editor with the selected project
    router.push(`/editor/${projectId}`);
  };

  return <ProjectLauncher onProjectSelect={handleProjectSelect} />;
}
