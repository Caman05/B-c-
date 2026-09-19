import React, { useState, useEffect, useRef } from 'react';
import { Track } from '../types';
import { musicService } from '../services/musicService';
import { storageService } from '../services/storageService';
import { synthEngine } from '../utils/audioSynth';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Volume2, 
  VolumeX, 
  X,
  ListMusic,
  AlertCircle,
  Loader2,
  Shuffle
} from 'lucide-react';

interface MusicPlayerProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
}

// Custom polished seashell SVG icon fitting the BỂ CÁ aesthetic
const SeashellIcon: React.FC<{ isPlaying: boolean; className?: string }> = ({ isPlaying, className = "w-6 h-6 sm:w-7 sm:h-7" }) => {
  return (
    <svg 
      className={`${className} transition-transform duration-300 ${isPlaying ? 'scale-105' : 'scale-100'}`}
      viewBox="0 0 48 48" 
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        {/* Soft Pearlescent Shell Gradients */}
        <linearGradient id="shellBody" x1="24" y1="6" x2="24" y2="42" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="25%" stopColor="#e0f7fe" />
          <stop offset="65%" stopColor="#bae6fd" />
          <stop offset="100%" stopColor="#7dd3fc" />
        </linearGradient>
        <linearGradient id="shellRidge" x1="12" y1="10" x2="36" y2="38" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.8" />
          <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#0284c7" stopOpacity="0.7" />
        </linearGradient>
        <linearGradient id="pearlShine" x1="24" y1="34" x2="24" y2="40" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fef08a" />
          <stop offset="100%" stopColor="#f59e0b" />
        </linearGradient>
      </defs>

      {/* Main Scallop Fan Outline */}
      <path 
        d="M24 40C14 40 8 32 6 22C4.5 14 11 8 16 7C18.5 6.5 21.5 6 24 6C26.5 6 29.5 6.5 32 7C37 8 43.5 14 42 22C40 32 34 40 24 40Z" 
        fill="url(#shellBody)"
        stroke="#38bdf8"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />

      {/* Scalloped top ridges */}
      <path d="M16 7C14.5 10 13.5 15 13.5 21C13.5 29 18 37 24 40" stroke="url(#shellRidge)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M21 6.2C20 10.5 19 16 19 22C19 29.5 21.5 36.5 24 40" stroke="url(#shellRidge)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M24 6V40" stroke="url(#shellRidge)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M27 6.2C28 10.5 29 16 29 22C29 29.5 26.5 36.5 24 40" stroke="url(#shellRidge)" strokeWidth="1.3" strokeLinecap="round" />
      <path d="M32 7C33.5 10 34.5 15 34.5 21C34.5 29 30 37 24 40" stroke="url(#shellRidge)" strokeWidth="1.3" strokeLinecap="round" />

      {/* Shell hinge base */}
      <path 
        d="M19 39C19 41.5 20.5 43 24 43C27.5 43 29 41.5 29 39C27 39.5 25.5 39.7 24 39.7C22.5 39.7 21 39.5 19 39Z" 
        fill="#0284c7" 
        fillOpacity="0.8"
      />

      {/* Tiny Pearl Glint inside base */}
      <circle cx="24" cy="36.5" r="2.2" fill="url(#pearlShine)" />
      <circle cx="24.8" cy="35.8" r="0.7" fill="#ffffff" />
    </svg>
  );
};

const PlaylistTrackCover: React.FC<{ coverUrl?: string; title: string }> = ({ coverUrl, title }) => {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [coverUrl]);

  if (!coverUrl || loadError) {
    return <SeashellIcon isPlaying={false} className="w-4 h-4" />;
  }

  return (
    <img
      src={coverUrl}
      alt={title}
      onError={() => setLoadError(true)}
      className="w-full h-full object-cover"
      referrerPolicy="no-referrer"
    />
  );
};

export const MusicPlayer: React.FC<MusicPlayerProps> = ({
  isPlaying,
  onTogglePlay,
}) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isMuted, setIsMuted] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [showPlaylist, setShowPlaylist] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [coverError, setCoverError] = useState(false);

  const progressTimerRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const playedHistoryRef = useRef<number[]>([]);
  const recentlyPlayedIndicesRef = useRef<number[]>([]);
  const hasInitializedRandomRef = useRef<boolean>(false);

  // Load active tracks dynamically and shuffle on initial load
  const fetchActiveTracks = async () => {
    setIsLoading(true);
    try {
      const active = await musicService.getActiveTracks();
      if (active.length > 0) {
        // 1. Randomly shuffle the active track list on page load / initial encounter
        const shuffled = musicService.shuffleTracks(active);
        setTracks(shuffled);

        // 2. Select a random starting track index if not initialized
        if (!hasInitializedRandomRef.current) {
          hasInitializedRandomRef.current = true;
          const initialRandomIndex = Math.floor(Math.random() * shuffled.length);
          setCurrentTrackIndex(initialRandomIndex);
          recentlyPlayedIndicesRef.current = [initialRandomIndex];
        } else if (currentTrackIndex >= shuffled.length) {
          setCurrentTrackIndex(0);
        }
      } else {
        setTracks([]);
        setCurrentTrackIndex(0);
      }
    } catch (err) {
      console.warn('Failed to load active tracks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveTracks();

    const handleMusicUpdate = () => {
      fetchActiveTracks();
    };

    window.addEventListener('be_ca_music_updated', handleMusicUpdate);

    return () => {
      window.removeEventListener('be_ca_music_updated', handleMusicUpdate);
    };
  }, []);

  // Ensure that if user starts playback for the first time, we start at a random track
  useEffect(() => {
    if (isPlaying && tracks.length > 1 && !hasInitializedRandomRef.current) {
      hasInitializedRandomRef.current = true;
      const initialRandomIndex = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(initialRandomIndex);
      recentlyPlayedIndicesRef.current = [initialRandomIndex];
    }
  }, [isPlaying, tracks.length]);

  const currentTrack: Track | undefined = tracks[currentTrackIndex] || tracks[0];

  // Reset cover error when track changes
  useEffect(() => {
    setCoverError(false);
  }, [currentTrack?.id, currentTrack?.coverUrl]);

  // Determine if track uses an external audio file (not procedural ambient wave)
  const isHttpAudio = Boolean(
    (currentTrack?.audioUrl && !currentTrack.audioUrl.startsWith('synth:')) ||
    Boolean(currentTrack?.audioPath)
  );

  const effectiveDuration = (isHttpAudio && audioDuration > 0)
    ? audioDuration
    : (currentTrack?.duration && currentTrack.duration > 0 ? currentTrack.duration : 180);

  // Automatically or manually switch to a random next track (NO IMMEDIATE DUPLICATES)
  const playNextRandomTrack = () => {
    if (tracks.length === 0) return;
    if (tracks.length === 1) {
      setCurrentTime(0);
      if (audioRef.current && isHttpAudio) {
        audioRef.current.currentTime = 0;
        if (isPlaying) audioRef.current.play().catch(() => {});
      }
      return;
    }

    // Record current track in playback history for the "Previous" button
    playedHistoryRef.current.push(currentTrackIndex);
    if (playedHistoryRef.current.length > 50) {
      playedHistoryRef.current.shift();
    }

    // Pick next index using musicService, GUARANTEEING it is different from currentTrackIndex
    const nextIndex = musicService.getRandomNextTrackIndex(
      currentTrackIndex,
      tracks.length,
      recentlyPlayedIndicesRef.current
    );

    // Track recently played indices to complete a full cycle across all tracks
    recentlyPlayedIndicesRef.current.push(nextIndex);
    if (recentlyPlayedIndicesRef.current.length >= tracks.length) {
      recentlyPlayedIndicesRef.current = [nextIndex];
    }

    setAudioError(null);
    setCurrentTime(0);
    setCurrentTrackIndex(nextIndex);
  };

  // Initialize HTML5 Audio element with robust events and strict error logging
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
    }
    const audio = audioRef.current;

    const onTimeUpdate = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setCurrentTime(Math.floor(audio.currentTime));
      }
    };

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(Math.floor(audio.duration));
      }
      setAudioError(null);
    };

    const onEnded = () => {
      // Auto-advance to random next track when current track finishes
      playNextRandomTrack();
    };

    const onError = () => {
      if (!audio.src || audio.src === window.location.href) return;

      console.warn('[MusicPlayer HTMLAudioElement Error Event]', {
        errorCode: audio.error?.code,
        errorMessage: audio.error?.message,
        audioSrc: audio.src,
        trackId: currentTrack?.id,
        title: currentTrack?.title,
      });

      // Strict user requirement: DO NOT silently fall back to ambient synth
      setAudioError(
        `Không thể phát bài hát "${currentTrack?.title || ''}". Kiểm tra Audio URL / Supabase Storage (Mã lỗi ${audio.error?.code || 'MEDIA_ERR'}).`
      );
    };

    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('error', onError);

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('error', onError);
      audio.pause();
    };
  }, [tracks.length, currentTrackIndex, isPlaying, currentTrack?.id, currentTrack?.title]);

  // Handle Playback routing: External Audio URL vs. Procedural Ambient Synth
  useEffect(() => {
    let isCancelled = false;

    if (!currentTrack) return;

    setAudioError(null);
    const effectiveVol = isMuted ? 0 : volume;

    if (isPlaying) {
      if (isHttpAudio && audioRef.current) {
        synthEngine.pause();

        // Resolve playable URL (supports persistent Supabase Storage / IndexedDB recovery)
        (async () => {
          try {
            const resolvedUrl = await storageService.getPlayableAudioUrl(currentTrack);
            if (isCancelled) return;

            if (!resolvedUrl) {
              setAudioError(`Không thể phát bài hát "${currentTrack.title}". Không tìm thấy Audio URL.`);
              return;
            }

            const audio = audioRef.current;
            if (!audio) return;

            if (audio.src !== resolvedUrl) {
              audio.src = resolvedUrl;
              audio.currentTime = 0;
              audio.load();
            }

            audio.volume = effectiveVol;

            const playPromise = audio.play();
            if (playPromise !== undefined) {
              playPromise.catch((err) => {
                if (isCancelled) return;
                if (err?.name === 'AbortError') return;

                if (err?.name === 'NotAllowedError') {
                  // Browser autoplay policy prevented playback without prior user interaction
                  console.log('[MusicPlayer] Autoplay prevented by browser, waiting for user gesture.');
                  const unlockPlayback = () => {
                    if (audioRef.current && isPlaying) {
                      audioRef.current.play().catch(() => {});
                    }
                    try {
                      synthEngine.init();
                    } catch {
                      // ignore
                    }
                    window.removeEventListener('pointerdown', unlockPlayback);
                    window.removeEventListener('keydown', unlockPlayback);
                    window.removeEventListener('touchstart', unlockPlayback);
                  };
                  window.addEventListener('pointerdown', unlockPlayback, { once: true });
                  window.addEventListener('keydown', unlockPlayback, { once: true });
                  window.addEventListener('touchstart', unlockPlayback, { once: true });
                  return;
                }

                console.warn('[MusicPlayer Audio Play Catch]', {
                  trackId: currentTrack.id,
                  title: currentTrack.title,
                  src: audio.src,
                  errorCode: audio.error?.code,
                  errorMessage: audio.error?.message,
                  err,
                });
                setAudioError(
                  `Không thể phát bài hát "${currentTrack.title}". Kiểm tra Audio URL / Supabase Storage.`
                );
              });
            }
          } catch (err: any) {
            if (isCancelled) return;
            console.error('[MusicPlayer Track Resolution Failed]', err);
            setAudioError(`Không thể phát bài hát "${currentTrack.title}": ${err.message || 'Lỗi không xác định'}`);
          }
        })();
      } else {
        // Procedural ambient synth track
        if (audioRef.current) {
          audioRef.current.pause();
        }
        synthEngine.setTrack(currentTrack.rootFreq || 220);
        synthEngine.play(currentTrack.rootFreq || 220);
      }
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      synthEngine.pause();
    }

    return () => {
      isCancelled = true;
    };
  }, [isPlaying, currentTrackIndex, currentTrack?.id, currentTrack?.audioUrl]);

  // Volume sync
  useEffect(() => {
    const effectiveVol = isMuted ? 0 : volume;
    synthEngine.setVolume(effectiveVol);
    if (audioRef.current) {
      audioRef.current.volume = effectiveVol;
    }
  }, [volume, isMuted]);

  // Progress time simulation for procedural ambient synth tracks
  useEffect(() => {
    if (isPlaying && !isHttpAudio) {
      progressTimerRef.current = window.setInterval(() => {
        setCurrentTime((prev) => {
          if (prev >= effectiveDuration) {
            playNextRandomTrack();
            return 0;
          }
          return prev + 1;
        });
      }, 1000);
    } else {
      if (progressTimerRef.current) {
        clearInterval(progressTimerRef.current);
      }
    }

    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [isPlaying, effectiveDuration, isHttpAudio, tracks.length, currentTrackIndex]);

  // Close panel on outside click without stopping audio
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent | TouchEvent) => {
      if (isExpanded && containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsExpanded(false);
        setShowPlaylist(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
    };
  }, [isExpanded]);

  // Next Track handler (always picks a random non-duplicate next track)
  const handleNext = () => {
    playNextRandomTrack();
  };

  // Previous Track handler (smart return to beginning if played > 3s, or return to past played track)
  const handlePrev = () => {
    if (tracks.length === 0) return;
    setAudioError(null);
    if (currentTime > 3) {
      setCurrentTime(0);
      if (audioRef.current && isHttpAudio) {
        audioRef.current.currentTime = 0;
      }
      return;
    }
    setCurrentTime(0);
    if (playedHistoryRef.current.length > 0) {
      const prevIndex = playedHistoryRef.current.pop()!;
      if (prevIndex >= 0 && prevIndex < tracks.length && prevIndex !== currentTrackIndex) {
        setCurrentTrackIndex(prevIndex);
        return;
      }
    }
    // Fallback: pick another random track other than current
    const fallbackIndex = musicService.getRandomNextTrackIndex(currentTrackIndex, tracks.length);
    setCurrentTrackIndex(fallbackIndex);
  };

  // Manual re-shuffle handler
  const handleShufflePlaylist = () => {
    if (tracks.length <= 1) return;
    const shuffled = musicService.shuffleTracks(tracks);
    setTracks(shuffled);
    const newIdx = Math.floor(Math.random() * shuffled.length);
    setCurrentTrackIndex(newIdx);
    setCurrentTime(0);
    playedHistoryRef.current = [];
    recentlyPlayedIndicesRef.current = [newIdx];
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = Number(e.target.value);
    setCurrentTime(newTime);
    if (audioRef.current && isHttpAudio && !isNaN(audioRef.current.duration)) {
      try {
        audioRef.current.currentTime = newTime;
      } catch {
        // ignore seek errors
      }
    }
  };

  const handleSelectTrack = (index: number) => {
    setAudioError(null);
    setCurrentTime(0);
    setCurrentTrackIndex(index);
    if (!isPlaying) {
      onTogglePlay();
    }
    setShowPlaylist(false);
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || !isFinite(secs) || secs < 0) return '0:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div 
      ref={containerRef}
      id="floating-music-player"
      className="fixed z-40 bottom-20 lg:bottom-6 right-3 sm:right-6 select-none"
    >
        {/* 1. COLLAPSED STATE: Floating Magical Seashell Button */}
        {!isExpanded ? (
          <div className="relative group">
            {/* Subtle Floating Music Effects (only when music is playing) */}
            {isPlaying && (
              <div className="absolute -top-3 inset-x-0 flex justify-center pointer-events-none z-10">
                {/* Note 1: ♪ */}
                <span 
                  className="animate-music-note-1 absolute text-[12px] font-bold text-cyan-600 drop-shadow-[0_0_4px_rgba(56,189,248,0.8)]"
                >
                  ♪
                </span>

                {/* Note 2: ♫ */}
                <span 
                  className="animate-music-note-2 absolute text-[11px] font-bold text-teal-600 drop-shadow-[0_0_4px_rgba(20,184,166,0.8)]"
                >
                  ♫
                </span>

                {/* Note 3: Tiny iridescent bubble */}
                <span 
                  className="animate-music-note-3 absolute w-2 h-2 rounded-full border border-cyan-400 bg-white/70 shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                />
              </div>
            )}

            {/* Seashell Trigger Button */}
            <button
              id="seashell-music-button"
              type="button"
              onClick={() => setIsExpanded(true)}
              className="w-12 h-12 sm:w-14 sm:h-14 rounded-full glass-panel bg-white/90 border border-white/95 shadow-[0_6px_22px_rgba(8,145,178,0.22)] hover:shadow-[0_8px_30px_rgba(8,145,178,0.32)] flex items-center justify-center transition-all duration-300 hover:scale-105 active:scale-95 cursor-pointer relative"
              aria-label={isPlaying ? "Mở bảng điều khiển nhạc (Đang phát)" : "Mở bảng điều khiển nhạc"}
              title="Nhạc Bể Cá"
            >
              {/* Ambient water pulse halo when playing */}
              {isPlaying && (
                <span className="absolute inset-0 rounded-full bg-cyan-400/20 animate-ping pointer-events-none opacity-40" />
              )}

              {/* Custom Seashell SVG Icon */}
              <SeashellIcon isPlaying={isPlaying} />

              {/* Status dot in bottom corner */}
              <span 
                className={`absolute bottom-1 right-1 w-2.5 h-2.5 rounded-full border border-white shadow-xs ${
                  isPlaying ? 'bg-teal-500 animate-pulse' : 'bg-slate-300'
                }`} 
              />
            </button>
          </div>
        ) : (
          /* 2. EXPANDED STATE: Floating Glass Music Console */
          <div 
            id="expanded-music-panel"
            className="w-[calc(100vw-2rem)] sm:w-88 max-w-sm glass-panel rounded-3xl border border-white/95 shadow-[0_16px_45px_rgba(8,145,178,0.25)] bg-white/92 backdrop-blur-2xl p-4 transition-all duration-300 animate-fadeIn"
          >
            {/* Header */}
            <div className="flex items-center justify-between pb-2 border-b border-slate-200/70">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-cyan-100 border border-cyan-300/80 flex items-center justify-center text-cyan-700">
                  <SeashellIcon isPlaying={isPlaying} className="w-4 h-4" />
                </div>
                <span className="text-xs font-semibold text-[#0a2540] font-mono tracking-wider">
                  BỂ CÁ
                </span>
              </div>

              <div className="flex items-center gap-1">
                {/* Shuffle Button */}
                <button
                  type="button"
                  onClick={handleShufflePlaylist}
                  className="p-1.5 rounded-lg border border-slate-200 bg-white/80 hover:bg-cyan-50 hover:border-cyan-300 text-slate-500 hover:text-cyan-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
                  title="Xáo trộn ngẫu nhiên danh sách phát"
                  aria-label="Xáo trộn ngẫu nhiên"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                </button>

                {/* Toggle Playlist button */}
                <button
                  type="button"
                  onClick={() => setShowPlaylist(!showPlaylist)}
                  className={`p-1.5 rounded-lg border transition-colors cursor-pointer text-xs flex items-center gap-1 ${
                    showPlaylist 
                      ? 'bg-cyan-100 border-cyan-300 text-cyan-900 font-medium' 
                      : 'bg-white/80 border-slate-200 text-slate-500 hover:text-[#0a2540]'
                  }`}
                  title="Danh sách bài hát"
                >
                  <ListMusic className="w-3.5 h-3.5" />
                </button>

                {/* Close/Minimize Button */}
                <button
                  id="close-music-panel-btn"
                  type="button"
                  onClick={() => {
                    setIsExpanded(false);
                    setShowPlaylist(false);
                  }}
                  className="p-1.5 rounded-lg bg-white/80 hover:bg-slate-100 border border-slate-200 text-slate-500 hover:text-[#0a2540] transition-colors cursor-pointer"
                  aria-label="Thu nhỏ trình phát"
                  title="Thu nhỏ"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Playlist Drawer (if active) */}
            {isLoading ? (
              <div className="py-8 px-4 text-center space-y-2">
                <Loader2 className="w-6 h-6 animate-spin text-cyan-600 mx-auto" />
                <p className="text-xs font-semibold text-[#0a2540]">
                  Đang tải danh sách bản nhạc...
                </p>
              </div>
            ) : tracks.length === 0 ? (
              <div className="py-8 px-4 text-center space-y-2">
                <div className="w-10 h-10 mx-auto rounded-2xl bg-cyan-50 border border-cyan-200 flex items-center justify-center text-cyan-600 shadow-2xs">
                  <SeashellIcon isPlaying={false} className="w-5 h-5" />
                </div>
                <p className="text-xs font-semibold text-[#0a2540]">
                  Hiện chưa có bản nhạc nào trong Bể Cá
                </p>
                <p className="text-[11px] text-[#2c5378] font-light leading-relaxed">
                  Các bản nhạc đang được lưu trữ hoặc tạm ẩn bởi quản trị viên.
                </p>
              </div>
            ) : showPlaylist ? (
              <div className="py-3 space-y-1 max-h-56 overflow-y-auto pr-1 animate-fadeIn">
                <span className="text-[10px] font-mono text-cyan-900/60 uppercase tracking-wider block px-1 pb-1">
                  Danh sách bài hát ({tracks.length})
                </span>
                {tracks.map((track, idx) => (
                  <button
                    key={track.id}
                    onClick={() => handleSelectTrack(idx)}
                    className={`w-full text-left p-2 rounded-xl transition-all flex items-center justify-between text-xs cursor-pointer ${
                      currentTrackIndex === idx
                        ? 'bg-gradient-to-r from-teal-50 to-cyan-50 border border-cyan-300/80 text-[#0a2540] font-medium'
                        : 'hover:bg-slate-50 text-[#254b70] border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <span className="font-mono text-[11px] font-semibold text-cyan-800/60 w-4 text-center flex-shrink-0">
                        {idx + 1}
                      </span>
                      <div className="w-8 h-8 rounded-lg overflow-hidden border border-slate-200/80 flex-shrink-0 flex items-center justify-center bg-cyan-50/80">
                        <PlaylistTrackCover coverUrl={track.coverUrl} title={track.title} />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-medium">{track.title}</p>
                        {track.artist ? (
                          <p className="text-[10px] text-slate-400 truncate">{track.artist}</p>
                        ) : null}
                      </div>
                    </div>
                    {currentTrackIndex === idx && isPlaying && (
                      <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            ) : (
              /* Current Track Main View */
              <div className="pt-3 space-y-3">
                {/* Audio Error Banner */}
                {audioError && (
                  <div className="p-2 rounded-xl bg-amber-50/90 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-1.5 animate-fadeIn">
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                    <span className="truncate">{audioError}</span>
                  </div>
                )}

                {/* Track Info Card */}
                <div className="flex items-center gap-3">
                  {/* Visualizer avatar / Cover artwork */}
                  <div className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-2xl bg-gradient-to-br from-teal-100 via-cyan-100 to-sky-200 border border-white shadow-xs flex items-center justify-center flex-shrink-0 overflow-hidden">
                    {currentTrack?.coverUrl && !coverError ? (
                      <img
                        src={currentTrack.coverUrl}
                        alt={currentTrack.title}
                        onError={() => setCoverError(true)}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <SeashellIcon isPlaying={isPlaying} className="w-7 h-7" />
                      </div>
                    )}
                    {isPlaying && (
                      <span className="absolute bottom-1 inset-x-2 h-1 bg-teal-400 rounded-full animate-pulse opacity-70" />
                    )}
                  </div>

                  {/* Title & Artist */}
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[#0a2540] truncate tracking-wide">
                      {currentTrack?.title || 'Không có bản nhạc'}
                    </h4>
                    {currentTrack?.artist ? (
                      <p className="text-xs text-[#244c74] truncate font-light mt-0.5">
                        {currentTrack.artist}
                      </p>
                    ) : null}
                  </div>
                </div>

                {/* Progress Slider */}
                <div className="space-y-1">
                  <input
                    type="range"
                    min="0"
                    max={effectiveDuration}
                    value={currentTime}
                    onChange={handleSeek}
                    className="w-full accent-cyan-600 h-1.5 bg-sky-100 rounded-lg cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                    <span>{formatTime(currentTime)}</span>
                    <span>{formatTime(effectiveDuration)}</span>
                  </div>
                </div>

                {/* Playback Controls */}
                <div className="flex items-center justify-center gap-4 py-0.5">
                  <button
                    onClick={handlePrev}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-600 hover:text-[#0a2540] transition-colors cursor-pointer active:scale-95"
                    aria-label="Bài trước"
                    title="Bài trước"
                  >
                    <SkipBack className="w-4 h-4" />
                  </button>

                  <button
                    id="expanded-player-play-btn"
                    onClick={onTogglePlay}
                    className="w-11 h-11 rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white flex items-center justify-center shadow-[0_3px_14px_rgba(6,182,212,0.35)] transition-all active:scale-95 cursor-pointer"
                    aria-label={isPlaying ? "Tạm dừng" : "Phát nhạc"}
                  >
                    {isPlaying ? <Pause className="w-5 h-5 fill-white" /> : <Play className="w-5 h-5 fill-white ml-0.5" />}
                  </button>

                  <button
                    onClick={handleNext}
                    className="p-2 rounded-full hover:bg-slate-100 text-slate-600 hover:text-[#0a2540] transition-colors cursor-pointer active:scale-95"
                    aria-label="Bài kế tiếp"
                    title="Bài kế tiếp"
                  >
                    <SkipForward className="w-4 h-4" />
                  </button>
                </div>

                {/* Volume Slider */}
                <div className="flex items-center gap-2 pt-1 border-t border-slate-200/70">
                  <button
                    onClick={() => setIsMuted(!isMuted)}
                    className="text-slate-500 hover:text-cyan-700 transition-colors cursor-pointer"
                    aria-label={isMuted ? "Bật tiếng" : "Tắt tiếng"}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-3.5 h-3.5" />
                    ) : (
                      <Volume2 className="w-3.5 h-3.5" />
                    )}
                  </button>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={isMuted ? 0 : volume}
                    onChange={(e) => {
                      setVolume(parseFloat(e.target.value));
                      if (isMuted) setIsMuted(false);
                    }}
                    className="w-full accent-cyan-600 h-1 bg-sky-100 rounded-lg cursor-pointer"
                  />
                  <span className="text-[10px] text-slate-500 font-mono w-7 text-right">
                    {isMuted ? '0%' : `${Math.round(volume * 100)}%`}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}
    </div>
  );
};
