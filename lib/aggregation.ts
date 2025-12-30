/**
 * Aggregation Utilities - Helper functions for metric calculations
 */

import { DailyMetric, MonthlySummary } from './supabase';

/**
 * Calculate derived metrics from raw values
 */
export function calculateMetrics(data: {
    spend: number;
    impressions: number;
    clicks: number;
    sales: number;
}): {
    cpi: number;
    ctr: number;
    cpc: number;
    roas: number;
} {
    return {
        cpi: data.impressions > 0 ? data.spend / data.impressions : 0,
        ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
        cpc: data.clicks > 0 ? data.spend / data.clicks : 0,
        roas: data.spend > 0 ? data.sales / data.spend : 0,
    };
}

/**
 * Aggregate daily metrics to weekly
 */
export function aggregateToWeekly(dailyMetrics: DailyMetric[]): {
    weekStart: string;
    weekEnd: string;
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalSales: number;
    cpi: number;
    ctr: number;
    roas: number;
}[] {
    const byWeek: Record<string, DailyMetric[]> = {};

    for (const metric of dailyMetrics) {
        const date = new Date(metric.date);
        const dayOfWeek = date.getDay();
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - dayOfWeek);
        const weekKey = weekStart.toISOString().split('T')[0];

        if (!byWeek[weekKey]) {
            byWeek[weekKey] = [];
        }
        byWeek[weekKey].push(metric);
    }

    return Object.entries(byWeek).map(([weekStart, metrics]) => {
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const totals = metrics.reduce(
            (acc, m) => ({
                spend: acc.spend + (Number(m.total_spend) || 0),
                impressions: acc.impressions + (Number(m.total_impressions) || 0),
                clicks: acc.clicks + (Number(m.total_clicks) || 0),
                sales: acc.sales + (Number(m.total_sales) || 0),
            }),
            { spend: 0, impressions: 0, clicks: 0, sales: 0 }
        );

        const derived = calculateMetrics(totals);

        return {
            weekStart,
            weekEnd: weekEnd.toISOString().split('T')[0],
            totalSpend: totals.spend,
            totalImpressions: totals.impressions,
            totalClicks: totals.clicks,
            totalSales: totals.sales,
            ...derived,
        };
    }).sort((a, b) => new Date(a.weekStart).getTime() - new Date(b.weekStart).getTime());
}

/**
 * Aggregate daily metrics to monthly
 */
export function aggregateToMonthly(dailyMetrics: DailyMetric[]): {
    month: string;
    monthLabel: string;
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalSales: number;
    cpi: number;
    ctr: number;
    roas: number;
}[] {
    const byMonth: Record<string, DailyMetric[]> = {};

    for (const metric of dailyMetrics) {
        const date = new Date(metric.date);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;

        if (!byMonth[monthKey]) {
            byMonth[monthKey] = [];
        }
        byMonth[monthKey].push(metric);
    }

    return Object.entries(byMonth).map(([month, metrics]) => {
        const date = new Date(month);
        const monthLabel = date.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });

        const totals = metrics.reduce(
            (acc, m) => ({
                spend: acc.spend + (Number(m.total_spend) || 0),
                impressions: acc.impressions + (Number(m.total_impressions) || 0),
                clicks: acc.clicks + (Number(m.total_clicks) || 0),
                sales: acc.sales + (Number(m.total_sales) || 0),
            }),
            { spend: 0, impressions: 0, clicks: 0, sales: 0 }
        );

        const derived = calculateMetrics(totals);

        return {
            month,
            monthLabel,
            totalSpend: totals.spend,
            totalImpressions: totals.impressions,
            totalClicks: totals.clicks,
            totalSales: totals.sales,
            ...derived,
        };
    }).sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
}

/**
 * Group metrics by platform
 */
export function groupByPlatform(dailyMetrics: DailyMetric[]): {
    platform: string;
    totalSpend: number;
    totalImpressions: number;
    totalClicks: number;
    totalSales: number;
    cpi: number;
    ctr: number;
    roas: number;
}[] {
    const byPlatform: Record<string, DailyMetric[]> = {};

    for (const metric of dailyMetrics) {
        if (!byPlatform[metric.platform]) {
            byPlatform[metric.platform] = [];
        }
        byPlatform[metric.platform].push(metric);
    }

    return Object.entries(byPlatform).map(([platform, metrics]) => {
        const totals = metrics.reduce(
            (acc, m) => ({
                spend: acc.spend + (Number(m.total_spend) || 0),
                impressions: acc.impressions + (Number(m.total_impressions) || 0),
                clicks: acc.clicks + (Number(m.total_clicks) || 0),
                sales: acc.sales + (Number(m.total_sales) || 0),
            }),
            { spend: 0, impressions: 0, clicks: 0, sales: 0 }
        );

        const derived = calculateMetrics(totals);

        return {
            platform: platform.charAt(0).toUpperCase() + platform.slice(1),
            totalSpend: totals.spend,
            totalImpressions: totals.impressions,
            totalClicks: totals.clicks,
            totalSales: totals.sales,
            ...derived,
        };
    });
}

/**
 * Format number for display
 */
export function formatNumber(value: number, type: 'currency' | 'number' | 'percent' = 'number'): string {
    if (type === 'currency') {
        if (value >= 10000000) {
            return `₹${(value / 10000000).toFixed(2)}Cr`;
        } else if (value >= 100000) {
            return `₹${(value / 100000).toFixed(2)}L`;
        } else if (value >= 1000) {
            return `₹${(value / 1000).toFixed(1)}K`;
        }
        return `₹${value.toFixed(0)}`;
    } else if (type === 'percent') {
        return `${value.toFixed(2)}%`;
    } else {
        if (value >= 10000000) {
            return `${(value / 10000000).toFixed(2)}Cr`;
        } else if (value >= 100000) {
            return `${(value / 100000).toFixed(2)}L`;
        } else if (value >= 1000) {
            return `${(value / 1000).toFixed(1)}K`;
        }
        return value.toFixed(value < 10 ? 2 : 0);
    }
}

/**
 * Get date range for common periods
 */
export function getDateRange(period: 'today' | 'yesterday' | 'last7' | 'last30' | 'thisMonth' | 'lastMonth'): {
    start: Date;
    end: Date;
} {
    const now = new Date();
    // Set to noon to avoid timezone issues when converting to ISO date
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 12, 0, 0, 0);

    switch (period) {
        case 'today':
            return { start: today, end: today };
        case 'yesterday':
            const yesterday = new Date(today);
            yesterday.setDate(today.getDate() - 1);
            return { start: yesterday, end: yesterday };
        case 'last7':
            const last7Start = new Date(today);
            last7Start.setDate(today.getDate() - 6);
            return { start: last7Start, end: today };
        case 'last30':
            const last30Start = new Date(today);
            last30Start.setDate(today.getDate() - 29);
            return { start: last30Start, end: today };
        case 'thisMonth':
            const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
            return { start: thisMonthStart, end: today };
        case 'lastMonth':
            const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12, 0, 0, 0);
            const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0, 12, 0, 0, 0);
            return { start: lastMonthStart, end: lastMonthEnd };
        default:
            return { start: today, end: today };
    }
}
