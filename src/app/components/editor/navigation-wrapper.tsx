"use client";

import { useEditor } from "./context/editor-context";
import EditorNavigation from "./navigation";

interface NavigationWrapperProps {
  projectName: string;
  projectId?: string;
  onLogout?: () => void;
  isLoading?: boolean;
  isSaving?: boolean;
  lastSaved?: Date | null;
  onSave?: () => Promise<void>;
}

export default function NavigationWrapper(props: NavigationWrapperProps) {
  const { state } = useEditor();

  return (
    <EditorNavigation
      {...props}
      hasUnsavedChanges={state.hasUnsavedChanges}
      isSaving={props.isSaving || state.isSaving}
      lastSaved={props.lastSaved || state.lastSaved}
    />
  );
}
