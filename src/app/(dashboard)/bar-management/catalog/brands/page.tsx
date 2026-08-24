'use client';

import React, { useState } from 'react';
import { Bookmark, Plus, Search, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function BarBrandsPage() {
  const [brands, setBrands] = useState([
    { id: '1', name: 'Glenfiddich', manufacturer: 'William Grant & Sons', category: 'Single Malt' },
    { id: '2', name: "Jack Daniel's", manufacturer: 'Brown-Forman', category: 'Tennessee Whiskey' },
    { id: '3', name: 'Old Monk', manufacturer: 'Mohan Meakin', category: 'Dark Rum' },
    { id: '4', name: 'Absolut', manufacturer: 'Pernod Ricard', category: 'Swedish Vodka' },
    { id: '5', name: 'Heineken', manufacturer: 'Heineken N.V.', category: 'Lager Beer' },
    { id: '6', name: 'Chivas Regal', manufacturer: 'Pernod Ricard', category: 'Blended Scotch' },
  ]);

  const [search, setSearch] = useState('');
  const [newBrandName, setNewBrandName] = useState('');
  const [newManufacturer, setNewManufacturer] = useState('');

  const handleAddBrand = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBrandName) return;
    const brand = {
      id: `b_${Date.now()}`,
      name: newBrandName,
      manufacturer: newManufacturer || 'Independent Producer',
      category: 'Spirits & Beverages',
    };
    setBrands((prev) => [brand, ...prev]);
    toast.success(`Brand "${newBrandName}" pre-added to catalog!`);
    setNewBrandName('');
    setNewManufacturer('');
  };

  const filtered = brands.filter(
    (b) =>
      b.name.toLowerCase().includes(search.toLowerCase()) ||
      b.manufacturer.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pre-added Brands Master List</h1>
        <p className="text-sm text-muted-foreground">
          Pre-configure all liquor brands so products can fetch and auto-populate manufacturer & category data.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card className="bg-card border-border h-fit">
          <CardHeader className="py-4 px-6 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Pre-Add New Brand
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleAddBrand} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label>Brand Name</Label>
                <Input
                  value={newBrandName}
                  onChange={(e) => setNewBrandName(e.target.value)}
                  placeholder="e.g. Macallan, Grey Goose"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label>Manufacturer / Distillery</Label>
                <Input
                  value={newManufacturer}
                  onChange={(e) => setNewManufacturer(e.target.value)}
                  placeholder="e.g. Edrington Group"
                />
              </div>

              <Button type="submit" className="w-full bg-primary font-bold mt-2">
                Pre-Add Brand
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Brands List */}
        <div className="md:col-span-2 space-y-4">
          <div className="relative max-w-sm">
            <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pre-added brands..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((b) => (
              <Card key={b.id} className="p-4 bg-card border-border flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Bookmark className="size-3.5 text-primary" />
                    {b.name}
                  </h4>
                  <p className="text-muted-foreground mt-0.5">{b.manufacturer}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
