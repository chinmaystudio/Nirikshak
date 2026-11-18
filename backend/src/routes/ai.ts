import { Router, Response } from 'express';
import {
  getLLMProvider,
  chatJson,
  textModelCandidates,
  visionModelCandidates,
} from '../ai/provider.js';
import { supabaseAdmin } from '../services/supabase.js';
import { requireAuth, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimit, requireHuman } from '../middleware/security.js';

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
      // Deterministic signals computed from the project record itself.
      // These exist for every project (unlike the operational feeds below,
      // which are empty until officers/contractors record data), so the
      // model always has concrete, project-specific facts to reason from:
      // how far the schedule has elapsed vs how far the work has actually
      // progressed, budget utilisation, milestone completion, and whether
      // the original completion date has already passed.
      const now = new Date();
      const startDate = project.planned_start_date ? new Date(project.planned_start_date) : null;
      const endDate = project.original_completion_date ? new Date(project.original_completion_date) : null;
      let scheduleElapsed: number | null = null;
      if (startDate && endDate && endDate.getTime() > startDate.getTime()) {
        scheduleElapsed =
          Math.min(100, Math.max(0, ((now.getTime() - startDate.getTime()) / (endDate.getTime() - startDate.getTime())) * 100));
      }
      const physical =
        typeof project.physical_progress_percent === 'number' ? project.physical_progress_percent : null;
      const milestoneRows: any[] = (project as any).project_milestones ?? [];
      const milestonesDone = milestoneRows.filter((m: any) =>
        ['COMPLETED', 'VERIFIED', 'APPROVED'].includes(String(m?.status ?? '').toUpperCase())
      ).length;
      const latestCumulativeSpent =
        (finRes.data ?? []).find((f: any) => typeof f.cumulative_spent_inr_crore === 'number')
          ?.cumulative_spent_inr_crore ?? null;
      const totalCost =
        typeof project.total_cost_inr_crore === 'number' ? project.total_cost_inr_crore : null;
      const round1 = (n: number) => Math.round(n * 10) / 10;
      const computedSignals = {
        as_of: now.toISOString().slice(0, 10),
        schedule_elapsed_percent: scheduleElapsed !== null ? round1(scheduleElapsed) : null,
        physical_progress_percent: physical,
        progress_variance_points:
          scheduleElapsed !== null && physical !== null ? round1(physical - scheduleElapsed) : null,
        days_until_original_completion: endDate
          ? Math.round((endDate.getTime() - now.getTime()) / 86400000)
          : null,
        is_past_original_completion: endDate ? now.getTime() > endDate.getTime() : null,
        total_cost_inr_crore: totalCost,
        latest_cumulative_spent_inr_crore: latestCumulativeSpent,
        budget_utilization_percent:
          totalCost && latestCumulativeSpent != null ? round1((latestCumulativeSpent / totalCost) * 100) : null,
        milestones_total: milestoneRows.length,
        milestones_completed: milestonesDone,
        milestone_completion_percent:
          milestoneRows.length > 0 ? round1((milestonesDone / milestoneRows.length) * 100) : null,
      };

      const enrichedContext = {
        project,
        computed_signals: computedSignals,
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
      const prompt = `Conduct an exhaustive multidimensional infrastructure audit for ${project.project_name}. Identify schedule slippage, financial variances, and risk indicators. Base every claim on the supplied data. The context includes computed_signals — deterministic figures computed from the project record (schedule elapsed vs physical progress variance, budget utilisation, milestone completion, days to/past the original completion date): lead the summary with the most significant concrete findings from computed_signals and the operational data, citing the actual numbers. Where an operational feed (finance, inspections, complaints, contracts) is empty, treat that as a data-recording gap to list under recommended_actions — do not make missing data the headline of the summary when computed_signals support concrete findings.`;

      const rawAnalysis = await provider.analyzeProject(prompt, enrichedContext as any);

      // Single source of truth for risk: the level is DERIVED from the
      // score with fixed bands, server-side. Previously the model's
      // free-text level was stored in severity/title while the risk_level
      // column took its database default (MEDIUM), so one insight could
      // read "LOW Risk" in the title and "MEDIUM" on the badge — the
      // contradiction users saw as random predictions.
      const bandFor = (score: number): string =>
        score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW';
      const safeScore =
        typeof rawAnalysis.risk_score === 'number' && Number.isFinite(rawAnalysis.risk_score)
          ? Math.min(100, Math.max(0, rawAnalysis.risk_score))
          : 0;
      const analysis = {
        ...rawAnalysis,
        risk_score: safeScore,
        risk_level: bandFor(safeScore) as typeof rawAnalysis.risk_level,
      };

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
        risk_level: analysis.risk_level,
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
      console.error('AI analysis failed', { message: err?.message });
      res.status(statusCode).json({
        success: false,
        error: {
          code: isUnavailable ? 'AI_UNAVAILABLE' : 'AI_ERROR',
          // Provider details stay in the server log, not in the response.
          message: isUnavailable
            ? 'AI analysis is not available right now. No insight was generated.'
            : 'AI risk analysis failed. No insight was generated; please try again later.',
        },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/ai/vision — citizen infrastructure scanner (public, rate limited)
// The image is analysed by a real vision model. Previously the frontend
// "scanner" never looked at the photo at all: it cycled bundled profiles by
// visit count and invented the result. This endpoint replaces that.
// ---------------------------------------------------------------------------
aiRouter.post(
  '/vision',
  rateLimit({ windowMs: 60 * 1000, max: 6 }),
  requireHuman(),
  async (req: any, res: Response) => {
    try {
      const image = req.body?.image;
      const hint = typeof req.body?.hint === 'string' ? req.body.hint.slice(0, 200) : '';
      if (
        typeof image !== 'string' ||
        !/^data:image\/(jpeg|jpg|png|webp);base64,/.test(image) ||
        image.length > 4_500_000
      ) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'A JPEG/PNG/WebP image (data URL, max ~3.3 MB) is required.' },
        });
      }

      const system = `You are NIRIKSHAK Vision, an infrastructure identification assistant for Indian public works.
Look at the photo and identify the infrastructure shown. Use ONLY what is visible in the image; do not invent project names, costs, or authorities beyond a generic responsible-authority type.
Return VALID JSON ONLY:
{
  "label": string,               // e.g. "Asphalt road with potholes"
  "infrastructure_type": string, // one of: road, bridge, water, sanitation, power, rail, building, other, not_infrastructure
  "condition_summary": string,   // 1-2 sentences on visible condition
  "visible_issues": string[],    // concrete visible defects, [] if none
  "authority_hint": string,      // generic authority type, e.g. "Municipal corporation / PWD"
  "confidence": number | null    // your own 0-1 certainty, null if unsure
}`;
      const result = await chatJson(
        system,
        [
          { type: 'text', text: hint ? `Citizen note: ${hint}\nIdentify the infrastructure in this photo.` : 'Identify the infrastructure in this photo.' },
          { type: 'image_url', image_url: { url: image } },
        ],
        visionModelCandidates()
      );

      const j = result.json ?? {};
      const analysis = {
        label: typeof j.label === 'string' ? j.label : 'Unidentified infrastructure',
        infrastructure_type: typeof j.infrastructure_type === 'string' ? j.infrastructure_type : 'other',
        condition_summary: typeof j.condition_summary === 'string' ? j.condition_summary : '',
        visible_issues: Array.isArray(j.visible_issues) ? j.visible_issues.filter((x: any) => typeof x === 'string').slice(0, 8) : [],
        authority_hint: typeof j.authority_hint === 'string' ? j.authority_hint : '',
        confidence: typeof j.confidence === 'number' ? Math.min(1, Math.max(0, j.confidence)) : null,
      };

      await supabaseAdmin.from('ai_runs').insert({
        project_id: null,
        task: 'vision_scan',
        provider: 'OpenRouter (Nemotron VL)',
        model: result.model,
        prompt_version: 'v1',
        status: 'SUCCESS',
        output_tokens: result.totalTokens,
        latency_ms: result.latencyMs,
        completed_at: new Date().toISOString(),
      });

      res.json({ success: true, data: { analysis, model: result.model } });
    } catch (err: any) {
      const isUnavailable = err.message?.includes('AI_ANALYSIS_UNAVAILABLE');
      res.status(isUnavailable ? 503 : 502).json({
        success: false,
        error: {
          code: isUnavailable ? 'AI_UNAVAILABLE' : 'AI_ERROR',
          message: isUnavailable
            ? 'AI vision is not configured on this server.'
            : 'The vision model could not analyse this image. Please try again.',
        },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/ai/ask — citizen assistant grounded in the public project
// database (public, rate limited). Retrieval first: matching projects are
// fetched from public_projects_view, and the model may only use those rows.
// If the model is unavailable, the answer is composed deterministically
// from the same rows and labelled source='project_data' — never invented.
// ---------------------------------------------------------------------------
aiRouter.post(
  '/ask',
  rateLimit({ windowMs: 60 * 1000, max: 10 }),
  requireHuman(),
  async (req: any, res: Response) => {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question.trim() : '';
      if (question.length < 3 || question.length > 500) {
        return res.status(400).json({
          success: false,
          error: { code: 'VALIDATION_ERROR', message: 'A question of 3–500 characters is required.' },
        });
      }

      const tokens = Array.from(
        new Set(
          question
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter((w: string) => w.length > 3)
        )
      ).slice(0, 5);

      const cols =
        'id, project_name, sector, city, district, state, normalized_status, physical_progress_percent, total_cost_inr_crore, contractor_name';
      let projects: any[] = [];
      if (tokens.length > 0) {
        const orFilter = tokens
          .map((t) => `project_name.ilike.%${t}%,sector.ilike.%${t}%,city.ilike.%${t}%,district.ilike.%${t}%`)
          .join(',');
        const { data } = await supabaseAdmin
          .from('public_projects_view')
          .select(cols)
          .or(orFilter)
          .limit(8);
        projects = data ?? [];
      }
      if (projects.length === 0) {
        const { data } = await supabaseAdmin
          .from('public_projects_view')
          .select(cols)
          .order('updated_at', { ascending: false })
          .limit(8);
        projects = data ?? [];
      }
      const { count: totalPublic } = await supabaseAdmin
        .from('public_projects_view')
        .select('id', { count: 'exact', head: true });

      const context = {
        total_public_projects: totalPublic ?? null,
        matched_projects: projects,
      };

      try {
        const result = await chatJson(
          `You are the NIRIKSHAK citizen assistant. Answer the citizen's question using ONLY the supplied public project data. If the data does not contain the answer, say so plainly and suggest what the citizen can check (project page or filing a complaint). Never invent projects, figures, dates, or officials.
Return VALID JSON ONLY: { "answer": string, "referenced_project_ids": string[] }`,
          `Question: ${question}\n\nPublic project data:\n${JSON.stringify(context, null, 2)}`,
          textModelCandidates()
        );
        const answer =
          typeof result.json?.answer === 'string' && result.json.answer.trim()
            ? result.json.answer.trim()
            : null;
        if (answer) {
          return res.json({
            success: true,
            data: { answer, model: result.model, source: 'ai', projects },
          });
        }
        throw new Error('empty answer');
      } catch {
        // Deterministic fallback composed from the retrieved rows only.
        const lines = projects.slice(0, 5).map(
          (p) =>
            `• ${p.project_name} (${p.city ?? p.district ?? p.state ?? '—'}) — status ${p.normalized_status ?? '—'}, physical progress ${p.physical_progress_percent ?? '—'}%`
        );
        const answer =
          projects.length > 0
            ? `The AI assistant is unavailable right now, so here is the matching live project data for your question:\n${lines.join('\n')}\nOpen a project page for full details, or file a complaint if you spotted an issue.`
            : 'The AI assistant is unavailable right now and no matching public projects were found. Please try a project name, city, or sector.';
        return res.json({
          success: true,
          data: { answer, model: null, source: 'project_data', projects },
        });
      }
    } catch (err: any) {
      res.status(500).json({
        success: false,
        error: { code: 'AI_ERROR', message: 'The assistant could not answer right now. Please try again later.' },
      });
    }
  }
);
