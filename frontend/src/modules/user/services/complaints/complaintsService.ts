import type { Complaint, EvidenceItem, NewComplaintPayload, ComplaintFeedback } from "@/types/complaint";
import { ApiError, fetchWithTimeout } from "@/services/api/client";
import { complaints as mockComplaints, slaFromNow } from "@/data/complaints";
import { appStore } from "@/app/providers/store";
import { supabase } from "@/core/supabase/client";
import { environment } from "@/config/environment";

const useMock = import.meta.env.VITE_USE_MOCK_API === 'true';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const COMPLAINT_SELECT = '*, projects(project_name, nirikshak_project_id, project_authority), complaint_evidence(*), complaint_updates(*)';

function formatSize(bytes: unknown): string {
  const n = Number(bytes);
  if (!bytes || Number.isNaN(n) || n <= 0) return '';
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

/**
 * Map a complaints row to the citizen model using only real columns/embeds.
 * The complaints table carries no ward / officer / department columns, so
 * those stay null / '—' instead of invented names (DF-02 principle).
 */
function mapDbComplaint(c: any): Complaint {
  const statusMap: Record<string, Complaint['status']> = {
    'SUBMITTED': 'submitted',
    'UNDER_REVIEW': 'under-review',
    'ASSIGNED': 'assigned',
    'INVESTIGATION': 'investigation',
    'ACTION_TAKEN': 'action-taken',
    'IN_PROGRESS': 'action-taken',
    'RESOLVED': 'resolved',
    'CLOSED': 'closed',
    'ESCALATED': 'escalated',
    'REJECTED': 'closed',
  };

  const status: Complaint['status'] = statusMap[String(c.status || '').toUpperCase()] || 'submitted';
  const sev = String(c.severity || 'medium').toLowerCase();
  const priority: Complaint['priority'] =
    sev === 'critical' ? 'critical' : sev === 'high' ? 'high' : sev === 'low' ? 'low' : 'medium';

  const totalHours = priority === 'critical' ? 12 : priority === 'high' ? 24 : priority === 'medium' ? 48 : 72;
  const createdAt = c.created_at || new Date().toISOString();
  const deadline = new Date(createdAt).getTime() + totalHours * 3600_000;

  const updates: any[] = Array.isArray(c.complaint_updates)
    ? [...c.complaint_updates].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime())
    : [];

  const timeline: Complaint['timeline'] = [
    {
      id: 'tl-submitted',
      title: 'Complaint Submitted',
      description: 'Complaint registered on NIRIKSHAK.',
      timestamp: createdAt,
      actor: 'Citizen',
      status: 'completed',
    },
    ...updates.map((u: any, i: number) => ({
      id: u.id || `tl-${i}`,
      title: `Status: ${String(u.new_status || '').replace(/_/g, ' ')}`,
      description: u.notes || '',
      timestamp: u.created_at || null,
      actor: u.actor_id ? 'Registered user' : 'Department',
      status: (i === updates.length - 1 && status !== 'resolved' && status !== 'closed'
        ? 'current'
        : 'completed') as Complaint['timeline'][number]['status'],
    })),
  ];

  return {
    id: c.reference_number || c.id,
    title: c.title || '—',
    category: c.category || 'other',
    categoryLabel: c.category || 'Other',
    priority,
    projectId: c.projects?.nirikshak_project_id || c.project_id || null,
    ward: '—',
    location: c.latitude != null && c.longitude != null
      ? `GPS ${Number(c.latitude).toFixed(4)}, ${Number(c.longitude).toFixed(4)}`
      : '—',
    description: c.description || '',
    status,
    submittedAt: createdAt,
    updatedAt: c.updated_at || createdAt,
    sla: {
      deadline,
      totalHours,
    },
    department: c.projects?.project_authority || '—',
    officer: null,
    evidence: (c.complaint_evidence || []).map((ev: any, idx: number) => ({
      id: ev.id || `ev-${idx}`,
      name: ev.file_name || (ev.storage_path ? String(ev.storage_path).split('/').pop() : '') || 'evidence',
      size: formatSize(ev.file_size),
      kind: String(ev.mime_type || '').startsWith('video') ? 'video' as const : 'image' as const,
      meta: ev.created_at ? `Uploaded ${new Date(ev.created_at).toLocaleDateString()}` : '',
      thumb: ev.storage_path || null,
    })),
    timeline,
    officerNote: null,
    resolution: c.resolved_at
      ? { closedAt: c.resolved_at, note: '', evidence: [] }
      : (status === 'resolved' || status === 'closed')
        ? { closedAt: c.updated_at || createdAt, note: '', evidence: [] }
        : null,
    feedback: null,
  };
}

export async function getMyComplaints(): Promise<Complaint[]> {
  if (useMock) {
    return [...mockComplaints, ...appStore.getState().created].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  // DF-03: scope strictly to the signed-in user's own complaints.
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw new ApiError({ message: `Could not verify your session: ${userError.message}` });
  const uid = userData?.user?.id;
  if (!uid) return [];

  const { data, error } = await supabase
    .from('complaints')
    .select(COMPLAINT_SELECT)
    .eq('user_id', uid)
    .order('created_at', { ascending: false });

  // DF-10: an error is an error state — never a page of fabricated complaints.
  if (error) throw new ApiError({ message: `Could not load your complaints: ${error.message}` });
  return (data || []).map(mapDbComplaint);
}

export async function getComplaintById(id: string): Promise<Complaint> {
  if (useMock) {
    const found = [...mockComplaints, ...appStore.getState().created].find((c) => c.id === id);
    if (!found) throw new ApiError({ message: `Complaint ${id} was not found.`, notFound: true });
    return found;
  }

  // DF-14: query the UUID column only for UUID values, else the reference
  // column alone (a reference in an id.eq slot errors on the UUID cast).
  const query = supabase.from('complaints').select(COMPLAINT_SELECT);
  const { data, error } = await (UUID_RE.test(id)
    ? query.eq('id', id).single()
    : query.eq('reference_number', id).single());

  if (error || !data) {
    throw new ApiError({ message: `Complaint reference ${id} was not found in NIRIKSHAK register.`, notFound: true });
  }

  return mapDbComplaint(data);
}

async function resolveComplaintRow(id: string): Promise<{ uuid: string; status: string }> {
  const query = supabase.from('complaints').select('id, status');
  const { data, error } = await (UUID_RE.test(id)
    ? query.eq('id', id).single()
    : query.eq('reference_number', id).single());
  if (error || !data) {
    throw new ApiError({ message: `Complaint ${id} was not found.`, notFound: true });
  }
  return { uuid: data.id as string, status: String(data.status || 'SUBMITTED') };
}

export async function createComplaint(payload: NewComplaintPayload): Promise<Complaint> {
  if (useMock) {
    const totalHours = payload.priority === 'critical' ? 12 : payload.priority === 'high' ? 24 : payload.priority === 'medium' ? 48 : 72;
    const now = new Date().toISOString();
    const demoComplaint: Complaint = {
      id: `CMP-DEMO-${Math.floor(100000 + Math.random() * 900000)}`,
      title: payload.title,
      category: payload.category,
      categoryLabel: payload.categoryLabel || payload.category,
      priority: payload.priority || 'medium',
      projectId: payload.projectId,
      ward: payload.ward || '—',
      location: payload.location || '—',
      description: payload.description,
      status: 'submitted',
      submittedAt: now,
      updatedAt: now,
      sla: { deadline: Date.now() + totalHours * 3600_000, totalHours },
      department: payload.department || '—',
      officer: null,
      evidence: payload.evidence || [],
      timeline: [
        { id: 'tl-1', title: 'Complaint Submitted', description: 'Demo mode — not stored.', timestamp: now, actor: 'Citizen', status: 'completed' },
      ],
      officerNote: null,
      resolution: null,
      feedback: null,
    };
    appStore.setState({ created: [demoComplaint, ...appStore.getState().created] });
    return demoComplaint;
  }

  // DF-04: creation goes through the backend, which generates the NIR-CMP
  // reference, derives user_id from the Bearer token, and persists evidence
  // rows + coordinates. No client-generated references, no default project.
  const baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  if (!baseUrl) throw new ApiError({ message: 'Complaint submission service is not configured.' });

  let projectUuid: string | null = null;
  if (payload.projectId) {
    if (UUID_RE.test(payload.projectId)) {
      projectUuid = payload.projectId;
    } else {
      const { data: p, error: pErr } = await supabase
        .from('projects')
        .select('id')
        .eq('nirikshak_project_id', payload.projectId)
        .maybeSingle();
      if (pErr) throw new ApiError({ message: `Could not resolve the linked project: ${pErr.message}` });
      if (!p) throw new ApiError({ message: 'The linked project could not be found. Please pick a project from the list.' });
      projectUuid = p.id;
    }
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData?.session?.access_token;

  const body: Record<string, unknown> = {
    category: payload.categoryLabel || payload.category,
    title: payload.title,
    description: payload.description,
    severity: (payload.priority || 'medium').toUpperCase(),
    // Location text / ward are forwarded for backends that accept them;
    // coordinates are the persisted location of record.
    location_text: payload.location,
    ward: payload.ward,
  };
  if (projectUuid) body.project_id = projectUuid;
  if (payload.latitude != null) body.latitude = payload.latitude;
  if (payload.longitude != null) body.longitude = payload.longitude;
  const evidencePaths = (payload.evidence || []).map((e) =>
    e.thumb && !e.thumb.startsWith('data:') ? e.thumb : e.name
  );
  if (evidencePaths.length > 0) body.evidence_paths = evidencePaths;

  let response: Response;
  try {
    response = await fetchWithTimeout(`${baseUrl}/api/complaints`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError({ message: 'Complaint submission service is temporarily unavailable.' });
  }

  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.success) {
    // DF-18: preserve the backend error code/status for callers.
    throw new ApiError({
      message: result?.error?.message || `Complaint submission failed (HTTP ${response.status}).`,
      status: response.status,
      code: result?.error?.code,
    });
  }

  const created = result.data;
  if (created?.reference_number) {
    try {
      return await getComplaintById(created.reference_number);
    } catch {
      /* fall through to mapping the returned row */
    }
  }
  return mapDbComplaint(created);
}

export async function upvoteComplaint(id: string): Promise<Complaint> {
  await getComplaintById(id);
  throw new Error('Complaint upvotes are not supported. Use the community issue flow instead.');
}

/** DF-05: real status write + complaint_updates audit row; throws on error. */
async function applyStatusChange(id: string, newStatus: string, notes?: string): Promise<Complaint> {
  const { uuid, status: previous } = await resolveComplaintRow(id);
  const patch: { status: string; updated_at: string; resolved_at?: string } = {
    status: newStatus,
    updated_at: new Date().toISOString(),
  };
  if (newStatus === 'RESOLVED') patch.resolved_at = new Date().toISOString();

  const { error: updateError } = await supabase.from('complaints').update(patch).eq('id', uuid);
  if (updateError) throw new ApiError({ message: `Could not update the complaint: ${updateError.message}` });

  const { data: userData } = await supabase.auth.getUser();
  const { error: logError } = await supabase.from('complaint_updates').insert({
    complaint_id: uuid,
    previous_status: previous,
    new_status: newStatus,
    notes: notes ?? null,
    actor_id: userData?.user?.id ?? null,
  });
  if (logError) throw new ApiError({ message: `Status saved, but the audit entry failed: ${logError.message}` });

  return getComplaintById(id);
}

export async function submitFeedback(id: string, fb: ComplaintFeedback): Promise<Complaint> {
  if (useMock) {
    const current = await getComplaintById(id);
    return { ...current, feedback: fb };
  }
  const { uuid, status } = await resolveComplaintRow(id);
  const { data: userData } = await supabase.auth.getUser();
  const { error } = await supabase.from('complaint_updates').insert({
    complaint_id: uuid,
    previous_status: status,
    new_status: status,
    notes: `Citizen feedback — rating ${fb.rating}/5${fb.comment ? `: ${fb.comment}` : ''}`,
    actor_id: userData?.user?.id ?? null,
  });
  if (error) throw new ApiError({ message: `Could not save your feedback: ${error.message}` });
  const fresh = await getComplaintById(id);
  return { ...fresh, feedback: fb };
}

export async function requestEscalation(id: string, reason?: string): Promise<Complaint> {
  if (useMock) {
    const current = await getComplaintById(id);
    return { ...current, status: 'escalated' as Complaint['status'] };
  }
  return applyStatusChange(id, 'ESCALATED', reason ? `Citizen escalation: ${reason}` : 'Citizen requested escalation');
}

export const escalateComplaint = requestEscalation;

export async function reopenComplaint(id: string, reason?: string): Promise<Complaint> {
  if (useMock) {
    const current = await getComplaintById(id);
    return { ...current, status: 'submitted' as Complaint['status'] };
  }
  return applyStatusChange(id, 'SUBMITTED', reason ? `Citizen reopened: ${reason}` : 'Citizen reopened the complaint');
}

export async function addEvidence(id: string, item: EvidenceItem): Promise<Complaint> {
  if (useMock) {
    const current = await getComplaintById(id);
    return { ...current, evidence: [...(current.evidence || []), item] };
  }
  const { uuid } = await resolveComplaintRow(id);
  const { error } = await supabase.from('complaint_evidence').insert({
    complaint_id: uuid,
    file_name: item.name,
    storage_path: item.thumb && !item.thumb.startsWith('data:') ? item.thumb : item.name,
    mime_type: item.kind === 'video' ? 'video/*' : 'image/*',
  });
  if (error) throw new ApiError({ message: `Could not attach evidence: ${error.message}` });
  return getComplaintById(id);
}

export async function markResolved(id: string, note?: string): Promise<Complaint> {
  if (useMock) {
    const current = await getComplaintById(id);
    return { ...current, status: 'resolved' as Complaint['status'] };
  }
  return applyStatusChange(id, 'RESOLVED', note ? `Citizen confirmed resolution: ${note}` : 'Citizen confirmed resolution');
}

export function activeComplaintCount(complaintsList: Complaint[]): number {
  return complaintsList.filter((c) => c.status !== "resolved" && (c.status as any) !== "closed").length;
}

export { getComplaintById as getComplaint };
export type { EvidenceItem };

// slaFromNow is re-exported for existing consumers of the demo data module.
export { slaFromNow };
