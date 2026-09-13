import React, { useState, useEffect } from 'react';
import { Character } from '../../types';
import { characterRepository } from '../../services/characterRepository';
import { AdminCharacterModal } from './AdminCharacterModal';
import { resolveCharacterImageUrl, DEFAULT_FALLBACK_AVATAR } from '../../lib/imageUtils';
import { storageService } from '../../services/storageService';
import { 
  Fish, 
  Search, 
  Plus, 
  Edit3, 
  Trash2, 
  Lock, 
  Unlock, 
  AlertCircle, 
  Check, 
  ExternalLink,
  ShieldAlert,
  Loader2,
  Eye,
  EyeOff,
  KeyRound
} from 'lucide-react';

interface AdminCharactersProps {
  onOpenUnlockConfig: (characterId: string) => void;
  onRequestAdd?: boolean;
  onResetRequestAdd?: () => void;
}

export const AdminCharacters: React.FC<AdminCharactersProps> = ({
  onOpenUnlockConfig,
  onRequestAdd,
  onResetRequestAdd,
}) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLock, setFilterLock] = useState<'all' | 'locked' | 'unlocked'>('all');
  const [filterVisibility, setFilterVisibility] = useState<'all' | 'visible' | 'hidden'>('all');
  const [loading, setLoading] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCharacter, setEditingCharacter] = useState<Character | null>(null);

  // Delete Confirmation State
  const [deletingCharacter, setDeletingCharacter] = useState<Character | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Toast / Feedback State
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadCharacters = () => {
    setLoading(true);
    try {
      const data = characterRepository.loadCatalog();
      setCharacters(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Không thể tải danh sách nhân vật.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCharacters();

    const handleUpdate = () => loadCharacters();
    window.addEventListener('be_ca_catalog_updated', handleUpdate);
    return () => window.removeEventListener('be_ca_catalog_updated', handleUpdate);
  }, []);

  // Handle trigger from parent overview
  useEffect(() => {
    if (onRequestAdd) {
      setEditingCharacter(null);
      setIsModalOpen(true);
      if (onResetRequestAdd) onResetRequestAdd();
    }
  }, [onRequestAdd, onResetRequestAdd]);

  // Filter & Search
  const filtered = characters.filter((c) => {
    const isLockMatch = 
      filterLock === 'all' ||
      (filterLock === 'locked' && Boolean(c.isLocked ?? c.locked)) ||
      (filterLock === 'unlocked' && !Boolean(c.isLocked ?? c.locked));

    const isVisibilityMatch =
      filterVisibility === 'all' ||
      (filterVisibility === 'visible' && !Boolean(c.isHidden)) ||
      (filterVisibility === 'hidden' && Boolean(c.isHidden));

    const q = searchQuery.toLowerCase().trim();
    const isSearchMatch = 
      !q ||
      c.name.toLowerCase().includes(q) ||
      (c.tags && c.tags.some((t) => t.toLowerCase().includes(q))) ||
      (c.description && c.description.toLowerCase().includes(q));

    return isLockMatch && isVisibilityMatch && isSearchMatch;
  });

  const handleToggleLock = async (char: Character) => {
    const currentLock = Boolean(char.isLocked ?? char.locked);
    try {
      await characterRepository.toggleGlobalLock(char.id, !currentLock);
      setFeedback({
        type: 'success',
        message: `Đã chuyển nhân vật "${char.name}" sang trạng thái: ${!currentLock ? 'Khóa 🔒' : 'Mở tự do 🔓'}.`,
      });
      loadCharacters();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi thay đổi trạng thái khóa.' });
    }
  };

  const handleToggleVisibility = async (char: Character) => {
    const currentHidden = Boolean(char.isHidden);
    try {
      await characterRepository.toggleVisibility(char.id, !currentHidden);
      setFeedback({
        type: 'success',
        message: `Đã chuyển nhân vật "${char.name}" sang trạng thái: ${!currentHidden ? 'Ẩn khỏi Bể Cá 👁️‍🗨️' : 'Hiển thị trong Bể Cá 👁️'}.`,
      });
      loadCharacters();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi thay đổi trạng thái hiển thị.' });
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingCharacter) return;
    setIsDeleting(true);
    try {
      await characterRepository.deleteCharacter(deletingCharacter.id);
      setFeedback({
        type: 'success',
        message: `Đã xóa nhân vật "${deletingCharacter.name}" và dọn dẹp các quan hệ liên quan thành công.`,
      });
      setDeletingCharacter(null);
      loadCharacters();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi xóa nhân vật.' });
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div id="admin-characters-page" className="space-y-6 animate-fadeIn">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono uppercase tracking-widest font-semibold">
            <span>🐟</span>
            <span>CATALOG NHÂN VẬT</span>
          </div>
          <h1 
            className="text-2xl sm:text-3xl font-bold text-white tracking-wide mt-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Quản Lý Nhân Vật
          </h1>
          <p className="text-xs text-slate-400 font-light mt-0.5">
            Thêm, sửa thông tin, phân loại thẻ dynamic, thiết lập cờ khóa và cấu hình mở khóa.
          </p>
        </div>

        {/* Primary Add Button (Admin Only!) */}
        <button
          id="admin-add-character-btn"
          type="button"
          onClick={() => {
            setEditingCharacter(null);
            setIsModalOpen(true);
          }}
          className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer flex-shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Thêm Nhân Vật</span>
        </button>
      </div>

      {/* Feedback Toast Banner */}
      {feedback && (
        <div className={`p-3.5 rounded-2xl text-xs flex items-center justify-between gap-3 ${
          feedback.type === 'success' 
            ? 'bg-teal-950/70 border border-teal-800 text-teal-200' 
            : 'bg-red-950/70 border border-red-800 text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            )}
            <span>{feedback.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-white text-xs cursor-pointer font-mono"
          >
            ✕
          </button>
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row items-center gap-3 bg-slate-800/40 p-3 rounded-2xl border border-slate-700/60">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo tên nhân vật, thẻ tag..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'locked', 'unlocked'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setFilterLock(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                filterLock === filter
                  ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-semibold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'all' && 'Tất cả khóa'}
              {filter === 'locked' && '🔒 Đang khóa'}
              {filter === 'unlocked' && '🔓 Mở tự do'}
            </button>
          ))}

          {(['all', 'visible', 'hidden'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setFilterVisibility(filter)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                filterVisibility === filter
                  ? 'bg-teal-500/20 border-teal-400 text-teal-200 font-semibold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'all' && 'Tất cả hiển thị'}
              {filter === 'visible' && '👁️ Đang hiện'}
              {filter === 'hidden' && '👁️‍🗨️ Đang ẩn'}
            </button>
          ))}
        </div>
      </div>

      {/* Table / List of Characters */}
      <div className="bg-slate-800/50 border border-slate-700/70 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            <span className="text-xs font-mono">Đang tải dữ liệu nhân vật...</span>
          </div>
        ) : filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 sm:p-4">Nhân Vật</th>
                  <th className="p-3.5 sm:p-4">Thẻ Tags</th>
                  <th className="p-3.5 sm:p-4">Hiển Thị</th>
                  <th className="p-3.5 sm:p-4">Trạng Thái Khóa</th>
                  <th className="p-3.5 sm:p-4">Kiểu Mở Khóa</th>
                  <th className="p-3.5 sm:p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filtered.map((char) => {
                  const locked = Boolean(char.isLocked ?? char.locked);
                  const isHidden = Boolean(char.isHidden);
                  return (
                    <tr key={char.id} className="hover:bg-slate-800/60 transition-colors">
                      {/* Name & Avatar */}
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
                            <img
                              src={resolveCharacterImageUrl(char.avatar)}
                              alt={char.name}
                              className="w-full h-full object-cover"
                              onError={async (e) => {
                                const fallback = await storageService.resolveCharacterImageFallback(char.avatar);
                                if (fallback) {
                                  (e.target as HTMLImageElement).src = fallback;
                                } else {
                                  (e.target as HTMLImageElement).src = DEFAULT_FALLBACK_AVATAR;
                                }
                              }}
                            />
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm flex items-center gap-1.5">
                              <span>{char.name}</span>
                              {char.characterLink && (
                                <a
                                  href={char.characterLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-cyan-400 hover:text-cyan-300 inline-flex"
                                  title="Liên kết ngoài"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-400 font-light line-clamp-1 max-w-xs">
                              {char.shortDescription || char.description || 'Chưa có mô tả'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Dynamic Tags */}
                      <td className="p-3.5 sm:p-4">
                        <div className="flex flex-wrap gap-1 max-w-xs">
                          {char.tags && char.tags.length > 0 ? (
                            char.tags.map((tag, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[10px] text-slate-300 font-medium"
                              >
                                {tag}
                              </span>
                            ))
                          ) : (
                            <span className="text-[10px] text-slate-500 font-mono italic">
                              Chưa gắn thẻ
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Visibility Status (Ẩn / Hiện) */}
                      <td className="p-3.5 sm:p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleVisibility(char)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                            isHidden
                              ? 'bg-slate-800/80 border-slate-600 text-slate-400 hover:bg-slate-700/80'
                              : 'bg-teal-950/60 border-teal-800 text-teal-300 hover:bg-teal-900/60'
                          }`}
                          title="Nhấn để đổi trạng thái hiển thị (Ẩn / Hiện) với người dùng"
                        >
                          {isHidden ? (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-400" />
                              <span>Đang ẩn</span>
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3 text-teal-400" />
                              <span>Đang hiện</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Lock Status */}
                      <td className="p-3.5 sm:p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleLock(char)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                            locked
                              ? 'bg-amber-950/60 border-amber-800 text-amber-300 hover:bg-amber-900/60'
                              : 'bg-cyan-950/60 border-cyan-800 text-cyan-300 hover:bg-cyan-900/60'
                          }`}
                          title="Nhấn để đổi trạng thái khóa toàn cục"
                        >
                          {locked ? (
                            <>
                              <Lock className="w-3 h-3 text-amber-400" />
                              <span>Đang khóa</span>
                            </>
                          ) : (
                            <>
                              <Unlock className="w-3 h-3 text-cyan-400" />
                              <span>Mở tự do</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Unlock Type */}
                      <td className="p-3.5 sm:p-4">
                        <div className="font-mono text-[11px]">
                          <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700 uppercase font-semibold text-slate-300">
                            {char.unlockType || 'none'}
                          </span>
                          {char.unlockType === 'condition' && char.unlockCondition && (
                            <p className="text-[10px] text-cyan-400/80 mt-1 line-clamp-1 max-w-xs font-sans">
                              {char.unlockCondition.description}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 sm:p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenUnlockConfig(char.id)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-900/50 text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                            title="Cấu hình mở khóa nhân vật"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCharacter(char);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Chỉnh sửa nhân vật"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingCharacter(char)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Xóa nhân vật"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-16 text-center text-slate-400 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
              <Fish className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">Chưa có Character nào</h3>
            <p className="text-xs text-slate-500 font-light max-w-sm mx-auto">
              {searchQuery
                ? 'Không tìm thấy nhân vật nào phù hợp với từ khóa tìm kiếm.'
                : 'Catalog hiện tại đang trống. Nhấn "+ Thêm Nhân Vật" để bắt đầu khởi tạo.'}
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Character Modal */}
      <AdminCharacterModal
        isOpen={isModalOpen}
        characterToEdit={editingCharacter}
        onClose={() => {
          setIsModalOpen(false);
          setEditingCharacter(null);
        }}
        onSaved={() => {
          loadCharacters();
          setFeedback({
            type: 'success',
            message: editingCharacter
              ? `Đã cập nhật nhân vật "${editingCharacter.name}" thành công.`
              : 'Đã thêm nhân vật mới vào catalog thành công.',
          });
        }}
      />

      {/* Delete Confirmation Modal (Safety Confirmation) */}
      {deletingCharacter && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-red-800/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400 flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác Nhận Xóa Nhân Vật</h3>
                <p className="text-xs text-slate-400 font-light">Thao tác nguy hiểm • Có tính chất vĩnh viễn</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc muốn xóa nhân vật <strong>"{deletingCharacter.name}"</strong> không?
            </p>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-amber-400/90 font-light">
              ⚠️ Hệ thống sẽ tự động dọn dẹp quan hệ <code>user_characters</code> và các dữ liệu liên kết liên quan để tránh tình trạng dữ liệu mồ côi.
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingCharacter(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-semibold shadow-md cursor-pointer flex items-center gap-1.5"
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang xóa...</span>
                  </>
                ) : (
                  <span>Xác Nhận Xóa</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
