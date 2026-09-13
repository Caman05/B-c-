import React, { useState } from 'react';
import { 
  Search, 
  X, 
  Filter, 
  ArrowUpDown, 
  RotateCcw, 
  Tag as TagIcon,
  Check,
  ChevronDown
} from 'lucide-react';
import { 
  CharacterStatusFilter, 
  TagMatchMode, 
  CharacterSortOption 
} from '../services/filterService';

interface CharacterFilterBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  statusFilter?: CharacterStatusFilter;
  onStatusChange?: (status: CharacterStatusFilter) => void;
  showStatusFilter?: boolean;
  selectedTags: string[];
  onToggleTag: (tag: string) => void;
  onClearTags?: () => void;
  tagMatchMode?: TagMatchMode;
  onTagMatchModeChange?: (mode: TagMatchMode) => void;
  availableTags: string[];
  sortBy: CharacterSortOption;
  onSortChange: (sort: CharacterSortOption) => void;
  onReset: () => void;
  isFiltered: boolean;
  totalCount: number;
  filteredCount: number;
  unlockedCount?: number;
  lockedCount?: number;
  placeholder?: string;
}

export const CharacterFilterBar: React.FC<CharacterFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  statusFilter = 'all',
  onStatusChange,
  showStatusFilter = true,
  selectedTags,
  onToggleTag,
  onClearTags,
  tagMatchMode = 'any',
  onTagMatchModeChange,
  availableTags,
  sortBy,
  onSortChange,
  onReset,
  isFiltered,
  totalCount,
  filteredCount,
  unlockedCount,
  lockedCount,
  placeholder = 'Tìm kiếm nhân vật...',
}) => {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [showAllTags, setShowAllTags] = useState(false);

  // Maximum number of visible tag chips before "Xem thêm"
  const VISIBLE_TAG_LIMIT = 10;
  const displayedTags = showAllTags ? availableTags : availableTags.slice(0, VISIBLE_TAG_LIMIT);

  // Total active filter options count
  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + selectedTags.length;

  return (
    <div 
      id="character-filter-bar"
      className="glass-panel rounded-2xl p-4 sm:p-5 border border-white/95 space-y-3 shadow-[0_8px_30px_rgba(8,145,178,0.08)] bg-white/85 transition-all"
    >
      {/* Row 1: Search Input (Luôn hiển thị) */}
      <div className="relative w-full">
        <label htmlFor="search-characters-input" className="sr-only">
          Tìm kiếm nhân vật
        </label>
        <Search 
          aria-hidden="true" 
          className="w-4 h-4 text-cyan-700 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" 
        />
        <input
          id="search-characters-input"
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white/90 border border-slate-200/90 focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 text-sm text-[#0a2540] placeholder:text-slate-400 outline-none transition-all shadow-2xs"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            aria-label="Xóa từ khóa tìm kiếm"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-0.5 rounded-md cursor-pointer transition-colors"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Row 2: "Sắp xếp" và "Bộ lọc" nằm cạnh nhau trên cùng một hàng (không xếp dọc) */}
      <div className="flex items-center justify-between gap-2.5 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {/* Sắp xếp */}
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/90 border border-slate-200/90 text-xs text-[#19436b] shadow-2xs">
            <ArrowUpDown className="w-3.5 h-3.5 text-cyan-600" />
            <label htmlFor="sort-characters-select" className="text-slate-500 font-medium whitespace-nowrap">
              Sắp xếp:
            </label>
            <select
              id="sort-characters-select"
              value={sortBy}
              onChange={(e) => onSortChange(e.target.value as CharacterSortOption)}
              className="bg-transparent text-cyan-900 font-medium outline-none cursor-pointer"
            >
              <option value="newest" className="bg-white text-slate-900">Mới thêm</option>
              <option value="name" className="bg-white text-slate-900">Tên A-Z</option>
            </select>
          </div>

          {/* Nút Bộ lọc (thu gọn với icon chevron ⌄) */}
          <button
            id="toggle-filter-panel-btn"
            type="button"
            onClick={() => setIsFilterOpen((prev) => !prev)}
            aria-expanded={isFilterOpen}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all cursor-pointer shadow-2xs active:scale-95 ${
              isFilterOpen || activeFilterCount > 0
                ? 'bg-cyan-50/90 border-cyan-300 text-cyan-900 font-semibold'
                : 'bg-white/90 border-slate-200/90 text-[#19436b] hover:bg-white hover:text-[#0a2540]'
            }`}
          >
            <Filter className="w-3.5 h-3.5 text-cyan-600" />
            <span>Bộ lọc</span>
            {activeFilterCount > 0 && (
              <span className="w-4 h-4 rounded-full bg-cyan-600 text-white text-[10px] font-mono flex items-center justify-center font-bold">
                {activeFilterCount}
              </span>
            )}
            <ChevronDown 
              className={`w-3.5 h-3.5 text-slate-500 transition-transform duration-200 ${
                isFilterOpen ? 'rotate-180' : ''
              }`} 
            />
          </button>

          {/* Reset Filter Button */}
          {isFiltered && (
            <button
              type="button"
              onClick={onReset}
              className="px-3 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200/80 text-xs text-cyan-900 font-medium flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs active:scale-95"
              title="Khôi phục trạng thái ban đầu"
            >
              <RotateCcw className="w-3.5 h-3.5 text-cyan-700" />
              <span>Đặt lại</span>
            </button>
          )}
        </div>

        {/* Counter indicator */}
        <div className="text-[11px] text-slate-500 font-mono ml-auto">
          Hiển thị: <strong className="text-cyan-800 font-semibold">{filteredCount}</strong>/{totalCount}
        </div>
      </div>

      {/* Row 3: Panel chứa Trạng thái và Lọc theo Thẻ (Chỉ hiển thị khi bấm mở "Bộ lọc") */}
      {isFilterOpen && (
        <div 
          id="collapsible-filter-panel"
          className="pt-3 border-t border-slate-200/70 space-y-3.5 animate-fadeIn"
        >
          {/* Trạng thái (If enabled) */}
          {showStatusFilter && onStatusChange && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-slate-500 mr-1 flex items-center gap-1 font-medium">
                <Filter className="w-3 h-3 text-cyan-600" />
                <span>Trạng thái:</span>
              </span>

              {[
                { id: 'all', label: 'Tất cả', count: totalCount },
                { id: 'unlocked', label: 'Đã mở khóa', count: unlockedCount ?? 0 },
                { id: 'locked', label: 'Đang khóa', count: lockedCount ?? 0 },
              ].map((item) => {
                const isActive = statusFilter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => onStatusChange(item.id as CharacterStatusFilter)}
                    className={`text-xs px-3.5 py-1.5 rounded-xl font-medium transition-all cursor-pointer flex items-center gap-1.5 ${
                      isActive
                        ? 'bg-gradient-to-r from-teal-500 to-cyan-500 text-white shadow-[0_2px_8px_rgba(6,182,212,0.35)]'
                        : 'bg-white/80 text-[#1b4369] hover:text-[#0a2540] hover:bg-white border border-slate-200/80 shadow-2xs'
                    }`}
                  >
                    <span>{item.label}</span>
                    <span className={`font-mono text-[10px] ${isActive ? 'text-cyan-100' : 'text-slate-400'}`}>
                      ({item.count})
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Lọc theo Thẻ */}
          {availableTags.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-200/60">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                  <TagIcon className="w-3 h-3 text-teal-600" />
                  <span>Lọc theo Thẻ:</span>
                  {selectedTags.length > 0 && (
                    <span className="text-[11px] font-mono px-1.5 py-0.5 rounded-md bg-teal-100 text-teal-800 ml-1">
                      Đã chọn {selectedTags.length}
                    </span>
                  )}
                </div>

                {/* Multi-tag logic selector (AND / OR) if > 1 tag selected */}
                <div className="flex items-center gap-2">
                  {selectedTags.length > 1 && onTagMatchModeChange && (
                    <div className="flex items-center bg-slate-100/90 rounded-lg p-0.5 text-[10px] font-medium text-slate-600 border border-slate-200/60">
                      <button
                        type="button"
                        onClick={() => onTagMatchModeChange('any')}
                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                          tagMatchMode === 'any'
                            ? 'bg-white text-teal-800 shadow-2xs font-semibold'
                            : 'hover:text-slate-900'
                        }`}
                      >
                        Bất kỳ (OR)
                      </button>
                      <button
                        type="button"
                        onClick={() => onTagMatchModeChange('all')}
                        className={`px-2 py-0.5 rounded-md transition-all cursor-pointer ${
                          tagMatchMode === 'all'
                            ? 'bg-white text-teal-800 shadow-2xs font-semibold'
                            : 'hover:text-slate-900'
                        }`}
                      >
                        Tất cả (AND)
                      </button>
                    </div>
                  )}

                  {selectedTags.length > 0 && onClearTags && (
                    <button
                      type="button"
                      onClick={onClearTags}
                      className="text-[11px] text-cyan-800 hover:text-cyan-950 underline underline-offset-2 transition-colors cursor-pointer"
                    >
                      Bỏ chọn thẻ
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Tag Chips */}
              <div className="flex flex-wrap items-center gap-1.5">
                {displayedTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag);
                  return (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => onToggleTag(tag)}
                      className={`text-xs px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-teal-600 text-white font-medium shadow-2xs scale-[1.02]'
                          : 'bg-white/80 text-[#254d72] hover:text-[#0a2540] hover:bg-white border border-slate-200/80 shadow-2xs'
                      }`}
                    >
                      {isSelected && <Check className="w-2.5 h-2.5 stroke-[3]" />}
                      <span>{tag}</span>
                    </button>
                  );
                })}

                {/* Toggle show more tags if many tags exist */}
                {availableTags.length > VISIBLE_TAG_LIMIT && (
                  <button
                    type="button"
                    onClick={() => setShowAllTags(!showAllTags)}
                    className="text-xs px-2 py-1 rounded-lg text-slate-500 hover:text-cyan-800 hover:bg-slate-100/80 border border-dashed border-slate-300 transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <span>{showAllTags ? 'Thu gọn' : `+${availableTags.length - VISIBLE_TAG_LIMIT} thẻ`}</span>
                    <ChevronDown className={`w-3 h-3 transition-transform ${showAllTags ? 'rotate-180' : ''}`} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
