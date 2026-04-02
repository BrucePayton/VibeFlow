import React, { useState, useRef } from 'react';
import { WorkflowNode, WorkflowEdge } from '../types';
import NodeCard from './NodeCard';
import { NODE_WIDTH } from '../constants';

interface WorkflowCanvasProps {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  onSelectNode: (id: string | null) => void;
  selectedNodeId: string | null;
  onUpdateNodePosition: (id: string, x: number, y: number) => void;
}

const WorkflowCanvas: React.FC<WorkflowCanvasProps> = ({ nodes, edges, onSelectNode, selectedNodeId, onUpdateNodePosition }) => {
  // Panning State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDraggingCanvas, setIsDraggingCanvas] = useState(false);
  const dragStart = useRef({ x: 0, y: 0 });

  // Node Dragging State
  const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
  const dragNodeStart = useRef({ mouseX: 0, mouseY: 0, nodeX: 0, nodeY: 0 });
  const requestRef = useRef<number | undefined>(undefined);

  const handleMouseDown = (e: React.MouseEvent) => {
    // If we clicked a node (handled in bubble phase), ignore canvas drag
    if ((e.target as HTMLElement).closest('.node-card')) return;
    
    setIsDraggingCanvas(true);
    dragStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
    onSelectNode(null);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // 1. Handle Node Dragging (Optimized with RAF)
    if (draggingNodeId) {
       e.preventDefault();
       e.stopPropagation();

       const dx = e.clientX - dragNodeStart.current.mouseX;
       const dy = e.clientY - dragNodeStart.current.mouseY;
       
       const newX = dragNodeStart.current.nodeX + dx;
       const newY = dragNodeStart.current.nodeY + dy;

       if (!requestRef.current) {
           requestRef.current = requestAnimationFrame(() => {
               onUpdateNodePosition(draggingNodeId, newX, newY);
               requestRef.current = undefined;
           });
       }
       return;
    }

    // 2. Handle Canvas Panning
    if (!isDraggingCanvas) return;
    e.preventDefault();
    setPan({
      x: e.clientX - dragStart.current.x,
      y: e.clientY - dragStart.current.y
    });
  };

  const handleMouseUp = () => {
    setIsDraggingCanvas(false);
    setDraggingNodeId(null);
    if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = undefined;
    }
  };

  const onNodeDragStart = (id: string, e: React.MouseEvent) => {
      e.stopPropagation(); // Prevent canvas drag start
      const node = nodes.find(n => n.id === id);
      if (!node) return;

      setDraggingNodeId(id);
      onSelectNode(id);
      
      // Initialize absolute start positions
      dragNodeStart.current = { 
          mouseX: e.clientX, 
          mouseY: e.clientY, 
          nodeX: node.x || 0, 
          nodeY: node.y || 0 
      };
  }

  return (
    <div 
        className={`relative w-full h-full overflow-hidden bg-[#f8f9fc] bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:20px_20px] ${isDraggingCanvas ? 'cursor-grabbing' : 'cursor-default'}`}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
    >
      <div 
        className="absolute transition-transform duration-75 ease-out will-change-transform"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px)` }}
      >
        <svg className="absolute top-0 left-0 w-[5000px] h-[5000px] pointer-events-none z-0 overflow-visible">
            <defs>
                <marker id="arrowhead-gray" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#9ca3af" />
                </marker>
                 <marker id="arrowhead-active" markerWidth="8" markerHeight="6" refX="7" refY="3" orient="auto">
                    <polygon points="0 0, 8 3, 0 6" fill="#10b981" />
                </marker>
            </defs>
          {edges.map(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);

            if (!source || !target) return null;

            const x1 = (source.x || 0) + (NODE_WIDTH / 2);
            const y1 = (source.y || 0); 
            const x2 = (target.x || 0) - (NODE_WIDTH / 2);
            const y2 = (target.y || 0); 

            const controlOffset = Math.abs(x2 - x1) / 2;
            const path = `M ${x1} ${y1} C ${x1 + controlOffset} ${y1}, ${x2 - controlOffset} ${y2}, ${x2} ${y2}`;

            const isActive = (source.status === 'completed' || source.status === 'running') && (target.status !== 'idle');
            // Determine line style based on edge type or source node type
            const isDashed = edge.type === 'dashed' || source.type === 'fork';

            return (
              <g key={edge.id}>
                  <path
                    d={path}
                    stroke={isActive ? "#10b981" : "#d1d5db"}
                    strokeWidth={isActive ? "2" : "1.5"}
                    fill="none"
                    strokeDasharray={isDashed ? "5,5" : "none"}
                    markerEnd={isActive ? "url(#arrowhead-active)" : "url(#arrowhead-gray)"}
                    className="transition-colors duration-500"
                  />
                  {isActive && (
                      <circle r="3" fill="#34d399">
                          <animateMotion dur="1s" repeatCount="indefinite" path={path} />
                      </circle>
                  )}
              </g>
            );
          })}
        </svg>

        {nodes.map(node => {
            if (node.type === 'note') {
                return (
                    <div
                        key={node.id}
                        className={`absolute p-4 w-64 bg-yellow-100 border border-yellow-200 shadow-md rounded-lg text-sm text-yellow-900 rotate-1 hover:rotate-0 transition-transform cursor-move node-card ${selectedNodeId === node.id ? 'ring-2 ring-yellow-400' : ''}`}
                        style={{ left: (node.x || 0) - 128, top: (node.y || 0) - 50 }}
                        onMouseDown={(e) => onNodeDragStart(node.id, e)}
                    >
                        <textarea 
                            className="w-full h-24 bg-transparent border-none focus:ring-0 resize-none placeholder-yellow-800/50"
                            placeholder="Add a note..."
                            defaultValue={node.noteContent}
                        />
                    </div>
                )
            }
            return (
                <div 
                    key={node.id} 
                    onMouseDown={(e) => onNodeDragStart(node.id, e)}
                    className="node-card"
                >
                    <NodeCard 
                        node={node} 
                        isSelected={selectedNodeId === node.id}
                        onSelect={onSelectNode} 
                    />
                </div>
            )
        })}
      </div>
    </div>
  );
};

export default WorkflowCanvas;