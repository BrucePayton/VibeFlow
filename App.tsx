import React, { useState, useEffect, useRef } from 'react';
import { generateWorkflowPlan, chatWithArchitect } from './services/geminiService';
import { executeNode } from './services/executionService';
import { calculateLayout } from './utils/dagLayout';
import { WorkflowNode, WorkflowEdge, NodeStatus, GeminiPlanResponse, Tool, ChatMessage, PlanProposal, FileAttachment } from './types';
import { TOOL_REGISTRY } from './constants';
import WorkflowCanvas from './components/WorkflowCanvas';
import ChatPlanPreview from './components/ChatPlanPreview';
import ChatMessageBubble from './components/ChatMessageBubble';
import BottomToolbar from './components/BottomToolbar';
import { NodeIcons } from './components/NodeCard';

const App: React.FC = () => {
  // Chat & Core State
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([
    { role: 'assistant', content: "Hello! I'm your VibeFlow Architect.\n\nTell me what workflow you'd like to build.", timestamp: Date.now() }
  ]);
  const [userInput, setUserInput] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isBuildingFlow, setIsBuildingFlow] = useState(false);
  const [isPrefetching, setIsPrefetching] = useState(false); // Visual indicator state
  
  // Graph State
  const [nodes, setNodes] = useState<WorkflowNode[]>([]);
  const [edges, setEdges] = useState<WorkflowEdge[]>([]);
  const [workflowName, setWorkflowName] = useState("New Workflow");
  const [globalFiles, setGlobalFiles] = useState<FileAttachment[]>([]); // "File Library"

  // UI State
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'input' | 'output'>('input'); // REDESIGNED TABS
  const [nodeInputValues, setNodeInputValues] = useState<Record<string, string>>({});
  
  // Execution Control
  const [isExecuting, setIsExecuting] = useState(false);
  const processingRefs = useRef<Set<string>>(new Set());
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Performance Optimization: Prefetching
  const planPromiseRef = useRef<Promise<GeminiPlanResponse> | null>(null);

  useEffect(() => {
    // Force scroll to bottom whenever chat history changes
    if (chatEndRef.current) {
        chatEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatHistory, isGenerating]);

  // --- Keyboard Shortcuts (Delete Node) ---
  useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
          if (selectedNodeId && (e.key === 'Delete' || e.key === 'Backspace')) {
              // Ignore if typing in an input/textarea
              if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;
              handleDeleteNode(selectedNodeId);
          }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedNodeId]);

  // --- Graph Management ---
  const handleDeleteNode = (nodeId: string) => {
      setNodes(prev => prev.filter(n => n.id !== nodeId));
      setNodes(prev => prev.map(n => ({
          ...n,
          dependencies: n.dependencies.filter(d => d !== nodeId)
      })));
      setEdges(prev => prev.filter(e => e.source !== nodeId && e.target !== nodeId));
      if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  const handleAddDependency = (sourceId: string) => {
      if (!selectedNodeId) return;
      // Prevent cycles (simple check: direct parent) and self-loops
      if (sourceId === selectedNodeId) return;
      
      const node = nodes.find(n => n.id === selectedNodeId);
      if (node && !node.dependencies.includes(sourceId)) {
          // Update Node
          setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, dependencies: [...n.dependencies, sourceId] } : n));
          // Update Edge
          setEdges(prev => [...prev, {
              id: `${sourceId}-${selectedNodeId}`,
              source: sourceId,
              target: selectedNodeId,
              type: 'solid'
          }]);
      }
  };

  const handleRemoveDependency = (sourceId: string) => {
      if (!selectedNodeId) return;
      // Update Node
      setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, dependencies: n.dependencies.filter(d => d !== sourceId) } : n));
      // Update Edge
      setEdges(prev => prev.filter(e => !(e.source === sourceId && e.target === selectedNodeId)));
  };

  // --- YAML Export Logic ---
  const downloadYaml = () => {
    if (nodes.length === 0) return;

    // Simple YAML serializer
    let yamlContent = `name: "${workflowName}"\nversion: 1.0.0\nnodes:\n`;
    
    nodes.forEach(node => {
      yamlContent += `  - id: "${node.id}"\n`;
      yamlContent += `    label: "${node.label}"\n`;
      yamlContent += `    type: "${node.type}"\n`;
      if (node.description) yamlContent += `    description: "${node.description}"\n`;
      if (node.prompt) yamlContent += `    prompt: |\n      ${node.prompt.replace(/\n/g, '\n      ')}\n`;
      
      if (node.tools && node.tools.length > 0) {
        yamlContent += `    tools:\n`;
        node.tools.forEach(t => yamlContent += `      - ${t.name}\n`);
      }
      
      if (node.dependencies.length > 0) {
        yamlContent += `    dependencies:\n`;
        node.dependencies.forEach(d => yamlContent += `      - "${d}"\n`);
      }
      yamlContent += `\n`;
    });

    const blob = new Blob([yamlContent], { type: 'text/yaml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${workflowName.replace(/\s+/g, '_').toLowerCase()}.yaml`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // --- Node Selection & Sidebar Handling ---
  const handleSelectNode = (id: string | null) => {
      setSelectedNodeId(id);
      if (id) {
          const node = nodes.find(n => n.id === id);
          if (node) {
              // Decide default tab
              if (node.status === 'completed' || node.status === 'failed') {
                  setActiveTab('output');
              } else {
                  setActiveTab('input');
              }
              
              // Load Inputs for manual entry
              if (node.type === 'input') {
                  if (node.outputData && typeof node.outputData === 'object') {
                      const safeData: Record<string, string> = {};
                      Object.entries(node.outputData).forEach(([k, v]) => {
                          if (typeof v === 'string') safeData[k] = v;
                      });
                      setNodeInputValues(safeData);
                  } else {
                      setNodeInputValues({});
                  }
              }
          }
      }
  };

  const updateNodePosition = (id: string, x: number, y: number) => {
      setNodes(prev => prev.map(n => n.id === id ? { ...n, x, y } : n));
  };

  // --- Toolbar Actions ---
  const handleAddNode = (type: 'input' | 'task' | 'note') => {
      const id = Date.now().toString();
      const newNode: WorkflowNode = {
          id,
          type,
          label: type === 'note' ? 'Note' : `New ${type === 'input' ? 'Input' : 'Agent'}`,
          description: type === 'task' ? 'Describe the task...' : undefined,
          status: 'idle',
          dependencies: [],
          tools: [],
          x: 400 + (nodes.length * 20), // Slight offset
          y: 300,
          level: 0
      };
      setNodes(prev => [...prev, newNode]);
      setSelectedNodeId(id);
  };

  const handleUploadFile = (file: File) => {
      // Simulate file upload parsing
      const reader = new FileReader();
      reader.onload = (e) => {
          const content = e.target?.result as string;
          const newFile: FileAttachment = {
              id: Date.now().toString(),
              name: file.name,
              size: file.size,
              type: file.type,
              content: content.substring(0, 500) + "..." // Preview
          };
          setGlobalFiles(prev => [...prev, newFile]);
          
          if (selectedNodeId) {
             const node = nodes.find(n => n.id === selectedNodeId);
             if (node && node.type === 'input') {
                 setNodes(prev => prev.map(n => n.id === selectedNodeId ? {
                     ...n,
                     attachments: [...(n.attachments || []), newFile]
                 } : n));
             }
          }
      };
      reader.readAsText(file); // Assuming text for now
  };

  // --- Chat & Plan Generation ---
  const handleSendMessage = async () => {
    if (!userInput.trim() || !process.env.API_KEY) return;
    const userMsg: ChatMessage = { role: 'user', content: userInput, timestamp: Date.now() };
    setChatHistory(prev => [...prev, userMsg]);
    setUserInput('');
    setIsGenerating(true);

    // Clear previous prefetch if user starts new conversation
    planPromiseRef.current = null;
    setIsPrefetching(false);

    try {
      const response = await chatWithArchitect([...chatHistory, userMsg]);
      let hasReplied = false;

      if (response.text) {
        setChatHistory(prev => [...prev, { role: 'assistant', content: response.text!, timestamp: Date.now() }]);
        hasReplied = true;
      }
      
      if (response.toolCall?.name === 'propose_plan') {
        const proposal = response.toolCall.args as PlanProposal;
        
        if (!hasReplied) {
            setChatHistory(prev => [...prev, { 
                role: 'assistant', 
                content: "I've drafted a workflow based on our agreement. Please review the blueprint below:", 
                timestamp: Date.now() 
            }]);
            hasReplied = true;
        }

        console.log("🚀 Prefetching workflow generation in background...");
        setIsPrefetching(true);
        const promise = generateWorkflowPlan(proposal.requirements_summary);
        promise.then(() => setIsPrefetching(false)).catch(() => setIsPrefetching(false));
        promise.catch(e => console.warn("Prefetch warning:", e));
        planPromiseRef.current = promise;

        setChatHistory(prev => [...prev, { role: 'system', content: "Plan Proposed", proposal: proposal, timestamp: Date.now() }]);
        hasReplied = true;
      }

      if (!hasReplied) {
         setChatHistory(prev => [...prev, { 
             role: 'assistant', 
             content: "I understood your request but encountered a hiccup generating the response. Could you please rephrase or confirm the next step?", 
             timestamp: Date.now() 
         }]);
      }

    } catch (err: any) {
      setChatHistory(prev => [...prev, { role: 'assistant', content: `Error: ${err.message}`, timestamp: Date.now() }]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleConfirmGeneration = async (proposal: PlanProposal) => {
     // 1. Immediate Chat Feedback
     setChatHistory(prev => [
         ...prev, 
         { role: 'user', content: `Yes, please generate the "${proposal.title}" workflow.`, timestamp: Date.now() },
         { role: 'assistant', content: "On it! Initializing workflow topology...", timestamp: Date.now() + 1 }
     ]);

     setIsBuildingFlow(true);
     setWorkflowName(proposal.title);
     // Auto close inspector to show canvas
     setSelectedNodeId(null); 

     // 2. Optimistic Rendering
     const optimisticNodes: WorkflowNode[] = [];
     const inputNodeId = 'opt-input';
     optimisticNodes.push({
         id: inputNodeId,
         label: 'Start / Input',
         type: 'input',
         status: 'idle',
         dependencies: [],
         tools: [],
         description: "Initial user request data",
         level: 0, x: 0, y: 0
     });

     let prevNodeId = inputNodeId;
     proposal.steps.forEach((step, idx) => {
         const tool = step.tool ? TOOL_REGISTRY[step.tool] : undefined;
         const nodeId = `opt-${idx}`;
         optimisticNodes.push({
             id: nodeId,
             label: step.title,
             type: 'task',
             status: 'idle',
             description: step.description,
             tools: tool ? [tool] : [],
             dependencies: [prevNodeId],
             level: 0, x: 0, y: 0
         });
         prevNodeId = nodeId;
     });

     const { nodes: optLayoutNodes, edges: optLayoutEdges } = calculateLayout(optimisticNodes);
     setNodes(optLayoutNodes);
     setEdges(optLayoutEdges);

     // 3. Real Generation
     try {
        let plan: GeminiPlanResponse;
        const requirements = proposal.requirements_summary || proposal.title;
        
        if (planPromiseRef.current) {
            try {
                plan = await planPromiseRef.current;
            } catch (e) {
                plan = await generateWorkflowPlan(requirements);
            }
        } else {
            plan = await generateWorkflowPlan(requirements);
        }

        const rawNodes: WorkflowNode[] = plan.nodes.map(n => {
          const tools: Tool[] = (n.suggestedTools || []).map(tName => TOOL_REGISTRY[tName]).filter(Boolean);
          return { 
              ...n, 
              status: 'idle', 
              tools: tools, 
              expanded: false,
              inputVariables: n.input_variables,
              outputVariables: n.output_variables,
              prompt: n.prompt
          };
        });

        const { nodes: layoutNodes, edges: layoutEdges } = calculateLayout(rawNodes);
        
        const styledEdges = layoutEdges.map(e => {
            const source = rawNodes.find(n => n.id === e.source);
            return { ...e, type: (source?.type === 'fork' ? 'dashed' : 'solid') as 'solid' | 'dashed' };
        });

        setNodes(layoutNodes);
        setEdges(styledEdges);
        setWorkflowName(plan.name);
        
        setChatHistory(prev => [
            ...prev, 
            { role: 'assistant', content: `**${plan.name}** is ready! I've refined the topology for optimal execution.`, timestamp: Date.now() }
        ]);
     } catch(err: any) {
        setChatHistory(prev => [...prev, { role: 'system', content: `Configuration Failed: ${err.message}`, timestamp: Date.now() }]);
     } finally {
         setIsBuildingFlow(false);
         planPromiseRef.current = null;
         setIsPrefetching(false);
     }
  };

  // --- Workflow Execution ---
  const handleNodeInputChange = (key: string, value: string) => {
      setNodeInputValues(prev => ({ ...prev, [key]: value }));
  }

  const handleNodeInputSubmit = () => {
    if (!selectedNodeId) return;
    const payload = Object.keys(nodeInputValues).length > 0 ? nodeInputValues : { content: "Manual Trigger" };

    setNodes(prev => prev.map(n => {
        if (n.id === selectedNodeId) {
            return { ...n, status: 'completed', outputData: payload, executionTime: 0 };
        }
        return n;
    }));
    
    if (!isExecuting) setIsExecuting(true);
  };

  useEffect(() => {
    if (!isExecuting) return;
    const allComplete = nodes.every(n => n.status === 'completed' || n.status === 'failed' || n.type === 'note');
    if (allComplete) {
      setIsExecuting(false);
      return;
    }
    const readyNodes = nodes.filter(node => {
      if (node.status !== 'idle') return false;
      if (node.type === 'input' || node.type === 'note') return false; 
      const parents = nodes.filter(p => node.dependencies.includes(p.id));
      if (parents.length === 0) return true;
      return parents.every(p => p.status === 'completed');
    });

    if (readyNodes.length > 0) {
      setNodes(prev => prev.map(n => readyNodes.find(rn => rn.id === n.id) ? { ...n, status: 'running' } : n));
    }
  }, [nodes, isExecuting]);

  useEffect(() => {
    const runningNodes = nodes.filter(n => n.status === 'running');
    if (runningNodes.length > 0) {
        runningNodes.forEach(async (node) => {
            if (processingRefs.current.has(node.id)) return;
            processingRefs.current.add(node.id);
            const inputs: Record<string, any> = {};
            node.dependencies.forEach(depId => {
                const parent = nodes.find(n => n.id === depId);
                if (parent && parent.outputData) {
                    inputs[parent.label] = parent.outputData;
                }
            });
            const startTime = Date.now();
            try {
                const { output, toolLogs, thoughtProcess } = await executeNode(node, inputs);
                setNodes(prev => prev.map(n => n.id === node.id ? {
                    ...n,
                    status: 'completed',
                    outputData: output,
                    toolLogs: toolLogs,
                    thoughtProcess: thoughtProcess,
                    executionTime: Date.now() - startTime,
                    inputData: inputs 
                } : n));
            } catch (e: any) {
                 setNodes(prev => prev.map(n => n.id === node.id ? { ...n, status: 'failed', outputData: { error: e.message } } : n));
            } finally {
                processingRefs.current.delete(node.id);
            }
        });
    }
  }, [nodes]);

  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) : null;

  return (
    <div className="flex h-screen w-full bg-gray-50 text-gray-900 font-sans overflow-hidden">
      
      {/* Left Chat Sidebar */}
      <div className="w-[380px] flex flex-col border-r border-gray-200 bg-white z-20 shadow-xl">
        <div className="p-4 border-b border-gray-200 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-black flex items-center justify-center text-white font-bold">V</div>
            <h1 className="font-bold">VibeFlow</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
            {chatHistory.map((msg, idx) => (
                msg.proposal ? (
                    <ChatPlanPreview 
                        key={idx} 
                        proposal={msg.proposal} 
                        onConfirm={handleConfirmGeneration} 
                        isConfirmed={workflowName === msg.proposal.title && nodes.length > 0}
                        isLoading={isBuildingFlow} 
                    /> 
                ) : <ChatMessageBubble key={idx} message={msg} />
            ))}
            {(isGenerating) && <div className="text-xs text-gray-400 ml-4 animate-pulse">Thinking...</div>}
            <div ref={chatEndRef} />
        </div>
        <div className="p-4 border-t border-gray-200 bg-white">
            <textarea 
                value={userInput} onChange={(e) => setUserInput(e.target.value)} 
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), handleSendMessage())}
                className="w-full p-3 bg-gray-50 border rounded-xl text-sm outline-none focus:ring-1 focus:ring-emerald-500 resize-none h-[80px]"
                placeholder="Describe your workflow..."
            />
        </div>
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative bg-gray-100 overflow-hidden">
        
        {/* Header Overlay */}
        <div className="absolute top-4 right-4 z-20 flex gap-2 items-center">
            {isPrefetching && (
                <div className="flex items-center gap-2 bg-white/80 backdrop-blur px-3 py-1.5 rounded-full border border-emerald-100 shadow-sm animate-pulse">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
                    <span className="text-[10px] font-bold text-emerald-600">Generating Workflow...</span>
                </div>
            )}
            {nodes.length > 0 && (
                <button 
                    onClick={downloadYaml}
                    className="flex items-center gap-2 bg-white/90 backdrop-blur px-4 py-2 rounded-lg border border-gray-200 shadow-sm text-xs font-bold hover:bg-gray-50 text-gray-700 transition-all"
                >
                    <span className="text-emerald-500">↓</span> Download YAML
                </button>
            )}
        </div>

        {nodes.length > 0 ? (
            <WorkflowCanvas 
                nodes={nodes} edges={edges} 
                onSelectNode={handleSelectNode} selectedNodeId={selectedNodeId}
                onUpdateNodePosition={updateNodePosition}
            />
        ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-300 text-xl font-bold">Empty Canvas</div>
        )}
        
        <BottomToolbar onAddNode={handleAddNode} onUploadFile={handleUploadFile} />
      </div>

      {/* Right Inspector Sidebar - REDESIGNED */}
      <div className={`w-[450px] bg-white border-l border-gray-200 shadow-2xl transition-transform duration-300 z-30 flex flex-col
          ${selectedNode ? 'translate-x-0' : 'translate-x-full absolute right-0 h-full'}
      `}>
          {selectedNode && (
            <>
                {/* Header */}
                <div className="p-5 border-b border-gray-100 bg-gray-50 flex justify-between items-center sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                         <div className={`w-10 h-10 rounded-lg flex items-center justify-center border shadow-sm
                             ${selectedNode.status === 'running' ? 'bg-emerald-50 border-emerald-200 text-emerald-600 animate-pulse' : 'bg-white border-gray-200 text-gray-500'}
                         `}>
                             {selectedNode.type === 'input' && <NodeIcons.Input className="w-5 h-5" />}
                             {selectedNode.type === 'task' && <NodeIcons.Agent className="w-5 h-5" />}
                             {selectedNode.type === 'output' && <NodeIcons.Output className="w-5 h-5" />}
                             {selectedNode.type === 'fork' && <NodeIcons.Fork className="w-5 h-5" />}
                             {selectedNode.type === 'join' && <NodeIcons.Join className="w-5 h-5" />}
                             {selectedNode.type === 'note' && <span className="text-xl">📝</span>}
                         </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{selectedNode.type} Node</span>
                                {selectedNode.status === 'completed' && <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 rounded-full font-bold">DONE</span>}
                            </div>
                            <h3 className="font-bold text-lg text-gray-900 leading-tight line-clamp-1" title={selectedNode.label}>{selectedNode.label}</h3>
                        </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={() => handleDeleteNode(selectedNode.id)}
                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Node"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        </button>
                        <div className="w-px h-6 bg-gray-200 mx-1"></div>
                        <button onClick={() => setSelectedNodeId(null)} className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 bg-gray-50/50">
                    <button 
                        onClick={() => setActiveTab('input')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'input' ? 'text-blue-600 bg-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    >
                        Input & Config
                        {activeTab === 'input' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-blue-500"></div>}
                    </button>
                    <button 
                        onClick={() => setActiveTab('output')}
                        className={`flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-colors relative ${activeTab === 'output' ? 'text-emerald-600 bg-white' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'}`}
                    >
                        Thinking & Output
                        {activeTab === 'output' && <div className="absolute bottom-0 left-0 w-full h-0.5 bg-emerald-500"></div>}
                    </button>
                </div>

                {/* Content Area */}
                <div className="flex-1 overflow-y-auto p-5 space-y-6 bg-white custom-scrollbar">
                    
                    {/* --- INPUT TAB --- */}
                    {activeTab === 'input' && (
                        <div className="space-y-8 animate-fade-in">
                            
                            {/* 1. Dependencies (Upstream Context) */}
                            {selectedNode.type !== 'input' && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Upstream Context</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {/* List Existing Dependencies */}
                                        <div className="flex flex-wrap gap-2">
                                            {selectedNode.dependencies.map(depId => {
                                                const depNode = nodes.find(n => n.id === depId);
                                                return (
                                                    <div key={depId} className="flex items-center gap-2 pl-3 pr-2 py-1.5 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-700 group/tag">
                                                        <NodeIcons.Agent className="w-3 h-3 opacity-70" />
                                                        <span className="font-medium">{depNode?.label || depId}</span>
                                                        <button 
                                                            onClick={() => handleRemoveDependency(depId)}
                                                            className="p-1 hover:bg-blue-100 rounded text-blue-400 hover:text-red-500 transition-colors"
                                                            title="Remove dependency"
                                                        >
                                                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {selectedNode.dependencies.length === 0 && <span className="text-xs text-gray-400 italic">No upstream dependencies.</span>}
                                        </div>

                                        {/* Add New Dependency */}
                                        <div className="relative">
                                            <select 
                                                className="w-full p-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-600 outline-none focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer hover:bg-white transition-colors"
                                                onChange={(e) => {
                                                    if (e.target.value) {
                                                        handleAddDependency(e.target.value);
                                                        e.target.value = ""; // Reset
                                                    }
                                                }}
                                                defaultValue=""
                                            >
                                                <option value="" disabled>+ Connect upstream node...</option>
                                                {nodes
                                                    .filter(n => n.id !== selectedNode.id && !selectedNode.dependencies.includes(n.id) && n.type !== 'note')
                                                    .map(n => (
                                                        <option key={n.id} value={n.id}>
                                                            {n.label} ({n.type})
                                                        </option>
                                                    ))
                                                }
                                            </select>
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* 2. Model & Tools Config */}
                            <section className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <div className="w-1 h-4 bg-purple-500 rounded-full"></div>
                                    <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Model Configuration</h4>
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Model</span>
                                        <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                            <span className="text-lg">✨</span> Gemini 2.5 Flash
                                        </div>
                                    </div>
                                    {selectedNode.attachments && selectedNode.attachments.length > 0 && (
                                         <div className="p-3 bg-gray-50 border border-gray-100 rounded-lg">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase block mb-1">Files</span>
                                            <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                                                <span className="text-lg">📂</span> {selectedNode.attachments.length} Attached
                                            </div>
                                        </div>
                                    )}
                                </div>
                                
                                {selectedNode.tools && selectedNode.tools.length > 0 && (
                                    <div className="space-y-2">
                                        <span className="text-[10px] text-gray-400 font-bold uppercase pl-1">Active Tools</span>
                                        <div className="flex flex-wrap gap-2">
                                            {selectedNode.tools.map(tool => (
                                                <div key={tool.name} className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full text-xs font-medium text-gray-600">
                                                    <span>{tool.icon}</span> {tool.name}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </section>

                            {/* 3. Prompt (Editable) */}
                            {selectedNode.type === 'task' && (
                                <section className="space-y-3">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <div className="w-1 h-4 bg-amber-500 rounded-full"></div>
                                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">System Instruction</h4>
                                        </div>
                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded border border-gray-200">Role-Based Prompt</span>
                                    </div>
                                    <textarea 
                                        className="w-full h-48 p-4 text-xs font-mono leading-relaxed text-gray-600 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none shadow-inner"
                                        defaultValue={selectedNode.prompt || selectedNode.description}
                                        onChange={(e) => {
                                            setNodes(prev => prev.map(n => n.id === selectedNode.id ? { ...n, prompt: e.target.value } : n));
                                        }}
                                        placeholder="# ROLE..."
                                    />
                                </section>
                            )}

                            {/* 4. Runtime Variables (Inputs) */}
                            {selectedNode.inputData && Object.keys(selectedNode.inputData).length > 0 && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-teal-500 rounded-full"></div>
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Runtime Variables</h4>
                                    </div>
                                    <div className="bg-gray-900 rounded-xl overflow-hidden border border-gray-800 shadow-sm">
                                        <pre className="p-4 text-[10px] text-gray-300 font-mono overflow-auto max-h-40 custom-scrollbar">
                                            {JSON.stringify(selectedNode.inputData, null, 2)}
                                        </pre>
                                    </div>
                                </section>
                            )}
                            
                            {/* Manual Input Form for Start Node */}
                            {selectedNode.type === 'input' && (
                                <section className="space-y-3">
                                    <div className="flex items-center gap-2">
                                        <div className="w-1 h-4 bg-blue-500 rounded-full"></div>
                                        <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Manual Input</h4>
                                    </div>
                                    <div className="space-y-3">
                                        {(selectedNode.outputVariables || [{name: 'content', type:'string'}]).map(v => (
                                            <div key={v.name}>
                                                <span className="text-[10px] font-bold text-gray-400 uppercase mb-1 block">{v.name}</span>
                                                <textarea 
                                                    value={nodeInputValues[v.name] || ''}
                                                    onChange={(e) => handleNodeInputChange(v.name, e.target.value)}
                                                    className="w-full h-24 p-3 text-sm border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-100 transition-all"
                                                    placeholder={`Enter ${v.name}...`}
                                                />
                                            </div>
                                        ))}
                                        {/* Run Node button moved to fixed footer below */}
                                    </div>
                                </section>
                            )}
                        </div>
                    )}

                    {/* --- OUTPUT TAB --- */}
                    {activeTab === 'output' && (
                        <div className="space-y-8 animate-fade-in pb-10">
                            
                            {selectedNode.status === 'idle' ? (
                                <div className="text-center py-20 opacity-50">
                                    <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <span className="text-2xl">💤</span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-500">Waiting for execution...</p>
                                </div>
                            ) : (
                                <>
                                    {/* 1. Chain of Thought (The "Brain") */}
                                    <section className="space-y-4">
                                         <div className="flex items-center gap-2">
                                            <div className="w-1 h-4 bg-indigo-500 rounded-full"></div>
                                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Model Thinking</h4>
                                        </div>
                                        
                                        <div className="relative pl-6 border-l-2 border-gray-100 space-y-8">
                                            
                                            {/* Extracted Thinking Block */}
                                            {selectedNode.thoughtProcess && (
                                                <div className="relative">
                                                    <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-indigo-50 border-2 border-indigo-200 flex items-center justify-center">
                                                        <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    </div>
                                                    <div className="bg-indigo-50/50 p-4 rounded-xl border border-indigo-100 text-xs text-indigo-900 leading-relaxed shadow-sm">
                                                        <div className="font-bold mb-1 opacity-50 text-[10px] uppercase">Chain of Thought</div>
                                                        <div className="whitespace-pre-wrap">{selectedNode.thoughtProcess}</div>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Tool Logs as Timeline Items */}
                                            {selectedNode.toolLogs && selectedNode.toolLogs.map((log, i) => (
                                                <div key={i} className="relative">
                                                     <div className={`absolute -left-[31px] top-0 w-4 h-4 rounded-full border-2 flex items-center justify-center bg-white ${log.status === 'success' ? 'border-emerald-200' : 'border-red-200'}`}>
                                                        <div className={`w-1.5 h-1.5 rounded-full ${log.status === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}></div>
                                                    </div>
                                                    
                                                    {/* Log Card */}
                                                    <div className="border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                                        <div className="bg-gray-50 p-2 border-b border-gray-100 flex justify-between items-center">
                                                            <div className="flex items-center gap-2 font-bold text-xs text-gray-700">
                                                                {log.toolName === 'Execute Code' && <NodeIcons.Code className="w-3 h-3" />}
                                                                {log.toolName === 'Web Search' && <NodeIcons.Search className="w-3 h-3" />}
                                                                {log.toolName}
                                                            </div>
                                                            <span className="text-[9px] text-gray-400 font-mono">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                                        </div>
                                                        
                                                        <div className="bg-white">
                                                            {/* Code Special Display */}
                                                            {log.toolName === 'Execute Code' ? (
                                                                <div className="grid grid-rows-[auto_auto] divide-y divide-gray-100">
                                                                    <div className="p-3 bg-[#1e1e1e] overflow-x-auto">
                                                                        <span className="text-[9px] text-gray-500 uppercase font-bold block mb-1">Input Code</span>
                                                                        <code className="text-[10px] font-mono text-blue-300 whitespace-pre block">
                                                                            {/* Robustly handle different input shapes */}
                                                                            {(typeof log.input === 'object' && log.input.code) 
                                                                                ? log.input.code 
                                                                                : (typeof log.input === 'string' ? log.input : JSON.stringify(log.input, null, 2))}
                                                                        </code>
                                                                    </div>
                                                                    <div className="p-3 bg-gray-50">
                                                                        <span className="text-[9px] text-gray-400 uppercase font-bold block mb-1">Console Output</span>
                                                                        <code className="text-[10px] font-mono text-gray-600 whitespace-pre-wrap block">
                                                                             {/* Robustly handle different output shapes */}
                                                                            {(log.output && log.output.stdout) 
                                                                                ? log.output.stdout 
                                                                                : (log.output ? JSON.stringify(log.output, null, 2) : "(No output)")}
                                                                        </code>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <div className="p-3 space-y-2">
                                                                     <div>
                                                                        <span className="text-[9px] text-gray-400 uppercase font-bold">Input</span>
                                                                        <div className="text-[10px] font-mono bg-gray-50 p-1.5 rounded border border-gray-100 mt-1 text-gray-600 truncate">
                                                                            {JSON.stringify(log.input)}
                                                                        </div>
                                                                    </div>
                                                                    <div>
                                                                        <span className="text-[9px] text-gray-400 uppercase font-bold">Output</span>
                                                                        <div className="text-[10px] font-mono bg-emerald-50 p-1.5 rounded border border-emerald-100 mt-1 text-emerald-800 line-clamp-3">
                                                                            {JSON.stringify(log.output)}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </section>

                                    {/* 2. Final Result */}
                                    <section className="space-y-3 pt-4 border-t border-gray-100">
                                         <div className="flex items-center gap-2">
                                            <div className="w-1 h-4 bg-emerald-500 rounded-full"></div>
                                            <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wide">Final Outcome</h4>
                                        </div>
                                        <div className="bg-emerald-50/50 rounded-xl p-4 border border-emerald-100 shadow-sm">
                                             <pre className="text-xs text-gray-800 whitespace-pre-wrap font-sans leading-relaxed">
                                                {typeof selectedNode.outputData === 'string' 
                                                    ? selectedNode.outputData 
                                                    : JSON.stringify(selectedNode.outputData, null, 2)}
                                            </pre>
                                        </div>
                                    </section>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer Action - Fixed Run Button for Input Nodes */}
                {selectedNode.type === 'input' && activeTab === 'input' && (
                    <div className="p-4 border-t border-gray-200 bg-gray-50 sticky bottom-0 z-20">
                         <button 
                            onClick={handleNodeInputSubmit}
                            className="w-full py-3.5 bg-black text-white rounded-xl text-sm font-bold shadow-lg hover:bg-gray-800 transition-transform active:scale-[0.98] flex items-center justify-center gap-2"
                        >
                            <span>Run Node</span>
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" /></svg>
                        </button>
                    </div>
                )}
            </>
          )}
      </div>
    </div>
  );
};

export default App;