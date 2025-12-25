import React from 'react';
import { Check, ChevronRight, FileText, Activity } from 'lucide-react';

interface Props {
  title: string;
  icon: any;
  isActive: boolean;
  isCompleted: boolean;
  onClick: () => void;
  onShowPrompt?: () => void;
}

const StepCard: React.FC<Props> = ({ title, icon: Icon, isActive, isCompleted, onClick, onShowPrompt }) => (
  <div
    onClick={onClick}
    className={`flex items-center p-3 sm:p-4 rounded-xl cursor-pointer transition-all duration-200 border relative group min-h-[64px] sm:min-h-[72px] ${isActive
      ? 'bg-stone-800 border-stone-800 text-white shadow-md'
      : isCompleted
        ? 'bg-white border-gray-300 text-gray-900 hover:border-stone-800'
        : 'bg-white border-transparent text-gray-400 hover:bg-gray-50 hover:text-gray-900'
      }`}
  >
    <div className={`p-2 sm:p-2.5 rounded-lg mr-2 sm:mr-3 border ${isActive ? 'bg-white/20 border-white/20 text-white' : 'bg-gray-50 border-gray-100 text-gray-500'}`}>
      {Icon ? <Icon size={20} /> : <Activity size={20} />}
    </div>
    <div className="flex-1 min-w-0">
      <h3 className={`font-serif font-bold text-xs sm:text-sm truncate ${isActive ? 'text-white' : 'text-gray-900'}`}>{title}</h3>
      {isCompleted && <span className={`text-[10px] sm:text-xs opacity-70 flex items-center mt-0.5 sm:mt-1 font-sans ${isActive ? 'text-gray-300' : 'text-gray-500'}`}><Check size={12} className="mr-1" /> 已生成</span>}
    </div>

    {onShowPrompt && (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onShowPrompt();
        }}
        className={`p-2.5 rounded-md transition-opacity ${isActive ? 'opacity-100 hover:bg-white/20 text-gray-300 hover:text-white' : 'opacity-0 group-hover:opacity-100 hover:bg-gray-100 text-gray-400 hover:text-black'} ml-1 min-w-[36px] flex items-center justify-center`}
        title="查看提示词"
      >
        <FileText size={16} />
      </button>
    )}
    {isActive && <ChevronRight size={16} className="text-white ml-2 min-w-[32px] flex items-center justify-center" />}
  </div>
);

export default StepCard;