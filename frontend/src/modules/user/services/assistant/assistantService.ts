import { humanHeaders } from "@/core/security/turnstile";
import type { AssistantReply, ChatMessage } from "@/types/api";
import { ApiError, fetchWithTimeout, offlineGuard } from "@/services/api/client";
import { environment } from "@/config/environment";

export interface AssistantContext {
  projectId?: string;
}

/**
 * The civic assistant is the backend `POST /api/ai/ask` endpoint: an
 * AI answer grounded in live project data, or a deterministic answer built
 * from project rows (source "project_data"). There is no local canned-answer
 * engine and no simulated latency — failures surface as errors.
 */
export async function respond(text: string, _ctx: AssistantContext | null): Promise<AssistantReply> {
  offlineGuard();
  const baseUrl = environment.apiBaseUrl.replace(/\/$/, "");
  if (!baseUrl) {
    throw new ApiError({ message: "Assistant service is not configured (missing API base URL)." });
  }

  const human = await humanHeaders();
  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/api/ai/ask`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...human },
      body: JSON.stringify({ question: text })
    });
  } catch {
    throw new ApiError({ message: "Assistant service is temporarily unavailable. Please try again." });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success || typeof result?.data?.answer !== "string") {
    throw new ApiError({
      message: result?.error?.message || `Assistant request failed (HTTP ${response.status}).`,
      status: response.status,
      code: result?.error?.code
    });
  }

  const data = result.data as {
    answer: string;
    model: string | null;
    source: "ai" | "project_data";
    projects?: unknown[];
  };

  const reply: AssistantReply = {
    text: data.answer,
    source: data.source ?? null,
    model: data.model ?? null,
    projects: Array.isArray(data.projects) ? data.projects : []
  };
  if (reply.projects && reply.projects.length > 0) {
    reply.actions = [{ label: "Browse Projects", icon: "open_in_new", route: "#/projects" }];
  }
  return reply;
}

export function initialChatMessage(): ChatMessage {
  return {
    role: "assistant",
    text: 'Namaste. I am your NIRIKSHAK civic assistant. Ask me anything about public infrastructure projects — answers come from live project records and the AI service.',
    actions: [
      { label: "Find a project", icon: "search", route: "#/projects" },
      { label: "Report an issue", icon: "report", action: "report-map" },
      { label: "Identify with a photo", icon: "photo_camera", route: "#/vision" },
      { label: "Track complaint", icon: "receipt_long", route: "#/complaints" },
      { label: "Show nearby alerts", icon: "notifications_active", route: "#/alerts" }
    ],
    chips: ["What projects are near me?", "Why is a project delayed?", "How much money has been spent?", "Who is responsible for this road?"]
  };
}
