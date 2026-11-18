import { Router } from 'express';
import { z } from 'zod';
import { supabaseAdmin, supabasePublic } from '../services/supabase.js';
import { requireAuth, requireMfa, AuthenticatedRequest } from '../middleware/auth.js';
import { rateLimit, requireHuman } from '../middleware/security.js';

export const authRouter = Router();

/** Government password policy: 12+ characters with upper, lower, digit and symbol. */
const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .max(128)
  .regex(/[a-z]/, 'Password must contain a lowercase letter.')
  .regex(/[A-Z]/, 'Password must contain an uppercase letter.')
  .regex(/[0-9]/, 'Password must contain a digit.')
  .regex(/[^A-Za-z0-9]/, 'Password must contain a symbol.');

/** Allowed official email domains for government applicants (sub-domains included). */
export function governmentEmailDomains(): string[] {
  return (process.env.GOV_EMAIL_DOMAINS || 'gov.in,nic.in')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean);
}

export function isGovernmentEmail(email: string): boolean {
  const domain = email.trim().toLowerCase().split('@')[1] || '';
  return governmentEmailDomains().some((d) => domain === d || domain.endsWith(`.${d}`));
}

const RegisterSchema = z.discriminatedUnion('accountType', [
  z.object({
    accountType: z.literal('citizen'),
    email: z.string().trim().email().max(254),
    password: z.string().min(8, 'Password must be at least 8 characters.').max(128),
    fullName: z.string().trim().min(3).max(120),
    phone: z.string().trim().regex(/^\d{10}$/).optional(),
    city: z.string().trim().max(80).optional(),
    ward: z.string().trim().max(120).optional(),
    preferredLanguage: z.string().trim().max(10).optional(),
  }),
  z.object({
    accountType: z.literal('government'),
    email: z.string().trim().email().max(254),
    password: passwordSchema,
    fullName: z.string().trim().min(3).max(120),
    // DF-37: honour the role the applicant requested, when one is sent.
    requestedRole: z.enum(['government_admin', 'chief_engineer', 'project_officer', 'government_engineer', 'auditor']).optional(),
    employeeId: z.string().trim().min(2).max(80),
    department: z.string().trim().min(2).max(160),
    designation: z.string().trim().min(2).max(120),
    state: z.string().trim().min(2).max(80),
    district: z.string().trim().min(2).max(80),
  }),
  z.object({
    accountType: z.literal('contractor'),
    email: z.string().trim().email().max(254),
    password: passwordSchema,
    fullName: z.string().trim().min(3).max(120),
    // DF-37: honour the role the applicant requested, when one is sent.
    requestedRole: z.enum(['contractor_admin', 'contractor_manager', 'contractor_engineer', 'contractor_site_engineer']).optional(),
    phone: z.string().trim().regex(/^\d{10}$/),
    companyName: z.string().trim().min(2).max(180),
    registrationCin: z.string().trim().min(2).max(40),
    gstin: z.string().trim().min(2).max(30),
    contractorClass: z.string().trim().min(2).max(80),
    state: z.string().trim().min(2).max(80),
    district: z.string().trim().min(2).max(80),
  }),
]);

authRouter.post(
  '/register',
  rateLimit({ windowMs: 15 * 60 * 1000, max: 8, message: 'Too many registration attempts. Please wait 15 minutes and try again.' }),
  requireHuman(),
  async (req, res) => {
    const parsed = RegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'INVALID_REGISTRATION', message: parsed.error.issues[0]?.message || 'Please check your registration details.' },
      });
    }

    const input = parsed.data;
    if (input.accountType === 'government' && !isGovernmentEmail(input.email)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'OFFICIAL_EMAIL_REQUIRED',
          message: `Government accounts must use an official email address (${governmentEmailDomains().map((d) => '@' + d).join(', ')}).`,
        },
      });
    }
    const metadata: Record<string, string> = {
      full_name: input.fullName,
      account_type: input.accountType,
    };

    if (input.accountType === 'citizen') {
      Object.assign(metadata, {
        role: 'citizen',
        phone: input.phone || '',
        city: input.city || '',
        ward: input.ward || '',
        preferredLanguage: input.preferredLanguage || 'en',
      });
    } else if (input.accountType === 'government') {
      Object.assign(metadata, {
        // DF-37: use the requested role when the payload carries one
        requested_role: input.requestedRole || 'government_engineer',
        employee_id: input.employeeId,
        department: input.department,
        designation: input.designation,
        state: input.state,
        district: input.district,
      });
    } else {
      Object.assign(metadata, {
        // DF-37: use the requested role when the payload carries one
        requested_role: input.requestedRole || 'contractor_admin',
        phone: input.phone,
        company_name: input.companyName,
        registration_cin: input.registrationCin,
        gstin: input.gstin,
        contractor_class: input.contractorClass,
        state: input.state,
        district: input.district,
      });
    }

    // Standard sign-up: Supabase sends a confirmation email and the account
    // cannot sign in until the address is confirmed (enable "Confirm email"
    // in Supabase Auth settings). Officers can only approve confirmed accounts
    // (migration 044).
    const redirectBase = (process.env.FRONTEND_URL || '').replace(/\/$/, '');
    const redirectPath = input.accountType === 'government' ? '/government/login' : input.accountType === 'contractor' ? '/contractor/login' : '/user/login';
    const { data, error } = await supabasePublic.auth.signUp({
      email: input.email.toLowerCase(),
      password: input.password,
      options: {
        data: metadata,
        ...(redirectBase ? { emailRedirectTo: `${redirectBase}${redirectPath}` } : {}),
      },
    });

    // Supabase returns a user with no identities when the email is already registered.
    const duplicate =
      (!!data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) ||
      /already|registered|exists/i.test(error?.message || '');
    if (duplicate) {
      return res.status(409).json({
        success: false,
        error: { code: 'ACCOUNT_EXISTS', message: 'An account with this email already exists. Please sign in instead.' },
      });
    }
    if (error || !data.user) {
      console.error('Supabase account creation failed', { code: error?.code, status: error?.status, message: error?.message });
      const weak = /password/i.test(error?.message || '');
      return res.status(400).json({
        success: false,
        error: {
          code: weak ? 'WEAK_PASSWORD' : 'REGISTRATION_FAILED',
          message: weak ? error!.message : 'We could not create the account. Please check the details and try again.',
        },
      });
    }

    return res.status(201).json({
      success: true,
      data: {
        userId: data.user.id,
        accountType: input.accountType,
        requiresApproval: input.accountType !== 'citizen',
        requiresEmailVerification: !data.session,
      },
    });
  }
);


// POST /api/auth/mfa/reset - an organization administrator removes a
// colleague's authenticator (lost phone). The colleague enrols a new one at
// their next sign-in. The administrator must themselves be MFA-verified,
// cannot reset their own factor, and the reset is written to the audit log.
authRouter.post(
  '/mfa/reset',
  rateLimit({ windowMs: 60 * 60 * 1000, max: 20 }),
  requireAuth,
  requireMfa,
  async (req: AuthenticatedRequest, res) => {
    const target = typeof req.body?.user_id === 'string' ? req.body.user_id : '';
    if (!/^[0-9a-f-]{36}$/i.test(target)) {
      return res.status(400).json({ success: false, error: { code: 'INVALID_USER', message: 'user_id is required.' } });
    }
    if (!['government_admin', 'contractor_admin'].includes(req.role || '') || !req.organizationId) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Only an organization administrator can reset two-step verification.' } });
    }
    if (target === req.user!.id) {
      return res.status(403).json({ success: false, error: { code: 'FORBIDDEN', message: 'Ask another administrator to reset your own two-step verification.' } });
    }
    const { data: member } = await supabaseAdmin
      .from('organization_members')
      .select('id')
      .eq('user_id', target)
      .eq('organization_id', req.organizationId)
      .maybeSingle();
    if (!member) {
      return res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'That user is not a member of your organization.' } });
    }
    const { data: factors, error: listError } = await supabaseAdmin.auth.admin.mfa.listFactors({ userId: target });
    if (listError) {
      console.error('MFA factor listing failed', { message: listError.message });
      return res.status(500).json({ success: false, error: { code: 'MFA_RESET_FAILED', message: 'Two-step verification could not be reset.' } });
    }
    let removed = 0;
    for (const f of factors?.factors ?? []) {
      const { error } = await supabaseAdmin.auth.admin.mfa.deleteFactor({ id: f.id, userId: target });
      if (!error) removed++;
    }
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: req.user!.id,
      actor_organization_id: req.organizationId,
      action: 'MFA_RESET',
      entity_type: 'auth.users',
      entity_id: target,
      new_value: { factors_removed: removed },
    });
    return res.json({ success: true, data: { factors_removed: removed } });
  }
);
