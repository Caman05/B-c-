import React from 'react';
import { Character } from '../types';
import { CharacterCard } from '../components/CharacterCard';
import { CharacterFilterBar } from '../components/CharacterFilterBar';
import { EmptyCharacterResult } from '../components/EmptyCharacterResult';
import { useCharacterFilter } from '../hooks/useCharacterFilter';

interface CharacterLibraryProps {
  characters: Character[];
  onSelectCharacter: (character: Character) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export const CharacterLibrary: React.FC<CharacterLibraryProps> = ({
  characters,
  onSelectCharacter,
  onToggleFavorite,
}) => {
  const {
    searchQuery,
    setSearchQuery,
    statusFilter,
    setStatusFilter,
    selectedTags,
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
    totalCount,
    filteredCount,
    unlockedCount,
    lockedCount,
  } = useCharacterFilter(characters);

  return (
    <div id="page-dan-ca" className="space-y-6 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-cyan-800 text-xs tracking-widest uppercase font-mono font-medium">
          <span>🐟</span>
          <span>KHO LƯU TRỮ CÁ</span>
        </div>
        <p className="text-sm text-[#19436b] font-light">
          Tìm kiếm, phân loại và ngắm nhìn các nhân vật đang bơi trong bể.
        </p>
      </div>

      {/* Unified Real-time Search & Filter Controls Bar */}
      <CharacterFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        showStatusFilter={true}
        selectedTags={selectedTags}
        onToggleTag={toggleTag}
        onClearTags={clearTags}
        tagMatchMode={tagMatchMode}
        onTagMatchModeChange={setTagMatchMode}
        availableTags={availableTags}
        sortBy={sortBy}
        onSortChange={setSortBy}
        onReset={resetFilters}
        isFiltered={isFiltered}
        totalCount={totalCount}
        filteredCount={filteredCount}
        unlockedCount={unlockedCount}
        lockedCount={lockedCount}
        placeholder="Tìm kiếm nhân vật..."
      />

      {/* Characters Result Grid: 2 cols mobile, 3 cols tablet, 4 cols desktop */}
      {filteredCharacters.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
          {filteredCharacters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              onSelect={onSelectCharacter}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <EmptyCharacterResult onReset={resetFilters} />
      )}
    </div>
  );
};
