import { create } from "zustand";
import type {
  Project,
  Task,
  ChatTurn,
  GodEyeEntry,
  UE5Command,
  WorldStateEntity,
  AgentStatus,
  AgentName,
} from "@/lib/agents/types";

interface ProjectState {
  project: Project | null;
  tasks: Task[];
  chatTurns: ChatTurn[];
  godEyeLog: GodEyeEntry[];
  ue5Commands: UE5Command[];
  worldState: WorldStateEntity[];
  agentStatuses: Record<AgentName, AgentStatus>;
  isAutonomousRunning: boolean;
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
  setWorldState: (entities: WorldStateEntity[]) => void;
  setAgentStatus: (name: AgentName, state: AgentStatus["state"]) => void;
  setAutonomousRunning: (running: boolean) => void;
  setRelayConnected: (connected: boolean) => void;
  reset: () => void;
}

const defaultAgentStatuses: Record<AgentName, AgentStatus> = {
  Nima: { name: "Nima", state: "idle" },
  Alex: { name: "Alex", state: "idle" },
  Thomas: { name: "Thomas", state: "idle" },
  Elena: { name: "Elena", state: "idle" },
  Morgan: { name: "Morgan", state: "idle" },
};

export const useProjectStore = create<ProjectState>((set) => ({
  project: null,
  tasks: [],
  chatTurns: [],
  godEyeLog: [],
  ue5Commands: [],
  worldState: [],
  agentStatuses: { ...defaultAgentStatuses },
  isAutonomousRunning: false,
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
  setWorldState: (worldState) => set({ worldState }),
  setAgentStatus: (name, state) =>
    set((s) => ({
      agentStatuses: {
        ...s.agentStatuses,
        [name]: { ...s.agentStatuses[name], state, lastActive: new Date().toISOString() },
      },
    })),
  setAutonomousRunning: (isAutonomousRunning) => set({ isAutonomousRunning }),
  setRelayConnected: (isRelayConnected) => set({ isRelayConnected }),
  reset: () =>
    set({
      project: null,
      tasks: [],
      chatTurns: [],
      godEyeLog: [],
      ue5Commands: [],
      worldState: [],
      agentStatuses: { ...defaultAgentStatuses },
      isAutonomousRunning: false,
      isRelayConnected: false,
    }),
}));
