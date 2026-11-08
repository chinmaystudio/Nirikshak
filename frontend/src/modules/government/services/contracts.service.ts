/**
 * Contracts service (government) — direct Supabase reads on the contracts
 * table plus award delegation. Adapted for the target's direct-JWT model
 * (tender port §4.4): no BFF/apiClient, and the REAL column names are used
 * (contract_value, scheduled_start_date) — amounts are ₹ Cr end to end.
 */
import { supabase } from '@/core/supabase/client';
import { tendersApi } from '../api/supabaseApi';

export interface ProjectContract {
  id: string;
  projectId: string;
  /** Display project id (projects.nirikshak_project_id) when joined, else the UUID. */
  projectCode?: string;
  tenderId?: string;
  selectedBidId?: string;
  contractNumber: string;
  officialContractId?: string;
  contractTitle: string;
  /** contracts.contract_value — ₹ Cr. */
  contractValueCr: number;
  contractorOrganizationId: string;
  contractorName?: string;
  status: string;
  awardDate?: string;
  /** contracts.scheduled_start_date. */
  scheduledStartDate?: string;
  scheduledCompletionDate?: string;
  actualCompletionDate?: string;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function mapContract(row: any): ProjectContract {
  return {
    id: row.id,
    projectId: row.project_id,
    projectCode: row.projects?.nirikshak_project_id || undefined,
    tenderId: row.tender_id || undefined,
    // contracts.selected_bid_id arrives with migration 030; absent until then.
    selectedBidId: row.selected_bid_id || undefined,
    contractNumber: row.contract_number || '',
    officialContractId: row.official_contract_id || undefined,
    contractTitle: row.contract_title || '',
    contractValueCr: row.contract_value == null ? 0 : Number(row.contract_value),
    contractorOrganizationId: row.contractor_organization_id,
    contractorName: row.organizations?.name || undefined,
    status: row.status || '',
    awardDate: row.award_date || undefined,
    scheduledStartDate: row.scheduled_start_date || undefined,
    scheduledCompletionDate: row.scheduled_completion_date || undefined,
    actualCompletionDate: row.actual_completion_date || undefined,
  };
}

/** Resolve a display project id (NIR-…) to the projects UUID when needed. */
async function resolveProjectUuid(projectId: string): Promise<string> {
  if (UUID_PATTERN.test(projectId)) return projectId;
  const { data, error } = await supabase
    .from('projects')
    .select('id')
    .eq('nirikshak_project_id', projectId)
    .maybeSingle();
  if (error) throw new Error(`Failed to resolve project: ${error.message}`);
  if (!data) throw new Error(`Project ${projectId} could not be found.`);
  return data.id;
}

export const contractsService = {
  async getProjectContracts(projectId: string): Promise<ProjectContract[]> {
    const projectUuid = await resolveProjectUuid(projectId);
    const { data, error } = await supabase
      .from('contracts')
      .select('*, organizations(name), projects(nirikshak_project_id)')
      .eq('project_id', projectUuid)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load contracts: ${error.message}`);
    return (data || []).map(mapContract);
  },

  async getContractById(id: string): Promise<ProjectContract | undefined> {
    const { data, error } = await supabase
      .from('contracts')
      .select('*, organizations(name), projects(nirikshak_project_id)')
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load contract: ${error.message}`);
    return data ? mapContract(data) : undefined;
  },

  /** Award delegates to tendersApi.award (award_contract RPC). */
  async award(tenderId: string, bidId: string): Promise<any> {
    return tendersApi.award(tenderId, bidId);
  },
};

export const getProjectContracts = contractsService.getProjectContracts;
export const getContractById = contractsService.getContractById;
export default contractsService;
