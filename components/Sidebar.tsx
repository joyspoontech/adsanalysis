'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    BarChart3,
    Layers,
    FileText,
    Settings,
    ChevronLeft,
    ChevronRight,
    Database,
    RefreshCw,
} from 'lucide-react';
import { useState } from 'react';
import ThemeToggle from './ThemeToggle';

const navItems = [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/campaigns', label: 'Campaigns', icon: BarChart3 },
    { href: '/platforms', label: 'Platforms', icon: Layers },
    { href: '/reports', label: 'Reports', icon: FileText },
    { href: '/data-sources', label: 'Data Sources', icon: Database },
    { href: '/settings', label: 'Settings', icon: Settings },
];

export default function Sidebar() {
    const pathname = usePathname();
    const [collapsed, setCollapsed] = useState(false);

    return (
        <aside
            className={`fixed left-0 top-0 h-screen glass transition-all duration-300 z-40 ${collapsed ? 'w-20' : 'w-64'
                }`}
        >
            <div className="flex flex-col h-full">
                {/* Logo */}
                <div className="flex items-center justify-between p-4 border-b border-[var(--border)]">
                    {!collapsed && (
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center">
                                <BarChart3 className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h1 className="font-semibold text-base">Analytics</h1>
                                <p className="text-xs text-[var(--text-muted)]">Dashboard 2.0</p>
                            </div>
                        </div>
                    )}
                    {collapsed && (
                        <div className="w-9 h-9 rounded-lg bg-[var(--primary)] flex items-center justify-center mx-auto">
                            <BarChart3 className="w-5 h-5 text-white" />
                        </div>
                    )}
                </div>

                {/* Navigation */}
                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    {navItems.map((item) => {
                        const isActive = pathname === item.href;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={`nav-item ${isActive ? 'active' : ''} ${collapsed ? 'justify-center' : ''
                                    }`}
                                title={collapsed ? item.label : undefined}
                            >
                                <item.icon className="w-5 h-5 flex-shrink-0" />
                                {!collapsed && <span>{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Theme Toggle & Version Info */}
                {!collapsed && (
                    <div className="p-4 border-t border-[var(--border)]">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2 text-xs text-[var(--text-muted)]">
                                <RefreshCw className="w-3 h-3" />
                                <span>Query Sync</span>
                            </div>
                            <ThemeToggle />
                        </div>
                    </div>
                )}
                {collapsed && (
                    <div className="p-4 border-t border-[var(--border)] flex justify-center">
                        <ThemeToggle />
                    </div>
                )}

                {/* Collapse Button */}
                <div className="p-4 border-t border-[var(--border)]">
                    <button
                        onClick={() => setCollapsed(!collapsed)}
                        className="nav-item w-full justify-center"
                    >
                        {collapsed ? (
                            <ChevronRight className="w-5 h-5" />
                        ) : (
                            <>
                                <ChevronLeft className="w-5 h-5" />
                                <span>Collapse</span>
                            </>
                        )}
                    </button>
                </div>
            </div>
        </aside>
    );
}
