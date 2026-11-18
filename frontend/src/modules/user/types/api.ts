export interface ApiErrorShape {
  message: string;
  status?: number;
  code?: string;
  offline?: boolean;
  notFound?: boolean;
}

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface LocationPrefill {
  address: string;
  ward: string;
  gps: string | null;
}

export interface ReportPrefill {
  imageThumb: string | null;
  analysisId: string;
  categoryId: import("./community").IssueCategory;
  projectId: string | null;
  summary: string;
}

export interface ChatMessageAction {
  label: string;
  icon?: string;
  route?: string;
  action?: "report-location" | "report-map";
}

export type AssistantSource = "ai" | "project_data";

export interface ChatMessage {
  role: "user" | "assistant";
  text: string;
  actions?: ChatMessageAction[];
  chips?: string[];
  /** Where an assistant answer came from (backend /api/ai/ask). */
  source?: AssistantSource | null;
  model?: string | null;
  /** True when this bubble is an honest failure notice, not an answer. */
  error?: boolean;
}

export interface AssistantReply {
  text: string;
  actions?: ChatMessageAction[];
  chips?: string[];
  source?: AssistantSource | null;
  model?: string | null;
  projects?: unknown[];
}

export interface ToastItem {
  id: number;
  message: string;
  type: "success" | "error" | "info";
}
