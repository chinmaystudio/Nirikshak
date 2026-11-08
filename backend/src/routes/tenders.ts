import { Router, Response } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { requireAuth, requireGovernmentWrite, AuthenticatedRequest } from '../middleware/auth.js';
import { CreateTenderSchema, EvaluateBidSchema } from '../validation/schemas.js';

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

    const tenderNumber = `TND-MH-${Date.now().toString().slice(-8)}`;
    const publicationDate = new Date();
    const bidDueDate = new Date(publicationDate.getTime() + 30 * 86_400_000);

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
    let query = supabaseAdmin
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

// POST /api/tenders/:tenderId/bids/:bidId/evaluate - Score a submitted bid
// (QCBS 70:30). Net-new: no scoring write path existed in either repo.
// Requires migration 030 (combined_score / reviewed_by / reviewed_at columns).
tendersRouter.post('/:tenderId/bids/:bidId/evaluate', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  const parsed = EvaluateBidSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_EVALUATION', message: parsed.error.issues[0]?.message || 'Please check the evaluation scores.' },
    });
  }

  if (!req.organizationId) {
    return res.status(403).json({
      success: false,
      error: { code: 'FORBIDDEN', message: 'An active Government organization is required.' },
    });
  }

  try {
    const { tenderId, bidId } = req.params;
    if (!UUID_PATTERN.test(bidId)) {
      return res.status(404).json({
        success: false,
        error: { code: 'BID_NOT_FOUND', message: 'The selected bid could not be found.' },
      });
    }

    // Resolve the tender by UUID or tender_number
    let tenderQuery = supabaseAdmin
      .from('tenders')
      .select('id, tender_number, project_id, status, issuing_organization_id')
      .is('deleted_at', null);
    tenderQuery = UUID_PATTERN.test(tenderId)
      ? tenderQuery.eq('id', tenderId)
      : tenderQuery.eq('tender_number', tenderId);
    const { data: tender, error: tenderError } = await tenderQuery.maybeSingle();
    if (tenderError) {
      console.error('Tender lookup for evaluation failed', { code: tenderError.code, message: tenderError.message });
      return res.status(500).json({
        success: false,
        error: { code: 'EVALUATION_FAILED', message: 'The bid could not be evaluated.' },
      });
    }
    if (!tender) {
      return res.status(404).json({
        success: false,
        error: { code: 'TENDER_NOT_FOUND', message: 'The selected tender could not be found.' },
      });
    }

    // Ownership: the tender was issued by the caller's organization, or the
    // caller manages the tender's project (can_manage_project semantics).
    let canManage = tender.issuing_organization_id === req.organizationId;
    if (!canManage) {
      const { data: project } = await supabaseAdmin
        .from('projects')
        .select('government_organization_id')
        .eq('id', tender.project_id)
        .maybeSingle();
      canManage = !!project && project.government_organization_id === req.organizationId;
    }
    if (!canManage) {
      return res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'This tender belongs to a different Government authority.' },
      });
    }

    const { data: bid, error: bidError } = await supabaseAdmin
      .from('tender_bids')
      .select('id, tender_id, status')
      .eq('id', bidId)
      .eq('tender_id', tender.id)
      .is('deleted_at', null)
      .maybeSingle();
    if (bidError) {
      console.error('Bid lookup for evaluation failed', { code: bidError.code, message: bidError.message });
      return res.status(500).json({
        success: false,
        error: { code: 'EVALUATION_FAILED', message: 'The bid could not be evaluated.' },
      });
    }
    if (!bid) {
      return res.status(404).json({
        success: false,
        error: { code: 'BID_NOT_FOUND', message: 'The selected bid could not be found.' },
      });
    }
    if (!['SUBMITTED', 'UNDER_EVALUATION'].includes(bid.status)) {
      return res.status(409).json({
        success: false,
        error: { code: 'BID_NOT_EVALUABLE', message: `A bid in status '${bid.status}' cannot be evaluated.` },
      });
    }

    const { technical_score, financial_score } = parsed.data;
    const combinedScore = Math.round((0.7 * technical_score + 0.3 * financial_score) * 100) / 100;
    const reviewedAt = new Date().toISOString();

    const { data: updatedBid, error: updateError } = await supabaseAdmin
      .from('tender_bids')
      .update({
        technical_score,
        financial_score,
        combined_score: combinedScore,
        reviewed_by: req.user!.id,
        reviewed_at: reviewedAt,
        status: 'UNDER_EVALUATION',
      })
      .eq('id', bid.id)
      .select()
      .single();
    if (updateError || !updatedBid) {
      console.error('Bid evaluation update failed', { code: updateError?.code, message: updateError?.message });
      return res.status(500).json({
        success: false,
        error: { code: 'EVALUATION_FAILED', message: 'The bid could not be evaluated.' },
      });
    }

    // Move the tender into evaluation once scoring starts
    if (['PUBLISHED', 'CLOSED'].includes(tender.status)) {
      const { error: tenderUpdateError } = await supabaseAdmin
        .from('tenders')
        .update({ status: 'UNDER_EVALUATION', updated_at: reviewedAt })
        .eq('id', tender.id);
      if (tenderUpdateError) {
        console.error('Tender status update after evaluation failed', {
          code: tenderUpdateError.code,
          message: tenderUpdateError.message,
          tender_id: tender.id,
        });
      }
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user!.id,
      actor_organization_id: req.organizationId,
      action: 'BID_EVALUATED',
      entity_type: 'tender_bids',
      entity_id: bid.id,
      new_value: {
        tender_id: tender.id,
        tender_number: tender.tender_number,
        technical_score,
        financial_score,
        combined_score: combinedScore,
      },
    });

    return res.json({ success: true, data: updatedBid });
  } catch (error) {
    console.error('Unexpected bid evaluation error', error);
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'The bid could not be evaluated.' },
    });
  }
});
