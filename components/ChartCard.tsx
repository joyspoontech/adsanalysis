'use client';

import { ReactNode } from 'react';
import { MoreVertical, Download, Maximize2 } from 'lucide-react';

interface ChartCardProps {
    title: string;
    subtitle?: string;
    children: ReactNode;
    className?: string;
    actions?: boolean;
    action?: ReactNode;
}

export default function ChartCard({
    title,
    subtitle,
    children,
    className = '',
    actions = true,
    action,
}: ChartCardProps) {
    return (
        <div className={`glass rounded-xl p-5 ${className}`}>
            <div className="flex items-start justify-between mb-4">
                <div>
                    <h3 className="font-medium text-base">{title}</h3>
                    {subtitle && (
                        <p className="text-sm text-[var(--text-muted)] mt-1">{subtitle}</p>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {action}
                    {actions && (
                        <>
                            <button className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center hover:bg-[var(--surface-light)] transition-colors">
                                <Download className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                            <button className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center hover:bg-[var(--surface-light)] transition-colors">
                                <Maximize2 className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                            <button className="w-8 h-8 rounded-lg bg-[var(--surface)] flex items-center justify-center hover:bg-[var(--surface-light)] transition-colors">
                                <MoreVertical className="w-4 h-4 text-[var(--text-secondary)]" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            {children}
        </div>
    );
}
