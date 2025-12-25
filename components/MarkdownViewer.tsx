import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface Props {
  content: string;
  compact?: boolean;
}

const MarkdownViewer: React.FC<Props> = ({ content, compact = false }) => {
  // 预处理内容，确保正确显示
  const processedContent = content
    // 移除可能的包裹代码块
    .replace(/^```[a-z]*[\r\n]+/, '')
    .replace(/[\r\n]+```$/, '')
    // 修复可能的格式问题
    .replace(/\r\n/g, '\n')
    // 移除多余的空行
    .replace(/\n\s*\n/g, '\n\n')
    // 确保文本正确换行
    .trim();

  return (
    <div className={`prose prose-slate max-w-none prose-headings:font-serif prose-headings:text-slate-900 prose-p:text-slate-800 prose-p:font-serif prose-p:leading-loose prose-strong:text-slate-900 prose-strong:font-bold prose-ul:text-slate-800 prose-li:text-slate-800 ${compact ? 'text-xs' : 'text-base sm:text-lg'} break-words`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => <h1 className={`${compact ? 'text-lg mt-3 mb-2' : 'text-2xl sm:text-3xl mt-8 mb-6'} font-black text-slate-900 pb-3 border-b-2 border-slate-100 font-serif tracking-tight`} {...props} />,
          h2: ({ node, ...props }) => <h2 className={`${compact ? 'text-base mt-3 mb-2' : 'text-xl sm:text-2xl mt-8 mb-4'} font-bold text-slate-900 font-serif tracking-tight`} {...props} />,
          h3: ({ node, ...props }) => <h3 className={`${compact ? 'text-sm mt-2 mb-1' : 'text-lg sm:text-xl mt-6 mb-3'} font-bold text-slate-800 font-serif`} {...props} />,
          ul: ({ node, ...props }) => <ul className={`list-disc pl-5 ${compact ? 'my-1 space-y-0' : 'my-4 space-y-2'} text-slate-800 sm:pl-6 marker:text-slate-400`} {...props} />,
          ol: ({ node, ...props }) => <ol className={`list-decimal pl-5 ${compact ? 'my-1 space-y-0' : 'my-4 space-y-2'} text-slate-800 sm:pl-6 marker:text-slate-400 font-serif`} {...props} />,
          li: ({ node, ...props }) => <li className={`${compact ? 'my-0.5' : 'my-1'} text-slate-800 leading-relaxed pl-1`} {...props} />,
          p: ({ node, ...props }) => <p className={`${compact ? 'my-1 leading-normal' : 'my-4 leading-loose'} text-slate-800 font-serif tracking-wide text-justify`} {...props} />,
          strong: ({ node, ...props }) => <strong className="text-slate-900 font-bold bg-slate-50 px-1 rounded-sm" {...props} />,
          em: ({ node, ...props }) => <em className="text-slate-900 italic font-medium" {...props} />,
          blockquote: ({ node, ...props }) => <blockquote className={`border-l-4 border-slate-200 pl-4 sm:pl-6 py-2 ${compact ? 'my-2' : 'my-6'} bg-slate-50 italic text-slate-600 rounded-r-lg font-serif`} {...props} />,
          code: ({ node, ...props }) => <code className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded text-sm font-mono border border-slate-200" {...props} />,
          pre: ({ node, ...props }) => <pre className="bg-slate-50 border border-slate-200 rounded-lg p-4 overflow-x-auto my-4 text-slate-800 font-mono text-sm leading-relaxed" {...props} />,

          // Table styles
          table: ({ node, ...props }) => <div className={`overflow-x-auto ${compact ? 'my-2' : 'my-6'} border border-slate-200 rounded-xl shadow-sm`}><table className="min-w-full divide-y divide-slate-200 bg-white" {...props} /></div>,
          thead: ({ node, ...props }) => <thead className="bg-slate-50" {...props} />,
          tbody: ({ node, ...props }) => <tbody className="divide-y divide-slate-100" {...props} />,
          tr: ({ node, ...props }) => <tr className="hover:bg-slate-50/80 transition-colors" {...props} />,
          th: ({ node, ...props }) => <th className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider" {...props} />,
          td: ({ node, ...props }) => <td className="px-4 py-3 text-sm text-slate-700 whitespace-pre-wrap font-sans" {...props} />,
          // 添加对span的处理，确保文本正确显示
          span: ({ node, ...props }) => <span className="inline-block" {...props} />,
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  );
};

export default MarkdownViewer;