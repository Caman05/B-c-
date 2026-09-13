import React, { useEffect, useState, useMemo } from 'react';
import { Character } from '../types';
import { unlockService } from '../services/unlockService';
import { characterRepository } from '../services/characterRepository';
import { musicService } from '../services/musicService';
import { AdminCharacterModal } from './admin/AdminCharacterModal';
import { CharacterComments } from './CharacterComments';
import { resolveCharacterImageUrl, DEFAULT_FALLBACK_AVATAR, stripDescriptionHeading } from '../lib/imageUtils';
import { storageService } from '../services/storageService';
import { 
  X, 
  Lock, 
  Unlock, 
  Star, 
  Sparkles, 
  Tag as TagIcon, 
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  KeyRound,
  Compass,
  ShieldAlert,
  Edit3,
  Trash2,
  Loader2,
  Shield,
  Fish
} from 'lucide-react';

interface CharacterDetailModalProps {
  character: Character | null;
  allCharacters?: Character[];
  onClose: () => void;
  onToggleFavorite: (id: string, e?: React.MouseEvent) => void;
  onTogglePet?: (id: string) => void;
  onUnlockCharacter?: (id: string, code?: string) => Promise<{ success: boolean; message: string }>;
  onSelectCharacter?: (character: Character) => void;
  onCharacterDeleted?: (id: string) => void;
}

export const CharacterDetailModal: React.FC<CharacterDetailModalProps> = ({
  character,
  allCharacters = [],
  onClose,
  onToggleFavorite,
  onTogglePet,
  onUnlockCharacter,
  onSelectCharacter,
  onCharacterDeleted,
}) => {
  // Input and submission states
  const [inputCode, setInputCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Admin states
  const [isAdmin, setIsAdmin] = useState(() => musicService.isAdminUser());
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTogglingLock, setIsTogglingLock] = useState(false);

  // Image load error fallback state
  const [imageError, setImageError] = useState(false);

  // Sync admin role if changed in background
  useEffect(() => {
    const handleRoleCheck = () => {
      setIsAdmin(musicService.isAdminUser());
    };
    window.addEventListener('be_ca_admin_role_changed', handleRoleCheck);
    return () => {
      window.removeEventListener('be_ca_admin_role_changed', handleRoleCheck);
    };
  }, []);

  // Close on ESC key (only if sub-modals aren't open)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isEditModalOpen && !showDeleteConfirm) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isEditModalOpen, showDeleteConfirm]);

  // Reset local state whenever active character changes
  useEffect(() => {
    setInputCode('');
    setErrorMessage(null);
    setSuccessMessage(null);
    setImageError(false);
    setShowDeleteConfirm(false);
  }, [character?.id]);

  // If character is null or missing, render an elegant empty/error state
  if (!character) {
    return (
      <div 
        id="character-detail-empty"
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fadeIn"
        onClick={onClose}
      >
        <div 
          className="glass-panel rounded-3xl p-8 max-w-sm w-full text-center space-y-4 border border-white/90 bg-white/95 shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-12 rounded-2xl bg-cyan-100 mx-auto flex items-center justify-center text-cyan-700 text-xl shadow-xs">
            🫧
          </div>
          <h3 className="text-base font-semibold text-[#0a2540]">Không tìm thấy nhân vật</h3>
          <p className="text-xs text-[#2b557c] font-light">
            Nhân vật này không tồn tại hoặc đã được gỡ bỏ khỏi Bể Cá.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-medium cursor-pointer transition-all shadow-xs"
          >
            Quay lại
          </button>
        </div>
      </div>
    );
  }

  // User-specific states
  const isLocked = Boolean(character.isLocked ?? character.locked);
  const isFavorite = Boolean(character.isFavorite ?? character.favorite);
  const isPet = Boolean(character.isPet ?? character.pet);
  const rawAvatar = character.avatar || character.avatarUrl;
  const [resolvedSrc, setResolvedSrc] = useState<string>(() =>
    resolveCharacterImageUrl(rawAvatar)
  );

  useEffect(() => {
    setImageError(false);
    setResolvedSrc(resolveCharacterImageUrl(character.avatar || character.avatarUrl));
  }, [character.avatar, character.avatarUrl]);

  const handleImageError = async () => {
    const raw = character.avatar || character.avatarUrl;
    if (raw && !imageError) {
      const fallback = await storageService.resolveCharacterImageFallback(raw);
      if (fallback && fallback !== resolvedSrc) {
        setResolvedSrc(fallback);
        return;
      }
    }
    setImageError(true);
  };

  const imageSource = imageError ? DEFAULT_FALLBACK_AVATAR : resolvedSrc;
  const hasValidLink = Boolean(character.characterLink && character.characterLink.trim().startsWith('http'));

  // Condition evaluation progress if applicable
  const conditionEvaluation = (character.unlockType === 'condition' && character.unlockCondition)
    ? unlockService.evaluateCondition(character.unlockCondition, allCharacters)
    : null;

  // Code unlock submission
  const handleCodeUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputCode.trim()) {
      setErrorMessage('Vui lòng nhập mật mã mở khóa.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (onUnlockCharacter) {
        const res = await onUnlockCharacter(character.id, inputCode);
        if (res.success) {
          setSuccessMessage(res.message);
        } else {
          setErrorMessage(res.message);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Mã mở khóa không chính xác.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Condition unlock check
  const handleConditionUnlock = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (onUnlockCharacter) {
        const res = await onUnlockCharacter(character.id);
        if (res.success) {
          setSuccessMessage(res.message);
        } else {
          setErrorMessage(res.message);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Chưa đủ điều kiện mở khóa nhân vật.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Immediate unlock (None)
  const handleImmediateUnlock = async () => {
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      if (onUnlockCharacter) {
        const res = await onUnlockCharacter(character.id);
        if (res.success) {
          setSuccessMessage(res.message);
        } else {
          setErrorMessage(res.message);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể mở khóa nhân vật.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Manual Grant
  const handleAdminManualGrant = async () => {
    if (!isAdmin) return;
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      if (onUnlockCharacter) {
        const res = await onUnlockCharacter(character.id);
        if (res.success) {
          setSuccessMessage(res.message);
        } else {
          setErrorMessage(res.message);
        }
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể cấp quyền mở khóa.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Admin Toggle Global Lock
  const handleAdminToggleGlobalLock = async () => {
    if (!isAdmin) return;
    setIsTogglingLock(true);
    setErrorMessage(null);
    try {
      await characterRepository.toggleGlobalLock(character.id, !isLocked);
      setSuccessMessage(`Đã chuyển nhân vật sang trạng thái: ${!isLocked ? 'Khóa 🔒' : 'Mở tự do 🔓'}.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Không thể thay đổi trạng thái khóa.');
    } finally {
      setIsTogglingLock(false);
    }
  };

  // Admin Delete Character with Cascade
  const handleAdminConfirmDelete = async () => {
    if (!isAdmin) return;
    setIsDeleting(true);
    setErrorMessage(null);
    try {
      await characterRepository.deleteCharacter(character.id);
      if (onCharacterDeleted) {
        onCharacterDeleted(character.id);
      }
      onClose();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Lỗi khi xóa nhân vật.');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  return (
    <div 
      id="character-detail-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 md:p-6 bg-slate-900/40 backdrop-blur-md overflow-hidden animate-fadeIn"
      onClick={onClose}
    >
      <div 
        id="character-detail-container"
        className="relative w-full max-w-4xl max-h-[88vh] h-[88vh] min-h-0 rounded-3xl border-2 border-white/95 shadow-[0_20px_60px_rgba(8,145,178,0.22)] overflow-hidden my-auto flex flex-col bg-white"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Ambient Water Surface Top Glow Bar */}
        <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-teal-300 via-cyan-400 to-sky-400 shadow-[0_0_14px_rgba(6,182,212,0.45)] z-20" />

        {/* Close Button Top-Right */}
        <button
          id="close-detail-modal-btn"
          type="button"
          onClick={onClose}
          className="absolute top-3.5 right-3.5 z-30 w-9 h-9 rounded-full bg-white/90 border border-white/95 text-slate-600 hover:text-[#0a2540] hover:bg-white shadow-sm flex items-center justify-center transition-all cursor-pointer active:scale-95"
          aria-label="Đóng bảng chi tiết"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Modal Layout Grid: 12 Columns */}
        <div className="w-full h-full min-h-0 overflow-hidden grid grid-cols-1 md:grid-cols-12">
          {/* ================= LEFT COLUMN: ARTWORK (5 COLS) ================= */}
          <div className="md:col-span-5 h-[35vh] md:h-full relative overflow-hidden flex-shrink-0 bg-sky-100 flex flex-col justify-end">
            <img
              src={imageSource}
              alt={isLocked ? 'Nhân vật chưa khám phá' : character.name}
              onError={handleImageError}
              className={`absolute inset-0 w-full h-full object-cover object-center transition-all duration-500 ${
                isLocked ? 'filter grayscale blur-md brightness-85 contrast-110' : ''
              }`}
              referrerPolicy="no-referrer"
            />

            {/* Sunlit Water Gradient Vignette */}
            <div className="absolute inset-0 bg-gradient-to-t from-white/95 via-transparent to-transparent pointer-events-none" />

            {/* Locked Visual Overlay */}
            {isLocked && (
              <div className="absolute inset-0 flex flex-col items-center justify-center p-4 text-center z-10 bg-sky-950/20 backdrop-blur-[2px]">
                <div className="w-12 h-12 rounded-2xl glass-panel border border-cyan-300/80 flex items-center justify-center text-cyan-600 shadow-md mb-2 bg-white/90">
                  <Lock className="w-6 h-6 text-cyan-700" />
                </div>
                <span className="text-xs font-mono tracking-widest text-white uppercase font-bold drop-shadow-md">
                  CHƯA MỞ KHÓA
                </span>
              </div>
            )}

            {/* Bottom Status Pill on Artwork */}
            <div className="relative z-10 p-3 sm:p-4 flex items-center justify-between gap-2">
              <div className={`px-3 py-1.5 rounded-xl text-xs font-semibold backdrop-blur-md border flex items-center gap-1.5 shadow-xs ${
                isLocked 
                  ? 'bg-amber-100/95 border-amber-300 text-amber-950' 
                  : 'bg-teal-100/95 border-teal-300 text-teal-950'
              }`}>
                {isLocked ? (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-700" />
                    <span>CHƯA MỞ KHÓA</span>
                  </>
                ) : (
                  <>
                    <Unlock className="w-3.5 h-3.5 text-teal-700" />
                    <span>ĐÃ MỞ KHÓA</span>
                  </>
                )}
              </div>

              {/* Quick Star Favorite Toggle (Interactive when unlocked) */}
              {!isLocked && (
                <button
                  id="quick-detail-fav-btn"
                  type="button"
                  onClick={(e) => onToggleFavorite(character.id, e)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center backdrop-blur-md border transition-all cursor-pointer shadow-xs active:scale-95 ${
                    isFavorite
                      ? 'bg-amber-400 border-amber-300 text-amber-950 shadow-[0_2px_10px_rgba(251,191,36,0.4)]'
                      : 'bg-white/85 border-white text-slate-500 hover:text-amber-600 hover:bg-white'
                  }`}
                  aria-label={isFavorite ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
                  title={isFavorite ? "Bỏ yêu thích" : "Đánh dấu yêu thích"}
                >
                  <Star className={`w-4 h-4 ${isFavorite ? 'fill-amber-950' : ''}`} />
                </button>
              )}
            </div>
          </div>

          {/* ================= RIGHT COLUMN: INFORMATION (7 COLS) ================= */}
          <div className="md:col-span-7 h-full min-h-0 overflow-y-auto overflow-x-hidden p-5 sm:p-7 md:p-8 flex flex-col space-y-6 bg-white scrollbar-thin scrollbar-thumb-slate-200">
            <div className="space-y-5">
              {/* Header: Strictly character.name (NO generated prefixes/suffixes/titles) */}
              <div className="space-y-1">
                <div className="text-[11px] font-mono tracking-widest text-cyan-800 uppercase font-semibold flex items-center gap-1.5">
                  <span>🐟</span>
                  <span>THÔNG TIN NHÂN VẬT</span>
                </div>
                
                {/* Character Name Rule: Strictly character.name */}
                <h2 
                  className="text-2xl sm:text-3xl font-bold text-[#0a2540] tracking-wide"
                  style={{ fontFamily: "'Cinzel', serif" }}
                >
                  {isLocked ? '???' : character.name}
                </h2>

                {/* Optional Quote (Only if unlocked and exists) */}
                {!isLocked && character.quote && (
                  <p className="mt-2 text-xs sm:text-sm italic text-[#1b436a] border-l-2 border-cyan-400 pl-3 py-0.5 leading-relaxed font-light">
                    "{character.quote}"
                  </p>
                )}
              </div>

              {/* UNLOCKED CONTROLS: Favorite & Cá Cưng (Pet) strictly separated */}
              {!isLocked && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  {/* Cá Cưng (Pet) Toggle Button */}
                  <button
                    id="detail-toggle-pet-btn"
                    type="button"
                    onClick={() => onTogglePet && onTogglePet(character.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                      isPet
                        ? 'bg-amber-100 border-amber-300 text-amber-950 shadow-xs'
                        : 'bg-white/90 border-slate-200/90 text-[#1e446a] hover:border-amber-300 hover:text-amber-900'
                    }`}
                  >
                    <Fish className="w-3.5 h-3.5 text-amber-700" />
                    <span>{isPet ? 'Đang là Cá Cưng (Bỏ đặt)' : 'Đặt làm Cá Cưng'}</span>
                  </button>

                  {/* Favorite Toggle Button */}
                  <button
                    id="detail-toggle-fav-btn"
                    type="button"
                    onClick={(e) => onToggleFavorite(character.id, e)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-semibold border flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shadow-2xs ${
                      isFavorite
                        ? 'bg-amber-400 border-amber-300 text-amber-950 shadow-xs'
                        : 'bg-white/90 border-slate-200/90 text-[#1e446a] hover:border-amber-300 hover:text-amber-900'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${isFavorite ? 'fill-amber-950' : ''}`} />
                    <span>{isFavorite ? 'Đã yêu thích' : 'Thêm vào yêu thích'}</span>
                  </button>

                  {/* External URL Link if available */}
                  {hasValidLink && character.characterLink && (
                    <a
                      id="detail-open-link-btn"
                      href={character.characterLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3.5 py-2.5 rounded-xl bg-cyan-50 hover:bg-cyan-100 border border-cyan-200/90 text-cyan-900 text-xs font-semibold inline-flex items-center gap-1.5 transition-all shadow-2xs min-h-[44px] sm:min-h-[38px]"
                    >
                      <span>Mở liên kết nhân vật</span>
                      <ExternalLink className="w-3.5 h-3.5 text-cyan-700" />
                    </a>
                  )}
                </div>
              )}

              {/* LOCKED STATE: Clean Unlock Instructions & Controls */}
              {isLocked && (
                <div className="space-y-3.5 pt-1">
                  <div className="p-4 rounded-2xl bg-sky-50/90 border border-sky-200/80 space-y-1.5">
                    <div className="flex items-center gap-2 text-[#0a2540] font-semibold text-xs sm:text-sm">
                      <Lock className="w-4 h-4 text-sky-700" />
                      <span>Nhân vật đang bị phong ấn</span>
                    </div>
                    <p className="text-xs text-[#204970] leading-relaxed font-light">
                      Nhân vật này chưa được mở khóa cho tài khoản của bạn. Hãy làm theo hướng dẫn bên dưới để đưa sinh linh này vào Bể Cá.
                    </p>
                  </div>

                  {/* Unlock Flow 1: Code Unlock */}
                  {character.unlockType === 'code' && (
                    <form onSubmit={handleCodeUnlock} className="space-y-3 p-4 rounded-2xl bg-white border border-cyan-200 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0a2540]">
                        <KeyRound className="w-4 h-4 text-cyan-600" />
                        <span>Mở khóa bằng mã bảo mật</span>
                      </div>
                      <p className="text-xs text-[#285075] font-light">
                        Nhập mật mã do hệ thống hoặc sự kiện cung cấp để giải phóng phong ấn.
                      </p>

                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          id="unlock-code-input"
                          type="text"
                          value={inputCode}
                          onChange={(e) => setInputCode(e.target.value)}
                          placeholder="Nhập mã mở khóa..."
                          disabled={isSubmitting}
                          className="flex-1 px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs font-mono uppercase tracking-wider text-[#0a2540] placeholder:text-slate-400 placeholder:normal-case focus:outline-hidden focus:ring-2 focus:ring-cyan-500"
                        />
                        <button
                          id="submit-unlock-code-btn"
                          type="submit"
                          disabled={isSubmitting || !inputCode.trim()}
                          className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-semibold tracking-wider transition-all cursor-pointer shadow-xs active:scale-98 flex items-center justify-center gap-1.5"
                        >
                          {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>{isSubmitting ? 'ĐANG XỬ LÝ...' : 'MỞ KHÓA'}</span>
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Unlock Flow 2: Condition Unlock */}
                  {character.unlockType === 'condition' && (
                    <div className="space-y-3 p-4 rounded-2xl bg-white border border-cyan-200 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0a2540]">
                        <Compass className="w-4 h-4 text-cyan-600" />
                        <span>Điều kiện cần đạt</span>
                      </div>
                      
                      <p className="text-xs text-[#285075] font-light">
                        {character.unlockCondition?.description || 'Hoàn thành các cột mốc trong Bể Cá để kích hoạt mở khóa.'}
                      </p>

                      {conditionEvaluation && (
                        <div className="space-y-1.5 pt-1">
                          <div className="flex items-center justify-between text-xs font-medium text-[#0a2540]">
                            <span>Tiến độ hiện tại:</span>
                            <span className="font-mono text-cyan-800">
                              {conditionEvaluation.current} / {conditionEvaluation.target} nhân vật
                            </span>
                          </div>
                          {/* Progress bar */}
                          <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                            <div 
                              className="h-full bg-gradient-to-r from-teal-400 to-cyan-500 transition-all duration-300"
                              style={{ 
                                width: `${Math.min(100, Math.round((conditionEvaluation.current / conditionEvaluation.target) * 100))}%` 
                              }}
                            />
                          </div>
                        </div>
                      )}

                      <button
                        id="evaluate-condition-btn"
                        type="button"
                        onClick={handleConditionUnlock}
                        disabled={isSubmitting}
                        className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 disabled:opacity-50 text-white text-xs font-semibold tracking-wider transition-all cursor-pointer shadow-xs active:scale-98 flex items-center justify-center gap-2"
                      >
                        {isSubmitting ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                        <span>{isSubmitting ? 'ĐANG KIỂM TRA...' : 'KIỂM TRA ĐIỀU KIỆN & MỞ KHÓA'}</span>
                      </button>
                    </div>
                  )}

                  {/* Unlock Flow 3: Manual Unlock */}
                  {character.unlockType === 'manual' && (
                    <div className="space-y-3 p-4 rounded-2xl bg-white border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#0a2540]">
                        <ShieldAlert className="w-4 h-4 text-slate-600" />
                        <span>Chế độ mở khóa thủ công</span>
                      </div>
                      <p className="text-xs text-[#285075] font-light leading-relaxed">
                        Nhân vật này chưa được mở khóa cho tài khoản này. Quyền truy cập được cấp riêng bởi Quản trị viên (Admin).
                      </p>

                      {/* Admin manual grant control */}
                      {isAdmin && (
                        <div className="pt-2 border-t border-slate-100 space-y-2">
                          <span className="text-[11px] font-mono uppercase text-sky-800 font-semibold tracking-wider flex items-center gap-1">
                            <Shield className="w-3 h-3" />
                            <span>Quyền Quản Trị Viên (Admin)</span>
                          </span>
                          <button
                            id="admin-grant-unlock-btn"
                            type="button"
                            onClick={handleAdminManualGrant}
                            disabled={isSubmitting}
                            className="w-full px-4 py-2 rounded-xl bg-sky-700 hover:bg-sky-600 text-white text-xs font-medium flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-xs"
                          >
                            <Unlock className="w-3.5 h-3.5" />
                            <span>Cấp quyền mở khóa cho tài khoản này</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Unlock Flow 4: None Unlock */}
                  {character.unlockType === 'none' && (
                    <button
                      id="unlock-immediate-btn"
                      type="button"
                      onClick={handleImmediateUnlock}
                      disabled={isSubmitting}
                      className="w-full px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-400 hover:to-cyan-400 text-white text-xs font-semibold tracking-wider transition-all cursor-pointer shadow-xs flex items-center justify-center gap-2"
                    >
                      {isSubmitting ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      <span>{isSubmitting ? 'ĐANG MỞ KHÓA...' : 'ĐƯA VÀO BỂ CÁ'}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Feedback messages */}
              {errorMessage && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {successMessage && (
                <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 text-teal-900 text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-teal-700 flex-shrink-0" />
                  <span>{successMessage}</span>
                </div>
              )}

              {/* UNLOCKED DETAILS: Description & Dynamic Tags */}
              {!isLocked && (
                <div className="space-y-4 pt-1">
                  {/* Description: Rendered directly without "Mô Tả / Giới Thiệu" label, omitted if empty */}
                  {(() => {
                    const cleanDetailDesc = stripDescriptionHeading(character.description);
                    if (!cleanDetailDesc) return null;
                    return (
                      <div>
                        <p className="text-xs sm:text-sm text-[#193a5e] leading-relaxed font-light whitespace-pre-line">
                          {cleanDetailDesc}
                        </p>
                      </div>
                    );
                  })()}

                  {/* Dynamic Tags: Rendered directly without 'Thẻ Phân Loại' label */}
                  {character.tags && character.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {character.tags.map((tag, idx) => (
                        <span
                          key={idx}
                          className="text-xs px-2.5 py-1 rounded-lg bg-white/90 border border-cyan-200/80 text-cyan-950 font-medium shadow-2xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Character Comments (Bình Luận) - Placed below Thẻ Phân Loại */}
                  <CharacterComments 
                    characterId={character.id} 
                    characterName={character.name} 
                  />
                </div>
              )}

              {/* Character Comments if character is locked */}
              {isLocked && (
                <CharacterComments 
                  characterId={character.id} 
                  characterName={character.name} 
                />
              )}

              {/* ================= ADMIN MANAGEMENT SECTION (ADMIN ONLY) ================= */}
              {isAdmin && (
                <div 
                  id="admin-character-detail-controls"
                  className="p-4 rounded-2xl bg-slate-900 text-white space-y-3 shadow-md border border-slate-800 animate-fadeIn"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-mono font-semibold uppercase text-cyan-400">
                      <Shield className="w-3.5 h-3.5" />
                      <span>QUẢN TRỊ VIÊN (ADMIN CONTROLS)</span>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-cyan-900/60 text-cyan-300 border border-cyan-700">
                      ID: {character.id}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1">
                    {/* Edit Character Button */}
                    <button
                      type="button"
                      onClick={() => setIsEditModalOpen(true)}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                    >
                      <Edit3 className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Chỉnh sửa</span>
                    </button>

                    {/* Toggle Global Lock Button */}
                    <button
                      type="button"
                      onClick={handleAdminToggleGlobalLock}
                      disabled={isTogglingLock}
                      className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs text-white font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-slate-700"
                    >
                      {isLocked ? (
                        <>
                          <Unlock className="w-3.5 h-3.5 text-teal-400" />
                          <span>Mở toàn cục</span>
                        </>
                      ) : (
                        <>
                          <Lock className="w-3.5 h-3.5 text-amber-400" />
                          <span>Khóa toàn cục</span>
                        </>
                      )}
                    </button>

                    {/* Delete Character Button */}
                    <button
                      type="button"
                      onClick={() => setShowDeleteConfirm(true)}
                      className="px-3 py-2 rounded-xl bg-rose-950/60 hover:bg-rose-900/80 text-xs text-rose-300 font-medium flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-rose-800"
                    >
                      <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                      <span>Xóa nhân vật</span>
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Bottom Actions */}
            <div className="pt-4 border-t border-slate-200/70 flex flex-col sm:flex-row items-center justify-between gap-3">
              <span className="text-[11px] text-slate-400 font-light hidden sm:inline">
                Nhấn ESC hoặc click bên ngoài để đóng
              </span>
              <button
                id="close-modal-footer-btn"
                type="button"
                onClick={onClose}
                className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-200 text-[#193a5e] text-xs font-semibold transition-colors cursor-pointer shadow-2xs active:scale-98 min-h-[44px] sm:min-h-[38px] flex items-center justify-center gap-1.5"
              >
                <span>Quay lại Bể Cá</span>
              </button>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Dialog */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-sm animate-fadeIn">
            <div className="glass-panel rounded-2xl p-6 max-w-md w-full bg-white border border-rose-200 shadow-2xl space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
                <Trash2 className="w-6 h-6" />
              </div>
              <div className="text-center space-y-1">
                <h3 className="text-base font-bold text-[#0a2540]">
                  Xác nhận xóa nhân vật?
                </h3>
                <p className="text-xs text-[#285075] font-light leading-relaxed">
                  Bạn có chắc chắn muốn xóa nhân vật <strong>"{character.name}"</strong>? Thao tác này sẽ xóa nhân vật khỏi catalog và dọn dẹp các dữ liệu liên quan. Thao tác này <strong>không thể hoàn tác</strong>.
                </p>
              </div>
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="button"
                  onClick={handleAdminConfirmDelete}
                  disabled={isDeleting}
                  className="flex-1 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-xs font-medium text-white transition-colors cursor-pointer shadow-xs flex items-center justify-center gap-1.5"
                >
                  {isDeleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{isDeleting ? 'Đang xóa...' : 'Xác nhận xóa'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Admin Character Edit Modal */}
        {isEditModalOpen && (
          <AdminCharacterModal
            isOpen={isEditModalOpen}
            onClose={() => setIsEditModalOpen(false)}
            characterToEdit={character}
            onSaved={() => {
              setIsEditModalOpen(false);
              setSuccessMessage('Đã cập nhật thông tin nhân vật thành công.');
            }}
          />
        )}
      </div>
    </div>
  );
};
