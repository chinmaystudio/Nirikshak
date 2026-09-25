import { Router } from 'express';
import { supabaseAdmin } from '../services/supabase.js';
import { CreateProjectSchema } from '../validation/schemas.js';

export const projectsRouter = Router();

projectsRouter.get('/', async (req, res) => {
  try {
    const { city, sector, status, limit = 50, offset = 0 } = req.query;
    let query = supabaseAdmin
      .from('projects')
      .select('*', { count: 'exact' })
      .range(Number(offset), Number(offset) + Number(limit) - 1)
      .order('total_cost_inr_crore', { ascending: false, nullsFirst: false });

    if (city) query = query.eq('city', String(city));
    if (sector) query = query.eq('sector', String(sector));
    if (status) query = query.eq('normalized_status', String(status));

    const { data, count, error } = await query;
    if (error) throw error;

    res.json({
      success: true,
      data: {
        projects: data,
        total: count,
        limit: Number(limit),
        offset: Number(offset),
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

projectsRouter.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = supabaseAdmin.from('projects').select('*, project_milestones(*), contracts(*), complaints(*)');
    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('nirikshak_project_id', id);
    }

    const { data, error } = await query.single();
    if (error || !data) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: err.message } });
  }
});

projectsRouter.post('/', async (req, res) => {
  try {
    const validated = CreateProjectSchema.parse(req.body);
    const { data, error } = await supabaseAdmin.from('projects').insert(validated).select().single();
    if (error) throw error;
    res.status(201).json({ success: true, data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: { code: 'VALIDATION_ERROR', message: err.message } });
  }
});
