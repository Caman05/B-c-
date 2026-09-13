import React, { useState, useEffect } from 'react';
import { authService, Profile, APP_OWNER_EMAIL, APP_OWNER_ID } from '../../services/authService';
import { userCharacterRepository } from '../../services/userCharacterRepository';
import { 
  Users, 
  ShieldCheck, 
  ShieldAlert, 
  User, 
  Lock, 
  Key, 
  Check, 
  AlertCircle,
  Database,
  ArrowRight,
  Shield,
  Crown
} from 'lucide-react';

export const AdminUsers: React.FC = () => {
  const [profiles, setProfiles] = useState<Profile[]>(() => authService.getAllProfiles());
  const [currentUser, setCurrentUser] = useState<Profile>(() => authService.getCurrentUser());
  const [isAdmin, setIsAdmin] = useState(() => authService.isAdmin());

  // Count unlocked characters for each user
  const [userStats, setUserStats] = useState<Record<string, number>>({});

  const calculateStats = () => {
    const stats: Record<string, number> = {};
    const all = authService.getAllProfiles();
    for (const p of all) {
      const rels = userCharacterRepository.getUserRelations(p.id);
      stats[p.id] = Object.values(rels).filter((r) => r.isUnlocked).length;
    }
    setUserStats(stats);
  };

  useEffect(() => {
    calculateStats();

    const handleUpdate = () => {
      setProfiles(authService.getAllProfiles());
      setCurrentUser(authService.getCurrentUser());
      setIsAdmin(authService.isAdmin());
      calculateStats();
    };

    window.addEventListener('be_ca_user_character_changed', handleUpdate);
    window.addEventListener('be_ca_user_switched', handleUpdate);
    window.addEventListener('be_ca_profiles_updated', handleUpdate);
    window.addEventListener('be_ca_auth_role_changed', handleUpdate);
    window.addEventListener('be_ca_test_mode_changed', handleUpdate);

    return () => {
      window.removeEventListener('be_ca_user_character_changed', handleUpdate);
      window.removeEventListener('be_ca_user_switched', handleUpdate);
      window.removeEventListener('be_ca_profiles_updated', handleUpdate);
      window.removeEventListener('be_ca_auth_role_changed', handleUpdate);
      window.removeEventListener('be_ca_test_mode_changed', handleUpdate);
    };
  }, []);

  const handleSwitchUser = (uid: string) => {
    if (uid === APP_OWNER_ID) {
      authService.restoreOwnerAdmin();
    } else {
      authService.enterTestMemberMode(uid);
    }
    userCharacterRepository.setCurrentUserId(uid);
    setCurrentUser(authService.getCurrentUser());
    setIsAdmin(authService.isAdmin());
  };

  return (
    <div id="admin-users-page" className="space-y-6 animate-fadeIn">
      {/* Header Info */}
      <div>
        <div className="flex items-center gap-2 text-purple-400 text-xs font-mono uppercase tracking-widest font-semibold">
          <span>👥</span>
          <span>NGƯỜI DÙNG & PHÂN QUYỀN (RBAC)</span>
        </div>
        <h1 
          className="text-2xl sm:text-3xl font-bold text-white tracking-wide mt-1"
          style={{ fontFamily: "'Cinzel', serif" }}
        >
          Người Dùng & Phân Quyền Bảo Mật
        </h1>
        <p className="text-xs text-slate-400 font-light mt-0.5">
          Quản trị tài khoản, kiểm tra phân quyền RBAC và xác minh các lớp bảo vệ RLS Supabase.
        </p>
      </div>

      {/* Security Architecture Explainer Card */}
      <div className="bg-slate-800/60 border border-slate-700/70 rounded-3xl p-5 sm:p-6 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-teal-500/20 border border-teal-500/40 flex items-center justify-center text-teal-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-white uppercase tracking-wider">
              Nguyên Tắc Phân Quyền & Bảo Mật Cốt Lõi (Supabase RLS & RBAC)
            </h2>
            <p className="text-xs text-slate-400 font-light">
              Tài khoản chủ app là Admin duy nhất. Người dùng thường có vai trò Member và không thể tự cấp quyền.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2 text-xs">
          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="font-semibold text-teal-300 font-mono flex items-center gap-1.5">
              <Crown className="w-3.5 h-3.5 text-amber-400" />
              <span>Chủ App Là Admin Duy Nhất</span>
            </div>
            <p className="text-slate-400 text-[11px] font-light leading-relaxed">
              Chỉ tài khoản chủ app mới được hệ thống gán vai trò <code>admin</code>. Không tạo thêm bất kỳ Admin nào khác.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="font-semibold text-cyan-300 font-mono flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>RLS Chống Tự Đổi Role</span>
            </div>
            <p className="text-slate-400 text-[11px] font-light leading-relaxed">
              Mọi tài khoản đăng ký mới tự động nhận vai trò <code>member</code>. RLS policies trên <code>profiles</code> nghiêm cấm người dùng tự sửa role thành <code>admin</code>.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 space-y-1.5">
            <div className="font-semibold text-purple-300 font-mono flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5" />
              <span>Chặn Truy Cập Phân Hệ Admin</span>
            </div>
            <p className="text-slate-400 text-[11px] font-light leading-relaxed">
              Tài khoản có role <code>member</code> không nhìn thấy thanh Admin trong Hồ Sơ và bị <code>AdminAccessGuard</code> chặn 403 Forbidden nếu cố vào <code>/admin</code>.
            </p>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-slate-800/50 border border-slate-700/70 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-4 sm:p-5 border-b border-slate-700/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">
              Danh Sách Tài Khoản Trong Hệ Thống ({profiles.length})
            </h3>
          </div>
          <span className="text-xs font-mono text-slate-400">1 Chủ App (Admin) + {profiles.length - 1} Thành Viên (Member)</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-700/80 bg-slate-900/60 text-slate-400 font-mono text-[11px] uppercase tracking-wider">
                <th className="p-3.5 sm:p-4">Tài Khoản</th>
                <th className="p-3.5 sm:p-4">Vai Trò (Role)</th>
                <th className="p-3.5 sm:p-4">Số Nhân Vật Đã Mở</th>
                <th className="p-3.5 sm:p-4">Trạng Thái Phiên</th>
                <th className="p-3.5 sm:p-4 text-right">Chuyển Phiên Kiểm Thử</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/40">
              {profiles.map((user) => {
                const isCurrent = currentUser.id === user.id;
                const isOwner = user.email.toLowerCase() === APP_OWNER_EMAIL.toLowerCase();
                const unlocked = userStats[user.id] || 0;

                return (
                  <tr key={user.id} className="hover:bg-slate-800/60 transition-colors">
                    <td className="p-3.5 sm:p-4 font-mono font-medium text-white">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-8 h-8 rounded-lg border flex items-center justify-center ${
                          isOwner 
                            ? 'bg-amber-500/20 border-amber-400/40 text-amber-300' 
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}>
                          {isOwner ? <Crown className="w-4 h-4" /> : <User className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-2">
                            <span>{user.name}</span>
                            {isOwner && (
                              <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 border border-amber-400/30 uppercase font-mono">
                                Chủ App
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-cyan-400 font-mono">@{user.username || user.id}</span>
                        </div>
                      </div>
                    </td>

                    <td className="p-3.5 sm:p-4">
                      {user.role === 'admin' ? (
                        <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-bold uppercase bg-amber-400/20 border border-amber-400/40 text-amber-300">
                          admin
                        </span>
                      ) : (
                        <span className="px-2.5 py-0.5 rounded-full font-mono text-[10px] font-medium uppercase bg-slate-800 border border-slate-700 text-slate-400">
                          member
                        </span>
                      )}
                    </td>

                    <td className="p-3.5 sm:p-4 font-mono">
                      <span className="text-teal-300 font-semibold">{unlocked}</span>
                      <span className="text-slate-500"> nhân vật</span>
                    </td>

                    <td className="p-3.5 sm:p-4">
                      {isCurrent ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-cyan-300 font-medium">
                          <Check className="w-3.5 h-3.5 text-cyan-400" />
                          <span>Đang đăng nhập</span>
                        </span>
                      ) : (
                        <span className="text-slate-500 text-[11px]">Ngoại tuyến</span>
                      )}
                    </td>

                    <td className="p-3.5 sm:p-4 text-right">
                      {!isCurrent ? (
                        <button
                          type="button"
                          onClick={() => handleSwitchUser(user.id)}
                          className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium transition-colors cursor-pointer"
                        >
                          Chuyển sang tài khoản này
                        </button>
                      ) : (
                        <span className="text-[11px] font-mono text-cyan-400 font-semibold">Hiện tại</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Verification Sandbox: Switch between Owner (Admin) and Member */}
      <div className="bg-slate-800/40 border border-purple-500/30 rounded-3xl p-5 sm:p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Shield className="w-4 h-4 text-purple-400" />
              <span>Hộp Kiểm Thử Phân Quyền (Verification Sandbox)</span>
            </h3>
            <p className="text-xs text-slate-400 font-light mt-0.5">
              Cho phép chuyển đổi giữa tài khoản Chủ App (Admin) và Tài khoản Member để kiểm tra cơ chế chặn truy cập <code>/admin</code>.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {isAdmin ? (
              <button
                type="button"
                onClick={() => handleSwitchUser('user-demo-1')}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 bg-amber-600/30 border border-amber-500 text-amber-200 hover:bg-amber-600/50"
              >
                <ShieldAlert className="w-4 h-4 text-amber-400" />
                <span>Chuyển sang Member (Thử nghiệm chặn /admin)</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => handleSwitchUser(APP_OWNER_ID)}
                className="px-4 py-2 rounded-xl text-xs font-semibold transition-all cursor-pointer flex items-center gap-2 bg-teal-600 border border-teal-500 text-white hover:bg-teal-500"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Đăng nhập lại Chủ App</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
