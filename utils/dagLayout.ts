import { WorkflowNode, WorkflowEdge } from "../types";
import { NODE_WIDTH, LEVEL_SPACING, SIBLING_SPACING, NODE_HEIGHT_COLLAPSED } from "../constants";

/**
 * Assigns X/Y coordinates to nodes based on a level-based layout.
 * Modified for HORIZONTAL layout (Left -> Right).
 */
export const calculateLayout = (nodes: WorkflowNode[]): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } => {
  const layoutNodes = nodes.map(n => ({ ...n, level: 0, x: 0, y: 0 }));
  const edges: WorkflowEdge[] = [];

  // Create Edges map for easy lookup
  layoutNodes.forEach(node => {
    node.dependencies.forEach(depId => {
      edges.push({
        id: `${depId}-${node.id}`,
        source: depId,
        target: node.id,
        type: 'solid'
      });
    });
  });

  // 1. Assign Levels (BFS/Topological sort approximation)
  // Level 0 = Leftmost
  let changed = true;
  while (changed) {
    changed = false;
    layoutNodes.forEach(node => {
      if (node.dependencies.length > 0) {
        const parentLevels = node.dependencies.map(depId => {
          const parent = layoutNodes.find(n => n.id === depId);
          return parent ? parent.level || 0 : 0;
        });
        const maxParentLevel = Math.max(...parentLevels);
        if (node.level !== maxParentLevel + 1) {
          node.level = maxParentLevel + 1;
          changed = true;
        }
      }
    });
  }

  // 2. Group by Level
  const levels: { [key: number]: WorkflowNode[] } = {};
  layoutNodes.forEach(node => {
    const lvl = node.level || 0;
    if (!levels[lvl]) levels[lvl] = [];
    levels[lvl].push(node);
  });

  // 3. Assign X/Y
  // X is determined by Level * LEVEL_SPACING
  // Y is determined by Position in Level * SIBLING_SPACING (centered vertically)
  
  Object.keys(levels).forEach(lvlKey => {
    const levelIndex = parseInt(lvlKey);
    const nodesInLevel = levels[levelIndex];
    const totalHeight = nodesInLevel.length * SIBLING_SPACING;
    const startY = -(totalHeight / 2) + (SIBLING_SPACING / 2);

    nodesInLevel.forEach((node, idx) => {
      node.x = levelIndex * LEVEL_SPACING + 150; // +Padding Left
      node.y = startY + (idx * SIBLING_SPACING) + 300; // +Padding Top/Center offset
    });
  });

  return { nodes: layoutNodes, edges };
};