import { Tag } from '../types';
import { musicService } from './musicService';
import { auditService } from './auditService';
import { characterRepository } from './characterRepository';
import { isSupabaseConfigured, getSupabase } from '../lib/supabaseClient';

const STORAGE_KEY_TAGS = 'be_ca_dynamic_tags_v2';
const STORAGE_KEY_DELETED_TAGS = 'be_ca_deleted_tags_v2';
const STORAGE_KEY_CHARACTERS = 'be_ca_characters_v5';

// Obsolete tags that were removed from the system and must be purged
export const OBSOLETE_TAG_NAMES = ['ẩn sĩ', 'chiến binh', 'cổ phong', 'ký ức'];

/**
 * Standard Unicode-safe Vietnamese string normalization (NFC, trimmed, lowercase)
 * Prevents accents and composed/decomposed Unicode variations from breaking equality checks.
 */
export function normalizeVietnamese(str: string): string {
  if (!str) return '';
  return str.normalize('NFC').trim().toLowerCase();
}

// Safe UUID generator
function generateUuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// Initial seed tags for first-time uninitialized preview only
const DEFAULT_INITIAL_TAGS: string[] = [
  'Nam',
  'Nữ',
  'Phi nhị nguyên',
  'Học sinh',
  'Sinh viên',
  'Giáo viên',
  'Kỹ sư',
  'Nhà nghiên cứu',
  'Thợ rèn',
  'Nghệ sĩ',
  'Vũ công',
  'Chỉ huy',
  'Hoa tiêu',
  'Lữ khách',
  'Du mục',
  'Sứ giả',
  'Chữa lành',
  'OC',
  'NPC',
  'Phản diện',
  'Cổ trang',
];

class TagRepository {
  private inMemoryCache: Tag[] | null = null;

  /**
   * Load deleted tag names tracking (prevents ghost tags from resurrecting in local preview)
   */
  private getDeletedTagNames(): Set<string> {
    let set: Set<string>;
    try {
      const raw = localStorage.getItem(STORAGE_KEY_DELETED_TAGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          set = new Set(parsed.map((s) => normalizeVietnamese(String(s))));
        } else {
          set = new Set(OBSOLETE_TAG_NAMES.map((s) => normalizeVietnamese(s)));
        }
      } else {
        set = new Set(OBSOLETE_TAG_NAMES.map((s) => normalizeVietnamese(s)));
      }
    } catch {
      set = new Set(OBSOLETE_TAG_NAMES.map((s) => normalizeVietnamese(s)));
    }
    // Ensure 'cổ trang' is NEVER considered deleted
    set.delete('cổ trang');
    return set;
  }

  private addDeletedTagName(name: string): void {
    try {
      const set = this.getDeletedTagNames();
      set.add(normalizeVietnamese(name));
      localStorage.setItem(STORAGE_KEY_DELETED_TAGS, JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }
  }

  private removeDeletedTagName(name: string): void {
    try {
      const set = this.getDeletedTagNames();
      set.delete(normalizeVietnamese(name));
      localStorage.setItem(STORAGE_KEY_DELETED_TAGS, JSON.stringify(Array.from(set)));
    } catch {
      // ignore
    }
  }

  /**
   * Load tags from Supabase `tags` table as single source of truth,
   * with fallback to local persistent storage when offline.
   */
  public async getAllTags(): Promise<Tag[]> {
    // 1. Try fetching directly from Supabase `tags` table
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('tags')
            .select('id, name, created_at')
            .order('name', { ascending: true });

          if (!error && Array.isArray(data)) {
            const rawDbTags: Tag[] = data
              .filter((d: any) => d && d.name && !OBSOLETE_TAG_NAMES.includes(normalizeVietnamese(d.name)))
              .map((d: any) => ({
                id: String(d.id),
                name: d.name.normalize('NFC').trim(),
                createdAt: d.created_at,
              }));

            // Deduplicate if database has duplicate records with slightly different casing/whitespace
            const seen = new Set<string>();
            const uniqueDbTags: Tag[] = [];
            for (const t of rawDbTags) {
              const key = normalizeVietnamese(t.name);
              if (!seen.has(key)) {
                seen.add(key);
                uniqueDbTags.push(t);
              }
            }

            this.inMemoryCache = uniqueDbTags;
            this.saveTagsLocal(uniqueDbTags);
            return uniqueDbTags;
          } else if (error) {
            console.warn('[TagRepository] Supabase fetch tags error:', error.message);
          }
        } catch (err) {
          console.warn('[TagRepository] Supabase tags query exception:', err);
        }
      }
    }

    // 2. Return in-memory cache if available
    if (this.inMemoryCache !== null) {
      return this.inMemoryCache;
    }

    // 3. Fallback: load from local storage
    const deletedNames = this.getDeletedTagNames();
    try {
      const raw = localStorage.getItem(STORAGE_KEY_TAGS);
      if (raw !== null) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(
            (t: any) =>
              t &&
              t.name &&
              !OBSOLETE_TAG_NAMES.includes(normalizeVietnamese(t.name)) &&
              !deletedNames.has(normalizeVietnamese(t.name))
          );

          // Ensure 'Cổ trang' is present in local preview if not explicitly deleted
          const hasCoTrang = cleaned.some((t: Tag) => normalizeVietnamese(t.name) === 'cổ trang');
          if (!hasCoTrang && !deletedNames.has('cổ trang')) {
            cleaned.push({
              id: generateUuid(),
              name: 'Cổ trang',
              createdAt: new Date().toISOString(),
            });
          }

          this.inMemoryCache = cleaned;
          return cleaned;
        }
      }
    } catch {
      // ignore
    }

    // 4. Initial seed for empty local storage on very first run
    const seeded: Tag[] = DEFAULT_INITIAL_TAGS
      .filter((name) => !deletedNames.has(normalizeVietnamese(name)))
      .map((name) => ({
        id: generateUuid(),
        name,
        createdAt: new Date().toISOString(),
      }));

    this.inMemoryCache = seeded;
    this.saveTagsLocal(seeded);
    return seeded;
  }

  private saveTagsLocal(tags: Tag[]): void {
    try {
      this.inMemoryCache = tags;
      localStorage.setItem(STORAGE_KEY_TAGS, JSON.stringify(tags));
    } catch (e) {
      console.error('Could not save tags locally:', e);
    }
  }

  /**
   * Get character usage count for each tag
   */
  public async getTagUsageCounts(): Promise<Record<string, number>> {
    const counts: Record<string, number> = {};
    try {
      const chars = await characterRepository.getAllCharacters();
      if (Array.isArray(chars)) {
        chars.forEach((c) => {
          if (Array.isArray(c.tags)) {
            c.tags.forEach((tag: string) => {
              if (tag && typeof tag === 'string') {
                const trimmed = tag.trim();
                counts[trimmed] = (counts[trimmed] || 0) + 1;
              }
            });
          }
        });
      }
    } catch {
      // ignore
    }
    return counts;
  }

  /**
   * ADMIN ONLY: Create a new dynamic tag in Supabase `tags` table
   */
  public async createTag(name: string): Promise<Tag> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền tạo thẻ tag theo chính sách RLS.');
    }

    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Tên thẻ tag không được để trống.');
    }

    // Check duplicate in current tags
    const tags = await this.getAllTags();
    const existing = tags.find((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (existing) {
      throw new Error(`Thẻ tag "${trimmed}" đã tồn tại trong hệ thống.`);
    }

    let createdTag: Tag;

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (!supabase) {
        throw new Error('Không thể kết nối đến Supabase client.');
      }

      // Check duplicate in Supabase tags table
      const { data: existingDb } = await supabase
        .from('tags')
        .select('id, name')
        .ilike('name', trimmed)
        .maybeSingle();

      if (existingDb) {
        throw new Error(`Thẻ tag "${trimmed}" đã tồn tại trong cơ sở dữ liệu Supabase.`);
      }

      // INSERT into `tags` table
      const { data, error } = await supabase
        .from('tags')
        .insert({ name: trimmed })
        .select('id, name, created_at')
        .single();

      if (error) {
        console.error('[TagRepository] Supabase insert tag error:', error);
        throw new Error(`Lỗi tạo tag trên Supabase: ${error.message}`);
      }

      createdTag = {
        id: data.id,
        name: data.name.trim(),
        createdAt: data.created_at,
      };
    } else {
      // Local fallback
      createdTag = {
        id: generateUuid(),
        name: trimmed,
        createdAt: new Date().toISOString(),
      };
    }

    // Remove from deleted tracking if re-creating
    this.removeDeletedTagName(trimmed);

    // Update local cache
    const updated = [...tags.filter((t) => t.id !== createdTag.id), createdTag].sort((a, b) =>
      a.name.localeCompare(b.name, 'vi')
    );
    this.saveTagsLocal(updated);

    // Notify all app components to refresh tags
    window.dispatchEvent(new CustomEvent('be_ca_tags_updated'));

    auditService.log('Tạo thẻ tag mới', 'tag', `Thẻ: "${trimmed}"`);
    return createdTag;
  }

  /**
   * ADMIN ONLY: Edit / Rename a tag and cascade update in characters
   */
  public async updateTag(id: string, newName: string): Promise<Tag> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền sửa thẻ tag.');
    }

    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Tên thẻ tag không được để trống.');
    }

    const tags = await this.getAllTags();
    const index = tags.findIndex((t) => t.id === id);
    if (index === -1) {
      throw new Error('Không tìm thấy thẻ tag cần chỉnh sửa.');
    }

    const oldName = tags[index].name;
    const duplicate = tags.find((t) => t.id !== id && t.name.trim().toLowerCase() === trimmed.toLowerCase());
    if (duplicate) {
      throw new Error(`Thẻ tag "${trimmed}" đã tồn tại trong hệ thống.`);
    }

    let updatedTag: Tag = {
      ...tags[index],
      name: trimmed,
    };

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        const { data, error } = await supabase
          .from('tags')
          .update({ name: trimmed })
          .eq('id', id)
          .select('id, name, created_at')
          .single();

        if (error) {
          throw new Error(`Lỗi cập nhật tên tag trên Supabase: ${error.message}`);
        }

        updatedTag = {
          id: data.id,
          name: data.name.trim(),
          createdAt: data.created_at,
        };
      }
    }

    // Cascade update all characters that have oldName in their tags array
    let affectedCount = 0;
    try {
      affectedCount = await characterRepository.renameTagInAllCharacters(oldName, trimmed);
    } catch (e) {
      console.error('Error cascading tag update to characters:', e);
    }

    tags[index] = updatedTag;
    tags.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
    this.saveTagsLocal(tags);

    window.dispatchEvent(new CustomEvent('be_ca_tags_updated'));
    window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));

    auditService.log('Đổi tên thẻ tag', 'tag', `Từ "${oldName}" thành "${trimmed}" (${affectedCount} nhân vật cập nhật)`);
    return updatedTag;
  }

  /**
   * ADMIN ONLY: Delete a tag from Supabase `tags` table and cascade clean relations in `character_tags`
   */
  public async deleteTag(id: string): Promise<{ success: boolean; affectedCount: number; tagName: string }> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền xóa thẻ tag.');
    }

    const tags = await this.getAllTags();
    const target = tags.find((t) => t.id === id || t.name.trim().toLowerCase() === id.trim().toLowerCase());
    if (!target) {
      throw new Error('Không tìm thấy thẻ tag cần xóa.');
    }

    let affectedCount = 0;

    // 1. Supabase Database Mutations:
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        // 1.1 Delete junction records from character_tags
        const { error: relError } = await supabase
          .from('character_tags')
          .delete()
          .eq('tag_id', target.id);

        if (relError) {
          console.warn('[TagRepository] Notice deleting from character_tags:', relError.message);
        }

        // 1.2 Delete tag row from tags table
        const { error: tagError } = await supabase
          .from('tags')
          .delete()
          .eq('id', target.id);

        if (tagError) {
          console.error('[TagRepository] Supabase delete tag error:', tagError);
          throw new Error(`Lỗi khi xóa tag trên Supabase: ${tagError.message}`);
        }

        // 1.3 Sync characters table: remove tag name from characters.tags text[] array
        try {
          const { data: chars, error: fetchCharsErr } = await supabase
            .from('characters')
            .select('id, tags');

          if (!fetchCharsErr && Array.isArray(chars)) {
            for (const char of chars) {
              if (
                Array.isArray(char.tags) &&
                char.tags.some((t: string) => t && t.trim().toLowerCase() === target.name.trim().toLowerCase())
              ) {
                const updatedTags = char.tags.filter(
                  (t: string) => t && t.trim().toLowerCase() !== target.name.trim().toLowerCase()
                );
                await supabase
                  .from('characters')
                  .update({ tags: updatedTags, updated_at: new Date().toISOString() })
                  .eq('id', char.id);
                affectedCount++;
              }
            }
          }
        } catch (charErr) {
          console.warn('[TagRepository] Error cascading tag delete to Supabase characters:', charErr);
        }
      }
    }

    // 2. Local State & Cache Mutations:
    // Mark as deleted so local seed never resurrects this tag
    this.addDeletedTagName(target.name);

    const filtered = tags.filter((t) => t.id !== target.id && t.name.toLowerCase() !== target.name.toLowerCase());
    this.saveTagsLocal(filtered);

    // Cascade remove from local character catalog
    try {
      const localAffected = await characterRepository.removeTagFromAllCharacters(target.name, target.id);
      affectedCount = Math.max(affectedCount, localAffected);
    } catch (e) {
      console.error('Error cascading tag deletion to local characters:', e);
    }

    // 3. Global notification to re-render UI everywhere
    window.dispatchEvent(new CustomEvent('be_ca_tags_updated'));
    window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));

    auditService.log(
      'Xóa thẻ tag',
      'tag',
      `Đã xóa thẻ: "${target.name}" và loại bỏ khỏi ${affectedCount} nhân vật trong Bể Cá`
    );

    return {
      success: true,
      affectedCount,
      tagName: target.name,
    };
  }

  /**
   * ADMIN ONLY: Get list of characters having a specific tag
   */
  public async getCharactersByTag(tagNameOrId: string): Promise<any[]> {
    try {
      const chars = await characterRepository.getAllCharacters();
      if (!Array.isArray(chars)) return [];
      const normTarget = normalizeVietnamese(tagNameOrId);
      return chars.filter(
        (c) =>
          Array.isArray(c.tags) &&
          c.tags.some(
            (t: string) =>
              typeof t === 'string' &&
              (t === tagNameOrId || normalizeVietnamese(t) === normTarget)
          )
      );
    } catch {
      return [];
    }
  }

  /**
   * Fetch tag IDs assigned to a character directly from junction table character_tags
   */
  public async getCharacterTagIds(characterId: string): Promise<string[]> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('character_tags')
            .select('tag_id')
            .eq('character_id', characterId);

          if (!error && Array.isArray(data)) {
            return data.map((d: any) => String(d.tag_id)).filter(Boolean);
          }
        } catch (err) {
          console.warn('[TagRepository] Error fetching character_tags:', err);
        }
      }
    }
    return [];
  }

  /**
   * ADMIN ONLY: Attach or remove tag for a character
   */
  public async toggleTagForCharacter(
    characterId: string,
    tagNameOrId: string,
    shouldAttach: boolean
  ): Promise<void> {
    if (!musicService.isAdminUser()) {
      throw new Error('Từ chối quyền truy cập: Chỉ Quản trị viên (Admin) mới có quyền gán hoặc gỡ thẻ tag.');
    }

    const normTarget = normalizeVietnamese(tagNameOrId);
    const tags = await this.getAllTags();
    const matchedTag = tags.find(
      (t) => t.id === tagNameOrId || normalizeVietnamese(t.name) === normTarget
    );

    // 1. Update local catalog
    const characters = characterRepository.loadCatalog();
    const char = characters.find((c) => c.id === characterId);
    if (!char) throw new Error('Không tìm thấy nhân vật.');

    const currentTags: string[] = Array.isArray(char.tags) ? [...char.tags] : [];
    const tagName = matchedTag ? matchedTag.name : tagNameOrId.trim();
    let nextTags: string[];

    if (shouldAttach) {
      const alreadyHas = currentTags.some((t) => normalizeVietnamese(t) === normalizeVietnamese(tagName));
      if (!alreadyHas) {
        nextTags = [...currentTags, tagName];
      } else {
        nextTags = currentTags;
      }
    } else {
      nextTags = currentTags.filter((t) => normalizeVietnamese(t) !== normalizeVietnamese(tagName));
    }

    char.tags = nextTags;
    char.updatedAt = new Date().toISOString();
    characterRepository.saveCatalog(characters);

    // 2. Sync with Supabase character_tags junction table and characters table
    if (isSupabaseConfigured() && matchedTag) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          if (shouldAttach) {
            const { error: insErr } = await supabase
              .from('character_tags')
              .upsert({ character_id: characterId, tag_id: matchedTag.id });
            if (insErr) {
              console.error('[TagRepository] Supabase insert character_tags error:', insErr);
              throw new Error(`Lỗi gán thẻ nhân vật (Supabase): ${insErr.message}`);
            }
          } else {
            const { error: delErr } = await supabase
              .from('character_tags')
              .delete()
              .eq('character_id', characterId)
              .eq('tag_id', matchedTag.id);
            if (delErr) {
              console.error('[TagRepository] Supabase delete character_tags error:', delErr);
              throw new Error(`Lỗi gỡ thẻ nhân vật (Supabase): ${delErr.message}`);
            }
          }

          const { error: charErr } = await supabase
            .from('characters')
            .update({ tags: nextTags, updated_at: new Date().toISOString() })
            .eq('id', characterId);
          if (charErr) {
            console.warn('[TagRepository] Notice updating characters.tags:', charErr.message);
          }
        } catch (err: any) {
          console.error('[TagRepository] Supabase toggleTagForCharacter sync error:', err);
          throw err;
        }
      }
    }

    window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));
    window.dispatchEvent(new CustomEvent('be_ca_tags_updated'));

    auditService.log(
      shouldAttach ? 'Gắn thẻ cho nhân vật' : 'Bỏ thẻ khỏi nhân vật',
      'tag',
      `Nhân vật "${char.name}": ${shouldAttach ? `+ "${tagName}"` : `- "${tagName}"`}`
    );
  }

  /**
   * Direct sync of character tags into Supabase junction table `character_tags` using tag.id
   * (Strict adherence to requirement: UI uses tag.id to insert into character_tags.tag_id)
   */
  public async syncCharacterTagsByIds(
    characterId: string,
    tagIds: string[],
    tagNames?: string[]
  ): Promise<void> {
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          // Clear existing junction records for this character
          const { error: delError } = await supabase
            .from('character_tags')
            .delete()
            .eq('character_id', characterId);

          if (delError) {
            console.error('[TagRepository] Supabase delete character_tags error:', delError);
            throw new Error(`Lỗi cập nhật thẻ nhân vật (xóa liên kết cũ): ${delError.message}`);
          }

          // Insert new junction records using tag_id directly
          if (tagIds.length > 0) {
            const junctionEntries = tagIds.map((tagId) => ({
              character_id: characterId,
              tag_id: tagId,
            }));

            const { error: insError } = await supabase
              .from('character_tags')
              .insert(junctionEntries);

            if (insError) {
              console.error('[TagRepository] Supabase insert character_tags error:', insError);
              throw new Error(`Lỗi gán thẻ nhân vật (thêm liên kết mới): ${insError.message}`);
            }
          }

          // Synchronize tags array in characters table for fast indexing
          if (tagNames) {
            const { error: charErr } = await supabase
              .from('characters')
              .update({ tags: tagNames, updated_at: new Date().toISOString() })
              .eq('id', characterId);
            if (charErr) {
              console.warn('[TagRepository] Notice updating characters.tags:', charErr.message);
            }
          }
        } catch (err: any) {
          console.error('[TagRepository] Exception in syncCharacterTagsByIds:', err);
          throw err;
        }
      }
    }

    // Keep local character catalog in sync
    if (tagNames) {
      const catalog = characterRepository.loadCatalog();
      const char = catalog.find((c) => c.id === characterId);
      if (char) {
        char.tags = tagNames;
        char.updatedAt = new Date().toISOString();
        characterRepository.saveCatalog(catalog);
      }
    }

    window.dispatchEvent(new CustomEvent('be_ca_catalog_updated'));
    window.dispatchEvent(new CustomEvent('be_ca_tags_updated'));
  }

  /**
   * Sync character tags into Supabase junction table `character_tags` (maps tagNames to tagIds)
   */
  public async syncCharacterTagsForCharacter(characterId: string, tagNames: string[]): Promise<void> {
    const allTags = await this.getAllTags();
    const tagIds: string[] = [];
    tagNames.forEach((tName) => {
      const norm = normalizeVietnamese(tName);
      const found = allTags.find(
        (t) => t.id === tName || normalizeVietnamese(t.name) === norm
      );
      if (found && !tagIds.includes(found.id)) {
        tagIds.push(found.id);
      }
    });
    await this.syncCharacterTagsByIds(characterId, tagIds, tagNames);
  }
}

export const tagRepository = new TagRepository();

