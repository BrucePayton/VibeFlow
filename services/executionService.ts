import { GoogleGenAI } from "@google/genai";
import { WorkflowNode, ToolLog } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const generateWithRetry = async (ai: GoogleGenAI, params: any) => {
  let lastError;
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (e: any) {
      lastError = e;
      // Check for 429 or RESOURCE_EXHAUSTED or similar quota errors
      const isRateLimit = e.status === 429 || 
                          e.status === 'RESOURCE_EXHAUSTED' || 
                          (e.message && (e.message.includes('429') || e.message.includes('quota') || e.message.includes('Resource has been exhausted')));
      
      if (isRateLimit && attempt < maxRetries - 1) {
        // Exponential backoff with jitter
        const backoff = 2000 * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const waitTime = backoff + jitter;
        console.warn(`Gemini Execution 429. Retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms...`);
        await delay(waitTime);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
};

export const executeNode = async (node: WorkflowNode, inputs: Record<string, any>): Promise<{ output: any, toolLogs: ToolLog[], thoughtProcess?: string }> => {
  if (!process.env.API_KEY) throw new Error("API Key missing");
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  const toolLogs: ToolLog[] = [];
  const tools: any[] = [];
  let isWebSearch = false;
  
  // 1. Setup Tools
  if (node.tools?.some(t => t.name === 'Web Search')) {
    tools.push({ googleSearch: {} });
    isWebSearch = true;
    
    if (node.description) {
        toolLogs.push({
            toolName: 'Web Search',
            input: { query: `Search query derived from context...` },
            output: { status: 'pending' }, 
            status: 'success',
            timestamp: Date.now()
        });
    }
  }

  const hasCodeTool = node.tools?.some(t => t.name === 'Execute Code');
  if (hasCodeTool) {
      tools.push({ codeExecution: {} }); // Enable Gemini Code Execution
  }

  // 2. Prepare Context-Rich Inputs
  // Instead of flat keys, we format them as distinct "Source Blocks"
  const inputContext = Object.entries(inputs).map(([sourceNodeLabel, value]) => {
      const valStr = typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
      return `### FROM UPSTREAM NODE: "${sourceNodeLabel}"\n${valStr}`;
  }).join('\n\n');

  const coreInstruction = node.prompt || node.description || "Process the inputs.";
  
  // 3. Assemble the "Mega-Prompt"
  let finalPrompt = "";
  
  if (coreInstruction.includes("# ROLE")) {
      // Use the Architect's High-Quality Prompt
      finalPrompt = `
        ${coreInstruction}

        ==================================================
        🔴 LIVE RUNTIME DATA (INPUTS)
        ==================================================
        ${inputContext ? inputContext : "(No upstream data provided. Use internal knowledge or tools.)"}
        
        ==================================================
        🟢 EXECUTION INSTRUCTION
        ==================================================
        1. **Analyze the Runtime Data** above carefully. It comes from the upstream nodes mentioned in your context.
        2. **Thinking Process**: You MUST first wrap your reasoning in <thinking> tags. Explain how you are processing the specific data provided.
        3. **Action**: Use tools if necessary.
        
        **Tool Access**:
        ${hasCodeTool ? "- Python Code Interpreter: AVAILABLE. **YOU MUST USE THIS TOOL** if there is ANY calculation, data parsing, or logic required. Do not simulate code in text." : ""}
        ${isWebSearch ? "- Google Search: AVAILABLE." : ""}
      `;
  } else {
      // Legacy Fallback
      finalPrompt = `
        You are an AI Agent.
        
        ### 1. INPUT CONTEXT (From Previous Nodes)
        ${inputContext}
        
        ### 2. YOUR TASK
        ${coreInstruction}
        
        ### 3. REQUIREMENT
        Think step-by-step. Wrap your thoughts in <thinking>...</thinking> tags.
        ${hasCodeTool ? "**IMPORTANT**: You have access to a Python environment. Use the Code Execution tool to solve the problem. Do not just write the code, EXECUTE IT." : ""}
      `;
  }

  try {
      const response = await generateWithRetry(ai, {
        model: "gemini-2.5-flash",
        contents: [{ role: 'user', parts: [{ text: finalPrompt }] }],
        config: {
          tools: tools.length > 0 ? tools : undefined,
        }
      });
      
      let thoughtProcess = "";
      
      // Parse Response Parts for Text, Thinking, Code, and Results
      const parts = response.candidates?.[0]?.content?.parts || [];
      let fullText = "";
      
      // Temporary storage to link code and result
      let lastCodeLog: ToolLog | null = null;

      for (const part of parts) {
          // A. Text Handling
          if (part.text) {
              fullText += part.text;
              
              // Extract Thinking on the fly if mixed in text chunks
              const thoughtMatch = part.text.match(/<thinking>([\s\S]*?)<\/thinking>/);
              if (thoughtMatch) {
                  thoughtProcess += thoughtMatch[1].trim() + "\n";
              }
          }

          // B. Executable Code (The Input)
          if (part.executableCode) {
              lastCodeLog = {
                  toolName: 'Execute Code',
                  input: { code: part.executableCode.code },
                  output: { stdout: "..." },
                  status: 'success',
                  timestamp: Date.now()
              };
              toolLogs.push(lastCodeLog); // Push strictly by reference
          }

          // C. Code Execution Result (The Output)
          if (part.codeExecutionResult) {
              if (lastCodeLog) {
                  lastCodeLog.output = { 
                      stdout: part.codeExecutionResult.output 
                  };
                  lastCodeLog.status = part.codeExecutionResult.outcome === 'OUTCOME_OK' ? 'success' : 'error';
                  lastCodeLog = null; // Pair consumed
              }
          }
      }

      // Cleanup Thinking tags from final text
      let cleanText = fullText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();

      // Fallback: If no structured code parts but text contains markdown code blocks
      // (This handles cases where the model decides to just write code in markdown or tool fails)
      const existingCodeLog = toolLogs.find(t => t.toolName === 'Execute Code');
      if (hasCodeTool && !existingCodeLog) {
           const codeMatch = cleanText.match(/```python([\s\S]*?)```/);
           if (codeMatch) {
               toolLogs.push({
                   toolName: 'Execute Code',
                   input: { code: codeMatch[1].trim() },
                   output: { stdout: "(Simulated Output based on text context)" },
                   status: 'success',
                   timestamp: Date.now()
               });
           }
      }

      // Extract Search Results (Grounding)
      if (response.candidates?.[0]?.groundingMetadata?.groundingChunks) {
          const chunks = response.candidates[0].groundingMetadata.groundingChunks;
          const links = chunks.map((c: any) => c.web?.uri).filter(Boolean);
          const titles = chunks.map((c: any) => c.web?.title).filter(Boolean);
          
          const searchLogIndex = toolLogs.findIndex(t => t.toolName === 'Web Search');
          if (searchLogIndex >= 0) {
              toolLogs[searchLogIndex] = {
                  ...toolLogs[searchLogIndex],
                  input: { query: "Executed Search" },
                  output: { 
                      sources: links.slice(0, 3).map((l: string, i: number) => ({ title: titles[i] || 'Source', url: l })) 
                  }
              };
          }
      }

      // Try Parse JSON Output
      let finalOutput: any = cleanText;
      try {
          const possibleJson = cleanText.trim().replace(/^```json\s*|\s*```$/g, '');
          if (possibleJson.startsWith('{') || possibleJson.startsWith('[')) {
              finalOutput = JSON.parse(possibleJson);
          }
      } catch (e) {
          // Keep as text if not JSON
      }

      return {
          output: finalOutput,
          toolLogs: toolLogs,
          thoughtProcess: thoughtProcess.trim() || "No explicit thinking trace provided."
      };

  } catch (err: any) {
      return { 
          output: { error: err.message }, 
          toolLogs: [{ toolName: 'System', input: {}, output: err.message, status: 'error', timestamp: Date.now() }],
          thoughtProcess: "Execution failed."
      };
  }
}