import React, { useState, useEffect } from 'react';
import { AdminView, Character, Track, Tag } from '../../types';
import { characterRepository } from '../../services/characterRepository';
import { tagRepository } from '../../services/tagRepository';
import { musicService } from '../../services/musicService';
import { auditService } from '../../services/auditService';
import { notificationService } from '../../services/notificationService';
import { 
  Fish, 
  Tag as TagIcon, 
  Music, 
  Lock, 
  Unlock, 
  Users, 
  ArrowRight, 
  Clock, 
  Activity,
  Plus,
  Bell
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigate: (view: AdminView) => void;
  onOpenAddCharacter: () => void;
  onOpenAddMusic: () => void;
  onOpenAddTag: () => void;
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  onNavigate,
  onOpenAddCharacter,
  onOpenAddMusic,
  onOpenAddTag,
}) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [recentLogs, setRecentLogs] = useState(auditService.getRecentLogs(8));
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => notificationService.getUnreadCount());
  const [totalNotifCount, setTotalNotifCount] = useState(() => notificationService.getNotifications().length);

  const loadData = async () => {
    const chars = characterRepository.loadCatalog();
    setCharacters(chars);

    const allTags = await tagRepository.getAllTags();
    setTags(allTags);

    const allTracks = await musicService.getAllTracks();
    setTracks(allTracks);

    setRecentLogs(auditService.getRecentLogs(8));
    setUnreadNotifCount(notificationService.getUnreadCount());
    setTotalNotifCount(notificationService.getNotifications().length);
  };

  useEffect(() => {
    loadData();

    const handleCatalogUpdate = () => loadData();
    const handleTagsUpdate = () => loadData();
    const handleMusicUpdate = () => loadData();
    const handleAuditUpdate = () => setRecentLogs(auditService.getRecentLogs(8));
    const handleNotifUpdate = () => {
      setUnreadNotifCount(notificationService.getUnreadCount());
      setTotalNotifCount(notificationService.getNotifications().length);
    };

    window.addEventListener('be_ca_catalog_updated', handleCatalogUpdate);
    window.addEventListener('be_ca_tags_updated', handleTagsUpdate);
    window.addEventListener('be_ca_music_updated', handleMusicUpdate);
    window.addEventListener('be_ca_audit_logged', handleAuditUpdate);
    window.addEventListener('be_ca_admin_notifications_updated', handleNotifUpdate);
    window.addEventListener('be_ca_character_comments_changed', handleNotifUpdate);

    return () => {
      window.removeEventListener('be_ca_catalog_updated', handleCatalogUpdate);
      window.removeEventListener('be_ca_tags_updated', handleTagsUpdate);
      window.removeEventListener('be_ca_music_updated', handleMusicUpdate);
      window.removeEventListener('be_ca_audit_logged', handleAuditUpdate);
      window.removeEventListener('be_ca_admin_notifications_updated', handleNotifUpdate);
      window.removeEventListener('be_ca_character_comments_changed', handleNotifUpdate);
    };
  }, []);

  const totalChars = characters.length;
  const lockedChars = characters.filter((c) => Boolean(c.isLocked ?? c.locked)).length;
  const openChars = totalChars - lockedChars;

  const totalTags = tags.length;
  const totalTracks = tracks.length;
  const activeTracks = tracks.filter((t) => t.isActive).length;

  return (
    <div id="admin-overview-view" className="space-y-8 animate-fadeIn">
      {/* Header Info */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest font-semibold">
          <span>📊</span>
          <span>BẢNG ĐIỀU KHIỂN NỘI DUNG</span>
        </div>
        <h1 
          className="text-2xl sm:text-3xl font-bold text-white tracking-wide"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Tổng Quan Quản Trị
        </h1>
        <p className="text-xs sm:text-sm text-slate-400 font-light">
          Theo dõi tổng thể dữ liệu master catalog, số lượng bài hát, thẻ phân loại và hoạt động quản trị gần nhất.
        </p>
      </div>

      {/* Main Metric Cards Bento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Characters */}
        <div 
          onClick={() => onNavigate('characters')}
          className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 rounded-2xl p-5 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
            <span className="text-xs font-mono uppercase tracking-wider text-cyan-400 font-semibold flex items-center gap-1.5">
              <Fish className="w-4 h-4" />
              <span>Characters</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-cyan-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="py-4">
            <div className="text-3xl font-bold text-white font-mono">{totalChars}</div>
            <p className="text-xs text-slate-400 mt-1">Tổng số nhân vật trong catalog</p>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-slate-700/40 text-[11px] font-mono">
            <span className="text-amber-400 flex items-center gap-1">
              <Lock className="w-3 h-3" />
              <span>{lockedChars} Khóa</span>
            </span>
            <span className="text-teal-400 flex items-center gap-1">
              <Unlock className="w-3 h-3" />
              <span>{openChars} Mở</span>
            </span>
          </div>
        </div>

        {/* Card 2: Notifications (Admin only) */}
        <div 
          onClick={() => onNavigate('notifications')}
          className={`border rounded-2xl p-5 transition-all cursor-pointer group shadow-sm flex flex-col justify-between ${
            unreadNotifCount > 0
              ? 'bg-slate-800/90 border-rose-500/50 hover:border-rose-400 ring-1 ring-rose-500/20'
              : 'bg-slate-800/80 hover:bg-slate-800 border-slate-700/80 hover:border-cyan-500/50'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
            <span className="text-xs font-mono uppercase tracking-wider text-rose-400 font-semibold flex items-center gap-1.5">
              <Bell className="w-4 h-4" />
              <span>Thông Báo</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-rose-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="py-4">
            <div className="text-3xl font-bold text-white font-mono flex items-center gap-2">
              <span>{totalNotifCount}</span>
              {unreadNotifCount > 0 && (
                <span className="text-xs px-2 py-0.5 rounded-full bg-rose-500 text-white font-mono font-bold animate-pulse">
                  +{unreadNotifCount} mới
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">Thông báo bình luận người dùng</p>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-slate-700/40 text-[11px] font-mono">
            <span className={unreadNotifCount > 0 ? "text-rose-400 font-bold" : "text-slate-400"}>
              {unreadNotifCount} chưa đọc
            </span>
          </div>
        </div>

        {/* Card 3: Dynamic Tags */}
        <div 
          onClick={() => onNavigate('tags')}
          className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 rounded-2xl p-5 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
            <span className="text-xs font-mono uppercase tracking-wider text-teal-400 font-semibold flex items-center gap-1.5">
              <TagIcon className="w-4 h-4" />
              <span>Tags</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-teal-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="py-4">
            <div className="text-3xl font-bold text-white font-mono">{totalTags}</div>
            <p className="text-xs text-slate-400 mt-1">Thẻ phân loại động</p>
          </div>
          <div className="pt-2 border-t border-slate-700/40 text-[11px] font-mono text-slate-400">
            <span>Dùng trong quan hệ many-to-many</span>
          </div>
        </div>

        {/* Card 4: Music Tracks */}
        <div 
          onClick={() => onNavigate('music')}
          className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 rounded-2xl p-5 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
            <span className="text-xs font-mono uppercase tracking-wider text-indigo-400 font-semibold flex items-center gap-1.5">
              <Music className="w-4 h-4" />
              <span>Music</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="py-4">
            <div className="text-3xl font-bold text-white font-mono">{totalTracks}</div>
            <p className="text-xs text-slate-400 mt-1">Tổng số bản nhạc biển</p>
          </div>
          <div className="flex items-center gap-3 pt-2 border-t border-slate-700/40 text-[11px] font-mono">
            <span className="text-teal-400">
              {activeTracks} Đang phát
            </span>
            <span className="text-slate-500">
              {totalTracks - activeTracks} Tắt
            </span>
          </div>
        </div>

        {/* Card 5: Users / Access Guard */}
        <div 
          onClick={() => onNavigate('users')}
          className="bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 hover:border-cyan-500/50 rounded-2xl p-5 transition-all cursor-pointer group shadow-sm flex flex-col justify-between"
        >
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/50">
            <span className="text-xs font-mono uppercase tracking-wider text-purple-400 font-semibold flex items-center gap-1.5">
              <Users className="w-4 h-4" />
              <span>Users</span>
            </span>
            <ArrowRight className="w-4 h-4 text-slate-500 group-hover:text-purple-400 group-hover:translate-x-0.5 transition-all" />
          </div>
          <div className="py-4">
            <div className="text-3xl font-bold text-white font-mono">2</div>
            <p className="text-xs text-slate-400 mt-1">Tài khoản demo độc lập</p>
          </div>
          <div className="pt-2 border-t border-slate-700/40 text-[11px] font-mono text-purple-300">
            <span>user-demo-1 & user-demo-2</span>
          </div>
        </div>
      </div>

      {/* Quick Actions Bar */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-5 space-y-3">
        <h3 className="text-xs font-mono uppercase tracking-wider text-slate-300 font-semibold flex items-center gap-2">
          <Activity className="w-4 h-4 text-cyan-400" />
          <span>Thao Tác Quản Trị Nhanh</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => onNavigate('notifications')}
            className="px-3.5 py-2 rounded-xl bg-rose-600/30 hover:bg-rose-600/40 text-rose-200 border border-rose-500/40 text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Bell className="w-4 h-4 text-rose-300" />
            <span>Xem Thông Báo {unreadNotifCount > 0 ? `(${unreadNotifCount} mới)` : ''}</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddCharacter}
            className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Nhân Vật Mới</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddTag}
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Thẻ Tag</span>
          </button>
          <button
            type="button"
            onClick={onOpenAddMusic}
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Thêm Bài Hát</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigate('unlocks')}
            className="px-3.5 py-2 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5 text-amber-400" />
            <span>Cấp Quyền Manual Unlock</span>
          </button>
        </div>
      </div>

      {/* Recent Audit Logs (Audit-friendly architecture) */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            <h3 className="text-sm font-semibold text-white">Lịch Sử Thao Tác Gần Nhất (Audit Trail)</h3>
          </div>
          <span className="text-[11px] font-mono text-slate-500">Security Log</span>
        </div>

        {recentLogs.length > 0 ? (
          <div className="divide-y divide-slate-700/40">
            {recentLogs.map((log) => (
              <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-cyan-950/80 border border-cyan-800/50 text-cyan-300">
                      {log.entity}
                    </span>
                    <span className="font-medium text-slate-200">{log.action}</span>
                  </div>
                  <p className="text-slate-400 text-[11px] font-light">{log.details}</p>
                </div>
                <span className="text-[10px] font-mono text-slate-500 flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500 font-light">
            Chưa có thao tác quản trị nào được ghi lại trong phiên làm việc này.
          </div>
        )}
      </div>
    </div>
  );
};
