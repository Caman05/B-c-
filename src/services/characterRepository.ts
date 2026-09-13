import { Character, CharacterCreateInput, CharacterUpdateInput } from '../types';
import { INITIAL_CHARACTERS } from '../data/characters';
import { musicService } from './musicService';
import { userCharacterRepository } from './userCharacterRepository';
import { commentService } from './commentService';
import { auditService } from './auditService';
import { unlockService } from './unlockService';
import { isSupabaseConfigured, getSupabase } from '../lib/supabaseClient';
import { 
  resolveCharacterImageUrl, 
  DEFAULT_FALLBACK_AVATAR, 
  isTemporaryBlobUrl, 
  isValidCharacterImage, 
  normalizePersistentImageReference 
} from '../lib/imageUtils';

const STORAGE_KEY_CHARACTERS = 'be_ca_characters_v5';
const STORAGE_KEY_SECRETS = 'be_ca_character_secrets_v2';

// Private secrets store mapping (character_id -> secret_code)
const DEFAULT_SECRETS: Record<string, string> = {
  'char-12': 'VOLCANO_FORGE',
  'char-15': 'DEEP_TRENCH_SEAL',
};

class CharacterRepository {
  /**
   * Load master catalog from storage or seed initial default characters
   */
  public loadCatalog(): Character[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_CHARACTERS);
      if (raw) {
        const parsed = JSON.parse(raw);
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

            // Detect and repair broken/temporary blob URLs (e.g. Thiệu Minh or previously uploaded blobs)
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
            this.saveCatalog(cleaned);
          }
          return cleaned;
        }
      }
    } catch (e) {
      console.warn('[CharacterRepository] Load catalog error:', e);
    }
    this.saveCatalog(INITIAL_CHARACTERS);
    return INITIAL_CHARACTERS;
  }

  /**
   * Save master catalog to storage and notify event listeners
   */
  public saveCatalog(characters: Character[]): void {
    try {
      localStorage.setItem(STORAGE_KEY_CHARACTERS, JSON.stringify(characters));
      window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));
    } catch (e) {
      console.error('[CharacterRepository] Save catalog error:', e);
    }
  }

  /**
   * Get all characters in catalog (syncs with Supabase if configured)
   */
  public async getAllCharacters(): Promise<Character[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('characters')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data) && data.length > 0) {
            const mapped: Character[] = data.map((row: any) => {
              const cleanAvatar = resolveCharacterImageUrl(row.avatar || row.avatar_url);
              return {
                id: String(row.id),
                name: row.name,
                avatar: cleanAvatar,
                avatarUrl: cleanAvatar,
                shortDescription: row.short_description || (row.description ? row.description.slice(0, 75) : ''),
                description: row.description || '',
                characterLink: row.character_link || undefined,
                isLocked: Boolean(row.is_locked),
                locked: Boolean(row.is_locked),
                isHidden: Boolean(row.is_hidden),
                unlockType: row.unlock_type || 'none',
                unlockCondition: row.unlock_condition || undefined,
                quote: row.quote || undefined,
                lore: row.lore || undefined,
                tags: Array.isArray(row.tags) ? row.tags : [],
                isFavorite: false,
                favorite: false,
                isPet: false,
                pet: false,
                createdAt: row.created_at || new Date().toISOString(),
                updatedAt: row.updated_at || new Date().toISOString(),
              };
            });
            this.saveCatalog(mapped);
            return mapped;
          }
        } catch (err) {
          console.warn('[CharacterRepository] Supabase getAllCharacters query error:', err);
        }
      }
    }
    return this.loadCatalog();
  }

  /**
   * Load private secrets store (Admin only)
   */
  private loadSecrets(): Record<string, string> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY_SECRETS);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {
      // ignore
    }
    return { ...DEFAULT_SECRETS };
  }

  private saveSecrets(secrets: Record<string, string>): void {
    try {
      localStorage.setItem(STORAGE_KEY_SECRETS, JSON.stringify(secrets));
    } catch {
      // ignore
    }
  }

  /**
   * ADMIN ONLY: Read secret code for a character
   */
  public getSecretCode(characterId: string): string | null {
    if (!musicService.isAdminUser()) {
      return null;
    }
    const secrets = this.loadSecrets();
    return secrets[characterId] || null;
  }

  /**
   * ADMIN ONLY: Set or update secret code for a character
   */
  public setSecretCode(characterId: string, code: string): void {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền đổi mã bí mật.');
    }
    const secrets = this.loadSecrets();
    const cleanCode = code.trim().toUpperCase();
    secrets[characterId] = cleanCode;
    this.saveSecrets(secrets);
    unlockService.adminSetUnlockCode(characterId, cleanCode);
  }

  /**
   * ADMIN ONLY: Create a new Character
   */
  public async createCharacter(input: CharacterCreateInput): Promise<Character> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền thêm nhân vật theo chính sách RLS.');
    }

    const name = input.name?.trim();
    if (!name) {
      throw new Error('Tên nhân vật là bắt buộc và không được để trống.');
    }

    let avatar = DEFAULT_FALLBACK_AVATAR;
    if (input.avatar && input.avatar.trim()) {
      const trimmed = input.avatar.trim();
      if (!isTemporaryBlobUrl(trimmed) && isValidCharacterImage(trimmed)) {
        avatar = normalizePersistentImageReference(trimmed);
      }
    }
    const description = input.description?.trim() || '';
    const shortDescription = input.shortDescription?.trim() || (description ? description.slice(0, 75) : '');

    const newId = (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function')
      ? crypto.randomUUID()
      : `char-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const newCharacter: Character = {
      id: newId,
      name, // PURE REAL NAME, no fantasy suffix/title!
      avatar,
      avatarUrl: avatar,
      shortDescription,
      description,
      characterLink: input.characterLink?.trim() || undefined,
      isLocked: Boolean(input.isLocked),
      locked: Boolean(input.isLocked),
      isHidden: Boolean(input.isHidden),
      unlockType: input.unlockType || 'none',
      unlockCondition: input.unlockType === 'condition' ? input.unlockCondition : undefined,
      quote: input.quote?.trim() || undefined,
      lore: input.lore?.trim() || undefined,
      tags: Array.isArray(input.tags) ? input.tags : [],
      isFavorite: false,
      favorite: false,
      isPet: false,
      pet: false,
      createdAt: now,
      updatedAt: now,
    };

    // 1. Sync insert with Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase.from('characters').insert({
            id: newId,
            name,
            avatar,
            short_description: shortDescription,
            description,
            character_link: input.characterLink?.trim() || null,
            is_locked: Boolean(input.isLocked),
            unlock_type: input.unlockType || 'none',
            unlock_condition: input.unlockType === 'condition' ? input.unlockCondition : null,
            quote: input.quote?.trim() || null,
            tags: Array.isArray(input.tags) ? input.tags : [],
            updated_at: now,
          }).select().single();

          if (!error && data && data.id) {
            newCharacter.id = String(data.id);
          }
        } catch (dbErr) {
          console.warn('[CharacterRepository] Supabase character insert warning:', dbErr);
        }
      }
    }

    const catalog = this.loadCatalog();
    const updated = [newCharacter, ...catalog.filter(c => c.id !== newCharacter.id)];
    this.saveCatalog(updated);

    // If unlock type is 'code' and code provided, save to secret store
    if (input.unlockType === 'code' && input.unlockCode) {
      this.setSecretCode(newCharacter.id, input.unlockCode);
    }

    auditService.log('Thêm nhân vật mới', 'character', `Nhân vật: "${name}" (${newCharacter.id})`);
    return newCharacter;
  }

  /**
   * ADMIN ONLY: Update an existing Character
   */
  public async updateCharacter(id: string, input: CharacterUpdateInput): Promise<Character> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa nhân vật theo chính sách RLS.');
    }

    const catalog = this.loadCatalog();
    const index = catalog.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy nhân vật có mã ID: ${id}`);
    }

    const current = catalog[index];
    const name = input.name !== undefined ? input.name.trim() : current.name;
    if (!name) {
      throw new Error('Tên nhân vật không được để trống.');
    }

    // Avatar persistence: If not provided or empty, KEEP current avatar!
    let avatar = current.avatar;
    if (input.avatar !== undefined && input.avatar.trim() !== '') {
      const trimmed = input.avatar.trim();
      if (!isTemporaryBlobUrl(trimmed) && isValidCharacterImage(trimmed)) {
        avatar = normalizePersistentImageReference(trimmed);
      }
    }

    const description = input.description !== undefined ? input.description.trim() : current.description;
    const shortDescription = input.shortDescription !== undefined ? input.shortDescription.trim() : (description ? description.slice(0, 75) : current.shortDescription);
    const isLocked = input.isLocked !== undefined ? Boolean(input.isLocked) : Boolean(current.isLocked ?? current.locked);
    const isHidden = input.isHidden !== undefined ? Boolean(input.isHidden) : Boolean(current.isHidden);
    const unlockType = input.unlockType !== undefined ? input.unlockType : current.unlockType;
    const tags = input.tags !== undefined ? input.tags : current.tags;
    const now = new Date().toISOString();

    const updatedCharacter: Character = {
      ...current,
      name, // PURE REAL NAME
      avatar,
      avatarUrl: avatar,
      shortDescription,
      description,
      characterLink: input.characterLink !== undefined ? (input.characterLink.trim() || undefined) : current.characterLink,
      isLocked,
      locked: isLocked,
      isHidden,
      unlockType,
      unlockCondition: unlockType === 'condition' ? (input.unlockCondition || current.unlockCondition) : undefined,
      quote: input.quote !== undefined ? (input.quote.trim() || undefined) : current.quote,
      lore: input.lore !== undefined ? (input.lore.trim() || undefined) : current.lore,
      tags: Array.isArray(tags) ? tags : [],
      updatedAt: now,
    };

    // 1. Sync update with Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('characters').update({
            name,
            avatar,
            short_description: shortDescription,
            description,
            character_link: input.characterLink !== undefined ? (input.characterLink.trim() || null) : (current.characterLink || null),
            is_locked: Boolean(isLocked),
            unlock_type: unlockType,
            unlock_condition: unlockType === 'condition' ? (input.unlockCondition || current.unlockCondition || null) : null,
            quote: input.quote !== undefined ? (input.quote.trim() || null) : (current.quote || null),
            tags: Array.isArray(tags) ? tags : [],
            updated_at: now,
          }).eq('id', id);
        } catch (dbErr) {
          console.warn('[CharacterRepository] Supabase character update warning:', dbErr);
        }
      }
    }

    catalog[index] = updatedCharacter;
    this.saveCatalog(catalog);

    // Update secret code if unlockType is 'code' and unlockCode provided
    if (unlockType === 'code' && input.unlockCode) {
      this.setSecretCode(id, input.unlockCode);
    }

    auditService.log('Chỉnh sửa nhân vật', 'character', `Cập nhật: "${name}" (${id})`);
    return updatedCharacter;
  }

  /**
   * ADMIN ONLY: Update character avatar URL/path immediately upon upload
   * Persists stable storage reference into database and catalog so it survives full app reload
   */
  public async updateCharacterAvatar(id: string, avatarUrl: string): Promise<Character> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền chỉnh sửa nhân vật theo chính sách RLS.');
    }

    const trimmed = (avatarUrl || '').trim();
    if (!trimmed || isTemporaryBlobUrl(trimmed)) {
      throw new Error('Đường dẫn ảnh nhân vật không hợp lệ hoặc chỉ là liên kết tạm thời (blob: / file:).');
    }

    if (!isValidCharacterImage(trimmed)) {
      throw new Error('Đường dẫn ảnh nhân vật không hợp lệ. Vui lòng cung cấp URL http(s):// hoặc đường dẫn lưu trữ hợp lệ.');
    }

    const persistentRef = normalizePersistentImageReference(trimmed);
    if (!persistentRef) {
      throw new Error('Không thể chuẩn hóa đường dẫn lưu trữ cho nhân vật.');
    }

    const catalog = this.loadCatalog();
    const index = catalog.findIndex((c) => c.id === id);
    if (index === -1) {
      throw new Error(`Không tìm thấy nhân vật có mã ID: ${id}`);
    }

    const current = catalog[index];
    const now = new Date().toISOString();
    const updatedCharacter: Character = {
      ...current,
      avatar: persistentRef,
      avatarUrl: persistentRef,
      updatedAt: now,
    };

    // 1. Sync avatar update with Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('characters').update({
            avatar: persistentRef,
            avatar_url: persistentRef,
            updated_at: now,
          }).eq('id', id);
        } catch (dbErr) {
          console.warn('[CharacterRepository] Supabase character avatar update warning:', dbErr);
        }
      }
    }

    catalog[index] = updatedCharacter;
    this.saveCatalog(catalog);
    auditService.log('Cập nhật ảnh nhân vật', 'character', `Cập nhật ảnh đại diện cho: "${current.name}" (${id}) -> ${persistentRef}`);
    return updatedCharacter;
  }

  /**
   * ADMIN ONLY: Delete a character and safely cascade cleanup relations
   */
  public async deleteCharacter(id: string): Promise<boolean> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền xóa nhân vật theo chính sách RLS.');
    }

    const catalog = this.loadCatalog();
    const target = catalog.find((c) => c.id === id);
    if (!target) return false;

    // Sync delete with Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase.from('characters').delete().eq('id', id);
        } catch (dbErr) {
          console.warn('[CharacterRepository] Supabase character delete warning:', dbErr);
        }
      }
    }

    const filtered = catalog.filter((c) => c.id !== id);
    this.saveCatalog(filtered);

    // Cascade Cleanup: Clean up from user_characters relation store
    try {
      userCharacterRepository.cascadeDeleteCharacter(id);
    } catch (e) {
      console.warn('Error during userCharacterRepository cascade delete:', e);
    }

    // Cascade Cleanup: Clean up comments for this character
    try {
      commentService.deleteCommentsForCharacter(id);
    } catch (e) {
      console.warn('Error during commentService cascade delete:', e);
    }

    // Clean up secrets
    const secrets = this.loadSecrets();
    if (secrets[id]) {
      delete secrets[id];
      this.saveSecrets(secrets);
    }

    auditService.log('Xóa nhân vật', 'character', `Đã xóa nhân vật "${target.name}" (${id})`);
    return true;
  }

  /**
   * ADMIN ONLY: Toggle global lock state
   */
  public async toggleGlobalLock(id: string, isLocked: boolean): Promise<Character> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền khóa/mở khóa toàn cục.');
    }

    const character = await this.updateCharacter(id, { isLocked });
    auditService.log(
      isLocked ? 'Khóa nhân vật (Global)' : 'Mở khóa nhân vật (Global)',
      'unlock',
      `Nhân vật "${character.name}" chuyển sang ${isLocked ? 'Đang Khóa 🔒' : 'Mở Tự Do 🔓'}`
    );
    return character;
  }

  /**
   * ADMIN ONLY: Toggle visibility (hide/show) of a character
   */
  public async toggleVisibility(id: string, isHidden: boolean): Promise<Character> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền ẩn/hiện nhân vật.');
    }

    const character = await this.updateCharacter(id, { isHidden });
    auditService.log(
      isHidden ? 'Ẩn nhân vật khỏi Bể Cá' : 'Hiện nhân vật trong Bể Cá',
      'character',
      `Nhân vật "${character.name}" (${id}) chuyển sang ${isHidden ? 'Ẩn 👁️‍🗨️' : 'Hiển thị 👁️'}`
    );
    return character;
  }

  /**
   * ADMIN ONLY: Update unlock configuration
   */
  public async updateUnlockConfig(
    id: string,
    unlockType: Character['unlockType'],
    unlockCondition?: Character['unlockCondition'],
    secretCode?: string
  ): Promise<Character> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền cấu hình mở khóa.');
    }

    const character = await this.updateCharacter(id, {
      unlockType,
      unlockCondition,
      unlockCode: secretCode,
    });

    if (unlockType === 'code' && secretCode) {
      this.setSecretCode(id, secretCode);
    }

    auditService.log(
      'Thay đổi cấu hình mở khóa',
      'unlock',
      `Nhân vật "${character.name}": Kiểu ${unlockType.toUpperCase()}`
    );

    return character;
  }

  /**
   * ADMIN ONLY: Remove a deleted tag from all characters in catalog, localStorage, and Supabase
   */
  public async removeTagFromAllCharacters(tagName: string, tagId?: string): Promise<number> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền xóa thẻ tag khỏi nhân vật.');
    }

    const cleanTagName = tagName.trim().toLowerCase();
    const cleanTagId = tagId?.trim().toLowerCase();
    const catalog = this.loadCatalog();
    let updatedCount = 0;

    const updatedCatalog = catalog.map((c) => {
      if (!Array.isArray(c.tags) || c.tags.length === 0) {
        return c;
      }

      const originalLength = c.tags.length;
      const filteredTags = c.tags.filter((t) => {
        if (!t || typeof t !== 'string') return false;
        const cleanT = t.trim().toLowerCase();
        if (cleanT === cleanTagName || t === tagName) return false;
        if (cleanTagId && (cleanT === cleanTagId || t === tagId)) return false;
        return true;
      });

      if (filteredTags.length !== originalLength) {
        updatedCount++;
        return {
          ...c,
          tags: filteredTags,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });

    if (updatedCount > 0) {
      this.saveCatalog(updatedCatalog);
    }

    // Sync with Supabase if connected
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        Promise.resolve().then(async () => {
          try {
            const { data: dbChars, error } = await supabase.from('characters').select('id, tags');
            if (!error && Array.isArray(dbChars)) {
              for (const dbChar of dbChars) {
                if (Array.isArray(dbChar.tags) && dbChar.tags.length > 0) {
                  const originalLen = dbChar.tags.length;
                  const cleaned = dbChar.tags.filter((t: string) => {
                    if (!t || typeof t !== 'string') return false;
                    const cleanT = t.trim().toLowerCase();
                    if (cleanT === cleanTagName || t === tagName) return false;
                    if (cleanTagId && (cleanT === cleanTagId || t === tagId)) return false;
                    return true;
                  });
                  if (cleaned.length !== originalLen) {
                    await supabase
                      .from('characters')
                      .update({ tags: cleaned, updated_at: new Date().toISOString() })
                      .eq('id', dbChar.id);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[CharacterRepository] Supabase cascade tag delete error:', err);
          }
        });
      }
    }

    return updatedCount;
  }

  /**
   * ADMIN ONLY: Rename tag in all characters in catalog, localStorage, and Supabase
   */
  public async renameTagInAllCharacters(oldName: string, newName: string): Promise<number> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền đổi thẻ tag.');
    }

    const cleanOld = oldName.trim().toLowerCase();
    const cleanNew = newName.trim();
    const catalog = this.loadCatalog();
    let updatedCount = 0;

    const updatedCatalog = catalog.map((c) => {
      if (!Array.isArray(c.tags) || c.tags.length === 0) {
        return c;
      }

      let hasReplaced = false;
      const newTags = c.tags.map((t) => {
        if (!t || typeof t !== 'string') return t;
        if (t.trim().toLowerCase() === cleanOld || t === oldName) {
          hasReplaced = true;
          return cleanNew;
        }
        return t;
      });

      // Deduplicate tags while preserving order
      const uniqueTags = Array.from(new Set(newTags));

      if (hasReplaced) {
        updatedCount++;
        return {
          ...c,
          tags: uniqueTags,
          updatedAt: new Date().toISOString(),
        };
      }
      return c;
    });

    if (updatedCount > 0) {
      this.saveCatalog(updatedCatalog);
    }

    // Sync with Supabase if configured
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        Promise.resolve().then(async () => {
          try {
            const { data: dbChars, error } = await supabase.from('characters').select('id, tags');
            if (!error && Array.isArray(dbChars)) {
              for (const dbChar of dbChars) {
                if (Array.isArray(dbChar.tags)) {
                  let changed = false;
                  const replaced = dbChar.tags.map((t: string) => {
                    if (t && (t.trim().toLowerCase() === cleanOld || t === oldName)) {
                      changed = true;
                      return cleanNew;
                    }
                    return t;
                  });
                  if (changed) {
                    await supabase
                      .from('characters')
                      .update({ tags: Array.from(new Set(replaced)), updated_at: new Date().toISOString() })
                      .eq('id', dbChar.id);
                  }
                }
              }
            }
          } catch (err) {
            console.warn('[CharacterRepository] Supabase cascade tag rename error:', err);
          }
        });
      }
    }

    return updatedCount;
  }
}

export const characterRepository = new CharacterRepository();
