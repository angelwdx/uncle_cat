import React, { useState, useEffect, useMemo } from 'react';
import ReactDOM from 'react-dom';
import {
  X,
  Search,
  Check,
  AlertCircle,
  ArrowRight,
  CheckSquare,
  Square,
  RefreshCw,
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  content: string; // Current step content (Character Dynamics) to extract names from
  allData: Record<string, any>; // All generated data to search and replace in
  onReplace: (replacements: Replacement[]) => void; // Callback to execute replacements
}

export interface Replacement {
  stepId: string;
  originalText: string;
  newText: string;
  contextIndex: number; // Index of the occurrence in the text
}

interface MatchItem {
  id: string;
  stepId: string; // "dna", "world", or "chapter-0-content", "chapter-1-title"
  stepName: string;
  contextPreview: string; // HTML string with highlight
  originalText: string;
  index: number;
}

const STEP_NAMES: Record<string, string> = {
  dna: '核心DNA',
  characters: '角色动力学',
  world: '世界观',
  plot: '情节架构',
  blueprint: '章节蓝图',
  globalSummary: '全局提要',
  state: '角色状态库',
};

const escapeHtml = (text: string) => {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

const CharacterNameModal: React.FC<Props> = ({ isOpen, onClose, content, allData, onReplace }) => {
  const [extractedNames, setExtractedNames] = useState<string[]>([]);
  const [selectedName, setSelectedName] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [mode, setMode] = useState<'list' | 'preview'>('list');
  const [matches, setMatches] = useState<MatchItem[]>([]);
  const [selectedMatches, setSelectedMatches] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Extract names when content changes or modal opens
  useEffect(() => {
    if (isOpen && content) {
      extractNames(content);
    }
  }, [isOpen, content]);

  const extractNames = (text: string) => {
    const names = new Set<string>();

    // Noise words to filter out (Common template headers)
    const blacklist = [
      '基础画像',
      '动力学三角',
      '角色动力学',
      '表面追求',
      '深层渴望',
      '灵魂需求',
      '核心冲突网',
      '角色弧线',
      '利益链',
      '对冲点',
      '情节架构',
      '内容主体',
      '特征',
      '目标',
      '身份',
      '冲突',
      '创作',
      '系统',
      '摘要',
      'DNA',
      '设定',
      '设计',
      '现实中的本体',
      '信息差异点',
      '情感张力',
      '自我厌恶与自我拯救',
    ];

    // Improved patterns
    const patterns = [
      // Name (Optional English) - [Tag] or Name —— Tag
      // Capture group 1: Expected name part
      /(?:^|\n)([^()\n\-—：:\[\*#]{1,10})(?:\s*\(.*?\))?\s*(?:[-—：:]|\[)/g,
      // Markdown header: ### Name
      /###\s*([^()\n\-—：:\[\*]{1,10})/g,
      // Bold items at start of line: **Name** (often followed by separator)
      /(?:^|\n)\s*\*\*([^()\n\-—：:\[\*]{1,10})\*\*(?:\s*[-—：:])?/g,
    ];

    patterns.forEach((pattern) => {
      let match;
      while ((match = pattern.exec(text)) !== null) {
        let name = match[1].trim();

        // Clean up common markdown/bullet artifacts if they were accidentally captured
        name = name.replace(/^[\s\d\.\-\*•]+/, '').trim();

        // Strict Validation Filters
        if (
          name.length >= 2 && // Too short is likely a bullet or fragment
          name.length <= 8 && // Too long is likely a sentence or long header
          !blacklist.some((word) => name.includes(word)) && // Check blacklist
          !/^[0-9\.\s]+$/.test(name) && // Not just numbers/dots
          !/^第[一二三四五六七八九十0-9]+[章节]$/.test(name) // Not chapter markers
        ) {
          names.add(name);
        }
      }
    });

    setExtractedNames(Array.from(names));
  };

  const handleSelectName = (name: string) => {
    setSelectedName(name);
    setNewName(name); // Default to current name
  };

  const handleAnalyze = () => {
    setIsAnalyzing(true);
    // Use setTimeout to allow UI to show loading state if it takes time
    setTimeout(() => {
      try {
        if (!selectedName || !newName || selectedName === newName) {
          setIsAnalyzing(false);
          return;
        }

        const newMatches: MatchItem[] = [];

        const scanText = (text: any, targetStepId: string, targetStepName: string) => {
          if (typeof text !== 'string') return;

          let startIndex = 0;
          let index;
          while ((index = text.indexOf(selectedName!, startIndex)) !== -1) {
            const startContext = Math.max(0, index - 20);
            const endContext = Math.min(text.length, index + selectedName!.length + 20);
            const prefix = text.substring(startContext, index);
            const suffix = text.substring(index + selectedName!.length, endContext);

            const highlighted = `${escapeHtml(
              prefix
            )}<span class="bg-yellow-200 text-yellow-900 px-0.5 rounded font-bold">${escapeHtml(
              selectedName!
            )}</span>${escapeHtml(suffix)}`;

            newMatches.push({
              id: `${targetStepId}-${index}`,
              stepId: targetStepId,
              stepName: targetStepName,
              contextPreview: highlighted,
              originalText: selectedName!,
              index: index,
            });
            startIndex = index + selectedName!.length;
          }
        };

        Object.entries(allData).forEach(([stepId, value]) => {
          if (stepId === 'chapters' && Array.isArray(value)) {
            value.forEach((chapter: any, idx) => {
              const chNum = idx + 1;
              if (chapter && typeof chapter === 'object') {
                if (chapter.title)
                  scanText(chapter.title, `chapter-${idx}-title`, `第 ${chNum} 章 标题`);
                if (chapter.content)
                  scanText(chapter.content, `chapter-${idx}-content`, `第 ${chNum} 章 正文`);
              }
            });
          } else if (typeof value === 'string') {
            scanText(value, stepId, STEP_NAMES[stepId] || stepId);
          }
        });

        setMatches(newMatches);
        setSelectedMatches(new Set(newMatches.map((m) => m.id)));
        setMode('preview');
      } catch (error) {
        console.error('Character auto-scan failed:', error);
        setMode('preview');
      } finally {
        setIsAnalyzing(false);
      }
    }, 10);
  };

  const toggleMatch = (id: string) => {
    const newSet = new Set(selectedMatches);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedMatches(newSet);
  };

  const toggleAll = () => {
    if (selectedMatches.size === matches.length) {
      setSelectedMatches(new Set());
    } else {
      setSelectedMatches(new Set(matches.map((m) => m.id)));
    }
  };

  const executeReplace = () => {
    const replacements: Replacement[] = matches
      .filter((m) => selectedMatches.has(m.id))
      .map((m) => ({
        stepId: m.stepId,
        originalText: m.originalText,
        newText: newName,
        contextIndex: m.index,
      }));

    onReplace(replacements);

    // Reset state for next replacement instead of closing
    setMode('list');
    setSelectedName(null);
    setNewName('');
    setMatches([]);

    // Show success feedback
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  const handleClose = () => {
    setMode('list');
    setSelectedName(null);
    setMatches([]);
    onClose();
  };

  if (!isOpen) return null;

  return ReactDOM.createPortal(
    <div className="fixed inset-0 z-9999 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="flex justify-between items-center p-4 border-b border-gray-100 bg-gray-50/50">
          <h3 className="text-lg font-bold text-gray-800 flex items-center">
            {mode === 'list' ? (
              <>
                <Search className="w-5 h-5 mr-2 text-stone-500" />
                角色名称管理
              </>
            ) : (
              <>
                <CheckSquare className="w-5 h-5 mr-2 text-stone-500" />
                确认替换预览
              </>
            )}
          </h3>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-0 relative">
          {showSuccess && (
            <div className="sticky top-0 z-20 bg-emerald-50 border-b border-emerald-100 px-4 py-2 flex items-center justify-center gap-2 text-emerald-700 text-sm font-bold animate-in slide-in-from-top duration-300">
              <Check size={16} />
              替换成功！已同步至所有步骤和章节。
            </div>
          )}
          {mode === 'list' ? (
            <div className="p-6">
              {extractedNames.length === 0 ? (
                <div className="text-center py-10 text-gray-500">
                  <p>未能自动识别到明显角色名。</p>
                  <p className="text-sm mt-2">
                    请尝试手动在文中使用 "Name ——" 或 "**Name**" 格式。
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="text-sm text-gray-500 mb-2">
                    检测到以下角色，点击选择要修改的名字：
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {extractedNames.map((name) => (
                      <button
                        key={name}
                        onClick={() => handleSelectName(name)}
                        className={`text-left px-4 py-3 rounded-lg border transition-all flex justify-between items-center group ${
                          selectedName === name
                            ? 'border-stone-500 bg-stone-50 text-stone-800 shadow-sm'
                            : 'border-gray-200 hover:border-stone-300 hover:bg-gray-50 text-gray-700'
                        }`}
                      >
                        <span className="font-medium truncate">{name}</span>
                        {selectedName === name && <Check size={16} className="text-stone-600" />}
                      </button>
                    ))}
                  </div>

                  {selectedName && (
                    <div className="mt-8 pt-6 border-t border-gray-100 animate-in slide-in-from-bottom-2">
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        将 "{selectedName}" 修改为：
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-stone-400 focus:border-stone-400 outline-none"
                          placeholder="输入新名字"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={handleAnalyze}
                          disabled={!newName || newName === selectedName || isAnalyzing}
                          className="px-6 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors flex items-center min-w-[120px] justify-center"
                        >
                          {isAnalyzing ? (
                            <>
                              <RefreshCw size={16} className="mr-2 animate-spin" /> 分析中...
                            </>
                          ) : (
                            <>
                              预览结果 <ArrowRight size={16} className="ml-2" />
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col h-full bg-gray-50/30">
              <div className="p-4 bg-yellow-50 border-b border-yellow-100 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 shrink-0 mt-0.5" />
                <div className="text-sm text-yellow-800">
                  <p className="font-bold mb-1">请仔细检查！</p>
                  <p>
                    即将把 <strong>{selectedName}</strong> 替换为 <strong>{newName}</strong>。
                  </p>
                  <p>
                    共找到 {matches.length} 处匹配，已选中 {selectedMatches.size} 处。
                  </p>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                <div className="flex justify-between items-center mb-2 px-1">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">
                    匹配项列表
                  </span>
                  <button
                    onClick={toggleAll}
                    className="text-xs text-stone-600 hover:text-stone-800 font-medium flex items-center"
                  >
                    {selectedMatches.size === matches.length ? (
                      <>
                        <CheckSquare size={14} className="mr-1" /> 全反选
                      </>
                    ) : (
                      <>
                        <Square size={14} className="mr-1" /> 全选
                      </>
                    )}
                  </button>
                </div>

                {matches.map((match) => (
                  <div
                    key={match.id}
                    className={`bg-white p-3 rounded-lg border transition-all cursor-pointer hover:shadow-sm ${
                      selectedMatches.has(match.id)
                        ? 'border-stone-300 bg-stone-50/50'
                        : 'border-gray-200 opacity-60'
                    }`}
                    onClick={() => toggleMatch(match.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`mt-1 w-5 h-5 rounded border flex items-center justify-center shrink-0 transition-colors ${
                          selectedMatches.has(match.id)
                            ? 'bg-stone-700 border-stone-700 text-white'
                            : 'border-gray-300 bg-white'
                        }`}
                      >
                        {selectedMatches.has(match.id) && <Check size={12} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-bold text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                            {match.stepName}
                          </span>
                        </div>
                        <div
                          className="text-sm text-gray-800 font-serif leading-relaxed line-clamp-2"
                          dangerouslySetInnerHTML={{ __html: match.contextPreview }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {mode === 'preview' && (
          <div className="p-4 border-t border-gray-100 bg-white flex justify-between items-center">
            <button
              onClick={() => setMode('list')}
              className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors text-sm font-medium"
            >
              返回修改
            </button>
            <button
              onClick={executeReplace}
              disabled={selectedMatches.size === 0}
              className="px-6 py-2 bg-stone-800 text-white rounded-lg hover:bg-stone-900 disabled:opacity-50 disabled:cursor-not-allowed font-medium shadow-sm transition-all active:scale-95"
            >
              确认替换 ({selectedMatches.size})
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};

export default CharacterNameModal;
