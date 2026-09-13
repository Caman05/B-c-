import { isSupabaseConfigured, getSupabase } from '../lib/supabaseClient';

export type UserRole = 'admin' | 'member';

export interface Profile {
  id: string;
  email: string;
  name: string;
  username: string;
  bio: string;
  avatarUrl: string;
  role: UserRole;
  createdAt: string;
  updatedAt: string;
}

export const APP_OWNER_EMAIL = 'quynhchinga1229@gmail.com';
export const APP_OWNER_ID = 'owner-quynhchinga1229';

const STORAGE_KEY_PROFILES = 'be_ca_profiles_v2';
const STORAGE_KEY_CURRENT_USER_ID = 'be_ca_current_user_id_v2';
const STORAGE_KEY_TEST_MEMBER_MODE = 'be_ca_is_test_member_mode_v2';
const RESTORE_PATCH_KEY = 'be_ca_admin_restore_patch_v3';

const INITIAL_PROFILES: Profile[] = [
  {
    id: APP_OWNER_ID,
    email: APP_OWNER_EMAIL,
    name: 'Chủ Bể Cá',
    username: 'quynhchinga1229',
    bio: 'Người sáng lập và quản trị tối cao của không gian BỂ CÁ.',
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
    role: 'admin', // Sole App Owner Admin
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'user-demo-1',
    email: 'lanbien1@beca.ocean',
    name: 'Người Lặn Biển #1',
    username: 'lanbien_01',
    bio: 'Thành viên khám phá san hô và sinh vật biển.',
    avatarUrl: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80',
    role: 'member', // Regular Member
    createdAt: '2026-01-05T00:00:00.000Z',
    updatedAt: '2026-01-05T00:00:00.000Z',
  },
  {
    id: 'user-demo-2',
    email: 'lanbien2@beca.ocean',
    name: 'Người Lặn Biển #2',
    username: 'lanbien_02',
    bio: 'Thành viên sưu tầm cá cảnh và nhạc du dương.',
    avatarUrl: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
    role: 'member', // Regular Member
    createdAt: '2026-01-10T00:00:00.000Z',
    updatedAt: '2026-01-10T00:00:00.000Z',
  }
];

class AuthService {
  constructor() {
    this.restoreOwnerAdminIfTrapped();
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.initSupabaseAuthSync().catch(() => {});
      }, 100);
    }
  }

  /**
   * Automatic self-healing:
   * Restores Owner Admin access if the session was trapped in demo member mode.
   */
  public restoreOwnerAdminIfTrapped(): void {
    try {
      const isPatchApplied = localStorage.getItem(RESTORE_PATCH_KEY) === 'v3_applied';
      const savedId = localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID);
      const isTestMode = localStorage.getItem(STORAGE_KEY_TEST_MEMBER_MODE) === 'true';

      // Always restore on initial patch load, or if trapped in demo user
      if (!isPatchApplied || (savedId && (savedId === 'user-demo-1' || savedId === 'user-demo-2') && !isTestMode)) {
        console.log('[AuthService] Restoring Owner Admin access for', APP_OWNER_EMAIL);
        this.restoreOwnerAdmin();
        localStorage.setItem(RESTORE_PATCH_KEY, 'v3_applied');
      }
    } catch (e) {
      console.warn('[AuthService] Trapped state check error:', e);
    }
  }

  /**
   * Load all profiles with strict role integrity:
   * 1. APP_OWNER_EMAIL must ALWAYS have role: 'admin'
   * 2. All other accounts must ALWAYS have role: 'member'
   */
  public getAllProfiles(): Profile[] {
    let profiles: Profile[] = [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_PROFILES);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          profiles = parsed;
        }
      }
    } catch (e) {
      console.warn('[AuthService] Error loading profiles:', e);
    }

    if (profiles.length === 0) {
      profiles = [...INITIAL_PROFILES];
    }

    // STRICT ROLE ENFORCEMENT & INTEGRITY AUDIT:
    // Only APP_OWNER_EMAIL is allowed to hold 'admin'. No second admin!
    let hasModified = false;
    let ownerFound = false;

    profiles = profiles.map((p) => {
      if (p.email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase() || p.id === APP_OWNER_ID) {
        ownerFound = true;
        if (p.role !== 'admin') {
          hasModified = true;
          return { ...p, role: 'admin' as UserRole, email: APP_OWNER_EMAIL };
        }
        return p;
      } else {
        // Any other user cannot be admin
        if (p.role === 'admin') {
          hasModified = true;
          return { ...p, role: 'member' as UserRole };
        }
        return p;
      }
    });

    if (!ownerFound) {
      profiles.unshift(INITIAL_PROFILES[0]);
      hasModified = true;
    }

    if (hasModified) {
      this.saveProfiles(profiles);
    }

    return profiles;
  }

  private saveProfiles(profiles: Profile[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_PROFILES, JSON.stringify(profiles));
      window.dispatchEvent(new CustomEvent('be_ca_profiles_updated'));
    } catch (e) {
      console.error('[AuthService] Failed to save profiles:', e);
    }
  }

  /**
   * Restore Owner Admin access completely:
   * - Clears test member preview mode
   * - Sets current user to APP_OWNER_ID
   * - Enforces role 'admin' for owner
   * - Syncs profiles & dispatches reactive events
   */
  public restoreOwnerAdmin(): Profile {
    this.cachedTokens = {};
    try {
      localStorage.removeItem(STORAGE_KEY_TEST_MEMBER_MODE);
      localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, APP_OWNER_ID);
      localStorage.setItem('be_ca_admin_role', 'admin');
      localStorage.setItem('be_ca_active_user_id', APP_OWNER_ID);
    } catch (e) {
      console.warn('[AuthService] Error clearing test storage flags:', e);
    }

    const profiles = this.getAllProfiles();
    let owner = profiles.find(
      (p) => p.email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase() || p.id === APP_OWNER_ID
    );

    if (owner) {
      owner.role = 'admin';
    } else {
      owner = { ...INITIAL_PROFILES[0] };
      profiles.unshift(owner);
    }

    // Strictly enforce role 'member' for all other profiles
    profiles.forEach((p) => {
      if (p.email.toLowerCase() !== APP_OWNER_EMAIL.toLowerCase() && p.id !== APP_OWNER_ID) {
        p.role = 'member';
      }
    });

    this.saveProfiles(profiles);

    // Sync with Supabase profiles table if active
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        Promise.resolve().then(async () => {
          try {
            await supabase
              .from('profiles')
              .update({ role: 'admin', updated_at: new Date().toISOString() })
              .eq('email', APP_OWNER_EMAIL);
          } catch (err) {
            console.warn('[AuthService] Supabase profile update error:', err);
          }
        });
      }
    }

    window.dispatchEvent(new CustomEvent('be_ca_auth_role_changed', { detail: { isAdmin: true, user: owner } }));
    window.dispatchEvent(new CustomEvent('be_ca_admin_role_changed', { detail: { isAdmin: true } }));
    window.dispatchEvent(new CustomEvent('be_ca_user_switched', { detail: { userId: APP_OWNER_ID } }));
    window.dispatchEvent(new CustomEvent('be_ca_test_mode_changed', { detail: { isTestMode: false } }));

    return owner;
  }

  /**
   * Enter test member mode (impersonation/preview)
   * Keeps track of test flag so the owner is never trapped without an exit button.
   */
  public enterTestMemberMode(memberId: string = 'user-demo-1'): void {
    this.cachedTokens = {};
    const profiles = this.getAllProfiles();
    const target = profiles.find((p) => p.id === memberId) || profiles.find((p) => p.role === 'member') || INITIAL_PROFILES[1];

    try {
      localStorage.setItem(STORAGE_KEY_TEST_MEMBER_MODE, 'true');
      localStorage.setItem(STORAGE_KEY_CURRENT_USER_ID, target.id);
      localStorage.setItem('be_ca_admin_role', 'member');
      localStorage.setItem('be_ca_active_user_id', target.id);
    } catch (e) {
      console.error('[AuthService] Error entering test member mode:', e);
    }

    window.dispatchEvent(new CustomEvent('be_ca_auth_role_changed', { detail: { isAdmin: false, user: target } }));
    window.dispatchEvent(new CustomEvent('be_ca_admin_role_changed', { detail: { isAdmin: false } }));
    window.dispatchEvent(new CustomEvent('be_ca_user_switched', { detail: { userId: target.id } }));
    window.dispatchEvent(new CustomEvent('be_ca_test_mode_changed', { detail: { isTestMode: true, userId: target.id } }));
  }

  /**
   * Exit test member mode and return to Owner Admin
   */
  public exitTestMemberMode(): Profile {
    return this.restoreOwnerAdmin();
  }

  /**
   * Check if current session is explicitly running in Test as Member preview mode
   */
  public isTestMemberMode(): boolean {
    try {
      return localStorage.getItem(STORAGE_KEY_TEST_MEMBER_MODE) === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get the verified Owner profile
   */
  public getAuthenticatedOwner(): Profile {
    const profiles = this.getAllProfiles();
    return (
      profiles.find((p) => p.email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase() || p.id === APP_OWNER_ID) ||
      INITIAL_PROFILES[0]
    );
  }

  /**
   * Get current authenticated user profile
   * In test member mode, returns the previewed member.
   * Otherwise, returns the App Owner Admin.
   */
  public getCurrentUser(): Profile {
    const profiles = this.getAllProfiles();

    // If explicitly in test member mode, return the previewed user
    if (this.isTestMemberMode()) {
      try {
        const testId = localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID);
        if (testId) {
          const testUser = profiles.find((p) => p.id === testId);
          if (testUser) return testUser;
        }
      } catch {
        // ignore
      }
    }

    let currentId = APP_OWNER_ID;
    try {
      const savedId = localStorage.getItem(STORAGE_KEY_CURRENT_USER_ID);
      // Ignore stale demo IDs if not in test member mode
      if (savedId && savedId !== 'user-demo-1' && savedId !== 'user-demo-2') {
        currentId = savedId;
      }
    } catch {
      // ignore
    }

    const found = profiles.find((p) => p.id === currentId);
    if (found) {
      return found;
    }

    // Fallback to app owner admin
    return profiles.find((p) => p.email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase()) || profiles[0];
  }

  /**
   * Check if current session user is the verified ADMIN (App Owner)
   */
  public isAdmin(): boolean {
    // If in test member mode, admin privileges are temporarily masked for preview
    if (this.isTestMemberMode()) {
      return false;
    }
    const user = this.getCurrentUser();
    return user.role === 'admin' && user.email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase();
  }

  /**
   * Switch session user
   */
  public switchUser(userId: string): void {
    this.cachedTokens = {};
    if (userId === APP_OWNER_ID) {
      this.restoreOwnerAdmin();
      return;
    }
    this.enterTestMemberMode(userId);
  }

  private cachedTokens: Record<string, { token: string; expiresAt: number }> = {};

  /**
   * Get verified session token from backend for current authenticated user
   */
  public async getAuthToken(): Promise<string> {
    const user = this.getCurrentUser();
    const now = Date.now();
    
    if (this.cachedTokens[user.id] && this.cachedTokens[user.id].expiresAt > now + 60000) {
      return this.cachedTokens[user.id].token;
    }

    try {
      const res = await fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.token) {
          this.cachedTokens[user.id] = {
            token: data.token,
            expiresAt: now + 24 * 60 * 60 * 1000,
          };
          return data.token;
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error obtaining session token:', err);
    }

    return '';
  }

  /**
   * Get Authorization headers with Bearer token
   */
  public async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getAuthToken();
    if (token) {
      return {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };
    }
    return {
      'Content-Type': 'application/json',
    };
  }

  /**
   * Update current user profile fields (Name, Bio, Avatar, Username).
   * Users CANNOT mutate their own role!
   * Regular members can ONLY update their own profile.
   */
  public updateProfile(id: string, updates: Partial<Omit<Profile, 'id' | 'createdAt'>>): Profile {
    const profiles = this.getAllProfiles();
    const index = profiles.findIndex((p) => p.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy tài khoản người dùng.');
    }

    const existing = profiles[index];
    const currentUser = this.getCurrentUser();

    // User permission check: User can only update their own profile (or Admin can manage)
    if (currentUser.id !== id && !this.isAdmin()) {
      throw new Error('Từ chối quyền truy cập: Bạn chỉ có quyền chỉnh sửa thông tin của chính mình.');
    }

    // Strict validation on avatarUrl: reject temporary browser blob URLs or local paths
    if (updates.avatarUrl !== undefined) {
      const trimmedAvatar = updates.avatarUrl.trim();
      if (
        trimmedAvatar.startsWith('blob:') || 
        trimmedAvatar.startsWith('file:') || 
        trimmedAvatar.includes('C:\\fakepath')
      ) {
        throw new Error('Không được lưu URL tạm thời (blob URL hoặc đường dẫn tệp local). Ảnh đại diện phải là liên kết hợp lệ từ Supabase Storage.');
      }
    }

    // RLS Enforcement:
    // Only the App Owner can have 'admin' role. A member cannot elevate their role to 'admin'.
    let newRole: UserRole = existing.role;
    if (updates.role && updates.role !== existing.role) {
      if (existing.email.toLowerCase() !== APP_OWNER_EMAIL.toLowerCase()) {
        throw new Error('Từ chối quyền truy cập: Bạn không thể tự cấp quyền Admin.');
      }
      newRole = updates.role;
    }

    const updatedProfile: Profile = {
      ...existing,
      name: updates.name !== undefined ? updates.name.trim() : existing.name,
      username: updates.username !== undefined ? updates.username.trim().replace(/^@/, '') : existing.username,
      bio: updates.bio !== undefined ? updates.bio.trim() : existing.bio,
      avatarUrl: updates.avatarUrl !== undefined ? updates.avatarUrl.trim() : existing.avatarUrl,
      role: newRole,
      updatedAt: new Date().toISOString(),
    };

    profiles[index] = updatedProfile;
    this.saveProfiles(profiles);

    // Sync legacy profile store for backwards compatibility
    try {
      localStorage.setItem('be_ca_user_profile', JSON.stringify({
        name: updatedProfile.name,
        username: updatedProfile.username,
        email: updatedProfile.email,
        bio: updatedProfile.bio,
        avatarUrl: updatedProfile.avatarUrl,
      }));
    } catch {
      // ignore
    }

    // Sync to Supabase profiles table if Supabase is active
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        Promise.resolve().then(async () => {
          try {
            const { error } = await supabase
              .from('profiles')
              .upsert({
                id: updatedProfile.id,
                email: updatedProfile.email,
                username: updatedProfile.username,
                avatar_url: updatedProfile.avatarUrl,
                role: updatedProfile.role,
                updated_at: updatedProfile.updatedAt,
              }, { onConflict: 'id' });

            if (error) {
              console.warn('[AuthService] Supabase profile upsert warning:', error.message);
              // Retry with just avatar_url update if schema has restrictions
              await supabase
                .from('profiles')
                .update({
                  avatar_url: updatedProfile.avatarUrl,
                  updated_at: updatedProfile.updatedAt,
                })
                .eq('id', updatedProfile.id);
            }
          } catch (err) {
            console.warn('[AuthService] Supabase sync error:', err);
          }
        });
      }
    }

    window.dispatchEvent(new CustomEvent('be_ca_auth_role_changed', { 
      detail: { isAdmin: this.isAdmin(), user: updatedProfile } 
    }));

    return updatedProfile;
  }

  /**
   * Sync profiles from Supabase database if available
   */
  public async syncProfilesFromSupabase(): Promise<Profile[]> {
    if (!isSupabaseConfigured()) return this.getAllProfiles();
    const supabase = getSupabase();
    if (!supabase) return this.getAllProfiles();

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*');

      if (!error && data && data.length > 0) {
        const localProfiles = this.getAllProfiles();
        let changed = false;

        data.forEach((remote: any) => {
          const matchIndex = localProfiles.findIndex(
            (p) => p.id === remote.id || (p.email && remote.email && p.email.toLowerCase() === remote.email.toLowerCase())
          );
          if (matchIndex !== -1) {
            const current = localProfiles[matchIndex];
            const remoteAvatar = remote.avatar_url || remote.avatar;
            if (remoteAvatar && remoteAvatar !== current.avatarUrl) {
              localProfiles[matchIndex] = {
                ...current,
                avatarUrl: remoteAvatar,
                updatedAt: remote.updated_at || current.updatedAt,
              };
              changed = true;
            }
          }
        });

        if (changed) {
          this.saveProfiles(localProfiles);
        }
      }
    } catch (err) {
      console.warn('[AuthService] Error fetching remote profiles:', err);
    }
    return this.getAllProfiles();
  }

  /**
   * Create a new user profile on registration.
   * STRICT POLICY: All new user registrations default strictly to role: 'member'!
   */
  public createProfile(email: string, name: string, username?: string): Profile {
    const trimmedEmail = email.trim().toLowerCase();
    const profiles = this.getAllProfiles();

    if (profiles.some((p) => p.email.toLowerCase() === trimmedEmail)) {
      throw new Error(`Tài khoản với email "${trimmedEmail}" đã tồn tại.`);
    }

    // Only APP_OWNER_EMAIL gets admin, all new users get 'member'
    const role: UserRole = trimmedEmail === APP_OWNER_EMAIL.toLowerCase() ? 'admin' : 'member';

    const newProfile: Profile = {
      id: `user-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      email: trimmedEmail,
      name: name.trim() || 'Người Lặn Biển Mới',
      username: username?.trim().replace(/^@/, '') || trimmedEmail.split('@')[0],
      bio: 'Thành viên mới gia nhập BỂ CÁ.',
      avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
      role,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    profiles.push(newProfile);
    this.saveProfiles(profiles);

    return newProfile;
  }

  /**
   * Verify authenticated user from Supabase Auth & check role integrity in profiles
   */
  public async initSupabaseAuthSync(): Promise<void> {
    if (!isSupabaseConfigured()) return;
    const supabase = getSupabase();
    if (!supabase) return;

    try {
      const { data, error } = await supabase.auth.getUser();
      if (error || !data || !data.user) {
        return;
      }

      const authUser = data.user;
      const userEmail = (authUser.email || '').toLowerCase().trim();
      const isOwner = userEmail === APP_OWNER_EMAIL.toLowerCase();

      // Check current profile row in Supabase profiles
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', authUser.id)
        .maybeSingle();

      if (profileRow) {
        if (isOwner && profileRow.role !== 'admin') {
          console.log('[AuthService] Restoring admin role in Supabase profiles table for owner');
          await supabase
            .from('profiles')
            .update({ role: 'admin', updated_at: new Date().toISOString() })
            .eq('id', authUser.id);
        }
      } else if (isOwner) {
        await supabase
          .from('profiles')
          .insert({
            id: authUser.id,
            email: APP_OWNER_EMAIL,
            name: 'Chủ Bể Cá',
            username: 'quynhchinga1229',
            role: 'admin',
            updated_at: new Date().toISOString(),
          });
      }
    } catch (e) {
      console.warn('[AuthService] Supabase Auth sync check error:', e);
    }
  }
}

export const authService = new AuthService();
