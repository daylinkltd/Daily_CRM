'use client';

import React, { useState } from 'react';
import {
  CalendarDays,
  Users,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  AlertCircle,
  Layers,
  Sparkles,
  Search,
  MoreVertical,
  Building2,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { toast } from 'sonner';

interface Table {
  id: string;
  tableNumber: string;
  section: string;
  capacity: number;
  status: 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'BILLING';
  guestCount?: number;
}

export default function TablesLayoutPage() {
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);

  const [tables, setTables] = useState<Table[]>([
    { id: '1', tableNumber: 'T1', section: 'Main Floor', capacity: 2, status: 'VACANT', guestCount: 0 },
    { id: '2', tableNumber: 'T2', section: 'Main Floor', capacity: 4, status: 'OCCUPIED', guestCount: 3 },
    { id: '3', tableNumber: 'T3', section: 'Main Floor', capacity: 4, status: 'BILLING', guestCount: 4 },
    { id: '4', tableNumber: 'T4', section: 'Main Floor', capacity: 6, status: 'OCCUPIED', guestCount: 5 },
    { id: '5', tableNumber: 'R1', section: 'Rooftop', capacity: 4, status: 'RESERVED', guestCount: 0 },
    { id: '6', tableNumber: 'R2', section: 'Rooftop', capacity: 8, status: 'VACANT', guestCount: 0 },
    { id: '7', tableNumber: 'V1', section: 'VIP Lounge', capacity: 10, status: 'OCCUPIED', guestCount: 8 },
  ]);

  // Form State
  const [formTableNumber, setFormTableNumber] = useState('');
  const [formSection, setFormSection] = useState('Main Floor');
  const [formCapacity, setFormCapacity] = useState(4);
  const [formStatus, setFormStatus] = useState<'VACANT' | 'OCCUPIED' | 'RESERVED' | 'BILLING'>('VACANT');
  const [formGuestCount, setFormGuestCount] = useState(0);

  const sections = ['ALL', 'Main Floor', 'Rooftop', 'VIP Lounge', 'Bar Counter', 'Outdoor Garden'];

  const filteredTables = tables.filter((t) => {
    const matchesSection = selectedSection === 'ALL' || t.section === selectedSection;
    const matchesSearch =
      !searchQuery ||
      t.tableNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.section.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSection && matchesSearch;
  });

  // KPI Calculations
  const totalCapacity = tables.reduce((acc, t) => acc + t.capacity, 0);
  const occupiedCount = tables.filter((t) => t.status === 'OCCUPIED' || t.status === 'BILLING').length;
  const currentGuests = tables.reduce((acc, t) => acc + (t.guestCount || 0), 0);
  const occupancyPercentage = Math.round((occupiedCount / (tables.length || 1)) * 100);

  const resetForm = () => {
    setFormTableNumber('');
    setFormSection('Main Floor');
    setFormCapacity(4);
    setFormStatus('VACANT');
    setFormGuestCount(0);
    setSelectedTable(null);
  };

  const handleCreateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTableNumber.trim()) {
      toast.error('Please enter table number/code');
      return;
    }

    const created: Table = {
      id: Date.now().toString(),
      tableNumber: formTableNumber.trim(),
      section: formSection,
      capacity: Number(formCapacity),
      status: formStatus,
      guestCount: Number(formGuestCount),
    };

    setTables([created, ...tables]);
    setShowAddModal(false);
    toast.success(`Table "${formTableNumber}" added to ${formSection}!`);
    resetForm();
  };

  const handleOpenEditModal = (table: Table) => {
    setSelectedTable(table);
    setFormTableNumber(table.tableNumber);
    setFormSection(table.section);
    setFormCapacity(table.capacity);
    setFormStatus(table.status);
    setFormGuestCount(table.guestCount || 0);
    setShowEditModal(true);
  };

  const handleUpdateTable = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTable || !formTableNumber.trim()) return;

    setTables((prev) =>
      prev.map((t) =>
        t.id === selectedTable.id
          ? {
              ...t,
              tableNumber: formTableNumber.trim(),
              section: formSection,
              capacity: Number(formCapacity),
              status: formStatus,
              guestCount: Number(formGuestCount),
            }
          : t
      )
    );

    setShowEditModal(false);
    toast.success(`Table "${formTableNumber}" updated successfully!`);
    resetForm();
  };

  const handleDeleteTable = (id: string, num: string) => {
    setTables((prev) => prev.filter((t) => t.id !== id));
    toast.success(`Table "${num}" removed from floor layout`);
  };

  const handleAdvanceStatus = (id: string, currentStatus: string) => {
    const statusFlow: Record<string, 'VACANT' | 'OCCUPIED' | 'RESERVED' | 'BILLING'> = {
      VACANT: 'OCCUPIED',
      OCCUPIED: 'BILLING',
      BILLING: 'VACANT',
      RESERVED: 'OCCUPIED',
    };
    const nextStatus = statusFlow[currentStatus] || 'VACANT';
    setTables((prev) =>
      prev.map((t) =>
        t.id === id
          ? {
              ...t,
              status: nextStatus,
              guestCount: nextStatus === 'VACANT' ? 0 : (t.guestCount && t.guestCount > 0 ? t.guestCount : 2),
            }
          : t
      )
    );
    toast.info(`Table status updated: ${currentStatus} ➔ ${nextStatus}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <CalendarDays className="size-6 text-primary" />
            Tables & Floor Layout Management
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure restaurant tables, manage floor sections, seating capacities, and live table occupancy.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => { resetForm(); setShowAddModal(true); }} size="sm" className="font-bold">
            <Plus className="size-4 mr-1.5" />
            Add New Table
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Total Tables</span>
            <div className="text-2xl font-bold mt-1">{tables.length}</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">{sections.length - 1} Floor Sections</span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Occupancy Rate</span>
            <div className="text-2xl font-bold text-blue-500 mt-1">{occupancyPercentage}%</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">{occupiedCount} of {tables.length} tables active</span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Active Guests</span>
            <div className="text-2xl font-bold text-emerald-500 mt-1">{currentGuests}</div>
            <span className="text-[10px] text-muted-foreground mt-1 block">Max capacity: {totalCapacity} seats</span>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardContent className="p-4">
            <span className="text-xs text-muted-foreground font-medium">Vacant Tables</span>
            <div className="text-2xl font-bold text-muted-foreground mt-1">
              {tables.filter((t) => t.status === 'VACANT').length}
            </div>
            <span className="text-[10px] text-muted-foreground mt-1 block">Ready for seating</span>
          </CardContent>
        </Card>
      </div>

      {/* Section Filter Tabs & Search */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 bg-card border border-border rounded-lg shadow-xs">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
          <span className="text-xs font-semibold text-muted-foreground mr-1">Section:</span>
          {sections.map((sec) => (
            <Button
              key={sec}
              variant={selectedSection === sec ? 'default' : 'outline'}
              size="sm"
              onClick={() => setSelectedSection(sec)}
              className="text-xs h-7 px-3 shrink-0"
            >
              {sec}
            </Button>
          ))}
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search table number or section..."
            className="pl-9 bg-background text-xs h-9"
          />
        </div>
      </div>

      {/* Table Grid Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {filteredTables.map((t) => (
          <Card
            key={t.id}
            onClick={() => handleOpenEditModal(t)}
            className={`transition-all cursor-pointer hover:scale-[1.02] flex flex-col justify-between p-4 border relative group shadow-xs ${
              t.status === 'VACANT'
                ? 'border-emerald-500/40 bg-emerald-500/5 hover:border-emerald-500'
                : t.status === 'OCCUPIED'
                ? 'border-blue-500/40 bg-blue-500/5 hover:border-blue-500'
                : t.status === 'BILLING'
                ? 'border-amber-500/40 bg-amber-500/5 hover:border-amber-500'
                : 'border-purple-500/40 bg-purple-500/5 hover:border-purple-500'
            }`}
          >
            <div>
              <div className="flex items-center justify-between">
                <span className="font-bold text-xl text-foreground">{t.tableNumber}</span>
                
                <DropdownMenu>
                  <DropdownMenuTrigger onClick={(e) => e.stopPropagation()} className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60">
                    <MoreVertical className="size-4" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="text-xs">
                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleOpenEditModal(t); }}>
                      <Edit2 className="size-3.5 mr-2" />
                      Edit Table Details
                    </DropdownMenuItem>
                    
                    {/* Explicit Status Controls */}
                    {t.status !== 'OCCUPIED' && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setTables((prev) =>
                            prev.map((item) => (item.id === t.id ? { ...item, status: 'OCCUPIED', guestCount: item.capacity } : item))
                          );
                          toast.success(`Table ${t.tableNumber} status set to OCCUPIED`);
                        }}
                      >
                        <CheckCircle2 className="size-3.5 mr-2 text-blue-500" />
                        Mark as Occupied
                      </DropdownMenuItem>
                    )}

                    {t.status !== 'BILLING' && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setTables((prev) =>
                            prev.map((item) => (item.id === t.id ? { ...item, status: 'BILLING' } : item))
                          );
                          toast.success(`Table ${t.tableNumber} status set to BILLING`);
                        }}
                      >
                        <Clock className="size-3.5 mr-2 text-amber-500" />
                        Mark for Billing
                      </DropdownMenuItem>
                    )}

                    {t.status !== 'VACANT' && (
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setTables((prev) =>
                            prev.map((item) =>
                              item.id === t.id ? { ...item, status: 'VACANT', guestCount: 0 } : item
                            )
                          );
                          toast.success(`Table ${t.tableNumber} cleared & marked VACANT`);
                        }}
                        className="text-emerald-600 font-semibold"
                      >
                        <CheckCircle2 className="size-3.5 mr-2 text-emerald-600" />
                        Clear & Mark Vacant
                      </DropdownMenuItem>
                    )}

                    <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleDeleteTable(t.id, t.tableNumber); }} className="text-red-500">
                      <Trash2 className="size-3.5 mr-2" />
                      Delete Table
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>

              <div className="mt-2">
                <Badge
                  variant={
                    t.status === 'VACANT'
                      ? 'default'
                      : t.status === 'OCCUPIED'
                      ? 'secondary'
                      : 'outline'
                  }
                  className="text-[10px]"
                >
                  {t.status}
                </Badge>
              </div>
            </div>

            <div className="mt-4 pt-3 border-t border-border/40 text-xs text-muted-foreground flex items-center justify-between">
              <span className="text-[10px] truncate max-w-[80px]">{t.section}</span>
              <span className="flex items-center gap-1 font-semibold text-foreground">
                <Users className="size-3 text-primary" />
                {t.guestCount || 0}/{t.capacity}
              </span>
            </div>
          </Card>
        ))}
      </div>

      {/* Add New Table Dialog */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="size-4 text-primary" />
              Add New Table to Floor Layout
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTable} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Table Number / Code</Label>
              <Input
                value={formTableNumber}
                onChange={(e) => setFormTableNumber(e.target.value)}
                placeholder="e.g. T5, R3, V2, Counter 1"
                className="bg-background text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Floor Section</Label>
                <Select value={formSection} onValueChange={setFormSection}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Main Floor">Main Floor</SelectItem>
                    <SelectItem value="Rooftop">Rooftop Bar</SelectItem>
                    <SelectItem value="VIP Lounge">VIP Lounge</SelectItem>
                    <SelectItem value="Bar Counter">Bar Counter</SelectItem>
                    <SelectItem value="Outdoor Garden">Outdoor Garden</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Guest Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={formCapacity || ''}
                  onChange={(e) => setFormCapacity(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="4"
                  className="bg-background text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Initial Status</Label>
                <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VACANT">VACANT</SelectItem>
                    <SelectItem value="OCCUPIED">OCCUPIED</SelectItem>
                    <SelectItem value="RESERVED">RESERVED</SelectItem>
                    <SelectItem value="BILLING">BILLING</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Current Guest Count</Label>
                <Input
                  type="number"
                  min={0}
                  max={formCapacity || 50}
                  value={formGuestCount === 0 ? '' : formGuestCount}
                  onChange={(e) => setFormGuestCount(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="bg-background text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Save Table
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit Table Dialog */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Edit2 className="size-4 text-primary" />
              Edit Table {selectedTable?.tableNumber} Details
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleUpdateTable} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="font-semibold">Table Number / Code</Label>
              <Input
                value={formTableNumber}
                onChange={(e) => setFormTableNumber(e.target.value)}
                className="bg-background text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Floor Section</Label>
                <Select value={formSection} onValueChange={setFormSection}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Main Floor">Main Floor</SelectItem>
                    <SelectItem value="Rooftop">Rooftop Bar</SelectItem>
                    <SelectItem value="VIP Lounge">VIP Lounge</SelectItem>
                    <SelectItem value="Bar Counter">Bar Counter</SelectItem>
                    <SelectItem value="Outdoor Garden">Outdoor Garden</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Guest Capacity</Label>
                <Input
                  type="number"
                  min={1}
                  max={50}
                  value={formCapacity || ''}
                  onChange={(e) => setFormCapacity(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="4"
                  className="bg-background text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="font-semibold">Table Status</Label>
                <Select value={formStatus} onValueChange={(val: any) => setFormStatus(val)}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VACANT">VACANT</SelectItem>
                    <SelectItem value="OCCUPIED">OCCUPIED</SelectItem>
                    <SelectItem value="RESERVED">RESERVED</SelectItem>
                    <SelectItem value="BILLING">BILLING</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="font-semibold">Seated Guest Count</Label>
                <Input
                  type="number"
                  min={0}
                  max={formCapacity || 50}
                  value={formGuestCount === 0 ? '' : formGuestCount}
                  onChange={(e) => setFormGuestCount(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="bg-background text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEditModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Update Table
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
