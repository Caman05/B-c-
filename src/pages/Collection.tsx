import React from 'react';
import { Character, PageView } from '../types';

interface CollectionProps {
  characters: Character[];
  onSelectCharacter?: (character: Character) => void;
  onToggleFavorite?: (id: string, e: React.MouseEvent) => void;
  onNavigate?: (page: PageView) => void;
}

export const Collection: React.FC<CollectionProps> = ({
  characters,
}) => {
  const totalCount = characters.length;
  const unlockedCount = characters.filter((c) => !Boolean(c.isLocked ?? c.locked)).length;
  const progressPercent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

  // Aquarium Level Calculation based on unlocked count
  const aquariumLevel = Math.min(5, Math.max(1, Math.floor(unlockedCount / 3) + 1));
  const levelNames = [
    'Tầng Mặt Nước Nắng Ấm',
    'Rạn San Hô Lân Tinh',
    'Thủy Vực Lam Ngọc',
    'Rạn San Hô Nhiệt Đới',
    'Thánh Địa Pha Lê Thủy Cung',
  ];
  const currentLevelName = levelNames[aquariumLevel - 1] || 'Rạn San Hô Nhiệt Đới';

  return (
    <div id="page-ran-san-ho" className="space-y-8 pb-16 animate-fadeIn">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-teal-800 text-xs tracking-widest uppercase font-mono font-medium">
          <span>🪸</span>
          <span>BỘ SƯU TẬP RẠN SAN HÔ</span>
        </div>
        <h1 
          className="text-3xl sm:text-4xl font-bold text-[#0a2540] tracking-wide"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Rạn San Hô
        </h1>
        <p className="text-sm text-[#19436b] font-light">
          Nơi những nhân vật đã được đánh thức cùng nhau cư ngụ giữa rạn san hô nhiệt đới đầy ánh nắng.
        </p>
      </div>

      {/* Water Level Collection Progress Card */}
      <div className="relative rounded-3xl overflow-hidden glass-panel border border-white/95 p-6 sm:p-8 shadow-[0_10px_35px_rgba(8,145,178,0.1)] bg-white/85">
        {/* Ambient Reef Lighting */}
        <div className="absolute top-0 right-0 w-96 h-64 bg-teal-200/25 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg sm:text-xl font-semibold text-[#0a2540] tracking-wide">
                  Mức Độ Khám Phá Thủy Vực
                </h3>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-900 border border-teal-200 font-mono font-semibold">
                  {progressPercent}% Hoàn Thành
                </span>
              </div>
              <p className="text-xs sm:text-sm text-[#27537b] font-light mt-1 font-mono">
                {unlockedCount} / {totalCount} nhân vật đã khám phá • Cấp bể {aquariumLevel} ({currentLevelName})
              </p>
            </div>

            {/* Quick Stat Badges */}
            <div className="flex items-center gap-2">
              <div className="px-3.5 py-2 rounded-xl bg-white/90 border border-slate-200 text-right shadow-2xs">
                <span className="text-[10px] text-slate-500 uppercase tracking-wider block font-medium">Chưa mở</span>
                <span className="text-sm font-mono font-bold text-[#0a2540]">
                  {totalCount - unlockedCount} nhân vật
                </span>
              </div>
            </div>
          </div>

          {/* Water-Level Themed Progress Bar */}
          <div className="relative">
            <div className="h-4 sm:h-5 w-full bg-sky-100/80 rounded-full overflow-hidden p-0.5 border border-cyan-200 shadow-inner">
              <div 
                className="h-full rounded-full bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 transition-all duration-1000 shadow-[0_0_12px_rgba(6,182,212,0.35)] relative overflow-hidden"
                style={{ width: `${progressPercent}%` }}
              >
                {/* Surface ripple shine inside progress */}
                <div className="absolute inset-0 bg-gradient-to-t from-transparent via-white/40 to-transparent opacity-70" />
              </div>
            </div>

            {/* Markers along bar */}
            <div className="flex justify-between text-[10px] font-mono text-cyan-800 mt-1.5 px-1 font-medium">
              <span>0% Khởi nguồn</span>
              <span>50% Vực trung</span>
              <span>100% Trọn vẹn Bể Cá</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

