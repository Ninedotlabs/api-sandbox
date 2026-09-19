import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ProgressKey = "tested" | "viewedDocs";
export type ProjectProgress = Partial<Record<ProgressKey, boolean>>;

interface UiState {
  commandOpen: boolean;
  progress: Record<string, ProjectProgress>;
  setCommandOpen(open: boolean): void;
  markProgress(projectId: string, key: ProgressKey): void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      commandOpen: false,
      progress: {},
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
      partialize: (s) => ({ progress: s.progress }),
    },
  ),
);
