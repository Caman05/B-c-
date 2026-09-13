import React from 'react';
import { RotateCcw } from 'lucide-react';

interface EmptyCharacterResultProps {
  onReset: () => void;
  message?: string;
  description?: string;
}

export const EmptyCharacterResult: React.FC<EmptyCharacterResultProps> = ({
  onReset,
  message = 'Không tìm thấy nhân vật phù hợp.',
  description = 'Hãy thử tìm bằng từ khóa khác hoặc điều chỉnh các bộ lọc trạng thái và thẻ thể loại.',
}) => {
  return (
    <div 
      id="empty-character-result"
      className="glass-panel rounded-3xl p-10 sm:p-12 text-center max-w-md mx-auto space-y-3.5 border border-white/95 bg-white/85 shadow-sm animate-fadeIn"
    >
      <div className="w-12 h-12 rounded-full bg-cyan-100/80 mx-auto flex items-center justify-center text-cyan-600 text-xl shadow-2xs">
        🫧
      </div>
      <h3 className="text-base font-semibold text-[#0a2540]">{message}</h3>
      <p className="text-xs text-[#2b557c] leading-relaxed font-light">
        {description}
      </p>
      <button
        type="button"
        onClick={onReset}
        className="px-4 py-2 rounded-xl bg-gradient-to-r from-teal-500 to-cyan-500 text-white text-xs font-medium hover:from-teal-400 hover:to-cyan-400 transition-all shadow-xs flex items-center gap-1.5 mx-auto cursor-pointer active:scale-95"
      >
        <RotateCcw className="w-3.5 h-3.5" />
        <span>Xóa bộ lọc</span>
      </button>
    </div>
  );
};
