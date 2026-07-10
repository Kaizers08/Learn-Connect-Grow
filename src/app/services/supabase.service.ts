import { Injectable, inject } from '@angular/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SupabaseConfigService } from './supabase-config.service';

export type UserRole = 'mentee' | 'mentor' | 'admin';

export interface MenteeProfile {
  id?: string;
  user_id?: string;
  full_name?: string;
  type: string;
  university?: string;
  job_position?: string;
  company?: string;
  looking_for_job?: string;
  desired_expertise?: string;
  desired_skills?: string[];
  profile_picture?: string;
  phone_number?: string;
  country?: string;
  gender?: string;
  date_of_birth?: string;
  created_at?: string;
}

export interface MentorProfile {
  id?: string;
  user_id?: string;
  full_name?: string;
  job_position?: string;
  company?: string;
  expertise?: string;
  years_experience?: number;
  bio?: string;
  skills?: string[];
  profile_picture?: string;
  phone_number?: string;
  country?: string;
  gender?: string;
  date_of_birth?: string;
  github_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  looking_for_mentee?: boolean;
  status?: string;
  diploma?: string;
  certifications?: string[];
  created_at?: string;
}

@Injectable({
  providedIn: 'root'
})
export class SupabaseService {
  private readonly config = inject(SupabaseConfigService);
  private readonly client: SupabaseClient;
  private supabaseUrl: string;

  constructor() {
    const { url, anonKey } = this.config.getSupabaseConfig();
    this.client = createClient(url, anonKey);
    this.supabaseUrl = url;
  }

  getClient(): SupabaseClient {
    return this.client;
  }

  /**
   * Logs a failed Supabase / PostgREST request with the HTTP status and the
   * response body so call failures are debuggable. The supabase-js client
   * already sends the required `apikey` and `Authorization: Bearer` headers
   * on every request (derived from createClient(url, anonKey)).
   */
  private logError(operation: string, error: any): void {
    if (!error) return;
    const status = error?.status ?? error?.statusCode ?? 'unknown';
    console.error(`[Supabase:${operation}] request failed`, {
      status,
      code: error?.code,
      message: error?.message,
      details: error?.details,
      hint: error?.hint,
      body: error?.body ?? error
    });
  }

  // ── Storage ───────────────────────────────────────────────────────────────
  /**
   * Uploads a profile picture to Supabase Storage and returns the public URL.
   * The bucket must exist — create it in Supabase Dashboard:
   *   Storage → New bucket → name: "profiles" → Public: ON
   */
  async uploadProfilePicture(userId: string, file: File): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${userId}/profile.${ext}`;

    const { error } = await this.client.storage
      .from('profiles')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      this.logError('uploadProfilePicture', error);
      return null;
    }

    const { data } = this.client.storage
      .from('profiles')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  async uploadDocument(userId: string, file: File, folder: string): Promise<string | null> {
    const ext = file.name.split('.').pop() ?? 'pdf';
    const path = `${userId}/${folder}/${Date.now()}.${ext}`;

    const { error } = await this.client.storage
      .from('profiles')
      .upload(path, file, { upsert: true, contentType: file.type });

    if (error) {
      this.logError('uploadDocument', error);
      return null;
    }

    const { data } = this.client.storage
      .from('profiles')
      .getPublicUrl(path);

    return data.publicUrl;
  }

  // ── Auth ───────────────────────────────────────────────────────────────────
  signUp(email: string, password: string, fullName: string) {
    return this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });
  }

  signIn(email: string, password: string) {
    return this.client.auth.signInWithPassword({ email, password });
  }

  signOut() {
    return this.client.auth.signOut();
  }

  async getCurrentUserId(): Promise<string | undefined> {
    const { data, error } = await this.client.auth.getUser();
    if (error) this.logError('getCurrentUserId', error);
    return data.user?.id;
  }

  async getCurrentUserMeta(): Promise<{ id?: string; fullName?: string; role?: string }> {
    const { data, error } = await this.client.auth.getUser();
    if (error) this.logError('getCurrentUserMeta', error);
    const u = data.user;
    const meta = (u?.user_metadata ?? {}) as Record<string, any>;
    return {
      id: u?.id,
      fullName: meta['full_name'],
      role: meta['role']
    };
  }

  updateUserMeta(data: { full_name?: string; role?: string }) {
    return this.client.auth.updateUser({ data });
  }

  // ── Mentee ────────────────────────────────────────────────────────────────
  // Saves mentee profile — only called when user clicks Next after validation passes
  async saveMenteeProfile(profile: MenteeProfile) {
    const userId = profile.user_id;
    if (!userId) return { data: null, error: { message: 'No user ID.' } };

    const { data: existing } = await this.client
      .from('mentee_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let result;
    if (existing) {
      result = await this.client
        .from('mentee_profiles')
        .update(profile)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      result = await this.client
        .from('mentee_profiles')
        .insert(profile)
        .select()
        .single();
    }

    if (result.error) this.logError('saveMenteeProfile', result.error);
    return { data: result.data, error: result.error };
  }

  async getMenteeProfiles() {
    const { data, error } = await this.client.from('mentee_profiles').select('*');
    if (error) this.logError('getMenteeProfiles', error);
    return { data, error };
  }

  // ── Mentor ────────────────────────────────────────────────────────────────
  // Saves mentor profile — only called when user clicks Next after validation passes
  async saveMentorProfile(profile: MentorProfile) {
    const userId = profile.user_id;
    if (!userId) return { data: null, error: { message: 'No user ID.' } };

    // Check if row already exists
    const { data: existing } = await this.client
      .from('mentor_profiles')
      .select('id')
      .eq('user_id', userId)
      .maybeSingle();

    let result;
    if (existing) {
      result = await this.client
        .from('mentor_profiles')
        .update(profile)
        .eq('user_id', userId)
        .select()
        .single();
    } else {
      result = await this.client
        .from('mentor_profiles')
        .insert(profile)
        .select()
        .single();
    }

    if (result.error) this.logError('saveMentorProfile', result.error);
    return { data: result.data, error: result.error };
  }

  // Mentor uploads diploma + certifications for admin approval.
  async submitMentorDocuments(diploma: string | undefined, certifications: string[] | undefined) {
    const userId = await this.getCurrentUserId();
    const { data, error } = await this.client
      .from('mentor_profiles')
      .update({ diploma, certifications, status: 'pending' })
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) this.logError('submitMentorDocuments', error);
    return { data, error };
  }

  // Admin approves / rejects a mentor. (Dev policy allows anon updates.)
  async updateMentorStatus(userId: string, status: 'approved' | 'rejected') {
    const { data, error } = await this.client
      .from('mentor_profiles')
      .update({ status })
      .eq('user_id', userId)
      .select()
      .maybeSingle();
    if (error) this.logError('updateMentorStatus', error);
    return { data, error };
  }

  async getMentorProfiles() {
    const { data, error } = await this.client.from('mentor_profiles').select('*');
    if (error) this.logError('getMentorProfiles', error);
    return { data, error };
  }

  // ── Matchmaking ─────────────────────────────────────────────────────────────
  // Mentee browses mentors whose expertise / skills match what the mentee wants.
  // Match if: expertise matches OR any skill overlaps (at least 1 skill in common)
  async findMentorsForMentee(desiredExpertise?: string, desiredSkills: string[] = []) {
    const { data, error } = await this.client.from('mentor_profiles').select('*');
    
    if (error) {
      this.logError('findMentorsForMentee', error);
      return { data: [], error };
    }

    // Filter client-side for skill overlap
    const filtered = (data || []).filter((mentor: any) => {
      // Match if expertise matches
      if (desiredExpertise && mentor.expertise === desiredExpertise) return true;
      
      // Match if any skill overlaps
      if (desiredSkills.length && mentor.skills?.length) {
        return desiredSkills.some(skill => mentor.skills.includes(skill));
      }
      
      return false;
    });

    return { data: filtered, error };
  }

  // Mentor browses mentees whose desired expertise / skills match the mentor's.
  // Match if: desired expertise matches OR any skill overlaps (at least 1 skill in common)
  async findMenteesForMentor(expertise?: string, skills: string[] = []) {
    const { data, error } = await this.client.from('mentee_profiles').select('*');
    
    if (error) {
      this.logError('findMenteesForMentor', error);
      return { data: [], error };
    }

    // Filter client-side for skill overlap
    const filtered = (data || []).filter((mentee: any) => {
      // Match if desired expertise matches
      if (expertise && mentee.desired_expertise === expertise) return true;
      
      // Match if any skill overlaps
      if (skills.length && mentee.desired_skills?.length) {
        return skills.some(skill => mentee.desired_skills.includes(skill));
      }
      
      return false;
    });

    return { data: filtered, error };
  }

  // ── Messages ────────────────────────────────────────────────────────────────
  async sendMessage(receiverId: string, message: string) {
    const { data, error } = await this.client
      .from('messages')
      .insert({
        sender_id: await this.getCurrentUserId(),
        receiver_id: receiverId,
        message: message.trim()
      })
      .select()
      .single();
    
    if (error) this.logError('sendMessage', error);
    return { data, error };
  }

  async getMessages(userId1: string, userId2: string) {
    const { data, error } = await this.client
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
      .order('created_at', { ascending: true });
    
    if (error) this.logError('getMessages', error);
    return { data: data || [], error };
  }

  async getLastMessage(userId1: string, userId2: string) {
    const { data, error } = await this.client
      .from('messages')
      .select('message, created_at')
      .or(`and(sender_id.eq.${userId1},receiver_id.eq.${userId2}),and(sender_id.eq.${userId2},receiver_id.eq.${userId1})`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    if (error) this.logError('getLastMessage', error);
    return { data, error };
  }

  // ── Admin ─────────────────────────────────────────────────────────────────
  async getPlatformStats() {
    const [mentees, mentors] = await Promise.all([
      this.getMenteeProfiles(),
      this.getMentorProfiles()
    ]);

    return {
      mentees: mentees.data ?? [],
      mentors: mentors.data ?? [],
      menteeCount: mentees.data?.length ?? 0,
      mentorCount: mentors.data?.length ?? 0,
      error: mentees.error ?? mentors.error ?? null
    };
  }

  async createAdminAccount(email: string, password: string, fullName: string) {
    const authResult = await this.client.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } }
    });

    if (authResult.error) {
      this.logError('createAdminAccount:signUp', authResult.error);
      return { error: authResult.error };
    }

    if (!authResult.data.user) {
      return { error: { message: 'Failed to create auth user.' } };
    }

    const adminResult = await this.client
      .from('admins')
      .insert({
        user_id: authResult.data.user.id,
        email
      })
      .select()
      .single();

    if (adminResult.error) this.logError('createAdminAccount:insert', adminResult.error);
    return {
      data: adminResult.data,
      error: adminResult.error
    };
  }

  async getAdminProfile() {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      return { data: null, error: { message: 'Not authenticated.' } };
    }

    const { data, error } = await this.client
      .from('admins')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) this.logError('getAdminProfile', error);
    return { data, error };
  }

  async isAdmin(): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      console.warn('[isAdmin] No user ID — not logged in.');
      return false;
    }

    const { data, error } = await this.client
      .from('admins')
      .select('user_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      this.logError('isAdmin', error);
      return false;
    }

    console.log('[isAdmin] userId:', userId, '| found:', !!data);
    return !!data;
  }

  // ── Connections ───────────────────────────────────────────────────────────
  async getMyConnections(): Promise<any[]> {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];
    const { data, error } = await this.client
      .from('connections')
      .select('*')
      .or(`mentee_user_id.eq.${userId},mentor_user_id.eq.${userId}`)
      .eq('status', 'connected');
    if (error) this.logError('getMyConnections', error);
    return data ?? [];
  }

  async isConnected(otherUserId: string): Promise<boolean> {
    const userId = await this.getCurrentUserId();
    if (!userId) return false;
    const { data } = await this.client
      .from('connections')
      .select('id')
      .or(`and(mentee_user_id.eq.${userId},mentor_user_id.eq.${otherUserId}),and(mentee_user_id.eq.${otherUserId},mentor_user_id.eq.${userId})`)
      .eq('status', 'connected')
      .maybeSingle();
    return !!data;
  }

  async connect(menteeUserId: string, mentorUserId: string): Promise<void> {
    const { error } = await this.client
      .from('connections')
      .upsert({ mentee_user_id: menteeUserId, mentor_user_id: mentorUserId, status: 'connected' },
               { onConflict: 'mentee_user_id,mentor_user_id' });
    if (error) this.logError('connect', error);
  }

  async disconnect(menteeUserId: string, mentorUserId: string): Promise<void> {
    const { error } = await this.client
      .from('connections')
      .update({ status: 'disconnected' })
      .or(`and(mentee_user_id.eq.${menteeUserId},mentor_user_id.eq.${mentorUserId}),and(mentee_user_id.eq.${mentorUserId},mentor_user_id.eq.${menteeUserId})`);
    if (error) this.logError('disconnect', error);
  }

  async updateLastSeen(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) return;
    const meta = await this.getCurrentUserMeta();
    const table = meta.role === 'mentor' ? 'mentor_profiles' : 'mentee_profiles';
    await this.client.from(table).update({ last_seen: new Date().toISOString() }).eq('user_id', userId);
  }

  // Check if current user has an incomplete registration (auth user exists but no profile row)
  async getRegistrationStatus(): Promise<'none' | 'role-pending' | 'profile-pending' | 'documents-pending' | 'pending-approval' | 'complete'> {
    const userId = await this.getCurrentUserId();
    if (!userId) return 'none';
    const meta = await this.getCurrentUserMeta();
    if (!meta.role) return 'role-pending';
    if (meta.role === 'mentee') {
      const { data } = await this.client.from('mentee_profiles').select('id').eq('user_id', userId).maybeSingle();
      return data ? 'complete' : 'profile-pending';
    }
    if (meta.role === 'mentor') {
      const { data } = await this.client.from('mentor_profiles').select('id, status, certifications').eq('user_id', userId).maybeSingle();
      if (!data) return 'profile-pending';
      if (!((data as any).certifications?.length)) return 'documents-pending';
      if ((data as any).status === 'pending') return 'pending-approval';
      if ((data as any).status === 'rejected') return 'none';
      return 'complete';
    }
    return 'none';
  }

  // ── Account Deletion ────────────────────────────────────────────────────────
  async deleteUserAccount(userId: string): Promise<{ success: boolean; error?: string }> {
    const { data: sessionData } = await this.client.auth.getSession();
    const accessToken = sessionData?.session?.access_token;

    if (!accessToken) {
      return { success: false, error: 'No access token' };
    }

    try {
      const response = await fetch(
        `${this.supabaseUrl}/functions/v1/delete-user`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Delete user error:', errorData);
        return { success: false, error: errorData.error || 'Failed to delete user' };
      }

      return { success: true };
    } catch (err: any) {
      console.error('Error calling delete function:', err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      return { success: false, error: errorMessage };
    }
  }
}
