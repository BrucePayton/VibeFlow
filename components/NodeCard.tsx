import React, { memo } from 'react';
import { WorkflowNode, NodeStatus } from '../types';
import { NODE_WIDTH, NODE_HEIGHT_COLLAPSED } from '../constants';

interface NodeCardProps {
  node: WorkflowNode;
  isSelected: boolean;
  onSelect: (id: string) => void;
}

const statusStyles: Record<NodeStatus, string> = {
  idle: 'border-gray-200 bg-white text-gray-500 shadow-sm hover:shadow-md',
  pending: 'border-amber-300 bg-amber-50/50 text-amber-600 shadow-sm',
  running: 'border-emerald-500 bg-white text-emerald-600 ring-2 ring-emerald-500/20 shadow-lg shadow-emerald-500/10 z-20',
  completed: 'border-emerald-400 bg-emerald-50/30 text-emerald-700 shadow-sm',
  failed: 'border-red-300 bg-red-50 text-red-600 shadow-sm',
};

// --- Exported SVG Icons for Consistency ---
export const NodeIcons = {
    Input: (props: any) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
        </svg>
    ),
    Task: (props: any) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
        </svg>
    ),
    Agent: (props: any) => (
         <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
    ),
    Fork: (props: any) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
        </svg>
    ),
    Join: (props: any) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
        </svg>
    ),
    Output: (props: any) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
    ),
    Code: (props: any) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
    ),
    Search: (props: any) => (
        <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
    )
};

const NodeCard: React.FC<NodeCardProps> = memo(({ node, isSelected, onSelect }) => {
  const isRunning = node.status === 'running';
  const isCompleted = node.status === 'completed';
  const hasTools = node.tools && node.tools.length > 0;

  // Icon Mapping
  const getIcon = () => {
    switch (node.type) {
      case 'input': return <NodeIcons.Input className="w-5 h-5" />;
      case 'fork': return <NodeIcons.Fork className="w-5 h-5" />;
      case 'join': return <NodeIcons.Join className="w-5 h-5" />;
      case 'output': return <NodeIcons.Output className="w-5 h-5" />;
      default: return <NodeIcons.Agent className="w-5 h-5" />;
    }
  };

  const getNodeColorClass = () => {
      switch (node.type) {
          case 'input': return 'bg-blue-50 border-blue-100 text-blue-600';
          case 'output': return 'bg-purple-50 border-purple-100 text-purple-600';
          case 'fork': return 'bg-amber-50 border-amber-100 text-amber-600';
          default: return 'bg-gray-50 border-gray-200 text-gray-600';
      }
  }

  return (
    <div
      className={`absolute flex flex-col rounded-xl border transition-all duration-300 group backdrop-blur-sm
        ${statusStyles[node.status]} 
        ${isSelected ? 'ring-2 ring-black border-black transform scale-[1.02] shadow-2xl z-50' : ''}
        ${isRunning ? 'animate-pulse' : ''}
      `}
      style={{
        width: NODE_WIDTH,
        height: NODE_HEIGHT_COLLAPSED,
        left: (node.x || 0) - (NODE_WIDTH / 2),
        top: (node.y || 0) - (NODE_HEIGHT_COLLAPSED / 2),
      }}
      onClick={(e) => {
          e.stopPropagation();
          onSelect(node.id);
      }}
    >
      {/* Glow Effect Element (Background Layer) */}
      {isRunning && (
         <div className="absolute -inset-1 bg-emerald-400/20 rounded-xl blur-md opacity-50 animate-pulse pointer-events-none"></div>
      )}

      {/* Header Area */}
      <div className="flex items-center gap-3 p-4 h-full relative z-10 cursor-pointer overflow-hidden rounded-xl">
        
        {/* Tech Icon Container */}
        <div className={`flex items-center justify-center w-10 h-10 rounded-lg border shadow-sm transition-colors shrink-0 
            ${isRunning ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : getNodeColorClass()}`}>
          {getIcon()}
        </div>
        
        <div className="flex flex-col min-w-0 flex-1 h-full justify-center">
            <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wider opacity-50 flex items-center gap-1">
                    {node.type === 'task' ? 'AGENT' : node.type}
                    {node.dependencies.length > 0 && <span className="text-gray-300">→</span>}
                </span>
                {isRunning && <span className="text-[9px] text-emerald-600 font-mono font-bold">RUNNING</span>}
                {isCompleted && node.executionTime && <span className="text-[9px] text-emerald-600 font-mono">{(node.executionTime / 1000).toFixed(2)}s</span>}
            </div>
            
            <h3 className="font-bold text-gray-900 text-sm truncate leading-tight font-sans" title={node.label}>
                {node.label}
            </h3>
            
            {/* Mini Tool Badges */}
            {hasTools && (
                <div className="flex gap-1 mt-1.5 overflow-hidden">
                    {node.tools.slice(0, 3).map(t => (
                        <div key={t.name} className="flex items-center gap-1 px-1.5 py-0.5 bg-gray-100 rounded text-[9px] text-gray-500 border border-gray-200">
                             {t.name === 'Execute Code' ? <NodeIcons.Code className="w-3 h-3" /> : t.name === 'Web Search' ? <NodeIcons.Search className="w-3 h-3" /> : null}
                             <span className="truncate max-w-[60px]">{t.name}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
      </div>

      {/* Input Required Indicator */}
      {node.type === 'input' && node.status === 'idle' && !isSelected && (
          <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white animate-ping"></div>
      )}

      {/* Connector dots (Horizontal Layout: Left Input, Right Output) */}
      <div className={`absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm z-30 transition-colors ${node.dependencies.length ? 'bg-gray-400 group-hover:bg-gray-600' : 'bg-transparent border-none'}`}></div>
      <div className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-gray-400 border-2 border-white shadow-sm z-30 group-hover:bg-gray-600 transition-colors"></div>
    </div>
  );
});

export default NodeCard;