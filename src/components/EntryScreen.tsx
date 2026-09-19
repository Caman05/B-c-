import React, { useState } from 'react';
import { Volume2, VolumeX, Waves, Sparkles } from 'lucide-react';
import { synthEngine } from '../utils/audioSynth';

interface EntryScreenProps {
  onEnter: (enableAudio: boolean) => void;
}

export const EntryScreen: React.FC<EntryScreenProps> = ({ onEnter }) => {
  const [enableSound, setEnableSound] = useState(true);
  const [isEntering, setIsEntering] = useState(false);

  const handleEnterClick = () => {
    // Prime Web Audio context immediately inside direct user gesture
    if (enableSound) {
      try {
        synthEngine.init();
      } catch {
        // ignore
      }
    }
    setIsEntering(true);
    setTimeout(() => {
      onEnter(enableSound);
    }, 450);
  };

  return (
    <div 
      id="entry-screen-container"
      className={`relative z-20 min-h-screen flex flex-col items-center justify-center px-6 transition-all duration-700 ${
        isEntering ? 'opacity-0 scale-105 pointer-events-none' : 'opacity-100 scale-100'
      }`}
    >
      {/* Sunlight beam radiating down behind logo */}
      <div className="absolute -top-10 w-80 h-80 md:w-[28rem] md:h-[28rem] rounded-full bg-radial from-white/70 via-cyan-200/40 to-transparent blur-3xl pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center text-center max-w-lg mx-auto">
        {/* Logo Motif: Bright Sunlit Glass Aquarium with playful fish & bubbles */}
        <div className="relative mb-6 group">
          <div className="w-20 h-20 md:w-24 md:h-24 rounded-2xl glass-panel flex items-center justify-center shadow-[0_8px_30px_rgba(6,182,212,0.25)] border-2 border-white/90 transition-transform duration-500 group-hover:scale-105 bg-white/70">
            <svg
              className="w-12 h-12 text-cyan-600 drop-shadow-[0_2px_8px_rgba(6,182,212,0.3)]"
              viewBox="0 0 48 48"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              {/* Stylized rounded aquarium container */}
              <rect x="6" y="8" width="36" height="32" rx="8" stroke="currentColor" strokeWidth="2.2" strokeOpacity="0.85" />
              {/* Surface water curve */}
              <path d="M7 17C12 15 17 19 23 17C29 15 35 19 41 17" stroke="#0284c7" strokeWidth="1.8" strokeOpacity="0.6" />
              {/* Cheerful floating tropical fish */}
              <path
                d="M31 27C27 29 20 29 16 26C13 24 11 25 9 27C10 24 10 21 9 18C11 20 13 21 16 19C20 16 27 16 31 18C33 19 36 21 39 20C38 23 38 24 39 27C36 26 33 26 31 27Z"
                fill="#0284c7"
                fillOpacity="0.9"
              />
              {/* Floating bubbles */}
              <circle cx="28" cy="12" r="2.4" fill="#38bdf8" fillOpacity="0.9" />
              <circle cx="34" cy="10" r="1.6" fill="#0ea5e9" fillOpacity="0.8" />
            </svg>
          </div>
          <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-cyan-500 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
          </span>
        </div>

        {/* 1. Main Title: BỂ CÁ */}
        <h1 
          id="entry-brand-title" 
          className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-[0.25em] text-[#0a2540] drop-shadow-[0_2px_12px_rgba(6,182,212,0.25)] uppercase select-none"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          BỂ CÁ
        </h1>

        {/* 2. Directly underneath: 🫧 Bọt nước sủi sùng sục! 🫧 */}
        <div className="mt-3 animate-bubbly">
          <span className="inline-flex items-center gap-1.5 px-4 py-1 rounded-full bg-white/70 border border-cyan-200/80 shadow-[0_2px_10px_rgba(6,182,212,0.12)] text-[#0c4a6e] font-medium text-sm sm:text-base tracking-wide backdrop-blur-md">
            🫧 Bọt nước sủi sùng sục! 🫧
          </span>
        </div>

        {/* 3. [ ENTER THE AQUARIUM ] */}
        <div className="mt-8 flex flex-col items-center gap-4 w-full">
          <button
            id="enter-aquarium-button"
            onClick={handleEnterClick}
            className="group relative px-8 py-3.5 rounded-full overflow-hidden bg-gradient-to-r from-teal-400 via-cyan-400 to-sky-400 border border-white text-white font-semibold tracking-wider text-sm sm:text-base transition-all duration-300 shadow-[0_6px_22px_rgba(6,182,212,0.35)] hover:shadow-[0_8px_30px_rgba(6,182,212,0.5)] hover:scale-[1.02] cursor-pointer active:scale-98"
          >
            <span className="relative z-10 flex items-center justify-center gap-2 drop-shadow-sm">
              <Waves className="w-4 h-4 transition-transform duration-300 group-hover:rotate-12" />
              <span>VÀO BỂ</span>
              <Sparkles className="w-4 h-4 transition-transform duration-300 group-hover:scale-125" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-white/20 via-transparent to-white/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          </button>

          {/* Audio Preference Option */}
          <button
            id="toggle-ambient-audio"
            type="button"
            onClick={() => setEnableSound(!enableSound)}
            className="flex items-center gap-2 text-xs text-[#1e4e79] hover:text-[#0a2540] transition-colors py-1.5 px-3.5 rounded-full bg-white/50 hover:bg-white/80 border border-white/60 shadow-xs cursor-pointer backdrop-blur-sm"
          >
            {enableSound ? (
              <>
                <Volume2 className="w-3.5 h-3.5 text-cyan-600" />
                <span>Âm hưởng biển: BẬT (Ambient sound on)</span>
              </>
            ) : (
              <>
                <VolumeX className="w-3.5 h-3.5 text-slate-400" />
                <span>Âm hưởng biển: TẮT (Silent entry)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
