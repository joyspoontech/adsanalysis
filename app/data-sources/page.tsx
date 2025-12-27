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

export default function DataSourcesPage() {
    const { sources, isLoading, add, remove, toggleActive, refresh } = useDataSources();
    const { isSyncing, syncOne, syncAll, syncAllWithQuery } = useSync();

    // Add new source state
    const [showAddForm, setShowAddForm] = useState(false);
    const [newUrl, setNewUrl] = useState('');
    const [newName, setNewName] = useState('');
    const [validating, setValidating] = useState(false);
    const [validationError, setValidationError] = useState<string | null>(null);
    const [detectedTabs, setDetectedTabs] = useState<SheetTabInfo[]>([]);
    const [selectedTab, setSelectedTab] = useState<SheetTabInfo | null>(null);
    const [selectedPlatform, setSelectedPlatform] = useState('swiggy');
    const [selectedDataType, setSelectedDataType] = useState<'ads' | 'sales'>('ads');
    const [preview, setPreview] = useState<PreviewData | null>(null);
    const [adding, setAdding] = useState(false);
    const [sheetId, setSheetId] = useState<string | null>(null);

    // Validate URL and detect tabs
    const handleValidateUrl = async () => {
        if (!newUrl.trim()) return;

        setValidating(true);
        setValidationError(null);
        setDetectedTabs([]);
        setSelectedTab(null);
        setPreview(null);

        try {
            const result = await validateSheetUrl(newUrl);

            if (!result.valid) {
                setValidationError(result.error || 'Invalid sheet URL');
                return;
            }

            setSheetId(result.sheetId);
            setDetectedTabs(result.tabs);

            if (result.tabs.length > 0) {
                setSelectedTab(result.tabs[0]);
                // Auto-detect data type
                const dataType = detectDataType(result.tabs[0].headers);
                setSelectedDataType(dataType);
            }
        } catch (error) {
            setValidationError('Failed to validate sheet URL');
        } finally {
            setValidating(false);
        }
    };

    // Load preview for selected tab
    const handleTabSelect = async (tab: SheetTabInfo) => {
        setSelectedTab(tab);

        // Auto-detect data type
        const dataType = detectDataType(tab.headers);
        setSelectedDataType(dataType);

        // Load preview
        if (sheetId) {
            try {
                const previewData = await fetchSheetPreview(sheetId, tab.name, tab.gid);
                setPreview(previewData);
            } catch (error) {
                console.error('Failed to load preview:', error);
            }
        }
    };

    // Add new data source
    const handleAdd = async () => {
        if (!selectedTab || !sheetId) return;

        setAdding(true);
        try {
            await add({
                name: newName || `${selectedPlatform}-${selectedDataType}`,
                sheet_id: sheetId,
                sheet_url: newUrl,
                platform: selectedPlatform,
                data_type: selectedDataType,
                tab_name: selectedTab.name,
                tab_gid: selectedTab.gid,
                is_active: true,
                last_synced_at: null,
            });

            // Reset form
            setShowAddForm(false);
            setNewUrl('');
            setNewName('');
            setDetectedTabs([]);
            setSelectedTab(null);
            setPreview(null);
            setSheetId(null);
        } catch (error) {
            console.error('Failed to add data source:', error);
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
                    <div className="modal-content max-w-2xl" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-6">Add Data Source</h2>

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

                            {/* Step 2: Select Tab */}
                            {detectedTabs.length > 0 && (
                                <div>
                                    <label className="block text-sm font-medium mb-2">
                                        Select Tab ({detectedTabs.length} found)
                                    </label>
                                    <div className="grid grid-cols-2 gap-2">
                                        {detectedTabs.map((tab) => (
                                            <button
                                                key={tab.gid}
                                                onClick={() => handleTabSelect(tab)}
                                                className={`p-3 rounded-lg border text-left transition-all ${selectedTab?.gid === tab.gid
                                                    ? 'border-[var(--primary)] bg-[var(--primary)]/10'
                                                    : 'border-[var(--border)] hover:border-[var(--primary)]/50'
                                                    }`}
                                            >
                                                <p className="font-medium">{tab.name}</p>
                                                <p className="text-xs text-[var(--text-muted)]">
                                                    {tab.rowCount} rows • {tab.headers.length} columns
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Step 3: Configure */}
                            {selectedTab && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Platform</label>
                                            <select
                                                value={selectedPlatform}
                                                onChange={(e) => setSelectedPlatform(e.target.value)}
                                                className="select-field"
                                            >
                                                {PLATFORMS.map((p) => (
                                                    <option key={p.value} value={p.value}>
                                                        {p.label}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Data Type</label>
                                            <select
                                                value={selectedDataType}
                                                onChange={(e) => setSelectedDataType(e.target.value as 'ads' | 'sales')}
                                                className="select-field"
                                            >
                                                <option value="ads">Ads Data</option>
                                                <option value="sales">Sales Data</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium mb-2">Source Name (optional)</label>
                                        <input
                                            type="text"
                                            value={newName}
                                            onChange={(e) => setNewName(e.target.value)}
                                            placeholder={`${selectedPlatform}-${selectedDataType}`}
                                            className="input-field"
                                        />
                                    </div>

                                    {/* Preview */}
                                    {preview && preview.headers.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium mb-2">
                                                Preview (first {preview.rows.length} rows)
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

                                    {/* Column Mappings Suggestion */}
                                    {selectedTab.headers.length > 0 && (
                                        <div>
                                            <label className="block text-sm font-medium mb-2">Detected Columns</label>
                                            <div className="flex flex-wrap gap-2">
                                                {suggestMappings(selectedTab.headers).slice(0, 10).map((mapping, i) => (
                                                    <span
                                                        key={i}
                                                        className={`badge ${mapping.confidence === 'high' ? 'badge-success' :
                                                            mapping.confidence === 'medium' ? 'badge-warning' : 'badge-primary'
                                                            }`}
                                                    >
                                                        {mapping.source} → {mapping.target}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </>
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
                                onClick={handleAdd}
                                disabled={!selectedTab || adding}
                                className="btn-primary"
                            >
                                {adding ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin mr-2" />
                                        Adding...
                                    </>
                                ) : (
                                    'Add Source'
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

            {/* Sources List */}
            {!isLoading && sources.length > 0 && (
                <div className="grid gap-4">
                    {sources.map((source) => {
                        const platform = PLATFORMS.find(p => p.value === source.platform);

                        return (
                            <div
                                key={source.id}
                                className={`glass rounded-xl p-6 ${!source.is_active ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex items-start gap-4">
                                        <div
                                            className="w-12 h-12 rounded-xl flex items-center justify-center"
                                            style={{ background: `${platform?.color || '#8B5CF6'}20` }}
                                        >
                                            <FileSpreadsheet
                                                className="w-6 h-6"
                                                style={{ color: platform?.color || '#8B5CF6' }}
                                            />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-lg">{source.name}</h3>
                                            <div className="flex items-center gap-3 mt-1">
                                                <span
                                                    className="badge"
                                                    style={{
                                                        background: `${platform?.color || '#8B5CF6'}20`,
                                                        color: platform?.color || '#8B5CF6'
                                                    }}
                                                >
                                                    {platform?.label || source.platform}
                                                </span>
                                                <span className={`badge ${source.data_type === 'ads' ? 'badge-primary' : 'badge-success'}`}>
                                                    {source.data_type === 'ads' ? 'Ads' : 'Sales'}
                                                </span>
                                                {source.tab_name && (
                                                    <span className="text-sm text-[var(--text-muted)]">
                                                        Tab: {source.tab_name}
                                                    </span>
                                                )}
                                            </div>
                                            {source.last_synced_at && (
                                                <p className="text-xs text-[var(--text-muted)] mt-2">
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
                                        <a
                                            href={source.sheet_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="btn-secondary p-2"
                                            title="Open in Google Sheets"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                        </a>
                                        <button
                                            onClick={() => handleDelete(source.id)}
                                            className="btn-secondary p-2 text-red-500 hover:bg-red-500/10"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
