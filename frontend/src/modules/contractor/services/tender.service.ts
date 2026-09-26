import { supabase } from '@/core/supabase/client';
import { realtimeService } from '@/core/realtime/realtime.service';

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
    location_text?: string;
    sector?: string;
  };
}

export interface DbBid {
  id: string;
  tender_id: string;
  contractor_organization_id: string;
  bid_reference: string;
  bid_amount: number;
  technical_proposal?: string | null;
  technical_score?: number | null;
  financial_score?: number | null;
  status: 'DRAFT' | 'SUBMITTED' | 'UNDER_REVIEW' | 'QUALIFIED' | 'DISQUALIFIED' | 'SELECTED' | 'REJECTED' | 'WITHDRAWN';
  submitted_by?: string | null;
  submitted_at?: string | null;
  created_at: string;
  tenders?: DbTender;
}

export class ContractorTenderService {
  /**
   * Fetches published, open tenders from Supabase PostgreSQL.
   */
  static async getOpenTenders(): Promise<DbTender[]> {
    const { data, error } = await supabase
      .from('tenders')
      .select('*, projects(id, project_name, nirikshak_project_id, location_text, sector)')
      .eq('status', 'PUBLISHED')
      .is('deleted_at', null)
      .order('bid_due_date', { ascending: true });

    if (error) {
      console.error('Failed to query open tenders from Supabase:', error);
      throw error;
    }

    return (data || []) as DbTender[];
  }

  /**
   * Fetches details of a single tender.
   */
  static async getTender(id: string): Promise<DbTender | null> {
    const { data, error } = await supabase
      .from('tenders')
      .select('*, projects(id, project_name, nirikshak_project_id, location_text, sector)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error(`Failed to query tender ${id}:`, error);
      throw error;
    }

    return data as DbTender | null;
  }

  /**
   * Fetches bids submitted by the contractor's authenticated organization.
   */
  static async getMyBids(contractorOrgId: string): Promise<DbBid[]> {
    if (!contractorOrgId) return [];

    const { data, error } = await supabase
      .from('tender_bids')
      .select('*, tenders(id, tender_number, title, estimated_value_inr_crore, status, bid_due_date, projects(project_name))')
      .eq('contractor_organization_id', contractorOrgId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Failed to query contractor bids:', error);
      throw error;
    }

    return (data || []) as DbBid[];
  }

  /**
   * Generates server-side compliant unique bid reference: NIR-BID-2026-XXXXXX
   */
  private static generateBidReference(): string {
    const randomHex = Math.floor(100000 + Math.random() * 900000).toString();
    return `NIR-BID-2026-${randomHex}`;
  }

  /**
   * Submits a formal bid for a tender.
   */
  static async submitBid(payload: {
    tenderId: string;
    contractorOrgId: string;
    bidAmount: number;
    technicalProposal: string;
    userId: string;
  }): Promise<DbBid> {
    const { tenderId, contractorOrgId, bidAmount, technicalProposal, userId } = payload;
    const bidReference = this.generateBidReference();

    // Insert bid into tender_bids
    const { data: bid, error: insertErr } = await supabase
      .from('tender_bids')
      .insert({
        tender_id: tenderId,
        contractor_organization_id: contractorOrgId,
        bid_reference: bidReference,
        bid_amount: bidAmount,
        technical_proposal: technicalProposal,
        status: 'SUBMITTED',
        submitted_by: userId,
        submitted_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (insertErr) {
      console.error('Error submitting bid:', insertErr);
      throw insertErr;
    }

    // Insert notification for Government Authorities
    try {
      await supabase.from('notifications').insert({
        type: 'BID_SUBMITTED',
        title: 'New Tender Bid Submitted',
        message: `Bid ${bidReference} (₹${bidAmount} Cr) submitted for evaluation.`,
        entity_type: 'tender_bids',
        entity_id: bid.id,
        metadata: {
          tender_id: tenderId,
          contractor_organization_id: contractorOrgId,
          bid_reference: bidReference,
        },
      });
    } catch (notifErr) {
      console.warn('Could not dispatch notification:', notifErr);
    }

    // Broadcast realtime event
    await realtimeService.broadcast('government:tenders', 'BID_SUBMITTED', {
      tender_id: tenderId,
      bid_id: bid.id,
      bid_reference: bidReference,
    });

    return bid as DbBid;
  }

  /**
   * Saves a draft bid.
   */
  static async saveDraft(payload: {
    tenderId: string;
    contractorOrgId: string;
    bidAmount: number;
    technicalProposal: string;
    userId: string;
  }): Promise<DbBid> {
    const { tenderId, contractorOrgId, bidAmount, technicalProposal, userId } = payload;
    const bidReference = this.generateBidReference();

    const { data: bid, error } = await supabase
      .from('tender_bids')
      .upsert({
        tender_id: tenderId,
        contractor_organization_id: contractorOrgId,
        bid_reference: bidReference,
        bid_amount: bidAmount,
        technical_proposal: technicalProposal,
        status: 'DRAFT',
        submitted_by: userId,
      })
      .select()
      .single();

    if (error) throw error;
    return bid as DbBid;
  }

  /**
   * Withdraws a submitted bid before evaluation deadline.
   */
  static async withdrawBid(bidId: string): Promise<void> {
    const { error } = await supabase
      .from('tender_bids')
      .update({ status: 'WITHDRAWN' })
      .eq('id', bidId);

    if (error) throw error;
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
