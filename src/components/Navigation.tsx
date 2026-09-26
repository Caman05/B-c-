import React, { useState, useEffect } from 'react';
import { PageView } from '../types';
import { musicService } from '../services/musicService';
import { useTheme } from '../hooks/useTheme';
import { 
  Waves, 
  Fish, 
  Star, 
  User,
  Volume2,
  VolumeX,
  Shield,
  Moon,
  Sun,
  Music,
  Bell
} from 'lucide-react';
import { notificationService } from '../services/notificationService';

interface NavigationProps {
  currentPage: PageView;
  onPageChange: (page: PageView) => void;
  onNavigateToAdmin?: (view?: string) => void;
  unlockedCount: number;
  totalCount: number;
  favoritesCount: number;
  lockedCount: number;
  isAudioPlaying: boolean;
  onToggleAudio: () => void;
}

export const Navigation: React.FC<NavigationProps> = ({
  currentPage,
  onPageChange,
  onNavigateToAdmin,
  unlockedCount,
  totalCount,
  favoritesCount,
  lockedCount,
  isAudioPlaying,
  onToggleAudio,
}) => {
  const [isAdmin, setIsAdmin] = useState(() => musicService.isAdminUser());
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => notificationService.getUnreadCount());
  const { isDark, toggleTheme } = useTheme();

  useEffect(() => {
    const handleRoleCheck = () => {
      setIsAdmin(musicService.isAdminUser());
      setUnreadNotifCount(notificationService.getUnreadCount());
    };
    const handleNotifUpdate = () => {
      setUnreadNotifCount(notificationService.getUnreadCount());
    };

    window.addEventListener('be_ca_admin_role_changed', handleRoleCheck);
    window.addEventListener('be_ca_auth_role_changed', handleRoleCheck);
    window.addEventListener('be_ca_user_switched', handleRoleCheck);
    window.addEventListener('be_ca_test_mode_changed', handleRoleCheck);
    window.addEventListener('be_ca_admin_notifications_updated', handleNotifUpdate);
    window.addEventListener('be_ca_character_comments_changed', handleNotifUpdate);

    return () => {
      window.removeEventListener('be_ca_admin_role_changed', handleRoleCheck);
      window.removeEventListener('be_ca_auth_role_changed', handleRoleCheck);
      window.removeEventListener('be_ca_user_switched', handleRoleCheck);
      window.removeEventListener('be_ca_test_mode_changed', handleRoleCheck);
      window.removeEventListener('be_ca_admin_notifications_updated', handleNotifUpdate);
      window.removeEventListener('be_ca_character_comments_changed', handleNotifUpdate);
    };
  }, []);
  const navItems: { id: PageView; label: string; icon: React.ReactNode; badge?: number; iconEmoji: string }[] = [
    {
      id: 'home',
      label: 'Mặt Nước',
      iconEmoji: '🫧',
      icon: <Waves className="w-4 h-4" />
    },
    {
      id: 'library',
      label: 'Đàn Cá',
      iconEmoji: '🐟',
      icon: <Fish className="w-4 h-4" />,
      badge: totalCount
    },
    {
      id: 'favorites',
      label: 'Cá Cưng',
      iconEmoji: '⭐',
      icon: <Star className="w-4 h-4" />,
      badge: favoritesCount
    },
    {
      id: 'profile',
      label: 'Hồ Sơ',
      iconEmoji: '👤',
      icon: <User className="w-4 h-4" />
    }
  ];

  return (
    <>
      {/* ================= DESKTOP SIDEBAR ================= */}
      <aside 
        id="desktop-sidebar"
        className="hidden lg:flex flex-col w-64 h-screen fixed top-0 left-0 z-30 p-4 select-none"
      >
        <div className="flex-1 flex flex-col glass-panel rounded-3xl p-4 border border-white/95 dark:border-cyan-500/20 shadow-[0_12px_40px_rgba(8,145,178,0.1)] dark:shadow-[0_12px_40px_rgba(0,0,0,0.5)] bg-white/85 dark:bg-[#0b1d30]/90 overflow-y-auto">
          {/* Logo / Brand Header */}
          <button
            onClick={() => onPageChange('home')}
            className="flex items-center gap-3 px-2 py-3 rounded-2xl hover:bg-cyan-50/60 dark:hover:bg-cyan-950/40 transition-colors text-left group cursor-pointer"
          >
            <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-950/90 border border-cyan-300/80 dark:border-cyan-700 flex items-center justify-center text-cyan-700 dark:text-cyan-300 shadow-xs group-hover:scale-105 transition-transform">
              <svg className="w-6 h-6" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect x="3" y="4" width="18" height="16" rx="4" stroke="currentColor" strokeWidth="1.6" />
                <path d="M4 9C8 8 11 10 15 9C17 8 19 9 20 9" stroke="#0284c7" strokeWidth="1.4" strokeOpacity="0.8" />
                <circle cx="15" cy="6.5" r="1.2" fill="#0284c7" />
                <path d="M14 14C12 15 8 15 6 13C5 12 6 11 7 12C9 13 13 13 14 14Z" fill="currentColor" fillOpacity="0.9" />
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold tracking-widest text-lg text-[#0a2540] dark:text-[#f0f9ff]" style={{ fontFamily: "'Cinzel', serif" }}>
                  BỂ CÁ
                </span>
                <span className="text-[10px] uppercase font-mono px-1.5 py-0.5 rounded-full bg-cyan-100 dark:bg-cyan-950/80 text-cyan-800 dark:text-cyan-200 border border-cyan-200 dark:border-cyan-800 font-semibold">
                  HUB
                </span>
              </div>
              <p className="text-[11px] text-cyan-800/70 dark:text-cyan-300/70 font-light truncate max-w-[140px]">
                Character Archive
              </p>
            </div>
          </button>

          {/* Divider */}
          <div className="my-3 h-px bg-gradient-to-r from-transparent via-cyan-200 dark:via-cyan-800/60 to-transparent" />

          {/* Navigation Links */}
          <nav className="flex-1 space-y-1.5 py-1">
            <div className="px-3 pb-1 text-[10px] font-semibold text-cyan-900/60 dark:text-cyan-300/60 uppercase tracking-wider">
              Thủy Vực
            </div>

            {navItems.map((item) => {
              const isActive = currentPage === item.id;
              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => onPageChange(item.id)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-cyan-950/80 dark:to-teal-950/70 text-[#073656] dark:text-cyan-100 border border-cyan-300/80 dark:border-cyan-600/50 shadow-2xs font-semibold'
                      : 'text-[#1d446b] dark:text-slate-300 hover:text-[#0a2540] dark:hover:text-white hover:bg-cyan-50/50 dark:hover:bg-cyan-950/40 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span className="text-base">{item.iconEmoji}</span>
                    <span>{item.label}</span>
                  </div>

                  {item.badge !== undefined && (
                    <span 
                      className={`text-[11px] font-mono px-2 py-0.5 rounded-full ${
                        isActive
                          ? 'bg-cyan-500 text-white font-semibold shadow-2xs'
                          : 'bg-cyan-100/70 dark:bg-cyan-900/60 text-cyan-800 dark:text-cyan-200 font-medium'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Admin Dashboard Entry & Notifications (Visible ONLY to Admin) */}
          {isAdmin && onNavigateToAdmin && (
            <div className="pt-2 space-y-1.5">
              <button
                id="sidebar-admin-link"
                onClick={() => onNavigateToAdmin()}
                className="w-full flex items-center justify-between px-3.5 py-2.5 rounded-2xl bg-gradient-to-r from-slate-900 to-cyan-950 text-white hover:from-slate-800 hover:to-cyan-900 transition-all border border-cyan-500/40 shadow-xs cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Shield className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
                  <span className="font-semibold text-xs text-cyan-200">Admin Dashboard</span>
                </span>
                <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30">
                  /admin
                </span>
              </button>

              <button
                id="sidebar-notifications-link"
                onClick={() => onNavigateToAdmin('notifications')}
                className="w-full flex items-center justify-between px-3.5 py-2 rounded-xl bg-slate-900/40 hover:bg-slate-900/80 text-slate-300 hover:text-white transition-all border border-slate-700/60 text-xs cursor-pointer group"
              >
                <span className="flex items-center gap-2">
                  <Bell className="w-3.5 h-3.5 text-rose-400 group-hover:scale-110 transition-transform" />
                  <span className="font-medium text-slate-200">Thông báo bình luận</span>
                </span>
                {unreadNotifCount > 0 ? (
                  <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded-full bg-rose-500 text-white animate-pulse">
                    {unreadNotifCount}
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-slate-500">0</span>
                )}
              </button>
            </div>
          )}

          {/* Subtle Ambient Sound Toggle in Sidebar */}
          <div className="pt-3 border-t border-slate-200/80 dark:border-slate-800 mt-auto">
            <button
              onClick={onToggleAudio}
              className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white/70 dark:bg-[#12283f] hover:bg-white dark:hover:bg-[#193654] text-xs text-[#1e466e] dark:text-slate-300 hover:text-[#0a2540] dark:hover:text-white transition-colors border border-slate-200/80 dark:border-slate-700 shadow-2xs cursor-pointer"
            >
              <span className="flex items-center gap-2">
                {isAudioPlaying ? (
                  <Volume2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400 animate-pulse" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
                )}
                <span className="font-medium">Thủy âm ambient</span>
              </span>
              <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded ${isAudioPlaying ? 'text-teal-800 dark:text-teal-200 bg-teal-100 dark:bg-teal-900/60' : 'text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800'}`}>
                {isAudioPlaying ? 'BẬT' : 'TẮT'}
              </span>
            </button>
          </div>
        </div>
      </aside>

      {/* ================= TOP BAR (Desktop & Mobile) ================= */}
      <header 
        id="app-topbar"
        className="fixed top-0 inset-x-0 lg:left-64 h-14 z-30 px-4 sm:px-6 flex items-center justify-between glass-panel border-b border-white/90 dark:border-cyan-500/20 bg-white/90 dark:bg-[#0b1d30]/90 shadow-2xs transition-colors duration-200"
      >
        {/* Mobile: Brand logo button */}
        <button
          onClick={() => onPageChange('home')}
          className="lg:hidden flex items-center gap-2 text-left cursor-pointer"
        >
          <div className="w-7 h-7 rounded-lg bg-cyan-100 dark:bg-cyan-950/80 border border-cyan-300 dark:border-cyan-700 flex items-center justify-center text-cyan-700 dark:text-cyan-300">
            <span className="text-xs">🫧</span>
          </div>
          <span className="font-bold tracking-widest text-sm text-[#0a2540] dark:text-[#f0f9ff]" style={{ fontFamily: "'Cinzel', serif" }}>
            BỂ CÁ
          </span>
        </button>

        {/* Desktop: Breadcrumb indicator */}
        <div className="hidden lg:flex items-center gap-2 text-xs text-[#1e466e] dark:text-cyan-200/90 font-medium">
          <span className="opacity-75">🫧 BỂ CÁ</span>
          <span className="text-slate-300 dark:text-slate-600 font-light">/</span>
          <span className="font-semibold text-[#0a2540] dark:text-white capitalize">
            {navItems.find((n) => n.id === currentPage)?.label || 'Bể Cá'}
          </span>
        </div>

        {/* Right Action Buttons: [ 🔔 (Admin Only) ] [ 🎵 ] [ 🌙 / ☀️ ] [ 👤 ] */}
        <div className="flex items-center gap-2">
          {/* Nút Thông Báo Admin [ 🔔 ] (CHỈ HIỂN THỊ VỚI ADMIN) */}
          {isAdmin && (
            <button
              id="topbar-admin-notifications-btn"
              type="button"
              onClick={() => onNavigateToAdmin?.('notifications')}
              className="relative p-2 rounded-xl bg-white/80 dark:bg-[#12283f] border border-slate-200 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-white dark:hover:bg-[#193654] shadow-2xs cursor-pointer active:scale-95 transition-all"
              aria-label="Thông báo quản trị (Admin)"
              title={`Thông báo bình luận mới (Admin)${unreadNotifCount > 0 ? ` - ${unreadNotifCount} chưa đọc` : ''}`}
            >
              <Bell className="w-4 h-4" />
              {unreadNotifCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-white text-[9px] font-mono font-bold shadow-xs animate-pulse">
                  {unreadNotifCount > 99 ? '99+' : unreadNotifCount}
                </span>
              )}
            </button>
          )}

          {/* Nút Âm nhạc [ 🎵 ] */}
          <button
            id="topbar-music-btn"
            type="button"
            onClick={onToggleAudio}
            className="p-2 rounded-xl bg-white/80 dark:bg-[#12283f] border border-slate-200 dark:border-slate-700 text-cyan-700 dark:text-cyan-300 hover:bg-white dark:hover:bg-[#193654] shadow-2xs cursor-pointer active:scale-95 transition-all"
            aria-label="Bật/Tắt âm thanh"
            title={isAudioPlaying ? "Tắt âm thanh" : "Bật âm thanh"}
          >
            <Music className={`w-4 h-4 ${isAudioPlaying ? 'text-cyan-600 dark:text-cyan-400 animate-pulse' : 'text-slate-400 dark:text-slate-500'}`} />
          </button>

          {/* Nút Chuyển Theme: [ 🌙 ] in Light Mode / [ ☀️ ] in Dark Mode */}
          <button
            id="theme-toggle-btn"
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-xl bg-white/80 dark:bg-[#12283f] border border-slate-200 dark:border-slate-700 text-cyan-700 dark:text-amber-300 hover:bg-white dark:hover:bg-[#193654] shadow-2xs cursor-pointer active:scale-95 transition-all"
            aria-label={isDark ? "Chuyển sang Giao diện Sáng" : "Chuyển sang Giao diện Tối"}
            title={isDark ? "Chế độ Sáng (Hiện tại: Tối)" : "Chế độ Tối (Hiện tại: Sáng)"}
          >
            {isDark ? (
              <Sun className="w-4 h-4 text-amber-400 hover:text-amber-300 transition-colors" />
            ) : (
              <Moon className="w-4 h-4 text-cyan-700 hover:text-cyan-900 transition-colors" />
            )}
          </button>

          {/* Nút Hồ sơ cá nhân */}
          <button
            id="topbar-profile-btn"
            type="button"
            onClick={() => onPageChange('profile')}
            className={`p-2 rounded-xl border transition-all cursor-pointer shadow-2xs active:scale-95 ${
              currentPage === 'profile'
                ? 'border-cyan-400 dark:border-cyan-500 bg-cyan-100 dark:bg-cyan-950/80 text-cyan-950 dark:text-cyan-200 font-bold'
                : 'border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-[#12283f] text-[#1e466e] dark:text-slate-300 hover:bg-white dark:hover:bg-[#193654]'
            }`}
            aria-label="Hồ sơ cá nhân"
            title="Hồ sơ cá nhân"
          >
            <User className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* ================= MOBILE BOTTOM NAVIGATION ================= */}
      <nav 
        id="mobile-bottom-nav"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 glass-panel border-t border-white/90 dark:border-cyan-500/20 bg-white/92 dark:bg-[#0b1d30]/95 px-2 py-1.5 pb-safe flex items-center justify-around shadow-lg"
      >
        {navItems.map((item) => {
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onPageChange(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-xl transition-all cursor-pointer ${
                isActive
                  ? 'text-cyan-800 dark:text-cyan-300 font-bold'
                  : 'text-[#2a547b] dark:text-slate-400 hover:text-[#0a2540] dark:hover:text-white'
              }`}
            >
              <span className="text-base leading-none mb-0.5">{item.iconEmoji}</span>
              <span className="text-[10px] font-medium leading-tight">{item.label}</span>
              {isActive && (
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 mt-0.5 shadow-[0_0_6px_#06b6d4]" />
              )}
            </button>
          );
        })}
      </nav>
    </>
  );
};
