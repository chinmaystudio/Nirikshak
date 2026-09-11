export const ROUTES = {
  HOME: "#/home",
  LOGIN: "#/login",
  REGISTER: "#/register",
  PROJECTS: "#/projects",
  REPORT: "#/report",
  REPORT_SUCCESS: "#/report/success",
  COMPLAINTS: "#/complaints",
  COMMUNITY: "#/community",
  ALERTS: "#/alerts",
  VISION: "#/vision",
  VISION_HISTORY: "#/vision/history",
  ASSISTANT: "#/assistant",
  PROFILE: "#/profile",
  SETTINGS: "#/settings"
} as const;

export const projectRoute = (id: string): string => `#/projects/${encodeURIComponent(id)}`;
export const complaintRoute = (id: string): string => `#/complaints/${encodeURIComponent(id)}`;
export const communityIssueRoute = (id: string): string => `#/community/${encodeURIComponent(id)}`;
export const alertRoute = (id: string): string => `#/alerts/${encodeURIComponent(id)}`;
export const visionResultRoute = (id: string): string => `#/vision/result/${encodeURIComponent(id)}`;
