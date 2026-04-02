import { GoogleGenAI, Type, Schema, FunctionDeclaration } from "@google/genai";
import { GeminiPlanResponse, ChatMessage, PlanProposal } from "../types";
import { SYSTEM_INSTRUCTION, CHAT_SYSTEM_INSTRUCTION } from "../constants";

const variableSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    type: { type: Type.STRING },
    description: { type: Type.STRING }
  },
  required: ["name", "type"]
};

const responseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING, description: "A creative name for this workflow" },
    nodes: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          label: { type: Type.STRING },
          type: { type: Type.STRING, enum: ["input", "task", "fork", "join", "output"] },
          description: { type: Type.STRING },
          dependencies: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          },
          suggestedTools: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "List of tool keys: execute_code, web_search, generate_document"
          },
          input_variables: {
            type: Type.ARRAY,
            items: variableSchema,
            description: "Variables this node expects from upstream."
          },
          output_variables: {
            type: Type.ARRAY,
            items: variableSchema,
            description: "Variables this node produces. For 'input' nodes, this is the form schema."
          },
          prompt: {
            type: Type.STRING,
            description: "The detailed context-aware system prompt for this node."
          }
        },
        required: ["id", "label", "type", "dependencies"]
      }
    }
  },
  required: ["name", "nodes"]
};

// Tool 1: Propose Plan (Preview in Chat)
const proposePlanTool: FunctionDeclaration = {
  name: "propose_plan",
  description: "Display a visual preview of the proposed workflow steps in the chat for user confirmation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING, description: "Short title for the workflow" },
      steps: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING, description: "Name of the step" },
            description: { type: Type.STRING, description: "Brief description of what this agent does" },
            tool: { type: Type.STRING, description: "The primary tool used (e.g., execute_code, web_search)" }
          }
        }
      },
      requirements_summary: {
        type: Type.STRING,
        description: "A comprehensive prompt summarizing the agreed requirements to be passed to the generator later."
      },
      goal: { 
        type: Type.STRING, 
        description: "One clear sentence describing the core problem this workflow solves." 
      },
      scenarios: { 
        type: Type.ARRAY, 
        items: { type: Type.STRING },
        description: "2-3 specific business or user scenarios where this workflow is useful." 
      },
      outcome: { 
        type: Type.STRING, 
        description: "Description of the final deliverable or result (e.g., 'A PDF report with charts')." 
      }
    },
    required: ["title", "steps", "requirements_summary", "goal", "scenarios", "outcome"]
  }
};

export interface ArchitectResponse {
  text?: string;
  toolCall?: {
    name: string;
    args: any;
  };
}

// --- Rate Limit Handling Helpers ---
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
        // Exponential backoff with jitter: 2s, 4s, 8s... + random jitter to prevent thundering herd
        const backoff = 2000 * Math.pow(2, attempt);
        const jitter = Math.random() * 1000;
        const waitTime = backoff + jitter;
        console.warn(`Gemini Rate Limit (429). Retrying attempt ${attempt + 1}/${maxRetries} in ${Math.round(waitTime)}ms...`);
        await delay(waitTime);
        continue;
      }
      throw e;
    }
  }
  throw lastError;
};

export const chatWithArchitect = async (history: ChatMessage[]): Promise<ArchitectResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Filter out system messages and map to Gemini roles
  const contents = history
    .filter(m => m.role !== 'system')
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

  try {
    const response = await generateWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: contents,
      config: {
        systemInstruction: CHAT_SYSTEM_INSTRUCTION,
        tools: [{ functionDeclarations: [proposePlanTool] }],
        temperature: 0.7, 
      },
    });

    const result: ArchitectResponse = {};
    const parts = response.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.text) {
        result.text = (result.text || "") + part.text;
      }
      if (part.functionCall) {
        result.toolCall = {
          name: part.functionCall.name,
          args: part.functionCall.args
        };
      }
    }

    return result;
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    throw error;
  }
};

export const generateWorkflowPlan = async (userPrompt: string): Promise<GeminiPlanResponse> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  try {
    const response = await generateWithRetry(ai, {
      model: "gemini-2.5-flash",
      contents: userPrompt,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: responseSchema,
        temperature: 0.2,
        maxOutputTokens: 8192, // Explicitly set to avoid truncation of large DAGs
      },
    });

    let text = response.text;
    if (!text) throw new Error("No response text from Gemini");

    // Sanitize: Remove markdown code blocks if the model adds them despite responseMimeType
    text = text.trim();
    if (text.startsWith("```json")) {
        text = text.replace(/^```json\s*/, "").replace(/\s*```$/, "");
    } else if (text.startsWith("```")) {
        text = text.replace(/^```\s*/, "").replace(/\s*```$/, "");
    }

    return JSON.parse(text) as GeminiPlanResponse;
  } catch (error) {
    console.error("Gemini Planning Error:", error);
    throw error;
  }
};