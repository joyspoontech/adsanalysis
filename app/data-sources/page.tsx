'use client';

import { useState } from 'react';
import {
    Database,
    Plus,
    RefreshCw,
    Trash2,
    ExternalLink,
    Check,
    X,
    Loader2,
    AlertCircle,
    FileSpreadsheet,
    Eye,
    EyeOff,
    ChevronDown,
    ChevronRight,
    Layers,
} from 'lucide-react';
import { useDataSources } from '@/hooks/useDataSources';
import { useSync } from '@/hooks/useSync';
import { validateSheetUrl, fetchSheetTabs, SheetTabInfo, fetchSheetPreview } from '@/lib/googleSheets';
import { detectDataType, suggestMappings } from '@/lib/columnMapper';

const PLATFORMS = [
    { value: 'swiggy', label: 'Swiggy', color: '#FC8019' },
    { value: 'zepto', label: 'Zepto', color: '#8B5CF6' },
    { value: 'blinkit', label: 'Blinkit', color: '#F8E831' },
    { value: 'instamart', label: 'Instamart', color: '#41B883' },
    { value: 'amazon', label: 'Amazon', color: '#FF9900' },
    { value: 'flipkart', label: 'Flipkart', color: '#2874F0' },
];

interface PreviewData {
    headers: string[];
    rows: (string | number)[][];
}

interface SelectedTabConfig {
    tab: SheetTabInfo;
    platform: string;
    dataType: 'ads' | 'sales';
    name: string;
}

export default function DataSourcesPage() {
    const { sources, isLoading, add, remove, toggleActive, refresh } = useDataSources();
    const { isSyncing, syncOne, syncAll, syncAllWithQuery } = useSync();

    // Add new source state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newUrl, setNewUrl] = useState('');
    const [validating, setValidating] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [detectedTabs, setDetectedTabs] = useState<SheetTabInfo[]>([]);
    const [selectedTabs, setSelectedTabs] = useState<SelectedTabConfig[]>([]);
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [previewTab, setPreviewTab] = useState<SheetTabInfo | null>(null);
    const [adding, setAdding] = useState(false);
    const [sheetId, setSheetId] = useState<string | null>(null);

    // Collapsed groups state for display
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    // Validate URL and detect tabs
    const handleValidateUrl = async () => {
        if (!newUrl.trim()) return;

        setValidating(true);
        setValidationError(null);
        setDetectedTabs([]);
        setSelectedTabs([]);
        setPreview(null);
        setPreviewTab(null);

        try {
            const result = await validateSheetUrl(newUrl);

            if (!result.valid) {
                setValidationError(result.error || 'Invalid sheet URL');
                return;
            }

            setSheetId(result.sheetId);
            setDetectedTabs(result.tabs);
        } catch (error) {
            setValidationError('Failed to validate sheet URL');
        } finally {
            setValidating(false);
        }
    };

    // Toggle tab selection
    const handleToggleTab = (tab: SheetTabInfo) => {
        const existing = selectedTabs.find(t => t.tab.gid === tab.gid);
        if (existing) {
            setSelectedTabs(selectedTabs.filter(t => t.tab.gid !== tab.gid));
        } else {
            // Auto-detect data type based on headers
            const dataType = detectDataType(tab.headers);
            // Auto-detect platform from tab name
            let platform = 'swiggy';
            const tabNameLower = tab.name.toLowerCase();
            if (tabNameLower.includes('zepto')) platform = 'zepto';
            else if (tabNameLower.includes('blinkit')) platform = 'blinkit';
            else if (tabNameLower.includes('instamart')) platform = 'instamart';
            else if (tabNameLower.includes('amazon')) platform = 'amazon';
            else if (tabNameLower.includes('flipkart')) platform = 'flipkart';

            setSelectedTabs([...selectedTabs, {
                tab,
                platform,
                dataType,
                name: `${platform}-${tab.name}`
            }]);
        }
    };

    // Select all tabs
    const handleSelectAll = () => {
        if (selectedTabs.length === detectedTabs.length) {
            setSelectedTabs([]);
        } else {
            const newSelected: SelectedTabConfig[] = detectedTabs.map(tab => {
                const dataType = detectDataType(tab.headers);
                let platform = 'swiggy';
                const tabNameLower = tab.name.toLowerCase();
                if (tabNameLower.includes('zepto')) platform = 'zepto';
                else if (tabNameLower.includes('blinkit')) platform = 'blinkit';
                else if (tabNameLower.includes('instamart')) platform = 'instamart';
                else if (tabNameLower.includes('amazon')) platform = 'amazon';
                else if (tabNameLower.includes('flipkart')) platform = 'flipkart';

                return {
                    tab,
                    platform,
                    dataType,
                    name: `${platform}-${tab.name}`
                };
            });
            setSelectedTabs(newSelected);
        }
    };

    // Update config for a selected tab
    const updateTabConfig = (gid: string, field: 'platform' | 'dataType' | 'name', value: string) => {
        setSelectedTabs(selectedTabs.map(t =>
            t.tab.gid === gid
                ? { ...t, [field]: value }
                : t
        ));
    };

    // Load preview for a tab
    const handlePreviewTab = async (tab: SheetTabInfo) => {
        setPreviewTab(tab);
        if (sheetId) {
            try {
                const previewData = await fetchSheetPreview(sheetId, tab.name, tab.gid);
                setPreview(previewData);
            } catch (error) {
                console.error('Failed to load preview:', error);
            }
        }
    };

    // Add all selected tabs
    const handleAddAll = async () => {
        if (selectedTabs.length === 0 || !sheetId) return;

        setAdding(true);
        try {
            for (const config of selectedTabs) {
                await add({
                    name: config.name,
                    sheet_id: sheetId,
                    sheet_url: newUrl,
                    platform: config.platform,
                    data_type: config.dataType,
                    tab_name: config.tab.name,
                    tab_gid: config.tab.gid,
                    is_active: true,
                    last_synced_at: null,
                });
            }

            // Reset form
            setShowAddForm(false);
            setNewUrl('');
            setDetectedTabs([]);
            setSelectedTabs([]);
            setPreview(null);
            setPreviewTab(null);
            setSheetId(null);
        } catch (error) {
            console.error('Failed to add data sources:', error);
        } finally {
            setAdding(false);
        }
    };

    // Handle delete
    const handleDelete = async (id: string) => {
        if (confirm('Are you sure you want to delete this data source?')) {
            await remove(id);
        }
    };

    // Handle sync single source
    const handleSyncOne = async (id: string) => {
        await syncOne(id);
        await refresh();
    };

    // Toggle group collapse
    const toggleGroupCollapse = (sheetId: string) => {
        const newCollapsed = new Set(collapsedGroups);
        if (newCollapsed.has(sheetId)) {
            newCollapsed.delete(sheetId);
        } else {
            newCollapsed.add(sheetId);
        }
        setCollapsedGroups(newCollapsed);
    };

    // Group sources by sheet_id
    const groupedSources = sources.reduce((acc, source) => {
        const key = source.sheet_id;
        if (!acc[key]) {
            acc[key] = [];
        }
        acc[key].push(source);
        return acc;
    }, {} as Record<string, typeof sources>);

    const isTabSelected = (gid: string) => selectedTabs.some(t => t.tab.gid === gid);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Data Sources</h1>
                    <p className="text-[var(--text-muted)] mt-1">
                        Manage your Google Sheet connections
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => syncAllWithQuery()}
                        disabled={isSyncing || sources.length === 0}
                        className="btn-primary flex items-center gap-2"
                        title="Sync using Google Query API"
                    >
                        <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Syncing...' : 'Sync All'}
                    </button>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Source
                    </button>
                </div>
            </div>

            {/* Add Form Modal */}
            {showAddForm && (
                <div className="modal-overlay" onClick={() => setShowAddForm(false)}>
                    <div className="modal-content max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-6">Add Data Sources</h2>

                        {/* Step 1: Enter URL */}
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium mb-2">Google Sheet URL</label>
                                <div className="flex gap-2">
                                    <input
                                        type="url"
                                        value={newUrl}
                                        onChange={(e) => setNewUrl(e.target.value)}
                                        placeholder="https://docs.google.com/spreadsheets/d/..."
                                        className="input-field flex-1"
                                    />
                                    <button
                                        onClick={handleValidateUrl}
                                        disabled={validating || !newUrl.trim()}
                                        className="btn-primary"
                                    >
                                        {validating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Validate'}
                                    </button>
                                </div>
                                {validationError && (
                                    <p className="text-red-500 text-sm mt-2 flex items-center gap-1">
                                        <AlertCircle className="w-4 h-4" />
                                        {validationError}
                                    </p>
                                )}
                            </div>

                            {/* Step 2: Select Tabs (Multi-select) */}
                            {detectedTabs.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="block text-sm font-medium">
                                            Select Tabs ({selectedTabs.length} of {detectedTabs.length} selected)
                                        </label>
                                        <button
                                            onClick={handleSelectAll}
                                            className="text-sm text-[var(--primary)] hover:underline"
                                        >
                                            {selectedTabs.length === detectedTabs.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2 max-h-60 overflow-y-auto p-1">
                                        {detectedTabs.map((tab) => (
                                            <div
                                                key={tab.gid}
                                                className={`p-3 rounded-lg border text-left transition-all cursor-pointer relative ${isTabSelected(tab.gid)
                                                        ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                                        : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                                                    }`}
                                                onClick={() => handleToggleTab(tab)}
                                            >
                                                <div className="flex items-start gap-2">
                                                    <div className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${isTabSelected(tab.gid)
                                                            ? 'border-[var(--primary)] bg-[var(--primary)]'
                                                            : 'border-[var(--border)]'
                                                        }`}>
                                                        {isTabSelected(tab.gid) && <Check className="w-3 h-3 text-white" />}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-medium truncate">{tab.name}</p>
                                                        <p className="text-xs text-[var(--text-muted)]">
                                                            {tab.rowCount} rows • {tab.headers.length} cols
                                                        </p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        handlePreviewTab(tab);
                                                    }}
                                                    className="absolute top-2 right-2 p-1 rounded hover:bg-[var(--bg-secondary)] text-[var(--text-muted)]"
                                                    title="Preview"
                                                >
                                                    <Eye className="w-3 h-3" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Configure Selected Tabs */}
                            {selectedTabs.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Configure Selected Tabs
                                    </label>
                                    <div className="space-y-2 max-h-60 overflow-y-auto">
                                        {selectedTabs.map((config) => (
                                            <div
                                                key={config.tab.gid}
                                                className="flex items-center gap-2 p-2 rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)]"
                                            >
                                                <FileSpreadsheet className="w-4 h-4 text-[var(--primary)] flex-shrink-0" />
                                                <span className="font-medium text-sm truncate w-32" title={config.tab.name}>
                                                    {config.tab.name}
                                                </span>
                                                <select
                                                    value={config.platform}
                                                    onChange={(e) => updateTabConfig(config.tab.gid, 'platform', e.target.value)}
                                                    className="select-field text-xs py-1 flex-shrink-0"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    {PLATFORMS.map((p) => (
                                                        <option key={p.value} value={p.value}>
                                                            {p.label}
                                                        </option>
                                                    ))}
                                                </select>
                                                <select
                                                    value={config.dataType}
                                                    onChange={(e) => updateTabConfig(config.tab.gid, 'dataType', e.target.value)}
                                                    className="select-field text-xs py-1 flex-shrink-0"
                                                    onClick={e => e.stopPropagation()}
                                                >
                                                    <option value="ads">Ads</option>
                                                    <option value="sales">Sales</option>
                                                </select>
                                                <button
                                                    onClick={() => handleToggleTab(config.tab)}
                                                    className="p-1 rounded hover:bg-red-500/10 text-red-500"
                                                    title="Remove"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Preview */}
                            {preview && previewTab && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Preview: {previewTab.name} (first {preview.rows.length} rows)
                                    </label>
                                    <div className="overflow-x-auto max-h-48 rounded-lg border border-[var(--border)]">
                                        <table className="data-table text-xs">
                                            <thead>
                                                <tr>
                                                    {preview.headers.map((h, i) => (
                                                        <th key={i} className="whitespace-nowrap">{h}</th>
                                                    ))}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {preview.rows.map((row, ri) => (
                                                    <tr key={ri}>
                                                        {row.map((cell, ci) => (
                                                            <td key={ci} className="whitespace-nowrap">{cell}</td>
                                                        ))}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Actions */}
                        <div className="flex justify-end gap-3 mt-8">
                            <button
                                onClick={() => setShowAddForm(false)}
                                className="btn-secondary"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddAll}
                                disabled={selectedTabs.length === 0 || adding}
                                className="btn-primary flex items-center gap-2"
                            >
                                {adding ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Adding...
                                    </>
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Add {selectedTabs.length} Source{selectedTabs.length !== 1 ? 's' : ''}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading && (
                <div className="glass rounded-2xl p-12 text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-[var(--primary)]" />
                    <p className="text-[var(--text-muted)]">Loading data sources...</p>
                </div>
            )}

            {/* Empty State */}
            {!isLoading && sources.length === 0 && (
                <div className="glass rounded-2xl p-12 text-center">
                    <div className="w-16 h-16 rounded-full bg-[var(--primary)]/20 flex items-center justify-center mx-auto mb-4">
                        <Database className="w-8 h-8 text-[var(--primary)]" />
                    </div>
                    <h2 className="text-xl font-semibold mb-2">No Data Sources</h2>
                    <p className="text-[var(--text-muted)] max-w-md mx-auto mb-6">
                        Connect your Google Sheets to start syncing ads and sales data.
                    </p>
                    <button
                        onClick={() => setShowAddForm(true)}
                        className="btn-primary inline-flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Add Your First Source
                    </button>
                </div>
            )}

            {/* Sources List - Grouped by Sheet */}
            {!isLoading && sources.length > 0 && (
                <div className="space-y-4">
                    {Object.entries(groupedSources).map(([sheetId, groupSources]) => {
                        const isCollapsed = collapsedGroups.has(sheetId);
                        const firstSource = groupSources[0];
                        const sheetName = firstSource.sheet_url.split('/d/')[1]?.split('/')[0] || sheetId;

                        return (
                            <div key={sheetId} className="glass rounded-xl overflow-hidden">
                                {/* Group Header */}
                                <div
                                    className="flex items-center justify-between p-4 cursor-pointer hover:bg-[var(--bg-secondary)]/50 transition-colors"
                                    onClick={() => toggleGroupCollapse(sheetId)}
                                >
                                    <div className="flex items-center gap-3">
                                        {isCollapsed ? (
                                            <ChevronRight className="w-5 h-5 text-[var(--text-muted)]" />
                                        ) : (
                                            <ChevronDown className="w-5 h-5 text-[var(--text-muted)]" />
                                        )}
                                        <div className="w-10 h-10 rounded-lg bg-[var(--primary)]/20 flex items-center justify-center">
                                            <Layers className="w-5 h-5 text-[var(--primary)]" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">Google Sheet</h3>
                                            <p className="text-xs text-[var(--text-muted)]">
                                                {groupSources.length} tab{groupSources.length !== 1 ? 's' : ''} connected
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={firstSource.sheet_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-secondary p-2"
                                            title="Open in Google Sheets"
                                            onClick={e => e.stopPropagation()}
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                    </div>
                                </div>

                                {/* Group Items */}
                                {!isCollapsed && (
                                    <div className="border-t border-[var(--border)]">
                                        {groupSources.map((source) => {
                                            const platform = PLATFORMS.find(p => p.value === source.platform);

                                            return (
                                                <div
                                                    key={source.id}
                                                    className={`flex items-center justify-between p-4 border-b border-[var(--border)] last:border-b-0 ${!source.is_active ? 'opacity-60' : ''}`}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div
                                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                                            style={{ background: `${platform?.color || '#8B5CF6'}20` }}
                                                        >
                                                            <FileSpreadsheet
                                                                className="w-5 h-5"
                                                                style={{ color: platform?.color || '#8B5CF6' }}
                                                            />
                                                        </div>
                                                        <div>
                                                            <h4 className="font-medium">{source.name}</h4>
                                                            <div className="flex items-center gap-2 mt-1">
                                                                <span
                                                                    className="badge text-xs"
                                                                    style={{
                                                                        background: `${platform?.color || '#8B5CF6'}20`,
                                                                        color: platform?.color || '#8B5CF6'
                                                                    }}
                                                                >
                                                                    {platform?.label || source.platform}
                                                                </span>
                                                                <span className={`badge text-xs ${source.data_type === 'ads' ? 'badge-primary' : 'badge-success'}`}>
                                                                    {source.data_type === 'ads' ? 'Ads' : 'Sales'}
                                                                </span>
                                                                {source.tab_name && (
                                                                    <span className="text-xs text-[var(--text-muted)]">
                                                                        Tab: {source.tab_name}
                                                                    </span>
                                                                )}
                                                            </div>
                                                            {source.last_synced_at && (
                                                                <p className="text-xs text-[var(--text-muted)] mt-1">
                                                                    Last synced: {new Date(source.last_synced_at).toLocaleString()}
                                                                </p>
                                                            )}
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            onClick={() => handleSyncOne(source.id)}
                                                            disabled={isSyncing}
                                                            className="btn-secondary p-2"
                                                            title="Sync this source"
                                                        >
                                                            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin' : ''}`} />
                                                        </button>
                                                        <button
                                                            onClick={() => toggleActive(source.id)}
                                                            className="btn-secondary p-2"
                                                            title={source.is_active ? 'Disable' : 'Enable'}
                                                        >
                                                            {source.is_active ? (
                                                                <Eye className="w-4 h-4" />
                                                            ) : (
                                                                <EyeOff className="w-4 h-4" />
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(source.id)}
                                                            className="btn-secondary p-2 text-red-500 hover:bg-red-500/10"
                                                            title="Delete"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
