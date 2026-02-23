export type Provider = "openrouter";

export type AgentName = "Nima" | "Alex" | "Thomas" | "Elena" | "Morgan" | "Sana" | "Amir";

export type TurnType =
  | "proposal"
  | "critique"
  | "resolution"
  | "discussion"
  | "consultation"
  | "routing"
  | "execution"
  | "boss_command"
  | "direct"
  | "direct_command";

export type TaskStatus = "pending" | "in_progress" | "completed" | "rejected" | "blocked";

export type ProjectStatus = "active" | "paused" | "completed";

export type GodEyeEventType =
  | "thinking"
  | "api_call"
  | "api_ok"
  | "fallback"
  | "turn"
  | "boss"
  | "execution"
  | "screenshot"
  | "error"
  | "routing"
  | "debug"
  | "debug_success";

export type UE5CommandStatus = "pending" | "executing" | "success" | "error";

export interface AgentIdentity {
  name: AgentName;
  title: string;
  provider: Provider;
  model: string;
  maxTokens: number;
  colorClass: string;
  colorHex: string;
  icon: string;
  systemPromptExtra: string;
}

export interface Project {
  id: string;
  name: string;
  initial_prompt: string;
  summary: string;
  status: ProjectStatus;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  assigned_to: string;
  depends_on: string[];
  status: TaskStatus;
  result: string;
  order_index: number;
  created_at: string;
  completed_at: string | null;
}

export interface ChatTurn {
  id: number;
  project_id: string;
  agent_name: string;
  agent_title: string;
  content: string;
  turn_type: TurnType;
  task_id: string | null;
  created_at: string;
  screenshot_url?: string | null;
  attachment_url?: string | null;
  user_email?: string | null;
  user_name?: string | null;
}

export interface Decision {
  id: number;
  project_id: string;
  decision: string;
  rationale: string;
  created_at: string;
}

export interface GodEyeEntry {
  id: number;
  project_id: string | null;
  event_type: GodEyeEventType;
  agent_name: string;
  detail: string;
  created_at: string;
  user_email?: string | null;
  user_name?: string | null;
}

export interface UE5Command {
  id: string;
  project_id: string | null;
  code: string;
  status: UE5CommandStatus;
  result: string;
  error_log: string;
  created_at: string;
  executed_at: string | null;
  screenshot_url?: string | null;
  submitted_by_email?: string | null;
  submitted_by_name?: string | null;
}

export interface WorldStateEntity {
  id: number;
  project_id: string;
  entity_type: string;
  entity_id: string;
  attributes: Record<string, unknown>;
  updated_at: string;
}

export interface GameLoreEntry {
  id: number;
  project_id: string;
  category: string;
  key: string;
  value: string;
  updated_at: string;
}

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface TaskBreakdown {
  tasks: {
    title: string;
    assigned_to: AgentName;
    depends_on: string[];
    description: string;
  }[];
}

export interface AgentStatus {
  name: AgentName;
  state: "idle" | "thinking" | "consulting" | "responding" | "error";
  lastActive?: string;
}

export type MemoryType = "decision" | "task" | "learning" | "preference";

export interface AgentMemory {
  id: string;
  project_id: string;
  agent_name: string;
  memory_type: MemoryType;
  content: string;
  context: string;
  created_at: string;
}
