import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  godEyeExpanded: boolean;
  taskBoardVisible: boolean;
  ue5ConsoleVisible: boolean;
  activeTab: "chat" | "tasks" | "world" | "lore";
  godEyeFilter: string | null;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleGodEye: () => void;
  setGodEyeExpanded: (expanded: boolean) => void;
  setTaskBoardVisible: (visible: boolean) => void;
  setUE5ConsoleVisible: (visible: boolean) => void;
  setActiveTab: (tab: UIState["activeTab"]) => void;
  setGodEyeFilter: (filter: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  godEyeExpanded: false,
  taskBoardVisible: false,
  ue5ConsoleVisible: false,
  activeTab: "chat",
  godEyeFilter: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleGodEye: () => set((s) => ({ godEyeExpanded: !s.godEyeExpanded })),
  setGodEyeExpanded: (godEyeExpanded) => set({ godEyeExpanded }),
  setTaskBoardVisible: (taskBoardVisible) => set({ taskBoardVisible }),
  setUE5ConsoleVisible: (ue5ConsoleVisible) => set({ ue5ConsoleVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setGodEyeFilter: (godEyeFilter) => set({ godEyeFilter }),
}));
