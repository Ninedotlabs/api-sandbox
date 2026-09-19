import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProgressKey = "tested" | "viewedDocs";
export type ProjectProgress = Partial<Record<ProgressKey, boolean>>;

interface UiState {
  sidebarCollapsed: boolean;
  commandOpen: boolean;
  progress: Record<string, ProjectProgress>;
  toggleSidebar(): void;
  setCommandOpen(open: boolean): void;
  markProgress(projectId: string, key: ProgressKey): void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      commandOpen: false,
      progress: {},
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setCommandOpen: (open) => set({ commandOpen: open }),
      markProgress: (projectId, key) =>
        set((s) =>
          s.progress[projectId]?.[key]
            ? s
            : { progress: { ...s.progress, [projectId]: { ...s.progress[projectId], [key]: true } } },
        ),
    }),
    {
      name: "universal-api:ui:v1",
      partialize: (s) => ({ sidebarCollapsed: s.sidebarCollapsed, progress: s.progress }),
    },
  ),
);
