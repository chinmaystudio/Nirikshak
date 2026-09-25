import { LifecycleStageInfo } from '../types';

export const LIFECYCLE_STAGES: LifecycleStageInfo[] = [
  {
    step: '01',
    name: 'TENDER',
    title: 'Tender & Notice Inviting Bid',
    objective: 'Standardized BOQ creation, objective qualification rules, clear milestone definitions.',
    governmentAction: 'Draft criteria, publish NIT, evaluate vendor technical capabilities with historical data.',
    contractorAction: 'Submit technical and financial bids with digital credentials & capacity declarations.',
    aiVerification: 'Unbalanced bid anomaly detection, collusion pattern scanning, contractor capability check.',
    outputs: ['E-Tender Notice', 'BOQ Baseline', 'Prequalification Matrix']
  },
  {
    step: '02',
    name: 'SELECT',
    title: 'Contractor Selection & Award',
    objective: 'Transparent evaluation based on verified competence, realistic pricing, and past track records.',
    governmentAction: 'Issue Letter of Acceptance (LoA) with strict timeline adherence stipulations.',
    contractorAction: 'Furnish Performance Security Guarantee and mobilization commitments.',
    aiVerification: 'Past delay index analysis, active site workload vs plant-machinery capacity check.',
    outputs: ['Letter of Award', 'Performance Security', 'Risk Profile']
  },
  {
    step: '03',
    name: 'CONTRACT',
    title: 'Contract Signing & Milestones',
    objective: 'Digitized contract clauses, milestone deadlines, and clear responsibility matrix.',
    governmentAction: 'Lock digital agreement, map GIS boundaries, approve Baseline Program (Schedule).',
    contractorAction: 'Sign tripartite agreements, submit CPM/PERT baseline schedule and safety protocols.',
    aiVerification: 'Clause ambiguity detection, unviable milestone schedule warnings, delay liability tags.',
    outputs: ['Digitized Agreement', 'Approved Work Program', 'Escrow Account']
  },
  {
    step: '04',
    name: 'EXECUTE',
    title: 'Site Execution & Mobilization',
    objective: 'Right of Way (RoW) clearance, utility shifting, machinery mobilization and site handover.',
    governmentAction: 'Handover encumbrance-free land stretches, conduct monthly coordination reviews.',
    contractorAction: 'Deploy equipment, batching plants, workforce, and begin physical earthwork/structures.',
    aiVerification: 'GPS-tagged equipment tracking, utility handover bottleneck forecasts.',
    outputs: ['Site Handover Certificate', 'Mobilization Report', 'Safety Approvals']
  },
  {
    step: '05',
    name: 'MONITOR',
    title: 'Multi-Source Digital Monitoring',
    objective: 'Continuous ground truth tracking through GIS, geo-tagged imagery, drone surveys & IoT.',
    governmentAction: 'Inspect field reports, cross-examine physical measurements against planned schedule.',
    contractorAction: 'Upload daily progress reports (DPR), material consumption logs, and drone footage.',
    aiVerification: 'Photogrammetric progress alignment, computer vision concrete pour verification.',
    outputs: ['Daily Progress Reports', '3D Drone Orthomosaic', 'Material Inward Logs']
  },
  {
    step: '06',
    name: 'VERIFY',
    title: 'AI Progress Verification',
    objective: 'Independent algorithmic cross-check of reported completion against physical telemetry.',
    governmentAction: 'Review AI discrepancy flags before granting measurement book (MB) signoffs.',
    contractorAction: 'Provide test certificates, cube strength lab reports, and surveyor punch-lists.',
    aiVerification: 'Discrepancy scoring between claimed completion % and satellite/drone ground truth.',
    outputs: ['Verification Certificate', 'Discrepancy Log', 'Certified Measurement Book']
  },
  {
    step: '07',
    name: 'PAY',
    title: 'Milestone-Linked Payment',
    objective: 'Direct bank release strictly upon verified deliverables, minimizing capital lockups and leakage.',
    governmentAction: 'Approve Running Account (RA) bills, process statutory withholdings and deductions.',
    contractorAction: 'Generate e-invoices mapped 1:1 against certified milestone checkpoints.',
    aiVerification: 'Overpayment prevention check, duplicate measurement detection, variation cost audit.',
    outputs: ['E-Payment Release', 'Statutory Deductions', 'Milestone Certificate']
  },
  {
    step: '08',
    name: 'PREDICT',
    title: 'Early Warning & Delay Prediction',
    objective: 'Forecast schedule slip and cost escalation 60-90 days before critical path disruption.',
    governmentAction: 'Convene proactive contractor intervention meetings, issue corrective notices.',
    contractorAction: 'Submit revised catch-up plans and mobilize additional critical equipment shifts.',
    aiVerification: 'S-curve variance projections, weather impact simulations, resource deficit alerts.',
    outputs: ['Delay Early Warning Notice', 'Catch-Up Program', 'Bottleneck Root-Cause']
  },
  {
    step: '09',
    name: 'RESOLVE',
    title: 'Evidence-Based Dispute Resolution',
    objective: 'Structured, speedy claim settlements using time-stamped project logs rather than prolonged litigation.',
    governmentAction: 'Assess Extension of Time (EoT) requests with clear cause-and-effect audit trail.',
    contractorAction: 'Lodge claims with direct cross-references to RoW delays, weather data, or drawings.',
    aiVerification: 'Delay responsibility attribution (% client delay vs % contractor delay based on logs).',
    outputs: ['Claim Assessment Ruling', 'EoT Sanction', 'Dispute Resolution Record']
  },
  {
    step: '10',
    name: 'LEARN',
    title: 'Institutional Knowledge & Memory',
    objective: 'Feed actual performance data back into contractor profiles and future tender specifications.',
    governmentAction: 'Update contractor performance ratings, adjust standardized BOQ rates and schedule norms.',
    contractorAction: 'Receive performance score card, bid eligibility weightages, and project completion certificate.',
    aiVerification: 'Continuous model retraining on actual vs estimated durations, costs, and contractor behavior.',
    outputs: ['Contractor Scorecard Update', 'Post-Completion Review', 'Tender Norm Adjustments']
  }
];

export const AI_ENGINES = [
  {
    id: 'E1',
    title: 'Contractor Intelligence',
    subtitle: 'Pre-Award & Active Risk',
    desc: 'Analyzes longitudinal contractor bid behavior, plant-machinery capacity, cash-flow liquidity, and past litigation indices to prevent adverse selection.',
    metric: 'Multi-Source Anomaly Detection'
  },
  {
    id: 'E2',
    title: 'AI Progress Verification',
    subtitle: 'Drone & Satellite Ground Truth',
    desc: 'Computes volume calculations from UAV photogrammetry and scans time-stamped site photos against BIM models to confirm physical work completion before bill certification.',
    metric: 'Survey-Grade Photogrammetry'
  },
  {
    id: 'E3',
    title: 'Delay Prediction & Early Warning',
    subtitle: '60-Day Critical Path Forecast',
    desc: 'Runs multi-factor simulation models correlating weather seasonality, material delivery bottlenecks, and labour attendance to flag delays before they trigger.',
    metric: 'Multi-Factor Bayesian Modeling'
  },
  {
    id: 'E4',
    title: 'Delay Responsibility Analysis',
    subtitle: 'Objective Fault Attribution',
    desc: 'Correlates government approval timestamps, land handover milestones, and contractor mobilization logs to attribute delay responsibility impartially.',
    metric: 'Statutory Audit Trail'
  },
  {
    id: 'E5',
    title: 'Claim & Dispute Assessment',
    subtitle: 'Contract Evidence Matching',
    desc: 'Evaluates contractor Extension of Time (EoT) and cost escalation claims directly against digitized contract clauses, FIDIC norms, and historical site data.',
    metric: 'Structured Clause Alignment'
  },
  {
    id: 'E6',
    title: 'Predictive Financial Risk',
    subtitle: 'Cost Overrun Forecasting',
    desc: 'Scans variation order trends, steel-cement index volatility, and milestone payment schedules to forecast final project cost deviations early.',
    metric: 'Commodity Index Reconciliation'
  }
];
