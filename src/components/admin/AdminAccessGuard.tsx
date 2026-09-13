import React, { useState, useEffect } from 'react';
import { musicService } from '../../services/musicService';
import { authService, APP_OWNER_EMAIL } from '../../services/authService';
import { ShieldAlert, ArrowLeft, Lock, ShieldCheck, RefreshCw } from 'lucide-react';

interface AdminAccessGuardProps {
  children: React.ReactNode;
  onExitAdmin: () => void;
}

export const AdminAccessGuard: React.FC<AdminAccessGuardProps> = ({ children, onExitAdmin }) => {
  const [isAdmin, setIsAdmin] = useState(() => musicService.isAdminUser());
  const isTestMode = authService.isTestMemberMode();
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    const handleRoleCheck = () => {
      setIsAdmin(musicService.isAdminUser());
    };
    window.addEventListener('be_ca_admin_role_changed', handleRoleCheck);
    window.addEventListener('be_ca_auth_role_changed', handleRoleCheck);
    window.addEventListener('be_ca_test_mode_changed', handleRoleCheck);
    window.addEventListener('be_ca_user_switched', handleRoleCheck);
    return () => {
      window.removeEventListener('be_ca_admin_role_changed', handleRoleCheck);
      window.removeEventListener('be_ca_auth_role_changed', handleRoleCheck);
      window.removeEventListener('be_ca_test_mode_changed', handleRoleCheck);
      window.removeEventListener('be_ca_user_switched', handleRoleCheck);
    };
  }, []);

  const handleRestoreOwner = () => {
    authService.restoreOwnerAdmin();
    setIsAdmin(true);
  };

  if (!isAdmin) {
    return (
      <div 
        id="admin-access-denied-view" 
        className="min-h-screen flex items-center justify-center p-4 bg-slate-900/90 text-slate-100 backdrop-blur-md animate-fadeIn"
      >
        <div className="max-w-md w-full bg-slate-800/90 border border-red-500/30 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="text-[11px] font-mono tracking-widest text-red-400 uppercase font-semibold">
              403 • ACCESS FORBIDDEN
            </span>
            <h2 className="text-2xl font-bold text-white tracking-wide" style={{ fontFamily: "'Cinzel', serif" }}>
              Từ Chối Truy Cập
            </h2>
            <p className="text-xs text-slate-300 font-light leading-relaxed">
              Khu vực Quản trị viên (Admin Dashboard) được bảo vệ nghiêm ngặt bằng cơ chế Row Level Security (RLS) của Supabase. Tài khoản hiện tại của bạn không có vai trò <strong>admin</strong> trong bảng <code>profiles</code>.
            </p>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-900/60 border border-slate-700 text-left text-[11px] text-slate-400 font-mono space-y-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-amber-400">
                <Lock className="w-3 h-3" />
                <span>Security Rule: Only role === 'admin'</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                {currentUser.role}
              </span>
            </div>
            <p className="text-slate-500">
              Đang đăng nhập: <strong className="text-slate-300">{currentUser.email || currentUser.username}</strong>
            </p>
          </div>

          {/* If the user is testing as member or trapped in test session */}
          {(isTestMode || currentUser.role !== 'admin') && (
            <div className="p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-500/40 text-left text-xs text-cyan-200 space-y-2">
              <div className="flex items-center gap-2 text-cyan-300 font-semibold text-xs">
                <span>🧪</span>
                <span>Chế độ Xem thử Thành viên (Member Test)</span>
              </div>
              <p className="text-[11px] text-cyan-100/80 leading-relaxed">
                Tài khoản Owner chính chủ là <code className="bg-cyan-900/60 px-1 py-0.5 rounded text-cyan-300">{APP_OWNER_EMAIL}</code>. Bạn có thể khôi phục ngay quyền Admin:
              </p>
              <button
                id="admin-guard-restore-btn"
                type="button"
                onClick={handleRestoreOwner}
                className="w-full py-2 px-3 rounded-lg bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs shadow-md transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <ShieldCheck className="w-4 h-4 text-slate-950" />
                <span>Thoát Chế Độ Thử Nghiệm & Mở Admin</span>
              </button>
            </div>
          )}

          <div className="flex flex-col gap-2 pt-2">
            <button
              id="admin-guard-return-btn"
              type="button"
              onClick={onExitAdmin}
              className="w-full py-2.5 px-4 rounded-xl bg-slate-700 hover:bg-slate-600 text-white font-medium text-xs shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay về Bể Cá (Client View)</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
