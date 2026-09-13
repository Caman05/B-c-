import { useState, useEffect, useMemo, useCallback } from 'react';
import { Character } from '../types';
import { 
  filterService, 
  CharacterStatusFilter, 
  TagMatchMode, 
  CharacterSortOption,
  CharacterFilterCriteria
} from '../services/filterService';

export interface UseCharacterFilterOptions {
  defaultStatus?: CharacterStatusFilter;
  disableStatusFilter?: boolean;
}

export function useCharacterFilter(
  characters: Character[],
  options?: UseCharacterFilterOptions
) {
  const defaultStatus = options?.defaultStatus || 'all';

  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<CharacterStatusFilter>(defaultStatus);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [tagMatchMode, setTagMatchMode] = useState<TagMatchMode>('any');
  const [sortBy, setSortBy] = useState<CharacterSortOption>('newest');
  const [availableTags, setAvailableTags] = useState<string[]>([]);

  // Dynamically load available tags from database/repository
  const refreshTags = useCallback(async () => {
    const tags = await filterService.getDynamicTags();
    setAvailableTags(tags);
    setSelectedTags((prev) => prev.filter((t) => tags.includes(t)));
  }, []);

  useEffect(() => {
    refreshTags();
  }, [refreshTags]);

  // Listen for admin tag updates or catalog updates
  useEffect(() => {
    const handleTagChange = () => {
      refreshTags();
    };
    window.addEventListener('be_ca_tags_updated', handleTagChange);
    window.addEventListener('be_ca_catalog_updated', handleTagChange);
    return () => {
      window.removeEventListener('be_ca_tags_updated', handleTagChange);
      window.removeEventListener('be_ca_catalog_updated', handleTagChange);
    };
  }, [refreshTags]);

  // Toggle single tag selection
  const toggleTag = useCallback((tagName: string) => {
    setSelectedTags((prev) => {
      if (prev.includes(tagName)) {
        return prev.filter((t) => t !== tagName);
      }
      return [...prev, tagName];
    });
  }, []);

  // Clear all selected tags
  const clearTags = useCallback(() => {
    setSelectedTags([]);
  }, []);

  // Reset all filters to initial state
  const resetFilters = useCallback(() => {
    setSearchQuery('');
    setStatusFilter(defaultStatus);
    setSelectedTags([]);
  }, [defaultStatus]);

  // Determine if any filter is currently applied
  const isFiltered = useMemo(() => {
    const hasSearch = searchQuery.trim().length > 0;
    const hasStatus = statusFilter !== defaultStatus;
    const hasTags = selectedTags.length > 0;
    return hasSearch || hasStatus || hasTags;
  }, [searchQuery, statusFilter, defaultStatus, selectedTags]);

  // Perform memoized filtering and sorting
  const filteredCharacters = useMemo(() => {
    const criteria: CharacterFilterCriteria = {
      searchQuery,
      status: options?.disableStatusFilter ? 'all' : statusFilter,
      selectedTags,
      tagMatchMode,
      sortBy,
    };
    return filterService.filterCharacters(characters, criteria);
  }, [characters, searchQuery, statusFilter, selectedTags, tagMatchMode, sortBy, options?.disableStatusFilter]);

  // Real-time counts for status badges
  const unlockedCount = useMemo(() => {
    return characters.filter((c) => {
      return c.isUnlocked !== undefined ? c.isUnlocked : !Boolean(c.isLocked ?? c.locked);
    }).length;
  }, [characters]);

  const lockedCount = useMemo(() => {
    return characters.length - unlockedCount;
  }, [characters.length, unlockedCount]);

  return {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    selectedTags,
    setSelectedTags,
    toggleTag,
    clearTags,
    tagMatchMode,
    setTagMatchMode,
    sortBy,
    setSortBy,
    availableTags,
    filteredCharacters,
    resetFilters,
    isFiltered,
    totalCount: characters.length,
    filteredCount: filteredCharacters.length,
    unlockedCount,
    lockedCount,
  };
}
