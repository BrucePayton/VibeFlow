import React from 'react';
import { NodeIcons } from './NodeCard';

interface BottomToolbarProps {
  onAddNode: (type: 'input' | 'task' | 'note') => void;
  onUploadFile: (file: File) => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({ onAddNode, onUploadFile }) => {
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      onUploadFile(e.target.files[0]);
    }
  };

  return (
    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 p-1.5 bg-white/90 backdrop-blur border border-gray-200 rounded-2xl shadow-lg animate-fade-in">
       
       <div className="flex items-center gap-1 pr-2 border-r border-gray-200">
           <button 
             onClick={() => onAddNode('input')}
             className="flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-gray-50 transition-colors gap-1 group"
           >
               <div className="w-6 h-6 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100 group-hover:scale-110 transition-transform">
                   <NodeIcons.Input className="w-4 h-4" />
               </div>
               <span className="text-[9px] font-bold text-gray-500">User Input</span>
           </button>
           
           <button 
             onClick={() => onAddNode('task')}
             className="flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-gray-50 transition-colors gap-1 group"
           >
               <div className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 group-hover:scale-110 transition-transform">
                   <NodeIcons.Agent className="w-4 h-4" />
               </div>
               <span className="text-[9px] font-bold text-gray-500">Agent</span>
           </button>
       </div>

       <div className="flex items-center gap-1 pl-2">
           <button 
             onClick={() => onAddNode('note')}
             className="flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-gray-50 transition-colors gap-1 group"
           >
               <div className="w-6 h-6 rounded-full bg-yellow-50 text-yellow-600 flex items-center justify-center border border-yellow-100 group-hover:scale-110 transition-transform">
                   <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                   </svg>
               </div>
               <span className="text-[9px] font-bold text-gray-500">Note</span>
           </button>

           <div className="relative">
                <input 
                    type="file" 
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleFileChange}
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center w-14 h-14 rounded-xl hover:bg-gray-50 transition-colors gap-1 group"
                >
                    <div className="w-6 h-6 rounded-full bg-purple-50 text-purple-600 flex items-center justify-center border border-purple-100 group-hover:scale-110 transition-transform">
                         <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
                        </svg>
                    </div>
                    <span className="text-[9px] font-bold text-gray-500">Files</span>
                </button>
           </div>
       </div>

    </div>
  );
};

export default BottomToolbar;