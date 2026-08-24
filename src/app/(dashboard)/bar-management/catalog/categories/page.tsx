'use client';

import React, { useState } from 'react';
import { Tag, Plus, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

export default function BarCategoriesPage() {
  const [categories, setCategories] = useState([
    { id: '1', name: 'SINGLE MALT WHISKY', excise: 'IMFL', taxRate: '18%' },
    { id: '2', name: 'BLENDED SCOTCH', excise: 'IMFL', taxRate: '18%' },
    { id: '3', name: 'DARK RUM', excise: 'IMFL', taxRate: '18%' },
    { id: '4', name: 'VODKA & SPIRITS', excise: 'IMFL', taxRate: '18%' },
    { id: '5', name: 'CRAFT DRAFT BEER', excise: 'CRAFT BEER', taxRate: '18%' },
    { id: '6', name: 'IMPORTED WINE', excise: 'IFL', taxRate: '18%' },
  ]);

  const [search, setSearch] = useState('');
  const [newCatName, setNewCatName] = useState('');

  const handleAddCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName) return;
    const cat = {
      id: `c_${Date.now()}`,
      name: newCatName.toUpperCase(),
      excise: 'IMFL',
      taxRate: '18%',
    };
    setCategories((prev) => [cat, ...prev]);
    toast.success(`Category "${newCatName}" pre-added to catalog!`);
    setNewCatName('');
  };

  const filtered = categories.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Pre-added Liquor Categories</h1>
        <p className="text-sm text-muted-foreground">
          Pre-configure categories (Whisky, Rum, Beer, Wine) so product creation auto-populates category rules.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Form Card */}
        <Card className="bg-card border-border h-fit">
          <CardHeader className="py-4 px-6 border-b border-border">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Plus className="size-4 text-primary" />
              Pre-Add New Category
            </CardTitle>
          </CardHeader>
          <CardContent className="p-6">
            <form onSubmit={handleAddCategory} className="space-y-4 text-xs">
              <div className="space-y-1.5">
                <Label>Category Name</Label>
                <Input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. TEQUILA, BOTANICAL GIN"
                  required
                />
              </div>

              <Button type="submit" className="w-full bg-primary font-bold mt-2">
                Pre-Add Category
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* List */}
        <div className="md:col-span-2 space-y-4">
          <div className="relative max-w-sm">
            <Search className="size-4 absolute left-3 top-2.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search pre-added categories..."
              className="pl-9 text-xs"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((c) => (
              <Card key={c.id} className="p-4 bg-card border-border flex justify-between items-center text-xs">
                <div>
                  <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                    <Tag className="size-3.5 text-primary" />
                    {c.name}
                  </h4>
                  <p className="text-muted-foreground mt-0.5">Excise: {c.excise}</p>
                </div>
                <Badge variant="outline" className="text-[10px]">{c.taxRate} GST</Badge>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
