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

      // 2. Fetch Active Organization Membership
      const { data: memberData, error: memberError } = await supabase
        .from('organization_members')
        .select('*, organizations(*)')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();
      if (memberError) throw memberError;

      let role: AppRole = 'citizen';
      let organization: Organization | null = null;

      if (memberData) {
        role = memberData.role as AppRole;
        if (memberData.organizations) {
          organization = memberData.organizations as Organization;
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

  static async signUp(payload: {
    email: string;
    password: string;
    fullName: string;
    phone?: string;
    role?: AppRole;
    metadata?: Record<string, any>;
  }): Promise<{ user: User | null; session: Session | null }> {
    const { email, password, fullName, phone, role = 'citizen', metadata = {} } = payload;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone,
          role,
          ...metadata,
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
  }): Promise<{ user: User | null; message: string }> {
    const { fullName, officialEmail, employeeId, department, designation, state, district, password } = payload;
    
    // 1. Sign up Supabase Auth user
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
          requested_role: 'government_engineer',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Registration failed to create user.');
    }

    return {
      user: data.user,
      message: 'Registration request submitted successfully. Account status is PENDING verification by a Government Administrator.',
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
  }): Promise<{ user: User | null; message: string }> {
    const { fullName, email, phone, companyName, registrationCin, gstin, contractorClass, state, district, password } = payload;

    // 1. Sign up Supabase Auth user
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
          requested_role: 'contractor_admin',
        },
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.user) {
      throw new Error('Registration failed to create user.');
    }

    return {
      user: data.user,
      message: 'Contractor onboarding application submitted successfully. Verification status is PENDING review.',
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

