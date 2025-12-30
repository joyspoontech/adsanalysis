'use client';

import { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';
import { format, subDays, subMonths, startOfMonth, endOfMonth, startOfYear } from 'date-fns';

interface DateRangePickerProps {
    onRangeChange: (start: Date, end: Date) => void;
}

const presets = [
    {
        label: 'Today',
        getValue: () => {
            const today = new Date();
            today.setHours(12, 0, 0, 0);
            return { start: today, end: today };
        }
    },
    {
        label: 'Last 7 Days',
        getValue: () => {
            const end = new Date();
            end.setHours(12, 0, 0, 0);
            const start = new Date(end);
            start.setDate(start.getDate() - 6); // 7 days including today
            return { start, end };
        }
    },
    {
        label: 'Last 30 Days',
        getValue: () => {
            const end = new Date();
            end.setHours(12, 0, 0, 0);
            const start = new Date(end);
            start.setDate(start.getDate() - 29); // 30 days including today
            return { start, end };
        }
    },
    {
        label: 'This Month',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth(), 1, 12, 0, 0, 0);
            const end = new Date();
            end.setHours(12, 0, 0, 0);
            return { start, end };
        }
    },
    {
        label: 'Last Month',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 12, 0, 0, 0);
            const end = new Date(now.getFullYear(), now.getMonth(), 0, 12, 0, 0, 0); // Day 0 = last day of previous month
            return { start, end };
        }
    },
    {
        label: 'This Year',
        getValue: () => {
            const now = new Date();
            const start = new Date(now.getFullYear(), 0, 1, 12, 0, 0, 0);
            const end = new Date();
            end.setHours(12, 0, 0, 0);
            return { start, end };
        }
    },
];

export default function DateRangePicker({ onRangeChange }: DateRangePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedPreset, setSelectedPreset] = useState('Last 30 Days');
    const [dateRange, setDateRange] = useState(() => {
        const preset = presets.find(p => p.label === 'Last 30 Days');
        return preset?.getValue() || { start: new Date(), end: new Date() };
    });

    const handlePresetClick = (preset: typeof presets[0]) => {
        const range = preset.getValue();
        setDateRange(range);
        setSelectedPreset(preset.label);
        onRangeChange(range.start, range.end);
        setIsOpen(false);
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-[var(--surface)] border border-[var(--border)] hover:border-[var(--primary)] transition-colors"
            >
                <Calendar className="w-5 h-5 text-[var(--primary)]" />
                <div className="text-left">
                    <p className="text-sm font-medium">{selectedPreset}</p>
                    <p className="text-xs text-[var(--text-muted)]">
                        {format(dateRange.start, 'MMM d')} - {format(dateRange.end, 'MMM d, yyyy')}
                    </p>
                </div>
                <ChevronDown className={`w-5 h-5 text-[var(--text-muted)] transition-transform ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40"
                        onClick={() => setIsOpen(false)}
                    />
                    <div className="dropdown-menu absolute left-0 top-full mt-2 z-50 w-64">
                        <div className="p-2">
                            {presets.map((preset) => (
                                <button
                                    key={preset.label}
                                    onClick={() => handlePresetClick(preset)}
                                    className={`dropdown-item w-full text-left flex items-center justify-between ${selectedPreset === preset.label ? 'bg-[var(--primary)]/10 text-[var(--primary)]' : ''
                                        }`}
                                >
                                    <span>{preset.label}</span>
                                    {selectedPreset === preset.label && (
                                        <span className="w-2 h-2 rounded-full bg-[var(--primary)]" />
                                    )}
                                </button>
                            ))}
                        </div>
                        <div className="border-t border-[var(--border)] p-3">
                            <p className="text-xs text-[var(--text-muted)] mb-2">Custom Range</p>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    className="input-field text-sm flex-1"
                                    value={format(dateRange.start, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        const newStart = new Date(e.target.value);
                                        setDateRange({ ...dateRange, start: newStart });
                                        setSelectedPreset('Custom');
                                        onRangeChange(newStart, dateRange.end);
                                    }}
                                />
                                <input
                                    type="date"
                                    className="input-field text-sm flex-1"
                                    value={format(dateRange.end, 'yyyy-MM-dd')}
                                    onChange={(e) => {
                                        const newEnd = new Date(e.target.value);
                                        setDateRange({ ...dateRange, end: newEnd });
                                        setSelectedPreset('Custom');
                                        onRangeChange(dateRange.start, newEnd);
                                    }}
                                />
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
