import type { Complaint, EvidenceItem, NewComplaintPayload, ComplaintFeedback } from "@/types/complaint";
import { ApiError, latency, offlineGuard } from "@/services/api/client";
import { complaints, slaFromNow } from "@/data/complaints";
import { appStore } from "@/app/providers/store";

const HOUR = 3600_000;

function allComplaints(): Complaint[] {
  return [...complaints, ...appStore.getState().created].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );
}

export async function getMyComplaints(): Promise<Complaint[]> {
  offlineGuard();
  await latency(300, 600);
  return allComplaints();
}

export async function getComplaintById(id: string): Promise<Complaint> {
  offlineGuard();
  await latency(250, 500);
  const found = allComplaints().find((c) => c.id === id);
  if (!found) {
    throw new ApiError({ message: `Complaint ${id} was not found. Check the reference number and try again.`, notFound: true });
  }
  return found;
}

function isMutable(id: string): boolean {
  return appStore.getState().created.some((c) => c.id === id);
}

function mutateGuard(id: string): void {
  if (!isMutable(id)) {
    throw new ApiError({
      message:
        "This complaint is part of the demo ledger and cannot be modified in the prototype. Actions are available on complaints you file during the session."
    });
  }
}

function updateCreated(id: string, fn: (c: Complaint) => Complaint): Promise<Complaint> {
  return latency(350, 650).then(() => {
    const created = appStore.getState().created.map((c) => (c.id === id ? fn({ ...c, updatedAt: new Date().toISOString() }) : c));
    appStore.setState({ created });
    const updated = created.find((c) => c.id === id);
    if (!updated) throw new ApiError({ message: "Complaint not found." });
    return updated;
  });
}

let evidenceSeq = 0;

export async function createComplaint(payload: NewComplaintPayload): Promise<Complaint> {
  offlineGuard();
  await latency(700, 1200);
  const id = `CMP-2026-${Math.floor(100000 + Math.random() * 900000)}`;
  const now = new Date();
  const nowIso = now.toISOString();
  const slaHours = payload.priority === "critical" ? 12 : payload.priority === "high" ? 24 : payload.priority === "medium" ? 48 : 72;
  evidenceSeq += 1;
  const complaint: Complaint = {
    id,
    title: payload.title,
    category: payload.category,
    categoryLabel: payload.categoryLabel,
    priority: payload.priority,
    projectId: payload.projectId,
    ward: payload.ward,
    location: payload.location,
    description: payload.description,
    status: "under-review",
    submittedAt: nowIso,
    updatedAt: nowIso,
    sla: { deadline: slaFromNow(slaHours), totalHours: slaHours },
    department: payload.department,
    officer: null,
    evidence: payload.evidence.map((e, i) => ({
      ...e,
      id: `ev-${id}-${i + 1}`,
      meta: e.meta || `GPS attached • ${nowIso.slice(0, 10)}`
    })),
    timeline: [
      {
        id: `tl-${id}-1`,
        title: "Complaint Submitted",
        description: `Submitted via Nirikshan Citizen Portal${payload.evidence.length > 0 ? ` with ${payload.evidence.length} evidence item(s).` : "."}`,
        timestamp: nowIso,
        actor: "You",
        status: "completed"
      },
      {
        id: `tl-${id}-2`,
        title: "AI Verification",
        description: `AI classified: ${payload.categoryLabel} • Severity ${payload.aiSeverity ?? payload.priority} • Confidence ${payload.aiConfidence ?? 90}%.${payload.aiProjectName ? ` Matched to ${payload.aiProjectName}.` : ""}`,
        timestamp: new Date(now.getTime() + 60_000).toISOString(),
        actor: "Nirikshan AI",
        status: "completed"
      },
      {
        id: `tl-${id}-3`,
        title: `Assignment to ${payload.department}`,
        description: "Pending — routed to the concerned department queue.",
        timestamp: null,
        actor: "Grievance Cell",
        status: "upcoming"
      },
      { id: `tl-${id}-4`, title: "Field Action", description: "Pending assignment.", timestamp: null, actor: "—", status: "upcoming" },
      { id: `tl-${id}-5`, title: "Citizen Verification & Closure", description: "Pending.", timestamp: null, actor: "You", status: "upcoming" }
    ],
    officerNote: null,
    resolution: null,
    feedback: null
  };
  appStore.setState({ created: [complaint, ...appStore.getState().created] });
  return complaint;
}

export async function addEvidence(id: string, file: { name: string; size: string; thumb?: string | null }): Promise<Complaint> {
  mutateGuard(id);
  evidenceSeq += 1;
  return updateCreated(id, (c) => ({
    ...c,
    evidence: [
      ...c.evidence,
      {
        id: `ev-add-${evidenceSeq}`,
        name: file.name,
        size: file.size,
        kind: "image",
        meta: `GPS attached • ${new Date().toISOString().slice(0, 10)}`,
        tone: c.category,
        thumb: file.thumb ?? null
      }
    ],
    timeline: [
      ...c.timeline,
      {
        id: `tl-${id}-ev-${evidenceSeq}`,
        title: "Additional Evidence Added",
        description: "Citizen attached 1 more evidence item for review.",
        timestamp: new Date().toISOString(),
        actor: "You",
        status: "completed"
      }
    ]
  }));
}

export async function reopenComplaint(id: string, reason?: string): Promise<Complaint> {
  mutateGuard(id);
  return updateCreated(id, (c) => ({
    ...c,
    status: "under-review",
    sla: { deadline: Date.now() + 24 * HOUR, totalHours: 24 },
    resolution: null,
    timeline: [
      ...c.timeline,
      {
        id: `tl-${id}-reopen-${Date.now()}`,
        title: "Complaint Reopened",
        description: reason || "Citizen reported the issue persists.",
        timestamp: new Date().toISOString(),
        actor: "You",
        status: "completed"
      }
    ]
  }));
}

export async function escalateComplaint(id: string, reason?: string): Promise<Complaint> {
  mutateGuard(id);
  return updateCreated(id, (c) => ({
    ...c,
    status: "escalated",
    timeline: [
      ...c.timeline,
      {
        id: `tl-${id}-esc-${Date.now()}`,
        title: "Escalated to Higher Authority",
        description: reason || "Citizen escalation — forwarded to department head and Municipal Commissioner's office.",
        timestamp: new Date().toISOString(),
        actor: "You",
        status: "current"
      }
    ]
  }));
}

export async function markResolved(id: string, note?: string): Promise<Complaint> {
  mutateGuard(id);
  return updateCreated(id, (c) => ({
    ...c,
    status: "resolved",
    timeline: [
      ...c.timeline,
      {
        id: `tl-${id}-res-${Date.now()}`,
        title: "Citizen Verified — Resolved",
        description: note || "You confirmed the issue is fixed. Complaint moved to closure audit.",
        timestamp: new Date().toISOString(),
        actor: "You",
        status: "completed"
      }
    ]
  }));
}

export async function submitFeedback(id: string, feedback: Omit<ComplaintFeedback, "at">): Promise<Complaint> {
  mutateGuard(id);
  return updateCreated(id, (c) => ({
    ...c,
    status: "closed",
    feedback: { ...feedback, at: new Date().toISOString() },
    timeline: [
      ...c.timeline,
      {
        id: `tl-${id}-fb-${Date.now()}`,
        title: "Feedback Submitted & Closed",
        description: `Citizen rated the redressal ${feedback.rating}/5. Complaint closed.`,
        timestamp: new Date().toISOString(),
        actor: "You",
        status: "completed"
      }
    ]
  }));
}

export function activeComplaintCount(complaints: Complaint[]): number {
  return complaints.filter((c) => c.status !== "resolved" && c.status !== "closed").length;
}

export type { EvidenceItem };

export { getComplaintById as getComplaint };
