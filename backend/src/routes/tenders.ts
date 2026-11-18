import { Router, Response } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { z } from 'zod';
import { requireAuth, requireGovernment, requireGovernmentWrite, AuthenticatedRequest } from '../middleware/auth.js';
import { CreateTenderSchema, EvaluateBidSchema } from '../validation/schemas.js';
import { isMissingFunction } from '../services/dbFeatures.js';

export const tendersRouter = Router();

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// POST /api/tenders - Publish a tender for a project owned by the caller's Government organization.
// DF-38: write guard — auditors are read-only.
tendersRouter.post('/', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = CreateTenderSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_TENDER', message: parsed.error.issues[0]?.message || 'Please check the tender details.' },
    });
  }

  if (!req.organizationId) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'An active Government organization is required.' },
    });
  }

  try {
    const input = parsed.data;
    let projectQuery = supabaseAdmin
      .from('projects')
      .select('id, nirikshak_project_id, government_organization_id')
      .is('deleted_at', null);

    projectQuery = UUID_PATTERN.test(input.project_id)
      ? projectQuery.eq('id', input.project_id)
      : projectQuery.eq('nirikshak_project_id', input.project_id);

    const { data: project, error: projectError } = await projectQuery.maybeSingle();
    if (projectError || !project) {
      return res.status(404).json({
        success: false,
        error: { code: 'PROJECT_NOT_FOUND', message: 'The selected project could not be found.' },
      });
    }

    if (project.government_organization_id !== req.organizationId) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'This project belongs to a different Government authority.' },
      });
    }

    const tenderNumber = `TND-MH-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const publicationDate = new Date();
    const bidDueDate = input.bid_due_date
      ? new Date(`${input.bid_due_date}T00:00:00Z`)
      : new Date(publicationDate.getTime() + 30 * 86_400_000);

    const { data, error } = await req.supabase!
      .from('tenders')
      .insert({
        project_id: project.id,
        tender_number: tenderNumber,
        title: input.title,
        description: input.description || null,
        issuing_organization_id: req.organizationId,
        estimated_value_inr_crore: input.estimated_value_inr_crore,
        status: 'PUBLISHED',
        is_public: true,
        created_by: req.user!.id,
        publication_date: publicationDate.toISOString().slice(0, 10),
        bid_due_date: bidDueDate.toISOString().slice(0, 10),
        technical_weight: input.technical_weight,
        min_evaluators: input.min_evaluators,
      })
      .select()
      .single();

    if (error || !data) {
      console.error('Tender creation failed', { code: error?.code, message: error?.message });
      return res.status(400).json({
        success: false,
        error: { code: 'TENDER_CREATE_FAILED', message: 'The tender could not be published.' },
      });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user!.id,
      actor_organization_id: req.organizationId,
      action: 'TENDER_CREATE',
      entity_type: 'tenders',
      entity_id: data.id,
      new_value: {
        tender_number: data.tender_number,
        project_id: project.id,
        estimated_value_inr_crore: data.estimated_value_inr_crore,
      },
    });

    return res.status(201).json({
      success: true,
      data: {
        ...data,
        nirikshak_project_id: project.nirikshak_project_id,
        mode: input.mode,
      },
    });
  } catch (error) {
    console.error('Unexpected tender creation error', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'The tender could not be published.' },
    });
  }
});

// POST /api/tenders/:tenderId/close - Immediately close a PUBLISHED tender owned
// by the caller's Government organization. Adapted from craaftverse
// procurement.service.ts closeTender, re-based onto req.organizationId.
// The tender may be addressed by UUID or by tender_number.
tendersRouter.post('/:tenderId/close', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  if (!req.organizationId) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'An active Government organization is required.' },
    });
  }

  try {
    const { tenderId } = req.params;
    // Runs under the caller's JWT so RLS (owning organization) and the MFA
    // policy apply, not the service role.
    let query = req.supabase!
      .from('tenders')
      .update({ status: 'CLOSED', updated_at: new Date().toISOString() })
      .eq('issuing_organization_id', req.organizationId)
      .eq('status', 'PUBLISHED');
    query = UUID_PATTERN.test(tenderId) ? query.eq('id', tenderId) : query.eq('tender_number', tenderId);

    const { data, error } = await query.select().maybeSingle();
    if (error) {
      console.error('Tender closure failed', { code: error.code, message: error.message });
      return res.status(500).json({
        success: false,
        error: { code: 'TENDER_CLOSE_FAILED', message: 'The tender could not be closed.' },
      });
    }
    if (!data) {
      // No row matched: the tender is not PUBLISHED, or it belongs to
      // another Government organization — indistinguishable by design.
      return res.status(403).json({
        success: false,
        error: { code: 'TENDER_NOT_PUBLISHED_OR_FOREIGN', message: 'Tender is not published, or it belongs to another Government organization.' },
      });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user!.id,
      actor_organization_id: req.organizationId,
      action: 'TENDER_CLOSED_IMMEDIATELY',
      entity_type: 'tenders',
      entity_id: data.id,
      new_value: { tender_number: data.tender_number, reason: 'Government administrator closed tender immediately' },
    });

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected tender closure error', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'The tender could not be closed.' },
    });
  }
});

// ---------------------------------------------------------------------------
// Sealed bids & committee (migration 042). Every call runs under the caller's
// JWT, so the database functions enforce issuer, committee membership, bid
// due date, two-key opening and MFA; this layer only validates input and maps
// database errors to HTTP responses.
// ---------------------------------------------------------------------------

function dbErrorResponse(res: Response, error: { code?: string; message?: string }, fallback: string) {
  const message = error?.message || fallback;
  if (isMissingFunction(error)) {
    return res.status(503).json({
      success: false,
      error: { code: 'MIGRATION_REQUIRED', message: 'This feature needs database migration 042 to be applied.' },
    });
  }
  if (/MFA_REQUIRED/.test(message)) {
    return res.status(403).json({ success: false, error: { code: 'MFA_REQUIRED', message: 'Verify your authenticator code to perform this action.' } });
  }
  if (error?.code === '42501') {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message } });
  }
  if (error?.code === 'P0002') {
    return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message } });
  }
  if (error?.code === '22023') {
    return res.status(409).json({ success: false, error: { code: 'RULE_VIOLATION', message } });
  }
  console.error(fallback, { code: error?.code, message: error?.message });
  return res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: fallback } });
}

async function resolveTenderId(req: AuthenticatedRequest, tenderId: string): Promise<string | null> {
  if (UUID_PATTERN.test(tenderId)) return tenderId;
  const { data } = await req.supabase!.from('tenders').select('id').eq('tender_number', tenderId).maybeSingle();
  return data?.id ?? null;
}

const CommitteeSchema = z.object({
  member_ids: z.array(z.string().uuid()).min(1).max(15),
  chair_id: z.string().uuid().optional(),
});

// GET /api/tenders/:tenderId/bids/summary - bid count + opening status (works while sealed)
tendersRouter.get('/:tenderId/bids/summary', requireAuth, requireGovernment, async (req: AuthenticatedRequest, res: Response) => {
  const tenderId = await resolveTenderId(req, req.params.tenderId);
  if (!tenderId) return res.status(404).json({ success: false, error: { code: 'TENDER_NOT_FOUND', message: 'Tender not found.' } });
  const { data, error } = await req.supabase!.rpc('get_tender_bid_summary', { p_tender_id: tenderId });
  if (error) return dbErrorResponse(res, error, 'The bid summary could not be loaded.');
  return res.json({ success: true, data: Array.isArray(data) ? data[0] ?? null : data });
});

// PUT /api/tenders/:tenderId/committee - set the evaluation committee (before opening)
tendersRouter.put('/:tenderId/committee', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = CommitteeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_COMMITTEE', message: parsed.error.issues[0]?.message || 'Provide the committee member ids.' } });
  }
  const tenderId = await resolveTenderId(req, req.params.tenderId);
  if (!tenderId) return res.status(404).json({ success: false, error: { code: 'TENDER_NOT_FOUND', message: 'Tender not found.' } });
  const { data, error } = await req.supabase!.rpc('set_tender_committee', {
    p_tender_id: tenderId,
    p_member_ids: parsed.data.member_ids,
    p_chair_id: parsed.data.chair_id ?? null,
  });
  if (error) return dbErrorResponse(res, error, 'The committee could not be saved.');
  return res.json({ success: true, data });
});

// POST /api/tenders/:tenderId/open - this committee member's key for opening the bids
tendersRouter.post('/:tenderId/open', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  const tenderId = await resolveTenderId(req, req.params.tenderId);
  if (!tenderId) return res.status(404).json({ success: false, error: { code: 'TENDER_NOT_FOUND', message: 'Tender not found.' } });
  const { data, error } = await req.supabase!.rpc('approve_bid_opening', { p_tender_id: tenderId });
  if (error) return dbErrorResponse(res, error, 'The bid opening could not be recorded.');
  const row = Array.isArray(data) ? data[0] : data;
  return res.json({
    success: true,
    data: row,
    message: row?.bids_opened_at
      ? 'Bids are now open for evaluation.'
      : `Your approval is recorded (${row?.opening_approvals ?? 1} of ${row?.min_opening_members ?? 2}). Bids open when the required committee members have approved.`,
  });
});

// POST /api/tenders/:tenderId/bids/:bidId/evaluate - this committee member's scores
// QCBS weights come from the tender (technical_weight); the bid's scores are
// the committee average, computed in the database.
tendersRouter.post('/:tenderId/bids/:bidId/evaluate', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = EvaluateBidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_EVALUATION', message: parsed.error.issues[0]?.message || 'Please check the evaluation scores.' },
    });
  }
  if (!UUID_PATTERN.test(req.params.bidId)) {
    return res.status(404).json({ success: false, error: { code: 'BID_NOT_FOUND', message: 'The selected bid could not be found.' } });
  }
  const { data, error } = await req.supabase!.rpc('record_bid_evaluation', {
    p_bid_id: req.params.bidId,
    p_technical_score: parsed.data.technical_score,
    p_financial_score: parsed.data.financial_score,
    p_remarks: parsed.data.remarks ?? null,
  });
  if (error && isMissingFunction(error)) {
    // Database without migration 042: keep the previous single-evaluator
    // behaviour so evaluation keeps working until the migration is applied.
    return legacyEvaluate(req, res, parsed.data.technical_score, parsed.data.financial_score);
  }
  if (error) return dbErrorResponse(res, error, 'The bid could not be evaluated.');
  return res.json({ success: true, data });
});

/** Pre-042 evaluation (single officer, 70:30). Removed once 042 is everywhere. */
async function legacyEvaluate(req: AuthenticatedRequest, res: Response, technical: number, financial: number) {
  if (!req.organizationId) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'An active Government organization is required.' } });
  }
  const tenderId = await resolveTenderId(req, req.params.tenderId);
  if (!tenderId) return res.status(404).json({ success: false, error: { code: 'TENDER_NOT_FOUND', message: 'Tender not found.' } });
  const { data: tender } = await supabaseAdmin
    .from('tenders')
    .select('id, tender_number, status, issuing_organization_id, project_id')
    .eq('id', tenderId)
    .maybeSingle();
  if (!tender || tender.issuing_organization_id !== req.organizationId) {
    return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'This tender belongs to a different Government authority.' } });
  }
  const { data: bid } = await supabaseAdmin
    .from('tender_bids')
    .select('id, status')
    .eq('id', req.params.bidId)
    .eq('tender_id', tender.id)
    .is('deleted_at', null)
    .maybeSingle();
  if (!bid) return res.status(404).json({ success: false, error: { code: 'BID_NOT_FOUND', message: 'The selected bid could not be found.' } });
  if (!['SUBMITTED', 'UNDER_EVALUATION'].includes(bid.status)) {
    return res.status(409).json({ success: false, error: { code: 'BID_NOT_EVALUABLE', message: `A bid in status '${bid.status}' cannot be evaluated.` } });
  }
  const combined = Math.round((0.7 * technical + 0.3 * financial) * 100) / 100;
  const now = new Date().toISOString();
  const { data: updated, error } = await supabaseAdmin
    .from('tender_bids')
    .update({ technical_score: technical, financial_score: financial, combined_score: combined, reviewed_by: req.user!.id, reviewed_at: now, status: 'UNDER_EVALUATION' })
    .eq('id', bid.id)
    .select()
    .single();
  if (error || !updated) {
    console.error('Legacy bid evaluation failed', { code: error?.code, message: error?.message });
    return res.status(500).json({ success: false, error: { code: 'EVALUATION_FAILED', message: 'The bid could not be evaluated.' } });
  }
  if (['PUBLISHED', 'CLOSED'].includes(tender.status)) {
    await supabaseAdmin.from('tenders').update({ status: 'UNDER_EVALUATION', updated_at: now }).eq('id', tender.id);
  }
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: req.user!.id,
    actor_organization_id: req.organizationId,
    action: 'BID_EVALUATED',
    entity_type: 'tender_bids',
    entity_id: bid.id,
    new_value: { tender_id: tender.id, technical_score: technical, financial_score: financial, combined_score: combined },
  });
  return res.json({ success: true, data: updated });
}

// POST /api/tenders/:tenderId/award - award to a bid after committee evaluation
tendersRouter.post('/:tenderId/award', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  const bidId = typeof req.body?.bid_id === 'string' ? req.body.bid_id : '';
  if (!UUID_PATTERN.test(bidId)) {
    return res.status(400).json({ success: false, error: { code: 'INVALID_BID', message: 'bid_id is required.' } });
  }
  const tenderId = await resolveTenderId(req, req.params.tenderId);
  if (!tenderId) return res.status(404).json({ success: false, error: { code: 'TENDER_NOT_FOUND', message: 'Tender not found.' } });
  const { data, error } = await req.supabase!.rpc('award_contract', { p_tender_id: tenderId, p_selected_bid_id: bidId });
  if (error) return dbErrorResponse(res, error, 'The contract could not be awarded.');
  return res.json({ success: true, data });
});
