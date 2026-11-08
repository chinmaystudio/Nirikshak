import { Router, Request, Response } from 'express';
import { supabaseAdmin, supabasePublic, createAuthenticatedClient } from '../services/supabase.js';
import { CreateProjectSchema } from '../validation/schemas.js';
import { requireAuth, requireGovernmentWrite, AuthenticatedRequest } from '../middleware/auth.js';

export const projectsRouter = Router();

// GET /api/projects - Public project catalog (public projections only)
projectsRouter.get('/', async (req: Request, res: Response) => {
  try {
    const { city, sector, status, limit = 50, offset = 0 } = req.query;

    let query = supabasePublic
      .from('projects')
      .select(
        'id, nirikshak_project_id, project_name, description, sector, subsector, project_authority, state, city, location_text, total_cost_inr_crore, planned_start_date, original_completion_date, normalized_status, physical_progress_percent, current_status_verified, is_public',
        { count: 'exact' }
      )
      .eq('is_public', true)
      .is('deleted_at', null)
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
    console.error('Public project list query failed', {
      code: err?.code,
      message: err?.message,
      details: err?.details,
    });
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to retrieve project list' } });
  }
});

// GET /api/projects/:id - Project detail (sanitized public projection unless authenticated with privileges)
projectsRouter.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    // Check if an authenticated user header was passed
    const authHeader = req.header('authorization');
    let userClient = null;
    let isPrivilegedGov = false;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      try {
        const { data: authData } = await supabaseAdmin.auth.getUser(token);
        if (authData?.user) {
          userClient = await createAuthenticatedClient(token);
          const { data: member } = await supabaseAdmin
            .from('organization_members')
            .select('role, organization_id')
            .eq('user_id', authData.user.id)
            .ilike('status', 'active')
            .limit(1)
            .maybeSingle();

          if (member && ['government_admin', 'chief_engineer', 'project_officer', 'government_engineer', 'auditor'].includes(member.role)) {
            isPrivilegedGov = true;
          }
        }
      } catch {
        /* proceed as public viewer */
      }
    }

    if (isPrivilegedGov && userClient) {
      // Government officers see complete authorized relational project data via RLS
      let query = userClient.from('projects').select('*, project_milestones(*), contracts(*), complaints(*)');
      if (isUuid) {
        query = query.eq('id', id);
      } else {
        query = query.eq('nirikshak_project_id', id);
      }
      const { data, error } = await query.single();
      if (error && error.code !== 'PGRST116') {
        // DF-01: a real PostgREST failure is a 500, never a masked 404.
        console.error('Government project detail query failed', { code: error.code, message: error.message });
        return res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to retrieve project details' } });
      }
      if (!data) {
        return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
      }
      return res.json({ success: true, data });
    }

    // Public / Citizen projection (Rules 18, 30: Never expose private contracts, internal complaints, or unverified progress)
    let query = supabasePublic
      .from('projects')
      .select('id, nirikshak_project_id, project_name, description, sector, subsector, project_authority, state, city, location_text, latitude, longitude, total_cost_inr_crore, planned_start_date, original_completion_date, normalized_status, physical_progress_percent, current_status_verified, is_public, project_milestones(id, milestone_name, display_order, planned_end_date, verified_progress, status)')
      .eq('is_public', true)
      .is('deleted_at', null);

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      query = query.eq('nirikshak_project_id', id);
    }

    const { data, error } = await query.single();
    if (error && error.code !== 'PGRST116') {
      // DF-01: distinguish a failed query (500) from a genuine miss (404).
      // PGRST116 is PostgREST's "0 rows" signal from .single().
      console.error('Public project detail query failed', { code: error.code, message: error.message });
      return res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to retrieve project details' } });
    }
    if (!data) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    res.json({ success: true, data });
  } catch (err: any) {
    console.error('Public project detail query failed', {
      code: err?.code,
      message: err?.message,
      details: err?.details,
    });
    res.status(500).json({ success: false, error: { code: 'FETCH_ERROR', message: 'Failed to retrieve project details' } });
  }
});

// POST /api/projects - Create new project (Government Admin / Officer ONLY)
// Rules 18, 33: Never allow unauthenticated or citizen callers to create projects
// DF-38: write guard — auditors are read-only.
projectsRouter.post('/', requireAuth, requireGovernmentWrite, async (req: AuthenticatedRequest, res: Response) => {
  // DF-21: safeParse + first-issue message (same pattern as auth.ts/tenders.ts)
  const parsed = CreateProjectSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: parsed.error.issues[0]?.message || 'Please check the project details.' },
    });
  }

  try {
    const { technicalApprovalDate, ...fields } = parsed.data;
    const projectPayload = {
      ...fields,
      // DF-20: map the form's camelCase field onto its DB column (migration 033)
      technical_approval_date: technicalApprovalDate || null,
      government_organization_id: req.organizationId,
      created_by: req.user!.id,
    };

    // Insert via authenticated client respecting RLS
    const { data, error } = await req.supabase!
      .from('projects')
      .insert(projectPayload)
      .select()
      .single();

    if (error) {
      // DF-21: database failures are 500s with a generic message, not 400s
      console.error('Project creation failed', { code: error.code, message: error.message });
      return res.status(500).json({
        success: false,
        error: { code: 'PROJECT_CREATE_FAILED', message: 'The project could not be created.' },
      });
    }

    // Record audit log
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user!.id,
      action: 'PROJECT_CREATE',
      entity_type: 'projects',
      entity_id: data.id,
      new_value: {
        project_name: data.project_name,
        government_org_id: req.organizationId,
        cost: data.total_cost_inr_crore,
      },
    });

    res.status(201).json({ success: true, data });
  } catch (err: any) {
    console.error('Unexpected project creation error', err);
    res.status(500).json({ success: false, error: { code: 'INTERNAL_ERROR', message: 'The project could not be created.' } });
  }
});
