import { Router } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { SubmitProgressSchema, ReviewProgressSchema } from '../validation/schemas.js';

export const progressRouter = Router();

progressRouter.post('/submit', async (req, res) => {
  try {
    const validated = SubmitProgressSchema.parse(req.body);
    const { evidence, ...updateData } = validated;

    const { data: update, error: updateErr } = await supabaseAdmin
      .from('progress_updates')
      .insert({
        ...updateData,
        verification_status: 'SUBMITTED',
      })
      .select()
      .single();

    if (updateErr) throw updateErr;

    if (evidence && evidence.length > 0) {
      const evidenceRows = evidence.map((ev) => ({
        progress_update_id: update.id,
        ...ev,
      }));
      await supabaseAdmin.from('progress_evidence').insert(evidenceRows);
    }

    res.status(201).json({
      success: true,
      data: update,
      message: 'Progress update submitted successfully. Awaiting government verification.',
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'SUBMIT_ERROR', message: err.message } });
  }
});

progressRouter.post('/review', async (req, res) => {
  try {
    const { progress_update_id, decision, verified_progress, review_notes } = ReviewProgressSchema.parse(req.body);

    const { data, error } = await supabaseAdmin.rpc('approve_progress_update', {
      p_update_id: progress_update_id,
      p_decision: decision,
      p_verified_progress: verified_progress,
      p_review_notes: review_notes,
      p_reviewer_id: '11111111-1111-1111-1111-111111111111',
    });

    if (error) throw error;
    res.json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'REVIEW_ERROR', message: err.message } });
  }
});
