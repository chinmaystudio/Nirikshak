import { Router } from 'express';
import { getLLMProvider } from '../ai/provider.js';
import { supabaseAdmin } from '../services/supabase.js';

export const aiRouter = Router();

aiRouter.post('/analyze/:projectId', async (req, res) => {
  try {
    const { projectId } = req.params;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(projectId);

    let query = supabaseAdmin.from('projects').select('*, project_milestones(*), complaints(*), delay_events(*)');
    if (isUuid) {
      query = query.eq('id', projectId);
    } else {
      query = query.eq('nirikshak_project_id', projectId);
    }

    const { data: project, error: pErr } = await query.single();
    if (pErr || !project) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Project not found' } });
    }

    const provider = getLLMProvider();
    const prompt = `Conduct an exhaustive multidimensional infrastructure audit for ${project.project_name}. Identify schedule slippage, financial variances, and citizen grievance clusters.`;
    
    const analysis = await provider.analyzeProject(prompt, project);

    const { data: insight } = await supabaseAdmin.from('ai_insights').insert({
      project_id: project.id,
      insight_type: 'schedule_risk',
      title: `${analysis.risk_level} Risk: ${project.project_name}`,
      summary: analysis.summary,
      severity: analysis.risk_level,
      confidence: 0.92,
      evidence: analysis.evidence,
      recommended_actions: analysis.recommended_actions,
      status: 'ACTIVE',
    }).select().single();

    res.json({
      success: true,
      data: {
        provider: provider.name,
        analysis,
        saved_insight: insight,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: { code: 'AI_ERROR', message: err.message } });
  }
});
