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
  ReceiptText,
  BarChart3,
  ShoppingCart,
  Layers,
  TrendingUp,
  ChefHat,
} from 'lucide-react';

export default function BarManagementLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const navGroups = [
    {
      groupLabel: 'OVERVIEW',
      items: [
        { name: 'Dashboard', href: '/bar-management', icon: Wine },
      ],
    },
    {
      groupLabel: 'OPERATIONS & POS',
      items: [
        { name: 'Touch POS', href: '/bar-management/pos', icon: ShoppingCart },
        { name: 'Table Billing', href: '/bar-management/billing', icon: ReceiptText },
        { name: 'Table Layout', href: '/bar-management/tables', icon: CalendarDays },
        { name: 'KDS Queue', href: '/bar-management/kitchen', icon: UtensilsCrossed },
      ],
    },
    {
      groupLabel: 'CATALOGS & MENU',
      items: [
        { name: 'Liquor Items', href: '/bar-management/catalog/products', icon: Package },
        { name: 'Food Catalog', href: '/bar-management/catalog/food', icon: UtensilsCrossed },
        { name: 'Brands Master', href: '/bar-management/catalog/brands', icon: Settings },
        { name: 'Categories Master', href: '/bar-management/catalog/categories', icon: Settings },
      ],
    },
    {
      groupLabel: 'INVENTORY',
      items: [
        { name: 'Stock & KSBCL', href: '/bar-management/inventory', icon: Package },
        { name: 'Kitchen Raw Stock', href: '/bar-management/inventory/kitchen', icon: ChefHat },
        { name: 'Inward GRN', href: '/bar-management/inventory/inward', icon: ArrowDownToLine },
        { name: 'Damage Logs', href: '/bar-management/inventory/damage', icon: AlertTriangle },
      ],
    },
    {
      groupLabel: 'REPORTS',
      items: [
        { name: 'Dish Sales Report', href: '/bar-management/reports/sales', icon: BarChart3 },
        { name: 'Shifts & Z-Reports', href: '/bar-management/shifts', icon: Clock },
        { name: 'KSBCL Register', href: '/bar-management/reports/ksbcl', icon: FileText },
      ],
    },
  ];

  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Sub-Header Navigation grouped logically */}
      <div className="border-b border-border bg-card px-4 py-2 flex items-center gap-4 overflow-x-auto scrollbar-none">
        <div className="flex items-center gap-2 font-bold text-sm mr-2 text-primary shrink-0 border-r border-border pr-4">
          <Wine className="size-4" />
          <span>Bar & Resto ERP</span>
        </div>

        <nav className="flex items-center gap-4 shrink-0">
          {navGroups.map((group, idx) => (
            <div key={group.groupLabel} className="flex items-center gap-1.5 bg-muted/20 p-1 rounded-lg border border-border/40">
              <span className="text-[10px] font-bold text-muted-foreground/80 tracking-wider px-1.5 uppercase select-none">
                {group.groupLabel}
              </span>
              <div className="flex items-center gap-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/60'
                      }`}
                    >
                      <Icon className="size-3.5" />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-4 md:p-6">{children}</div>
    </div>
  );
}
