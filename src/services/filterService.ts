import { Character, Tag } from '../types';
import { tagRepository, OBSOLETE_TAG_NAMES, normalizeVietnamese } from './tagRepository';

export type CharacterStatusFilter = 'all' | 'unlocked' | 'locked';
export type TagMatchMode = 'any' | 'all';
export type CharacterSortOption = 'newest' | 'name';

export interface CharacterFilterCriteria {
  searchQuery: string;
  status: CharacterStatusFilter;
  selectedTags: string[];
  tagMatchMode: TagMatchMode;
  sortBy: CharacterSortOption;
}

/**
 * Remove Vietnamese accents for friendly substring matching
 */
export function removeAccents(str: string): string {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase();
}

/**
 * Checks if a character matches the search query based strictly on character.name
 */
export function matchesSearch(character: Character, rawQuery: string): boolean {
  const query = rawQuery.trim();
  if (!query) return true;

  const charName = character.name || '';
  const lowerQuery = query.toLowerCase();
  const lowerName = charName.toLowerCase();

  // Direct case-insensitive match
  if (lowerName.includes(lowerQuery)) return true;

  // Accent-insensitive match (e.g. "nguyen" matches "Nguyễn")
  if (removeAccents(lowerName).includes(removeAccents(lowerQuery))) return true;

  return false;
}

/**
 * Checks if a character matches the unlock status criteria
 * Crucial: character.isUnlocked is calculated strictly for the CURRENT USER in characterService!
 */
export function matchesStatus(character: Character, status: CharacterStatusFilter): boolean {
  if (status === 'all') return true;

  // User-specific unlock state
  const isUnlocked = character.isUnlocked !== undefined 
    ? character.isUnlocked 
    : !Boolean(character.isLocked ?? character.locked);

  if (status === 'unlocked') {
    return isUnlocked === true;
  }
  if (status === 'locked') {
    return isUnlocked === false;
  }
  return true;
}

/**
 * Checks if a character matches the selected tag criteria
 */
export function matchesTags(
  character: Character,
  selectedTags: string[],
  matchMode: TagMatchMode = 'any'
): boolean {
  if (!selectedTags || selectedTags.length === 0) return true;

  const charTags = Array.isArray(character.tags) ? character.tags : [];
  if (charTags.length === 0) return false;

  const normalizedCharTags = charTags.map((t) => normalizeVietnamese(t));

  if (matchMode === 'all') {
    // Character must contain EVERY selected tag (AND logic)
    return selectedTags.every((st) => normalizedCharTags.includes(normalizeVietnamese(st)));
  } else {
    // Character must contain AT LEAST ONE selected tag (OR logic)
    return selectedTags.some((st) => normalizedCharTags.includes(normalizeVietnamese(st)));
  }
}

/**
 * Filter and sort a character list using the unified criteria
 */
export function filterCharacters(
  characters: Character[],
  criteria: CharacterFilterCriteria
): Character[] {
  return characters
    .filter((c) => {
      // 1. Search by name
      if (!matchesSearch(c, criteria.searchQuery)) return false;

      // 2. Filter by status (all / unlocked / locked)
      if (!matchesStatus(c, criteria.status)) return false;

      // 3. Filter by dynamic tags (AND / OR)
      if (!matchesTags(c, criteria.selectedTags, criteria.tagMatchMode)) return false;

      return true;
    })
    .sort((a, b) => {
      if (criteria.sortBy === 'name') {
        return a.name.localeCompare(b.name, 'vi');
      }
      // default: newest first
      const timeA = new Date(a.createdAt).getTime() || 0;
      const timeB = new Date(b.createdAt).getTime() || 0;
      return timeB - timeA;
    });
}

/**
 * Service to fetch dynamic tags from database/repository
 */
export const filterService = {
  filterCharacters,
  matchesSearch,
  matchesStatus,
  matchesTags,

  /**
   * Loads dynamic tags directly from tagRepository (Supabase tags table / DB).
   * Returns all tags that currently exist in the tags table, sorted alphabetically.
   * Excludes any obsolete/deleted tags.
   * Any newly created tag immediately appears in "Lọc theo thẻ".
   * Any deleted tag immediately disappears from "Lọc theo thẻ".
   */
  async getDynamicTags(): Promise<string[]> {
    try {
      const storedTags = await tagRepository.getAllTags();
      if (!Array.isArray(storedTags) || storedTags.length === 0) {
        return [];
      }

      // Filter storedTags to strictly exclude any known obsolete tags
      const validStoredTags = storedTags.filter(
        (t) => t && t.name && !OBSOLETE_TAG_NAMES.includes(normalizeVietnamese(t.name))
      );

      const validNames = validStoredTags.map((t) => t.name.normalize('NFC').trim()).filter(Boolean);
      return Array.from(new Set(validNames)).sort((a, b) => a.localeCompare(b, 'vi'));
    } catch (e) {
      console.warn('[FilterService] Could not load tags from tagRepository:', e);
      return [];
    }
  },
};
