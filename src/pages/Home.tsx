import React from 'react';
import { Character, PageView } from '../types';
import { 
  Sparkles, 
  ArrowRight,
  Fish,
  Star,
  Compass
} from 'lucide-react';

interface HomeProps {
  characters: Character[];
  onNavigate: (page: PageView) => void;
}

export const Home: React.FC<HomeProps> = ({
  characters,
  onNavigate,
}) => {
  const totalCount = characters.length;
  const unlockedCount = characters.filter((c) => !Boolean(c.isLocked ?? c.locked)).length;
  const petsCount = characters.filter((c) => Boolean(c.isPet ?? c.pet)).length;
  const lockedCount = characters.filter((c) => Boolean(c.isLocked ?? c.locked)).length;

  return (
    <div id="page-mat-nuoc" className="space-y-8 pb-12 animate-fadeIn">
      {/* Top Welcome Section */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-cyan-800 text-xs tracking-widest uppercase font-mono font-medium">
          <span>🫧</span>
          <span>MẶT NƯỚC</span>
        </div>
        <h1 
          className="text-3xl sm:text-4xl lg:text-5xl font-bold text-[#0a2540] tracking-wide"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Welcome
        </h1>
      </div>

      {/* Large Aquarium-Inspired Hero Area */}
      <div 
        id="aquarium-hero-tank"
        className="relative rounded-3xl overflow-hidden glass-panel border border-white/95 p-6 sm:p-10 shadow-[0_12px_40px_rgba(8,145,178,0.12)] bg-white/80"
      >
        {/* Internal Aquarium Ambient Lighting */}
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-50/70 via-sky-50/40 to-white/80 pointer-events-none" />
        <div className="absolute top-0 right-1/4 w-80 h-80 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

        {/* Hero Content */}
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4">
            {/* Exactly: "Hệ sinh thái" */}
            <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-cyan-100/90 border border-cyan-200 text-cyan-950 text-xs font-mono font-semibold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
              <span>Hệ sinh thái</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-semibold text-[#0a2540] leading-tight">
              Bể kính trong suốt, từng cá nhỏ bơi lội tự do
            </h2>

            <p className="text-xs sm:text-sm text-[#1e466e] leading-relaxed font-light">
              Mỗi nhân vật được lưu giữ như một cá thể sống động bên trong bể. Bạn có thể tự do mở rộng đàn cá, khám phá các nhân vật ẩn sâu dưới làn nước và đánh dấu những cá cưng mà mình trân quý nhất.
            </p>

            <div className="pt-2 flex flex-wrap gap-3">
              <button
                onClick={() => onNavigate('library')}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white text-xs sm:text-sm font-medium transition-all shadow-[0_4px_16px_rgba(6,182,212,0.3)] flex items-center gap-2 cursor-pointer active:scale-95"
              >
                <span>Duyệt Đàn Cá</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => onNavigate('favorites')}
                className="px-5 py-2.5 rounded-xl bg-white/90 hover:bg-white dark:bg-[#12283f] dark:hover:bg-[#193654] border border-slate-200 dark:border-slate-700 text-[#0c3559] dark:text-cyan-200 text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
              >
                <span>Xem Cá Cưng</span>
              </button>
            </div>
          </div>

          {/* Statistics Grid */}
          <div className="lg:col-span-5 grid grid-cols-2 gap-3 sm:gap-4">
            {/* Stat 1: Total Characters */}
            <div className="glass-panel-subtle rounded-2xl p-4 sm:p-5 border border-cyan-100 bg-white/80 hover:border-cyan-300 transition-colors shadow-2xs">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-xs font-mono uppercase tracking-wider font-medium">Tổng Đàn</span>
                <Fish className="w-4 h-4 text-cyan-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-[#0a2540] font-mono">
                {totalCount}
              </div>
              <span className="text-[11px] text-[#2c5379] font-light">
                Nhân vật lưu trữ
              </span>
            </div>

            {/* Stat 2: Unlocked */}
            <div className="glass-panel-subtle rounded-2xl p-4 sm:p-5 border border-teal-100 bg-white/80 hover:border-teal-300 transition-colors shadow-2xs">
              <div className="flex items-center justify-between text-teal-700 mb-2">
                <span className="text-xs font-mono uppercase tracking-wider font-medium">Đã Mở</span>
                <Sparkles className="w-4 h-4 text-teal-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-teal-900 font-mono">
                {unlockedCount}
              </div>
              <span className="text-[11px] text-teal-800/80 font-light">
                Tự do bơi lội
              </span>
            </div>

            {/* Stat 3: Favorites */}
            <div className="glass-panel-subtle rounded-2xl p-4 sm:p-5 border border-amber-100 bg-white/80 hover:border-amber-300 transition-colors shadow-2xs">
              <div className="flex items-center justify-between text-amber-700 mb-2">
                <span className="text-xs font-mono uppercase tracking-wider font-medium">Cá Cưng</span>
                <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-amber-900 font-mono">
                {petsCount}
              </div>
              <span className="text-[11px] text-amber-800/80 font-light">
                Đang có {petsCount} cá cưng
              </span>
            </div>

            {/* Stat 4: Locked */}
            <div className="glass-panel-subtle rounded-2xl p-4 sm:p-5 border border-sky-100 bg-white/80 hover:border-sky-300 transition-colors shadow-2xs">
              <div className="flex items-center justify-between text-sky-700 mb-2">
                <span className="text-xs font-mono uppercase tracking-wider font-medium">Chưa Mở</span>
                <Compass className="w-4 h-4 text-sky-600" />
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-sky-950 font-mono">
                {lockedCount}
              </div>
              <span className="text-[11px] text-sky-800/80 font-light">
                Chờ đánh thức
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

