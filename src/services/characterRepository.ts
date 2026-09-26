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

export const CHARACTERS_VERSION = 2;
export const STORAGE_KEY_CHARACTERS = 'be_ca_characters_v2';
export const STORAGE_KEY_CHARACTERS_VERSION = 'be_ca_characters_version';
const LEGACY_STORAGE_KEYS = [
  'be_ca_characters',
  'be_ca_characters_v1',
  'be_ca_characters_v3',
  'be_ca_characters_v4',
  'be_ca_characters_v5',
  'be_ca_characters_v6',
  'be_ca_characters_v7',
];
const STORAGE_KEY_SECRETS = 'be_ca_character_secrets_v2';

// Private secrets store mapping (character_id -> secret_code)
const DEFAULT_SECRETS: Record<string, string> = {
  'char-12': 'VOLCANO_FORGE',
  'char-15': 'DEEP_TRENCH_SEAL',
};

class CharacterRepository {
  /**
   * Guarantees that all default characters from INITIAL_CHARACTERS exist in the catalog
   * and are always positioned at the head of the list in canonical order.
   * Explicitly ensures char-1 is Tuyên Lãng with role 'Đương kim Hoàng đế'.
   */
  public mergeWithDefaults(list: Character[]): Character[] {
    const defaultIds = new Set(INITIAL_CHARACTERS.map((c) => c.id));
    const listMap = new Map(list.map((c) => [c.id, c]));

    // 1. Process default characters: always placed at the top in canonical order
    const mergedDefaults: Character[] = INITIAL_CHARACTERS.map((defChar) => {
      const existing = listMap.get(defChar.id);
      if (!existing) return defChar;

      // Special case: char-1 MUST always be Tuyên Lãng
      if (defChar.id === 'char-1') {
        return {
          ...defChar,
          name: 'Tuyên Lãng',
          role: 'Đương kim Hoàng đế',
          age: 23,
          appearance: defChar.appearance,
          shortDescription: defChar.shortDescription,
          description: defChar.description,
          tags: ['Cổ trang'],
          avatar: defChar.avatar,
          avatarUrl: defChar.avatarUrl,
          characterLink: defChar.characterLink || existing.characterLink,
          quote: defChar.quote || existing.quote,
          isLocked: false,
          locked: false,
          unlockType: 'none',
          isHidden: false,
          isFavorite: existing.isFavorite ?? true,
          favorite: existing.favorite ?? true,
          isPet: existing.isPet ?? true,
          pet: existing.pet ?? true,
        };
      }

      // Merge existing data with default definition so required fields are preserved
      return {
        ...defChar,
        ...existing,
      };
    });

    // 2. Custom characters added by users/admins (IDs not in INITIAL_CHARACTERS)
    const customChars = list.filter((c) => !defaultIds.has(c.id) && c.name !== 'Tuyên Lãng');

    // Default characters are guaranteed at the top of the list!
    return [...mergedDefaults, ...customChars];
  }

  /**
   * Load master catalog directly from code definitions (src/data/characters.ts).
   * Bypasses and purges localStorage so the web always displays the exact source of truth.
   */
  public loadCatalog(): Character[] {
    try {
      [
        'be_ca_characters',
        'be_ca_characters_v1',
        'be_ca_characters_v2',
        'be_ca_characters_v3',
        'be_ca_characters_v4',
        'be_ca_characters_v5',
        'be_ca_characters_v6',
        'be_ca_characters_v7',
        'be_ca_characters_version',
      ].forEach((key) => {
        try {
          localStorage.removeItem(key);
        } catch {
          // ignore
        }
      });
    } catch (e) {
      // ignore
    }

    return INITIAL_CHARACTERS;
  }

  /**
   * Save master catalog - dispatches catalog updated event
   */
  public saveCatalog(characters: Character[], dispatchEvent = true): void {
    if (dispatchEvent && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));
    }
  }

  /**
   * Get all characters - returns canonical list from INITIAL_CHARACTERS directly
   */
  public async getAllCharacters(): Promise<Character[]> {
    return INITIAL_CHARACTERS;
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
      role: input.role?.trim() || undefined,
      age: input.age !== undefined && input.age !== '' ? Number(input.age) : undefined,
      appearance: input.appearance?.trim() || undefined,
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
          const insertPayload: any = {
            id: newId,
            name,
            avatar,
            avatar_url: avatar,
            short_description: shortDescription,
            description,
            character_link: input.characterLink?.trim() || null,
            role: input.role?.trim() || null,
            age: input.age !== undefined && input.age !== '' ? Number(input.age) : null,
            appearance: input.appearance?.trim() || null,
            is_locked: Boolean(input.isLocked),
            is_hidden: Boolean(input.isHidden),
            unlock_type: input.unlockType || 'none',
            unlock_condition: input.unlockType === 'condition' ? input.unlockCondition : null,
            quote: input.quote?.trim() || null,
            tags: Array.isArray(input.tags) ? input.tags : [],
            created_at: now,
            updated_at: now,
          };

          const { data, error } = await supabase
            .from('characters')
            .insert(insertPayload)
            .select()
            .single();

          if (error) {
            console.warn('[CharacterRepository] Supabase insert warning (retrying basic payload):', error.message);
            const { role, age, appearance, is_hidden, ...basic } = insertPayload;
            await supabase.from('characters').insert(basic);
          } else if (data && data.id) {
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

    // 2. Sync insert with server persistent database (/api/characters)
    try {
      await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCharacter),
      });
    } catch (err) {
      console.warn('[CharacterRepository] Server /api/characters POST error:', err);
    }

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
      role: input.role !== undefined ? (input.role.trim() || undefined) : current.role,
      age: input.age !== undefined ? (input.age !== '' ? Number(input.age) : undefined) : current.age,
      appearance: input.appearance !== undefined ? (input.appearance.trim() || undefined) : current.appearance,
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
          const updatePayload: any = {
            name,
            avatar,
            avatar_url: avatar,
            short_description: shortDescription,
            description,
            character_link: input.characterLink !== undefined ? (input.characterLink.trim() || null) : (current.characterLink || null),
            role: input.role !== undefined ? (input.role.trim() || null) : (current.role || null),
            age: input.age !== undefined ? (input.age !== '' ? Number(input.age) : null) : (current.age !== undefined ? Number(current.age) : null),
            appearance: input.appearance !== undefined ? (input.appearance.trim() || null) : (current.appearance || null),
            is_locked: Boolean(isLocked),
            is_hidden: Boolean(isHidden),
            unlock_type: unlockType,
            unlock_condition: unlockType === 'condition' ? (input.unlockCondition || current.unlockCondition || null) : null,
            quote: input.quote !== undefined ? (input.quote.trim() || null) : (current.quote || null),
            tags: Array.isArray(tags) ? tags : [],
            updated_at: now,
          };

          const { error } = await supabase.from('characters').update(updatePayload).eq('id', id);
          if (error) {
            console.warn('[CharacterRepository] Supabase update warning (retrying basic payload):', error.message);
            const { role, age, appearance, is_hidden, ...basic } = updatePayload;
            await supabase.from('characters').update(basic).eq('id', id);
          }
        } catch (dbErr) {
          console.warn('[CharacterRepository] Supabase character update warning:', dbErr);
        }
      }
    }

    catalog[index] = updatedCharacter;
    this.saveCatalog(catalog);

    // 2. Sync update with server persistent database (/api/characters/:id)
    try {
      await fetch(`/api/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCharacter),
      });
    } catch (err) {
      console.warn('[CharacterRepository] Server /api/characters PUT error:', err);
    }

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

    // 2. Sync avatar update with server persistent database (/api/characters/:id)
    try {
      await fetch(`/api/characters/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedCharacter),
      });
    } catch (err) {
      console.warn('[CharacterRepository] Server /api/characters PUT error:', err);
    }

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

    // 2. Sync delete with server persistent database (/api/characters/:id)
    try {
      await fetch(`/api/characters/${id}`, {
        method: 'DELETE',
      });
    } catch (err) {
      console.warn('[CharacterRepository] Server /api/characters DELETE error:', err);
    }

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
