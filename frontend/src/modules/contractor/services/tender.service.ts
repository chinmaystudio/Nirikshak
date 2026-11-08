import { supabase } from '@/core/supabase/client';
import { realtimeService } from '@/core/realtime/realtime.service';
import type { Tender } from '../lib/data';

export interface DbTender {
  id: string;
  project_id: string;
  tender_number: string;
  title: string;
  description?: string | null;
  estimated_value_inr_crore: number;
  publication_date: string;
  bid_due_date: string;
  eligibility_criteria?: string | null;
  technical_requirements?: string | null;
  documents?: any;
  status: 'DRAFT' | 'PUBLISHED' | 'CLOSED' | 'UNDER_EVALUATION' | 'AWARDED' | 'CANCELLED';
  created_at: string;
  projects?: {
    id: string;
    project_name: string;
    nirikshak_project_id: string;
    project_authority?: string | null;
    department?: string | null;
    location_text?: string | null;
    district?: string | null;
    state?: string | null;
    city?: string | null;
    sector?: string;
  };
}

export interface DbBid {
  id: string;
  tender_id: string;
  contractor_organization_id: string;
  bid_reference: string;
  bid_amount: number; // ₹ Cr end to end — a bid_amount of 41.75 means ₹41.75 Cr; never rescale
  technical_proposal?: string | null;
  documents?: unknown;
  financial_proposal?: Record<string, unknown> | null;
  technical_score?: number | null;
  financial_score?: number | null;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'QUALIFIED' | 'DISQUALIFIED' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN';
  submitted_by?: string | null;
  submitted_at?: string | null;
  updated_at?: string;
  tenders?: Partial<DbTender>;
}

export class ContractorTenderService {
  static toTender(row: DbTender): Tender {
    const documents = Array.isArray(row.documents) ? row.documents : [];
    const split = (value?: string | null) => value ? value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean) : [];
    // Location: prefer the project's free-text location, then compose one from
    // its district/city + state fields, instead of a blanket 'Unknown'.
    const projectLocation = row.projects?.location_text
      || [row.projects?.district || row.projects?.city, row.projects?.state].filter(Boolean).join(', ')
      || '';
    // Financial requirements may arrive as a JSON array on the tender row
    // (financial_requirements) even though older rows leave it null.
    const financialRequirements = (row as unknown as { financial_requirements?: unknown }).financial_requirements;
    return {
      id: row.id,
      code: row.tender_number,
      title: row.title,
      // Department comes from the joined project (project_authority, falling
      // back to the project's department column) — not a hard-coded 'Unknown'.
      department: row.projects?.project_authority || row.projects?.department || 'Unknown',
      location: projectLocation || 'Unknown',
      value: row.estimated_value_inr_crore == null ? 0 : Number(row.estimated_value_inr_crore),
      deadline: row.bid_due_date,
      emd: 0,
      category: row.projects?.sector || 'Unknown',
      durationMonths: 0,
      opened: row.publication_date,
      preBid: '',
      status: row.status === 'PUBLISHED' ? 'Open' : 'Closed',
      summary: row.description || 'Unknown',
      scopePoints: split(row.description),
      eligibility: { label: 'Eligibility criteria', required: row.eligibility_criteria || 'Unknown' },
      techReq: split(row.technical_requirements),
      finReq: Array.isArray(financialRequirements)
        ? financialRequirements.map((item) => (typeof item === 'string' ? item : '')).filter(Boolean)
        : split(typeof financialRequirements === 'string' ? financialRequirements : null),
      docs: documents.map((item: any) => typeof item === 'string' ? item : item?.name).filter(Boolean),
      timeline: [
        ...(row.publication_date ? [{ label: 'Published', date: row.publication_date }] : []),
        ...(row.bid_due_date ? [{ label: 'Bid deadline', date: row.bid_due_date }] : []),
      ],
      contact: { name: 'Unknown', role: 'Unknown', phone: 'Unknown', email: 'Unknown' },
    };
  }

  /**
   * Fetches published, open tenders from Supabase PostgreSQL.
   */
  static async getOpenTenders(): Promise<DbTender[]> {
    const { data, error } = await supabase
      .from('tenders')
      .select('*, projects(id, project_name, nirikshak_project_id, project_authority, department, location_text, district, state, city, sector)')
      .eq('status', 'PUBLISHED')
      .is('deleted_at', null)
      .order('bid_due_date', { ascending: true });

    if (error) {
      console.error('Failed to query open tenders from Supabase:', error);
      throw error;
    }

    const rows = (data || []) as DbTender[];
    if (typeof sessionStorage !== 'undefined') {
      rows.forEach((row) => sessionStorage.setItem(`nirikshak:tender:${row.id}`, JSON.stringify(this.toTender(row))));
    }
    return rows;
  }

  /**
   * Fetches details of a single tender.
   */
  static async getTender(id: string): Promise<DbTender | null> {
    const { data, error } = await supabase
      .from('tenders')
      .select('*, projects(id, project_name, nirikshak_project_id, project_authority, department, location_text, district, state, city, sector)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Failed to query tender ${id}:`, error);
      throw error;
    }

    const row = data as DbTender | null;
    if (row && typeof sessionStorage !== 'undefined') {
      try {
        sessionStorage.setItem(`nirikshak:tender:${row.id}`, JSON.stringify(this.toTender(row)));
      } catch {
        /* cache is best-effort */
      }
    }
    return row;
  }

  /**
   * Fetches bids submitted by the contractor's authenticated organization.
   */
  static async getMyBids(): Promise<DbBid[]> {
    const { data, error } = await supabase
      .from('tender_bids')
      .select('*, tenders(id, tender_number, title, estimated_value_inr_crore, status, bid_due_date, projects(project_name))')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Failed to query contractor bids:', error);
      throw error;
    }

    return (data || []) as unknown as DbBid[];
  }

  /**
   * Submits a formal bid for a tender.
   */
  static async submitBid(payload: {
    tenderId: string;
    bidAmount: number;
    technicalProposal: string;
  }): Promise<DbBid> {
    const { tenderId, bidAmount, technicalProposal } = payload;
    const { data: bid, error: insertErr } = await supabase
      .rpc('save_tender_bid', { p_tender_id: tenderId, p_bid_amount: bidAmount, p_technical_proposal: technicalProposal, p_status: 'SUBMITTED' });

    if (insertErr) {
      console.error('Error submitting bid:', insertErr);
      throw insertErr;
    }

    const savedBid = (Array.isArray(bid) ? bid[0] : bid) as unknown as DbBid | null;
    if (!savedBid?.id || !savedBid.bid_reference) {
      throw new Error('The bid was saved, but its confirmation could not be loaded. Refresh My Bids before retrying.');
    }

    // Bid persistence is authoritative. A transient Realtime notification must not
    // turn a successful database transaction into a visible submission failure.
    void realtimeService.broadcast('government:tenders', 'BID_SUBMITTED', {
      tender_id: tenderId,
      bid_id: savedBid.id,
      bid_reference: savedBid.bid_reference,
    }).catch((error) => console.warn('Bid submitted; Realtime notification was not delivered:', error));

    return savedBid;
  }

  /**
   * Saves a draft bid.
   */
  static async saveDraft(payload: {
    tenderId: string;
    bidAmount: number;
    technicalProposal: string;
  }): Promise<DbBid> {
    const { tenderId, bidAmount, technicalProposal } = payload;
    const { data: bid, error } = await supabase
      .rpc('save_tender_bid', { p_tender_id: tenderId, p_bid_amount: bidAmount, p_technical_proposal: technicalProposal, p_status: 'DRAFT' });

    if (error) throw error;
    const savedBid = (Array.isArray(bid) ? bid[0] : bid) as unknown as DbBid | null;
    if (!savedBid?.id) throw new Error('The bid draft confirmation could not be loaded.');
    return savedBid;
  }

  /**
   * Withdraws a submitted bid before evaluation deadline.
   *
   * DF-08: a direct UPDATE on tender_bids is silently RLS-blocked for
   * SUBMITTED bids (the "Contractor update own bid" policy only matches
   * DRAFT rows), and PostgREST reports that 0-row update as success — the
   * bid stayed live while the UI believed it was withdrawn. Withdrawal now
   * goes through the SECURITY DEFINER RPC `withdraw_tender_bid`, and this
   * method throws unless the RPC actually returns the withdrawn row.
   */
  static async withdrawBid(bidId: string): Promise<DbBid> {
    // withdraw_tender_bid is created by the bid-withdrawal migration; the
    // generated Database types predate it, so the call goes through this
    // narrow cast until the types are regenerated.
    const rpc = supabase.rpc.bind(supabase) as unknown as (
      fn: 'withdraw_tender_bid',
      args: { p_bid_id: string },
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data, error } = await rpc('withdraw_tender_bid', { p_bid_id: bidId });

    if (error) throw new Error(error.message);

    const withdrawn = (Array.isArray(data) ? data[0] : data) as unknown as DbBid | null;
    if (!withdrawn?.id) {
      throw new Error('The bid could not be withdrawn. It may no longer be in a withdrawable state.');
    }
    return withdrawn;
  }

  /**
   * Persists the bid wizard's document filename list and financial-proposal
   * JSON onto the contractor's own bid row while it is still a DRAFT
   * (the only state the "Contractor update own bid" RLS policy allows the
   * owner to update). Throws on any error or on a 0-row update, so callers
   * never report these details as saved when they were not.
   */
  static async saveDraftBidDetails(
    bidId: string,
    details: { documents: string[]; financialProposal: Record<string, unknown> },
  ): Promise<void> {
    // financial_proposal is added by the tender v2 migration; the generated
    // Database types predate it, hence the narrow cast on the payload.
    const payload = {
      documents: details.documents,
      financial_proposal: details.financialProposal,
    } as Record<string, unknown>;
    const { data, error } = await supabase
      .from('tender_bids')
      .update(payload as never)
      .eq('id', bidId)
      .eq('status', 'DRAFT')
      .select('id');

    if (error) throw error;
    if (!data || data.length === 0) {
      throw new Error('Draft details could not be saved because the bid is no longer a draft.');
    }
  }

  /**
   * Subscribes to realtime tender and bid updates.
   */
  static subscribeTenderEvents(callback: () => void): () => void {
    const unsub1 = realtimeService.subscribeToTable('tenders', () => callback());
    const unsub2 = realtimeService.subscribeToTable('tender_bids', () => callback());
    return () => {
      unsub1();
      unsub2();
    };
  }
}
