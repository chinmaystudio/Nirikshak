import { Router, Response } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { SubmitProgressSchema, ReviewProgressSchema } from '../validation/schemas.js';
import { requireAuth, requireContractor, requireGovernmentWrite, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimit } from '../middleware/security.js';

export const progressRouter = Router();

// POST /api/progress/submit - Submit progress update (Authenticated Contractor ONLY)
// Rules 26, 27: Client submits project, milestone, progress, description, evidence.
// DB/server derives auth.uid(), contractor organization, and verifies contractor assignment.
progressRouter.post(
  '/submit',
  rateLimit({ windowMs: 60 * 1000, max: 30 }),
  requireAuth,
  requireContractor,
  async (req: AuthenticatedRequest, res: Response) => {
    // DF-21: safeParse + first-issue message (same pattern as auth.ts/tenders.ts)
    const parsed = SubmitProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Please check the progress update details.' },
      });
    }

    try {
      const { evidence, project_id, reported_progress, description, milestone_id } = parsed.data;

      // Invoke authoritative database RPC using caller's scoped JWT
      const { data: updateData, error: updateErr } = await req.supabase!.rpc('submit_progress_update', {
        p_project_id: project_id,
        p_reported_progress: reported_progress,
        p_description: description,
        p_milestone_id: milestone_id || null,
      });

      if (updateErr) {
        // DF-21: database failures are 500s with a generic message, not 400s
        console.error('Progress submission failed', { code: updateErr.code, message: updateErr.message });
        return res.status(500).json({
          success: false,
          error: { code: 'SUBMISSION_FAILED', message: 'The progress update could not be submitted.' },
        });
      }

      // If evidence metadata is supplied, record evidence rows
      if (evidence && evidence.length > 0 && updateData?.id) {
        const evidenceRows = evidence.map((ev) => ({
          progress_update_id: updateData.id,
          evidence_type: ev.evidence_type,
          storage_path: ev.storage_path,
          latitude: ev.latitude || null,
          longitude: ev.longitude || null,
          metadata: ev.metadata || {},
        }));
        await req.supabase!.from('progress_evidence').insert(evidenceRows);
      }

      res.status(201).json({
        success: true,
        data: updateData,
        message: 'Progress update submitted successfully. Awaiting government verification.',
      });
    } catch (err: any) {
      console.error('Unexpected progress submission error', err);
      res.status(500).json({ success: false, error: { code: 'SUBMIT_ERROR', message: 'The progress update could not be submitted.' } });
    }
  }
);

// POST /api/progress/review - Review and verify progress update (Authenticated Government Official ONLY)
// Rules 28, 29: Reviewer UUID derived strictly from auth.uid(). Supports APPROVED, REJECTED, CLARIFICATION_REQUIRED.
progressRouter.post(
  '/review',
  rateLimit({ windowMs: 60 * 1000, max: 30 }),
  requireAuth,
  // DF-38: reviewing progress is a write — auditors are read-only.
  requireGovernmentWrite,
  async (req: AuthenticatedRequest, res: Response) => {
    // DF-21: safeParse + first-issue message (same pattern as auth.ts/tenders.ts)
    const parsed = ReviewProgressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Please check the review details.' },
      });
    }

    try {
      const { progress_update_id, decision, verified_progress, review_notes } = parsed.data;

      // Invoke authoritative database review RPC
      const { data, error } = await req.supabase!.rpc('approve_progress_update', {
        p_update_id: progress_update_id,
        p_decision: decision,
        p_verified_progress: verified_progress ?? null,
        p_review_notes: review_notes,
      });

      if (error) {
        // DF-21: database failures are 500s with a generic message, not 400s
        console.error('Progress review failed', { code: error.code, message: error.message });
        return res.status(500).json({
          success: false,
          error: { code: 'REVIEW_FAILED', message: 'The progress review could not be completed.' },
        });
      }

      res.json({ success: true, data });
    } catch (err: any) {
      console.error('Unexpected progress review error', err);
      res.status(500).json({ success: false, error: { code: 'REVIEW_ERROR', message: 'The progress review could not be completed.' } });
    }
  }
);
