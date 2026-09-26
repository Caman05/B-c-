/**
 * Dynamic Tag entity for Supabase `tags` table
 * Free-text dynamic tag name (e.g., "Nam", "Nữ", "Sinh viên", "OC", "Phản diện")
 */
export interface Tag {
  id: string;
  name: string;
  createdAt?: string;
}

/**
 * Junction table mapping for Supabase `character_tags` table (many-to-many)
 */
export interface CharacterTagRelation {
  characterId: string;
  tagId: string;
}

/**
 * Extensible Unlock Types:
 * - 'none': Publicly accessible to all users
 * - 'code': Requires a secret code (verified securely, not exposed client-side)
 * - 'condition': Requires satisfying condition evaluator (e.g. collection milestones)
 * - 'manual': Only granted directly by Admin
 */
export type UnlockType = 'none' | 'code' | 'condition' | 'manual';

export type UnlockSource = 'none' | 'code' | 'condition' | 'manual' | 'admin';

export interface UnlockCondition {
  type: 'collection_count' | 'has_character' | 'custom';
  requiredCount?: number;
  requiredCharacterId?: string;
  description: string; // User-facing description of what needs to be fulfilled
}

export interface Character {
  id: string;
  name: string;
  avatar: string; // Primary image URL
  avatarUrl?: string; // Supabase column mapping compatibility (avatar_url)
  shortDescription?: string;
  description: string;
  characterLink?: string; // External URL (opens when available)

  // Global catalog lock configuration (Managed exclusively by Admin)
  isLocked: boolean; // Global lock flag: true = requires unlock; false = public to all
  locked?: boolean; // Backward compatibility alias
  isHidden?: boolean; // Visibility flag: true = hidden from normal users; false/undefined = visible
  unlockType: UnlockType;
  unlockCondition?: UnlockCondition;
  // NOTE: unlockCode is intentionally NOT included here to prevent bundle leakage!

  // User-specific states (derived from user_characters per active user)
  isUnlocked?: boolean; // True if character is unlocked for current user
  unlockedAt?: string;
  unlockSource?: UnlockSource;
  isFavorite: boolean;
  favorite?: boolean; // Backward compatibility alias
  isPet: boolean;
  pet?: boolean; // Backward compatibility alias

  // Metadata attributes (completely free-form and dynamic)
  quote?: string;
  lore?: string;
  tags: string[]; // Free-text dynamic tags: ["Nam", "Sinh viên", "OC"], ["Nữ", "Phản diện"], or []

  createdAt: string;
  updatedAt: string;
}

/**
 * Supabase-ready user relation interface
 * In a multi-user environment, user_characters tracks per-user state
 * User 1 unlocking character X DOES NOT affect User 2!
 */
export interface UserCharacterRelation {
  id?: string;
  userId: string;
  characterId: string;
  isUnlocked: boolean;
  unlockedAt?: string;
  unlockSource: UnlockSource;
  isFavorite: boolean;
  isPet: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * Dynamic Music Track entity for Supabase `music_tracks` table
 */
export interface Track {
  id: string;
  title: string;
  artist?: string;
  coverUrl?: string;
  coverPath?: string; // Supabase storage path for cover artwork (e.g. covers/...)
  audioUrl: string;
  audioPath?: string; // Supabase storage path (e.g. music/audio/...)
  storageBucket?: string; // Storage bucket name (default 'music')
  contentType?: string; // Standard audio MIME type (e.g. audio/mpeg, audio/wav)
  isActive: boolean;
  duration?: number; // seconds
  rootFreq?: number; // audio synthesis frequency helper
  sortOrder?: number; // 1-based order in playlist (sort_order in Supabase)
  isLegacyBlob?: boolean; // Flagged if track contains an expired browser blob: URL
  isUnavailable?: boolean; // Flagged if track audio cannot be resolved
  createdAt: string;
  updatedAt: string;
}

export type MusicTrack = Track;

export type PageView = 
  | 'home'
  | 'library'
  | 'collection'
  | 'favorites'
  | 'locked'
  | 'profile';

export type AdminView = 
  | 'overview'
  | 'characters'
  | 'tags'
  | 'music'
  | 'unlocks'
  | 'users'
  | 'notifications';

export interface AdminNotification {
  id: string;
  type: 'comment';
  title: string;
  message: string;
  characterId: string;
  characterName?: string;
  characterAvatar?: string;
  commentId: string;
  userId: string;
  authorName: string;
  authorEmail?: string;
  authorRole?: 'admin' | 'member';
  authorAvatar?: string;
  content: string;
  createdAt: string;
  isRead: boolean;
}

export interface CharacterCreateInput {
  name: string;
  avatar: string;
  shortDescription?: string;
  description: string;
  characterLink?: string;
  tags?: string[];
  isLocked: boolean;
  isHidden?: boolean;
  unlockType: UnlockType;
  unlockCondition?: UnlockCondition;
  unlockCode?: string; // Stored in private secrets store
  quote?: string;
  lore?: string;
}

export interface CharacterUpdateInput {
  name?: string;
  avatar?: string;
  shortDescription?: string;
  description?: string;
  characterLink?: string;
  tags?: string[];
  isLocked?: boolean;
  isHidden?: boolean;
  unlockType?: UnlockType;
  unlockCondition?: UnlockCondition;
  unlockCode?: string;
  quote?: string;
  lore?: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  adminId: string;
  action: string;
  entity: 'character' | 'tag' | 'music' | 'unlock' | 'user';
  details: string;
}

export interface UserAccount {
  id: string;
  username: string;
  email: string;
  role: 'admin' | 'member' | 'user';
  createdAt: string;
  unlockedCount: number;
}

export interface FilterState {
  search: string;
  status: 'all' | 'unlocked' | 'locked' | 'favorites';
  selectedTag: string | 'all';
  sortBy: 'name' | 'newest';
}

export interface UserProfile {
  username: string;
  title: string;
  avatar: string;
  joinedDate: string;
  aquariumLevel: number;
  aquariumLevelName: string;
  discoveredCount: number;
  favoriteCount: number;
  bio: string;
  favoriteHabitat: string;
}

/**
 * Character Comment entity for community feedback and lore discussions
 * Bound to specific characterId and persisted to storage
 */
export interface CharacterComment {
  id: string;
  characterId: string;
  userId: string;
  authorName: string;
  authorEmail?: string;
  authorRole?: 'admin' | 'member';
  authorAvatar?: string;
  content: string;
  createdAt: string;
}
