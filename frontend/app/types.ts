// ========== SCENE NODE & HISTORY TAB TYPES ==========

export type SceneNodeStatus = "idle" | "generating" | "rendering" | "success" | "error";

export type SceneNode = {
    id: string;
    parentId: string | null; // null for root nodes
    prompt: string;
    code: string;
    videoUrl: string;
    logs: string;
    status: SceneNodeStatus;
    createdAt: Date;
    summary?: string; // Optional change summary
    sceneName: string;
};

export type HistoryTab = {
    id: string;
    title: string;
    createdAt: Date;
    updatedAt: Date;
    config: {
        resolution: string;
        fps: number;
    };
    nodes: SceneNode[]; // Flat list, tree structure via parentId
    activeNodeId: string | null;
};

export type VideoSettings = {
    resolution_width: number;
    resolution_height: number;
    fps: number;
    quality: "low" | "medium" | "high" | "ultra";
};

// ========== HELPER FUNCTIONS ==========

/**
 * Get ancestry chain from root to the given node (inclusive)
 */
export function getAncestryChain(nodes: SceneNode[], nodeId: string): SceneNode[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));
    const chain: SceneNode[] = [];

    let current = nodeMap.get(nodeId);
    while (current) {
        chain.unshift(current); // prepend to get root-first order
        current = current.parentId ? nodeMap.get(current.parentId) : undefined;
    }

    return chain;
}

/**
 * Get direct children of a node
 */
export function getChildren(nodes: SceneNode[], parentId: string | null): SceneNode[] {
    return nodes.filter(n => n.parentId === parentId);
}

/**
 * Get root nodes (nodes with no parent)
 */
export function getRootNodes(nodes: SceneNode[]): SceneNode[] {
    return nodes.filter(n => n.parentId === null);
}

/**
 * Build tree structure for rendering
 */
export type NodeTreeItem = {
    node: SceneNode;
    children: NodeTreeItem[];
    depth: number;
};

export function buildNodeTree(nodes: SceneNode[]): NodeTreeItem[] {
    const nodeMap = new Map(nodes.map(n => [n.id, n]));

    function buildSubtree(parentId: string | null, depth: number): NodeTreeItem[] {
        return getChildren(nodes, parentId)
            .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
            .map(node => ({
                node,
                children: buildSubtree(node.id, depth + 1),
                depth,
            }));
    }

    return buildSubtree(null, 0);
}

/**
 * Flatten tree for rendering with depth info preserved
 */
export function flattenNodeTree(tree: NodeTreeItem[]): NodeTreeItem[] {
    const result: NodeTreeItem[] = [];

    function traverse(items: NodeTreeItem[]) {
        for (const item of items) {
            result.push(item);
            traverse(item.children);
        }
    }

    traverse(tree);
    return result;
}

/**
 * Generate a unique ID
 */
export function generateId(): string {
    return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * Create a new empty history tab
 */
export function createNewTab(resolution: string, fps: number, tabNumber: number): HistoryTab {
    const now = new Date();
    return {
        id: generateId(),
        title: `Scene ${tabNumber}`,
        createdAt: now,
        updatedAt: now,
        config: { resolution, fps },
        nodes: [],
        activeNodeId: null,
    };
}

/**
 * Get all descendant IDs of a node (including the node itself)
 */
export function getDescendantIds(nodes: SceneNode[], rootId: string): string[] {
    const result: string[] = [rootId];
    const children = getChildren(nodes, rootId);

    for (const child of children) {
        result.push(...getDescendantIds(nodes, child.id));
    }

    return result;
}

/**
 * Date reviver for JSON.parse to restore Date objects
 */
export function dateReviver(key: string, value: any): any {
    if (typeof value === 'string') {
        // ISO date format check
        const dateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
        if (dateRegex.test(value)) {
            return new Date(value);
        }
    }
    return value;
}
