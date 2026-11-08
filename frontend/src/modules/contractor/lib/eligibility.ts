import { useEffect, useState } from 'react';
import { supabase } from '@/core/supabase/client';
import type { Tender } from './data';

export interface EligRow {
  label: string;
  required: string;
  ours: string;
  pass: boolean | null; // null = manual review
}

/**
 * The contractor profile actually on record for the signed-in user, loaded
 * from organization_members + organizations. There is no turnover /
 * completed-works figure stored on the organization record, so criteria
 * that depend on those can only ever be marked for manual review here —
 * this module is an INDICATIVE heuristic, never a server-side eligibility
 * determination (final eligibility is confirmed by the department).
 */
export interface ContractorEligibilityProfile {
  organizationName: string | null;
  registrationNumber: string | null;
  gstin: string | null;
  verified: boolean | null;
  role: string | null;
}

let cachedProfile: ContractorEligibilityProfile | null | undefined;
let profilePromise: Promise<ContractorEligibilityProfile | null> | null = null;

export function loadContractorEligibilityProfile(): Promise<ContractorEligibilityProfile | null> {
  if (cachedProfile !== undefined) return Promise.resolve(cachedProfile);
  if (!profilePromise) {
    profilePromise = (async () => {
      try {
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) {
          cachedProfile = null;
          return null;
        }
        const { data, error } = await supabase
          .from('organization_members')
          .select('role, organizations(name, registration_number, gstin, verified)')
          .eq('user_id', userId)
          .ilike('status', 'active')
          .maybeSingle();
        if (error || !data) {
          cachedProfile = null;
          return null;
        }
        const row = data as unknown as {
          role?: string | null;
          organizations?: {
            name?: string | null;
            registration_number?: string | null;
            gstin?: string | null;
            verified?: boolean | null;
          } | null;
        };
        cachedProfile = {
          organizationName: row.organizations?.name ?? null,
          registrationNumber: row.organizations?.registration_number ?? null,
          gstin: row.organizations?.gstin ?? null,
          verified: row.organizations?.verified ?? null,
          role: row.role ?? null,
        };
        return cachedProfile;
      } catch {
        cachedProfile = null;
        return null;
      }
    })();
  }
  return profilePromise;
}

/** React hook: resolves the real contractor profile once per session. */
export function useContractorProfile(): ContractorEligibilityProfile | null {
  const [profile, setProfile] = useState<ContractorEligibilityProfile | null>(
    () => (cachedProfile !== undefined ? cachedProfile : null),
  );
  useEffect(() => {
    let active = true;
    void loadContractorEligibilityProfile().then((loaded) => {
      if (active) setProfile(loaded);
    });
    return () => {
      active = false;
    };
  }, []);
  return profile;
}

interface ParsedCriteria {
  parts: string[];
  turnoverCr: number | null;
  raw: string;
}

function parseCriteria(t: Tender): ParsedCriteria {
  const raw = t.eligibility?.required?.trim() || '';
  if (!raw) return { parts: [], turnoverCr: null, raw };

  // eligibility_criteria may be stored as JSON — read machine-checkable
  // thresholds from it when present instead of guessing from prose.
  if (raw.startsWith('{')) {
    try {
      const json = JSON.parse(raw) as Record<string, unknown>;
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
      const turnoverCr = num(json.min_turnover_cr) ?? num(json.minimum_turnover_cr) ?? num(json.turnover_cr) ?? num(json.min_turnover);
      const parts = [json.class, json.registration, json.similar_works, json.experience]
        .filter((v): v is string => typeof v === 'string' && Boolean(v.trim()))
        .map((v) => v.trim());
      return { parts, turnoverCr, raw };
    } catch {
      /* fall through to prose parsing */
    }
  }

  const parts = raw.split(/[;\n]/).map((part) => part.trim()).filter(Boolean);
  const turnoverMatch = raw.match(/turnover[^₹\d]*₹?\s*([\d.]+)\s*cr/i);
  return { parts, turnoverCr: turnoverMatch ? Number(turnoverMatch[1]) : null, raw };
}

export function eligibilityRows(t: Tender, profile?: ContractorEligibilityProfile | null): EligRow[] {
  const criteria = parseCriteria(t);
  const eligibilityRequirement = criteria.raw || 'Eligibility requirements are not specified in the published tender.';
  const profileLoaded = profile !== undefined && profile !== null;

  const oursRegistration = profileLoaded
    ? [profile.organizationName || 'Contractor organization', profile.registrationNumber ? `Reg. ${profile.registrationNumber}` : null]
        .filter(Boolean)
        .join(' • ')
    : 'Contractor profile not loaded yet';

  const rows: EligRow[] = [
    {
      label: 'Contractor class / registration',
      required: criteria.parts[0] || eligibilityRequirement,
      ours: oursRegistration,
      // Only the organization's own verification state is on record; whether
      // its class matches this tender's clause is a department decision.
      pass: profileLoaded ? (profile.verified ? true : null) : null,
    },
    {
      label: 'Average annual turnover (last 3 FY)',
      required: criteria.turnoverCr != null ? `≥ ₹${criteria.turnoverCr} Cr (per tender criteria)` : 'As specified in the tender criteria',
      ours: 'Turnover is not recorded on the organization profile — check against audited statements',
      pass: null,
    },
    {
      label: 'Similar completed works',
      required: criteria.parts.slice(1).join('; ') || 'Per tender clause',
      ours: 'Completed works are not recorded on the organization profile — manual review',
      pass: null,
    },
    {
      label: 'Financial bid capacity',
      required: `≥ tender value ₹${t.value} Cr`,
      ours: 'Bid capacity is not assessed on the organization profile — manual review',
      pass: null,
    },
    {
      label: 'Statutory compliance',
      required: 'EPF, ESIC, GST, PAN active; no blacklisting',
      ours: profileLoaded && profile.gstin
        ? `GSTIN ${profile.gstin} on the organization profile; EPF/ESIC status is not recorded there`
        : 'GSTIN is not recorded on the organization profile',
      pass: null,
    },
  ];
  return rows;
}

export type IndicativeEligibilityStatus = 'Eligible' | 'Review' | 'Not Eligible';

/**
 * Indicative eligibility only: derived from the tender's own published
 * criteria plus whatever is actually on the contractor's organization
 * record. Because the record carries no turnover/experience figures, most
 * tenders resolve to 'Review' (manual review) rather than a fabricated
 * pass/fail. UI labels must present this as "Indicative".
 */
export function eligibilityStatus(t: Tender, profile?: ContractorEligibilityProfile | null): IndicativeEligibilityStatus {
  const rows = eligibilityRows(t, profile);
  if (rows.some((r) => r.pass === false)) return 'Not Eligible';
  if (rows.some((r) => r.pass === null)) return 'Review';
  return 'Eligible';
}
