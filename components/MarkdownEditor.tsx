import React, { useState, useEffect } from 'react';
import { Save, X } from 'lucide-react';

interface Props {
  initialContent: string;
  onSave: (content: string) => void;
  onCancel: () => void;
}

const MarkdownEditor: React.FC<Props> = ({ initialContent, onSave, onCancel }) => {
  const [content, setContent] = useState(initialContent);

  // Synchronize state with prop changes if needed
  useEffect(() => {
    setContent(initialContent);
  }, [initialContent]);

  return (
    <div className="flex flex-col h-full min-h-[500px]">
      <div className="flex justify-between items-center mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
        <span className="text-sm font-medium text-gray-500 ml-2">编辑模式</span>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            className="flex items-center px-3 py-1.5 text-gray-600 hover:bg-gray-200 rounded-md transition-colors text-sm font-medium"
          >
            <X size={16} className="mr-1.5" />
            取消
          </button>
          <button
            onClick={() => onSave(content)}
            className="flex items-center px-4 py-1.5 bg-stone-900 text-white hover:bg-stone-700 rounded-md transition-all shadow-sm text-sm font-medium"
          >
            <Save size={16} className="mr-1.5" />
            保存修改
          </button>
        </div>
      </div>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="flex-1 w-full p-6 text-base font-serif leading-relaxed border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-stone-200 resize-none bg-white text-gray-800"
        placeholder="在此处输入或编辑内容..."
        autoFocus
      />
      <div className="mt-2 text-right text-xs text-gray-400">支持 Markdown 格式</div>
    </div>
  );
};

export default MarkdownEditor;
