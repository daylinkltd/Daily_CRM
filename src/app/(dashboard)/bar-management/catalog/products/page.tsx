'use client';

import React, { useState } from 'react';
import { Wine, Plus, Search, Tag, Scale, Package, Check, Trash2, Edit2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface LiquorProduct {
  id: string;
  name: string;
  category: string;
  brand: string;
  bottleSizeMl: number;
  bottlesPerCase: number;
  prices: {
    '30ml'?: number;
    '60ml'?: number;
    bottle?: number;
    pint?: number;
    can?: number;
  };
}

export default function BarCatalogProductsPage() {
  const [products, setProducts] = useState<LiquorProduct[]>([
    {
      id: '1',
      name: 'Glenfiddich 12 Single Malt',
      category: 'WHISKY',
      brand: 'Glenfiddich',
      bottleSizeMl: 750,
      bottlesPerCase: 12,
      prices: { '30ml': 450, '60ml': 850, bottle: 8500 },
    },
    {
      id: '2',
      name: "Jack Daniel's Old No. 7",
      category: 'WHISKY',
      brand: "Jack Daniel's",
      bottleSizeMl: 750,
      bottlesPerCase: 12,
      prices: { '30ml': 320, '60ml': 600, bottle: 5800 },
    },
    {
      id: '3',
      name: 'Old Monk Supreme Rum',
      category: 'RUM',
      brand: 'Old Monk',
      bottleSizeMl: 750,
      bottlesPerCase: 12,
      prices: { '30ml': 150, '60ml': 280, bottle: 2200 },
    },
    {
      id: '4',
      name: 'Absolut Swedish Vodka',
      category: 'VODKA',
      brand: 'Absolut',
      bottleSizeMl: 750,
      bottlesPerCase: 12,
      prices: { '30ml': 260, '60ml': 490, bottle: 4600 },
    },
    {
      id: '5',
      name: 'Heineken Lager Beer',
      category: 'BEER',
      brand: 'Heineken',
      bottleSizeMl: 500,
      bottlesPerCase: 24,
      prices: { can: 280 },
    },
  ]);

  const [brandList, setBrandList] = useState<string[]>([
    'Glenfiddich',
    "Jack Daniel's",
    'Old Monk',
    'Absolut',
    'Heineken',
    'Kingfisher',
    'Chivas Regal',
    'Royal Salute',
    'Bacardi',
    'Smirnoff',
  ]);

  const [categoryList, setCategoryList] = useState<string[]>([
    'WHISKY',
    'RUM',
    'VODKA',
    'GIN',
    'TEQUILA',
    'BEER',
    'WINE',
  ]);

  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [brandDialogOpen, setBrandDialogOpen] = useState(false);
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);

  const [newBrandInput, setNewBrandInput] = useState('');
  const [newCategoryInput, setNewCategoryInput] = useState('');

  // New Product Form State
  const [newProd, setNewProd] = useState({
    name: '',
    category: 'WHISKY',
    brand: 'Glenfiddich',
    bottleSizeMl: '750',
    bottlesPerCase: '12',
    price30ml: '',
    price60ml: '',
    priceBottle: '',
  });

  const handleAddBrandSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandInput.trim()) return;
    const name = newBrandInput.trim();
    if (!brandList.includes(name)) {
      setBrandList((prev) => [...prev, name]);
    }
    setNewProd((prev) => ({ ...prev, brand: name }));
    toast.success(`Brand "${name}" added to catalog!`);
    setNewBrandInput('');
    setBrandDialogOpen(false);
  };

  const handleAddCategorySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryInput.trim()) return;
    const name = newCategoryInput.trim().toUpperCase();
    if (!categoryList.includes(name)) {
      setCategoryList((prev) => [...prev, name]);
    }
    setNewProd((prev) => ({ ...prev, category: name }));
    toast.success(`Category "${name}" added to catalog!`);
    setNewCategoryInput('');
    setCategoryDialogOpen(false);
  };

  const handleAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProd.name || !newProd.brand) {
      toast.error('Please fill product name and brand');
      return;
    }

    const created: LiquorProduct = {
      id: `prod_${Date.now()}`,
      name: newProd.name,
      category: newProd.category,
      brand: newProd.brand,
      bottleSizeMl: Number(newProd.bottleSizeMl || 750),
      bottlesPerCase: Number(newProd.bottlesPerCase || 12),
      prices: {
        '30ml': newProd.price30ml ? Number(newProd.price30ml) : undefined,
        '60ml': newProd.price60ml ? Number(newProd.price60ml) : undefined,
        bottle: newProd.priceBottle ? Number(newProd.priceBottle) : undefined,
      },
    };

    setProducts((prev) => [created, ...prev]);
    toast.success(`Added ${newProd.name} to Liquor Catalog!`);
    setDialogOpen(false);
    setNewProd({
      name: '',
      category: categoryList[0] || 'WHISKY',
      brand: brandList[0] || 'Glenfiddich',
      bottleSizeMl: '750',
      bottlesPerCase: '12',
      price30ml: '',
      price60ml: '',
      priceBottle: '',
    });
  };

  const filtered = products.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.brand.toLowerCase().includes(search.toLowerCase()) ||
      p.category.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Liquor Products & Brand Catalog</h1>
          <p className="text-sm text-muted-foreground">
            Initial setup master list for all spirits, beers, wines, bottle sizes, and portion prices.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setBrandDialogOpen(true)} className="text-xs font-semibold">
            <Plus className="size-3.5 mr-1" />
            + Add Brand
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCategoryDialogOpen(true)} className="text-xs font-semibold">
            <Plus className="size-3.5 mr-1" />
            + Add Category
          </Button>
          <Button size="sm" onClick={() => setDialogOpen(true)} className="bg-primary text-primary-foreground font-bold text-xs">
            <Plus className="size-3.5 mr-1" />
            + Add New Liquor Item
          </Button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search liquor brand, category, or bottle size..."
            className="pl-9 text-xs"
          />
        </div>
      </div>

      {/* Catalog Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item) => (
          <Card key={item.id} className="bg-card border-border hover:border-primary/40 transition-colors flex flex-col justify-between p-5">
            <div>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-foreground leading-snug">{item.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Brand: {item.brand}</p>
                </div>
                <Badge variant="secondary" className="text-[10px] shrink-0 font-semibold">{item.category}</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2 text-xs p-3 rounded-lg bg-muted/40 border border-border/50">
                <div>
                  <span className="text-muted-foreground text-[10px]">Bottle Size</span>
                  <p className="font-bold text-foreground">{item.bottleSizeMl} ml</p>
                </div>
                <div>
                  <span className="text-muted-foreground text-[10px]">Case Ratio</span>
                  <p className="font-bold text-foreground">{item.bottlesPerCase} Btl / Case</p>
                </div>
              </div>

              {/* Portion Prices */}
              <div className="mt-3 space-y-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Portion Menu Prices:</span>
                <div className="flex flex-wrap gap-1.5">
                  {item.prices['30ml'] && (
                    <Badge variant="outline" className="text-[10px]">30ml: ₹{item.prices['30ml']}</Badge>
                  )}
                  {item.prices['60ml'] && (
                    <Badge variant="outline" className="text-[10px]">60ml: ₹{item.prices['60ml']}</Badge>
                  )}
                  {item.prices.bottle && (
                    <Badge variant="outline" className="text-[10px]">Bottle: ₹{item.prices.bottle}</Badge>
                  )}
                  {item.prices.can && (
                    <Badge variant="outline" className="text-[10px]">Can: ₹{item.prices.can}</Badge>
                  )}
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Add New Product Dialog Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Wine className="size-5 text-primary" />
              Add New Liquor Product to Catalog
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddProduct} className="space-y-3 text-xs pt-2">
            <div className="space-y-1">
              <Label>Product / Liquor Name</Label>
              <Input
                value={newProd.name}
                onChange={(e) => setNewProd((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Royal Salute 21 Blended Scotch"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Brand (Pre-added Catalog)</Label>
                <Select
                  value={newProd.brand}
                  onValueChange={(val) => {
                    if (val === 'ADD_NEW_BRAND') {
                      const name = prompt('Enter new Liquor Brand Name (e.g. Macallan, Grey Goose):');
                      if (name) setNewProd((prev) => ({ ...prev, brand: name }));
                    } else {
                      setNewProd((prev) => ({ ...prev, brand: val }));
                    }
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select Brand" />
                  </SelectTrigger>
                  <SelectContent>
                    {brandList.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                    <SelectItem value="ADD_NEW_BRAND" className="text-primary font-bold">+ Add New Brand</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label>Category (Pre-added Catalog)</Label>
                <Select
                  value={newProd.category}
                  onValueChange={(val) => {
                    if (val === 'ADD_NEW_CAT') {
                      setCategoryDialogOpen(true);
                    } else {
                      setNewProd((prev) => ({ ...prev, category: val }));
                    }
                  }}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Select Category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoryList.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                    <SelectItem value="ADD_NEW_CAT" className="text-primary font-bold">+ Add New Category</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Packaging Template Selection */}
            <div className="space-y-1">
              <Label className="font-semibold text-primary">Packaging Template (Pre-configured Case Ratios)</Label>
              <Select
                onValueChange={(val) => {
                  if (val === 'QUART') {
                    setNewProd((prev) => ({ ...prev, bottlesPerCase: '12', bottleSizeMl: '750' }));
                  } else if (val === 'PINT') {
                    setNewProd((prev) => ({ ...prev, bottlesPerCase: '24', bottleSizeMl: '375' }));
                  } else if (val === 'NIP') {
                    setNewProd((prev) => ({ ...prev, bottlesPerCase: '48', bottleSizeMl: '180' }));
                  } else if (val === 'BEER_BOTTLE') {
                    setNewProd((prev) => ({ ...prev, bottlesPerCase: '12', bottleSizeMl: '650' }));
                  } else if (val === 'BEER_CAN') {
                    setNewProd((prev) => ({ ...prev, bottlesPerCase: '24', bottleSizeMl: '500' }));
                  } else if (val === 'BEER_CAN_330') {
                    setNewProd((prev) => ({ ...prev, bottlesPerCase: '24', bottleSizeMl: '330' }));
                  } else if (val === 'KEG') {
                    setNewProd((prev) => ({ ...prev, bottlesPerCase: '1', bottleSizeMl: '50000' }));
                  }
                }}
              >
                <SelectTrigger className="bg-background">
                  <SelectValue placeholder="Fetch packaging template ratio..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="QUART">Quart Case — 12 Bottles × 750ml (9.00 L)</SelectItem>
                  <SelectItem value="PINT">Pint Case — 24 Bottles × 375ml (9.00 L)</SelectItem>
                  <SelectItem value="NIP">Nip Case — 48 Bottles × 180ml (8.64 L)</SelectItem>
                  <SelectItem value="BEER_BOTTLE">Beer Bottle Case — 12 Bottles × 650ml (7.80 L)</SelectItem>
                  <SelectItem value="BEER_CAN">Beer Can Case — 24 Cans × 500ml (12.00 L)</SelectItem>
                  <SelectItem value="BEER_CAN_330">Beer Small Can — 24 Cans × 330ml (7.92 L)</SelectItem>
                  <SelectItem value="KEG">Draft Keg — 1 Barrel × 50,000ml (50.00 L)</SelectItem>
                  <SelectItem value="CUSTOM">Custom Packaging Ratio</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Bottle Size (ml)</Label>
                <Input
                  type="number"
                  value={newProd.bottleSizeMl}
                  onChange={(e) => setNewProd((prev) => ({ ...prev, bottleSizeMl: e.target.value }))}
                  required
                />
              </div>

              <div className="space-y-1">
                <Label>Bottles per Case</Label>
                <Input
                  type="number"
                  value={newProd.bottlesPerCase}
                  onChange={(e) => setNewProd((prev) => ({ ...prev, bottlesPerCase: e.target.value }))}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 border-t border-border pt-3">
              <div className="space-y-1">
                <Label>30ml Price (₹)</Label>
                <Input
                  type="number"
                  value={newProd.price30ml}
                  onChange={(e) => setNewProd((prev) => ({ ...prev, price30ml: e.target.value }))}
                  placeholder="350"
                />
              </div>
              <div className="space-y-1">
                <Label>60ml Price (₹)</Label>
                <Input
                  type="number"
                  value={newProd.price60ml}
                  onChange={(e) => setNewProd((prev) => ({ ...prev, price60ml: e.target.value }))}
                  placeholder="650"
                />
              </div>
              <div className="space-y-1">
                <Label>Bottle Price (₹)</Label>
                <Input
                  type="number"
                  value={newProd.priceBottle}
                  onChange={(e) => setNewProd((prev) => ({ ...prev, priceBottle: e.target.value }))}
                  placeholder="6500"
                />
              </div>
            </div>

            <DialogFooter className="pt-4">
              <Button type="submit" className="w-full bg-primary font-bold">
                Save Liquor Item to Catalog
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Brand Modal */}
      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Pre-Add Liquor Brand to Catalog
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddBrandSubmit} className="space-y-3 text-xs pt-2">
            <div className="space-y-1">
              <Label>Brand Name</Label>
              <Input
                value={newBrandInput}
                onChange={(e) => setNewBrandInput(e.target.value)}
                placeholder="e.g. Macallan, Grey Goose, Corona"
                required
              />
            </div>
            <DialogFooter className="pt-3">
              <Button type="submit" className="w-full bg-primary font-bold">
                Pre-Add Brand
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add Category Modal */}
      <Dialog open={categoryDialogOpen} onOpenChange={setCategoryDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Pre-Add Category to Catalog
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleAddCategorySubmit} className="space-y-3 text-xs pt-2">
            <div className="space-y-1">
              <Label>Category Name</Label>
              <Input
                value={newCategoryInput}
                onChange={(e) => setNewCategoryInput(e.target.value)}
                placeholder="e.g. SINGLE MALT, CRAFT BEER, TEQUILA"
                required
              />
            </div>
            <DialogFooter className="pt-3">
              <Button type="submit" className="w-full bg-primary font-bold">
                Pre-Add Category
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
