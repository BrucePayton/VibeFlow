
export type NodeStatus = 'idle' | 'pending' | 'running' | 'completed' | 'failed';

export type NodeType = 'input' | 'task' | 'fork' | 'join' | 'output' | 'note';

export interface Tool {
  name: string;
  icon: string; // emoji or svg path
  type: 'function' | 'code_interpreter' | 'retrieval';
  description?: string;
}

export interface Variable {
  name: string;
  type: string; // e.g., 'string', 'number', 'json', 'boolean', 'file'
  description?: string;
}

export interface ToolLog {
  toolName: string;
  input: any;
  output: any;
  status: 'success' | 'error';
  timestamp: number;
}

export interface FileAttachment {
  id: string;
  name: string;
  size: number;
  type: string;
  content?: string; // Preview content (text)
}

export interface WorkflowNode {
  id: string;
  label: string;
  description?: string;
  type: NodeType;
  dependencies: string[]; // IDs of parent nodes
  status: NodeStatus;
  
  // Configuration
  prompt?: string; // System Prompt / User Instruction for the Agent
  inputVariables?: Variable[];
  outputVariables?: Variable[];
  tools: Tool[];
  
  // User Input Specific
  attachments?: FileAttachment[];

  // Note Specific
  noteContent?: string;

  // Execution State
  inputData?: Record<string, any>; // Runtime inputs
  outputData?: any; // Final Result
  thoughtProcess?: string; // The "Thinking" part of the response
  toolLogs?: ToolLog[]; // Trace of tool executions
  executionTime?: number;
  
  // Layout
  level?: number;
  x?: number;
  y?: number;
  expanded?: boolean;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  type: 'solid' | 'dashed'; // Solid for direct/serial, Dashed for parallel/conditional
}

export interface WorkflowData {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

export interface GeminiPlanResponse {
  name: string;
  nodes: {
    id: string;
    label: string;
    type: NodeType;
    description: string;
    dependencies: string[];
    suggestedTools?: string[];
    input_variables?: Variable[];
    output_variables?: Variable[];
    prompt?: string; // Plan can suggest a prompt
  }[];
}

export interface PlanStep {
  title: string;
  description: string;
  tool?: string;
}

export interface PlanProposal {
  title: string;
  steps: PlanStep[];
  requirements_summary: string;
  goal: string;
  scenarios: string[];
  outcome: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  proposal?: PlanProposal;
}