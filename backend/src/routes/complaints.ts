import { Router } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { CreateComplaintSchema } from '../validation/schemas.js';

export const complaintsRouter = Router();

complaintsRouter.post('/', async (req, res) => {
  try {
    const validated = CreateComplaintSchema.parse(req.body);
    const { evidence_paths, ...compData } = validated;

    const refNum = `NIR-CMP-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const { data, error } = await supabaseAdmin
      .from('complaints')
      .insert({
        ...compData,
        reference_number: refNum,
        status: 'SUBMITTED',
      })
      .select()
      .single();

    if (error) throw error;

    if (evidence_paths && evidence_paths.length > 0) {
      const evs = evidence_paths.map((p) => ({
        complaint_id: data.id,
        storage_path: p,
      }));
      await supabaseAdmin.from('complaint_evidence').insert(evs);
    }

    res.status(201).json({
      success: true,
      data: {
        ...data,
        reference_number: refNum,
      },
    });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'COMPLAINT_ERROR', message: err.message } });
  }
});

complaintsRouter.get('/track/:ref', async (req, res) => {
  try {
    const { ref } = req.params;
    const { data, error } = await supabaseAdmin
      .from('complaints')
      .select('*, complaint_updates(*), complaint_evidence(*), projects(project_name, project_authority)')
      .eq('reference_number', ref)
      .single();

    if (error || !data) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Complaint reference not found' } });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'TRACK_ERROR', message: err.message } });
  }
});
