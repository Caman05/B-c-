import React, { useState, useEffect } from 'react';
import { AdminView } from '../../types';
import { userCharacterRepository } from '../../services/userCharacterRepository';
import { notificationService } from '../../services/notificationService';
import { 
  ArrowLeft, 
  LayoutDashboard, 
  Fish, 
  Tag as TagIcon, 
  Lock, 
  Music, 
  Users, 
  ShieldCheck, 
  Sparkles,
  ExternalLink,
  Bell
} from 'lucide-react';

interface AdminLayoutProps {
  currentView: AdminView;
  onViewChange: (view: AdminView) => void;
  onExitAdmin: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentView,
  onViewChange,
  onExitAdmin,
  children,
}) => {
  const [activeUserId, setActiveUserId] = useState(() => userCharacterRepository.getCurrentUserId());
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => notificationService.getUnreadCount());

  useEffect(() => {
    const handleSwitch = () => {
      setActiveUserId(userCharacterRepository.getCurrentUserId());
    };
    const handleNotifUpdate = () => {
      setUnreadNotifCount(notificationService.getUnreadCount());
    };

    window.addEventListener('be_ca_user_switched', handleSwitch);
    window.addEventListener('be_ca_admin_notifications_updated', handleNotifUpdate);
    window.addEventListener('be_ca_character_comments_changed', handleNotifUpdate);

    return () => {
      window.removeEventListener('be_ca_user_switched', handleSwitch);
      window.removeEventListener('be_ca_admin_notifications_updated', handleNotifUpdate);
      window.removeEventListener('be_ca_character_comments_changed', handleNotifUpdate);
    };
  }, []);

  const navItems: { id: AdminView; label: string; icon: React.ReactNode; emoji: string; badge?: number }[] = [
    {
      id: 'overview',
      label: 'Tổng Quan',
      emoji: '📊',
      icon: <LayoutDashboard className="w-4 h-4" />,
    },
    {
      id: 'notifications',
      label: 'Thông Báo',
      emoji: '🔔',
      icon: <Bell className="w-4 h-4" />,
      badge: unreadNotifCount,
    },
    {
      id: 'characters',
      label: 'Nhân Vật',
      emoji: '🐟',
      icon: <Fish className="w-4 h-4" />,
    },
    {
      id: 'tags',
      label: 'Thẻ Tags',
      emoji: '🏷️',
      icon: <TagIcon className="w-4 h-4" />,
    },
    {
      id: 'unlocks',
      label: 'Cấu Hình Mở Khóa',
      emoji: '🔐',
      icon: <Lock className="w-4 h-4" />,
    },
    {
      id: 'music',
      label: 'Âm Nhạc',
      emoji: '🎵',
      icon: <Music className="w-4 h-4" />,
    },
    {
      id: 'users',
      label: 'Người Dùng & Quyền',
      emoji: '👥',
      icon: <Users className="w-4 h-4" />,
    },
  ];

  return (
    <div 
      id="admin-dashboard-container"
      className="min-h-screen bg-gradient-to-br from-slate-900 via-[#0b1b2b] to-[#041320] text-slate-100 flex flex-col font-sans"
    >
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-900/80 backdrop-blur-md border-b border-slate-700/60 px-4 sm:px-6 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Brand & Area Title */}
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 shadow-sm">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span 
                  className="font-bold text-lg tracking-wider text-white" 
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  BỂ CÁ
                </span>
                <span className="px-2 py-0.5 rounded-md bg-cyan-900/70 border border-cyan-500/40 text-[10px] font-mono font-bold text-cyan-200 uppercase tracking-widest">
                  ADMIN DASHBOARD
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-light">
                Khu vực Quản trị Nội dung Master Catalog • RLS Enforced
              </p>
            </div>
          </div>

          {/* Right Header Controls: Admin Status & Return button */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-xs font-mono">
              <ShieldCheck className="w-3.5 h-3.5 text-teal-400" />
              <span className="text-slate-300">Admin:</span>
              <span className="text-teal-300 font-semibold">{activeUserId}</span>
            </div>

            <button
              id="admin-exit-to-client-btn"
              type="button"
              onClick={onExitAdmin}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-200 text-xs font-medium transition-all shadow-xs cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Trở về Bể Cá</span>
            </button>
          </div>
        </div>
      </header>

      {/* Secondary Navigation Ribbon */}
      <nav 
        id="admin-secondary-nav"
        className="bg-slate-900/40 border-b border-slate-800/80 px-4 sm:px-6 lg:px-8 py-2 overflow-x-auto scrollbar-none"
      >
        <div className="max-w-7xl mx-auto flex items-center gap-1.5 sm:gap-2">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                id={`admin-nav-${item.id}-btn`}
                type="button"
                onClick={() => onViewChange(item.id)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-cyan-500 text-white shadow-md shadow-cyan-500/20 font-semibold'
                    : 'bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-700/50'
                }`}
              >
                <span>{item.emoji}</span>
                <span>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ml-1 ${
                    isActive ? 'bg-white text-cyan-900' : 'bg-rose-500 text-white animate-pulse'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Main Admin View Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 lg:p-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/70 py-4 px-6 text-center text-xs text-slate-500 font-light font-mono">
        BỂ CÁ Admin Service Layer • RBAC Enforced via Supabase RLS • Strictly No Client Fake Roles
      </footer>
    </div>
  );
};
