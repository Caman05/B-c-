import React, { useState, useEffect } from 'react';
import { AdminNotification, Character } from '../../types';
import { notificationService } from '../../services/notificationService';
import { characterRepository } from '../../services/characterRepository';
import { 
  Bell, 
  CheckCheck, 
  Trash2, 
  Filter, 
  Search, 
  MessageSquare, 
  Clock, 
  User, 
  ExternalLink, 
  Check, 
  RefreshCw, 
  ShieldCheck, 
  Sparkles,
  AlertCircle
} from 'lucide-react';

interface AdminNotificationsProps {
  onViewCharacter?: (characterId: string) => void;
}

export const AdminNotifications: React.FC<AdminNotificationsProps> = ({
  onViewCharacter,
}) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>(() =>
    notificationService.getNotifications()
  );
  const [filter, setFilter] = useState<'all' | 'unread' | 'read'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [characterCatalog, setCharacterCatalog] = useState<Character[]>([]);
  const [confirmClearAll, setConfirmClearAll] = useState(false);

  // Load notifications and character catalog
  const loadData = () => {
    setNotifications(notificationService.getNotifications());
    try {
      const chars = characterRepository.loadCatalog();
      setCharacterCatalog(chars);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => {
      setNotifications(notificationService.getNotifications());
    };

    window.addEventListener('be_ca_admin_notifications_updated', handleUpdate);
    window.addEventListener('be_ca_character_comments_changed', handleUpdate);

    return () => {
      window.removeEventListener('be_ca_admin_notifications_updated', handleUpdate);
      window.removeEventListener('be_ca_character_comments_changed', handleUpdate);
    };
  }, []);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await notificationService.fetchNotifications();
      loadData();
    } finally {
      setTimeout(() => setIsRefreshing(false), 400);
    }
  };

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await notificationService.markAsRead(id);
    loadData();
  };

  const handleMarkAllAsRead = async () => {
    await notificationService.markAllAsRead();
    loadData();
  };

  const handleDelete = async (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    await notificationService.deleteNotification(id);
    loadData();
  };

  const handleClearAll = async () => {
    await notificationService.clearAll();
    setConfirmClearAll(false);
    loadData();
  };

  // Filtered notifications
  const filtered = notifications.filter((item) => {
    if (filter === 'unread' && item.isRead) return false;
    if (filter === 'read' && !item.isRead) return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchAuthor = item.authorName?.toLowerCase().includes(q);
      const matchChar = item.characterName?.toLowerCase().includes(q);
      const matchContent = item.content?.toLowerCase().includes(q);
      return matchAuthor || matchChar || matchContent;
    }

    return true;
  });

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const formatTime = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return 'Vừa xong';
      const now = new Date();
      const diffMs = now.getTime() - date.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 45) return 'Vừa xong';
      if (diffMin < 60) return `${diffMin} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays < 7) return `${diffDays} ngày trước`;

      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Vừa xong';
    }
  };

  return (
    <div id="admin-notifications-view" className="space-y-6 animate-fadeIn text-left">
      {/* View Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest font-semibold">
            <span>🔔</span>
            <span>HỆ THỐNG THÔNG BÁO ADMIN</span>
          </div>
          <h1 
            className="text-2xl sm:text-3xl font-bold text-white tracking-wide flex items-center gap-2.5"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            <span>Thông Báo Bình Luận</span>
            {unreadCount > 0 && (
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-500 text-white font-mono font-bold animate-pulse">
                {unreadCount} mới
              </span>
            )}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 font-light">
            Nhận thông báo theo thời gian thực mỗi khi có thành viên gửi bình luận về nhân vật trong Bể Cá. Mục này chỉ hiển thị riêng cho Admin.
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium border border-slate-700 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Làm mới danh sách thông báo"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-cyan-400' : ''}`} />
            <span>Làm mới</span>
          </button>

          {unreadCount > 0 && (
            <button
              type="button"
              onClick={handleMarkAllAsRead}
              className="px-3.5 py-1.5 rounded-xl bg-cyan-600/30 hover:bg-cyan-600/40 text-cyan-200 border border-cyan-500/40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              <span>Đã đọc tất cả</span>
            </button>
          )}

          {notifications.length > 0 && (
            <button
              type="button"
              onClick={() => setConfirmClearAll(true)}
              className="px-3 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/40 text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa tất cả</span>
            </button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog for Clear All */}
      {confirmClearAll && (
        <div className="p-4 rounded-2xl bg-rose-950/40 border border-rose-800/60 flex items-center justify-between gap-4 flex-wrap animate-fadeIn">
          <div className="flex items-center gap-2 text-rose-200 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>Bạn có chắc chắn muốn xóa toàn bộ {notifications.length} thông báo khỏi hệ thống?</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setConfirmClearAll(false)}
              className="px-3 py-1 rounded-lg bg-slate-800 text-slate-300 text-xs hover:bg-slate-700 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={handleClearAll}
              className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold text-xs hover:bg-rose-500 cursor-pointer"
            >
              Xác nhận xóa hết
            </button>
          </div>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-2xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
          <span className="text-slate-400 text-xs flex items-center gap-1 mr-1">
            <Filter className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Lọc:</span>
          </span>
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              filter === 'all'
                ? 'bg-cyan-500 text-white font-semibold shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Tất cả ({notifications.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('unread')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
              filter === 'unread'
                ? 'bg-cyan-500 text-white font-semibold shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            <span>Chưa đọc</span>
            {unreadCount > 0 && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                filter === 'unread' ? 'bg-cyan-900 text-cyan-200' : 'bg-rose-500/80 text-white'
              }`}>
                {unreadCount}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setFilter('read')}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer ${
              filter === 'read'
                ? 'bg-cyan-500 text-white font-semibold shadow-xs'
                : 'bg-slate-800 text-slate-400 hover:text-slate-200'
            }`}
          >
            Đã đọc ({notifications.length - unreadCount})
          </button>
        </div>

        {/* Search input */}
        <div className="relative min-w-[220px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo người dùng, nhân vật..."
            className="w-full pl-8 pr-3 py-1.5 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-hidden focus:border-cyan-400 transition-colors"
          />
        </div>
      </div>

      {/* Notifications List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="p-10 rounded-2xl bg-slate-800/40 border border-slate-700/60 text-center space-y-3">
            <div className="w-12 h-12 mx-auto rounded-2xl bg-cyan-950/60 border border-cyan-800/50 flex items-center justify-center text-cyan-300 text-xl shadow-xs">
              <Bell className="w-6 h-6 text-cyan-400" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-white">
                {filter === 'unread' ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
              </h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto font-light">
                {filter === 'unread'
                  ? 'Tuyệt vời! Bạn đã xem hết tất cả các bình luận mới từ người dùng.'
                  : 'Mỗi khi người dùng bình luận về bất kỳ nhân vật nào, thông báo sẽ xuất hiện ngay tại đây.'}
              </p>
            </div>
          </div>
        ) : (
          filtered.map((item) => {
            const isUnread = !item.isRead;
            const matchedChar = characterCatalog.find((c) => c.id === item.characterId);
            const charAvatar = item.characterAvatar || matchedChar?.avatar || matchedChar?.avatarUrl || '';
            const charName = item.characterName || matchedChar?.name || 'Nhân vật';
            const isCommentByAdmin = item.authorRole === 'admin';

            return (
              <div
                key={item.id}
                id={`admin-notif-item-${item.id}`}
                className={`p-4 rounded-2xl border transition-all space-y-3 relative group ${
                  isUnread
                    ? 'bg-slate-800/95 border-cyan-500/50 shadow-md shadow-cyan-950/30 ring-1 ring-cyan-500/20'
                    : 'bg-slate-800/50 border-slate-700/70 hover:border-slate-600'
                }`}
              >
                {/* Header row: Author + Target Character + Time + Status */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-wrap">
                    {/* Author Avatar */}
                    <div className="relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        isCommentByAdmin
                          ? 'bg-amber-100 text-amber-900 border border-amber-300'
                          : 'bg-cyan-100 text-cyan-900 border border-cyan-300'
                      }`}>
                        {item.authorAvatar ? (
                          <img
                            src={item.authorAvatar}
                            alt=""
                            className="w-full h-full rounded-full object-cover"
                          />
                        ) : (
                          item.authorName ? item.authorName.charAt(0).toUpperCase() : <User className="w-4 h-4" />
                        )}
                      </div>
                      {isUnread && (
                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee] animate-pulse" />
                      )}
                    </div>

                    {/* Author Details & Action description */}
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-bold text-white">
                          {item.authorName}
                        </span>
                        {isCommentByAdmin ? (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-950/80 text-amber-300 border border-amber-700/60 font-semibold flex items-center gap-0.5">
                            <ShieldCheck className="w-2.5 h-2.5" />
                            Admin
                          </span>
                        ) : (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-cyan-950/80 text-cyan-300 border border-cyan-800/60 font-medium">
                            Thành viên
                          </span>
                        )}
                        <span className="text-xs text-slate-400 font-light">đã bình luận về</span>
                        
                        {/* Target Character Tag */}
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-slate-900/90 border border-cyan-800/50 text-cyan-300 text-xs font-semibold">
                          {charAvatar && (
                            <img
                              src={charAvatar}
                              alt=""
                              className="w-3.5 h-3.5 rounded-full object-cover"
                            />
                          )}
                          <span>{charName}</span>
                        </div>
                      </div>

                      {/* Time */}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-slate-400 font-light flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          <span>{formatTime(item.createdAt)}</span>
                        </span>
                        {isUnread && (
                          <span className="text-[10px] font-mono uppercase px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 font-bold">
                            Chưa đọc
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions on this notification */}
                  <div className="flex items-center gap-1.5">
                    {isUnread ? (
                      <button
                        type="button"
                        onClick={(e) => handleMarkAsRead(item.id, e)}
                        className="px-2.5 py-1 rounded-lg bg-cyan-950/70 hover:bg-cyan-900 border border-cyan-700/60 text-cyan-300 text-xs font-medium transition-colors flex items-center gap-1 cursor-pointer"
                        title="Đánh dấu đã đọc"
                      >
                        <Check className="w-3 h-3" />
                        <span className="hidden sm:inline">Đã đọc</span>
                      </button>
                    ) : (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 pr-1 font-mono">
                        <CheckCheck className="w-3.5 h-3.5 text-teal-400" />
                        <span className="hidden sm:inline">Đã xem</span>
                      </span>
                    )}

                    {onViewCharacter && item.characterId && (
                      <button
                        type="button"
                        onClick={() => onViewCharacter(item.characterId)}
                        className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                        title="Xem trang nhân vật"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={(e) => handleDelete(item.id, e)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-950/40 transition-colors cursor-pointer"
                      title="Xóa thông báo"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {/* Comment Content Preview Bubble */}
                <div className="pl-11">
                  <div className="p-3 rounded-xl bg-slate-900/70 border border-slate-700/70 text-xs text-slate-200 leading-relaxed font-light whitespace-pre-wrap break-words flex items-start gap-2.5">
                    <MessageSquare className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <p className="flex-1 italic text-slate-300">
                      "{item.content}"
                    </p>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
