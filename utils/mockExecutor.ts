import { WorkflowNode } from "../types";

/**
 * Simulates the "Execution" of a node.
 * Returns plausible output data based on the node's tools and description.
 */
export const executeNodeMock = async (node: WorkflowNode): Promise<any> => {
  // Simulate network latency (random between 800ms and 2500ms)
  await new Promise(resolve => setTimeout(resolve, 800 + Math.random() * 1700));

  const desc = node.description?.toLowerCase() || "";
  const label = node.label.toLowerCase();
  const tools = node.tools || [];
  const hasCode = tools.some(t => t.name === 'Execute Code');
  const hasSearch = tools.some(t => t.name === 'Web Search');

  // Scenario 1: Python Code Execution (Data Analysis)
  if (hasCode) {
    return {
      type: "code_execution",
      code: `import pandas as pd\nimport numpy as np\n\n# Analyzing ${label}\ndata = pd.DataFrame({'value': np.random.randn(100)})\nresult = data.describe()\nprint(result)`,
      output: {
        "status": "success",
        "result": {
          "count": 100.0,
          "mean": 0.042,
          "std": 1.023,
          "min": -2.45,
          "max": 2.89
        },
        "console": "Analysis completed successfully. Generated descriptive statistics."
      }
    };
  }

  // Scenario 2: Web Search
  if (hasSearch) {
    return {
      type: "search_results",
      query: node.description,
      results: [
        { title: `${node.label} - Latest News`, url: "https://news.example.com/article1", snippet: "Recent reports indicate significant growth in this sector..." },
        { title: "Market Analysis 2024", url: "https://finance.example.com/report", snippet: "Analysts predict a bullish trend following the quarterly release..." },
        { title: "Official Documentation", url: "https://docs.example.com", snippet: "Technical specifications and API references..." }
      ]
    };
  }

  // Scenario 3: Fork/Router
  if (node.type === 'fork') {
      return {
          action: "branch_dispatch",
          branches: ["branch_a", "branch_b"],
          timestamp: new Date().toISOString()
      }
  }

  // Scenario 4: Final Output / Report
  if (node.type === 'output') {
      return {
          document_title: `${node.label} Final Report`,
          summary: "Based on the analysis, the system recommends a 'BUY' rating due to strong technical indicators and positive sentiment.",
          confidence_score: 0.89,
          generated_at: new Date().toISOString()
      }
  }

  // Default: Text generation
  return {
    text: `Processed ${node.label} successfully.`,
    metadata: {
      processed_items: Math.floor(Math.random() * 50) + 1,
      quality_check: "passed"
    }
  };
};