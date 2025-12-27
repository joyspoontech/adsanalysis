'use client';

import { useState, useMemo, useRef } from 'react';
import {
    FileText, Download, Loader2, FileSpreadsheet, File, Filter, Layers, Calendar,
    TrendingUp, DollarSign, Eye, MousePointer, Target, BarChart3, CheckCircle, AlertCircle
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
    const [exportProgress, setExportProgress] = useState<string>('');

    // Refs for chart capture
    const trendChartRef = useRef<HTMLDivElement>(null);
    const pieChartRef = useRef<HTMLDivElement>(null);
    const barChartRef = useRef<HTMLDivElement>(null);

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
        filtered = filtered.filter(m => m.date >= dateRange.start && m.date <= dateRange.end);
        if (selectedPlatform !== 'all') {
            filtered = filtered.filter(m => m.platform === selectedPlatform);
        }
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

    // Platform distribution
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

    // ROAS by platform for bar chart
    const roasByPlatform = useMemo(() => {
        const byPlatform: Record<string, { spend: number; sales: number }> = {};
        filteredMetrics.forEach(m => {
            if (!byPlatform[m.platform]) {
                byPlatform[m.platform] = { spend: 0, sales: 0 };
            }
            byPlatform[m.platform].spend += Number(m.total_spend);
            byPlatform[m.platform].sales += Number(m.total_sales);
        });
        return Object.entries(byPlatform).map(([name, data], i) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            roas: data.spend > 0 ? data.sales / data.spend : 0,
            spend: data.spend,
            sales: data.sales,
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

            const summaryData = [
                { Metric: 'Total Spend', Value: filteredSummary.totalSpend },
                { Metric: 'Total Sales', Value: filteredSummary.totalSales },
                { Metric: 'Total Impressions', Value: filteredSummary.totalImpressions },
                { Metric: 'Total Clicks', Value: filteredSummary.totalClicks },
                { Metric: 'Average CTR%', Value: filteredSummary.avgCtr },
                { Metric: 'Average ROAS', Value: filteredSummary.avgRoas },
            ];
            XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), 'Summary');

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

    // Export to PDF with Charts
    const exportToPdf = async () => {
        setExporting('pdf');
        setExportProgress('Initializing...');

        try {
            // Dynamic imports
            const [{ default: jsPDF }, { default: html2canvas }, autoTableModule] = await Promise.all([
                import('jspdf'),
                import('html2canvas'),
                import('jspdf-autotable'),
            ]);

            const doc = new jsPDF('p', 'mm', 'a4');
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            let yPos = 15;

            // Colors
            const primaryColor: [number, number, number] = [139, 92, 246]; // Purple
            const successColor: [number, number, number] = [16, 185, 129]; // Green
            const textColor: [number, number, number] = [30, 30, 30];
            const mutedColor: [number, number, number] = [100, 100, 100];

            // Header with gradient-like effect
            doc.setFillColor(...primaryColor);
            doc.rect(0, 0, pageWidth, 35, 'F');

            doc.setTextColor(255, 255, 255);
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('Analytics Report', 15, 18);

            doc.setFontSize(11);
            doc.setFont('helvetica', 'normal');
            doc.text(`${dateRange.start} to ${dateRange.end}`, 15, 28);
            doc.text(`Generated: ${new Date().toLocaleString('en-IN')}`, pageWidth - 15, 28, { align: 'right' });

            yPos = 45;
            doc.setTextColor(...textColor);

            // Filters Applied Section
            doc.setFontSize(12);
            doc.setFont('helvetica', 'bold');
            doc.text('Report Configuration', 15, yPos);
            yPos += 6;

            doc.setFontSize(9);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...mutedColor);
            const filterText = `Platform: ${selectedPlatform === 'all' ? 'All' : selectedPlatform} | Data Type: ${selectedDataType === 'all' ? 'All' : selectedDataType.toUpperCase()} | View: ${aggregation} | Records: ${filteredMetrics.length}`;
            doc.text(filterText, 15, yPos);
            yPos += 10;

            // Executive Summary Cards
            setExportProgress('Creating summary...');
            doc.setTextColor(...textColor);
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Executive Summary', 15, yPos);
            yPos += 8;

            // Summary boxes
            const boxWidth = (pageWidth - 40) / 3;
            const boxHeight = 22;
            const summaryItems = [
                { label: 'Total Spend', value: formatNumber(filteredSummary.totalSpend, 'currency'), color: primaryColor },
                { label: 'Total Sales', value: formatNumber(filteredSummary.totalSales, 'currency'), color: successColor },
                { label: 'ROAS', value: `${filteredSummary.avgRoas.toFixed(2)}x`, color: [245, 158, 11] as [number, number, number] },
                { label: 'Impressions', value: formatNumber(filteredSummary.totalImpressions), color: [6, 182, 212] as [number, number, number] },
                { label: 'Clicks', value: formatNumber(filteredSummary.totalClicks), color: [236, 72, 153] as [number, number, number] },
                { label: 'CTR', value: `${filteredSummary.avgCtr.toFixed(2)}%`, color: [239, 68, 68] as [number, number, number] },
            ];

            summaryItems.forEach((item, i) => {
                const row = Math.floor(i / 3);
                const col = i % 3;
                const x = 15 + col * (boxWidth + 5);
                const y = yPos + row * (boxHeight + 3);

                // Box with colored top border
                doc.setFillColor(248, 248, 252);
                doc.roundedRect(x, y, boxWidth, boxHeight, 2, 2, 'F');
                doc.setFillColor(...item.color);
                doc.rect(x, y, boxWidth, 2, 'F');

                doc.setFontSize(8);
                doc.setTextColor(...mutedColor);
                doc.text(item.label, x + 4, y + 8);
                doc.setFontSize(12);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...textColor);
                doc.text(item.value, x + 4, y + 17);
                doc.setFont('helvetica', 'normal');
            });

            yPos += boxHeight * 2 + 15;

            // Capture Charts
            setExportProgress('Capturing charts...');

            // Trend Chart
            if (trendChartRef.current && aggregatedData.length > 0) {
                try {
                    const canvas = await html2canvas(trendChartRef.current, {
                        backgroundColor: '#ffffff',
                        scale: 2,
                        logging: false,
                    });
                    const imgData = canvas.toDataURL('image/png');

                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Spend vs Sales Trend', 15, yPos);
                    yPos += 5;

                    const imgWidth = pageWidth - 30;
                    const imgHeight = (canvas.height / canvas.width) * imgWidth;
                    doc.addImage(imgData, 'PNG', 15, yPos, imgWidth, Math.min(imgHeight, 60));
                    yPos += Math.min(imgHeight, 60) + 10;
                } catch (e) {
                    console.log('Chart capture failed, continuing...');
                }
            }

            // Check if we need a new page
            if (yPos > pageHeight - 80) {
                doc.addPage();
                yPos = 20;
            }

            // Pie Chart and Bar Chart side by side
            setExportProgress('Adding platform analysis...');

            if (pieChartRef.current && platformDistribution.length > 0) {
                try {
                    const canvas = await html2canvas(pieChartRef.current, {
                        backgroundColor: '#ffffff',
                        scale: 2,
                        logging: false,
                    });
                    const imgData = canvas.toDataURL('image/png');

                    doc.setFontSize(12);
                    doc.setFont('helvetica', 'bold');
                    doc.text('Spend Distribution', 15, yPos);
                    yPos += 5;

                    const imgWidth = (pageWidth - 35) / 2;
                    const imgHeight = (canvas.height / canvas.width) * imgWidth;
                    doc.addImage(imgData, 'PNG', 15, yPos, imgWidth, Math.min(imgHeight, 55));

                    // ROAS Bar Chart
                    if (barChartRef.current) {
                        const barCanvas = await html2canvas(barChartRef.current, {
                            backgroundColor: '#ffffff',
                            scale: 2,
                            logging: false,
                        });
                        const barImgData = barCanvas.toDataURL('image/png');
                        doc.setFontSize(12);
                        doc.text('ROAS by Platform', pageWidth / 2 + 5, yPos - 5);
                        doc.addImage(barImgData, 'PNG', pageWidth / 2 + 5, yPos, imgWidth, Math.min(imgHeight, 55));
                    }

                    yPos += Math.min(imgHeight, 55) + 10;
                } catch (e) {
                    console.log('Pie chart capture failed');
                }
            }

            // New page for detailed table
            doc.addPage();
            yPos = 20;

            // Platform Performance Table
            setExportProgress('Creating tables...');
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...textColor);
            doc.text('Platform Performance', 15, yPos);
            yPos += 8;

            const platformTableData = roasByPlatform.map(p => [
                p.name,
                `₹${p.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                `₹${p.sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                `${p.roas.toFixed(2)}x`,
                `${((p.spend / filteredSummary.totalSpend) * 100).toFixed(1)}%`,
            ]);

            (doc as any).autoTable({
                startY: yPos,
                head: [['Platform', 'Spend', 'Sales', 'ROAS', 'Share']],
                body: platformTableData,
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
                styles: { fontSize: 9, cellPadding: 3 },
                alternateRowStyles: { fillColor: [248, 248, 252] },
            });

            yPos = (doc as any).lastAutoTable.finalY + 15;

            // Daily/Weekly Data Table
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text(`${aggregation.charAt(0).toUpperCase() + aggregation.slice(1)} Performance Data`, 15, yPos);
            yPos += 8;

            const tableData = aggregatedData.slice(0, 25).map(row => [
                row.label,
                `₹${row.spend.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                `₹${row.sales.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
                `${row.roas.toFixed(2)}x`,
                row.impressions.toLocaleString('en-IN'),
                row.clicks.toLocaleString('en-IN'),
            ]);

            (doc as any).autoTable({
                startY: yPos,
                head: [['Period', 'Spend', 'Sales', 'ROAS', 'Impressions', 'Clicks']],
                body: tableData,
                theme: 'striped',
                headStyles: { fillColor: primaryColor, textColor: [255, 255, 255] },
                styles: { fontSize: 8, cellPadding: 2 },
                alternateRowStyles: { fillColor: [248, 248, 252] },
            });

            yPos = (doc as any).lastAutoTable.finalY + 15;

            // Insights & Recommendations
            if (yPos > pageHeight - 60) {
                doc.addPage();
                yPos = 20;
            }

            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.text('Insights & Recommendations', 15, yPos);
            yPos += 10;

            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');

            const insights: string[] = [];

            // ROAS insight
            if (filteredSummary.avgRoas >= 2) {
                insights.push('✓ Excellent ROAS performance - campaigns are generating strong returns');
            } else if (filteredSummary.avgRoas >= 1) {
                insights.push('◐ ROAS is positive but could be optimized for better returns');
            } else {
                insights.push('⚠ ROAS below 1x - consider reviewing underperforming campaigns');
            }

            // CTR insight
            if (filteredSummary.avgCtr >= 2) {
                insights.push('✓ Strong CTR indicates engaging ad creatives');
            } else if (filteredSummary.avgCtr >= 0.5) {
                insights.push('◐ CTR is average - test new ad variations to improve');
            } else {
                insights.push('⚠ Low CTR - recommend testing new creatives and targeting');
            }

            // Profit insight
            const profit = filteredSummary.totalSales - filteredSummary.totalSpend;
            const profitMargin = filteredSummary.totalSpend > 0 ? (profit / filteredSummary.totalSpend) * 100 : 0;
            insights.push(`Net Profit: ${formatNumber(profit, 'currency')} (${profitMargin.toFixed(1)}% margin)`);

            // Best platform
            if (roasByPlatform.length > 0) {
                const bestROAS = roasByPlatform.reduce((a, b) => a.roas > b.roas ? a : b);
                const highestSpend = roasByPlatform.reduce((a, b) => a.spend > b.spend ? a : b);
                insights.push(`Best ROAS: ${bestROAS.name} (${bestROAS.roas.toFixed(2)}x)`);
                insights.push(`Highest Spend: ${highestSpend.name} (${formatNumber(highestSpend.spend, 'currency')})`);
            }

            insights.forEach(insight => {
                if (yPos > pageHeight - 15) {
                    doc.addPage();
                    yPos = 20;
                }
                doc.text(insight, 20, yPos);
                yPos += 7;
            });

            // Footer on all pages
            const pageCount = doc.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setTextColor(...mutedColor);
                doc.text(`Joyspoon Analytics | Page ${i} of ${pageCount}`, pageWidth / 2, pageHeight - 8, { align: 'center' });
            }

            setExportProgress('Saving PDF...');
            doc.save(`analytics_report_${dateRange.start}_${dateRange.end}.pdf`);
        } catch (error) {
            console.error('PDF export failed:', error);
        }

        setExporting(null);
        setExportProgress('');
    };

    const exportFormats = [
        { id: 'csv' as ExportFormat, label: 'CSV', description: 'Raw data for spreadsheets', icon: FileSpreadsheet, action: exportToCsv },
        { id: 'excel' as ExportFormat, label: 'Excel', description: 'Multi-sheet workbook', icon: FileSpreadsheet, action: exportToExcel },
        { id: 'pdf' as ExportFormat, label: 'PDF Report', description: 'Visual report with charts', icon: File, action: exportToPdf },
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
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Platform</label>
                        <select value={selectedPlatform} onChange={(e) => setSelectedPlatform(e.target.value)} className="select-field w-full">
                            <option value="all">All Platforms</option>
                            {platforms.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Data Type</label>
                        <select value={selectedDataType} onChange={(e) => setSelectedDataType(e.target.value as DataType)} className="select-field w-full">
                            <option value="all">All Data</option>
                            <option value="ads">Ads Only</option>
                            <option value="sales">Sales Only</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm text-[var(--text-muted)] mb-1">Aggregation</label>
                        <select value={aggregation} onChange={(e) => setAggregation(e.target.value as Aggregation)} className="select-field w-full">
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {[
                    { icon: DollarSign, label: 'Spend', value: formatNumber(filteredSummary.totalSpend, 'currency') },
                    { icon: TrendingUp, label: 'Sales', value: formatNumber(filteredSummary.totalSales, 'currency') },
                    { icon: Target, label: 'ROAS', value: `${filteredSummary.avgRoas.toFixed(2)}x` },
                    { icon: Eye, label: 'Impressions', value: formatNumber(filteredSummary.totalImpressions) },
                    { icon: MousePointer, label: 'Clicks', value: formatNumber(filteredSummary.totalClicks) },
                    { icon: BarChart3, label: 'CTR', value: `${filteredSummary.avgCtr.toFixed(2)}%` },
                ].map((item, i) => (
                    <div key={item.label} className={`glass rounded-lg p-3 animate-slide-up stagger-${i + 1}`}>
                        <div className="flex items-center gap-2 text-[var(--text-muted)] mb-1">
                            <item.icon className="w-3.5 h-3.5" />
                            <span className="text-xs">{item.label}</span>
                        </div>
                        <p className="text-lg font-bold">{item.value}</p>
                    </div>
                ))}
            </div>

            {/* Charts for PDF capture */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Trend Chart */}
                <div ref={trendChartRef} className="bg-white rounded-xl p-4 shadow-sm border">
                    <h3 className="font-semibold mb-2 text-gray-800">Spend vs Sales Trend</h3>
                    <div className="h-64">
                        {aggregatedData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={aggregatedData}>
                                    <defs>
                                        <linearGradient id="spendGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10B981" stopOpacity={0.4} />
                                            <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                    <XAxis dataKey="label" stroke="#6b7280" fontSize={10} />
                                    <YAxis stroke="#6b7280" fontSize={10} />
                                    <Tooltip />
                                    <Legend />
                                    <Area type="monotone" dataKey="spend" name="Spend" stroke="#8B5CF6" fill="url(#spendGrad)" strokeWidth={2} />
                                    <Area type="monotone" dataKey="sales" name="Sales" stroke="#10B981" fill="url(#salesGrad)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">No data</div>
                        )}
                    </div>
                </div>

                {/* Pie Chart */}
                <div ref={pieChartRef} className="bg-white rounded-xl p-4 shadow-sm border">
                    <h3 className="font-semibold mb-2 text-gray-800">Spend Distribution</h3>
                    <div className="h-64">
                        {platformDistribution.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={platformDistribution} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                                        {platformDistribution.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                    </Pie>
                                    <Tooltip formatter={(v) => formatNumber(Number(v), 'currency')} />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">No data</div>
                        )}
                    </div>
                </div>
            </div>

            {/* ROAS Bar Chart */}
            <div ref={barChartRef} className="bg-white rounded-xl p-4 shadow-sm border">
                <h3 className="font-semibold mb-2 text-gray-800">ROAS by Platform</h3>
                <div className="h-48">
                    {roasByPlatform.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={roasByPlatform} layout="vertical">
                                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                <XAxis type="number" stroke="#6b7280" fontSize={10} />
                                <YAxis dataKey="name" type="category" stroke="#6b7280" fontSize={10} width={60} />
                                <Tooltip formatter={(v) => `${Number(v).toFixed(2)}x`} />
                                <Bar dataKey="roas" name="ROAS" radius={[0, 4, 4, 0]}>
                                    {roasByPlatform.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="h-full flex items-center justify-center text-gray-400">No data</div>
                    )}
                </div>
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
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    {exportProgress || 'Exporting...'}
                                </>
                            ) : (
                                <>
                                    <Download className="w-4 h-4" />
                                    Export {format.label}
                                </>
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
