/**
 * Character Service Layer
 * 
 * Provides an abstraction between UI components and data persistence.
 * Designed to seamlessly bind to Supabase:
 * - Table `characters`: master catalog (id, name, avatar, description, is_locked, unlock_type, unlock_condition)
 * - Table `user_characters`: per-user relationship (user_id, character_id, is_unlocked, unlocked_at, unlock_source, is_favorite, is_pet)
 */

import { Character } from '../types';
import { INITIAL_CHARACTERS } from '../data/characters';
import { userCharacterRepository } from './userCharacterRepository';
import { unlockService, UnlockActionResult } from './unlockService';
import { resolveCharacterImageUrl, DEFAULT_FALLBACK_AVATAR, isTemporaryBlobUrl } from '../lib/imageUtils';

const STORAGE_KEY_CHARACTERS = 'be_ca_characters_v5';

/**
 * Normalizes a character from storage/defaults and merges per-user state from userCharacterRepository
 */
export function normalizeCharacter(
  raw: Partial<Character> & { id: string; name: string },
  userId?: string
): Character {
  const globalLocked = raw.isLocked !== undefined ? raw.isLocked : (raw.locked !== undefined ? raw.locked : false);
  const avatar = resolveCharacterImageUrl(raw.avatar || raw.avatarUrl);

  // Dynamic free-text tags
  const tags = Array.isArray(raw.tags) 
    ? raw.tags.filter((t) => typeof t === 'string' && t.trim().length > 0)
    : [];

  // Fetch user-specific relation from user_characters store
  const userRel = userCharacterRepository.getUserRelation(raw.id, userId);

  // If globally unlocked (isLocked === false), it's unlocked for all users.
  // If globally locked (isLocked === true), it's ONLY unlocked if this user has an unlocked record!
  const isUnlocked = !globalLocked || Boolean(userRel?.isUnlocked);
  const isFavorite = userRel ? userRel.isFavorite : Boolean(raw.isFavorite ?? raw.favorite);
  const isPet = userRel ? userRel.isPet : Boolean(raw.isPet ?? raw.pet);

  return {
    id: raw.id,
    name: raw.name,
    avatar,
    avatarUrl: avatar,
    shortDescription: raw.shortDescription || raw.description?.slice(0, 75),
    description: raw.description || '',
    characterLink: raw.characterLink || undefined,

    // Global catalog state
    isLocked: !isUnlocked, // In the active view, indicates whether it is locked for THIS user
    locked: !isUnlocked,
    isHidden: Boolean(raw.isHidden),
    unlockType: raw.unlockType || 'none',
    unlockCondition: raw.unlockCondition,

    // User-specific states
    isUnlocked,
    unlockedAt: userRel?.unlockedAt,
    unlockSource: userRel?.unlockSource,
    isFavorite,
    favorite: isFavorite,
    isPet,
    pet: isPet,

    quote: raw.quote,
    lore: raw.lore,
    tags,
    createdAt: raw.createdAt || new Date().toISOString(),
    updatedAt: raw.updatedAt || new Date().toISOString(),
  };
}

/**
 * Loads raw characters catalog from storage or seeds defaults
 */
function loadCatalog(): Character[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY_CHARACTERS);
    if (saved) {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length > 0) {
        let hasObsolete = false;
        const OBSOLETE_TAGS = ['ẩn sĩ', 'chiến binh', 'cổ phong', 'ký ức'];
        const cleaned = parsed.map((c: any) => {
          let modified = false;
          const currentTags = Array.isArray(c?.tags) ? c.tags : [];
          const sanitizedTags = currentTags.filter((t: any) => {
            if (!t || typeof t !== 'string') return false;
            if (OBSOLETE_TAGS.includes(t.trim().toLowerCase())) {
              modified = true;
              return false;
            }
            return true;
          });

          if (c && c.lore !== undefined) {
            modified = true;
          }

          let avatar = c.avatar || c.avatarUrl || '';
          if (isTemporaryBlobUrl(avatar) || !avatar.trim()) {
            avatar = DEFAULT_FALLBACK_AVATAR;
            modified = true;
          }

          if (modified) {
            hasObsolete = true;
            const { lore: _unused, ...rest } = c;
            return { ...rest, avatar, avatarUrl: avatar, tags: sanitizedTags } as Character;
          }
          return c as Character;
        });
        if (hasObsolete) {
          saveCatalog(cleaned);
        }
        return cleaned;
      }
    }
  } catch (err) {
    console.warn('[CharacterService] Could not read catalog from storage:', err);
  }

  saveCatalog(INITIAL_CHARACTERS);
  return INITIAL_CHARACTERS;
}

/**
 * Saves characters catalog to storage
 */
function saveCatalog(characters: Character[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_CHARACTERS, JSON.stringify(characters));
    window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));
  } catch (err) {
    console.warn('[CharacterService] Could not save catalog to storage:', err);
  }
}

export const characterService = {
  /**
   * Synchronous load for initial state hydration
   */
  getCharactersSync(userId?: string, includeHidden = false): Character[] {
    const catalog = loadCatalog();
    const list = catalog.map((c) => normalizeCharacter(c, userId));
    return includeHidden ? list : list.filter((c) => !c.isHidden);
  },

  /**
   * Asynchronous fetch matching Supabase Client API signature
   */
  async getCharacters(userId?: string, includeHidden = false): Promise<Character[]> {
    const catalog = loadCatalog();
    const list = catalog.map((c) => normalizeCharacter(c, userId));
    return includeHidden ? list : list.filter((c) => !c.isHidden);
  },

  /**
   * Get character by ID with current user's unlock & favorite states
   */
  async getCharacterById(id: string, userId?: string): Promise<Character | null> {
    const catalog = loadCatalog();
    const found = catalog.find((c) => c.id === id);
    if (!found) return null;
    return normalizeCharacter(found, userId);
  },

  /**
   * Toggle favorite state for a character (Per-User!)
   */
  async toggleFavorite(id: string, userId?: string): Promise<Character> {
    const catalog = loadCatalog();
    const found = catalog.find((c) => c.id === id);
    if (!found) throw new Error(`Character ${id} not found.`);

    const userRel = userCharacterRepository.getUserRelation(id, userId);
    const currentFav = userRel ? userRel.isFavorite : Boolean(found.isFavorite);
    userCharacterRepository.toggleFavorite(id, currentFav, userId);

    return normalizeCharacter(found, userId);
  },

  /**
   * Toggle pet state for a character (Per-User!)
   */
  async togglePet(id: string, userId?: string): Promise<Character> {
    const catalog = loadCatalog();
    const found = catalog.find((c) => c.id === id);
    if (!found) throw new Error(`Character ${id} not found.`);

    const userRel = userCharacterRepository.getUserRelation(id, userId);
    const currentPet = userRel ? userRel.isPet : Boolean(found.isPet);
    userCharacterRepository.togglePet(id, currentPet, userId);

    return normalizeCharacter(found, userId);
  },

  /**
   * Unlock character for the active user based on its configured unlock type
   */
  async unlockCharacter(
    id: string,
    code?: string,
    userId?: string
  ): Promise<{ character: Character; result: UnlockActionResult }> {
    const catalog = loadCatalog();
    const found = catalog.find((c) => c.id === id);
    if (!found) throw new Error(`Character with ID ${id} not found.`);

    let result: UnlockActionResult;

    switch (found.unlockType) {
      case 'code':
        if (!code) {
          throw new Error('Vui lòng nhập mã mở khóa.');
        }
        result = await unlockService.verifyAndUnlockWithCode(id, code, userId);
        break;

      case 'condition':
        const allChars = catalog.map((c) => normalizeCharacter(c, userId));
        result = await unlockService.evaluateAndUnlockCondition(found, allChars, userId);
        break;

      case 'none':
        result = await unlockService.unlockImmediate(id, userId);
        break;

      case 'manual':
        if (unlockService.isAdmin()) {
          const targetUid = userId || userCharacterRepository.getCurrentUserId();
          result = await unlockService.adminGrantManualUnlock(id, targetUid);
        } else {
          throw new Error('Nhân vật này yêu cầu quyền mở khóa riêng từ Quản trị viên.');
        }
        break;

      default:
        result = await unlockService.unlockImmediate(id, userId);
    }

    if (!result.success) {
      throw new Error(result.message);
    }

    const updated = normalizeCharacter(found, userId);
    return { character: updated, result };
  },

  /**
   * Calculate live stats for the active user
   */
  async getStats(userId?: string): Promise<{
    total: number;
    unlocked: number;
    locked: number;
    favorites: number;
    pets: number;
  }> {
    const all = await this.getCharacters(userId);
    return {
      total: all.length,
      unlocked: all.filter((c) => !c.isLocked).length,
      locked: all.filter((c) => c.isLocked).length,
      favorites: all.filter((c) => c.isFavorite).length,
      pets: all.filter((c) => c.isPet).length,
    };
  },
};
