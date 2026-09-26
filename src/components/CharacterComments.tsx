import React, { useState, useEffect, useRef } from 'react';
import { CharacterComment } from '../types';
import { commentService } from '../services/commentService';
import { authService } from '../services/authService';
import { 
  MessageSquare, 
  Send, 
  Trash2, 
  ShieldCheck, 
  User, 
  Sparkles,
  Loader2,
  Clock,
  AlertCircle,
  CheckCircle2,
  X
} from 'lucide-react';

interface CharacterCommentsProps {
  characterId: string;
  characterName?: string;
}

export const CharacterComments: React.FC<CharacterCommentsProps> = ({
  characterId,
  characterName,
}) => {
  const [comments, setComments] = useState<CharacterComment[]>([]);
  const [inputContent, setInputContent] = useState('');
  const [authorNameInput, setAuthorNameInput] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('be_ca_commenter_name');
      if (saved) return saved;
    }
    const u = authService.getCurrentUser();
    if (u?.name && u.name !== 'Người Lặn Biển #1' && u.name !== 'Người Lặn Biển #2') {
      return u.name;
    }
    if (u?.role === 'admin') return 'Chủ Bể Cá';
    return '';
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState(() => authService.getCurrentUser());
  const [isAdmin, setIsAdmin] = useState(() => authService.isAdmin());

  // Delete modal & status states
  const [commentToDelete, setCommentToDelete] = useState<CharacterComment | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const commentsEndRef = useRef<HTMLDivElement | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => {
      setToast(null);
    }, 3500);
    return () => clearTimeout(timer);
  }, [toast]);

  // Load comments for the given characterId
  const loadComments = () => {
    if (!characterId) return;
    const list = commentService.getComments(characterId);
    setComments(list);
  };

  useEffect(() => {
    loadComments();
    setInputContent('');
    setErrorMessage(null);
  }, [characterId]);

  // Listen for background updates / storage events
  useEffect(() => {
    const handleCommentChange = (e: any) => {
      if (e.detail?.characterId === characterId || !e.detail?.characterId) {
        loadComments();
      }
    };

    const handleAuthChange = () => {
      setCurrentUser(authService.getCurrentUser());
      setIsAdmin(authService.isAdmin());
    };

    window.addEventListener('be_ca_character_comments_changed', handleCommentChange);
    window.addEventListener('be_ca_character_comments_synced', handleCommentChange);
    window.addEventListener('be_ca_auth_role_changed', handleAuthChange);
    window.addEventListener('be_ca_user_switched', handleAuthChange);

    return () => {
      window.removeEventListener('be_ca_character_comments_changed', handleCommentChange);
      window.removeEventListener('be_ca_character_comments_synced', handleCommentChange);
      window.removeEventListener('be_ca_auth_role_changed', handleAuthChange);
      window.removeEventListener('be_ca_user_switched', handleAuthChange);
    };
  }, [characterId]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputContent.trim();
    if (!trimmed) {
      setErrorMessage('Vui lòng nhập nội dung bình luận.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await commentService.addComment(characterId, trimmed, authorNameInput.trim());
      setInputContent('');
      loadComments();
      // Scroll to newest comment
      setTimeout(() => {
        commentsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    } catch (err: any) {
      console.warn('[CharacterComments] Comment submission error, local fallback active:', err);
      // Fallback already saved locally, reload comments
      setInputContent('');
      loadComments();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleOpenDeleteModal = (comment: CharacterComment) => {
    setCommentToDelete(comment);
  };

  const handleCancelDelete = () => {
    if (isDeleting) return;
    setCommentToDelete(null);
  };

  const handleConfirmDelete = async () => {
    if (!commentToDelete || isDeleting) return;

    setIsDeleting(true);
    try {
      await commentService.deleteComment(characterId, commentToDelete.id);
      setCommentToDelete(null);
      setToast({
        message: 'Đã xóa bình luận.',
        type: 'success',
      });
      loadComments();
    } catch (err: any) {
      console.error('[CharacterComments] Delete failed:', err);
      setToast({
        message: err?.message || 'Không thể xóa bình luận. Vui lòng kiểm tra lại quyền truy cập.',
        type: 'error',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const formatTimestamp = (isoDate: string) => {
    try {
      const date = new Date(isoDate);
      if (isNaN(date.getTime())) return 'Gần đây';
      return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(date);
    } catch {
      return 'Gần đây';
    }
  };

  return (
    <div 
      id="character-comments-section" 
      className="mt-6 pt-5 border-t border-slate-200/80 space-y-4"
    >
      {/* Toast Alert */}
      {toast && (
        <div
          id="comment-action-toast"
          className={`p-3 rounded-2xl border text-xs font-medium flex items-center justify-between gap-3 shadow-sm animate-fadeIn ${
            toast.type === 'success'
              ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
              : 'bg-rose-50 text-rose-800 border-rose-200'
          }`}
          role="alert"
        >
          <div className="flex items-center gap-2">
            {toast.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{toast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-black/5 transition-colors cursor-pointer"
            aria-label="Đóng thông báo"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-slate-800">
          <div className="w-6 h-6 rounded-lg bg-teal-100/80 flex items-center justify-center text-teal-700">
            <MessageSquare className="w-3.5 h-3.5" />
          </div>
          <h4 className="text-xs uppercase font-bold tracking-wider text-[#0a2540] flex items-center gap-1.5">
            <span>Bình Luận</span>
            <span 
              id="comments-count-badge"
              className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-100 text-cyan-800 font-semibold border border-cyan-200/60"
            >
              {comments.length}
            </span>
          </h4>
        </div>

        <span className="text-[11px] text-slate-400 font-light flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-amber-500" />
          <span>Thảo luận nhân vật</span>
        </span>
      </div>

      {/* Comments List */}
      <div 
        id="comments-list-container"
        className="space-y-2.5 max-h-72 overflow-y-auto pr-1 rounded-xl scrollbar-thin scrollbar-thumb-slate-200"
      >
        {comments.length === 0 ? (
          <div 
            id="comments-empty-state"
            className="p-5 rounded-2xl bg-sky-50/50 border border-sky-100 text-center space-y-2"
          >
            <div className="w-9 h-9 mx-auto rounded-full bg-sky-100 flex items-center justify-center text-sky-600 text-base">
              🫧
            </div>
            <p className="text-xs text-[#1e446a] font-medium">
              Chưa có bình luận nào cho {characterName || 'nhân vật này'}.
            </p>
            <p className="text-[11px] text-slate-500 font-light">
              Hãy là người đầu tiên chia sẻ cảm nghĩ, kỷ niệm hoặc phân tích của bạn!
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isAuthor = comment.userId === currentUser.id;
            const canDelete = isAuthor || isAdmin;
            const isCommentAdmin = comment.authorRole === 'admin';

            return (
              <div
                key={comment.id}
                id={`comment-item-${comment.id}`}
                className="p-3 rounded-2xl bg-white/90 border border-slate-200/80 shadow-2xs space-y-1.5 hover:border-cyan-300/80 transition-all text-left"
              >
                {/* Author row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      isCommentAdmin 
                        ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                        : 'bg-cyan-100 text-cyan-800 border border-cyan-200'
                    }`}>
                      {comment.authorAvatar ? (
                        <img 
                          src={comment.authorAvatar} 
                          alt="" 
                          className="w-full h-full rounded-full object-cover" 
                        />
                      ) : (
                        comment.authorName ? comment.authorName.charAt(0).toUpperCase() : <User className="w-3 h-3" />
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold text-[#0a2540]">
                        {comment.authorName}
                      </span>
                      {isCommentAdmin && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-md bg-amber-50 text-amber-800 border border-amber-200/90 font-medium flex items-center gap-0.5">
                          <ShieldCheck className="w-2.5 h-2.5 text-amber-600" />
                          <span>Admin</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-slate-400 font-light flex items-center gap-1">
                      <Clock className="w-2.5 h-2.5" />
                      {formatTimestamp(comment.createdAt)}
                    </span>

                    {/* Delete button: ONLY rendered if user is author OR admin */}
                    {canDelete && (
                      <button
                        type="button"
                        id={`delete-comment-btn-${comment.id}`}
                        onClick={() => handleOpenDeleteModal(comment)}
                        title="Xóa bình luận"
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Content */}
                <p className="text-xs text-[#1e3a5f] leading-relaxed pl-8 font-light whitespace-pre-wrap break-words">
                  {comment.content}
                </p>
              </div>
            );
          })
        )}
        <div ref={commentsEndRef} />
      </div>

      {/* Input Form */}
      <form onSubmit={handleSubmit} className="space-y-2 pt-1">
        {/* Author Name Input */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-cyan-100 border border-cyan-200 text-cyan-800 flex items-center justify-center shrink-0 text-xs font-bold">
            {authorNameInput.trim() ? (
              authorNameInput.trim().charAt(0).toUpperCase()
            ) : (
              <User className="w-3 h-3 text-cyan-600" />
            )}
          </div>
          <input
            type="text"
            id="character-comment-name-input"
            value={authorNameInput}
            onChange={(e) => {
              setAuthorNameInput(e.target.value);
              try {
                localStorage.setItem('be_ca_commenter_name', e.target.value);
              } catch {
                // ignore
              }
            }}
            placeholder="Tên của bạn (mặc định: Ẩn danh)"
            maxLength={40}
            disabled={isSubmitting}
            className="flex-1 px-3 py-1.5 rounded-xl bg-white/95 border border-slate-300 text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all shadow-2xs disabled:opacity-50"
          />
        </div>

        <div className="relative">
          <textarea
            id="character-comment-textarea"
            rows={2}
            value={inputContent}
            onChange={(e) => setInputContent(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={`Chia sẻ cảm nhận về ${characterName || 'nhân vật này'}...`}
            disabled={isSubmitting}
            maxLength={500}
            className="w-full px-3.5 py-2.5 rounded-2xl bg-white/95 border border-slate-300 text-xs text-[#0a2540] placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all resize-none shadow-2xs disabled:opacity-50"
          />
          <div className="absolute right-3 bottom-2.5 text-[10px] text-slate-400 font-mono pointer-events-none">
            {inputContent.length}/500
          </div>
        </div>

        {errorMessage && (
          <p className="text-[11px] text-rose-600 font-medium px-1">
            {errorMessage}
          </p>
        )}

        <div className="flex items-center justify-between pt-0.5">
          <span className="text-[10px] text-slate-400 font-light hidden sm:inline">
            Gợi ý: Nhấn <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-[9px] font-mono">Ctrl</kbd> + <kbd className="px-1 py-0.5 bg-slate-100 border border-slate-300 rounded text-[9px] font-mono">Enter</kbd> để gửi nhanh
          </span>

          <button
            id="submit-comment-btn"
            type="submit"
            disabled={isSubmitting || !inputContent.trim()}
            className="ml-auto px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-600 hover:from-teal-400 hover:to-cyan-500 disabled:opacity-50 text-white text-xs font-semibold shadow-xs transition-all cursor-pointer flex items-center justify-center gap-1.5 active:scale-98 min-h-[36px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Đang gửi...</span>
              </>
            ) : (
              <>
                <Send className="w-3.5 h-3.5" />
                <span>Gửi</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Confirmation Dialog / Modal for Deleting Comment */}
      {commentToDelete && (
        <div
          id="delete-comment-modal"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-comment-title"
        >
          <div className="w-full max-w-sm rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-5 sm:p-6 space-y-4 text-left">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div>
                <h3 id="delete-comment-title" className="text-sm font-bold text-[#0a2540]">
                  Xác Nhận Xóa Bình Luận
                </h3>
                <p className="text-[11px] text-slate-500 font-light">
                  Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 text-xs text-[#1e3a5f] space-y-1">
              <p className="text-[11px] text-slate-400 font-medium">
                Bình luận của {commentToDelete.authorName}:
              </p>
              <p className="italic font-light line-clamp-3 break-words text-slate-700">
                "{commentToDelete.content}"
              </p>
            </div>

            <p className="text-xs text-slate-600 font-medium">
              Bạn có chắc muốn xóa bình luận này?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                type="button"
                id="cancel-delete-comment-btn"
                disabled={isDeleting}
                onClick={handleCancelDelete}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 text-xs font-semibold cursor-pointer transition-colors"
              >
                Hủy
              </button>

              <button
                type="button"
                id="confirm-delete-comment-btn"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
