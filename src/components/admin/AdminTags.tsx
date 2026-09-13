import React, { useState, useEffect } from 'react';
import { Tag } from '../../types';
import { tagRepository } from '../../services/tagRepository';
import { characterRepository } from '../../services/characterRepository';
import { 
  Tag as TagIcon, 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  AlertCircle, 
  Search, 
  ShieldAlert, 
  Loader2,
  Users,
  X,
  Fish,
  MinusCircle,
  PlusCircle
} from 'lucide-react';

interface AdminTagsProps {
  onRequestAdd?: boolean;
  onResetRequestAdd?: () => void;
}

export const AdminTags: React.FC<AdminTagsProps> = ({ onRequestAdd, onResetRequestAdd }) => {
  const [tags, setTags] = useState<Tag[]>([]);
  const [usageCounts, setUsageCounts] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);

  // New Tag Form State
  const [newTagName, setNewTagName] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  // Edit Tag State
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [editingTagName, setEditingTagName] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  // Delete Tag Confirmation
  const [deletingTag, setDeletingTag] = useState<Tag | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Manage Characters with Tag Modal State
  const [viewingTag, setViewingTag] = useState<Tag | null>(null);
  const [taggedCharacters, setTaggedCharacters] = useState<any[]>([]);
  const [allCharacters, setAllCharacters] = useState<any[]>([]);
  const [selectedCharToAttach, setSelectedCharToAttach] = useState<string>('');
  const [isTagActionLoading, setIsTagActionLoading] = useState(false);

  // Toast Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadTags = async () => {
    setLoading(true);
    try {
      const [allTags, counts] = await Promise.all([
        tagRepository.getAllTags(),
        tagRepository.getTagUsageCounts(),
      ]);
      setTags(allTags);
      setUsageCounts(counts);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Không thể tải danh sách thẻ tag.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTags();

    const handleUpdate = () => loadTags();
    window.addEventListener('be_ca_tags_updated', handleUpdate);
    window.addEventListener('be_ca_catalog_updated', handleUpdate);

    return () => {
      window.removeEventListener('be_ca_tags_updated', handleUpdate);
      window.removeEventListener('be_ca_catalog_updated', handleUpdate);
    };
  }, []);

  const handleCreateTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagName.trim()) return;

    setIsCreating(true);
    setFeedback(null);
    try {
      const created = await tagRepository.createTag(newTagName.trim());
      setFeedback({
        type: 'success',
        message: `Đã tạo thẻ tag mới "${created.name}" thành công.`,
      });
      setNewTagName('');
      loadTags();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Không thể tạo thẻ tag.' });
    } finally {
      setIsCreating(false);
    }
  };

  const handleStartEdit = (tag: Tag) => {
    setEditingTagId(tag.id);
    setEditingTagName(tag.name);
    setFeedback(null);
  };

  const handleSaveEdit = async (id: string) => {
    if (!editingTagName.trim()) return;
    setIsUpdating(true);
    try {
      const updated = await tagRepository.updateTag(id, editingTagName.trim());
      setFeedback({
        type: 'success',
        message: `Đã cập nhật tên thẻ tag thành "${updated.name}" và đồng bộ các nhân vật liên quan.`,
      });
      setEditingTagId(null);
      setEditingTagName('');
      loadTags();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Không thể chỉnh sửa thẻ tag.' });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deletingTag) return;
    setIsDeleting(true);
    try {
      const result = await tagRepository.deleteTag(deletingTag.id);
      const affected = result && typeof result === 'object' ? result.affectedCount : 0;
      setFeedback({
        type: 'success',
        message: `Đã xóa thẻ tag "${deletingTag.name}" và tự động loại bỏ khỏi ${
          affected > 0 ? `${affected} nhân vật` : 'toàn bộ nhân vật'
        } trong Bể Cá.`,
      });
      if (viewingTag && (viewingTag.id === deletingTag.id || viewingTag.name === deletingTag.name)) {
        setViewingTag(null);
        setTaggedCharacters([]);
      }
      setDeletingTag(null);
      await loadTags();
      const updatedAll = await characterRepository.getAllCharacters();
      setAllCharacters(updatedAll);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Không thể xóa thẻ tag.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const handleOpenTagCharacters = async (tag: Tag) => {
    setViewingTag(tag);
    setIsTagActionLoading(true);
    try {
      const [tagged, all] = await Promise.all([
        tagRepository.getCharactersByTag(tag.name),
        characterRepository.getAllCharacters(),
      ]);
      setTaggedCharacters(tagged);
      setAllCharacters(all);
      setSelectedCharToAttach('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi tải nhân vật của thẻ tag.' });
    } finally {
      setIsTagActionLoading(false);
    }
  };

  const handleDetachTag = async (characterId: string) => {
    if (!viewingTag) return;
    setIsTagActionLoading(true);
    try {
      await tagRepository.toggleTagForCharacter(characterId, viewingTag.id, false);
      const updated = await tagRepository.getCharactersByTag(viewingTag.id);
      setTaggedCharacters(updated);
      loadTags();
      setFeedback({
        type: 'success',
        message: `Đã gỡ thẻ "${viewingTag.name}" khỏi nhân vật thành công.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi gỡ thẻ.' });
    } finally {
      setIsTagActionLoading(false);
    }
  };

  const handleAttachTag = async () => {
    if (!viewingTag || !selectedCharToAttach) return;
    setIsTagActionLoading(true);
    try {
      await tagRepository.toggleTagForCharacter(selectedCharToAttach, viewingTag.id, true);
      const updated = await tagRepository.getCharactersByTag(viewingTag.id);
      setTaggedCharacters(updated);
      setSelectedCharToAttach('');
      loadTags();
      setFeedback({
        type: 'success',
        message: `Đã gắn thẻ "${viewingTag.name}" cho nhân vật thành công.`,
      });
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi gắn thẻ.' });
    } finally {
      setIsTagActionLoading(false);
    }
  };

  const filteredTags = tags.filter((t) =>
    t.name.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  return (
    <div id="admin-tags-page" className="space-y-6 animate-fadeIn">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-teal-400 text-xs font-mono uppercase tracking-widest font-semibold">
            <span>🏷️</span>
            <span>PHÂN LOẠI THẺ DYNAMIC</span>
          </div>
          <h1 
            className="text-2xl sm:text-3xl font-bold text-white tracking-wide mt-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Quản Lý Thẻ Tags
          </h1>
          <p className="text-xs text-slate-400 font-light mt-0.5">
            Dữ liệu động liên kết many-to-many với Character. Không hard-code danh sách tag.
          </p>
        </div>
      </div>

      {/* Feedback Toast */}
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

      {/* Top Controls: Create Tag Form + Search */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Create Tag Form */}
        <form 
          onSubmit={handleCreateTag} 
          className="md:col-span-2 bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60 flex flex-col sm:flex-row items-center gap-2.5"
        >
          <div className="relative flex-1 w-full">
            <TagIcon className="w-4 h-4 text-teal-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
              placeholder="Nhập tên thẻ tag mới (vd: Hướng nội, Kế toán, Khám phá...)"
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
          <button
            type="submit"
            disabled={isCreating || !newTagName.trim()}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold shadow-sm transition-all flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isCreating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Plus className="w-3.5 h-3.5" />
            )}
            <span>+ Tạo Thẻ Tag</span>
          </button>
        </form>

        {/* Search Input */}
        <div className="bg-slate-800/40 p-4 rounded-2xl border border-slate-700/60 flex items-center">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Tìm kiếm thẻ tag..."
              className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-teal-500"
            />
          </div>
        </div>
      </div>

      {/* Tags Grid / Table */}
      <div className="bg-slate-800/50 border border-slate-700/70 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-teal-400" />
            <span className="text-xs font-mono">Đang tải danh sách thẻ tag...</span>
          </div>
        ) : filteredTags.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 sm:p-4">Thẻ Tag</th>
                  <th className="p-3.5 sm:p-4">Số Character Sử Dụng</th>
                  <th className="p-3.5 sm:p-4 text-right">Thao Tác Quản Trị</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filteredTags.map((tag) => {
                  const count = usageCounts[tag.name] || 0;
                  const isEditingThis = editingTagId === tag.id;

                  return (
                    <tr key={tag.id} className="hover:bg-slate-800/60 transition-colors">
                      {/* Tag Name / Inline Edit */}
                      <td className="p-3.5 sm:p-4 font-medium text-white">
                        {isEditingThis ? (
                          <div className="flex items-center gap-2 max-w-xs">
                            <input
                              type="text"
                              value={editingTagName}
                              onChange={(e) => setEditingTagName(e.target.value)}
                              className="px-2.5 py-1 rounded-lg bg-slate-900 border border-teal-500 text-xs text-white focus:outline-none"
                              autoFocus
                            />
                            <button
                              type="button"
                              onClick={() => handleSaveEdit(tag.id)}
                              disabled={isUpdating}
                              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[11px] font-semibold cursor-pointer"
                            >
                              Lưu
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingTagId(null)}
                              className="px-2 py-1 rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-300 text-[11px] cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800 border border-slate-700 text-slate-200">
                            <TagIcon className="w-3.5 h-3.5 text-teal-400" />
                            <span>{tag.name}</span>
                          </div>
                        )}
                      </td>

                      {/* Usage Count */}
                      <td className="p-3.5 sm:p-4">
                        <button
                          type="button"
                          onClick={() => handleOpenTagCharacters(tag)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium cursor-pointer transition-colors ${
                            count > 0 
                              ? 'bg-cyan-950/60 border border-cyan-800 text-cyan-300 hover:bg-cyan-900/60' 
                              : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                          }`}
                          title="Nhấn để xem danh sách nhân vật và quản lý gán thẻ"
                        >
                          <Users className="w-3 h-3" />
                          <span>{count} nhân vật</span>
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 sm:p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenTagCharacters(tag)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-cyan-900/50 text-cyan-300 hover:text-cyan-200 transition-colors cursor-pointer"
                            title="Xem nhân vật & Gắn/Bỏ thẻ"
                          >
                            <Users className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleStartEdit(tag)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Sửa tên thẻ tag"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTag(tag)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Xóa thẻ tag"
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
          <div className="py-16 text-center text-slate-400 space-y-2">
            <div className="w-12 h-12 rounded-2xl bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-500 mx-auto">
              <TagIcon className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">Chưa tìm thấy thẻ tag nào</h3>
            <p className="text-xs text-slate-500 font-light">
              Nhập tên thẻ ở phía trên và nhấn "+ Tạo Thẻ Tag" để bắt đầu.
            </p>
          </div>
        )}
      </div>

      {/* Delete Tag Confirmation Modal */}
      {deletingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-red-800/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400 flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác Nhận Xóa Thẻ Tag</h3>
                <p className="text-xs text-slate-400 font-light">Đồng bộ gỡ bỏ thẻ khỏi tất cả Character</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa thẻ tag <strong>"{deletingTag.name}"</strong> không?
            </p>

            {(usageCounts[deletingTag.name] || 0) > 0 && (
              <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-800/60 text-[11px] text-amber-300 font-light">
                ⚠️ Hiện có <strong>{usageCounts[deletingTag.name]}</strong> nhân vật đang gắn thẻ này. Thao tác xóa sẽ tự động gỡ thẻ này khỏi các nhân vật trên.
              </div>
            )}

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTag(null)}
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

      {/* Tag Character Manager Modal (Xem & Gắn/Bỏ thẻ cho nhân vật) */}
      {viewingTag && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl space-y-5 text-slate-100 my-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-cyan-950/80 border border-cyan-800 flex items-center justify-center text-cyan-400">
                  <TagIcon className="w-5 h-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-cyan-400 uppercase tracking-wider font-semibold">
                      QUẢN LÝ GÁN THẺ
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>Thẻ:</span>
                    <span className="text-teal-300">"{viewingTag.name}"</span>
                  </h3>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setViewingTag(null)}
                className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Attach to New Character */}
            <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/80 space-y-2">
              <label className="text-xs font-mono font-medium text-cyan-400 flex items-center gap-1.5">
                <PlusCircle className="w-3.5 h-3.5" />
                <span>GẮN THẺ NÀY CHO NHÂN VẬT</span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={selectedCharToAttach}
                  onChange={(e) => setSelectedCharToAttach(e.target.value)}
                  className="flex-1 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="">-- Chọn nhân vật cần gắn thẻ --</option>
                  {allCharacters
                    .filter((c) => !taggedCharacters.some((tc) => tc.id === c.id))
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!selectedCharToAttach || isTagActionLoading}
                  onClick={handleAttachTag}
                  className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
                >
                  {isTagActionLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Plus className="w-3.5 h-3.5" />
                  )}
                  <span>Gắn Thẻ</span>
                </button>
              </div>
            </div>

            {/* List of Characters having this tag */}
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                <span>DANH SÁCH NHÂN VẬT ĐANG DÙNG THẺ:</span>
                <span className="text-teal-400 font-bold">{taggedCharacters.length} nhân vật</span>
              </div>

              {isTagActionLoading && taggedCharacters.length === 0 ? (
                <div className="py-8 text-center text-slate-400 flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-cyan-400" />
                  <span className="text-xs font-mono">Đang tải...</span>
                </div>
              ) : taggedCharacters.length > 0 ? (
                <div className="max-h-72 overflow-y-auto space-y-2 pr-1 divide-y divide-slate-800">
                  {taggedCharacters.map((char) => (
                    <div
                      key={char.id}
                      className="pt-2 first:pt-0 flex items-center justify-between gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
                          <img
                            src={char.avatar || char.avatarUrl}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-white text-xs truncate">{char.name}</p>
                          <p className="text-[10px] text-slate-400 truncate font-light">
                            {char.shortDescription || char.description || 'Chưa có mô tả'}
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        disabled={isTagActionLoading}
                        onClick={() => handleDetachTag(char.id)}
                        className="px-2.5 py-1.5 rounded-xl bg-red-950/60 hover:bg-red-900/80 border border-red-800/80 text-red-300 text-[11px] font-medium flex items-center gap-1 cursor-pointer transition-colors flex-shrink-0"
                        title="Gỡ thẻ khỏi nhân vật này"
                      >
                        <MinusCircle className="w-3.5 h-3.5" />
                        <span>Bỏ thẻ</span>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center text-slate-500 bg-slate-800/30 border border-slate-800 rounded-2xl">
                  <Fish className="w-6 h-6 mx-auto mb-1 text-slate-600" />
                  <p className="text-xs">Chưa có nhân vật nào gắn thẻ "{viewingTag.name}"</p>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="pt-3 border-t border-slate-800 flex justify-end">
              <button
                type="button"
                onClick={() => setViewingTag(null)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
