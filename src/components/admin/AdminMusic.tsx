import React, { useState, useEffect } from 'react';
import { Track } from '../../types';
import { musicService, CreateTrackInput, UpdateTrackInput, isLegacyBlobTrack } from '../../services/musicService';
import { storageService } from '../../services/storageService';
import { isSupabaseConfigured, getSupabaseConfigStatus, getSupabasePublicUrl } from '../../lib/supabaseClient';
import { 
  Music, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  AlertCircle, 
  Play, 
  Pause, 
  Upload, 
  Volume2, 
  Eye, 
  EyeOff, 
  ShieldAlert, 
  Loader2,
  X,
  Database,
  CloudCheck,
  RefreshCw,
  ArrowUpDown,
  ChevronUp,
  ChevronDown,
  GripVertical,
  Save
} from 'lucide-react';

interface AdminMusicProps {
  onRequestAdd?: boolean;
  onResetRequestAdd?: () => void;
}

const TrackRowCover: React.FC<{ coverUrl?: string; title: string }> = ({ coverUrl, title }) => {
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    setLoadError(false);
  }, [coverUrl]);

  if (!coverUrl || loadError) {
    return <Music className="w-5 h-5 text-indigo-400" />;
  }

  return (
    <img
      src={coverUrl}
      alt={title}
      onError={() => setLoadError(true)}
      className="w-full h-full object-cover"
      referrerPolicy="no-referrer"
    />
  );
};

export const AdminMusic: React.FC<AdminMusicProps> = ({ onRequestAdd, onResetRequestAdd }) => {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterActive, setFilterActive] = useState<'all' | 'active' | 'inactive'>('all');
  const [loading, setLoading] = useState(false);

  // Audio Preview State
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

  // Modal State for Add / Edit Track
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTrack, setEditingTrack] = useState<Track | null>(null);

  // Form Fields
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [coverUrl, setCoverUrl] = useState('');
  const [coverPath, setCoverPath] = useState('');
  const [coverImageError, setCoverImageError] = useState(false);
  const [audioUrl, setAudioUrl] = useState('');
  const [audioPath, setAudioPath] = useState('');
  const [audioContentType, setAudioContentType] = useState('');
  const [audioDuration, setAudioDuration] = useState(180);
  const [isActive, setIsActive] = useState(true);

  // Upload States
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Form Submission
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Delete Confirmation
  const [deletingTrack, setDeletingTrack] = useState<Track | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // General Toast Feedback
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Music Playlist Sort Order State
  const [isReordering, setIsReordering] = useState(false);
  const [reorderList, setReorderList] = useState<Track[]>([]);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [isSavingOrder, setIsSavingOrder] = useState(false);
  const [orderSaveStatus, setOrderSaveStatus] = useState<'saving' | 'saved' | 'error' | null>(null);

  const loadTracks = async () => {
    setLoading(true);
    try {
      const data = await musicService.getAllTracks();
      setTracks(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Không thể tải danh sách bài hát.' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracks();

    const handleUpdate = () => loadTracks();
    window.addEventListener('be_ca_music_updated', handleUpdate);
    return () => {
      window.removeEventListener('be_ca_music_updated', handleUpdate);
      if (previewAudio) {
        previewAudio.pause();
      }
    };
  }, []);

  useEffect(() => {
    if (onRequestAdd) {
      handleOpenCreate();
      if (onResetRequestAdd) onResetRequestAdd();
    }
  }, [onRequestAdd, onResetRequestAdd]);

  // Keep reorderList synced whenever tracks change or when entering reordering mode
  useEffect(() => {
    setReorderList([...tracks].sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999)));
  }, [tracks, isReordering]);

  const saveNewOrder = async (orderedList: Track[]) => {
    setIsSavingOrder(true);
    setOrderSaveStatus('saving');
    try {
      const orderedIds = orderedList.map((t) => t.id);
      const updated = await musicService.reorderTracks(orderedIds);
      setTracks(updated);
      setReorderList(updated);
      setOrderSaveStatus('saved');
      setTimeout(() => {
        setOrderSaveStatus((prev) => (prev === 'saved' ? null : prev));
      }, 3500);
    } catch (err: any) {
      setOrderSaveStatus('error');
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi lưu thứ tự bài hát.' });
    } finally {
      setIsSavingOrder(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    try {
      e.dataTransfer.setData('text/plain', index.toString());
    } catch (_) {}
  };

  const handleDragOver = (e: React.DragEvent, _index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDragEnter = (index: number) => {
    if (draggedIndex !== null && draggedIndex !== index) {
      setDragOverIndex(index);
    }
  };

  const handleDragEnd = () => {
    if (draggedIndex !== null && dragOverIndex !== null && draggedIndex !== dragOverIndex) {
      const updated = [...reorderList];
      const [movedItem] = updated.splice(draggedIndex, 1);
      updated.splice(dragOverIndex, 0, movedItem);
      setReorderList(updated);
      saveNewOrder(updated);
    }
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleMoveUp = (index: number) => {
    if (index <= 0) return;
    const updated = [...reorderList];
    const temp = updated[index];
    updated[index] = updated[index - 1];
    updated[index - 1] = temp;
    setReorderList(updated);
    saveNewOrder(updated);
  };

  const handleMoveDown = (index: number) => {
    if (index >= reorderList.length - 1) return;
    const updated = [...reorderList];
    const temp = updated[index];
    updated[index] = updated[index + 1];
    updated[index + 1] = temp;
    setReorderList(updated);
    saveNewOrder(updated);
  };

  const handleSaveOrder = () => {
    saveNewOrder(reorderList);
  };

  const handleOpenCreate = () => {
    setEditingTrack(null);
    setTitle('');
    setArtist('');
    setCoverUrl('');
    setCoverPath('');
    setCoverImageError(false);
    setAudioUrl('');
    setAudioPath('');
    setAudioContentType('');
    setAudioDuration(180);
    setIsActive(true);
    setFormError(null);
    setUploadFeedback(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (track: Track) => {
    setEditingTrack(track);
    setTitle(track.title);
    setArtist(track.artist || '');
    setCoverUrl(track.coverUrl || '');
    setCoverPath(track.coverPath || '');
    setCoverImageError(false);

    // Resolve persistent URL (heals legacy blob track if audioPath exists)
    let initialAudioUrl = track.audioUrl || '';
    if (initialAudioUrl.startsWith('blob:') && track.audioPath) {
      initialAudioUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl(track.storageBucket || 'music', track.audioPath)
        : `/storage/music/${track.audioPath.replace(/^music\//, '')}`;
    }
    setAudioUrl(initialAudioUrl);
    setAudioPath(track.audioPath || '');
    setAudioContentType(track.contentType || '');
    setAudioDuration(track.duration || 180);
    setIsActive(track.isActive);
    setFormError(null);
    setUploadFeedback(null);
    setIsModalOpen(true);
  };

  // Toggle Track Audio Preview
  const handleTogglePreview = async (track: Track) => {
    if (playingTrackId === track.id) {
      if (previewAudio) {
        previewAudio.pause();
      }
      setPlayingTrackId(null);
      setPreviewAudio(null);
    } else {
      if (previewAudio) {
        previewAudio.pause();
      }

      try {
        const resolvedUrl = await storageService.getPlayableAudioUrl(track);
        if (!resolvedUrl) {
          throw new Error('Không tìm thấy Audio URL hợp lệ.');
        }

        const audio = new Audio();
        audio.src = resolvedUrl;
        audio.load();

        audio.play().catch((e) => {
          console.error('[AdminMusic Preview Play Failed]', {
            trackId: track.id,
            url: resolvedUrl,
            error: e,
          });
          setFeedback({ type: 'error', message: 'Không thể phát bản xem trước âm thanh: ' + e.message });
          setPlayingTrackId(null);
        });

        audio.onended = () => {
          setPlayingTrackId(null);
          setPreviewAudio(null);
        };

        audio.onerror = () => {
          console.error('[AdminMusic Preview Error]', {
            trackId: track.id,
            code: audio.error?.code,
            message: audio.error?.message,
            src: audio.src,
          });
          setFeedback({ type: 'error', message: 'Lỗi tải tệp âm thanh xem trước. Mã lỗi: ' + (audio.error?.code || 'không rõ') });
          setPlayingTrackId(null);
          setPreviewAudio(null);
        };

        setPreviewAudio(audio);
        setPlayingTrackId(track.id);
      } catch (err: any) {
        setFeedback({ type: 'error', message: err.message || 'Lỗi khi chuẩn bị âm thanh.' });
        setPlayingTrackId(null);
      }
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (track: Track) => {
    try {
      await musicService.toggleTrackActive(track.id, !track.isActive);
      setFeedback({
        type: 'success',
        message: `Đã chuyển bài "${track.title}" sang trạng thái: ${!track.isActive ? 'Đang phát (Active)' : 'Đã tắt (Inactive)'}.`,
      });
      loadTracks();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi cập nhật trạng thái bài hát.' });
    }
  };

  // Upload Handlers
  const handleAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFeedback(null);
    setFormError(null);
    setIsUploadingAudio(true);
    try {
      const result = await storageService.uploadMusicAudio(file);
      const bucket = result.storageBucket || 'music';
      const resolvedUrl = result.url || (result.path ? (isSupabaseConfigured() ? getSupabasePublicUrl(bucket, result.path) : `/storage/${bucket}/${result.path.replace(/^music\//, '')}`) : '');

      setAudioUrl(resolvedUrl);
      setAudioPath(result.path);
      setAudioContentType(result.contentType);
      if (result.duration && result.duration > 0) {
        setAudioDuration(result.duration);
      }

      // Auto-populate title if empty
      if (!title.trim()) {
        const cleanName = file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ');
        setTitle(cleanName);
      }

      setUploadFeedback({
        type: 'success',
        message: `Đã lưu file vào Supabase Storage (bucket: ${bucket}, path: ${result.path}): "${file.name}" (${(file.size / (1024 * 1024)).toFixed(1)}MB, ${result.contentType})`,
      });
    } catch (err: any) {
      setUploadFeedback({ type: 'error', message: err.message || 'Lỗi khi tải tệp âm thanh.' });
    } finally {
      setIsUploadingAudio(false);
      e.target.value = '';
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadFeedback(null);
    setFormError(null);
    setIsUploadingCover(true);
    setCoverImageError(false);
    try {
      const result = await storageService.uploadMusicCover(file);
      const bucket = result.storageBucket || 'music-covers';
      const resolvedUrl =
        result.url ||
        (result.path
          ? isSupabaseConfigured()
            ? getSupabasePublicUrl(bucket, result.path)
            : `/storage/${bucket}/${result.path.replace(/^(music|music-covers)\//, '')}`
          : '');

      setCoverUrl(resolvedUrl);
      setCoverPath(result.path);
      setCoverImageError(false);
      setUploadFeedback({
        type: 'success',
        message: `Đã lưu ảnh bìa vào Storage (bucket: ${bucket}): "${file.name}"`,
      });
    } catch (err: any) {
      setUploadFeedback({ type: 'error', message: err.message || 'Lỗi khi tải ảnh bìa.' });
    } finally {
      setIsUploadingCover(false);
      e.target.value = '';
    }
  };

  // Save Track
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setFormError('Vui lòng nhập tiêu đề bài hát.');
      return;
    }

    let finalAudioUrl = audioUrl.trim();
    const finalAudioPath = audioPath.trim();

    // If audioUrl is empty but audioPath is available, resolve persistent URL
    if (!finalAudioUrl && finalAudioPath) {
      finalAudioUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl('music', finalAudioPath)
        : `/storage/music/${finalAudioPath.replace(/^music\//, '')}`;
      setAudioUrl(finalAudioUrl);
    }

    if (!finalAudioUrl && !finalAudioPath) {
      setFormError('Vui lòng tải tệp âm thanh lên hoặc nhập Audio URL.');
      return;
    }

    // STRICT MANDATE: Refuse blob: URLs unless healed by audioPath
    if (finalAudioUrl.startsWith('blob:')) {
      if (finalAudioPath) {
        finalAudioUrl = isSupabaseConfigured()
          ? getSupabasePublicUrl('music', finalAudioPath)
          : `/storage/music/${finalAudioPath.replace(/^music\//, '')}`;
        setAudioUrl(finalAudioUrl);
      } else {
        setFormError(
          'Lỗi: Không được phép lưu Blob URL ("blob:..."). Blob URL là URL tạm thời của trình duyệt và sẽ mất hiệu lực. Vui lòng bấm "Tải lên từ máy" để lưu file persistent vào Supabase Storage bucket "music".'
        );
        return;
      }
    }

    let finalCoverUrl = coverUrl.trim();
    const finalCoverPath = coverPath.trim();

    // If coverUrl is empty but coverPath exists, resolve persistent URL
    if (!finalCoverUrl && finalCoverPath) {
      finalCoverUrl = isSupabaseConfigured()
        ? getSupabasePublicUrl('music-covers', finalCoverPath)
        : `/storage/music-covers/${finalCoverPath.replace(/^(music|music-covers)\//, '')}`;
      setCoverUrl(finalCoverUrl);
    }

    // STRICT MANDATE: Reject blob: URLs for cover images
    if (finalCoverUrl.startsWith('blob:')) {
      setFormError(
        'Lỗi: Không được phép lưu Blob URL ("blob:...") cho ảnh bìa. Blob URL là URL tạm thời của trình duyệt và sẽ mất hiệu lực. Vui lòng bấm "Tải ảnh bìa" để tải lên Storage hoặc nhập URL trực tiếp.'
      );
      return;
    }

    if (finalCoverUrl.toLowerCase().startsWith('file:') || finalCoverUrl.toLowerCase().includes('fakepath')) {
      setFormError('Lỗi: Đường dẫn tệp local trên máy không thể dùng làm ảnh bìa. Vui lòng bấm "Tải ảnh bìa" để tải lên Storage hoặc nhập URL hợp lệ (http://, https://).');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingTrack) {
        const payload: UpdateTrackInput = {
          title: trimmedTitle,
          artist: artist.trim() || undefined,
          coverUrl: finalCoverUrl,
          coverPath: finalCoverPath || undefined,
          audioUrl: finalAudioUrl,
          audioPath: finalAudioPath || undefined,
          storageBucket: 'music',
          contentType: audioContentType.trim() || undefined,
          duration: audioDuration > 0 ? audioDuration : undefined,
          isActive,
        };
        await musicService.updateTrack(editingTrack.id, payload);
        setFeedback({ type: 'success', message: `Đã cập nhật bài hát "${trimmedTitle}" thành công.` });
      } else {
        const payload: CreateTrackInput = {
          title: trimmedTitle,
          artist: artist.trim() || undefined,
          coverUrl: finalCoverUrl || undefined,
          coverPath: finalCoverPath || undefined,
          audioUrl: finalAudioUrl,
          audioPath: finalAudioPath || undefined,
          storageBucket: 'music',
          contentType: audioContentType.trim() || undefined,
          duration: audioDuration > 0 ? audioDuration : undefined,
          isActive,
        };
        await musicService.createTrack(payload);
        setFeedback({ type: 'success', message: `Đã thêm bài hát mới "${trimmedTitle}" thành công.` });
      }
      setIsModalOpen(false);
      loadTracks();
    } catch (err: any) {
      setFormError(err.message || 'Lỗi khi lưu bài hát.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Delete Track
  const handleConfirmDelete = async () => {
    if (!deletingTrack) return;
    setIsDeleting(true);
    try {
      await musicService.deleteTrack(deletingTrack.id);
      setFeedback({
        type: 'success',
        message: `Đã xóa bài hát "${deletingTrack.title}" khỏi hệ thống thành công.`,
      });
      setDeletingTrack(null);
      loadTracks();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi xóa bài hát.' });
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredTracks = tracks
    .filter((t) => {
      const isActMatch =
        filterActive === 'all' ||
        (filterActive === 'active' && t.isActive) ||
        (filterActive === 'inactive' && !t.isActive);

      const q = searchQuery.toLowerCase().trim();
      const isSearchMatch =
        !q ||
        t.title.toLowerCase().includes(q) ||
        (t.artist && t.artist.toLowerCase().includes(q));

      return isActMatch && isSearchMatch;
    })
    .sort((a, b) => (a.sortOrder ?? 999999) - (b.sortOrder ?? 999999));

  const supabaseStatus = getSupabaseConfigStatus();
  const legacyBlobTracks = tracks.filter(isLegacyBlobTrack);

  return (
    <div id="admin-music-page" className="space-y-6 animate-fadeIn">
      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-indigo-400 text-xs font-mono uppercase tracking-widest font-semibold">
            <span>🎵</span>
            <span>HỆ THỐNG ÂM NHẠC BỂ CÁ</span>
          </div>
          <h1 
            className="text-2xl sm:text-3xl font-bold text-white tracking-wide mt-1"
            style={{ fontFamily: "'Cinzel', serif" }}
          >
            Quản Lý Âm Nhạc
          </h1>
          <p className="text-xs text-slate-400 font-light mt-0.5">
            Quản trị danh sách bài hát, hỗ trợ lưu trữ Supabase Storage và bật/tắt trạng thái Active.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-shrink-0">
          <button
            type="button"
            id="toggle-reorder-music-btn"
            onClick={() => setIsReordering(!isReordering)}
            className={`px-4 py-2.5 rounded-xl text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer border ${
              isReordering
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 hover:bg-amber-500/30 ring-2 ring-amber-400/20'
                : 'bg-slate-800 border-slate-700 text-slate-200 hover:bg-slate-700 hover:text-white'
            }`}
          >
            <ArrowUpDown className="w-4 h-4 text-amber-400" />
            <span>{isReordering ? '✕ Đóng sắp xếp' : '↕️ Sắp xếp bài hát'}</span>
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>+ Thêm Bài Hát</span>
          </button>
        </div>
      </div>

      {/* Supabase Storage Integration Status */}
      <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2.5">
          <div className={`w-2.5 h-2.5 rounded-full ${supabaseStatus.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
          <div>
            <div className="font-semibold text-white flex items-center gap-1.5">
              <span>{supabaseStatus.configured ? 'Supabase Storage: Đã kết nối' : 'Chế độ lưu trữ tệp cục bộ (Dev Persistent)'}</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                Bucket: music
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {supabaseStatus.configured 
                ? `Đang kết nối tới ${supabaseStatus.url}. Tệp nhạc được lưu persistent trên Supabase Storage.`
                : 'Để đồng bộ trực tiếp lên Cloud Supabase Storage, cấu hình VITE_SUPABASE_URL và VITE_SUPABASE_ANON_KEY trong Settings > Secrets.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 text-[11px] text-slate-400 font-mono">
          <span>RLS: Admin-only Upload</span>
        </div>
      </div>

      {/* Legacy Blob URLs Warning Banner */}
      {legacyBlobTracks.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-950/50 border border-amber-600/60 text-amber-200 text-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-lg">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-amber-300 text-sm">
                Phát hiện {legacyBlobTracks.length} bài hát đang dùng Blob URL cũ
              </div>
              <p className="text-xs text-amber-200/90 mt-0.5">
                Các bài hát có Blob URL (như <em>"{legacyBlobTracks.map(t => t.title).join(', ')}"</em>) đã bị vô hiệu hoá trên trình phát vì Blob URL của trình duyệt không có tính bền vững. Vui lòng nhấn <strong>"Tải lại file"</strong> để upload lên Supabase Storage bucket <code>music</code>.
              </p>
            </div>
          </div>
        </div>
      )}

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

      {/* Sắp xếp thứ tự phát nhạc Panel */}
      {isReordering && (
        <div id="reorder-tracks-panel" className="p-4 sm:p-5 rounded-3xl bg-slate-850 border-2 border-amber-500/50 shadow-xl space-y-4 animate-fadeIn">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-700/60">
            <div>
              <div className="flex items-center gap-2.5">
                <span className="text-amber-400 font-bold text-sm sm:text-base flex items-center gap-2">
                  <GripVertical className="w-5 h-5 text-amber-400" />
                  Sắp Xếp Thứ Tự Phát Nhạc
                </span>
                {orderSaveStatus === 'saving' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-sky-500/20 text-sky-300 border border-sky-500/40 animate-pulse">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Đang lưu...
                  </span>
                )}
                {orderSaveStatus === 'saved' && (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    <Check className="w-3 h-3 text-emerald-400" />
                    ✓ Đã lưu thứ tự
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-300 font-light mt-1">
                Kéo và thả bài hát bằng biểu tượng <strong className="text-amber-300">☰</strong> hoặc dùng nút <strong className="text-amber-300">↑ / ↓</strong> để thay đổi thứ tự phát. Thứ tự này được đồng bộ tức thì tới Music Player.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <button
                type="button"
                id="save-reorder-btn"
                onClick={handleSaveOrder}
                disabled={isSavingOrder}
                className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-500 hover:to-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md cursor-pointer"
              >
                {isSavingOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Lưu thứ tự</span>
              </button>
              <button
                type="button"
                onClick={() => setIsReordering(false)}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-all cursor-pointer border border-slate-700"
              >
                Đóng
              </button>
            </div>
          </div>

          {/* Reorder List Items */}
          <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
            {reorderList.length === 0 ? (
              <p className="text-xs text-slate-400 py-6 text-center">Chưa có bài hát nào trong danh sách.</p>
            ) : (
              reorderList.map((track, idx) => {
                const isDragging = draggedIndex === idx;
                const isDragOver = dragOverIndex === idx;
                return (
                  <div
                    key={track.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    className={`p-3 rounded-2xl border transition-all flex items-center justify-between gap-3 select-none ${
                      isDragging
                        ? 'opacity-30 bg-slate-800 border-dashed border-amber-400 scale-[0.99]'
                        : isDragOver
                        ? 'bg-amber-950/40 border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                        : 'bg-slate-900/80 border-slate-700/70 hover:border-slate-600 hover:bg-slate-900'
                    }`}
                  >
                    {/* Left: Drag Handle, Number, Cover, Title */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div 
                        className="cursor-grab active:cursor-grabbing text-slate-400 hover:text-amber-400 p-1 flex-shrink-0 text-base"
                        title="Kéo thả bài hát để đổi vị trí"
                      >
                        ☰
                      </div>

                      <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 font-mono text-xs font-bold text-amber-400 flex items-center justify-center flex-shrink-0 shadow-inner">
                        {idx + 1}
                      </div>

                      <div className="w-10 h-10 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0 flex items-center justify-center">
                        <TrackRowCover coverUrl={track.coverUrl} title={track.title} />
                      </div>

                      <div className="min-w-0">
                        <div className="font-semibold text-white text-xs sm:text-sm truncate">
                          {track.title}
                        </div>
                        <div className="text-[11px] text-slate-400 truncate mt-0.5">
                          {track.artist || 'Không rõ nghệ sĩ'}
                        </div>
                      </div>
                    </div>

                    {/* Right: Active status & Move Up/Down buttons for mobile / touch */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-medium hidden sm:inline-block ${
                        track.isActive
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          : 'bg-slate-700/60 text-slate-400 border border-slate-600'
                      }`}>
                        {track.isActive ? 'Đang phát' : 'Đã tắt'}
                      </span>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleMoveUp(idx)}
                          disabled={idx === 0}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-25 text-slate-300 hover:text-amber-400 cursor-pointer transition-colors border border-slate-700/60"
                          title="Di chuyển lên"
                          aria-label={`Di chuyển ${track.title} lên`}
                        >
                          <ChevronUp className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleMoveDown(idx)}
                          disabled={idx === reorderList.length - 1}
                          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-25 text-slate-300 hover:text-amber-400 cursor-pointer transition-colors border border-slate-700/60"
                          title="Di chuyển xuống"
                          aria-label={`Di chuyển ${track.title} xuống`}
                        >
                          <ChevronDown className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
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
            placeholder="Tìm theo tiêu đề bài hát, nghệ sĩ..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto">
          {(['all', 'active', 'inactive'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              onClick={() => setFilterActive(filter)}
              className={`flex-1 sm:flex-none px-3 py-1.5 rounded-xl text-xs font-medium transition-all cursor-pointer border ${
                filterActive === filter
                  ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 font-semibold'
                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              {filter === 'all' && 'Tất cả'}
              {filter === 'active' && 'Đang phát'}
              {filter === 'inactive' && 'Đã tắt'}
            </button>
          ))}
        </div>
      </div>

      {/* Tracks Table */}
      <div className="bg-slate-800/50 border border-slate-700/70 rounded-3xl overflow-hidden shadow-sm">
        {loading ? (
          <div className="py-16 text-center text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
            <span className="text-xs font-mono">Đang tải danh sách bài hát...</span>
          </div>
        ) : filteredTracks.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                  <th className="p-3.5 sm:p-4 w-12 text-center" title="Thứ tự phát nhạc">#</th>
                  <th className="p-3.5 sm:p-4">Bài Hát</th>
                  <th className="p-3.5 sm:p-4">Nghệ Sĩ</th>
                  <th className="p-3.5 sm:p-4">Nghe Thử</th>
                  <th className="p-3.5 sm:p-4">Trạng Thái Active</th>
                  <th className="p-3.5 sm:p-4 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700/40">
                {filteredTracks.map((track, idx) => {
                  const isPlaying = playingTrackId === track.id;
                  return (
                    <tr key={track.id} className="hover:bg-slate-800/60 transition-colors">
                      {/* Sort Order # */}
                      <td className="p-3.5 sm:p-4 text-center">
                        <span className="font-mono text-xs font-bold text-amber-400/90 bg-slate-900/70 px-2 py-1 rounded-lg border border-slate-700/70 inline-block min-w-[28px]">
                          {track.sortOrder ?? (idx + 1)}
                        </span>
                      </td>

                      {/* Title & Cover */}
                      <td className="p-3.5 sm:p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0 flex items-center justify-center">
                            <TrackRowCover coverUrl={track.coverUrl} title={track.title} />
                          </div>
                          <div>
                            <div className="font-semibold text-white text-sm">
                              {track.title}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-[10px] font-mono text-slate-500">
                                {track.duration ? `${Math.floor(track.duration / 60)}:${(track.duration % 60).toString().padStart(2, '0')}` : '03:00'}
                              </span>
                              {track.audioPath && (
                                <span className="text-[9px] font-mono text-indigo-300 bg-indigo-950/60 px-1.5 py-0.2 rounded border border-indigo-800/40">
                                  {track.audioPath}
                                </span>
                              )}
                            </div>
                            {isLegacyBlobTrack(track) && (
                              <div className="mt-1 flex items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                  <AlertCircle className="w-2.5 h-2.5" />
                                  Blob URL cũ — Cần tải lại tệp
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Artist */}
                      <td className="p-3.5 sm:p-4 text-slate-300">
                        {track.artist || 'Không rõ'}
                      </td>

                      {/* Preview Button */}
                      <td className="p-3.5 sm:p-4">
                        {isLegacyBlobTrack(track) ? (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(track)}
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border border-amber-500/50 bg-amber-950/40 text-amber-300 hover:bg-amber-900/50 transition-colors cursor-pointer"
                            title="File này đang dùng Blob URL cũ không thể phát. Bấm để tải lại tệp mới."
                          >
                            <Upload className="w-3.5 h-3.5 text-amber-400" />
                            <span>Tải lại file</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleTogglePreview(track)}
                            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-medium border transition-colors cursor-pointer ${
                              isPlaying
                                ? 'bg-indigo-600 text-white border-indigo-500'
                                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                            }`}
                          >
                            {isPlaying ? (
                              <>
                                <Pause className="w-3.5 h-3.5" />
                                <span>Dừng</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" />
                                <span>Nghe thử</span>
                              </>
                            )}
                          </button>
                        )}
                      </td>

                      {/* Active Status Switch */}
                      <td className="p-3.5 sm:p-4">
                        <button
                          type="button"
                          onClick={() => handleToggleActive(track)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border cursor-pointer transition-colors ${
                            track.isActive
                              ? 'bg-teal-950/60 border-teal-800 text-teal-300 hover:bg-teal-900/60'
                              : 'bg-slate-800 border-slate-700 text-slate-500 hover:text-slate-300'
                          }`}
                          title="Bật/Tắt hiển thị trong playlist người dùng"
                        >
                          {track.isActive ? (
                            <>
                              <Eye className="w-3 h-3 text-teal-400" />
                              <span>Đang phát</span>
                            </>
                          ) : (
                            <>
                              <EyeOff className="w-3 h-3 text-slate-500" />
                              <span>Đã tắt</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Actions */}
                      <td className="p-3.5 sm:p-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(track)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors cursor-pointer"
                            title="Sửa bài hát"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeletingTrack(track)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-red-900/40 text-slate-400 hover:text-red-300 transition-colors cursor-pointer"
                            title="Xóa bài hát"
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
              <Music className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-semibold text-white">Chưa có bài hát nào</h3>
            <p className="text-xs text-slate-500 font-light">
              Nhấn "+ Thêm Bài Hát" để tải lên hoặc dán URL bài hát cho Bể Cá.
            </p>
          </div>
        )}
      </div>

      {/* Add / Edit Track Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-sm animate-fadeIn overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700/80 rounded-3xl max-w-xl w-full shadow-2xl overflow-hidden my-6 flex flex-col text-slate-100">
            <div className="p-5 sm:p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/90">
              <div>
                <h2 className="text-lg sm:text-xl font-bold text-white tracking-wide">
                  {editingTrack ? 'Chỉnh Sửa Bài Hát' : 'Thêm Bài Hát Mới'}
                </h2>
                <p className="text-xs text-slate-400 font-light mt-0.5">
                  Tải lên tệp âm thanh MP3/WAV hoặc dán đường dẫn trực tiếp.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form noValidate onSubmit={handleSubmit} className="p-5 sm:p-6 space-y-4">
              {editingTrack && isLegacyBlobTrack(editingTrack) && (
                <div className="p-3.5 rounded-2xl bg-amber-950/60 border border-amber-600/60 text-amber-200 text-xs flex items-start gap-2.5 shadow-md">
                  <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <div className="font-semibold text-amber-300">Bài hát đang dùng Blob URL tạm thời ('blob:...')</div>
                    <p className="text-[11px] text-amber-200/90 mt-0.5">
                      Blob URL là liên kết tạm trong bộ nhớ trình duyệt và đã hết hạn. Hãy bấm nút <strong>"Tải lên từ máy"</strong> bên dưới để đưa tệp MP3 lên Supabase Storage bucket <code>music</code>. Hệ thống sẽ tự động cập nhật URL persistent.
                    </p>
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-3.5 rounded-xl bg-red-950/70 border border-red-800/80 text-red-200 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              {/* Title & Artist */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-slate-300">
                    TIÊU ĐỀ BÀI HÁT <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="VD: Tiếng Sóng Đêm..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-mono font-medium text-slate-300">
                    NGHỆ SĨ / TÁC GIẢ
                  </label>
                  <input
                    type="text"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="VD: Biển Cả, Tự Nhiên..."
                    className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              {/* Audio URL + Upload */}
              <div className="space-y-2">
                <label className="text-xs font-mono font-medium text-slate-300 flex items-center justify-between">
                  <span>TỆP ÂM THANH (AUDIO FILE / URL) <span className="text-red-400">*</span></span>
                  <span className="text-[11px] font-normal text-slate-400">Tối đa 50MB</span>
                </label>
                <input
                  type="text"
                  value={audioUrl}
                  onChange={(e) => setAudioUrl(e.target.value)}
                  placeholder="https://.../music.mp3 hoặc bấm Tải lên từ máy..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                />
                <div className="flex flex-wrap items-center gap-2 pt-0.5">
                  <label className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5">
                    {isUploadingAudio ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{isUploadingAudio ? 'Đang tải lên...' : 'Tải lên từ máy (.mp3, .wav, .ogg)'}</span>
                    <input
                      type="file"
                      accept="audio/*"
                      onChange={handleAudioUpload}
                      disabled={isUploadingAudio}
                      className="hidden"
                    />
                  </label>
                  {audioPath && (
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-emerald-950/60 border border-emerald-700/60 text-[11px] text-emerald-300 font-mono">
                      <Check className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                      <span className="truncate max-w-[280px]">Storage: {audioPath}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Cover Art URL + Upload */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-mono font-medium text-slate-300">
                    ẢNH BÌA BÀI HÁT (TÙY CHỌN)
                  </label>
                  {coverUrl.trim() && (
                    <button
                      type="button"
                      onClick={() => {
                        setCoverUrl('');
                        setCoverPath('');
                        setCoverImageError(false);
                      }}
                      className="text-[11px] text-slate-400 hover:text-red-400 transition-colors font-mono"
                    >
                      Xóa ảnh bìa
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={coverUrl}
                    onChange={(e) => {
                      setCoverUrl(e.target.value);
                      setCoverImageError(false);
                      if (formError) setFormError(null);
                    }}
                    placeholder="https://.../cover.jpg hoặc bấm Tải ảnh bìa..."
                    className="flex-1 px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                  />
                  <label className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-200 text-xs font-medium cursor-pointer transition-colors inline-flex items-center gap-1.5 flex-shrink-0">
                    {isUploadingCover ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-indigo-400" />
                    ) : (
                      <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    )}
                    <span>{isUploadingCover ? 'Đang tải...' : 'Tải ảnh bìa'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleCoverUpload}
                      disabled={isUploadingCover}
                      className="hidden"
                    />
                  </label>
                </div>

                {coverPath && (
                  <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-indigo-950/60 border border-indigo-700/60 text-[11px] text-indigo-300 font-mono">
                    <Check className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="truncate max-w-[320px]">Storage Cover: {coverPath}</span>
                  </div>
                )}

                {/* Cover Image Live Preview Box */}
                {coverUrl.trim() && (
                  <div className="mt-2.5 p-3 rounded-2xl bg-slate-850 border border-slate-700/80 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-14 h-14 rounded-xl overflow-hidden bg-slate-900 border border-slate-700 flex-shrink-0 flex items-center justify-center relative shadow-inner">
                        {!coverImageError ? (
                          <img
                            src={coverUrl.trim()}
                            alt="Xem trước ảnh bìa"
                            onError={() => setCoverImageError(true)}
                            onLoad={() => setCoverImageError(false)}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center p-1 text-amber-400 text-center">
                            <AlertCircle className="w-4 h-4" />
                            <span className="text-[9px] mt-0.5 font-mono">Lỗi tải</span>
                          </div>
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">Xem trước ảnh bìa</span>
                          {!coverImageError ? (
                            <span className="text-[10px] text-emerald-400 bg-emerald-950/70 border border-emerald-800/60 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                              <Check className="w-3 h-3" /> Hợp lệ
                            </span>
                          ) : (
                            <span className="text-[10px] text-amber-400 bg-amber-950/70 border border-amber-800/60 px-2 py-0.5 rounded-full font-mono flex items-center gap-1">
                              <AlertCircle className="w-3 h-3" /> Không tải được ảnh
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400 truncate mt-0.5 font-mono max-w-[260px] sm:max-w-[340px]">
                          {coverUrl.trim()}
                        </p>
                        {coverImageError && (
                          <p className="text-[10px] text-amber-300 mt-1">
                            Không thể tải ảnh từ URL này. Vui lòng kiểm tra lại liên kết hoặc bấm "Tải ảnh bìa" để tải tệp trực tiếp.
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
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

              {/* Active Toggle Switch */}
              <div className="p-3.5 rounded-2xl bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                <div>
                  <div className="text-xs font-semibold text-white">TRẠNG THÁI HOẠT ĐỘNG (ACTIVE)</div>
                  <p className="text-[11px] text-slate-400 font-light mt-0.5">
                    Khi bật, bài hát sẽ xuất hiện trong trình phát nhạc của người dùng.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsActive(!isActive)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors cursor-pointer ${
                    isActive ? 'bg-indigo-600' : 'bg-slate-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      isActive ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>

              {/* Modal Actions */}
              <div className="pt-3 border-t border-slate-800 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-cyan-500 hover:from-indigo-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Đang lưu...</span>
                    </>
                  ) : (
                    <span>{editingTrack ? 'Lưu Thay Đổi' : 'Thêm Bài Hát'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingTrack && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-slate-900 border border-red-800/80 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 text-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-red-950/80 border border-red-700/60 flex items-center justify-center text-red-400 flex-shrink-0">
                <ShieldAlert className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">Xác Nhận Xóa Bài Hát</h3>
                <p className="text-xs text-slate-400 font-light">Thao tác không thể hoàn tác</p>
              </div>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed">
              Bạn có chắc chắn muốn xóa bài hát <strong>"{deletingTrack.title}"</strong> không?
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTrack(null)}
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
