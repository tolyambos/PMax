"use client";

import { useState } from "react";
import { Button } from "@/app/components/ui/button";
import UploadModal from "./upload-modal";

interface UploadButtonProps {
  onUploadComplete?: () => void;
}

export default function UploadButton({ onUploadComplete }: UploadButtonProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <>
      <Button onClick={() => setIsModalOpen(true)}>Upload Asset</Button>

      <UploadModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUploadComplete={onUploadComplete}
      />
    </>
  );
}
