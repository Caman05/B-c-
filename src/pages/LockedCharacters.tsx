import React, { useMemo } from 'react';
import { Character } from '../types';
import { CharacterCard } from '../components/CharacterCard';
import { Lock } from 'lucide-react';

interface LockedCharactersProps {
  characters: Character[];
  onSelectCharacter: (character: Character) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

export const LockedCharacters: React.FC<LockedCharactersProps> = ({
  characters,
  onSelectCharacter,
  onToggleFavorite,
}) => {
  // Base context: Characters currently locked for the active user
  const lockedCharacters = useMemo(() => {
    return characters.filter((c) => Boolean(c.isLocked ?? c.locked));
  }, [characters]);

  return (
    <div id="page-vuc-sau" className="space-y-6 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-sky-800 text-xs tracking-widest uppercase font-mono font-medium">
          <span>🐚</span>
          <span>KHU VỰC CHƯA KHÁM PHÁ</span>
        </div>
        <h1 
          className="text-3xl sm:text-4xl font-bold text-[#0a2540] tracking-wide"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Dưới Vực Sâu
        </h1>
        <p className="text-sm text-[#19436b] font-light">
          Những nhân vật đang ẩn mình dưới làn nước sâu, chờ đợi bạn đánh thức và đưa vào Bể Cá.
        </p>
      </div>

      {/* Info Card */}
      <div className="glass-panel rounded-2xl p-5 border border-white/95 bg-white/85 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-2xl bg-sky-100 border border-sky-300 flex items-center justify-center text-sky-700 shadow-xs flex-shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-semibold text-[#0a2540]">
              Hiện còn {lockedCharacters.length} nhân vật chưa được giải phóng
            </h3>
            <p className="text-xs text-[#285075] font-light mt-0.5">
              Chạm vào từng nhân vật để xem hướng dẫn mở khóa hoặc nhập mã giải phóng phong ấn.
            </p>
          </div>
        </div>
      </div>

      {/* Direct Locked Characters Grid (NO Search, NO Filter) */}
      {lockedCharacters.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2.5 sm:gap-4 lg:gap-6">
          {lockedCharacters.map((char) => (
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
          <div className="w-14 h-14 rounded-full bg-teal-100 border border-teal-200 mx-auto flex items-center justify-center text-teal-600 text-2xl">
            ✨
          </div>
          <h3 className="text-base font-semibold text-[#0a2540]">Thủy vực đã hoàn toàn sáng tỏ!</h3>
          <p className="text-xs text-[#2b557c] leading-relaxed font-light">
            Không còn nhân vật nào bị giam cầm dưới vực sâu. Tất cả các sinh linh hiện đang tự do bơi lội trong đàn cá Bể Cá của bạn.
          </p>
        </div>
      )}
    </div>
  );
};
