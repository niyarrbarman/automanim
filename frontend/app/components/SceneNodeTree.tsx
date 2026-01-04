"use client";
import React from "react";
import { SceneNode, buildNodeTree, flattenNodeTree, NodeTreeItem } from "../types";

type Props = {
    nodes: SceneNode[];
    activeNodeId: string | null;
    onNodeSelect: (nodeId: string) => void;
    onNodeDelete: (nodeId: string) => void;
    onNodeRetry: (nodeId: string) => void;
    onNodeEdit: (nodeId: string) => void;
};

function getStatusDot(status: SceneNode["status"]) {
    switch (status) {
        case "generating":
        case "rendering":
            return <span className="node-status node-status--rendering" />;
        case "error":
            return <span className="node-status node-status--error" />;
        case "success":
            return <span className="node-status node-status--ready" />;
        default:
            return <span className="node-status node-status--idle" />;
    }
}

function truncatePrompt(prompt: string, maxLength: number = 30): string {
    if (prompt.length <= maxLength) return prompt;
    return prompt.slice(0, maxLength - 3) + "...";
}

export default function SceneNodeTree({ nodes, activeNodeId, onNodeSelect, onNodeDelete, onNodeRetry, onNodeEdit }: Props) {
    const handleDelete = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        if (window.confirm("Delete this iteration and all following updates?")) {
            onNodeDelete(nodeId);
        }
    };

    const handleRetry = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        if (window.confirm("Retry this prompt? This will delete all following updates and regenerate.")) {
            onNodeRetry(nodeId);
        }
    };

    const handleEdit = (e: React.MouseEvent, nodeId: string) => {
        e.stopPropagation();
        onNodeEdit(nodeId);
    };

    if (nodes.length === 0) {
        return (
            <div className="node-tree-empty">
                <p>No scene iterations yet.</p>
                <p className="node-tree-empty-hint">
                    Type a prompt and click <strong>Generate Scene</strong> to start.
                </p>
            </div>
        );
    }

    const tree = buildNodeTree(nodes);
    const flatList = flattenNodeTree(tree);

    return (
        <div className="node-tree">
            {flatList.map((item) => (
                <button
                    key={item.node.id}
                    className={`node-item ${activeNodeId === item.node.id ? "node-item--active" : ""}`}
                    onClick={() => onNodeSelect(item.node.id)}
                    style={{ paddingLeft: `${12 + item.depth * 16}px` }}
                >
                    {item.depth > 0 && (
                        <span className="node-connector">
                            <svg width="12" height="12" viewBox="0 0 12 12">
                                <path
                                    d="M 0 0 L 0 6 L 8 6"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="1"
                                    opacity="0.3"
                                />
                            </svg>
                        </span>
                    )}
                    {getStatusDot(item.node.status)}
                    <span className="node-prompt">{truncatePrompt(item.node.prompt)}</span>
                    <span className="node-time">
                        {new Date(item.node.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                        })}
                    </span>
                    <div
                        className="node-retry-btn"
                        onClick={(e) => handleRetry(e, item.node.id)}
                        title="Retry this prompt"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="23 4 23 10 17 10"></polyline>
                            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"></path>
                        </svg>
                    </div>
                    <div
                        className="node-edit-btn"
                        onClick={(e) => handleEdit(e, item.node.id)}
                        title="Edit this prompt"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </div>
                    <div
                        className="node-delete-btn"
                        onClick={(e) => handleDelete(e, item.node.id)}
                        title="Delete this iteration"
                    >
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </div>
                </button>
            ))}
        </div>
    );
}
