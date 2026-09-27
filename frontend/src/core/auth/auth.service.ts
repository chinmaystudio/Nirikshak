import { supabase } from '@/core/supabase/client';
import type { User, Session } from '@supabase/supabase-js';
import type { AppRole, AppSession, Profile, Organization, OrganizationMember } from './auth.types';

export class AuthService {
  /**
   * Resolves authoritative user profile, organization, and role from Supabase DB.
   */
  static async resolveUserSession(user: User): Promise<AppSession> {
    try {
      // 1. Fetch Profile
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (profileError) throw profileError;
      const profile: Profile = profileData || {
        id: user.id,
        full_name: (user.user_metadata?.full_name || user.email?.split('@')[0]) ?? 'User',
        phone: user.phone || user.user_metadata?.phone || null,
        avatar_url: null,
        city: user.user_metadata?.city || null,
        state: user.user_metadata?.state || null,
      };

      // 2. Fetch Active Organization Membership (prefer deterministic primary active membership)
      const { data: memberRows, error: memberError } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('user_id', user.id)
        .ilike('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1);

      if (memberError) {
        console.warn('Membership lookup error:', memberError);
      }

      const memberData = memberRows && memberRows.length > 0 ? memberRows[0] : null;

      let role: AppRole = 'citizen';
      let organization: Organization | null = null;
      let pendingApproval: { type: 'government' | 'contractor'; status: 'PENDING' | 'REJECTED' | 'APPROVED'; message?: string } | null = null;

      if (memberData) {
        role = memberData.role as AppRole;
        if (memberData.organizations) {
          organization = memberData.organizations as Organization;
        }
      } else {
        // Requirement 16: Check for pending Government or Contractor access requests
        const { data: govReq } = await supabase
          .from('government_access_requests')
          .select('id, status, department, designation')
          .eq('user_id', user.id)
          .maybeSingle();

        if (govReq) {
          if (govReq.status === 'PENDING') {
            pendingApproval = {
              type: 'government',
              status: 'PENDING',
              message: 'Government access request pending administrator approval.',
            };
          } else if (govReq.status === 'REJECTED') {
            pendingApproval = {
              type: 'government',
              status: 'REJECTED',
              message: 'Your government access request was not approved by the department administrator.',
            };
          }
        } else {
          const { data: contReq } = await supabase
            .from('contractor_access_requests')
            .select('id, status, company_name')
            .eq('user_id', user.id)
            .maybeSingle();

          if (contReq) {
            if (contReq.status === 'PENDING') {
              pendingApproval = {
                type: 'contractor',
                status: 'PENDING',
                message: 'Contractor organization verification is pending administrator approval.',
              };
            } else if (contReq.status === 'REJECTED') {
              pendingApproval = {
                type: 'contractor',
                status: 'REJECTED',
                message: 'Your contractor organization onboarding was not approved.',
              };
            }
          }
        }
      }

      // 3. Compute permissions
      const permissions: string[] = [];
      if (role.startsWith('government') || role === 'chief_engineer' || role === 'project_officer' || role === 'auditor') {
        permissions.push('government:access', 'projects:read', 'tenders:read');
        if (role === 'government_admin' || role === 'chief_engineer') {
          permissions.push('projects:write', 'tenders:write', 'contracts:award', 'progress:verify');
        }
      } else if (role.startsWith('contractor')) {
        permissions.push('contractor:access', 'tenders:read', 'bids:submit', 'progress:submit');
      } else {
        permissions.push('citizen:access', 'complaints:submit', 'projects:public_read');
      }

      return {
        user,
        profile,
        organization,
        role,
        permissions,
        pendingApproval,
      };
    } catch (err) {
      console.error('Failed to resolve user session, falling back:', err);
      throw err;
    }
  }

  static async getSession(): Promise<Session | null> {
    const { data } = await supabase.auth.getSession();
    return data.session;
  }

  static async getCurrentUser(): Promise<User | null> {
    const { data } = await supabase.auth.getUser();
    return data.user;
  }

  static async signIn(email: string, password: string): Promise<AppSession> {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      throw new Error(error?.message || 'Authentication failed');
    }

    return await this.resolveUserSession(data.user);
  }

  /**
   * Sanitizes redirect path to ensure it is internal only (Rule 49).
   * Rejects external URLs, protocol-relative URLs (//), backslash bypasses (/\ or \), and script schemes.
   */
  static sanitizeRedirectPath(path?: string): string {
    if (!path || typeof path !== 'string') return '/';
    const trimmed = path.trim().replace(/\0/g, '');
    if (
      trimmed.startsWith('http://') ||
      trimmed.startsWith('https://') ||
      trimmed.startsWith('//') ||
      trimmed.startsWith('/\\') ||
      trimmed.includes('\\') ||
      trimmed.startsWith('javascript:') ||
      trimmed.startsWith('data:')
    ) {
      return '/';
    }
    return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  }

  static async signInWithGoogle(redirectTo?: string): Promise<void> {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const safePath = this.sanitizeRedirectPath(
      redirectTo || (typeof window !== 'undefined' ? window.location.pathname : '/')
    );
    const redirectUrl = `${origin}${safePath}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }
  }

  /**
   * Generic public signup. Never accepts or sets privileged roles (Rule 5).
   * Government & Contractor onboarding MUST use dedicated approval workflows.
   */
  static async signUp(payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    metadata?: Record<string, any>;
  }): Promise<{ user: User | null; session: Session | null }> {
    const { email, password, fullName, phone, metadata = {} } = payload;

    // Sanitize metadata: remove any attempt to inject privileged roles or organization IDs
    const safeMetadata = { ...metadata };
    delete (safeMetadata as any).role;
    delete (safeMetadata as any).organization_id;
    delete (safeMetadata as any).is_admin;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role: 'citizen', // Enforced citizen only for public signups
          ...safeMetadata,
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (data.user) {
      // Upsert profile in DB
      const { error: profileError } = await supabase.from('profiles').upsert({
        id: data.user.id,
        full_name: fullName,
        phone: phone || null,
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw new Error(`Account created, but profile setup failed: ${profileError.message}`);
    }

    return data;
  }

  static async registerGovernment(payload: {
    fullName: string;
    officialEmail: string;
    employeeId: string;
    department: string;
    designation: string;
    state: string;
    district: string;
    password: string;
    requestedRole?: string;
  }): Promise<{ user: User | null; message: string }> {
    const { fullName, officialEmail, employeeId, department, designation, state, district, password, requestedRole = 'government_engineer' } = payload;
    
    const { data, error } = await supabase.auth.signUp({
      email: officialEmail,
      password,
      options: {
        data: {
          full_name: fullName,
          department,
          designation,
          employee_id: employeeId,
          state,
          district,
          requested_role: requestedRole,
        },
      },
    });
    if (error) throw new Error(error.message);
    return {
      user: data.user,
      message: 'Registration request submitted. Your Government access is pending administrator approval.',
    };
  }

  static async registerContractor(payload: {
    fullName: string;
    email: string;
    phone: string;
    companyName: string;
    registrationCin: string;
    gstin: string;
    contractorClass: string;
    state: string;
    district: string;
    password: string;
    requestedRole?: string;
  }): Promise<{ user: User | null; message: string }> {
    const { fullName, email, phone, companyName, registrationCin, gstin, contractorClass, state, district, password, requestedRole = 'contractor_admin' } = payload;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          company_name: companyName,
          registration_cin: registrationCin,
          gstin,
          contractor_class: contractorClass,
          state,
          district,
          requested_role: requestedRole,
        },
      },
    });
    if (error) throw new Error(error.message);
    return {
      user: data.user,
      message: 'Your contractor organization verification is pending.',
    };
  }

  static async signOut(): Promise<void> {
    await supabase.auth.signOut();
  }

  static onAuthStateChange(callback: (session: Session | null) => void) {
    return supabase.auth.onAuthStateChange((_event, session) => {
      callback(session);
    });
  }
}

