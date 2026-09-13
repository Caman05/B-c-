import React, { useState, useEffect, useRef } from 'react';
import { Character, PageView } from '../types';
import { musicService } from '../services/musicService';
import { storageService } from '../services/storageService';
import { authService, Profile as AuthProfile } from '../services/authService';
import { 
  User, 
  Shield, 
  Edit3, 
  Camera, 
  LogOut, 
  Sparkles, 
  Check, 
  X, 
  Upload,
  ArrowRight,
  ShieldCheck,
  AtSign,
  Loader2
} from 'lucide-react';

interface ProfileProps {
  characters?: Character[];
  onNavigate?: (page: PageView) => void;
  onNavigateToAdmin?: () => void;
  onLogout?: () => void;
}

export const Profile: React.FC<ProfileProps> = ({ 
  onNavigateToAdmin,
  onLogout 
}) => {
  const [isAdmin, setIsAdmin] = useState(() => authService.isAdmin());
  const [profile, setProfile] = useState<AuthProfile>(() => authService.getCurrentUser());
  const [isTestMode, setIsTestMode] = useState(() => authService.isTestMemberMode());

  // Listen for admin role updates and user changes
  useEffect(() => {
    const handleRoleUpdate = () => {
      setIsAdmin(authService.isAdmin());
      setProfile(authService.getCurrentUser());
      setIsTestMode(authService.isTestMemberMode());
    };
    window.addEventListener('be_ca_auth_role_changed', handleRoleUpdate);
    window.addEventListener('be_ca_admin_role_changed', handleRoleUpdate);
    window.addEventListener('be_ca_user_switched', handleRoleUpdate);
    window.addEventListener('be_ca_profiles_updated', handleRoleUpdate);
    window.addEventListener('be_ca_test_mode_changed', handleRoleUpdate);
    return () => {
      window.removeEventListener('be_ca_auth_role_changed', handleRoleUpdate);
      window.removeEventListener('be_ca_admin_role_changed', handleRoleUpdate);
      window.removeEventListener('be_ca_user_switched', handleRoleUpdate);
      window.removeEventListener('be_ca_profiles_updated', handleRoleUpdate);
      window.removeEventListener('be_ca_test_mode_changed', handleRoleUpdate);
    };
  }, []);

  // Sync profiles from Supabase on mount
  useEffect(() => {
    authService.syncProfilesFromSupabase().then(() => {
      setProfile(authService.getCurrentUser());
    });
  }, []);

  // Modal dialog states
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState(false);
  const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);

  // Edit form state
  const [editForm, setEditForm] = useState({
    name: profile.name,
    username: profile.username,
    bio: profile.bio,
  });

  // Avatar form state
  const [newAvatarUrl, setNewAvatarUrl] = useState(profile.avatarUrl);
  const [avatarError, setAvatarError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [uploadSuccessInfo, setUploadSuccessInfo] = useState<{ bucket: string; path: string } | null>(null);
  const [tempPreviewUrl, setTempPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Close avatar modal and cleanup any temporary object URLs
  const handleCloseAvatarModal = () => {
    if (tempPreviewUrl && tempPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(tempPreviewUrl);
    }
    setTempPreviewUrl(null);
    setNewAvatarUrl(profile.avatarUrl);
    setAvatarError(null);
    setUploadSuccessInfo(null);
    setIsAvatarModalOpen(false);
  };

  // Save profile changes (role is protected against modification)
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = authService.updateProfile(profile.id, {
        name: editForm.name.trim() || profile.name,
        username: editForm.username.trim().replace(/^@/, '') || profile.username,
        bio: editForm.bio.trim(),
      });
      setProfile(updated);
      setIsAdmin(authService.isAdmin());
      setIsEditModalOpen(false);
    } catch (err: any) {
      console.error('Error saving profile:', err);
      setIsEditModalOpen(false);
    }
  };

  // Save new avatar (strictly persists to profiles.avatar_url, avoids blob/local paths)
  const handleSaveAvatar = (url: string) => {
    const trimmed = url.trim();
    if (!trimmed) {
      setAvatarError('Vui lòng chọn hoặc nhập liên kết ảnh.');
      return;
    }

    if (trimmed.startsWith('blob:') || trimmed.startsWith('file:') || trimmed.includes('C:\\fakepath')) {
      setAvatarError('Không thể lưu ảnh tạm thời (Blob URL). Vui lòng đợi quá trình tải lên Supabase Storage hoàn tất.');
      return;
    }

    const previousAvatar = profile.avatarUrl;

    try {
      const updated = authService.updateProfile(profile.id, {
        avatarUrl: trimmed,
      });
      setProfile(updated);
      handleCloseAvatarModal();

      // Clean up previous avatar from Supabase Storage if replaced
      if (previousAvatar && previousAvatar !== trimmed) {
        storageService.deleteOldAvatar(previousAvatar, profile.id).catch((err) => {
          console.warn('[Profile] Notice cleaning up previous avatar:', err);
        });
      }
    } catch (err: any) {
      console.error('Error saving avatar:', err);
      setAvatarError(err.message || 'Lỗi khi cập nhật ảnh đại diện.');
    }
  };

  // Handle local avatar image upload to Supabase Storage
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setUploadSuccessInfo(null);

    const check = storageService.validateImage(file);
    if (!check.valid) {
      setAvatarError(check.error || 'Ảnh không hợp lệ.');
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    // Temporary preview with proper cleanup
    if (tempPreviewUrl && tempPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(tempPreviewUrl);
    }
    const tempUrl = URL.createObjectURL(file);
    setTempPreviewUrl(tempUrl);

    setIsUploadingAvatar(true);
    try {
      const uploadRes = await storageService.uploadAvatar(file, profile.id);

      // Clean up temporary blob URL as persistent Supabase Storage URL is now ready
      URL.revokeObjectURL(tempUrl);
      setTempPreviewUrl(null);

      setNewAvatarUrl(uploadRes.url);
      setUploadSuccessInfo({
        bucket: uploadRes.storageBucket,
        path: uploadRes.path,
      });
      setAvatarError(null);
    } catch (err: any) {
      console.error('Error uploading avatar to Supabase Storage:', err);
      URL.revokeObjectURL(tempUrl);
      setTempPreviewUrl(null);
      setAvatarError(err.message || 'Không thể tải ảnh lên Supabase Storage. Vui lòng thử lại.');
    } finally {
      setIsUploadingAvatar(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Handle logout
  const handleConfirmLogout = () => {
    setIsLogoutModalOpen(false);
    if (onLogout) {
      onLogout();
    } else {
      // Fallback reload / return to home
      window.location.reload();
    }
  };

  return (
    <div id="page-ho-so" className="space-y-6 pb-16 animate-fadeIn max-w-2xl mx-auto">
      {/* Header */}
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-cyan-800 text-xs tracking-widest uppercase font-mono font-medium">
          <span>👤</span>
          <span>HỒ SƠ CÁ NHÂN</span>
        </div>
        <p className="text-sm text-[#19436b] font-light">
          Quản lý thông tin tài khoản và không gian bể cá của bạn.
        </p>
      </div>

      {/* Main Profile Card (Layout Gọn Ban Đầu) */}
      <div className="glass-panel rounded-3xl p-6 sm:p-7 border border-white/95 relative overflow-hidden shadow-[0_10px_35px_rgba(8,145,178,0.12)] bg-white/90 space-y-6">
        <div className="relative z-10 flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {/* Avatar with quick change trigger */}
          <div className="relative group">
            <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyan-400/80 shadow-[0_4px_16px_rgba(6,182,212,0.25)] bg-sky-100 flex-shrink-0">
              <img
                src={profile.avatarUrl}
                alt={profile.name}
                className="w-full h-full object-cover"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setNewAvatarUrl(profile.avatarUrl);
                setAvatarError(null);
                setIsAvatarModalOpen(true);
              }}
              title="Đổi ảnh đại diện"
              className="absolute -bottom-1 -right-1 p-1.5 rounded-full bg-cyan-600 hover:bg-cyan-500 text-white shadow-md border-2 border-white transition-all cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Profile Basic Info */}
          <div className="flex-1 space-y-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h2 className="text-2xl font-bold text-[#0a2540] tracking-wide flex items-center justify-center sm:justify-start gap-2">
                  <span>{profile.name}</span>
                  {isAdmin ? (
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 border border-amber-300 text-amber-900 text-[10px] font-mono font-bold uppercase">
                      Admin
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md bg-slate-100 border border-slate-200 text-slate-700 text-[10px] font-mono font-medium uppercase">
                      Thành viên
                    </span>
                  )}
                </h2>
                <p className="text-xs text-cyan-800 font-mono tracking-wider font-medium flex items-center justify-center sm:justify-start gap-1 mt-0.5">
                  <AtSign className="w-3 h-3 text-cyan-600" />
                  <span>{profile.username}</span>
                </p>
              </div>

              {/* Status Badge */}
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 border border-teal-200 text-teal-900 text-xs font-mono font-medium self-center sm:self-start">
                <ShieldCheck className="w-3.5 h-3.5 text-teal-600" />
                <span>Trạng thái: Hoạt động</span>
              </div>
            </div>

            {/* Bio */}
            <p className="text-xs text-[#285075] font-light leading-relaxed pt-1">
              {profile.bio || 'Chưa có thông tin giới thiệu.'}
            </p>
          </div>
        </div>

        {/* 3 Main Action Buttons (Giữ đúng 3 chức năng ban đầu) */}
        <div className="pt-2 border-t border-slate-200/70 flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
          {/* 1. Chỉnh sửa hồ sơ */}
          <button
            id="profile-edit-btn"
            type="button"
            onClick={() => {
              setEditForm({
                name: profile.name,
                username: profile.username,
                bio: profile.bio,
              });
              setIsEditModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0c3559] text-xs font-semibold shadow-2xs transition-all flex items-center gap-2 cursor-pointer hover:border-cyan-300"
          >
            <Edit3 className="w-3.5 h-3.5 text-cyan-600" />
            <span>✏️ Chỉnh sửa hồ sơ</span>
          </button>

          {/* 2. Đổi ảnh đại diện */}
          <button
            id="profile-change-avatar-btn"
            type="button"
            onClick={() => {
              setNewAvatarUrl(profile.avatarUrl);
              setAvatarError(null);
              setUploadSuccessInfo(null);
              setTempPreviewUrl(null);
              setIsAvatarModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-[#0c3559] text-xs font-semibold shadow-2xs transition-all flex items-center gap-2 cursor-pointer hover:border-cyan-300"
          >
            <Camera className="w-3.5 h-3.5 text-teal-600" />
            <span>🖼️ Đổi ảnh đại diện</span>
          </button>

          {/* 3. Đăng xuất */}
          <button
            id="profile-logout-btn"
            type="button"
            onClick={() => setIsLogoutModalOpen(true)}
            className="px-4 py-2 rounded-xl bg-white hover:bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold shadow-2xs transition-all flex items-center gap-2 cursor-pointer hover:border-rose-300 sm:ml-auto"
          >
            <LogOut className="w-3.5 h-3.5 text-rose-500" />
            <span>🚪 Đăng xuất</span>
          </button>
        </div>
      </div>

      {/* Test Member Mode Indicator & Fast Return */}
      {isTestMode && (
        <div 
          id="profile-test-member-banner"
          className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-950 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs animate-fadeIn"
        >
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="text-xl">🧪</span>
            <div>
              <h4 className="text-xs font-bold text-amber-900">
                Đang ở chế độ xem thử Thành viên (Member View)
              </h4>
              <p className="text-[11px] text-amber-800">
                Thanh Admin Dashboard đang tạm thời bị ẩn để mô phỏng giao diện tài khoản Member.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              authService.restoreOwnerAdmin();
            }}
            className="w-full sm:w-auto px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-xs shadow-xs transition-colors cursor-pointer whitespace-nowrap"
          >
            Quay lại quyền Chủ App (Admin)
          </button>
        </div>
      )}

      {/* Admin Dashboard / Thanh Admin Ban Đầu (CHỈ ADMIN MỚI THẤY) */}
      {isAdmin && onNavigateToAdmin && (
        <div 
          id="profile-admin-dashboard-bar"
          className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-slate-800 to-[#0b243b] border border-cyan-500/40 text-white flex flex-col sm:flex-row items-center justify-between gap-4 shadow-lg animate-fadeIn"
        >
          <div className="flex items-center gap-3.5 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-400/40 flex items-center justify-center text-cyan-300 flex-shrink-0">
              <Shield className="w-5 h-5" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="font-bold text-sm text-cyan-200 tracking-wide">
                  Admin Dashboard
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-400/20 text-amber-300 border border-amber-400/30">
                  QUẢN TRỊ VIÊN
                </span>
              </div>
              <p className="text-xs text-slate-300 font-light">
                Quản lý toàn bộ Nhân vật, Thẻ Tag, Âm nhạc và Cấu hình Mở Khóa của BỂ CÁ.
              </p>
            </div>
          </div>

          <button
            id="profile-goto-admin-btn"
            type="button"
            onClick={onNavigateToAdmin}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl bg-gradient-to-r from-teal-400 to-cyan-400 hover:from-teal-300 hover:to-cyan-300 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2 flex-shrink-0 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-slate-900" />
            <span>Vào Admin Dashboard (/admin)</span>
            <ArrowRight className="w-3.5 h-3.5 text-slate-900" />
          </button>
        </div>
      )}

      {/* Modal 1: ✏️ Chỉnh sửa hồ sơ */}
      {isEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0a2540] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-cyan-600" />
                <span>Chỉnh sửa hồ sơ</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsEditModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên hiển thị
                </label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  placeholder="Nhập tên hiển thị..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-900"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên tài khoản (username)
                </label>
                <input
                  type="text"
                  value={editForm.username}
                  onChange={(e) => setEditForm({ ...editForm, username: e.target.value })}
                  placeholder="nguoilanbien"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-900 font-mono"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Giới thiệu (Bio)
                </label>
                <textarea
                  value={editForm.bio}
                  onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                  placeholder="Viết một vài dòng về bản thân hoặc tình yêu với biển cả..."
                  rows={3}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-900"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditModalOpen(false)}
                  className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-xs cursor-pointer"
                >
                  Lưu thay đổi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: 🖼️ Đổi ảnh đại diện */}
      {isAvatarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="text-base font-bold text-[#0a2540] flex items-center gap-2">
                <Camera className="w-4 h-4 text-teal-600" />
                <span>Đổi ảnh đại diện</span>
              </h3>
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={handleCloseAvatarModal}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Preview */}
            <div className="flex flex-col items-center gap-3 py-2">
              <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-cyan-400 shadow-md bg-slate-100 relative">
                <img
                  src={tempPreviewUrl || newAvatarUrl || profile.avatarUrl}
                  alt="Xem trước ảnh đại diện"
                  className="w-full h-full object-cover"
                  referrerPolicy="no-referrer"
                  onError={() => setAvatarError('Không thể tải hình ảnh từ liên kết này.')}
                />
                {isUploadingAvatar && (
                  <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs flex flex-col items-center justify-center text-white gap-1">
                    <Loader2 className="w-6 h-6 animate-spin text-cyan-300" />
                    <span className="text-[10px] font-mono font-medium">Đang tải lên...</span>
                  </div>
                )}
              </div>
              <span className="text-[11px] text-slate-500">Xem trước ảnh đại diện</span>
            </div>

            {uploadSuccessInfo && (
              <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs text-center space-y-0.5 animate-fadeIn">
                <div className="flex items-center justify-center gap-1.5 font-semibold">
                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                  <span>Đã lưu vào Supabase Storage</span>
                </div>
                <p className="text-[10px] font-mono text-emerald-700 truncate">
                  Bucket: {uploadSuccessInfo.bucket} • Path: {uploadSuccessInfo.path}
                </p>
              </div>
            )}

            {avatarError && (
              <p className="text-xs text-rose-600 bg-rose-50 p-2 rounded-xl border border-rose-200 text-center animate-fadeIn">
                {avatarError}
              </p>
            )}

            {/* Upload from device */}
            <input
              type="file"
              ref={fileInputRef}
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleFileUpload}
              className="hidden"
            />

            <div className="space-y-3">
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={() => fileInputRef.current?.click()}
                className="w-full py-2.5 px-3 rounded-xl bg-slate-50 hover:bg-slate-100 border border-slate-200 text-[#0a2540] text-xs font-medium flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-600" />
                    <span>Đang tải lên Supabase Storage...</span>
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Tải ảnh từ máy tính (PNG, JPEG, WEBP)</span>
                  </>
                )}
              </button>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase font-mono text-slate-400">
                  <span className="bg-white px-2">Hoặc nhập liên kết ảnh</span>
                </div>
              </div>

              <div>
                <input
                  type="text"
                  value={newAvatarUrl}
                  disabled={isUploadingAvatar}
                  onChange={(e) => {
                    setNewAvatarUrl(e.target.value);
                    setAvatarError(null);
                    setUploadSuccessInfo(null);
                  }}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-cyan-400 text-slate-900 disabled:bg-slate-50"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                disabled={isUploadingAvatar}
                onClick={handleCloseAvatarModal}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer disabled:opacity-50"
              >
                Hủy
              </button>
              <button
                type="button"
                disabled={isUploadingAvatar || !newAvatarUrl.trim()}
                onClick={() => handleSaveAvatar(newAvatarUrl)}
                className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-xs cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
              >
                {isUploadingAvatar ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Đang lưu...</span>
                  </>
                ) : (
                  <span>Áp dụng ảnh</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: 🚪 Xác nhận Đăng xuất */}
      {isLogoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs animate-fadeIn">
          <div className="w-full max-w-sm bg-white rounded-3xl p-6 border border-slate-200 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <LogOut className="w-6 h-6" />
            </div>

            <div className="space-y-1">
              <h3 className="text-base font-bold text-[#0a2540]">
                Đăng xuất tài khoản?
              </h3>
              <p className="text-xs text-slate-500 font-light">
                Bạn có chắc chắn muốn đăng xuất khỏi BỂ CÁ không?
              </p>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsLogoutModalOpen(false)}
                className="flex-1 py-2 px-3 rounded-xl border border-slate-200 text-slate-600 hover:bg-slate-50 text-xs font-medium cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmLogout}
                className="flex-1 py-2 px-3 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-xs cursor-pointer"
              >
                Đăng xuất
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

