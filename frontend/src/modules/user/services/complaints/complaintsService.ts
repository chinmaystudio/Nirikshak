import type { Complaint, EvidenceItem, NewComplaintPayload, ComplaintFeedback } from "@/types/complaint";
import { ApiError } from "@/services/api/client";
import { complaints as mockComplaints, slaFromNow } from "@/data/complaints";
import { appStore } from "@/app/providers/store";
import { supabase } from "@/core/supabase/client";

const useMock = import.meta.env.VITE_USE_MOCK_API === 'true';

function mapDbComplaint(c: any): Complaint {
  const statusMap: Record<string, Complaint['status']> = {
    'SUBMITTED': 'submitted',
    'UNDER_REVIEW': 'in-review',
    'ASSIGNED': 'assigned',
    'IN_PROGRESS': 'in-progress',
    'RESOLVED': 'resolved',
    'CLOSED': 'resolved',
    'REJECTED': 'rejected',
  };

  const status = statusMap[c.status] || 'submitted';
  const severity = (c.severity || 'MEDIUM').toLowerCase() as Complaint['priority'];

  return {
    id: c.reference_number || c.id,
    projectId: c.projects?.nirikshak_project_id || c.project_id || 'NIR-PUNE-1C6ACEADF93FFB1A',
    projectName: c.projects?.project_name || 'Pune Infrastructure Project',
    title: c.title,
    description: c.description,
    category: c.category as any,
    status,
    priority: severity,
    ward: 'Pune Municipal Region',
    address: 'Pune Municipal Jurisdiction',
    location: {
      latitude: c.latitude || 18.5204,
      longitude: c.longitude || 73.8567,
    },
    submittedAt: c.created_at || new Date().toISOString(),
    updatedAt: c.updated_at || new Date().toISOString(),
    slaDueAt: slaFromNow(5),
    assignedDepartment: 'PMC / Regional Project Office',
    assignedOfficial: {
      name: 'Er. R. K. Shinde',
      designation: 'Executive Engineer',
      contact: '+91 20 2550 1000',
    },
    evidence: (c.complaint_evidence || []).map((ev: any, idx: number) => ({
      id: ev.id || `ev-${idx}`,
      type: 'photo',
      url: ev.storage_path,
      caption: ev.file_name || 'Citizen complaint photo evidence',
      timestamp: ev.created_at || new Date().toISOString(),
    })),
    timeline: [
      {
        id: 'tl-1',
        title: 'Grievance Registered',
        description: 'Citizen filed grievance via NIRIKSHAK Public Transparency Portal.',
        timestamp: c.created_at || new Date().toISOString(),
        status: 'submitted',
      },
    ],
    upvotes: 8,
    upvotedByUser: false,
    publicVisible: true,
  };
}

export async function getMyComplaints(): Promise<Complaint[]> {
  if (useMock) {
    return [...mockComplaints, ...appStore.getState().created].sort(
      (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
    );
  }

  try {
    const { data, error } = await supabase
      .from('complaints')
      .select('*, projects(project_name, nirikshak_project_id), complaint_evidence(*)')
      .order('created_at', { ascending: false });

    if (error || !data || data.length === 0) {
      return [...mockComplaints, ...appStore.getState().created];
    }

    return data.map(mapDbComplaint);
  } catch (err) {
    console.error('Error fetching complaints from Supabase:', err);
    return [...mockComplaints, ...appStore.getState().created];
  }
}

export async function getComplaintById(id: string): Promise<Complaint> {
  if (useMock) {
    const found = [...mockComplaints, ...appStore.getState().created].find((c) => c.id === id);
    if (!found) throw new ApiError({ message: `Complaint ${id} was not found.`, notFound: true });
    return found;
  }

  // Try fetching directly from Supabase by reference_number or id
  const { data, error } = await supabase
    .from('complaints')
    .select('*, projects(project_name, nirikshak_project_id), complaint_evidence(*)')
    .or(`reference_number.eq.${id},id.eq.${id}`)
    .single();

  if (error || !data) {
    // Check locally created store as fallback
    const local = appStore.getState().created.find((c) => c.id === id);
    if (local) return local;
    throw new ApiError({ message: `Complaint reference ${id} was not found in NIRIKSHAK register.`, notFound: true });
  }

  return mapDbComplaint(data);
}

export async function createComplaint(payload: NewComplaintPayload): Promise<Complaint> {
  const refNum = `NIR-PUNE-CMP-2026-${Math.floor(100000 + Math.random() * 900000)}`;

  let targetProjectId = 'b1000000-0000-0000-0000-000000000001';
  if (payload.projectId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(payload.projectId);
    if (isUuid) {
      targetProjectId = payload.projectId;
    } else {
      const { data: p } = await supabase.from('projects').select('id').eq('nirikshak_project_id', payload.projectId).single();
      if (p) targetProjectId = p.id;
    }
  }

  const { data, error } = await supabase
    .from('complaints')
    .insert({
      reference_number: refNum,
      project_id: targetProjectId,
      category: payload.category || 'General Civic Concern',
      title: payload.title,
      description: payload.description,
      severity: (payload.priority || 'MEDIUM').toUpperCase(),
      status: 'SUBMITTED',
      latitude: payload.coordinates?.latitude || 18.5204,
      longitude: payload.coordinates?.longitude || 73.8567,
    })
    .select('*, projects(project_name, nirikshak_project_id)')
    .single();

  if (error || !data) {
    console.error('Supabase complaint insert failed, falling back to local storage:', error);
    const fallbackComplaint: Complaint = {
      id: refNum,
      projectId: payload.projectId,
      projectName: 'Pune Infrastructure Project',
      title: payload.title,
      description: payload.description,
      category: payload.category,
      status: 'submitted',
      priority: payload.priority || 'medium',
      ward: payload.ward || 'Ward 12',
      address: payload.location,
      location: payload.coordinates || { latitude: 18.5204, longitude: 73.8567 },
      submittedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      slaDueAt: slaFromNow(7),
      assignedDepartment: 'PMC Infrastructure Cell',
      evidence: [],
      timeline: [{ id: 'tl-1', title: 'Filed by Citizen', description: payload.description, timestamp: new Date().toISOString(), status: 'submitted' }],
      upvotes: 1,
      publicVisible: true,
    };
    appStore.setState({ created: [fallbackComplaint, ...appStore.getState().created] });
    return fallbackComplaint;
  }

  const newComp = mapDbComplaint(data);
  appStore.setState({ created: [newComp, ...appStore.getState().created] });
  return newComp;
}

export async function upvoteComplaint(id: string): Promise<Complaint> {
  const current = await getComplaintById(id);
  return { ...current, upvotes: current.upvotes + 1, upvotedByUser: true };
}

export async function submitFeedback(id: string, fb: ComplaintFeedback): Promise<Complaint> {
  const current = await getComplaintById(id);
  return { ...current, feedback: fb };
}

export async function requestEscalation(id: string, reason?: string): Promise<Complaint> {
  const current = await getComplaintById(id);
  return { ...current, status: 'escalated' as any };
}

export const escalateComplaint = requestEscalation;

export async function reopenComplaint(id: string, reason?: string): Promise<Complaint> {
  const current = await getComplaintById(id);
  return { ...current, status: 'in-review' as any };
}

export async function addEvidence(id: string, item: EvidenceItem): Promise<Complaint> {
  const current = await getComplaintById(id);
  const evidence = current.evidence ? [...current.evidence, item] : [item];
  return { ...current, evidence };
}

export async function markResolved(id: string, note?: string): Promise<Complaint> {
  const current = await getComplaintById(id);
  return { ...current, status: 'resolved' };
}

export function activeComplaintCount(complaintsList: Complaint[]): number {
  return complaintsList.filter((c) => c.status !== "resolved" && (c.status as any) !== "closed").length;
}

export { getComplaintById as getComplaint };
export type { EvidenceItem };

