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
   * Load master catalog from storage or seed initial default characters
   */
  public loadCatalog(): Character[] {
    try {
      let raw = localStorage.getItem(STORAGE_KEY_CHARACTERS);

      // Purge obsolete legacy keys
      LEGACY_STORAGE_KEYS.forEach((key) => {
        try {
          if (key !== STORAGE_KEY_CHARACTERS) {
            localStorage.removeItem(key);
          }
        } catch {
          // ignore
        }
      });

      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const OBSOLETE_TAGS = ['ẩn sĩ', 'chiến binh', 'cổ phong', 'ký ức'];
          const cleaned = parsed.map((c: any) => {
            const currentTags = Array.isArray(c?.tags) ? c.tags : [];
            const sanitizedTags = currentTags.filter((t: any) => {
              if (!t || typeof t !== 'string') return false;
              if (OBSOLETE_TAGS.includes(t.trim().toLowerCase())) {
                return false;
              }
              return true;
            });

            // Detect and repair broken/temporary blob URLs
            let avatar = c.avatar || c.avatarUrl || '';
            if (isTemporaryBlobUrl(avatar) || !avatar.trim()) {
              avatar = DEFAULT_FALLBACK_AVATAR;
            }

            const { lore: _unused, ...rest } = c;
            return {
              ...rest,
              avatar,
              avatarUrl: avatar,
              tags: sanitizedTags,
            } as Character;
          });

          // Always guarantee all default characters (specifically Tuyên Lãng) are present
          const merged = this.mergeWithDefaults(cleaned);
          this.saveCatalog(merged, false);
          return merged;
        }
      }
    } catch (e) {
      console.warn('[CharacterRepository] Load catalog error:', e);
    }

    // Default seed for new sessions/incognito
    this.saveCatalog(INITIAL_CHARACTERS, false);
    return INITIAL_CHARACTERS;
  }

  /**
   * Save master catalog to storage and notify event listeners
   */
  public saveCatalog(characters: Character[], dispatchEvent = true): void {
    try {
      localStorage.setItem(STORAGE_KEY_CHARACTERS, JSON.stringify(characters));
      localStorage.setItem(STORAGE_KEY_CHARACTERS_VERSION, String(CHARACTERS_VERSION));
      if (dispatchEvent) {
        window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));
      }
    } catch (e) {
      console.error('[CharacterRepository] Save catalog error:', e);
    }
  }

  private realtimeChannel: any = null;

  /**
   * Helper to map a Supabase database row to a canonical Character object
   */
  public mapSupabaseRowToCharacter(row: any): Character {
    const cleanAvatar = resolveCharacterImageUrl(row.avatar || row.avatar_url);
    return {
      id: String(row.id),
      name: row.name,
      role: row.role || undefined,
      age: row.age !== null && row.age !== undefined ? Number(row.age) : undefined,
      appearance: row.appearance || undefined,
      avatar: cleanAvatar,
      avatarUrl: cleanAvatar,
      shortDescription: row.short_description || row.shortDescription || (row.description ? row.description.slice(0, 75) : ''),
      description: row.description || '',
      characterLink: row.character_link || row.characterLink || undefined,
      isLocked: Boolean(row.is_locked ?? row.isLocked),
      locked: Boolean(row.is_locked ?? row.isLocked),
      isHidden: Boolean(row.is_hidden ?? row.isHidden),
      unlockType: row.unlock_type || row.unlockType || 'none',
      unlockCondition: row.unlock_condition || row.unlockCondition || undefined,
      quote: row.quote || undefined,
      lore: row.lore || undefined,
      tags: Array.isArray(row.tags) ? row.tags : [],
      isFavorite: false,
      favorite: false,
      isPet: false,
      pet: false,
      createdAt: row.created_at || row.createdAt || new Date().toISOString(),
      updatedAt: row.updated_at || row.updatedAt || new Date().toISOString(),
    };
  }

  /**
   * Seeds initial default characters onto Supabase if characters table is empty
   */
  public async seedInitialSupabaseCharacters(supabase: any): Promise<Character[]> {
    console.log('[CharacterRepository] Supabase characters table is empty. Seeding initial characters...');
    const now = new Date().toISOString();
    const rowsToInsert = INITIAL_CHARACTERS.map((char) => ({
      id: char.id,
      name: char.name,
      role: char.role || null,
      age: char.age ? Number(char.age) : null,
      appearance: char.appearance || null,
      avatar: char.avatar,
      avatar_url: char.avatarUrl || char.avatar,
      short_description: char.shortDescription || '',
      description: char.description || '',
      character_link: char.characterLink || null,
      is_locked: Boolean(char.isLocked),
      is_hidden: Boolean(char.isHidden),
      unlock_type: char.unlockType || 'none',
      unlock_condition: char.unlockCondition || null,
      quote: char.quote || null,
      tags: Array.isArray(char.tags) ? char.tags : [],
      created_at: char.createdAt || now,
      updated_at: char.updatedAt || now,
    }));

    try {
      const { error } = await supabase.from('characters').insert(rowsToInsert);
      if (error) {
        console.warn('[CharacterRepository] Seeding with full columns warning:', error.message);
        // Fallback with standard basic columns if table schema lacks role/age/appearance
        const basicRows = rowsToInsert.map(({ role, age, appearance, ...rest }) => rest);
        const res2 = await supabase.from('characters').insert(basicRows);
        if (res2.error) {
          console.warn('[CharacterRepository] Seeding basic columns warning:', res2.error.message);
        }
      }
    } catch (e) {
      console.warn('[CharacterRepository] Seeding network error:', e);
    }

    return INITIAL_CHARACTERS;
  }

  /**
   * Initialize Supabase Realtime subscription on characters table
   * Keeps all users and browsers instantly in sync when Admin makes changes
   */
  public initSupabaseRealtime(client?: any): void {
    if (this.realtimeChannel) return;
    const supabase = client || (isSupabaseConfigured() ? getSupabase() : null);
    if (!supabase) return;

    try {
      this.realtimeChannel = supabase
        .channel('public:characters_realtime_sync')
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'characters' },
          async (payload: any) => {
            console.log('[CharacterRepository] Realtime change detected on characters:', payload.eventType);
            try {
              const { data, error } = await supabase
                .from('characters')
                .select('*')
                .order('created_at', { ascending: false });

              if (!error && Array.isArray(data)) {
                const mapped: Character[] = data.map((row: any) => this.mapSupabaseRowToCharacter(row));
                const merged = this.mergeWithDefaults(mapped);
                this.saveCatalog(merged, true);
              }
            } catch (err) {
              console.warn('[CharacterRepository] Realtime refresh error:', err);
            }
          }
        )
        .subscribe();
    } catch (err) {
      console.warn('[CharacterRepository] Realtime channel setup warning:', err);
    }
  }

  /**
   * Get all characters in catalog (prioritizes Supabase if configured, with auto-seed and real-time sync)
   */
  public async getAllCharacters(): Promise<Character[]> {
    // 1. PRIMARY: Fetch directly from Supabase table 'characters'
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        this.initSupabaseRealtime(supabase);

        try {
          const { data, error } = await supabase
            .from('characters')
            .select('*')
            .order('created_at', { ascending: false });

          if (!error && Array.isArray(data)) {
            // Case A: Table is empty -> seed initial characters to Supabase immediately
            if (data.length === 0) {
              await this.seedInitialSupabaseCharacters(supabase);
              this.saveCatalog(INITIAL_CHARACTERS, false);
              return INITIAL_CHARACTERS;
            }

            // Case B: Table has characters -> map and ensure canonical defaults
            const mapped: Character[] = data.map((row: any) => this.mapSupabaseRowToCharacter(row));

            // Check if Tuyên Lãng (char-1) exists in Supabase. If missing, auto-insert to Supabase!
            const hasTuyenLang = mapped.some((c) => c.name === 'Tuyên Lãng');
            if (!hasTuyenLang) {
              try {
                const tl = INITIAL_CHARACTERS[0];
                await supabase.from('characters').insert({
                  id: tl.id,
                  name: tl.name,
                  role: tl.role || null,
                  age: tl.age ? Number(tl.age) : null,
                  appearance: tl.appearance || null,
                  avatar: tl.avatar,
                  avatar_url: tl.avatarUrl || tl.avatar,
                  short_description: tl.shortDescription || '',
                  description: tl.description || '',
                  character_link: tl.characterLink || null,
                  is_locked: false,
                  unlock_type: 'none',
                  quote: tl.quote || null,
                  tags: tl.tags || [],
                });
              } catch (insErr) {
                console.warn('[CharacterRepository] Auto-insert Tuyên Lãng to Supabase warning:', insErr);
              }
            }

            const merged = this.mergeWithDefaults(mapped);
            this.saveCatalog(merged, false);
            return merged;
          }
        } catch (err) {
          console.warn('[CharacterRepository] Supabase getAllCharacters query error:', err);
        }
      }
    }

    // 2. FALLBACK: Sync with server persistent database (/api/characters)
    try {
      const res = await fetch('/api/characters');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.characters) && data.characters.length > 0) {
          const merged = this.mergeWithDefaults(data.characters);
          this.saveCatalog(merged, false);
          return merged;
        }
      }
    } catch (apiErr) {
      // Local fallback on network failure
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
