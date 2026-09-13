import React, { useState, useEffect } from 'react';
import { Character, UnlockType, Tag } from '../../types';
import { characterRepository } from '../../services/characterRepository';
import { tagRepository, normalizeVietnamese } from '../../services/tagRepository';
import { storageService } from '../../services/storageService';
import { 
  resolveCharacterImageUrl, 
  DEFAULT_FALLBACK_AVATAR, 
  isTemporaryBlobUrl, 
  isValidCharacterImage, 
  normalizePersistentImageReference 
} from '../../lib/imageUtils';
import { 
  X, 
  Upload, 
  Check, 
  AlertCircle, 
  Plus, 
  Lock, 
  Unlock, 
  KeyRound, 
  Compass, 
  Sparkles,
  Loader2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  Link2,
  Trash2
} from 'lucide-react';

interface AdminCharacterModalProps {
  isOpen: boolean;
  onClose: () => void;
  characterToEdit?: Character | null;
  onSaved: () => void;
}

export const AdminCharacterModal: React.FC<AdminCharacterModalProps> = ({
  isOpen,
  onClose,
  characterToEdit,
  onSaved,
}) => {
  const isEditing = Boolean(characterToEdit);

  // Form Fields
  const [name, setName] = useState('');
  const [avatar, setAvatar] = useState('');
  // Distinct Image Mode: 'upload' (upload from computer) vs 'url' (enter direct external link)
  const [imageMode, setImageMode] = useState<'upload' | 'url'>('upload');
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [characterLink, setCharacterLink] = useState('');
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [isLocked, setIsLocked] = useState(false);
  const [isHidden, setIsHidden] = useState(false);
  const [unlockType, setUnlockType] = useState<UnlockType>('none');
  const [unlockCode, setUnlockCode] = useState('');
  const [requiredCount, setRequiredCount] = useState<number>(3);
  const [conditionDescription, setConditionDescription] = useState('');
  const [quote, setQuote] = useState('');

  // Available dynamic tags from tagRepository
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [newTagInput, setNewTagInput] = useState('');

  // Upload States
  const [isUploading, setIsUploading] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Feedback
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Hydrate form on open and listen for tag updates
  useEffect(() => {
    let isMounted = true;
    if (isOpen) {
      const hydrate = async () => {
        const latestTags = await tagRepository.getAllTags();
        if (!isMounted) return;
        setAllTags(latestTags);

        if (characterToEdit) {
          setName(characterToEdit.name);
          const rawAvatar = characterToEdit.avatar || '';
          const resolvedAvatar = resolveCharacterImageUrl(rawAvatar);
          setAvatar(resolvedAvatar);
          if (rawAvatar.startsWith('http://') || (rawAvatar.startsWith('https://') && !rawAvatar.includes('/storage/'))) {
            setImageMode('url');
            setDirectUrlInput(rawAvatar);
          } else {
            setImageMode('upload');
            setDirectUrlInput('');
          }
          setShortDescription(characterToEdit.shortDescription || '');
          setDescription(characterToEdit.description || '');
          setCharacterLink(characterToEdit.characterLink || '');
          setIsLocked(Boolean(characterToEdit.isLocked ?? characterToEdit.locked));
          setIsHidden(Boolean(characterToEdit.isHidden));
          setUnlockType(characterToEdit.unlockType || 'none');
          setQuote(characterToEdit.quote || '');

          if (characterToEdit.unlockCondition) {
            setRequiredCount(characterToEdit.unlockCondition.requiredCount || 3);
            setConditionDescription(characterToEdit.unlockCondition.description || '');
          } else {
            setRequiredCount(3);
            setConditionDescription('');
          }

          // Fetch secret code if unlockType is code
          const code = characterRepository.getSecretCode(characterToEdit.id);
          setUnlockCode(code || '');

          // Fetch tag IDs from Supabase junction table character_tags
          const junctionTagIds = await tagRepository.getCharacterTagIds(characterToEdit.id);
          // Also match from characterToEdit.tags
          const matchedTagIds: string[] = [];
          if (Array.isArray(characterToEdit.tags)) {
            characterToEdit.tags.forEach((t) => {
              const norm = normalizeVietnamese(t);
              const found = latestTags.find(
                (tag) => tag.id === t || normalizeVietnamese(tag.name) === norm
              );
              if (found && !matchedTagIds.includes(found.id)) {
                matchedTagIds.push(found.id);
              }
            });
          }
          const mergedIds = Array.from(new Set([...junctionTagIds, ...matchedTagIds]));
          setSelectedTagIds(mergedIds);
        } else {
          // Reset form for create
          setName('');
          setAvatar('');
          setImageMode('upload');
          setDirectUrlInput('');
          setShortDescription('');
          setDescription('');
          setCharacterLink('');
          setSelectedTagIds([]);
          setIsLocked(false);
          setIsHidden(false);
          setUnlockType('none');
          setUnlockCode('');
          setRequiredCount(3);
          setConditionDescription('');
          setQuote('');
        }

        setFormError(null);
        setUploadFeedback(null);
        setNewTagInput('');
      };

      hydrate();

      const handleTagUpdate = () => {
        tagRepository.getAllTags().then((latest) => {
          if (!isMounted) return;
          setAllTags(latest);
          // Purge any selected tag IDs that no longer exist
          const validIds = new Set(latest.map((t) => t.id));
          setSelectedTagIds((prev) => prev.filter((id) => validIds.has(id)));
        });
      };
      window.addEventListener('be_ca_tags_updated', handleTagUpdate);

      return () => {
        isMounted = false;
        window.removeEventListener('be_ca_tags_updated', handleTagUpdate);
      };
    }
  }, [isOpen, characterToEdit]);

  if (!isOpen) return null;

  const handleToggleTag = (tagId: string) => {
    setSelectedTagIds((prev) =>
      prev.includes(tagId) ? prev.filter((id) => id !== tagId) : [...prev, tagId]
    );
  };

  const handleQuickAddTag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTagInput.trim()) return;
    try {
      const created = await tagRepository.createTag(newTagInput.trim());
      setAllTags((prev) => [...prev.filter((t) => t.id !== created.id), created]);
      setSelectedTagIds((prev) => [...prev, created.id]);
      setNewTagInput('');
    } catch (err: any) {
      setFormError(err.message || 'Không thể tạo thẻ tag mới.');
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setUploadFeedback({
        type: 'error',
        message: 'Vui lòng chọn file hình ảnh hợp lệ (PNG, JPG, WEBP, GIF, SVG).',
      });
      return;
    }

    setUploadFeedback(null);
    setIsUploading(true);

    try {
      // 1. File từ máy -> Upload lên Storage
      const result = await storageService.uploadCharacterImage(file, characterToEdit?.id);

      // 2. Storage trả về path/reference (ví dụ: /storage/characters/char-5_xxx.jpg)
      if (!result.url || isTemporaryBlobUrl(result.url)) {
        throw new Error('Lỗi tải ảnh: Không thể lấy liên kết lưu trữ lâu dài.');
      }

      // 3. Chuẩn hóa reference ổn định
      const persistentRef = normalizePersistentImageReference(result.url);
      if (!persistentRef || !isValidCharacterImage(persistentRef)) {
        throw new Error('Đường dẫn lưu trữ của file không hợp lệ.');
      }

      setAvatar(persistentRef);
      setImageMode('upload');
      setDirectUrlInput('');

      // 4. Lưu reference/URL vào database ngay nếu đang sửa nhân vật hiện có
      if (characterToEdit?.id) {
        await characterRepository.updateCharacterAvatar(characterToEdit.id, persistentRef);
        characterToEdit.avatar = persistentRef;
        characterToEdit.avatarUrl = persistentRef;
      }

      setUploadFeedback({
        type: 'success',
        message: `Đã tải ảnh lên và lưu trữ thành công: "${file.name}" (${(file.size / 1024).toFixed(0)} KB)`,
      });
    } catch (err: any) {
      setUploadFeedback({
        type: 'error',
        message: err.message || 'Lỗi khi tải ảnh lên.',
      });
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const cleanName = name.trim();
    if (!cleanName) {
      setFormError('Vui lòng nhập tên nhân vật.');
      return;
    }

    let cleanAvatar = '';
    if (imageMode === 'url') {
      // Trường hợp 1: Người dùng nhập URL thủ công
      cleanAvatar = directUrlInput.trim();
      if (cleanAvatar && !cleanAvatar.startsWith('http://') && !cleanAvatar.startsWith('https://')) {
        setFormError('URL ảnh nhập thủ công phải bắt đầu bằng http:// hoặc https://');
        return;
      }
    } else {
      // Trường hợp 2: Người dùng upload file từ máy -> nhận storage path (/storage/characters/...)
      cleanAvatar = avatar.trim();
    }

    // Trường hợp 3: Blob/Object URL tạm thời -> KHÔNG được dùng làm giá trị persistent
    if (isTemporaryBlobUrl(cleanAvatar)) {
      setFormError('Ảnh tạm thời (blob:) chưa được lưu trữ ổn định. Vui lòng tải lại ảnh từ máy tính.');
      return;
    }

    // Nếu không có ảnh mới, giữ nguyên ảnh hiện có hoặc dùng mặc định
    if (!cleanAvatar) {
      if (characterToEdit?.avatar && !isTemporaryBlobUrl(characterToEdit.avatar)) {
        cleanAvatar = characterToEdit.avatar;
      } else {
        cleanAvatar = DEFAULT_FALLBACK_AVATAR;
      }
    } else if (isValidCharacterImage(cleanAvatar)) {
      cleanAvatar = normalizePersistentImageReference(cleanAvatar);
    }

    let cleanLink = characterLink.trim();
    if (cleanLink && !cleanLink.startsWith('http://') && !cleanLink.startsWith('https://') && !cleanLink.startsWith('/')) {
      cleanLink = `https://${cleanLink}`;
    }

    if (isLocked && unlockType === 'code' && !unlockCode.trim()) {
      setFormError('Nhân vật khóa kiểu mã bí mật (CODE) bắt buộc phải có mã mở khóa.');
      return;
    }

    setIsSubmitting(true);

    try {
      // Map tag IDs to tag names for character.tags text array
      const selectedTagNames = selectedTagIds
        .map((id) => allTags.find((t) => t.id === id)?.name)
        .filter((name): name is string => Boolean(name));

      if (isEditing && characterToEdit) {
        await characterRepository.updateCharacter(characterToEdit.id, {
          name: cleanName,
          avatar: cleanAvatar,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          characterLink: cleanLink || undefined,
          tags: selectedTagNames,
          isLocked,
          isHidden,
          unlockType,
          unlockCondition: unlockType === 'condition' ? {
            type: 'collection_count',
            requiredCount,
            description: conditionDescription.trim() || `Cần mở khóa ít nhất ${requiredCount} nhân vật trong Bể Cá.`,
          } : undefined,
          unlockCode: unlockType === 'code' ? unlockCode.trim() : undefined,
          quote: quote.trim() || undefined,
        });
        // Use tag.id to insert into character_tags.tag_id
        await tagRepository.syncCharacterTagsByIds(characterToEdit.id, selectedTagIds, selectedTagNames);
      } else {
        const created = await characterRepository.createCharacter({
          name: cleanName,
          avatar: cleanAvatar,
          shortDescription: shortDescription.trim(),
          description: description.trim(),
          characterLink: cleanLink || undefined,
          tags: selectedTagNames,
          isLocked,
          isHidden,
          unlockType,
          unlockCondition: unlockType === 'condition' ? {
            type: 'collection_count',
            requiredCount,
            description: conditionDescription.trim() || `Cần mở khóa ít nhất ${requiredCount} nhân vật trong Bể Cá.`,
          } : undefined,
          unlockCode: unlockType === 'code' ? unlockCode.trim() : undefined,
          quote: quote.trim() || undefined,
        });
        // Use tag.id to insert into character_tags.tag_id
        await tagRepository.syncCharacterTagsByIds(created.id, selectedTagIds, selectedTagNames);
      }

      onSaved();
      onClose();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu thông tin nhân vật.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
      <div 
        id="admin-character-modal-card"
        className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-2xl w-full shadow-2xl overflow-hidden my-6 max-h-[92vh] flex flex-col text-slate-100"
      >
        {/* Modal Header */}
        <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90 sticky top-0 z-10">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide flex items-center gap-2">
              <span>{isEditing ? 'Chỉnh Sửa Nhân Vật' : 'Thêm Nhân Vật Mới'}</span>
            </h2>
            <p className="text-xs text-slate-400 font-light mt-0.5">
              Tên thật, hình ảnh và phân loại thẻ dynamic. Không tự sinh title/rarity.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Content */}
        <form onSubmit={handleSubmit} noValidate className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1">
          {/* Error Message */}
          {formError && (
            <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          {/* 1. Name Input */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-slate-300">
              TÊN NHÂN VẬT <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nhập tên thật (ví dụ: Nguyễn Minh, Hải Lưu...)"
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-sm focus:outline-none focus:border-cyan-500 transition-colors"
            />
            <p className="text-[11px] text-slate-500 font-light">
              Lưu ý: Tên hiển thị nguyên vẹn tên bạn nhập, hệ thống KHÔNG gắn thêm danh xưng hay độ hiếm.
            </p>
          </div>

          {/* 2. Image / Avatar Management: Tách biệt rõ 2 luồng Upload từ máy & Nhập URL */}
          <div className="space-y-3 rounded-2xl bg-slate-850/60 border border-slate-700/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-mono font-medium text-slate-300 flex items-center gap-1.5">
                <ImageIcon className="w-3.5 h-3.5 text-cyan-400" />
                <span>HÌNH ẢNH NHÂN VẬT (AVATAR) <span className="text-red-400">*</span></span>
              </label>

              {/* Mode Switcher Tabs */}
              <div className="flex items-center p-0.5 rounded-xl bg-slate-900 border border-slate-700/80 text-xs">
                <button
                  type="button"
                  onClick={() => setImageMode('upload')}
                  className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
                    imageMode === 'upload'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Upload className="w-3 h-3" />
                  <span>Tải ảnh từ máy</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImageMode('url');
                    if (avatar && (avatar.startsWith('http://') || avatar.startsWith('https://'))) {
                      setDirectUrlInput(avatar);
                    }
                  }}
                  className={`px-3 py-1.5 rounded-lg transition-colors font-medium flex items-center gap-1.5 cursor-pointer ${
                    imageMode === 'url'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Link2 className="w-3 h-3" />
                  <span>Nhập URL trực tiếp</span>
                </button>
              </div>
            </div>

            {/* FLOW 1: TẢI ẢNH TỪ MÁY TÍNH (FILE UPLOAD) */}
            {imageMode === 'upload' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Preview Thumbnail */}
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 flex-shrink-0 relative group shadow-inner">
                    {avatar ? (
                      <img
                        src={resolveCharacterImageUrl(avatar)}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={async (e) => {
                          const fallback = await storageService.resolveCharacterImageFallback(avatar);
                          if (fallback) {
                            (e.target as HTMLImageElement).src = fallback;
                          } else {
                            (e.target as HTMLImageElement).src = DEFAULT_FALLBACK_AVATAR;
                          }
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1 p-2 text-center">
                        <ImageIcon className="w-6 h-6 text-slate-600" />
                        <span>Chưa có ảnh</span>
                      </div>
                    )}
                  </div>

                  {/* Upload Controls & Actions (Không hiển thị input URL nội bộ) */}
                  <div className="flex-1 space-y-2.5 w-full">
                    <div className="flex flex-wrap items-center gap-2">
                      <label className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 active:bg-cyan-700 text-white text-xs font-medium cursor-pointer transition-all shadow-md shadow-cyan-900/20 inline-flex items-center gap-2">
                        {isUploading ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Upload className="w-4 h-4" />
                        )}
                        <span>{isUploading ? 'Đang tải ảnh lên hệ thống...' : avatar ? 'Chọn ảnh khác từ máy' : 'Chọn tệp ảnh từ máy tính'}</span>
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                          className="hidden"
                        />
                      </label>

                      {avatar && (
                        <button
                          type="button"
                          onClick={() => {
                            setAvatar('');
                            setUploadFeedback(null);
                          }}
                          className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-red-950/50 border border-slate-700 hover:border-red-800 text-slate-400 hover:text-red-300 text-xs transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Gỡ ảnh</span>
                        </button>
                      )}
                    </div>

                    <p className="text-[11px] text-slate-400 font-light">
                      Hỗ trợ định dạng PNG, JPG, WEBP hoặc GIF (tối đa 8MB). Hệ thống sẽ tự động lưu trữ và hiển thị ảnh ổn định lâu dài.
                    </p>
                  </div>
                </div>

                {/* Upload Feedback */}
                {uploadFeedback && (
                  <div className={`p-2.5 rounded-xl text-xs flex items-center gap-2 ${
                    uploadFeedback.type === 'success' 
                      ? 'bg-teal-950/70 border border-teal-800 text-teal-200' 
                      : 'bg-red-950/70 border border-red-800 text-red-200'
                  }`}>
                    {uploadFeedback.type === 'success' ? (
                      <Check className="w-4 h-4 text-teal-400 flex-shrink-0" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    )}
                    <span>{uploadFeedback.message}</span>
                  </div>
                )}
              </div>
            )}

            {/* FLOW 2: NHẬP URL TRỰC TIẾP (DIRECT URL) */}
            {imageMode === 'url' && (
              <div className="space-y-3">
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  {/* Preview Thumbnail */}
                  <div className="w-24 h-24 rounded-2xl overflow-hidden bg-slate-900 border-2 border-slate-700 flex-shrink-0 relative group shadow-inner">
                    {directUrlInput.trim() ? (
                      <img
                        src={resolveCharacterImageUrl(directUrlInput.trim())}
                        alt="Preview"
                        className="w-full h-full object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = DEFAULT_FALLBACK_AVATAR;
                        }}
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center text-slate-500 text-xs gap-1 p-2 text-center">
                        <Link2 className="w-6 h-6 text-slate-600" />
                        <span>Chưa nhập URL</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 space-y-2 w-full">
                    <input
                      type="text"
                      value={directUrlInput}
                      onChange={(e) => {
                        const val = e.target.value;
                        setDirectUrlInput(val);
                        setAvatar(val);
                      }}
                      placeholder="https://images.unsplash.com/... hoặc liên kết ảnh trực tiếp"
                      className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500 font-mono"
                    />
                    <p className="text-[11px] text-slate-400 font-light">
                      Dán liên kết ảnh trực tiếp bắt đầu bằng <code className="text-cyan-400 font-mono">http://</code> hoặc <code className="text-cyan-400 font-mono">https://</code>.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 3. Short Description & Description */}
          <div className="grid grid-cols-1 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-slate-300">
                MÔ TẢ NGẮN (SHORT DESCRIPTION)
              </label>
              <input
                type="text"
                value={shortDescription}
                onChange={(e) => setShortDescription(e.target.value)}
                placeholder="Tóm tắt ngắn gọn xuất hiện trên thẻ cá..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-slate-300">
                MÔ TẢ CHI TIẾT (DESCRIPTION)
              </label>
              <textarea
                rows={3}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả về tính cách, bối cảnh đời thực hoặc đặc điểm của nhân vật..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* 4. Tags Multi-Select (Dynamic tags) */}
          <div className="space-y-2 p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60">
            <div className="flex items-center justify-between">
              <label className="text-xs font-mono font-medium text-cyan-400">
                THẺ PHÂN LOẠI (TAGS)
              </label>
              <span className="text-[11px] font-mono text-slate-400">
                Đã chọn: {selectedTagIds.length} thẻ
              </span>
            </div>

            <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
              {allTags.map((tag) => {
                const isSelected = selectedTagIds.includes(tag.id);
                return (
                  <button
                    key={tag.id}
                    id={`char-tag-${tag.id}`}
                    type="button"
                    onClick={() => handleToggleTag(tag.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-semibold shadow-2xs'
                        : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {tag.name}
                  </button>
                );
              })}
            </div>

            {/* Quick Add Tag */}
            <div className="pt-2 flex items-center gap-2 border-t border-slate-700/50">
              <input
                type="text"
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="Tạo thẻ mới (vd: Hướng nội, Kế toán...)"
                className="flex-1 px-3 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-cyan-500"
              />
              <button
                type="button"
                onClick={handleQuickAddTag}
                className="px-3 py-1.5 rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-200 text-xs font-medium transition-colors cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Thêm Tag</span>
              </button>
            </div>
          </div>

          {/* 5. Visibility Configuration (Ẩn / Hiện) */}
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-xs font-mono font-medium text-teal-400 flex items-center gap-1.5">
                {isHidden ? <EyeOff className="w-3.5 h-3.5 text-slate-400" /> : <Eye className="w-3.5 h-3.5 text-teal-400" />}
                <span>HIỂN THỊ VỚI NGƯỜI DÙNG (VISIBILITY)</span>
              </span>
              <p className="text-[11px] text-slate-400 font-light mt-0.5">
                {isHidden
                  ? 'Nhân vật đang bị ẨN — người dùng thường sẽ không thấy nhân vật này trên bất kỳ trang nào.'
                  : 'Nhân vật đang HIỂN THỊ công khai trên Bể Cá.'}
              </p>
            </div>

            {/* Toggle Switch */}
            <button
              type="button"
              onClick={() => setIsHidden(!isHidden)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                !isHidden ? 'bg-teal-500' : 'bg-slate-700'
              }`}
              title={isHidden ? 'Đang ẩn khỏi người dùng' : 'Đang hiển thị'}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  !isHidden ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>

          {/* 6. Global Lock & Unlock Configuration */}
          <div className="p-4 rounded-2xl bg-slate-800/40 border border-slate-700/60 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-mono font-medium text-amber-400 flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  <span>TRẠNG THÁI KHÓA TOÀN CỤC (GLOBAL LOCK)</span>
                </span>
                <p className="text-[11px] text-slate-400 font-light mt-0.5">
                  Nếu bật Khóa, nhân vật sẽ yêu cầu người dùng mở khóa trước khi bơi tự do trong Bể Cá.
                </p>
              </div>

              {/* Toggle Switch */}
              <button
                type="button"
                onClick={() => setIsLocked(!isLocked)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                  isLocked ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    isLocked ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Unlock Type Selector (if isLocked) */}
            {isLocked && (
              <div className="space-y-3 pt-3 border-t border-slate-700/50">
                <label className="text-xs font-mono font-medium text-slate-300">
                  KIỂU MỞ KHÓA (UNLOCK TYPE)
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['none', 'code', 'condition', 'manual'] as UnlockType[]).map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setUnlockType(type)}
                      className={`p-2 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                        unlockType === type
                          ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {type.toUpperCase()}
                    </button>
                  ))}
                </div>

                {/* Sub-inputs based on unlockType */}
                {unlockType === 'code' && (
                  <div className="p-3 rounded-xl bg-amber-950/30 border border-amber-800/50 space-y-1.5">
                    <label className="text-[11px] font-mono text-amber-300 font-medium flex items-center gap-1.5">
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>MÃ MỞ KHÓA BÍ MẬT (SECRET CODE)</span>
                    </label>
                    <input
                      type="text"
                      value={unlockCode}
                      onChange={(e) => setUnlockCode(e.target.value.toUpperCase())}
                      placeholder="VD: VOLCANO_FORGE, DEEP_WATER_2026..."
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-700/60 text-amber-200 text-xs font-mono focus:outline-none focus:border-amber-400 uppercase"
                    />
                    <p className="text-[10px] text-amber-400/80 font-light">
                      Lưu trong bảng `character_secrets`. Không lộ ra client bundle.
                    </p>
                  </div>
                )}

                {unlockType === 'condition' && (
                  <div className="p-3 rounded-xl bg-cyan-950/30 border border-cyan-800/50 space-y-2">
                    <label className="text-[11px] font-mono text-cyan-300 font-medium flex items-center gap-1.5">
                      <Compass className="w-3.5 h-3.5" />
                      <span>ĐIỀU KIỆN MỞ KHÓA (TIẾN ĐỘ SỞ HỮU BỂ CÁ)</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-300">Yêu cầu mở ít nhất:</span>
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={requiredCount}
                        onChange={(e) => setRequiredCount(parseInt(e.target.value) || 1)}
                        className="w-16 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono text-center"
                      />
                      <span className="text-xs text-slate-300">nhân vật</span>
                    </div>
                    <input
                      type="text"
                      value={conditionDescription}
                      onChange={(e) => setConditionDescription(e.target.value)}
                      placeholder="Mô tả hiển thị cho user (vd: Cần mở khóa ít nhất 3 nhân vật...)"
                      className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                )}

                {unlockType === 'manual' && (
                  <div className="p-3 rounded-xl bg-purple-950/30 border border-purple-800/50 text-[11px] text-purple-200 font-light">
                    Chỉ Admin mới có thể cấp quyền mở khóa thủ công cho từng người dùng thông qua tab <strong>Cấu hình Mở Khóa</strong>.
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. External Link, Quote, Lore (Optional) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-slate-300">
                LIÊN KẾT NGOÀI (CHARACTER LINK - TÙY CHỌN)
              </label>
              <input
                type="text"
                value={characterLink}
                onChange={(e) => setCharacterLink(e.target.value)}
                placeholder="https://example.com/character-link"
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-slate-300">
                CÂU NÓI ĐẶC TRƯNG (QUOTE - TÙY CHỌN)
              </label>
              <input
                type="text"
                value={quote}
                onChange={(e) => setQuote(e.target.value)}
                placeholder="Câu thoại ngắn của nhân vật..."
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800/90 border border-slate-700 text-white text-xs focus:outline-none focus:border-cyan-500"
              />
            </div>
          </div>

          {/* Modal Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <span>{isEditing ? 'Cập Nhật Nhân Vật' : 'Tạo Nhân Vật'}</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
