'use client';

import { useState, useMemo, useRef } from 'react';
import {
    FileText, Download, Loader2, FileSpreadsheet, File, Filter, Layers, Calendar,
    TrendingUp, DollarSign, Eye, MousePointer, Target, BarChart3
} from 'lucide-react';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import DateRangePicker from '@/components/DateRangePicker';
import ChartCard from '@/components/ChartCard';
import { useMetrics } from '@/hooks/useMetrics';
import { formatNumber, aggregateToWeekly, aggregateToMonthly } from '@/lib/aggregation';

type ExportFormat = 'csv' | 'excel' | 'pdf';
type DataType = 'all' | 'ads' | 'sales';
type Aggregation = 'daily' | 'weekly' | 'monthly';

const COLORS = ['#8B5CF6', '#06B6D4', '#10B981', '#F59E0B', '#EC4899', '#EF4444'];

export default function ReportsPage() {
    const [dateRange, setDateRange] = useState(() => {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 30);
        return {
            start: start.toISOString().split('T')[0],
            end: end.toISOString().split('T')[0],
        };
    });
    const [exporting, setExporting] = useState<ExportFormat | null>(null);
    const [selectedPlatform, setSelectedPlatform] = useState<string>('all');
    const [selectedDataType, setSelectedDataType] = useState<DataType>('all');
    const [aggregation, setAggregation] = useState<Aggregation>('daily');
    const chartsRef = useRef<HTMLDivElement>(null);

    const { dailyMetrics, summary, platformMetrics, isLoading } = useMetrics({
        startDate: dateRange.start,
        endDate: dateRange.end,
    });

    // Get unique platforms
    const platforms = useMemo(() => {
        const unique = [...new Set(dailyMetrics.map(m => m.platform))];
        return unique.sort();
    }, [dailyMetrics]);

    // Filter metrics based on selections
    const filteredMetrics = useMemo(() => {
        let filtered = dailyMetrics;

        // Filter by date range (client-side safety)
        filtered = filtered.filter(m => m.date >= dateRange.start && m.date <= dateRange.end);

        // Filter by platform
        if (selectedPlatform !== 'all') {
            filtered = filtered.filter(m => m.platform === selectedPlatform);
        }

        // Filter by data type
        if (selectedDataType !== 'all') {
            filtered = filtered.filter(m => m.data_type === selectedDataType);
        }

        return filtered.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    }, [dailyMetrics, selectedPlatform, selectedDataType, dateRange]);

    // Aggregated data for charts
    const aggregatedData = useMemo(() => {
        if (aggregation === 'weekly') {
            return aggregateToWeekly(filteredMetrics).map(w => ({
                label: `${new Date(w.weekStart).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}`,
                spend: w.totalSpend,
                sales: w.totalSales,
                impressions: w.totalImpressions,
                clicks: w.totalClicks,
                roas: w.roas,
            }));
        } else if (aggregation === 'monthly') {
            return aggregateToMonthly(filteredMetrics).map(m => ({
                label: m.monthLabel,
                spend: m.totalSpend,
                sales: m.totalSales,
                impressions: m.totalImpressions,
                clicks: m.totalClicks,
                roas: m.roas,
            }));
        }
        return filteredMetrics.map(d => ({
            label: new Date(d.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' }),
            spend: Number(d.total_spend),
            sales: Number(d.total_sales),
            impressions: Number(d.total_impressions),
            clicks: Number(d.total_clicks),
            roas: Number(d.roas),
        }));
    }, [filteredMetrics, aggregation]);

    // Filtered summary
    const filteredSummary = useMemo(() => {
        const totalSpend = filteredMetrics.reduce((sum, m) => sum + Number(m.total_spend), 0);
        const totalSales = filteredMetrics.reduce((sum, m) => sum + Number(m.total_sales), 0);
        const totalImpressions = filteredMetrics.reduce((sum, m) => sum + Number(m.total_impressions), 0);
        const totalClicks = filteredMetrics.reduce((sum, m) => sum + Number(m.total_clicks), 0);
        const avgCtr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
        const avgRoas = totalSpend > 0 ? totalSales / totalSpend : 0;
        const avgCpi = totalImpressions > 0 ? totalSpend / totalImpressions : 0;

        return { totalSpend, totalSales, totalImpressions, totalClicks, avgCtr, avgRoas, avgCpi };
    }, [filteredMetrics]);

    // Platform distribution for pie chart
    const platformDistribution = useMemo(() => {
        const byPlatform: Record<string, number> = {};
        filteredMetrics.forEach(m => {
            byPlatform[m.platform] = (byPlatform[m.platform] || 0) + Number(m.total_spend);
        });
        return Object.entries(byPlatform).map(([name, value], i) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value,
            color: COLORS[i % COLORS.length],
        }));
    }, [filteredMetrics]);

    // Export to CSV
    const exportToCsv = () => {
        setExporting('csv');
        const headers = ['Date', 'Platform', 'Type', 'Spend', 'Impressions', 'Clicks', 'Sales', 'CPI', 'CTR%', 'ROAS'];
        const rows = filteredMetrics.map(m => [
            m.date, m.platform, m.data_type, m.total_spend, m.total_impressions,
            m.total_clicks, m.total_sales, m.cpi.toFixed(6), m.ctr.toFixed(2), m.roas.toFixed(2),
        ]);
        const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `analytics_report_${dateRange.start}_${dateRange.end}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        setExporting(null);
    };

    // Export to Excel
    const exportToExcel = async () => {
        setExporting('excel');
        try {
            const XLSX = await import('xlsx');
            const data = filteredMetrics.map(m => ({
                Date: m.date, Platform: m.platform, Type: m.data_type,
                Spend: m.total_spend, Impressions: m.total_impressions,
                Clicks: m.total_clicks, Sales: m.total_sales,
                CPI: m.cpi, 'CTR%': m.ctr, ROAS: m.roas,
            }));
            const ws = XLSX.utils.json_to_sheet(data);
            const wb = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(wb, ws, 'Daily Metrics');

            // Summary sheet
            const summaryData = [
                { Metric: 'Total Spend', Value: filteredSummary.totalSpend },
                { Metric: 'Total Sales', Value: filteredSummary.totalSales },
                { Metric: 'Total Impressions', Value: filteredSummary.totalImpressions },
                { Metric: 'Total Clicks', Value: filteredSummary.totalClicks },
                { Metric: 'Average CTR%', Value: filteredSummary.avgCtr },
                { Metric: 'Average ROAS', Value: filteredSummary.avgRoas },
            ];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');

            // Platform sheet
            const platformData = platformDistribution.map(p => ({
                Platform: p.name, Spend: p.value,
                'Share %': ((p.value / filteredSummary.totalSpend) * 100).toFixed(1),
            }));
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(platformData), 'By Platform');

            XLSX.writeFile(wb, `analytics_report_${dateRange.start}_${dateRange.end}.xlsx`);
        } catch (error) {
            console.error('Excel export failed:', error);
        }
        setExporting(null);
    };

    // Export to PDF with detailed analysis
    const exportToPdf = async () => {
        setExporting('pdf');
        try {
            const jsPDF = (await import('jspdf')).default;
            const doc = new jsPDF('p', 'mm', 'a4');
            let yPos = 20;

            // Helper function
            const addSection = (title: string, yOffset: number = 15) => {
                yPos += yOffset;
                if (yPos > 270) { doc.addPage(); yPos = 20; }
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.text(title, 20, yPos);
                doc.setFont('helvetica', 'normal');
                yPos += 8;
            };

            const addLine = (text: string, indent: number = 20) => {
                if (yPos > 280) { doc.addPage(); yPos = 20; }
                doc.setFontSize(10);
                doc.text(text, indent, yPos);
                yPos += 6;
            };

            // Title
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('Analytics Report', 20, yPos);
            yPos += 10;
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
            doc.text(`Period: ${dateRange.start} to ${dateRange.end}`, 20, yPos);
            yPos += 5;
            doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, 20, yPos);

            // Filters Applied
            addSection('Report Filters');
            addLine(`Platform: ${selectedPlatform === 'all' ? 'All Platforms' : selectedPlatform}`);
            addLine(`Data Type: ${selectedDataType === 'all' ? 'Ads + Sales' : selectedDataType.toUpperCase()}`);
            addLine(`Aggregation: ${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)}`);
            addLine(`Total Records: ${filteredMetrics.length}`);

            // Executive Summary
            addSection('Executive Summary');
            addLine(`Total Ad Spend: ${formatNumber(filteredSummary.totalSpend, 'currency')}`);
            addLine(`Total Revenue: ${formatNumber(filteredSummary.totalSales, 'currency')}`);
            addLine(`Return on Ad Spend (ROAS): ${filteredSummary.avgRoas.toFixed(2)}x`);
            addLine(`Total Impressions: ${formatNumber(filteredSummary.totalImpressions)}`);
            addLine(`Total Clicks: ${formatNumber(filteredSummary.totalClicks)}`);
            addLine(`Click-Through Rate: ${filteredSummary.avgCtr.toFixed(2)}%`);
            addLine(`Cost Per Impression: ₹${filteredSummary.avgCpi.toFixed(4)}`);

            // Performance Analysis
            addSection('Performance Analysis');
            const profitMargin = filteredSummary.totalSpend > 0
                ? ((filteredSummary.totalSales - filteredSummary.totalSpend) / filteredSummary.totalSpend) * 100
                : 0;
            addLine(`Profit Margin: ${profitMargin.toFixed(1)}%`);
            if (filteredSummary.avgRoas >= 2) {
                addLine('✓ Excellent ROAS - campaigns are highly profitable');
            } else if (filteredSummary.avgRoas >= 1) {
                addLine('◐ Moderate ROAS - campaigns are breaking even or slightly profitable');
            } else {
                addLine('✗ Low ROAS - campaigns may need optimization');
            }
            if (filteredSummary.avgCtr >= 2) {
                addLine('✓ Strong CTR - ads are engaging well');
            } else if (filteredSummary.avgCtr >= 0.5) {
                addLine('◐ Average CTR - room for improvement');
            } else {
                addLine('✗ Low CTR - consider revising ad creatives');
            }

            // Platform Breakdown
            addSection('Platform Breakdown');
            doc.setFontSize(9);
            platformDistribution.forEach(p => {
                const share = ((p.value / filteredSummary.totalSpend) * 100).toFixed(1);
                addLine(`${p.name}: ${formatNumber(p.value, 'currency')} (${share}% of spend)`);
            });

            // Daily/Weekly Performance Table
            addSection(`${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} Performance`);
            doc.setFontSize(8);

            // Table header
            const tableX = 20;
            doc.setFont('helvetica', 'bold');
            doc.text('Period', tableX, yPos);
            doc.text('Spend', tableX + 35, yPos);
            doc.text('Sales', tableX + 60, yPos);
            doc.text('ROAS', tableX + 85, yPos);
            doc.text('Impressions', tableX + 105, yPos);
            doc.text('CTR%', tableX + 135, yPos);
            doc.setFont('helvetica', 'normal');
            yPos += 5;

            // Table rows (limit to 20 for PDF)
            aggregatedData.slice(0, 20).forEach(row => {
                if (yPos > 280) { doc.addPage(); yPos = 20; }
                doc.text(row.label, tableX, yPos);
                doc.text(`₹${row.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, tableX + 35, yPos);
                doc.text(`₹${row.sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`, tableX + 60, yPos);
                doc.text(`${row.roas.toFixed(2)}x`, tableX + 85, yPos);
                doc.text(row.impressions.toLocaleString('en-IN'), tableX + 105, yPos);
                const ctr = row.impressions > 0 ? ((row.clicks / row.impressions) * 100).toFixed(2) : '0.00';
                doc.text(`${ctr}%`, tableX + 135, yPos);
                yPos += 5;
            });

            if (aggregatedData.length > 20) {
                yPos += 3;
                addLine(`... and ${aggregatedData.length - 20} more records (see CSV/Excel for full data)`);
            }

            // Recommendations
            addSection('Recommendations', 20);
            if (filteredSummary.avgRoas < 1) {
                addLine('• Review underperforming campaigns and pause or optimize them');
                addLine('• Consider adjusting targeting parameters');
            }
            if (filteredSummary.avgCtr < 1) {
                addLine('• Test new ad creatives and copy');
                addLine('• Review audience targeting for relevance');
            }
            if (platformDistribution.length > 1) {
                const bestPlatform = platformDistribution.reduce((a, b) => a.value > b.value ? a : b);
                addLine(`• ${bestPlatform.name} has the highest spend - monitor ROI closely`);
            }
            addLine('• Continue monitoring daily metrics for trends');

            // Footer
            doc.setFontSize(8);
            doc.text('Generated by Joyspoon Analytics Dashboard', 20, 290);

            doc.save(`analytics_report_${dateRange.start}_${dateRange.end}.pdf`);
        } catch (error) {
            console.error('PDF export failed:', error);
        }
        setExporting(null);
    };

    const exportFormats = [
        { id: 'csv' as ExportFormat, label: 'CSV', description: 'Raw data for spreadsheets', icon: FileSpreadsheet, action: exportToCsv },
        { id: 'excel' as ExportFormat, label: 'Excel', description: 'Multi-sheet workbook', icon: FileSpreadsheet, action: exportToExcel },
        { id: 'pdf' as ExportFormat, label: 'PDF Report', description: 'Detailed analysis report', icon: File, action: exportToPdf },
    ];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Page Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold">Reports</h1>
                    <p className="text-[var(--text-muted)] mt-1">Filter, analyze, and export your data</p>
                </div>
                <DateRangePicker
                    onRangeChange={(start, end) => setDateRange({
                        start: start.toISOString().split('T')[0],
                        end: end.toISOString().split('T')[0],
                    })}
                />
            </div>

            {/* Filters */}
            <div className="glass rounded-xl p-4 animate-slide-up">
                <div className="flex items-center gap-2 mb-3">
                    <Filter className="w-4 h-4 text-[var(--primary)]" />
                    <h3 className="font-medium">Filters</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Platform Filter */}
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Platform</label>
                        <select
                            value={selectedPlatform}
                            onChange={(e) => setSelectedPlatform(e.target.value)}
                            className="select-field w-full"
                        >
                            <option value="all">All Platforms</option>
                            {platforms.map(p => (
                                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                            ))}
                        </select>
                    </div>

                    {/* Data Type Filter */}
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Data Type</label>
                        <select
                            value={selectedDataType}
                            onChange={(e) => setSelectedDataType(e.target.value as DataType)}
                            className="select-field w-full"
                        >
                            <option value="all">All Data</option>
                            <option value="ads">Ads Only</option>
                            <option value="sales">Sales Only</option>
                        </select>
                    </div>

                    {/* Aggregation */}
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Aggregation</label>
                        <select
                            value={aggregation}
                            onChange={(e) => setAggregation(e.target.value as Aggregation)}
                            className="select-field w-full"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                <div className="glass rounded-lg p-3 animate-slide-up stagger-1">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                        <DollarSign className="w-3.5 h-3.5" />
                        <span className="text-xs">Spend</span>
                    </div>
                    <p className="text-lg font-bold">{formatNumber(filteredSummary.totalSpend, 'currency')}</p>
                </div>
                <div className="glass rounded-lg p-3 animate-slide-up stagger-2">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                        <TrendingUp className="w-3.5 h-3.5" />
                        <span className="text-xs">Sales</span>
                    </div>
                    <p className="text-lg font-bold">{formatNumber(filteredSummary.totalSales, 'currency')}</p>
                </div>
                <div className="glass rounded-lg p-3 animate-slide-up stagger-3">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                        <Target className="w-3.5 h-3.5" />
                        <span className="text-xs">ROAS</span>
                    </div>
                    <p className="text-lg font-bold">{filteredSummary.avgRoas.toFixed(2)}x</p>
                </div>
                <div className="glass rounded-lg p-3 animate-slide-up stagger-4">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                        <Eye className="w-3.5 h-3.5" />
                        <span className="text-xs">Impressions</span>
                    </div>
                    <p className="text-lg font-bold">{formatNumber(filteredSummary.totalImpressions)}</p>
                </div>
                <div className="glass rounded-lg p-3 animate-slide-up stagger-5">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                        <MousePointer className="w-3.5 h-3.5" />
                        <span className="text-xs">Clicks</span>
                    </div>
                    <p className="text-lg font-bold">{formatNumber(filteredSummary.totalClicks)}</p>
                </div>
                <div className="glass rounded-lg p-3 animate-slide-up stagger-6">
                    <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                        <BarChart3 className="w-3.5 h-3.5" />
                        <span className="text-xs">CTR</span>
                    </div>
                    <p className="text-lg font-bold">{filteredSummary.avgCtr.toFixed(2)}%</p>
                </div>
            </div>

            {/* Charts Preview */}
            <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Spend vs Sales Chart */}
                <ChartCard title="Spend vs Sales Trend" subtitle={`${aggregation} view`}>
                    <div className="h-64">
                        {aggregatedData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={aggregatedData}>
                                    <defs>
                                        <linearGradient id="spendG" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="salesG" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                                    <XAxis dataKey="label" stroke="var(--text-muted)" fontSize={10} />
                                    <YAxis stroke="var(--text-muted)" fontSize={10} />
                                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '8px' }} />
                                    <Legend />
                                    <Area type="monotone" dataKey="spend" name="Spend" stroke="#8B5CF6" fill="url(#spendG)" />
                                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#10B981" fill="url(#salesG)" />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--text-muted)]">No data</div>
                        )}
                    </div>
                </ChartCard>

                {/* Platform Distribution */}
                <ChartCard title="Spend by Platform" subtitle="Distribution">
                    <div className="h-64">
                        {platformDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={platformDistribution}
                                        cx="50%" cy="50%"
                                        innerRadius={50} outerRadius={80}
                                        paddingAngle={5} dataKey="value"
                                    >
                                        {platformDistribution.map((entry, i) => (
                                            <Cell key={i} fill={entry.color} />
                                        ))}
                                    </Pie>
                                    <Tooltip formatter={(v) => formatNumber(Number(v), 'currency')} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-[var(--text-muted)]">No data</div>
                        )}
                    </div>
                </ChartCard>
            </div>

            {/* Export Options */}
            <div className="grid md:grid-cols-3 gap-4">
                {exportFormats.map((format, index) => (
                    <div key={format.id} className={`glass rounded-xl p-5 card-hover animate-slide-up stagger-${index + 1}`}>
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-lg bg-[var(--primary-subtle)] flex items-center justify-center">
                                <format.icon className="w-5 h-5 text-[var(--primary)]" />
                            </div>
                            <div>
                                <h3 className="font-semibold">{format.label}</h3>
                                <p className="text-sm text-[var(--text-muted)]">{format.description}</p>
                            </div>
                        </div>
                        <button
                            onClick={format.action}
                            disabled={exporting !== null || isLoading || filteredMetrics.length === 0}
                            className="btn-primary w-full flex items-center justify-center gap-2"
                        >
                            {exporting === format.id ? (
                                <><Loader2 className="w-4 h-4 animate-spin" /> Exporting...</>
                            ) : (
                                <><Download className="w-4 h-4" /> Export {format.label}</>
                            )}
                        </button>
                    </div>
                ))}
            </div>

            {/* Data Count */}
            <p className="text-center text-[var(--text-muted)] text-sm">
                {isLoading ? 'Loading...' : `${filteredMetrics.length} records • ${dateRange.start} to ${dateRange.end}`}
            </p>
        </div>
    );
}
