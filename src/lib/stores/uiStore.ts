import { create } from "zustand";

interface UIState {
  sidebarOpen: boolean;
  godEyeExpanded: boolean;
  taskBoardVisible: boolean;
  ue5ConsoleVisible: boolean;
  liveViewVisible: boolean;
  pipViewportVisible: boolean;
  activeTab: "chat" | "tasks" | "world" | "lore";
  godEyeFilter: string | null;
  sketchfabModalOpen: boolean;
  voiceModalOpen: boolean;
  musicModalOpen: boolean;
  trailerModalOpen: boolean;
  imageTo3DModalOpen: boolean;
  chatPresetMessage: string | null;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  toggleGodEye: () => void;
  setGodEyeExpanded: (expanded: boolean) => void;
  setTaskBoardVisible: (visible: boolean) => void;
  setUE5ConsoleVisible: (visible: boolean) => void;
  setLiveViewVisible: (visible: boolean) => void;
  setPipViewportVisible: (visible: boolean) => void;
  setActiveTab: (tab: UIState["activeTab"]) => void;
  setGodEyeFilter: (filter: string | null) => void;
  setSketchfabModalOpen: (open: boolean) => void;
  setVoiceModalOpen: (open: boolean) => void;
  setMusicModalOpen: (open: boolean) => void;
  setTrailerModalOpen: (open: boolean) => void;
  setImageTo3DModalOpen: (open: boolean) => void;
  setChatPresetMessage: (msg: string | null) => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  godEyeExpanded: false,
  taskBoardVisible: false,
  ue5ConsoleVisible: false,
  liveViewVisible: false,
  pipViewportVisible: false,
  activeTab: "chat",
  godEyeFilter: null,
  sketchfabModalOpen: false,
  voiceModalOpen: false,
  musicModalOpen: false,
  trailerModalOpen: false,
  imageTo3DModalOpen: false,
  chatPresetMessage: null,

  toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  toggleGodEye: () => set((s) => ({ godEyeExpanded: !s.godEyeExpanded })),
  setGodEyeExpanded: (godEyeExpanded) => set({ godEyeExpanded }),
  setTaskBoardVisible: (taskBoardVisible) => set({ taskBoardVisible }),
  setUE5ConsoleVisible: (ue5ConsoleVisible) => set({ ue5ConsoleVisible }),
  setLiveViewVisible: (liveViewVisible) => set({ liveViewVisible }),
  setPipViewportVisible: (pipViewportVisible) => set({ pipViewportVisible }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setGodEyeFilter: (godEyeFilter) => set({ godEyeFilter }),
  setSketchfabModalOpen: (sketchfabModalOpen) => set({ sketchfabModalOpen }),
  setVoiceModalOpen: (voiceModalOpen) => set({ voiceModalOpen }),
  setMusicModalOpen: (musicModalOpen) => set({ musicModalOpen }),
  setTrailerModalOpen: (trailerModalOpen) => set({ trailerModalOpen }),
  setImageTo3DModalOpen: (imageTo3DModalOpen) => set({ imageTo3DModalOpen }),
  setChatPresetMessage: (chatPresetMessage) => set({ chatPresetMessage }),
}));
