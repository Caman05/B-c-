import { AdminNotification } from '../types';
import { authService } from './authService';

const STORAGE_KEY_ADMIN_NOTIFICATIONS = 'be_ca_admin_notifications_v1';

class NotificationService {
  private memoryCache: AdminNotification[] = [];
  private isFetching = false;

  constructor() {
    this.memoryCache = this.loadFromLocal();
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        if (authService.isAdmin()) {
          this.fetchNotifications().catch(() => {});
        }
      }, 500);

      // Listen for role change or auth updates
      window.addEventListener('be_ca_auth_role_changed', () => {
        if (authService.isAdmin()) {
          this.fetchNotifications().catch(() => {});
        }
      });
      window.addEventListener('be_ca_admin_role_changed', () => {
        if (authService.isAdmin()) {
          this.fetchNotifications().catch(() => {});
        }
      });
    }
  }

  /**
   * Internal helper: Load from localStorage cache
   */
  private loadFromLocal(): AdminNotification[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(STORAGE_KEY_ADMIN_NOTIFICATIONS);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.warn('[NotificationService] Error reading notifications from local cache:', e);
    }
    return [];
  }

  /**
   * Internal helper: Save to localStorage cache and dispatch reactive event
   */
  private saveToLocal(list: AdminNotification[]): void {
    this.memoryCache = list;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_ADMIN_NOTIFICATIONS, JSON.stringify(list));
    } catch (e) {
      console.error('[NotificationService] Error writing notifications to local cache:', e);
    }
    window.dispatchEvent(new CustomEvent('be_ca_admin_notifications_updated', {
      detail: { notifications: list, unreadCount: this.getUnreadCount() }
    }));
  }

  /**
   * Fetch all notifications from server (strictly for Admin)
   */
  public async fetchNotifications(): Promise<AdminNotification[]> {
    if (!authService.isAdmin()) {
      return [];
    }

    if (this.isFetching) {
      return this.memoryCache;
    }

    this.isFetching = true;
    try {
      const headers = await authService.getAuthHeaders();
      const res = await fetch('/api/notifications', { headers });

      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.notifications)) {
          this.saveToLocal(data.notifications);
          return data.notifications;
        }
      }
    } catch (err) {
      console.warn('[NotificationService] Server notifications sync deferred:', err);
    } finally {
      this.isFetching = false;
    }

    return this.memoryCache;
  }

  /**
   * Get notifications from memory cache immediately (strictly empty for non-admins)
   */
  public getNotifications(): AdminNotification[] {
    if (!authService.isAdmin()) {
      return [];
    }
    return [...this.memoryCache].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  /**
   * Get unread notification count
   */
  public getUnreadCount(): number {
    if (!authService.isAdmin()) {
      return 0;
    }
    return this.memoryCache.filter((n) => !n.isRead).length;
  }

  /**
   * Mark a single notification as read
   */
  public async markAsRead(notificationId: string): Promise<void> {
    if (!authService.isAdmin() || !notificationId) return;

    // Optimistic update
    const updated = this.memoryCache.map((n) =>
      n.id === notificationId ? { ...n, isRead: true } : n
    );
    this.saveToLocal(updated);

    try {
      const headers = await authService.getAuthHeaders();
      await fetch(`/api/notifications/${encodeURIComponent(notificationId)}/read`, {
        method: 'PATCH',
        headers,
      });
    } catch (err) {
      console.warn('[NotificationService] Error marking notification as read on server:', err);
    }
  }

  /**
   * Mark all notifications as read
   */
  public async markAllAsRead(): Promise<void> {
    if (!authService.isAdmin()) return;

    // Optimistic update
    const updated = this.memoryCache.map((n) => ({ ...n, isRead: true }));
    this.saveToLocal(updated);

    try {
      const headers = await authService.getAuthHeaders();
      await fetch('/api/notifications/all/read', {
        method: 'PATCH',
        headers,
      });
    } catch (err) {
      console.warn('[NotificationService] Error marking all as read on server:', err);
    }
  }

  /**
   * Delete a notification
   */
  public async deleteNotification(notificationId: string): Promise<void> {
    if (!authService.isAdmin() || !notificationId) return;

    // Optimistic update
    const updated = this.memoryCache.filter((n) => n.id !== notificationId);
    this.saveToLocal(updated);

    try {
      const headers = await authService.getAuthHeaders();
      await fetch(`/api/notifications/${encodeURIComponent(notificationId)}`, {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      console.warn('[NotificationService] Error deleting notification on server:', err);
    }
  }

  /**
   * Clear all notifications
   */
  public async clearAll(): Promise<void> {
    if (!authService.isAdmin()) return;

    // Optimistic update
    this.saveToLocal([]);

    try {
      const headers = await authService.getAuthHeaders();
      await fetch('/api/notifications/all', {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      console.warn('[NotificationService] Error clearing all notifications on server:', err);
    }
  }

  /**
   * Manually record a comment notification locally (called when user leaves comment)
   */
  public recordCommentNotification(payload: {
    characterId: string;
    characterName?: string;
    characterAvatar?: string;
    commentId: string;
    userId: string;
    authorName: string;
    authorEmail?: string;
    authorRole?: 'admin' | 'member';
    authorAvatar?: string;
    content: string;
    createdAt?: string;
  }): void {
    const newNotif: AdminNotification = {
      id: 'notif-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9),
      type: 'comment',
      title: 'Bình luận mới về nhân vật',
      message: `${payload.authorName} đã bình luận: "${payload.content.slice(0, 90)}${payload.content.length > 90 ? '...' : ''}"`,
      characterId: payload.characterId,
      characterName: payload.characterName || 'Nhân vật',
      characterAvatar: payload.characterAvatar || '',
      commentId: payload.commentId,
      userId: payload.userId,
      authorName: payload.authorName,
      authorEmail: payload.authorEmail || '',
      authorRole: payload.authorRole || 'member',
      authorAvatar: payload.authorAvatar || '',
      content: payload.content,
      createdAt: payload.createdAt || new Date().toISOString(),
      isRead: false,
    };

    const current = this.loadFromLocal();
    current.unshift(newNotif);
    if (current.length > 200) current.length = 200;
    this.saveToLocal(current);
  }
}

export const notificationService = new NotificationService();
