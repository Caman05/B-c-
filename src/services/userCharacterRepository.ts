import { UserCharacterRelation, UnlockSource } from '../types';

const STORAGE_KEY_USER_CHARACTERS = 'be_ca_user_characters_v3';
const STORAGE_KEY_ACTIVE_USER = 'be_ca_active_user_id';

export const DEFAULT_USER_ID = 'owner-quynhchinga1229';

type UserRelationsMap = Record<string, Record<string, UserCharacterRelation>>;

class UserCharacterRepository {
  /**
   * Get the current active user ID (defaults to 'user-demo-1')
   */
  public getCurrentUserId(): string {
    try {
      return localStorage.getItem(STORAGE_KEY_ACTIVE_USER) || DEFAULT_USER_ID;
    } catch {
      return DEFAULT_USER_ID;
    }
  }

  /**
   * Switch the active user (demonstrates multi-user unlock isolation)
   */
  public setCurrentUserId(userId: string): void {
    try {
      localStorage.setItem(STORAGE_KEY_ACTIVE_USER, userId);
      window.dispatchEvent(new CustomEvent('be_ca_user_switched', { detail: { userId } }));
    } catch {
      // ignore
    }
  }

  /**
   * Load the multi-user relation store
   */
  private loadStore(): UserRelationsMap {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_USER_CHARACTERS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('[UserCharacterRepo] Failed to read storage:', e);
    }
    return {};
  }

  /**
   * Save the multi-user relation store
   */
  private saveStore(store: UserRelationsMap): void {
    try {
      localStorage.setItem(STORAGE_KEY_USER_CHARACTERS, JSON.stringify(store));
      window.dispatchEvent(new CustomEvent('be_ca_user_character_changed'));
    } catch (e) {
      console.error('[UserCharacterRepo] Failed to save storage:', e);
    }
  }

  /**
   * Get all character relations for a given user
   */
  public getUserRelations(userId?: string): Record<string, UserCharacterRelation> {
    const uid = userId || this.getCurrentUserId();
    const store = this.loadStore();
    return store[uid] || {};
  }

  /**
   * Get a specific character relation for a given user
   */
  public getUserRelation(characterId: string, userId?: string): UserCharacterRelation | null {
    const relations = this.getUserRelations(userId);
    return relations[characterId] || null;
  }

  /**
   * Determine if a character is unlocked for a specific user.
   * If character is globally unlocked (isLocked === false), it's unlocked for everyone.
   * If globally locked (isLocked === true), it's only unlocked if this user holds an unlock record.
   */
  public isCharacterUnlockedForUser(
    characterId: string,
    globalLocked: boolean,
    userId?: string
  ): boolean {
    if (!globalLocked) return true;
    const rel = this.getUserRelation(characterId, userId);
    return Boolean(rel?.isUnlocked);
  }

  /**
   * Unlock a character for a specific user (USER-SPECIFIC!)
   * Does NOT alter other users' unlock records!
   */
  public unlockForUser(
    characterId: string,
    source: UnlockSource,
    userId?: string
  ): UserCharacterRelation {
    const uid = userId || this.getCurrentUserId();
    const store = this.loadStore();
    if (!store[uid]) {
      store[uid] = {};
    }

    const existing = store[uid][characterId];
    const now = new Date().toISOString();

    const updated: UserCharacterRelation = {
      userId: uid,
      characterId,
      isUnlocked: true,
      unlockedAt: existing?.unlockedAt || now,
      unlockSource: source,
      isFavorite: existing?.isFavorite || false,
      isPet: existing?.isPet || false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    store[uid][characterId] = updated;
    this.saveStore(store);
    return updated;
  }

  /**
   * Revoke unlock for a specific user (Admin operation)
   */
  public revokeUnlockForUser(characterId: string, userId?: string): void {
    const uid = userId || this.getCurrentUserId();
    const store = this.loadStore();
    if (store[uid] && store[uid][characterId]) {
      store[uid][characterId].isUnlocked = false;
      store[uid][characterId].updatedAt = new Date().toISOString();
      this.saveStore(store);
    }
  }

  /**
   * Toggle favorite state for a specific user
   */
  public toggleFavorite(characterId: string, currentFav: boolean, userId?: string): boolean {
    const uid = userId || this.getCurrentUserId();
    const store = this.loadStore();
    if (!store[uid]) store[uid] = {};

    const existing = store[uid][characterId];
    const now = new Date().toISOString();
    const nextFav = !currentFav;

    store[uid][characterId] = {
      userId: uid,
      characterId,
      isUnlocked: existing?.isUnlocked || false,
      unlockedAt: existing?.unlockedAt,
      unlockSource: existing?.unlockSource || 'none',
      isFavorite: nextFav,
      isPet: existing?.isPet || false,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.saveStore(store);
    return nextFav;
  }

  /**
   * Toggle pet state for a specific user
   */
  public togglePet(characterId: string, currentPet: boolean, userId?: string): boolean {
    const uid = userId || this.getCurrentUserId();
    const store = this.loadStore();
    if (!store[uid]) store[uid] = {};

    const existing = store[uid][characterId];
    const now = new Date().toISOString();
    const nextPet = !currentPet;

    store[uid][characterId] = {
      userId: uid,
      characterId,
      isUnlocked: existing?.isUnlocked || false,
      unlockedAt: existing?.unlockedAt,
      unlockSource: existing?.unlockSource || 'none',
      isFavorite: existing?.isFavorite || false,
      isPet: nextPet,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    this.saveStore(store);
    return nextPet;
  }

  /**
   * Cascade cleanup: Delete all relations for a deleted character across all users
   */
  public cascadeDeleteCharacter(characterId: string): void {
    const store = this.loadStore();
    let changed = false;
    for (const uid in store) {
      if (store[uid][characterId]) {
        delete store[uid][characterId];
        changed = true;
      }
    }
    if (changed) {
      this.saveStore(store);
    }
  }
}

export const userCharacterRepository = new UserCharacterRepository();
