"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import EnhancedUploadModal from "./enhanced-upload-modal";
import { Plus } from "lucide-react";

interface EnhancedUploadButtonProps {
  variant?: "default" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg";
  fullWidth?: boolean;
  onUploadComplete?: () => void;
}

export default function EnhancedUploadButton({
  variant = "default",
  size = "default",
  fullWidth = false,
  onUploadComplete,
}: EnhancedUploadButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button
        onClick={() => setIsModalOpen(true)}
        variant={variant}
        size={size}
        className={fullWidth ? "w-full" : ""}
      >
        <Plus className="mr-2 w-4 h-4" />
        Add Asset
      </Button>

      <EnhancedUploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUploadComplete={onUploadComplete}
      />
    </>
  );
}
