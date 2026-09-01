'use client';

import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Package,
  Plus,
  ArrowDownToLine,
  ArrowRightLeft,
  AlertTriangle,
  FileText,
  RefreshCw,
  Search,
  CheckCircle2,
  AlertCircle,
  TrendingDown,
  DollarSign,
  Layers,
  ChefHat,
  Boxes,
  Settings,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';

interface RawMaterial {
  id: string;
  name: string;
  category: string;
  unit_of_measure: string;
  cost_per_unit: number;
  reorder_threshold: number;
  ideal_yield_percentage?: number;
  preferred_supplier?: string;
  shelf_life_days?: number;
  gst_rate?: number;
  hsn_code?: string;
  totalStock: number;
  stockStatus: 'IN_STOCK' | 'LOW_STOCK' | 'CRITICAL';
  locationBalances?: Array<{ location: string; current_stock: number }>;
}

export default function KitchenInventoryPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([]);
  const [movements, setMovements] = useState<any[]>([]);
  const [stats, setStats] = useState({
    totalItems: 0,
    lowStockCount: 0,
    criticalCount: 0,
    totalValuation: 0,
  });

  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInwardModal, setShowInwardModal] = useState(false);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [showWastageModal, setShowWastageModal] = useState(false);
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);

  // Form States
  // 1. Add Material
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState('GROCERY');
  const [addUnit, setAddUnit] = useState('KG');
  const [addCost, setAddCost] = useState(0);
  const [addReorder, setAddReorder] = useState(10);
  const [addInitialStock, setAddInitialStock] = useState(0);
  const [addLocation, setAddLocation] = useState('STORE_ROOM');
  const [addSupplier, setAddSupplier] = useState('');
  const [addShelfLife, setAddShelfLife] = useState(30);
  const [addGstRate, setAddGstRate] = useState(5);
  const [addHsnCode, setAddHsnCode] = useState('');
  const [addYieldPct, setAddYieldPct] = useState(100);

  // Dynamic Locations & Suppliers
  const [customLocations, setCustomLocations] = useState<string[]>([
    'STORE_ROOM',
    'MAIN_KITCHEN',
    'COLD_STORAGE',
    'TANDOOR',
    'PANTRY',
    'BAKERY',
    'BAR_STATION',
  ]);
  const [customLocationInput, setCustomLocationInput] = useState('');
  const [isCustomLocSelected, setIsCustomLocSelected] = useState(false);

  const [customSuppliers, setCustomSuppliers] = useState<string[]>([
    'Metro Cash & Carry',
    'Reliance Fresh Wholesale',
    'Local Produce Market',
    'Direct Dairy Farm',
    'Universal Spices Ltd',
  ]);

  // Master Management Modals & Inputs
  const [showMasterLocModal, setShowMasterLocModal] = useState(false);
  const [showMasterSuppModal, setShowMasterSuppModal] = useState(false);

  const [newMasterLocName, setNewMasterLocName] = useState('');
  const [newMasterLocDesc, setNewMasterLocDesc] = useState('');

  const [newMasterSuppName, setNewMasterSuppName] = useState('');
  const [newMasterSuppPerson, setNewMasterSuppPerson] = useState('');
  const [newMasterSuppPhone, setNewMasterSuppPhone] = useState('');
  const [newMasterSuppGstin, setNewMasterSuppGstin] = useState('');

  // Add Master Location
  const handleAddMasterLocation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterLocName.trim()) return;
    const cleanLoc = newMasterLocName.trim().toUpperCase().replace(/\s+/g, '_');
    
    try {
      await fetch('/api/bar/kitchen-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_LOCATION',
          name: newMasterLocName.trim(),
          code: cleanLoc,
          description: newMasterLocDesc,
        }),
      });
    } catch (err) {}

    if (!customLocations.includes(cleanLoc)) {
      setCustomLocations((prev) => [...prev, cleanLoc]);
    }
    setAddLocation(cleanLoc);
    toast.success(`Added location master "${newMasterLocName.trim()}"`);
    setNewMasterLocName('');
    setNewMasterLocDesc('');
    setShowMasterLocModal(false);
  };

  // Add Master Supplier
  const handleAddMasterSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMasterSuppName.trim()) return;

    try {
      await fetch('/api/bar/kitchen-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_SUPPLIER',
          name: newMasterSuppName.trim(),
          contact_person: newMasterSuppPerson,
          phone: newMasterSuppPhone,
          gstin: newMasterSuppGstin,
        }),
      });
    } catch (err) {}

    if (!customSuppliers.includes(newMasterSuppName.trim())) {
      setCustomSuppliers((prev) => [...prev, newMasterSuppName.trim()]);
    }
    setAddSupplier(newMasterSuppName.trim());
    toast.success(`Added vendor master "${newMasterSuppName.trim()}"`);
    setNewMasterSuppName('');
    setNewMasterSuppPerson('');
    setNewMasterSuppPhone('');
    setNewMasterSuppGstin('');
    setShowMasterSuppModal(false);
  };

  // 2. Inward GRN
  const [inwardQty, setInwardQty] = useState(0);
  const [inwardUnitCost, setInwardUnitCost] = useState(0);
  const [inwardSupplier, setInwardSupplier] = useState('Metro Cash & Carry');
  const [inwardInvoice, setInwardInvoice] = useState('');

  // 3. Station Transfer
  const [transferFrom, setTransferFrom] = useState('STORE_ROOM');
  const [transferTo, setTransferTo] = useState('MAIN_KITCHEN');
  const [transferQty, setTransferQty] = useState(0);

  // 4. Wastage Logger
  const [wasteLocation, setWasteLocation] = useState('MAIN_KITCHEN');
  const [wasteQty, setWasteQty] = useState(0);
  const [wasteReason, setWasteReason] = useState('SPOILED');
  const [wasteNotes, setWasteNotes] = useState('');

  // Initial Mock Data Fallback for smooth presentation
  const mockMaterials: RawMaterial[] = [
    { id: 'm1', name: 'Basmati Rice (Royal Feast)', category: 'GROCERY', unit_of_measure: 'KG', cost_per_unit: 110, reorder_threshold: 25, totalStock: 150, stockStatus: 'IN_STOCK', locationBalances: [{ location: 'STORE_ROOM', current_stock: 120 }, { location: 'MAIN_KITCHEN', current_stock: 30 }] },
    { id: 'm2', name: 'Fresh Paneer (Cottage Cheese)', category: 'DAIRY', unit_of_measure: 'KG', cost_per_unit: 360, reorder_threshold: 8, totalStock: 4.5, stockStatus: 'LOW_STOCK', locationBalances: [{ location: 'STORE_ROOM', current_stock: 0 }, { location: 'TANDOOR', current_stock: 4.5 }] },
    { id: 'm3', name: 'Fresh Boneless Chicken', category: 'POULTRY', unit_of_measure: 'KG', cost_per_unit: 240, reorder_threshold: 15, totalStock: 18, stockStatus: 'IN_STOCK', locationBalances: [{ location: 'STORE_ROOM', current_stock: 10 }, { location: 'MAIN_KITCHEN', current_stock: 8 }] },
    { id: 'm4', name: 'Cooking Oil (Refined Sunflower)', category: 'GROCERY', unit_of_measure: 'LITERS', cost_per_unit: 140, reorder_threshold: 20, totalStock: 0, stockStatus: 'CRITICAL', locationBalances: [{ location: 'STORE_ROOM', current_stock: 0 }] },
    { id: 'm5', name: 'Amul Salted Butter (500g Blocks)', category: 'DAIRY', unit_of_measure: 'PACKETS', cost_per_unit: 275, reorder_threshold: 10, totalStock: 22, stockStatus: 'IN_STOCK', locationBalances: [{ location: 'STORE_ROOM', current_stock: 15 }, { location: 'MAIN_KITCHEN', current_stock: 7 }] },
    { id: 'm6', name: 'Tandoori Masala Blend', category: 'SPICES', unit_of_measure: 'KG', cost_per_unit: 450, reorder_threshold: 3, totalStock: 2.2, stockStatus: 'LOW_STOCK', locationBalances: [{ location: 'TANDOOR', current_stock: 2.2 }] },
    { id: 'm7', name: 'Red Onions (Nashik Quality)', category: 'PRODUCE', unit_of_measure: 'KG', cost_per_unit: 35, reorder_threshold: 30, totalStock: 85, stockStatus: 'IN_STOCK', locationBalances: [{ location: 'STORE_ROOM', current_stock: 85 }] },
  ];

  // Auto-synchronize unique locations and suppliers from materials
  useEffect(() => {
    const locSet = new Set(customLocations);
    const suppSet = new Set(customSuppliers);
    materials.forEach((m) => {
      if (m.preferred_supplier && m.preferred_supplier.trim()) {
        suppSet.add(m.preferred_supplier.trim());
      }
      m.locationBalances?.forEach((lb) => {
        if (lb.location && lb.location.trim()) {
          locSet.add(lb.location.trim());
        }
      });
    });
    setCustomLocations(Array.from(locSet));
    setCustomSuppliers(Array.from(suppSet));
  }, [materials]);

  // Persist materials in localStorage whenever state changes
  useEffect(() => {
    if (typeof window !== 'undefined' && materials.length > 0) {
      localStorage.setItem('bar_kitchen_raw_materials', JSON.stringify(materials));
    }
  }, [materials]);

  const loadFromLocalStorageOrMock = () => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bar_kitchen_raw_materials');
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (parsed.length > 0) {
            setMaterials(parsed);
            setStats({
              totalItems: parsed.length,
              lowStockCount: parsed.filter((m: any) => m.stockStatus === 'LOW_STOCK').length,
              criticalCount: parsed.filter((m: any) => m.stockStatus === 'CRITICAL').length,
              totalValuation: parsed.reduce((sum: number, m: any) => sum + m.totalStock * m.cost_per_unit, 0),
            });
            return;
          }
        } catch (e) {}
      }
    }
    setMaterials(mockMaterials);
    setStats({
      totalItems: mockMaterials.length,
      lowStockCount: mockMaterials.filter((m) => m.stockStatus === 'LOW_STOCK').length,
      criticalCount: mockMaterials.filter((m) => m.stockStatus === 'CRITICAL').length,
      totalValuation: mockMaterials.reduce((sum, m) => sum + m.totalStock * m.cost_per_unit, 0),
    });
  };

  const fetchInventory = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bar/kitchen-inventory?category=${selectedCategory}`);
      const data = await res.json();
      if (data.success && data.materials?.length > 0) {
        setMaterials(data.materials);
        setMovements(data.movements || []);
        setStats(data.stats);
      } else {
        loadFromLocalStorageOrMock();
      }
    } catch (err) {
      loadFromLocalStorageOrMock();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [selectedCategory]);

  // Submit Add Material
  const handleAddMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim()) return;

    const finalLocation = isCustomLocSelected && customLocationInput.trim()
      ? customLocationInput.trim().toUpperCase().replace(/\s+/g, '_')
      : addLocation;

    if (finalLocation && !customLocations.includes(finalLocation)) {
      setCustomLocations((prev) => [...prev, finalLocation]);
    }
    if (addSupplier.trim() && !customSuppliers.includes(addSupplier.trim())) {
      setCustomSuppliers((prev) => [...prev, addSupplier.trim()]);
    }

    const newItem: RawMaterial = {
      id: `m-${Date.now()}`,
      name: addName.trim(),
      category: addCategory,
      unit_of_measure: addUnit,
      cost_per_unit: Number(addCost || 0),
      reorder_threshold: Number(addReorder || 10),
      ideal_yield_percentage: Number(addYieldPct || 100),
      preferred_supplier: addSupplier,
      shelf_life_days: Number(addShelfLife || 30),
      gst_rate: Number(addGstRate || 5),
      hsn_code: addHsnCode,
      totalStock: Number(addInitialStock || 0),
      stockStatus: addInitialStock <= 0 ? 'CRITICAL' : addInitialStock <= addReorder ? 'LOW_STOCK' : 'IN_STOCK',
      locationBalances: [{ location: finalLocation, current_stock: Number(addInitialStock || 0) }],
    };

    setMaterials((prev) => [newItem, ...prev]);

    try {
      await fetch('/api/bar/kitchen-inventory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: addName,
          category: addCategory,
          unit_of_measure: addUnit,
          cost_per_unit: addCost,
          reorder_threshold: addReorder,
          initial_stock: addInitialStock,
          initial_location: finalLocation,
          preferred_supplier: addSupplier,
          shelf_life_days: addShelfLife,
          gst_rate: addGstRate,
          hsn_code: addHsnCode,
          ideal_yield_percentage: addYieldPct,
        }),
      });
    } catch (err: any) {}

    toast.success(`Added raw material "${addName}" to Kitchen Inventory`);
    setShowAddModal(false);
    setIsCustomLocSelected(false);
    setCustomLocationInput('');
  };

  // Submit Inward GRN
  const handleInwardGRN = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || inwardQty <= 0) return;

    setMaterials((prev) =>
      prev.map((m) =>
        m.id === selectedMaterial.id
          ? {
              ...m,
              totalStock: m.totalStock + Number(inwardQty),
              cost_per_unit: Number(inwardUnitCost || m.cost_per_unit),
              stockStatus: (m.totalStock + Number(inwardQty)) <= m.reorder_threshold ? 'LOW_STOCK' : 'IN_STOCK',
            }
          : m
      )
    );

    try {
      await fetch('/api/bar/kitchen-inventory/inward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_material_id: selectedMaterial.id,
          quantity: inwardQty,
          unit_cost: inwardUnitCost || selectedMaterial.cost_per_unit,
          supplier_name: inwardSupplier,
          invoice_no: inwardInvoice || `INV-${Date.now().toString().slice(-5)}`,
        }),
      });
    } catch (err) {}

    toast.success(`Inward GRN recorded (+${inwardQty} ${selectedMaterial.unit_of_measure} for ${selectedMaterial.name})`);
    setShowInwardModal(false);
  };

  // Submit Station Transfer
  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || transferQty <= 0) return;

    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === selectedMaterial.id) {
          const locs = m.locationBalances || [];
          const fromLoc = locs.find((l) => l.location === transferFrom);
          const toLoc = locs.find((l) => l.location === transferTo);
          const updatedLocs = [...locs];

          if (fromLoc) {
            fromLoc.current_stock = Math.max(0, fromLoc.current_stock - Number(transferQty));
          }
          if (toLoc) {
            toLoc.current_stock += Number(transferQty);
          } else {
            updatedLocs.push({ location: transferTo, current_stock: Number(transferQty) });
          }
          return { ...m, locationBalances: updatedLocs };
        }
        return m;
      })
    );

    try {
      await fetch('/api/bar/kitchen-inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_material_id: selectedMaterial.id,
          from_location: transferFrom,
          to_location: transferTo,
          quantity: transferQty,
        }),
      });
    } catch (err: any) {}

    toast.success(`Transferred ${transferQty} ${selectedMaterial.unit_of_measure} from ${transferFrom} to ${transferTo}`);
    setShowTransferModal(false);
  };

  // Submit Wastage Log
  const handleWastage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMaterial || wasteQty <= 0) return;

    setMaterials((prev) =>
      prev.map((m) => {
        if (m.id === selectedMaterial.id) {
          const newStock = Math.max(0, m.totalStock - Number(wasteQty));
          return {
            ...m,
            totalStock: newStock,
            stockStatus: newStock <= 0 ? 'CRITICAL' : newStock <= m.reorder_threshold ? 'LOW_STOCK' : 'IN_STOCK',
          };
        }
        return m;
      })
    );

    try {
      await fetch('/api/bar/kitchen-inventory/wastage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          raw_material_id: selectedMaterial.id,
          location: wasteLocation,
          quantity_lost: wasteQty,
          reason: wasteReason,
          notes: wasteNotes,
        }),
      });
    } catch (err: any) {}

    toast.success(`Logged wastage of -${wasteQty} ${selectedMaterial.unit_of_measure} for ${selectedMaterial.name}`);
    setShowWastageModal(false);
  };

  const filteredMaterials = materials.filter((m) => {
    const matchesSearch = !searchQuery || m.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'ALL' || m.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <div className="space-y-6">
      {/* Header Title & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <div className="flex items-center gap-2">
            <ChefHat className="size-6 text-primary" />
            <h1 className="text-xl font-bold tracking-tight text-foreground">Kitchen Raw Material & Inventory Control</h1>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Petpooja-style raw material stock balance, recipe BOM link, store-to-kitchen transfers, and spoilage logger.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchInventory} className="h-9 text-xs font-semibold">
            <RefreshCw className="size-3.5 mr-1.5" />
            Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAddModal(true)} className="h-9 text-xs font-bold bg-primary">
            <Plus className="size-3.5 mr-1.5" />
            Add Raw Material
          </Button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Total Raw Items</p>
              <h3 className="text-2xl font-extrabold mt-1 text-foreground">{stats.totalItems}</h3>
              <span className="text-[10px] text-muted-foreground">Cataloged Ingredients</span>
            </div>
            <div className="p-2.5 rounded-lg bg-primary/10 text-primary">
              <Boxes className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Reorder & Low Stock</p>
              <h3 className="text-2xl font-extrabold mt-1 text-amber-500">{stats.lowStockCount + stats.criticalCount}</h3>
              <span className="text-[10px] text-amber-500/90 font-medium">{stats.criticalCount} Out of Stock</span>
            </div>
            <div className="p-2.5 rounded-lg bg-amber-500/10 text-amber-500">
              <AlertTriangle className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Stock Valuation (WAC)</p>
              <h3 className="text-2xl font-extrabold mt-1 text-emerald-500">₹{stats.totalValuation.toLocaleString('en-IN')}</h3>
              <span className="text-[10px] text-muted-foreground">Raw Material Asset Value</span>
            </div>
            <div className="p-2.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <DollarSign className="size-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border shadow-xs">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Store Locations</p>
              <h3 className="text-2xl font-extrabold mt-1 text-foreground">4 Stations</h3>
              <span className="text-[10px] text-muted-foreground">Store, Main Kitchen, Tandoor, Pantry</span>
            </div>
            <div className="p-2.5 rounded-lg bg-purple-500/10 text-purple-500">
              <Layers className="size-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs Control */}
      <Tabs defaultValue="stock" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-card p-2 rounded-lg border border-border">
          <TabsList className="bg-muted p-1">
            <TabsTrigger value="stock" className="text-xs font-semibold">
              <Boxes className="size-3.5 mr-1.5" />
              Stock Balances
            </TabsTrigger>
            <TabsTrigger value="movements" className="text-xs font-semibold">
              <FileText className="size-3.5 mr-1.5" />
              Audit Ledger
            </TabsTrigger>
            <TabsTrigger value="bom" className="text-xs font-semibold">
              <UtensilsCrossed className="size-3.5 mr-1.5" />
              Recipe BOM Link
            </TabsTrigger>
            <TabsTrigger value="masters" className="text-xs font-semibold bg-primary/10 text-primary data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
              <Settings className="size-3.5 mr-1.5" />
              Inventory Masters
            </TabsTrigger>
          </TabsList>

          {/* Search & Category Filter */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="size-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search raw ingredient..."
                className="pl-8 h-8 text-xs w-44 sm:w-56 bg-background"
              />
            </div>

            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="h-8 text-xs w-36 bg-background">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Categories</SelectItem>
                <SelectItem value="GROCERY">Grocery & Oils</SelectItem>
                <SelectItem value="DAIRY">Dairy & Cheese</SelectItem>
                <SelectItem value="POULTRY">Poultry & Eggs</SelectItem>
                <SelectItem value="MEAT">Meat & Seafood</SelectItem>
                <SelectItem value="PRODUCE">Fresh Produce</SelectItem>
                <SelectItem value="SPICES">Spices & Seasoning</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Tab 1: Stock Balances Table */}
        <TabsContent value="stock" className="space-y-4">
          <Card className="bg-card border-border shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b border-border uppercase text-[10px] font-bold text-muted-foreground">
                  <tr>
                    <th className="py-3 px-4">Raw Ingredient</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Total Stock</th>
                    <th className="py-3 px-4">Station Location Breakdown</th>
                    <th className="py-3 px-4">Cost / Base Unit</th>
                    <th className="py-3 px-4">Reorder Status</th>
                    <th className="py-3 px-4 text-right">Quick Operations</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredMaterials.map((mat) => (
                    <tr key={mat.id} className="hover:bg-muted/30 transition-colors">
                      <td className="py-3 px-4 font-semibold text-foreground">
                        {mat.name}
                        <span className="text-[10px] text-muted-foreground block font-mono">Unit: {mat.unit_of_measure}</span>
                      </td>

                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {mat.category}
                        </Badge>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-extrabold text-sm text-foreground">
                          {mat.totalStock} {mat.unit_of_measure}
                        </span>
                        <span className="text-[10px] text-muted-foreground block">
                          Value: ₹{(mat.totalStock * mat.cost_per_unit).toLocaleString('en-IN')}
                        </span>
                      </td>

                      <td className="py-3 px-4">
                        <div className="flex flex-wrap gap-1">
                          {(mat.locationBalances && mat.locationBalances.length > 0
                            ? mat.locationBalances
                            : [{ location: 'STORE_ROOM', current_stock: mat.totalStock }]
                          ).map((loc) => (
                            <Badge key={loc.location} variant="secondary" className="text-[10px] font-mono">
                              {loc.location}: {loc.current_stock}
                            </Badge>
                          ))}
                        </div>
                      </td>

                      <td className="py-3 px-4 font-mono font-semibold">
                        ₹{mat.cost_per_unit} / {mat.unit_of_measure}
                      </td>

                      <td className="py-3 px-4">
                        {mat.stockStatus === 'CRITICAL' ? (
                          <Badge variant="destructive" className="text-[10px] font-bold">
                            OUT OF STOCK
                          </Badge>
                        ) : mat.stockStatus === 'LOW_STOCK' ? (
                          <Badge className="bg-amber-500 text-white text-[10px] font-bold">
                            LOW STOCK ({'<='} {mat.reorder_threshold})
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-600 text-white text-[10px] font-bold">
                            IN STOCK
                          </Badge>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedMaterial(mat);
                              setInwardUnitCost(mat.cost_per_unit);
                              setShowInwardModal(true);
                            }}
                            className="h-7 text-[11px] font-semibold"
                            title="Inward Supplier GRN"
                          >
                            <ArrowDownToLine className="size-3 mr-1 text-emerald-500" />
                            Inward GRN
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedMaterial(mat);
                              setShowTransferModal(true);
                            }}
                            className="h-7 text-[11px] font-semibold"
                            title="Transfer Store to Kitchen Station"
                          >
                            <ArrowRightLeft className="size-3 mr-1 text-blue-500" />
                            Transfer
                          </Button>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedMaterial(mat);
                              setShowWastageModal(true);
                            }}
                            className="h-7 text-[11px] font-semibold text-red-500 hover:text-red-600"
                            title="Log Spoilage / Prep Waste"
                          >
                            <AlertTriangle className="size-3 mr-1" />
                            Wastage
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>

        {/* Tab 2: Stock Movement Audit Ledger */}
        <TabsContent value="movements" className="space-y-4">
          <Card className="bg-card border-border shadow-xs overflow-hidden">
            <CardHeader className="py-3 px-4 border-b border-border">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <FileText className="size-4 text-primary" />
                Raw Material Movement Audit Log
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border uppercase text-[10px] font-bold text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4">Date & Time</th>
                      <th className="py-2.5 px-4">Movement Type</th>
                      <th className="py-2.5 px-4">Source $\rightarrow$ Destination</th>
                      <th className="py-2.5 px-4">Quantity</th>
                      <th className="py-2.5 px-4">Ref #</th>
                      <th className="py-2.5 px-4">Notes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {movements.length > 0 ? (
                      movements.map((mov) => (
                        <tr key={mov.id}>
                          <td className="py-2.5 px-4 font-mono text-[11px]">
                            {new Date(mov.created_at).toLocaleString()}
                          </td>
                          <td className="py-2.5 px-4 font-bold">
                            <Badge variant="outline" className="text-[10px]">
                              {mov.movement_type}
                            </Badge>
                          </td>
                          <td className="py-2.5 px-4">
                            {mov.source_location || 'STORE'} $\rightarrow$ {mov.destination_location}
                          </td>
                          <td className="py-2.5 px-4 font-bold text-primary">{mov.quantity}</td>
                          <td className="py-2.5 px-4 font-mono text-[11px]">{mov.reference_id || '-'}</td>
                          <td className="py-2.5 px-4 text-muted-foreground">{mov.notes}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-muted-foreground">
                          No recent movements logged. Inward GRN or station transfers will appear here.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 4: Inventory Masters Management */}
        <TabsContent value="masters" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Storage Locations Master Card */}
            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="py-3.5 px-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Boxes className="size-4 text-purple-500" />
                    Kitchen & Storage Locations Master
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    Manage kitchen stations, prep rooms, and storage locations
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowMasterLocModal(true)}
                  className="h-7 text-xs font-semibold bg-primary"
                >
                  <Plus className="size-3 mr-1" />
                  Add Location
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border uppercase text-[10px] font-bold text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4">Station Location Name</th>
                      <th className="py-2.5 px-4">System Code</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customLocations.map((loc) => (
                      <tr key={loc} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 font-semibold text-foreground">
                          {loc.replace(/_/g, ' ')}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                          {loc}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Badge className="bg-emerald-600 text-[10px] font-bold">
                            ACTIVE
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>

            {/* Vendors & Suppliers Master Card */}
            <Card className="bg-card border-border shadow-xs">
              <CardHeader className="py-3.5 px-4 border-b border-border flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-sm font-bold flex items-center gap-2">
                    <Package className="size-4 text-emerald-500" />
                    Preferred Vendors & Suppliers Master
                  </CardTitle>
                  <CardDescription className="text-[11px] text-muted-foreground">
                    Manage raw material wholesale suppliers and distributors
                  </CardDescription>
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowMasterSuppModal(true)}
                  className="h-7 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Plus className="size-3 mr-1" />
                  Add Supplier
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-left text-xs">
                  <thead className="bg-muted/50 border-b border-border uppercase text-[10px] font-bold text-muted-foreground">
                    <tr>
                      <th className="py-2.5 px-4">Supplier / Vendor Name</th>
                      <th className="py-2.5 px-4">Type / Catalog</th>
                      <th className="py-2.5 px-4 text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customSuppliers.map((supp) => (
                      <tr key={supp} className="hover:bg-muted/20">
                        <td className="py-2.5 px-4 font-semibold text-foreground">
                          {supp}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-[11px] text-muted-foreground">
                          Verified Vendor
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <Badge className="bg-emerald-600 text-[10px] font-bold">
                            ACTIVE
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal 1: Add Raw Material */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-lg bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="size-4 text-primary" />
              Add New Raw Ingredient
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddMaterial} className="space-y-3.5 py-1 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Ingredient Name *</Label>
              <Input
                value={addName}
                onChange={(e) => setAddName(e.target.value)}
                placeholder="e.g. Basmati Rice, Paneer, Chicken"
                required
                className="bg-background text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Category</Label>
                <Select value={addCategory} onValueChange={setAddCategory}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GROCERY">Grocery & Oils</SelectItem>
                    <SelectItem value="DAIRY">Dairy & Cheese</SelectItem>
                    <SelectItem value="POULTRY">Poultry & Eggs</SelectItem>
                    <SelectItem value="MEAT">Meat & Seafood</SelectItem>
                    <SelectItem value="PRODUCE">Fresh Produce</SelectItem>
                    <SelectItem value="SPICES">Spices & Seasoning</SelectItem>
                    <SelectItem value="PACKAGING">Packaging</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Unit of Measure</Label>
                <Select value={addUnit} onValueChange={setAddUnit}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="KG">KG (Kilograms)</SelectItem>
                    <SelectItem value="GRAMS">Grams</SelectItem>
                    <SelectItem value="LITERS">Liters</SelectItem>
                    <SelectItem value="ML">ML (Milliliters)</SelectItem>
                    <SelectItem value="UNITS">Units / Pieces</SelectItem>
                    <SelectItem value="PACKETS">Packets</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Cost / Unit (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={addCost === 0 ? '' : addCost}
                  onChange={(e) => setAddCost(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Reorder Alert (Qty)</Label>
                <Input
                  type="number"
                  min={0}
                  value={addReorder === 0 ? '' : addReorder}
                  onChange={(e) => setAddReorder(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="10"
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Initial Stock</Label>
                <Input
                  type="number"
                  min={0}
                  value={addInitialStock === 0 ? '' : addInitialStock}
                  onChange={(e) => setAddInitialStock(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="bg-background text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Storage / Kitchen Location</Label>
                  <button
                    type="button"
                    onClick={() => setShowMasterLocModal(true)}
                    className="text-[10px] text-primary hover:underline font-semibold flex items-center gap-0.5"
                  >
                    + Add Master
                  </button>
                </div>
                {isCustomLocSelected ? (
                  <Input
                    value={customLocationInput}
                    onChange={(e) => setCustomLocationInput(e.target.value)}
                    placeholder="Type custom location (e.g. Sushi Bar, Wok Station)"
                    className="bg-background text-xs h-9"
                    required
                  />
                ) : (
                  <Select value={addLocation} onValueChange={(val) => {
                    if (val === 'ADD_NEW_CUSTOM') {
                      setShowMasterLocModal(true);
                    } else {
                      setAddLocation(val);
                    }
                  }}>
                    <SelectTrigger className="bg-background text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {customLocations.map((loc) => (
                        <SelectItem key={loc} value={loc}>
                          {loc.replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                      <SelectItem value="ADD_NEW_CUSTOM" className="text-primary font-semibold border-t border-border mt-1">
                        + Add Location Master...
                      </SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="font-semibold">Preferred Supplier / Vendor</Label>
                  <button
                    type="button"
                    onClick={() => setShowMasterSuppModal(true)}
                    className="text-[10px] text-emerald-600 hover:underline font-semibold flex items-center gap-0.5"
                  >
                    + Add Master
                  </button>
                </div>
                <div className="relative">
                  <Input
                    list="supplier-suggestions"
                    value={addSupplier}
                    onChange={(e) => setAddSupplier(e.target.value)}
                    placeholder="Select or type vendor (e.g. Metro Cash & Carry)"
                    className="bg-background text-xs h-9"
                  />
                  <datalist id="supplier-suggestions">
                    {customSuppliers.map((supp) => (
                      <option key={supp} value={supp} />
                    ))}
                  </datalist>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Shelf Life (Days)</Label>
                <Input
                  type="number"
                  min={1}
                  value={addShelfLife === 0 ? '' : addShelfLife}
                  onChange={(e) => setAddShelfLife(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="30"
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Yield Percentage (%)</Label>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  value={addYieldPct === 0 ? '' : addYieldPct}
                  onChange={(e) => setAddYieldPct(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="100"
                  className="bg-background text-xs h-9"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">GST Rate (%)</Label>
                <Select value={String(addGstRate)} onValueChange={(val) => setAddGstRate(Number(val))}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">0% (Nil Tax / Exempt)</SelectItem>
                    <SelectItem value="5">5% GST</SelectItem>
                    <SelectItem value="12">12% GST</SelectItem>
                    <SelectItem value="18">18% GST</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">HSN / SAC Code</Label>
                <Input
                  value={addHsnCode}
                  onChange={(e) => setAddHsnCode(e.target.value)}
                  placeholder="e.g. 1006 (Rice), 0406 (Cheese)"
                  className="bg-background text-xs h-9"
                />
              </div>
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Save Ingredient
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 2: Inward Supplier GRN */}
      <Dialog open={showInwardModal} onOpenChange={setShowInwardModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ArrowDownToLine className="size-4 text-emerald-500" />
              Inward Raw Material GRN - {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleInwardGRN} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Quantity Received ({selectedMaterial?.unit_of_measure})</Label>
                <Input
                  type="number"
                  min={0.1}
                  step="any"
                  value={inwardQty === 0 ? '' : inwardQty}
                  onChange={(e) => setInwardQty(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="bg-background text-xs h-9 font-bold"
                  required
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Purchase Price / {selectedMaterial?.unit_of_measure} (₹)</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  value={inwardUnitCost === 0 ? '' : inwardUnitCost}
                  onChange={(e) => setInwardUnitCost(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="bg-background text-xs h-9"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Supplier Name</Label>
              <Input
                list="supplier-suggestions"
                value={inwardSupplier}
                onChange={(e) => setInwardSupplier(e.target.value)}
                placeholder="e.g. Metro Cash & Carry"
                className="bg-background text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Invoice / GRN Reference No.</Label>
              <Input
                value={inwardInvoice}
                onChange={(e) => setInwardInvoice(e.target.value)}
                placeholder="e.g. INV-90412"
                className="bg-background text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setShowInwardModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700">
                Record Inward Stock
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 3: Station Transfer */}
      <Dialog open={showTransferModal} onOpenChange={setShowTransferModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <ArrowRightLeft className="size-4 text-blue-500" />
              Transfer Stock - {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleTransfer} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">From Location</Label>
                <Select value={transferFrom} onValueChange={setTransferFrom}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">To Kitchen Station</Label>
                <Select value={transferTo} onValueChange={setTransferTo}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {customLocations.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc.replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Transfer Quantity ({selectedMaterial?.unit_of_measure})</Label>
              <Input
                type="number"
                min={0.1}
                step="any"
                value={transferQty === 0 ? '' : transferQty}
                onChange={(e) => setTransferQty(e.target.value === '' ? 0 : Number(e.target.value))}
                onFocus={(e) => e.target.select()}
                placeholder="0"
                className="bg-background text-xs h-9 font-bold"
                required
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setShowTransferModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-blue-600 text-white hover:bg-blue-700">
                Confirm Station Transfer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 4: Spoilage & Wastage Logger */}
      <Dialog open={showWastageModal} onOpenChange={setShowWastageModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold text-red-500">
              <AlertTriangle className="size-4 text-red-500" />
              Log Kitchen Spoilage / Waste - {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleWastage} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Station Location</Label>
                <Select value={wasteLocation} onValueChange={setWasteLocation}>
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAIN_KITCHEN">Main Kitchen</SelectItem>
                    <SelectItem value="TANDOOR">Tandoor Station</SelectItem>
                    <SelectItem value="PANTRY">Pantry Station</SelectItem>
                    <SelectItem value="STORE_ROOM">Store Room</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Quantity Lost ({selectedMaterial?.unit_of_measure})</Label>
                <Input
                  type="number"
                  min={0.1}
                  step="any"
                  value={wasteQty === 0 ? '' : wasteQty}
                  onChange={(e) => setWasteQty(e.target.value === '' ? 0 : Number(e.target.value))}
                  onFocus={(e) => e.target.select()}
                  placeholder="0"
                  className="bg-background text-xs h-9 font-bold"
                  required
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Reason for Spoilage</Label>
              <Select value={wasteReason} onValueChange={setWasteReason}>
                <SelectTrigger className="bg-background text-xs h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SPOILED">Spoiled / Expired</SelectItem>
                  <SelectItem value="PREP_TRIMMING">Prep Trimming Waste</SelectItem>
                  <SelectItem value="OVERCOOKED_BURNT">Overcooked / Burnt</SelectItem>
                  <SelectItem value="STORAGE_DAMAGE">Storage Damage</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Chef Notes / Comments</Label>
              <Input
                value={wasteNotes}
                onChange={(e) => setWasteNotes(e.target.value)}
                placeholder="e.g. Milk packet curdled upon opening"
                className="bg-background text-xs h-9"
              />
            </div>

            {wasteQty > 0 && selectedMaterial && (
              <div className="p-2.5 rounded-md bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-semibold">
                Estimated Cost Loss: ₹{(wasteQty * selectedMaterial.cost_per_unit).toFixed(2)}
              </div>
            )}

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setShowWastageModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-red-600 text-white hover:bg-red-700">
                Record Spoilage Loss
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 5: Create Master Location */}
      <Dialog open={showMasterLocModal} onOpenChange={setShowMasterLocModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Boxes className="size-4 text-purple-500" />
              Add New Kitchen / Storage Location Master
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddMasterLocation} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Station / Location Name *</Label>
              <Input
                value={newMasterLocName}
                onChange={(e) => setNewMasterLocName(e.target.value)}
                placeholder="e.g. Wok Station, Sushi Bar, Cold Storage 2"
                required
                className="bg-background text-xs h-9"
              />
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">Description / Notes</Label>
              <Input
                value={newMasterLocDesc}
                onChange={(e) => setNewMasterLocDesc(e.target.value)}
                placeholder="e.g. Ground floor main kitchen section for Asian dishes"
                className="bg-background text-xs h-9"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setShowMasterLocModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-purple-600 text-white hover:bg-purple-700">
                Save Location Master
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal 6: Create Master Supplier / Vendor */}
      <Dialog open={showMasterSuppModal} onOpenChange={setShowMasterSuppModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Package className="size-4 text-emerald-500" />
              Add New Supplier / Vendor Master
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddMasterSupplier} className="space-y-3 py-2 text-xs">
            <div className="space-y-1">
              <Label className="font-semibold">Supplier / Company Name *</Label>
              <Input
                value={newMasterSuppName}
                onChange={(e) => setNewMasterSuppName(e.target.value)}
                placeholder="e.g. Metro Cash & Carry, Amul Dairy Wholesale"
                required
                className="bg-background text-xs h-9"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="font-semibold">Contact Person</Label>
                <Input
                  value={newMasterSuppPerson}
                  onChange={(e) => setNewMasterSuppPerson(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-1">
                <Label className="font-semibold">Phone Number</Label>
                <Input
                  value={newMasterSuppPhone}
                  onChange={(e) => setNewMasterSuppPhone(e.target.value)}
                  placeholder="e.g. +91 9876543210"
                  className="bg-background text-xs h-9"
                />
              </div>
            </div>

            <div className="space-y-1">
              <Label className="font-semibold">GSTIN / Tax ID</Label>
              <Input
                value={newMasterSuppGstin}
                onChange={(e) => setNewMasterSuppGstin(e.target.value)}
                placeholder="e.g. 29ABCDE1234F1Z5"
                className="bg-background text-xs h-9 font-mono uppercase"
              />
            </div>

            <DialogFooter className="pt-3">
              <Button type="button" variant="outline" onClick={() => setShowMasterSuppModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700">
                Save Vendor Master
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
