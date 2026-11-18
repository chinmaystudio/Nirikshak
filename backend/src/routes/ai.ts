import { Router, Response } from 'express';
import { getLLMProvider } from '../ai/provider.js';
import { supabaseAdmin } from '../services/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimit } from '../middleware/security.js';

export const aiRouter = Router();

// POST /api/ai/analyze/:projectId - Trigger AI infrastructure project risk audit
// Rules 57-64: Backend only, authenticated, rate limited, PII sanitized, advisory only.
aiRouter.post(
  '/analyze/:projectId',
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  requireAuth,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const { projectId } = req.params;
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);

      // Verify caller is government officer or assigned contractor
      const isGovernment = [
        'government_admin',
        'chief_engineer',
        'project_officer',
        'government_engineer',
        'auditor',
      ].includes(req.role || '');
      const isContractor = [
        'contractor_admin',
        'contractor_manager',
        'contractor_engineer',
        'contractor_site_engineer',
      ].includes(req.role || '');

      if (!isGovernment && !isContractor) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'AI project analysis is available only to authorized project organizations.' },
        });
      }

      let projectQuery = req.supabase!
        .from('projects')
        .select('id, nirikshak_project_id, project_name, description, sector, subsector, project_authority, state, city, total_cost_inr_crore, planned_start_date, original_completion_date, normalized_status, physical_progress_percent, current_status_verified, government_organization_id, project_milestones(id, milestone_name, verified_progress, status), delay_events(*)');

      if (isUuid) {
        projectQuery = projectQuery.eq('id', projectId);
      } else {
        projectQuery = projectQuery.eq('nirikshak_project_id', projectId);
      }

      const { data: project, error: pErr } = await projectQuery.single();

      if (pErr || !project) {
        return res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Project not found or access denied by authorization policy' },
        });
      }

      // Check government org isolation (Rule 8)
      if (isGovernment && req.organizationId && project.government_organization_id && project.government_organization_id !== req.organizationId) {
        return res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Project belongs to a different government authority' },
        });
      }

      if (isContractor) {
        if (!req.organizationId) {
          return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'An active contractor organization is required.' } });
        }
        const [{ data: contracts }, { data: assignments }] = await Promise.all([
          supabaseAdmin.from('contracts').select('id').eq('project_id', project.id).eq('contractor_organization_id', req.organizationId).limit(1),
          supabaseAdmin.from('project_organizations').select('id').eq('project_id', project.id).eq('organization_id', req.organizationId).limit(1),
        ]);
        if ((!contracts || contracts.length === 0) && (!assignments || assignments.length === 0)) {
          return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Your contractor organization is not assigned to this project.' } });
        }
      }

      // Enrich the analysis context with the project's real operational
      // data. Previously the model saw only headline project fields plus
      // milestones and delay_events (a table with zero rows), so its
      // output could not be project-specific. Aggregates are computed
      // here, from the database, at request time.
      const pid = project.id;
      const [finRes, inspRes, progRes, compRes, contractRes] = await Promise.all([
        supabaseAdmin
          .from('financial_updates')
          .select('update_type, amount_inr_crore, cumulative_spent_inr_crore, fiscal_year, created_at')
          .eq('project_id', pid)
          .order('created_at', { ascending: false })
          .limit(12),
        supabaseAdmin
          .from('inspections')
          .select('inspection_type, status, scheduled_date, overall_rating, created_at')
          .eq('project_id', pid)
          .order('created_at', { ascending: false })
          .limit(8),
        supabaseAdmin
          .from('progress_updates')
          .select('verification_status, reported_progress_percent, created_at')
          .eq('project_id', pid)
          .order('created_at', { ascending: false })
          .limit(50),
        supabaseAdmin
          .from('complaints')
          .select('category, severity, status, created_at')
          .eq('project_id', pid)
          .order('created_at', { ascending: false })
          .limit(50),
        supabaseAdmin
          .from('contracts')
          .select('status, contract_value_inr_crore, award_date, scheduled_completion_date')
          .eq('project_id', pid)
          .limit(5),
      ]);
      const countBy = (rows: any[] | null, key: string) =>
        (rows ?? []).reduce((acc: Record<string, number>, r: any) => {
          const k = String(r?.[key] ?? 'UNKNOWN');
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {});
      const enrichedContext = {
        project,
        finance: {
          recent_updates: finRes.data ?? [],
          total_updates: (finRes.data ?? []).length,
        },
        inspections: {
          recent: inspRes.data ?? [],
          by_status: countBy(inspRes.data, 'status'),
        },
        progress: {
          by_verification_status: countBy(progRes.data, 'verification_status'),
          latest_reported_percent: progRes.data?.[0]?.reported_progress_percent ?? null,
        },
        complaints: {
          total_recent: (compRes.data ?? []).length,
          by_status: countBy(compRes.data, 'status'),
          by_severity: countBy(compRes.data, 'severity'),
          by_category: countBy(compRes.data, 'category'),
        },
        contracts: contractRes.data ?? [],
      };

      const provider = getLLMProvider();
      const prompt = `Conduct an exhaustive multidimensional infrastructure audit for ${project.project_name}. Identify schedule slippage, financial variances, and risk indicators. Base every claim on the supplied project, finance, inspection, progress, complaint and contract data; where a data source is empty, say the evidence is insufficient instead of speculating.`;

      const analysis = await provider.analyzeProject(prompt, enrichedContext as any);

      // Record the run (AI_ARCHITECTURE.md: insights are linked to ai_runs).
      const runMeta = (provider as any).lastRun as
        | { model: string; latencyMs: number; totalTokens: number | null; promptHash: string }
        | null;
      let aiRunId: string | null = null;
      {
        const { data: runRow, error: runErr } = await supabaseAdmin
          .from('ai_runs')
          .insert({
            project_id: pid,
            task: 'project_risk_analysis',
            provider: provider.name,
            model: runMeta?.model ?? 'unknown',
            prompt_version: 'v2',
            input_hash: runMeta?.promptHash ?? null,
            status: 'SUCCESS',
            output_tokens: runMeta?.totalTokens ?? null,
            latency_ms: runMeta?.latencyMs ?? null,
            completed_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (runErr) {
          console.error('AI run persistence failed', { code: runErr.code, message: runErr.message, project_id: pid });
        } else {
          aiRunId = runRow?.id ?? null;
        }
      }

      // Save insight to database using service role for persistence.
      // DF-23: check the insert result — previously a failed insert still
      // produced a 200 that callers read as "saved to the audit trail".
      // Confidence is NULL: the provider schema returns no confidence, and
      // the previous hard-coded 0.92 (and the column's old 0.85 default)
      // were fabricated numbers presented as model certainty.
      const insightPayload: Record<string, unknown> = {
        project_id: pid,
        ai_run_id: aiRunId,
        insight_type: 'project_risk',
        title: `${analysis.risk_level} Risk: ${project.project_name}`,
        summary: analysis.summary,
        severity: analysis.risk_level,
        confidence: null,
        evidence: analysis.evidence,
        recommended_actions: analysis.recommended_actions,
        status: 'ACTIVE',
        // Migration 036 columns: full structured breakdown + risk score.
        risk_score: analysis.risk_score,
        details: {
          schedule: analysis.schedule,
          finance: analysis.finance,
          environment: analysis.environment,
        },
      };
      let { data: insight, error: insightError } = await supabaseAdmin
        .from('ai_insights')
        .insert(insightPayload)
        .select()
        .single();
      if (insightError && /risk_score|details/.test(insightError.message || '')) {
        // 036 not applied yet on this database — persist without the new
        // columns rather than losing the analysis.
        const { risk_score: _rs, details: _d, ...legacyPayload } = insightPayload;
        ({ data: insight, error: insightError } = await supabaseAdmin
          .from('ai_insights')
          .insert(legacyPayload)
          .select()
          .single());
      }

      const insightSaved = !insightError && !!insight;
      if (!insightSaved) {
        console.error('AI insight persistence failed', {
          code: insightError?.code,
          message: insightError?.message || 'insert returned no row',
          project_id: project.id,
        });
      }

      // Record audit log
      await supabaseAdmin.from('audit_logs').insert({
        actor_id: req.user!.id,
        action: 'AI_AUDIT_RUN',
        entity_type: 'projects',
        entity_id: project.id,
        new_value: {
          risk_level: analysis.risk_level,
          risk_score: analysis.risk_score,
          insight_id: insight?.id ?? null,
          insight_saved: insightSaved,
        },
      });

      res.json({
        success: true,
        data: {
          provider: provider.name,
          provider_model: runMeta?.model ?? null,
          analysis,
          // DF-23: saved_insight is null and insight_saved is false when the
          // analysis ran but could not be persisted — never imply it saved.
          saved_insight: insightSaved ? insight : null,
          insight_saved: insightSaved,
        },
      });
    } catch (err: any) {
      const isUnavailable = err.message?.includes('AI_ANALYSIS_UNAVAILABLE') || err.message?.includes('OPENROUTER_API_KEY');
      const statusCode = isUnavailable ? 503 : 500;
      res.status(statusCode).json({
        success: false,
        error: {
          code: isUnavailable ? 'AI_UNAVAILABLE' : 'AI_ERROR',
          message: err.message || 'AI risk analysis processing failed',
        },
      });
    }
  }
);
