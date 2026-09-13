import React, { useMemo } from 'react';
import { Character, PageView } from '../types';
import { CharacterCard } from '../components/CharacterCard';
import { Star, ArrowRight } from 'lucide-react';

interface FavoritesProps {
  characters: Character[];
  onSelectCharacter: (character: Character) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  onNavigate: (page: PageView) => void;
}

export const Favorites: React.FC<FavoritesProps> = ({
  characters,
  onSelectCharacter,
  onToggleFavorite,
  onNavigate,
}) => {
  // Base context: Strictly user-specific Pet / Cá Cưng collection
  const petCharacters = useMemo(() => {
    return characters.filter((c) => Boolean(c.isPet ?? c.pet));
  }, [characters]);

  return (
    <div id="page-ca-cung" className="space-y-6 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-amber-800 text-xs tracking-widest uppercase font-mono font-medium">
          <span>⭐</span>
          <span>BỘ SƯU TẬP CÁ CƯNG</span>
        </div>
        <p className="text-sm text-[#19436b] font-light">
          Những nhân vật được bạn gửi gắm nhiều tình cảm và chọn làm cá cưng trong Bể Cá.
        </p>
      </div>

      {/* Hero / Summary Banner */}
      <div className="glass-panel rounded-2xl p-5 sm:p-6 border border-white/95 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white/85 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-amber-100 border border-amber-300 flex items-center justify-center text-amber-600 shadow-[0_2px_12px_rgba(251,191,36,0.3)] flex-shrink-0">
            <Star className="w-6 h-6 fill-amber-400" />
          </div>
          <div>
            <h3 className="text-base sm:text-lg font-semibold text-[#0a2540]">
              Đang có {petCharacters.length} cá cưng
            </h3>
            <p className="text-xs text-[#265077] font-light mt-0.5">
              Danh sách các nhân vật được bạn thêm vào bộ sưu tập Cá Cưng của mình.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('library')}
          className="px-4 py-2 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200 text-xs text-cyan-900 font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
        >
          <span>Tìm thêm nhân vật</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Direct Pet Characters List (NO Search, NO Filter) */}
      {petCharacters.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
          {petCharacters.map((char) => (
            <CharacterCard
              key={char.id}
              character={char}
              onSelect={onSelectCharacter}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-12 text-center max-w-md mx-auto space-y-4 border border-white/90 bg-white/85 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-amber-100 border border-amber-200 mx-auto flex items-center justify-center text-amber-500 text-2xl">
            ⭐
          </div>
          <h3 className="text-base font-semibold text-[#0a2540]">Chưa có cá cưng nào</h3>
          <p className="text-xs text-[#2b557c] leading-relaxed font-light">
            Hãy ghé thăm "Đàn Cá" và mở chi tiết nhân vật để chọn những sinh linh yêu thích làm Cá Cưng.
          </p>
          <button
            type="button"
            onClick={() => onNavigate('library')}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white text-xs font-medium transition-all shadow-xs cursor-pointer"
          >
            Đến thư viện Đàn Cá
          </button>
        </div>
      )}
    </div>
  );
};
