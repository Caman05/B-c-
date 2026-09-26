import { CharacterComment } from '../types';
import { authService } from './authService';
import { isSupabaseConfigured, getSupabase } from '../lib/supabaseClient';
import { characterRepository } from './characterRepository';
import { notificationService } from './notificationService';

const STORAGE_KEY_COMMENTS = 'be_ca_character_comments_v1';

class CommentService {
  private memoryCache: Record<string, CharacterComment[]> = {};
  private hasInitializedSync = false;

  constructor() {
    this.memoryCache = this.loadAllFromLocal();
    if (typeof window !== 'undefined') {
      // Sync on startup in background
      setTimeout(() => this.syncAllCommentsFromServer(), 300);
    }
  }

  /**
   * Internal helper to load all comments map from localStorage cache
   */
  private loadAllFromLocal(): Record<string, CharacterComment[]> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(STORAGE_KEY_COMMENTS);
      if (!raw) return {};
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') {
        return parsed as Record<string, CharacterComment[]>;
      }
    } catch (e) {
      console.warn('[CommentService] Error reading comments from localStorage cache:', e);
    }
    return {};
  }

  /**
   * Internal helper to save all comments map to localStorage cache
   */
  private saveAllToLocal(map: Record<string, CharacterComment[]>): void {
    this.memoryCache = map;
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(STORAGE_KEY_COMMENTS, JSON.stringify(map));
    } catch (e) {
      console.error('[CommentService] Error saving comments to localStorage cache:', e);
    }
  }

  /**
   * Sync all comments from the persistent shared database
   */
  public async syncAllCommentsFromServer(): Promise<void> {
    try {
      const res = await fetch('/api/comments');
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.comments)) {
          const map: Record<string, CharacterComment[]> = {};
          data.comments.forEach((c: CharacterComment) => {
            if (!map[c.characterId]) map[c.characterId] = [];
            map[c.characterId].push(c);
          });

          // Check if local storage had any legacy comments before backend was introduced
          if (!this.hasInitializedSync) {
            this.hasInitializedSync = true;
            const local = this.loadAllFromLocal();
            for (const [charId, list] of Object.entries(local)) {
              if (Array.isArray(list) && list.length > 0 && (!map[charId] || map[charId].length === 0)) {
                // Migrate to backend so data is never lost
                for (const item of list) {
                  this.addCommentDirectToBackend(item).catch(() => {});
                }
              }
            }
          }

          this.saveAllToLocal(map);
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('be_ca_character_comments_synced'));
          }
        }
      }
    } catch (err) {
      console.warn('[CommentService] Server comments sync deferred:', err);
    }
  }

  /**
   * Helper to push legacy comment to server
   */
  private async addCommentDirectToBackend(comment: CharacterComment): Promise<void> {
    try {
      const headers = await authService.getAuthHeaders();
      await fetch('/api/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          characterId: comment.characterId,
          content: comment.content,
        }),
      });
    } catch {
      // ignore
    }
  }

  /**
   * Fetch comments from the server for a specific character
   */
  public async fetchComments(characterId: string): Promise<CharacterComment[]> {
    if (!characterId) return [];

    // 1. Fetch from backend API
    try {
      const res = await fetch(`/api/comments?characterId=${encodeURIComponent(characterId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.success && Array.isArray(data.comments)) {
          const all = this.loadAllFromLocal();
          all[characterId] = data.comments;
          this.saveAllToLocal(all);
          return data.comments;
        }
      }
    } catch (err) {
      console.warn('[CommentService] Network error fetching comments, using cache:', err);
    }

    // 2. If Supabase is configured, also attempt to fetch from Supabase
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { data, error } = await supabase
            .from('character_comments')
            .select('*')
            .eq('character_id', characterId)
            .order('created_at', { ascending: true });

          if (!error && data) {
            const mapped: CharacterComment[] = data.map((row: any) => ({
              id: row.id,
              characterId: row.character_id,
              userId: row.user_id,
              authorName: row.author_name,
              authorEmail: row.author_email,
              authorRole: row.author_role,
              authorAvatar: row.author_avatar,
              content: row.content,
              createdAt: row.created_at,
            }));
            const all = this.loadAllFromLocal();
            all[characterId] = mapped;
            this.saveAllToLocal(all);
            return mapped;
          }
        } catch (err) {
          console.warn('[CommentService] Supabase comments query error:', err);
        }
      }
    }

    // 3. Fallback to cached comments
    return this.getComments(characterId);
  }

  /**
   * Get comments for a character from local cache immediately,
   * while triggering background sync to ensure shared multi-user freshness
   */
  public getComments(characterId: string): CharacterComment[] {
    if (!characterId) return [];
    const all = this.loadAllFromLocal();
    const list = all[characterId] || [];

    // Trigger non-blocking refresh from server
    if (typeof window !== 'undefined') {
      setTimeout(() => {
        this.fetchComments(characterId).then((freshList) => {
          if (JSON.stringify(freshList) !== JSON.stringify(list)) {
            window.dispatchEvent(
              new CustomEvent('be_ca_character_comments_changed', {
                detail: { characterId },
              })
            );
          }
        }).catch(() => {});
      }, 0);
    }

    // Sort oldest first so conversation reads naturally from top to bottom
    return [...list].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  /**
   * Get comment count for a specific character
   */
  public getCommentCount(characterId: string): number {
    if (!characterId) return 0;
    const all = this.loadAllFromLocal();
    return (all[characterId] || []).length;
  }

  /**
   * Add a new comment to a character
   * Sends directly to Supabase with character_id, user_name, content without requiring login.
   * If network fails, automatically falls back to localStorage so the comment appears immediately without blocking errors.
   */
  public async addComment(
    characterId: string, 
    content: string, 
    customAuthorName?: string
  ): Promise<CharacterComment> {
    const trimmed = content.trim();
    if (!characterId) {
      throw new Error('ID nhân vật không hợp lệ.');
    }
    if (!trimmed) {
      throw new Error('Nội dung bình luận không được để trống.');
    }

    // Determine author information (custom name, current user, or default 'Ẩn danh')
    let currentUser: any = null;
    try {
      currentUser = authService.getCurrentUser();
    } catch {
      // ignore
    }

    const trimmedAuthorName = (customAuthorName || '').trim();
    const finalAuthorName = trimmedAuthorName 
      || (currentUser?.name && currentUser?.name !== 'Người Lặn Biển #1' && currentUser?.name !== 'Người Lặn Biển #2' ? currentUser.name : '')
      || (currentUser?.role === 'admin' ? 'Chủ Bể Cá' : '') 
      || 'Ẩn danh';

    const finalUserId = currentUser?.id || `guest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const finalAuthorRole = currentUser?.role || 'member';
    const finalAuthorAvatar = currentUser?.avatarUrl || '';
    const finalAuthorEmail = currentUser?.email || '';

    // Find character metadata for notification context
    let characterName = 'Nhân vật';
    let characterAvatar = '';
    try {
      const catalog = characterRepository.loadCatalog();
      const matched = catalog.find((c) => c.id === characterId);
      if (matched) {
        characterName = matched.name;
        characterAvatar = matched.avatar || matched.avatarUrl || '';
      }
    } catch {
      // fallback
    }

    const now = new Date().toISOString();
    const newCommentId = `cmt-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const newComment: CharacterComment = {
      id: newCommentId,
      characterId,
      userId: finalUserId,
      authorName: finalAuthorName,
      authorEmail: finalAuthorEmail,
      authorRole: finalAuthorRole,
      authorAvatar: finalAuthorAvatar,
      content: trimmed,
      createdAt: now,
    };

    // 1. Immediately update local storage & memory cache so UI displays comment instantly
    const all = this.loadAllFromLocal();
    if (!all[characterId]) all[characterId] = [];
    all[characterId].push(newComment);
    this.saveAllToLocal(all);

    // Dispatch reactive update event immediately
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('be_ca_character_comments_changed', {
          detail: { characterId, comment: newComment },
        })
      );
    }

    // 2. Post to shared server database (/api/comments) if reachable
    try {
      let headers: Record<string, string> = { 'Content-Type': 'application/json' };
      try {
        const authHeaders = await authService.getAuthHeaders();
        headers = { ...headers, ...authHeaders };
      } catch {
        // no auth headers needed
      }

      await fetch('/api/comments', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          id: newComment.id,
          characterId,
          characterName,
          characterAvatar,
          content: trimmed,
          userName: finalAuthorName,
          authorName: finalAuthorName,
          userId: finalUserId,
          authorRole: finalAuthorRole,
          authorAvatar: finalAuthorAvatar,
        }),
      });
    } catch (apiErr) {
      console.warn('[CommentService] Backend API deferred, comment kept in local storage:', apiErr);
    }

    // 3. Send character_id, user_name, content directly to Supabase without requiring user session/token
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          // Attempt inserting standard character_id, user_name, content
          const { error: sbError } = await supabase
            .from('character_comments')
            .insert({
              id: newComment.id,
              character_id: characterId,
              user_name: finalAuthorName,
              author_name: finalAuthorName,
              content: trimmed,
              user_id: finalUserId,
              author_role: finalAuthorRole,
              author_avatar: finalAuthorAvatar,
              created_at: now,
            });

          if (sbError) {
            console.warn('[CommentService] Supabase insert warning (schema fallback):', sbError.message);
            // Try minimal payload: character_id, user_name, content
            try {
              await supabase
                .from('character_comments')
                .insert({
                  character_id: characterId,
                  user_name: finalAuthorName,
                  content: trimmed,
                });
            } catch {
              // ignore
            }
          }
        } catch (err) {
          console.warn('[CommentService] Supabase network error, comment safely saved to local storage:', err);
        }
      }
    }

    // 4. Record local notification for Admin
    try {
      notificationService.recordCommentNotification({
        characterId,
        characterName,
        characterAvatar,
        commentId: newComment.id,
        userId: newComment.userId,
        authorName: newComment.authorName,
        authorEmail: newComment.authorEmail,
        authorRole: newComment.authorRole,
        authorAvatar: newComment.authorAvatar,
        content: newComment.content,
        createdAt: newComment.createdAt,
      });
    } catch (notifErr) {
      // ignore
    }

    return newComment;
  }

  /**
   * Delete a comment with strict Backend & Database verification
   * User can only delete own comments; Admin can delete any comment
   */
  public async deleteComment(characterId: string, commentId: string): Promise<boolean> {
    if (!characterId || !commentId) return false;

    const headers = await authService.getAuthHeaders();

    // 1. Request deletion from Backend API
    const res = await fetch(`/api/comments/${encodeURIComponent(commentId)}`, {
      method: 'DELETE',
      headers,
    });

    const data = await res.json().catch(() => ({}));

    // Check for HTTP 403 Forbidden or unauthorized
    if (res.status === 403) {
      throw new Error(data.error || 'Bạn không có quyền xóa bình luận này.');
    }
    if (res.status === 401) {
      throw new Error(data.error || 'Phiên xác thực đã hết hạn. Vui lòng thử lại.');
    }
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Không thể xóa bình luận. Vui lòng thử lại.');
    }

    // 2. If Supabase is configured, enforce Supabase deletion
    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          const { error } = await supabase
            .from('character_comments')
            .delete()
            .eq('id', commentId);

          if (error) {
            console.warn('[CommentService] Supabase delete comment warning:', error.message);
          }
        } catch (err) {
          console.warn('[CommentService] Supabase delete network error:', err);
        }
      }
    }

    // 3. Remove from local cache
    const all = this.loadAllFromLocal();
    const list = all[characterId];
    if (list && list.length > 0) {
      all[characterId] = list.filter((c) => c.id !== commentId);
      this.saveAllToLocal(all);
    }

    // 4. Dispatch reactive update event
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('be_ca_character_comments_changed', {
          detail: { characterId, deletedCommentId: commentId },
        })
      );
    }

    return true;
  }

  /**
   * Clean up all comments when a character is deleted (cascade delete by Admin)
   */
  public async deleteCommentsForCharacter(characterId: string): Promise<void> {
    if (!characterId) return;

    try {
      const headers = await authService.getAuthHeaders();
      await fetch(`/api/comments?characterId=${encodeURIComponent(characterId)}`, {
        method: 'DELETE',
        headers,
      });
    } catch (err) {
      console.warn('[CommentService] Cascade delete API error:', err);
    }

    if (isSupabaseConfigured()) {
      const supabase = getSupabase();
      if (supabase) {
        try {
          await supabase
            .from('character_comments')
            .delete()
            .eq('character_id', characterId);
        } catch (err) {
          console.warn('[CommentService] Supabase cascade delete error:', err);
        }
      }
    }

    const all = this.loadAllFromLocal();
    if (all[characterId]) {
      delete all[characterId];
      this.saveAllToLocal(all);
    }
  }
}

export const commentService = new CommentService();
