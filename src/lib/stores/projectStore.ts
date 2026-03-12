import { create } from "zustand";
import type { Project, Task, ChatTurn, GodEyeEntry, UE5Command } from "@/lib/types";

interface ProjectState {
  project: Project | null;
  tasks: Task[];
  chatTurns: ChatTurn[];
  godEyeLog: GodEyeEntry[];
  ue5Commands: UE5Command[];
  isFullProjectRunning: boolean;
  isFullProjectPaused: boolean;
  isRelayConnected: boolean;

  setProject: (project: Project | null) => void;
  setTasks: (tasks: Task[]) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, updates: Partial<Task>) => void;
  setChatTurns: (turns: ChatTurn[]) => void;
  addChatTurn: (turn: ChatTurn) => void;
  setGodEyeLog: (entries: GodEyeEntry[]) => void;
  addGodEyeEntry: (entry: GodEyeEntry) => void;
  setUE5Commands: (commands: UE5Command[]) => void;
  addUE5Command: (command: UE5Command) => void;
  updateUE5Command: (id: string, updates: Partial<UE5Command>) => void;
  setFullProjectRunning: (running: boolean) => void;
  setFullProjectPaused: (paused: boolean) => void;
  setRelayConnected: (connected: boolean) => void;
  reset: () => void;
}

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  tasks: [],
  chatTurns: [],
  godEyeLog: [],
  ue5Commands: [],
  isFullProjectRunning: false,
  isFullProjectPaused: false,
  isRelayConnected: false,

  setProject: (project) => set({ project }),
  setTasks: (tasks) => set({ tasks }),
  addTask: (task) => set((s) => ({ tasks: [...s.tasks, task] })),
  updateTask: (id, updates) =>
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    })),
  setChatTurns: (chatTurns) => set({ chatTurns }),
  addChatTurn: (turn) =>
    set((s) => {
      if (s.chatTurns.some((t) => t.id === turn.id)) return s;
      return { chatTurns: [...s.chatTurns, turn] };
    }),
  setGodEyeLog: (godEyeLog) => set({ godEyeLog }),
  addGodEyeEntry: (entry) =>
    set((s) => ({
      godEyeLog: [...s.godEyeLog.slice(-199), entry],
    })),
  setUE5Commands: (ue5Commands) => set({ ue5Commands }),
  addUE5Command: (command) =>
    set((s) => ({ ue5Commands: [...s.ue5Commands, command] })),
  updateUE5Command: (id, updates) =>
    set((s) => ({
      ue5Commands: s.ue5Commands.map((c) =>
        c.id === id ? { ...c, ...updates } : c
      ),
    })),
  setFullProjectRunning: (isFullProjectRunning) => set({ isFullProjectRunning, isFullProjectPaused: false }),
  setFullProjectPaused: (isFullProjectPaused) => set({ isFullProjectPaused }),
  setRelayConnected: (isRelayConnected) => set({ isRelayConnected }),
  reset: () =>
    set({
      project: null,
      tasks: [],
      chatTurns: [],
      godEyeLog: [],
      ue5Commands: [],
      isFullProjectRunning: false,
      isFullProjectPaused: false,
      isRelayConnected: false,
    }),
}));
