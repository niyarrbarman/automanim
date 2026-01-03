"use client";
import React from "react";
import { HistoryTab, SceneNodeStatus } from "../types";

type Props = {
    tabs: HistoryTab[];
    activeTabId: string | null;
    onTabSelect: (tabId: string) => void;
    onTabDelete: (tabId: string) => void;
};

function getTabStatus(tab: HistoryTab): SceneNodeStatus {
    if (tab.nodes.length === 0) return "idle";
    // Return the status of the most recently updated node
    const sorted = [...tab.nodes].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    return sorted[0]?.status || "idle";
}

function getStatusIndicator(status: SceneNodeStatus) {
    switch (status) {
        case "generating":
        case "rendering":
            return <span className="tab-status tab-status--rendering" title="Rendering" />;
        case "error":
            return <span className="tab-status tab-status--error" title="Error" />;
        case "success":
            return <span className="tab-status tab-status--ready" title="Ready" />;
        default:
            return <span className="tab-status tab-status--idle" title="Idle" />;
    }
}

export default function HistoryTabList({ tabs, activeTabId, onTabSelect, onTabDelete }: Props) {
    const handleDelete = (e: React.MouseEvent, tabId: string) => {
        e.stopPropagation();
        if (window.confirm("Are you sure you want to delete this project?")) {
            onTabDelete(tabId);
        }
    };

    return (
        <div className="tab-list">
            <div className="tab-list-header">
                <span className="section-label">Projects</span>
            </div>
            <div className="tab-list-items">
                {tabs.length === 0 ? (
                    <p className="tab-empty">No projects yet. Click "New Scene" above.</p>
                ) : (
                    tabs.map((tab) => (
                        <div key={tab.id} className="tab-item-wrapper">
                            <button
                                className={`tab-item ${activeTabId === tab.id ? "tab-item--active" : ""}`}
                                onClick={() => onTabSelect(tab.id)}
                            >
                                {getStatusIndicator(getTabStatus(tab))}
                                <span className="tab-item-title">{tab.title}</span>
                                <span className="tab-item-count">
                                    {tab.nodes.length}
                                </span>
                                <div
                                    className="tab-delete-btn"
                                    onClick={(e) => handleDelete(e, tab.id)}
                                    title="Delete Project"
                                >
                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <polyline points="3 6 5 6 21 6"></polyline>
                                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                    </svg>
                                </div>
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}
