import React, { useState } from 'react';
import { PlanProposal } from '../types';
import { TOOL_REGISTRY } from '../constants';

interface ChatPlanPreviewProps {
  proposal: PlanProposal;
  onConfirm: (proposal: PlanProposal) => void;
  isConfirmed: boolean;
  isLoading?: boolean;
}

const ChatPlanPreview: React.FC<ChatPlanPreviewProps> = ({ proposal, onConfirm, isConfirmed, isLoading }) => {
  const [activeTab, setActiveTab] = useState<'flow' | 'details'>('flow');

  return (
    <div className="w-full mt-4 mb-6 animate-fade-in group">
      {/* Container Card */}
      <div className={`bg-white rounded-2xl border transition-all duration-300 overflow-hidden ${isConfirmed ? 'border-gray-200' : 'border-emerald-100 shadow-xl shadow-emerald-900/5 ring-1 ring-black/5'}`}>
        
        {/* Header Section */}
        <div className="bg-gradient-to-b from-gray-50 to-white border-b border-gray-100 p-5 pb-0">
            <div className="flex justify-between items-start mb-3">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className={`w-2 h-2 rounded-full ${isConfirmed ? 'bg-gray-300' : 'bg-emerald-500 animate-pulse'}`}></span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Workflow Blueprint</span>
                    </div>
                    <h3 className={`font-bold text-lg leading-tight ${isConfirmed ? 'text-gray-500' : 'text-gray-900'}`}>{proposal.title}</h3>
                </div>
                {isConfirmed && (
                    <div className="bg-gray-100 text-gray-500 px-3 py-1 rounded-full text-[10px] font-bold border border-gray-200 flex items-center gap-1">
                        <span>Active</span>
                    </div>
                )}
            </div>

            {/* Simple Tabs */}
            <div className="flex gap-6 mt-4">
                <button 
                    onClick={() => setActiveTab('flow')}
                    className={`pb-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'flow' ? (isConfirmed ? 'text-gray-600 border-gray-400' : 'text-emerald-600 border-emerald-500') : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                    Process Flow
                </button>
                <button 
                    onClick={() => setActiveTab('details')}
                    className={`pb-3 text-xs font-semibold border-b-2 transition-colors ${activeTab === 'details' ? (isConfirmed ? 'text-gray-600 border-gray-400' : 'text-emerald-600 border-emerald-500') : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                >
                    Application Logic
                </button>
            </div>
        </div>

        {/* Content Body */}
        <div className={`bg-gray-50/50 min-h-[200px] ${isConfirmed ? 'opacity-80 grayscale-[0.5]' : ''}`}>
            
            {/* Tab: Process Flow */}
            {activeTab === 'flow' && (
                <div className="p-5 animate-fade-in">
                    <div className="relative border-l-2 border-dashed border-gray-200 ml-4 space-y-6">
                        {proposal.steps.map((step, idx) => {
                            const toolInfo = step.tool ? TOOL_REGISTRY[step.tool] : null;
                            return (
                                <div key={idx} className="relative pl-8">
                                    {/* Node Dot */}
                                    <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center z-10">
                                        <div className={`w-1.5 h-1.5 rounded-full ${idx === 0 ? 'bg-emerald-500' : 'bg-gray-300'}`}></div>
                                    </div>

                                    {/* Node Content */}
                                    <div className="flex items-start justify-between group/node">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="font-bold text-sm text-gray-800">{step.title}</span>
                                            </div>
                                            <p className="text-xs text-gray-500 leading-relaxed max-w-[280px]">
                                                {step.description}
                                            </p>
                                        </div>
                                        {toolInfo && (
                                            <div className="bg-white border border-gray-200 shadow-sm w-7 h-7 rounded flex items-center justify-center text-sm" title={toolInfo.name}>
                                                {toolInfo.icon}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                        
                        {/* Final Endpoint */}
                        <div className="relative pl-8">
                             <div className="absolute -left-[9px] top-0 w-4 h-4 rounded-full bg-gray-900 border-2 border-gray-900 flex items-center justify-center z-10 shadow-sm">
                                <div className="w-1.5 h-1.5 rounded-full bg-white"></div>
                             </div>
                             <span className="text-xs font-bold text-gray-900 uppercase tracking-wider">End</span>
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Application Details */}
            {activeTab === 'details' && (
                <div className="p-5 space-y-5 animate-fade-in">
                    {/* Goal */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Core Goal</h4>
                        <div className="bg-white p-3 rounded-xl border border-gray-200 text-sm text-gray-700 leading-relaxed shadow-sm">
                            {proposal.goal || "To automate the specified task efficiently."}
                        </div>
                    </div>

                    {/* Scenarios */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Usage Scenarios</h4>
                        <ul className="space-y-2">
                            {(proposal.scenarios || []).map((scenario, i) => (
                                <li key={i} className="flex items-start gap-2 text-xs text-gray-600 bg-white p-2 rounded border border-gray-100">
                                    <span className="text-emerald-500 font-bold">•</span>
                                    <span>{scenario}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Outcome */}
                    <div>
                        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2">Expected Outcome</h4>
                        <div className="flex items-center gap-3 bg-emerald-50/50 p-3 rounded-xl border border-emerald-100 text-sm text-emerald-800">
                             <span className="text-lg">🎯</span>
                             {proposal.outcome || "A finalized output matching requirements."}
                        </div>
                    </div>
                </div>
            )}
        </div>

        {/* Action Footer */}
        <div className="p-4 bg-white border-t border-gray-100">
             <div className="flex flex-col gap-3">
                <button 
                    onClick={() => onConfirm(proposal)}
                    disabled={isLoading}
                    className={`w-full py-3.5 bg-black hover:bg-gray-800 text-white rounded-xl text-sm font-bold transition-all shadow-lg hover:shadow-xl active:scale-[0.98] flex items-center justify-center gap-2 relative overflow-hidden group disabled:opacity-70 disabled:cursor-not-allowed`}
                >
                    {isLoading ? (
                         <>
                             <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                               <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                               <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                             </svg>
                             Generating Workflow...
                         </>
                    ) : (
                         <>
                             <div className="absolute inset-0 bg-gradient-to-r from-emerald-600 to-teal-600 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                             <div className="relative flex items-center gap-2">
                                <span>{isConfirmed ? '↻ Regenerate Workflow' : '✨ Generate Workflow'}</span>
                                <svg className="w-4 h-4 text-emerald-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                </svg>
                             </div>
                         </>
                    )}
                </button>
                {!isLoading && !isConfirmed && (
                    <p className="text-[10px] text-gray-400 text-center">
                        This will generate {proposal.steps.length} autonomous agents on the canvas.
                    </p>
                )}
            </div>
        </div>

      </div>
    </div>
  );
};

export default ChatPlanPreview;