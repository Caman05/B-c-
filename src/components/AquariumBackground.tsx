import React, { useMemo } from 'react';

export const AquariumBackground: React.FC = () => {
  // Precompute random parameters for calm rising bubbles
  const bubbles = useMemo(() => {
    return Array.from({ length: 22 }).map((_, i) => ({
      id: i,
      size: Math.floor(5 + Math.random() * 14),
      left: Math.floor(2 + Math.random() * 96),
      duration: Math.floor(16 + Math.random() * 20),
      delay: Math.floor(Math.random() * 14),
      opacity: 0.4 + Math.random() * 0.4,
    }));
  }, []);

  // Precompute small floating luminous water particles
  const particles = useMemo(() => {
    return Array.from({ length: 15 }).map((_, i) => ({
      id: i,
      size: Math.floor(2 + Math.random() * 4),
      left: Math.floor(5 + Math.random() * 90),
      top: Math.floor(10 + Math.random() * 80),
      duration: Math.floor(12 + Math.random() * 16),
      delay: Math.floor(Math.random() * 10),
    }));
  }, []);

  return (
    <div 
      id="aquarium-background-container" 
      className="fixed inset-0 pointer-events-none overflow-hidden z-0 select-none"
      aria-hidden="true"
    >
      {/* 1. Clear Daytime / Nocturnal Tropical Ocean Gradient Base */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#def6fe] via-[#b6effe] via-60%-[#7dd3fc] to-[#38bdf8] dark:from-[#030d17] dark:via-[#061726] dark:via-60%-[#092036] dark:to-[#0c2b48] transition-colors duration-500" />

      {/* Sunlit / Moonlit top glow & ambient water illumination */}
      <div className="absolute -top-[15%] left-1/3 w-[70vw] h-[55vh] rounded-full bg-radial from-white/60 via-cyan-200/40 to-transparent dark:from-cyan-300/15 dark:via-sky-500/10 dark:to-transparent blur-3xl pointer-events-none transition-all duration-500" />
      <div className="absolute top-1/4 -left-[10%] w-[50vw] h-[50vh] rounded-full bg-radial from-teal-200/35 via-sky-200/20 to-transparent dark:from-teal-400/15 dark:via-sky-900/20 dark:to-transparent blur-3xl pointer-events-none transition-all duration-500" />
      <div className="absolute top-1/3 -right-[10%] w-[55vw] h-[50vh] rounded-full bg-radial from-sky-300/30 via-cyan-100/20 to-transparent dark:from-sky-400/15 dark:via-cyan-900/15 dark:to-transparent blur-3xl pointer-events-none transition-all duration-500" />

      {/* 2. Sunlight / Moonlight Caustic Rays */}
      <div className="absolute inset-0 caustics-layer opacity-45 dark:opacity-20 mix-blend-screen pointer-events-none transition-opacity duration-500">
        <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <defs>
            <linearGradient id="sunBeam1" x1="0%" y1="0%" x2="35%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.8" />
              <stop offset="40%" stopColor="#a5f3fc" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sunBeam2" x1="100%" y1="0%" x2="65%" y2="100%">
              <stop offset="0%" stopColor="#fef08a" stopOpacity="0.65" />
              <stop offset="35%" stopColor="#bae6fd" stopOpacity="0.35" />
              <stop offset="100%" stopColor="#0284c7" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="sunBeam3" x1="45%" y1="0%" x2="60%" y2="100%">
              <stop offset="0%" stopColor="#ffffff" stopOpacity="0.7" />
              <stop offset="45%" stopColor="#99f6e4" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0" />
            </linearGradient>
          </defs>
          <polygon points="140,0 290,0 520,1000 280,1000" fill="url(#sunBeam1)" />
          <polygon points="560,0 720,0 980,1000 700,1000" fill="url(#sunBeam2)" />
          <polygon points="1020,0 1200,0 1520,1000 1180,1000" fill="url(#sunBeam3)" />
          <polygon points="1380,0 1520,0 1760,1000 1480,1000" fill="url(#sunBeam1)" />
        </svg>
      </div>

      {/* 3. Small Floating Sunlit Water Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <div
            key={p.id}
            className="absolute rounded-full bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.8)] animate-pulse"
            style={{
              width: `${p.size}px`,
              height: `${p.size}px`,
              left: `${p.left}%`,
              top: `${p.top}%`,
              animationDuration: `${p.duration}s`,
              animationDelay: `${p.delay}s`,
            }}
          />
        ))}
      </div>

      {/* 4. Distant Small Tropical Fish Swimming Across */}
      <div className="absolute top-[24%] animate-fish-right pointer-events-none opacity-60">
        <svg width="60" height="22" viewBox="0 0 68 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M58 12C50 18 36 21 22 17C14 14.5 6 18 0 22C3 16 3 8 0 2C6 6 14 9.5 22 7C36 3 50 6 58 12Z"
            fill="#0ea5e9"
            fillOpacity="0.75"
          />
          <path d="M58 12L68 4V20L58 12Z" fill="#0284c7" fillOpacity="0.7" />
        </svg>
      </div>

      <div className="absolute top-[54%] animate-fish-left pointer-events-none opacity-50">
        <svg width="46" height="16" viewBox="0 0 68 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M58 12C50 18 36 21 22 17C14 14.5 6 18 0 22C3 16 3 8 0 2C6 6 14 9.5 22 7C36 3 50 6 58 12Z"
            fill="#14b8a6"
            fillOpacity="0.75"
          />
          <path d="M58 12L68 4V20L58 12Z" fill="#0d9488" fillOpacity="0.7" />
        </svg>
      </div>

      {/* 5. Translucent Bubbles Rising */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {bubbles.map((b) => (
          <div
            key={b.id}
            className="bubble-particle absolute rounded-full border border-white/70 dark:border-cyan-400/50 bg-gradient-to-tr from-white/30 via-cyan-100/40 to-teal-100/50 dark:from-cyan-400/20 dark:via-teal-400/15 dark:to-sky-400/20 shadow-[0_0_10px_rgba(255,255,255,0.6),inset_0_1px_2px_rgba(255,255,255,0.8)] dark:shadow-[0_0_10px_rgba(56,189,248,0.4)]"
            style={{
              width: `${b.size}px`,
              height: `${b.size}px`,
              left: `${b.left}%`,
              animationDuration: `${b.duration}s`,
              animationDelay: `${b.delay}s`,
              opacity: b.opacity,
            }}
          />
        ))}
      </div>

      {/* 6. Soft Aquatic Plants & Subtle Coral Elements at Bottom */}
      <div className="absolute bottom-0 inset-x-0 h-44 pointer-events-none overflow-hidden opacity-45 dark:opacity-35 mix-blend-multiply dark:mix-blend-screen transition-all duration-500">
        <svg
          viewBox="0 0 1440 240"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-full object-cover object-bottom"
        >
          {/* Kelp & seagrass left */}
          <g className="sway-slow">
            <path
              d="M60 240 C45 170 85 110 65 35 C60 18 78 0 83 0 C88 25 72 105 92 175 C102 205 108 240 108 240 Z"
              fill="#0d9488"
            />
            <path
              d="M120 240 C108 185 142 125 132 55 C127 25 146 8 152 8 C152 35 132 115 152 185 C162 215 168 240 168 240 Z"
              fill="#059669"
            />
            <path
              d="M190 240 C180 195 210 140 198 80 C194 50 210 30 215 30 C215 55 200 130 215 195 C222 220 228 240 228 240 Z"
              fill="#10b981"
            />
          </g>

          {/* Soft pastel coral element center-left */}
          <g>
            <path
              d="M380 240 C375 210 365 190 355 175 C345 160 330 162 335 150 C340 138 358 145 368 160 C375 170 382 185 385 200 C390 185 400 165 412 155 C424 145 435 150 430 162 C425 174 412 180 405 195 C398 210 395 225 395 240 Z"
              fill="#f43f5e"
              fillOpacity="0.45"
            />
          </g>

          {/* Coral & seaweed right */}
          <g className="sway-reverse">
            <path
              d="M1240 240 C1230 180 1260 120 1245 45 C1240 20 1258 5 1263 5 C1268 30 1250 110 1268 180 C1276 210 1285 240 1285 240 Z"
              fill="#0d9488"
            />
            <path
              d="M1310 240 C1300 165 1335 105 1318 25 C1312 8 1330 0 1335 0 C1340 25 1322 95 1340 165 C1348 205 1360 240 1360 240 Z"
              fill="#0284c7"
            />
            <path
              d="M1380 240 C1370 185 1405 135 1392 65 C1388 35 1404 15 1408 15 C1412 45 1396 125 1412 195 C1418 220 1424 240 1424 240 Z"
              fill="#059669"
            />
          </g>
        </svg>
      </div>

      {/* Gentle sunlight / moonlight surface sheen along very top */}
      <div className="absolute top-0 inset-x-0 h-2 bg-gradient-to-r from-transparent via-white/80 dark:via-cyan-400/40 to-transparent blur-[1px]" />
    </div>
  );
};
