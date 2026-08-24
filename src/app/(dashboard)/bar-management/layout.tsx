'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Wine,
  LayoutGrid,
  UtensilsCrossed,
  Package,
  ArrowDownToLine,
  AlertTriangle,
  Clock,
  CalendarDays,
  FileText,
  Settings,
  Users,
} from 'lucide-react';

export default function BarManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navItems = [
    { name: 'Dashboard', href: '/bar-management', icon: Wine },
    { name: 'Liquor Items', href: '/bar-management/catalog/products', icon: Package },
    { name: 'Brands Master', href: '/bar-management/catalog/brands', icon: Settings },
    { name: 'Categories Master', href: '/bar-management/catalog/categories', icon: Settings },
    { name: 'POS Terminal', href: '/bar-management/pos', icon: LayoutGrid },
    { name: 'Table Layout', href: '/bar-management/tables', icon: CalendarDays },
    { name: 'KDS Queue', href: '/bar-management/kitchen', icon: UtensilsCrossed },
    { name: 'Stock & KSBCL', href: '/bar-management/inventory', icon: Package },
    { name: 'Inward GRN', href: '/bar-management/inventory/inward', icon: ArrowDownToLine },
    { name: 'Damage Logs', href: '/bar-management/inventory/damage', icon: AlertTriangle },
    { name: 'Shifts & Z-Reports', href: '/bar-management/shifts', icon: Clock },
    { name: 'KSBCL Register', href: '/bar-management/reports/ksbcl', icon: FileText },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Sub-Header Navigation */}
      <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-2 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 font-bold text-base mr-4 text-primary shrink-0">
          <Wine className="size-5" />
          <span>Bar Management ERP</span>
        </div>

        <nav className="flex items-center gap-1 shrink-0">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground font-semibold shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                }`}
              >
                <Icon className="size-3.5" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-6">{children}</div>
    </div>
  );
}
