import React, { useState, useEffect } from 'react';
import { Character, UnlockType } from '../../types';
import { characterRepository } from '../../services/characterRepository';
import { unlockService } from '../../services/unlockService';
import { userCharacterRepository } from '../../services/userCharacterRepository';
import { resolveCharacterImageUrl, DEFAULT_FALLBACK_AVATAR } from '../../lib/imageUtils';
import { 
  Lock, 
  Unlock, 
  KeyRound, 
  UserCheck, 
  UserX, 
  Check, 
  AlertCircle, 
  Compass, 
  ShieldCheck, 
  User, 
  Sparkles,
  Edit2
} from 'lucide-react';

interface AdminUnlocksProps {
  initialCharacterId?: string | null;
}

export const AdminUnlocks: React.FC<AdminUnlocksProps> = ({ initialCharacterId }) => {
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacterId, setSelectedCharacterId] = useState<string>('');
  const [targetUserId, setTargetUserId] = useState<string>('user-demo-1');

  // Manual unlock state for target user
  const [isTargetUserUnlocked, setIsTargetUserUnlocked] = useState<boolean>(false);

  // Edit Unlock Config State for selected character
  const [editUnlockType, setEditUnlockType] = useState<UnlockType>('none');
  const [editSecretCode, setEditSecretCode] = useState<string>('');
  const [editRequiredCount, setEditRequiredCount] = useState<number>(3);
  const [editConditionDesc, setEditConditionDesc] = useState<string>('');

  // Feedback Toast
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const loadData = () => {
    const chars = characterRepository.loadCatalog();
    setCharacters(chars);

    if (chars.length > 0) {
      const charToSelect = initialCharacterId && chars.some((c) => c.id === initialCharacterId)
        ? initialCharacterId
        : chars[0].id;
      setSelectedCharacterId((prev) => prev || charToSelect);
    }
  };

  useEffect(() => {
    loadData();

    const handleUpdate = () => loadData();
    window.addEventListener('be_ca_catalog_updated', handleUpdate);
    window.addEventListener('be_ca_user_character_changed', checkUserRelation);
    window.addEventListener('be_ca_user_switched', checkUserRelation);

    return () => {
      window.removeEventListener('be_ca_catalog_updated', handleUpdate);
      window.removeEventListener('be_ca_user_character_changed', checkUserRelation);
      window.removeEventListener('be_ca_user_switched', checkUserRelation);
    };
  }, []);

  // Update form fields when selectedCharacterId changes
  useEffect(() => {
    if (!selectedCharacterId) return;
    const char = characters.find((c) => c.id === selectedCharacterId);
    if (char) {
      setEditUnlockType(char.unlockType || 'none');
      const code = characterRepository.getSecretCode(char.id) || unlockService.adminGetUnlockCode(char.id) || '';
      setEditSecretCode(code);
      if (char.unlockCondition) {
        setEditRequiredCount(char.unlockCondition.requiredCount || 3);
        setEditConditionDesc(char.unlockCondition.description || '');
      } else {
        setEditRequiredCount(3);
        setEditConditionDesc('');
      }
    }
    checkUserRelation();
  }, [selectedCharacterId, targetUserId, characters]);

  const checkUserRelation = () => {
    if (!selectedCharacterId || !targetUserId) return;
    const rel = userCharacterRepository.getUserRelation(selectedCharacterId, targetUserId);
    setIsTargetUserUnlocked(Boolean(rel?.isUnlocked));
  };

  const selectedCharacter = characters.find((c) => c.id === selectedCharacterId);

  // Save global unlock config
  const handleSaveUnlockConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCharacter) return;

    try {
      await characterRepository.updateUnlockConfig(
        selectedCharacter.id,
        editUnlockType,
        editUnlockType === 'condition' ? {
          type: 'collection_count',
          requiredCount: editRequiredCount,
          description: editConditionDesc.trim() || `Cần mở khóa ít nhất ${editRequiredCount} nhân vật trong Bể Cá.`,
        } : undefined,
        editUnlockType === 'code' ? editSecretCode.trim().toUpperCase() : undefined
      );

      setFeedback({
        type: 'success',
        message: `Đã cập nhật cấu hình mở khóa cho "${selectedCharacter.name}" (Kiểu: ${editUnlockType.toUpperCase()}) thành công.`,
      });
      loadData();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi lưu cấu hình mở khóa.' });
    }
  };

  // Grant Manual Unlock
  const handleGrantManual = async () => {
    if (!selectedCharacterId || !targetUserId) return;
    try {
      const result = await unlockService.adminGrantManualUnlock(selectedCharacterId, targetUserId);
      setFeedback({
        type: result.success ? 'success' : 'error',
        message: result.message,
      });
      checkUserRelation();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi cấp quyền mở khóa.' });
    }
  };

  // Revoke Manual Unlock
  const handleRevokeManual = async () => {
    if (!selectedCharacterId || !targetUserId) return;
    try {
      const result = await unlockService.adminRevokeManualUnlock(selectedCharacterId, targetUserId);
      setFeedback({
        type: result.success ? 'success' : 'error',
        message: result.message,
      });
      checkUserRelation();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Lỗi khi thu hồi quyền mở khóa.' });
    }
  };

  return (
    <div id="admin-unlocks-page" className="space-y-6 animate-fadeIn">
      {/* Header Info */}
      <div>
        <div className="flex items-center gap-2 text-amber-400 text-xs font-mono uppercase tracking-widest font-semibold">
          <span>🔐</span>
          <span>QUẢN LÝ MỞ KHÓA NỘI DUNG</span>
        </div>
        <h1 
          className="text-2xl sm:text-3xl font-bold text-white tracking-wide mt-1"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Cấu Hình Mở Khóa & Manual Unlock
        </h1>
        <p className="text-xs text-slate-400 font-light mt-0.5">
          Quản trị mã bí mật, điều kiện tiến độ và cấp/thu hồi quyền mở khóa thủ công cho từng người dùng.
        </p>
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

      {/* Character Selector Banner */}
      <div className="bg-slate-800/60 p-4 sm:p-5 rounded-3xl border border-slate-700/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="space-y-1 w-full sm:w-auto">
          <label className="text-xs font-mono text-cyan-400 font-semibold uppercase">
            CHỌN NHÂN VẬT CẦN CẤU HÌNH:
          </label>
          <div className="flex items-center gap-3">
            <select
              value={selectedCharacterId}
              onChange={(e) => setSelectedCharacterId(e.target.value)}
              className="px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white font-medium focus:outline-none focus:border-cyan-500 cursor-pointer w-full sm:w-64"
            >
              {characters.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {Boolean(c.isLocked ?? c.locked) ? '🔒 (Khóa)' : '🔓 (Mở)'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {selectedCharacter && (
          <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-slate-900/80 border border-slate-800 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-xl overflow-hidden bg-slate-800 border border-slate-700 flex-shrink-0">
              <img
                src={resolveCharacterImageUrl(selectedCharacter.avatar)}
                alt={selectedCharacter.name}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = DEFAULT_FALLBACK_AVATAR;
                }}
              />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">{selectedCharacter.name}</div>
              <div className="text-[11px] font-mono text-slate-400 flex items-center gap-2">
                <span>Kiểu: <strong className="text-cyan-300 uppercase">{selectedCharacter.unlockType || 'none'}</strong></span>
                <span>•</span>
                <span>ID: {selectedCharacter.id}</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Two Column Bento Grid: Left = Unlock Config, Right = Manual Unlock For User */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Panel 1: Unlock Type & Secrets Configuration */}
        <div className="bg-slate-800/50 border border-slate-700/70 rounded-3xl p-5 sm:p-6 space-y-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <div className="flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                1. Cấu Hình Kiểu Mở Khóa (Global)
              </h2>
            </div>
            <span className="text-[10px] font-mono text-slate-400">Database Schema</span>
          </div>

          <form onSubmit={handleSaveUnlockConfig} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-mono font-medium text-slate-300">
                KIỂU MỞ KHÓA (UNLOCK TYPE)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(['none', 'code', 'condition', 'manual'] as UnlockType[]).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setEditUnlockType(type)}
                    className={`py-2 px-1 rounded-xl text-xs font-medium border text-center transition-all cursor-pointer ${
                      editUnlockType === type
                        ? 'bg-amber-500/20 border-amber-400 text-amber-200 font-semibold'
                        : 'bg-slate-900/80 border-slate-700 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {type.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>

            {/* Secret Code Input (Admin Only Secrets) */}
            {editUnlockType === 'code' && (
              <div className="p-4 rounded-2xl bg-amber-950/30 border border-amber-800/50 space-y-2">
                <label className="text-xs font-mono text-amber-300 font-semibold flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5" />
                  <span>MÃ BÍ MẬT TRONG `character_secrets`</span>
                </label>
                <input
                  type="text"
                  required
                  value={editSecretCode}
                  onChange={(e) => setEditSecretCode(e.target.value.toUpperCase())}
                  placeholder="VD: VOLCANO_FORGE, DEEP_TRENCH..."
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-900 border border-amber-700/60 text-amber-200 font-mono text-sm tracking-wider uppercase focus:outline-none focus:border-amber-400"
                />
                <p className="text-[10px] text-amber-300/70 font-light">
                  Mã này chỉ Admin mới nhìn thấy và sửa được. Người dùng phải nhập chính xác mã này để mở khóa.
                </p>
              </div>
            )}

            {/* Condition Config */}
            {editUnlockType === 'condition' && (
              <div className="p-4 rounded-2xl bg-cyan-950/30 border border-cyan-800/50 space-y-3">
                <label className="text-xs font-mono text-cyan-300 font-semibold flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5" />
                  <span>ĐIỀU KIỆN TIẾN ĐỘ BỂ CÁ</span>
                </label>
                <div className="flex items-center gap-2 text-xs text-slate-300">
                  <span>Số lượng nhân vật yêu cầu:</span>
                  <input
                    type="number"
                    min={1}
                    max={50}
                    value={editRequiredCount}
                    onChange={(e) => setEditRequiredCount(parseInt(e.target.value) || 1)}
                    className="w-16 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-700 text-white text-xs font-mono text-center"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-400">Mô tả hiển thị cho người dùng:</label>
                  <input
                    type="text"
                    value={editConditionDesc}
                    onChange={(e) => setEditConditionDesc(e.target.value)}
                    placeholder="VD: Cần mở khóa ít nhất 3 nhân vật trong Bể Cá."
                    className="w-full px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-slate-200 text-xs focus:outline-none focus:border-cyan-400"
                  />
                </div>
              </div>
            )}

            {editUnlockType === 'manual' && (
              <div className="p-4 rounded-2xl bg-purple-950/30 border border-purple-800/50 text-xs text-purple-200 font-light">
                Chỉ Admin mới có thể cấp quyền mở khóa nhân vật này cho từng người dùng cụ thể ở bảng bên phải.
              </div>
            )}

            {editUnlockType === 'none' && (
              <div className="p-4 rounded-2xl bg-slate-900/60 border border-slate-800 text-xs text-slate-400 font-light">
                Nhân vật không yêu cầu điều kiện đặc biệt. Bơi tự do trong Bể Cá.
              </div>
            )}

            <button
              type="submit"
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <Edit2 className="w-3.5 h-3.5" />
              <span>Cập Nhật Cấu Hình Mở Khóa</span>
            </button>
          </form>
        </div>

        {/* Panel 2: Manual Unlock for Specific User (Section 12 of prompt) */}
        <div className="bg-slate-800/50 border border-slate-700/70 rounded-3xl p-5 sm:p-6 space-y-5 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4 text-purple-400" />
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  2. Cấp / Thu Hồi Quyền Mở Khóa (Per User)
                </h2>
              </div>
              <span className="text-[10px] font-mono text-purple-300">Admin Grant</span>
            </div>

            <p className="text-xs text-slate-400 font-light leading-relaxed">
              Cấp quyền mở khóa thủ công cho một tài khoản cụ thể. User được cấp sẽ có <code>unlocked = true</code> đối với nhân vật này mà không ảnh hưởng đến các người dùng khác.
            </p>

            {/* Select Target User */}
            <div className="space-y-2">
              <label className="text-xs font-mono font-medium text-slate-300">
                CHỌN TÀI KHOẢN NGƯỜI DÙNG:
              </label>
              <div className="grid grid-cols-2 gap-2">
                {['user-demo-1', 'user-demo-2'].map((uid) => (
                  <button
                    key={uid}
                    type="button"
                    onClick={() => setTargetUserId(uid)}
                    className={`p-3 rounded-2xl border text-left transition-all cursor-pointer ${
                      targetUserId === uid
                        ? 'bg-purple-950/40 border-purple-500 text-purple-200 font-medium'
                        : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:text-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <User className="w-3.5 h-3.5 text-purple-400" />
                      <span className="text-xs font-mono font-semibold">{uid}</span>
                    </div>
                    <p className="text-[10px] text-slate-500 mt-1 font-sans">
                      {uid === 'user-demo-1' ? 'Tài khoản thử nghiệm 1' : 'Tài khoản thử nghiệm 2'}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Current Status for Selected User */}
            <div className="p-4 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-400">Trạng thái đối với <strong>{targetUserId}</strong>:</span>
                <span className={`px-2.5 py-0.5 rounded-full font-mono text-[11px] font-semibold ${
                  isTargetUserUnlocked
                    ? 'bg-teal-950 border border-teal-700 text-teal-300'
                    : 'bg-amber-950 border border-amber-700 text-amber-300'
                }`}>
                  {isTargetUserUnlocked ? 'ĐÃ MỞ KHÓA (UNLOCKED)' : 'ĐANG KHÓA (LOCKED)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 font-light">
                Nhân vật: <strong>{selectedCharacter?.name}</strong> • Quyền hạn ghi nhận trong bảng <code>user_characters</code>.
              </p>
            </div>
          </div>

          {/* Action Buttons for Manual Unlock */}
          <div className="pt-4 border-t border-slate-700/60 space-y-2">
            {!isTargetUserUnlocked ? (
              <button
                id="admin-grant-manual-unlock-btn"
                type="button"
                onClick={handleGrantManual}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 hover:from-teal-600 hover:to-cyan-600 text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <UserCheck className="w-4 h-4" />
                <span>Cấp Quyền Mở Khóa Thủ Công</span>
              </button>
            ) : (
              <button
                id="admin-revoke-manual-unlock-btn"
                type="button"
                onClick={handleRevokeManual}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-700 hover:to-rose-700 text-white text-xs font-semibold shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <UserX className="w-4 h-4" />
                <span>Thu Hồi Quyền Mở Khóa Của User Này</span>
              </button>
            )}
            <p className="text-[11px] text-center text-slate-500 font-light">
              User thường không thể tự cấp quyền mở khóa cho chính mình hoặc người dùng khác.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
