import React, { useState, useEffect } from 'react';
import { Character } from '../types';
import { Lock, Star } from 'lucide-react';
import { resolveCharacterImageUrl, DEFAULT_FALLBACK_AVATAR, stripDescriptionHeading } from '../lib/imageUtils';
import { storageService } from '../services/storageService';

interface CharacterCardProps {
  character: Character;
  onSelect: (character: Character) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
  variant?: 'default' | 'compact' | 'featured';
}

export const CharacterCard: React.FC<CharacterCardProps> = ({
  character,
  onSelect,
  onToggleFavorite,
}) => {
  const rawAvatar = character.avatar || character.avatarUrl;
  const [resolvedSrc, setResolvedSrc] = useState<string>(() =>
    resolveCharacterImageUrl(rawAvatar)
  );
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    setImageError(false);
    setResolvedSrc(resolveCharacterImageUrl(character.avatar || character.avatarUrl));
  }, [character.avatar, character.avatarUrl]);

  const handleImageError = async () => {
    const raw = character.avatar || character.avatarUrl;
    if (raw && !imageError) {
      const fallback = await storageService.resolveCharacterImageFallback(raw);
      if (fallback && fallback !== resolvedSrc) {
        setResolvedSrc(fallback);
        return;
      }
    }
    setImageError(true);
  };

  const isLocked = Boolean(character.isLocked ?? character.locked);
  const isFavorite = Boolean(character.isFavorite ?? character.favorite);
  const isPet = Boolean(character.isPet ?? character.pet);
  const imageSource = imageError ? DEFAULT_FALLBACK_AVATAR : resolvedSrc;
  const rawDescription = character.shortDescription || character.description || '';
  const displayDescription = stripDescriptionHeading(rawDescription);

  return (
    <div
      id={`character-card-${character.id}`}
      onClick={() => onSelect(character)}
      className={`group relative rounded-xl sm:rounded-2xl overflow-hidden glass-card cursor-pointer border border-white/90 dark:border-cyan-500/20 transition-all duration-200 select-none hover:-translate-y-1 active:scale-[0.98] ${
        isLocked ? 'opacity-90 hover:opacity-100' : ''
      }`}
    >
      {/* Sunlit / Moonlit Glass Window Light Reflection */}
      <div className="absolute inset-0 bg-gradient-to-tr from-white/20 via-transparent to-cyan-200/25 dark:from-white/5 dark:to-cyan-500/10 pointer-events-none group-hover:opacity-100 transition-opacity" />

      {/* Image Container: Consistent 1:1 Aspect Ratio with object-cover */}
      <div className="relative aspect-square w-full overflow-hidden bg-sky-100 dark:bg-[#0b1b2b]">
        <img
          src={imageSource}
          alt={isLocked ? 'Nhân vật chưa khám phá' : character.name}
          onError={handleImageError}
          className={`w-full h-full object-cover object-center transition-transform duration-500 group-hover:scale-105 ${
            isLocked ? 'filter grayscale blur-md brightness-80 contrast-110' : ''
          }`}
          loading="lazy"
          referrerPolicy="no-referrer"
        />

        {/* Soft water gradient fade at bottom of artwork */}
        <div className="absolute inset-0 bg-gradient-to-t from-white/80 dark:from-[#0f243b]/90 via-transparent to-transparent pointer-events-none" />

        {/* Pet Status Badge (top-left if unlocked and isPet) */}
        {!isLocked && isPet && (
          <div className="absolute top-1.5 left-1.5 sm:top-2.5 sm:left-2.5 z-10">
            <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md sm:rounded-full bg-amber-400 text-amber-950 font-semibold border border-amber-300 shadow-xs backdrop-blur-sm flex items-center gap-1">
              <span>🐟</span>
              <span>Cá cưng</span>
            </span>
          </div>
        )}

        {/* Floating Favorite Star Button (top-right) */}
        <div className="absolute top-1.5 right-1.5 sm:top-2.5 sm:right-2.5 z-10">
          <button
            id={`fav-btn-${character.id}`}
            type="button"
            onClick={(e) => onToggleFavorite(character.id, e)}
            className={`w-7 h-7 sm:w-8 sm:h-8 rounded-full flex items-center justify-center backdrop-blur-md border transition-all duration-200 cursor-pointer shadow-xs ${
              isFavorite
                ? 'bg-amber-400 text-amber-950 border-amber-300 shadow-[0_2px_8px_rgba(251,191,36,0.45)] scale-105'
                : 'bg-white/80 dark:bg-[#12283f]/90 border-white/95 dark:border-slate-700 text-slate-400 dark:text-slate-400 hover:text-amber-500 hover:bg-white dark:hover:bg-[#18334f]'
            }`}
            aria-label={isFavorite ? "Bỏ yêu thích" : "Thêm vào yêu thích"}
          >
            <Star className={`w-3 h-3 sm:w-3.5 sm:h-3.5 ${isFavorite ? 'fill-amber-950' : ''}`} />
          </button>
        </div>

        {/* Locked State Overlay: 🔒 ??? Chưa khám phá */}
        {isLocked && (
          <div className="absolute inset-0 flex flex-col items-center justify-center p-2 text-center z-10 bg-sky-100/60 dark:bg-slate-950/70 backdrop-blur-[2px]">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl sm:rounded-2xl glass-panel border border-cyan-300/80 dark:border-cyan-600/60 flex items-center justify-center text-cyan-700 dark:text-cyan-300 shadow-xs mb-1 bg-white/85 dark:bg-[#0f243b]">
              <Lock className="w-4 h-4 sm:w-5 sm:h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div className="text-xs sm:text-sm font-bold text-[#0a2540] dark:text-[#f0f9ff] font-mono tracking-wider">
              ???
            </div>
            <div className="text-[9px] sm:text-[10px] font-mono tracking-wider text-cyan-900 dark:text-cyan-300 uppercase font-bold flex items-center gap-1 mt-0.5">
              <span>🔒</span>
              <span>Chưa khám phá</span>
            </div>
          </div>
        )}
      </div>

      {/* Card Content Information (Compact & Breathable) */}
      <div className="p-2 sm:p-3 space-y-1 bg-white/80 dark:bg-[#0f243b] transition-colors duration-200">
        <div>
          <h3 className="font-semibold text-[#0a2540] dark:text-[#f0f9ff] tracking-wide text-xs sm:text-sm md:text-base group-hover:text-cyan-700 dark:group-hover:text-cyan-300 transition-colors truncate">
            {isLocked ? '???' : character.name}
          </h3>
        </div>

        {/* Short Description: purely the content without any "Mô tả" or "Giới thiệu" label, and omitted completely if blank */}
        {isLocked ? (
          <p className="text-[10px] sm:text-xs text-[#254b70] dark:text-slate-300 line-clamp-1 sm:line-clamp-2 leading-relaxed font-light">
            Chưa khám phá thông tin nhân vật
          </p>
        ) : displayDescription ? (
          <p className="text-[10px] sm:text-xs text-[#254b70] dark:text-slate-300 line-clamp-1 sm:line-clamp-2 leading-relaxed font-light">
            {displayDescription}
          </p>
        ) : null}

        {/* Tags / Status (clean & compact, flexible text tags) */}
        <div className="flex flex-wrap gap-1 pt-0.5">
          {isLocked ? (
            <span className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-mono">
              🔒 Đang khóa
            </span>
          ) : (
            character.tags && character.tags.length > 0 ? (
              <>
                {character.tags.slice(0, 2).map((tag, idx) => (
                  <span
                    key={idx}
                    className="text-[9px] sm:text-[10px] px-1.5 sm:px-2 py-0.5 rounded-md bg-cyan-50/90 dark:bg-cyan-950/80 border border-cyan-200/70 dark:border-cyan-700/60 text-cyan-900 dark:text-cyan-200 font-medium truncate max-w-[95px]"
                  >
                    {tag}
                  </span>
                ))}
                {character.tags.length > 2 && (
                  <span className="text-[9px] sm:text-[10px] px-1 py-0.5 rounded-md text-cyan-800/60 dark:text-cyan-300/70 font-mono">
                    +{character.tags.length - 2}
                  </span>
                )}
              </>
            ) : null
          )}
        </div>
      </div>
    </div>
  );
};
