'use client';

import React, { useState, useEffect } from 'react';
import {
  UtensilsCrossed,
  Plus,
  Search,
  Tag,
  Clock,
  Flame,
  Check,
  Trash2,
  Edit2,
  ShieldAlert,
  Layers,
  Sparkles,
  Sliders,
  DollarSign,
  Building2,
  ChefHat,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';

interface FoodVariant {
  id: string;
  name: string;
  priceOffset: number;
}

interface ModifierOption {
  id: string;
  name: string;
  price: number;
  ingredientName?: string;
  ingredientQty?: string;
}

interface ModifierGroup {
  id: string;
  groupName: string;
  minSelection: number;
  maxSelection: number;
  options: ModifierOption[];
}

interface RecipeIngredient {
  ingredientName: string;
  quantity: string;
}

interface FoodItem {
  id: string;
  name: string;
  category: string;
  dietaryType: 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN';
  kitchenStation: 'MAIN_KITCHEN' | 'TANDOOR' | 'PANTRY' | 'CHINESE' | 'BAKERY';
  prepTimeMinutes: number;
  spicinessLevel: number; // 0: Mild, 1: Medium, 2: Spicy, 3: Extra Hot
  allergens: string[];
  basePrice: number;
  branchPrices: Record<string, number>; // branch_id -> price
  isAvailable: boolean;
  variants: FoodVariant[];
  modifierGroups: ModifierGroup[];
  recipeBom: RecipeIngredient[];
}

export default function BarFoodCatalogPage() {
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedStation, setSelectedStation] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedItemForDetails, setSelectedItemForDetails] = useState<FoodItem | null>(null);

  const [foodItems, setFoodItems] = useState<FoodItem[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('bar_food_catalog_items');
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch (e) {
          console.error(e);
        }
      }
    }
    return [
      {
        id: '1',
        name: 'Paneer Tikka Tandoori',
        category: 'STARTERS',
        dietaryType: 'VEG',
        kitchenStation: 'TANDOOR',
        prepTimeMinutes: 18,
        spicinessLevel: 2,
        allergens: ['Dairy'],
        basePrice: 280,
        branchPrices: { 'Main Branch': 280, 'Rooftop Bar': 320 },
        isAvailable: true,
        variants: [
          { id: 'v1', name: 'Half Plate (4 Pcs)', priceOffset: -100 },
          { id: 'v2', name: 'Full Plate (8 Pcs)', priceOffset: 0 },
        ],
        modifierGroups: [
          {
            id: 'mg1',
            groupName: 'Extra Dips & Sauce',
            minSelection: 0,
            maxSelection: 2,
            options: [
              { id: 'mo1', name: 'Mint Chutney', price: 20 },
              { id: 'mo2', name: 'Extra Butter Pour', price: 30, ingredientName: 'Butter', ingredientQty: '25g' },
            ],
          },
        ],
        recipeBom: [
          { ingredientName: 'Fresh Cottage Cheese (Paneer)', quantity: '200g' },
          { ingredientName: 'Capsicum & Diced Onion', quantity: '80g' },
          { ingredientName: 'Tandoori Masala & Mustard Oil', quantity: '30g' },
        ],
      },
      {
        id: '2',
        name: 'Butter Chicken Murgh Khas',
        category: 'MAIN_COURSE',
        dietaryType: 'NON_VEG',
        kitchenStation: 'MAIN_KITCHEN',
        prepTimeMinutes: 25,
        spicinessLevel: 1,
        allergens: ['Dairy', 'Nuts'],
        basePrice: 380,
        branchPrices: { 'Main Branch': 380, 'Rooftop Bar': 420 },
        isAvailable: true,
        variants: [
          { id: 'v3', name: 'Half Portion', priceOffset: -140 },
          { id: 'v4', name: 'Full Portion', priceOffset: 0 },
        ],
        modifierGroups: [
          {
            id: 'mg2',
            groupName: 'Bread Accompanying',
            minSelection: 0,
            maxSelection: 3,
            options: [
              { id: 'mo3', name: 'Butter Naan', price: 60 },
              { id: 'mo4', name: 'Garlic Roti', price: 40 },
            ],
          },
        ],
        recipeBom: [
          { ingredientName: 'Raw Bone-in Chicken', quantity: '350g' },
          { ingredientName: 'Tomato Cashew Gravy Base', quantity: '250ml' },
          { ingredientName: 'Amul Fresh Cream', quantity: '40ml' },
        ],
      },
      {
        id: '3',
        name: 'Chilli Chicken Dry (Indo-Chinese)',
        category: 'STARTERS',
        dietaryType: 'NON_VEG',
        kitchenStation: 'CHINESE',
        prepTimeMinutes: 15,
        spicinessLevel: 3,
        allergens: ['Soy', 'Gluten'],
        basePrice: 310,
        branchPrices: { 'Main Branch': 310, 'Rooftop Bar': 350 },
        isAvailable: true,
        variants: [
          { id: 'v5', name: 'Standard Portion', priceOffset: 0 },
        ],
        modifierGroups: [],
        recipeBom: [
          { ingredientName: 'Chicken Breast Cubes', quantity: '250g' },
          { ingredientName: 'Dark Soy & Chilli Sauce', quantity: '40ml' },
          { ingredientName: 'Spring Onion & Capsicum', quantity: '60g' },
        ],
      },
      {
        id: '4',
        name: 'Crispy Salt & Pepper Mushrooms',
        category: 'STARTERS',
        dietaryType: 'VEG',
        kitchenStation: 'PANTRY',
        prepTimeMinutes: 12,
        spicinessLevel: 1,
        allergens: ['Gluten'],
        basePrice: 240,
        branchPrices: { 'Main Branch': 240, 'Rooftop Bar': 270 },
        isAvailable: true,
        variants: [],
        modifierGroups: [],
        recipeBom: [
          { ingredientName: 'Button Mushrooms', quantity: '200g' },
          { ingredientName: 'Crushed Black Pepper & Cornflour', quantity: '30g' },
        ],
      },
    ];
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('bar_food_catalog_items', JSON.stringify(foodItems));
    }
  }, [foodItems]);

  // Form State for Adding New Item
  const [newItem, setNewItem] = useState({
    name: '',
    category: 'STARTERS',
    dietaryType: 'VEG' as 'VEG' | 'NON_VEG' | 'EGG' | 'VEGAN',
    kitchenStation: 'MAIN_KITCHEN' as 'MAIN_KITCHEN' | 'TANDOOR' | 'PANTRY' | 'CHINESE' | 'BAKERY',
    prepTimeMinutes: 15,
    spicinessLevel: 1,
    basePrice: 250,
  });

  const categories = ['ALL', 'STARTERS', 'MAIN_COURSE', 'CHINESE', 'TANDOOR', 'DESSERTS', 'BEVERAGES'];
  const stations = ['ALL', 'MAIN_KITCHEN', 'TANDOOR', 'PANTRY', 'CHINESE', 'BAKERY'];

  const filteredItems = foodItems.filter((item) => {
    const matchesCategory = selectedCategory === 'ALL' || item.category === selectedCategory;
    const matchesStation = selectedStation === 'ALL' || item.kitchenStation === selectedStation;
    const matchesSearch =
      !searchQuery ||
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.category.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesStation && matchesSearch;
  });

  const handleCreateFoodItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name.trim()) {
      toast.error('Please enter food item name');
      return;
    }

    const created: FoodItem = {
      id: Date.now().toString(),
      name: newItem.name,
      category: newItem.category,
      dietaryType: newItem.dietaryType,
      kitchenStation: newItem.kitchenStation,
      prepTimeMinutes: newItem.prepTimeMinutes,
      spicinessLevel: newItem.spicinessLevel,
      allergens: [],
      basePrice: Number(newItem.basePrice),
      branchPrices: { 'Main Branch': Number(newItem.basePrice) },
      isAvailable: true,
      variants: [{ id: `v_${Date.now()}`, name: 'Standard Portion', priceOffset: 0 }],
      modifierGroups: [],
      recipeBom: [],
    };

    setFoodItems([created, ...foodItems]);
    setShowAddModal(false);
    toast.success(`Food item "${newItem.name}" added to Restaurant Catalog!`);
    setNewItem({
      name: '',
      category: 'STARTERS',
      dietaryType: 'VEG',
      kitchenStation: 'MAIN_KITCHEN',
      prepTimeMinutes: 15,
      spicinessLevel: 1,
      basePrice: 250,
    });
  };

  const toggleAvailability = (id: string) => {
    setFoodItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const next = !item.isAvailable;
          toast.info(`${item.name} is now ${next ? 'Available' : 'Temporarily Out of Stock'}`);
          return { ...item, isAvailable: next };
        }
        return item;
      })
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <UtensilsCrossed className="size-6 text-primary" />
            Food & Kitchen Items Catalog
          </h1>
          <p className="text-sm text-muted-foreground">
            Dedicated menu catalog for appetizers, starters, main courses, recipes, and kitchen station routing.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={() => setShowAddModal(true)} size="sm" className="font-bold">
            <Plus className="size-4 mr-1.5" />
            Add New Food Item
          </Button>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-card border border-border rounded-lg shadow-sm">
        {/* Search */}
        <div className="relative flex-1 max-w-sm">
          <Search className="size-4 absolute left-3 top-3 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search dish name, ingredient, station..."
            className="pl-9 bg-background text-xs h-9"
          />
        </div>

        {/* Category & Station Selectors */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
          <div className="flex items-center gap-1">
            <span className="text-xs font-semibold text-muted-foreground mr-1">Category:</span>
            {categories.map((cat) => (
              <Button
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                size="sm"
                onClick={() => setSelectedCategory(cat)}
                className="text-[11px] h-7 px-2.5 shrink-0"
              >
                {cat.replace('_', ' ')}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Food Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((dish) => (
          <Card
            key={dish.id}
            className={`bg-card border transition-all flex flex-col justify-between hover:border-primary/50 ${
              !dish.isAvailable ? 'opacity-60 border-amber-500/40' : 'border-border'
            }`}
          >
            <CardHeader className="pb-3 pt-4 px-4 border-b border-border/50">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    {/* Veg / Non-Veg Indicator */}
                    <span
                      className={`inline-flex items-center justify-center size-4 rounded-sm border ${
                        dish.dietaryType === 'VEG'
                          ? 'border-emerald-600 text-emerald-600 bg-emerald-500/10'
                          : 'border-red-600 text-red-600 bg-red-500/10'
                      }`}
                      title={dish.dietaryType}
                    >
                      <span
                        className={`size-1.5 rounded-full ${
                          dish.dietaryType === 'VEG' ? 'bg-emerald-600' : 'bg-red-600'
                        }`}
                      />
                    </span>

                    <CardTitle className="text-base font-bold leading-tight">{dish.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-[10px]">
                      {dish.category.replace('_', ' ')}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] bg-muted/50">
                      <ChefHat className="size-3 mr-1 text-primary" />
                      {dish.kitchenStation.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-lg font-bold text-foreground">₹{dish.basePrice}</div>
                  <span className="text-[10px] text-muted-foreground">Base Price</span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-4 space-y-3 flex-1 flex flex-col justify-between">
              {/* Dish Metadata Pills */}
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="size-3.5 text-primary" />
                  {dish.prepTimeMinutes} mins prep
                </span>
                <span className="flex items-center gap-1">
                  <Flame className="size-3.5 text-amber-500" />
                  {dish.spicinessLevel === 0 ? 'Mild' : dish.spicinessLevel === 1 ? 'Medium' : 'Spicy'}
                </span>
                {dish.allergens.length > 0 && (
                  <span className="flex items-center gap-1 text-red-400">
                    <ShieldAlert className="size-3.5" />
                    {dish.allergens.join(', ')}
                  </span>
                )}
              </div>

              {/* Variants & Modifiers Summary */}
              <div className="bg-muted/40 p-2.5 rounded-md border border-border/40 text-xs space-y-1.5">
                <div className="flex items-center justify-between text-[11px] font-semibold">
                  <span className="flex items-center gap-1 text-foreground">
                    <Layers className="size-3 text-primary" />
                    {dish.variants.length} Variant(s)
                  </span>
                  <span className="text-muted-foreground">
                    {dish.modifierGroups.length} Modifier Group(s)
                  </span>
                </div>
                {dish.recipeBom.length > 0 && (
                  <div className="text-[10px] text-muted-foreground truncate pt-1 border-t border-border/30">
                    <span className="font-semibold text-foreground">Recipe Ingredients: </span>
                    {dish.recipeBom.map((r) => `${r.ingredientName} (${r.quantity})`).join(', ')}
                  </div>
                )}
              </div>

              {/* Branch Pricing Overrides */}
              <div className="pt-2 border-t border-border/40 flex items-center justify-between text-xs">
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Building2 className="size-3.5 text-blue-500" />
                  <span>Rooftop Bar Price:</span>
                  <span className="font-bold text-foreground">₹{dish.branchPrices['Rooftop Bar'] || dish.basePrice}</span>
                </div>

                <Button
                  size="sm"
                  variant={dish.isAvailable ? 'outline' : 'secondary'}
                  onClick={() => toggleAvailability(dish.id)}
                  className="h-7 text-[10px] font-semibold"
                >
                  {dish.isAvailable ? 'In Stock' : 'Mark Out of Stock'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Add New Food Item Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <UtensilsCrossed className="size-5 text-primary" />
              Add New Food Item to Catalog
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateFoodItem} className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Dish Name</Label>
              <Input
                value={newItem.name}
                onChange={(e) => setNewItem({ ...newItem, name: e.target.value })}
                placeholder="e.g. Tandoori Paneer Tikka, Chicken Biryani"
                className="bg-background text-xs h-9"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Category</Label>
                <Select
                  value={newItem.category}
                  onValueChange={(val) => setNewItem({ ...newItem, category: val })}
                >
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="STARTERS">Starters / Appetizers</SelectItem>
                    <SelectItem value="MAIN_COURSE">Main Course</SelectItem>
                    <SelectItem value="CHINESE">Indo-Chinese</SelectItem>
                    <SelectItem value="TANDOOR">Tandoor Specials</SelectItem>
                    <SelectItem value="DESSERTS">Desserts</SelectItem>
                    <SelectItem value="BEVERAGES">Beverages & Mocktails</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Dietary Type</Label>
                <Select
                  value={newItem.dietaryType}
                  onValueChange={(val: any) => setNewItem({ ...newItem, dietaryType: val })}
                >
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="VEG">Vegetarian (Veg)</SelectItem>
                    <SelectItem value="NON_VEG">Non-Vegetarian</SelectItem>
                    <SelectItem value="EGG">Contains Egg</SelectItem>
                    <SelectItem value="VEGAN">Vegan</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Kitchen Station Routing</Label>
                <Select
                  value={newItem.kitchenStation}
                  onValueChange={(val: any) => setNewItem({ ...newItem, kitchenStation: val })}
                >
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MAIN_KITCHEN">Main Kitchen</SelectItem>
                    <SelectItem value="TANDOOR">Tandoor Station</SelectItem>
                    <SelectItem value="PANTRY">Pantry / Cold Section</SelectItem>
                    <SelectItem value="CHINESE">Chinese Wok Station</SelectItem>
                    <SelectItem value="BAKERY">Bakery & Desserts</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Base Price (₹)</Label>
                <Input
                  type="number"
                  value={newItem.basePrice}
                  onChange={(e) => setNewItem({ ...newItem, basePrice: Number(e.target.value) })}
                  className="bg-background text-xs h-9 font-mono"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Prep Time (Mins)</Label>
                <Input
                  type="number"
                  value={newItem.prepTimeMinutes}
                  onChange={(e) => setNewItem({ ...newItem, prepTimeMinutes: Number(e.target.value) })}
                  className="bg-background text-xs h-9"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Spiciness Level</Label>
                <Select
                  value={newItem.spicinessLevel.toString()}
                  onValueChange={(val) => setNewItem({ ...newItem, spicinessLevel: Number(val) })}
                >
                  <SelectTrigger className="bg-background text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Mild / Kids Friendly</SelectItem>
                    <SelectItem value="1">Medium Spice</SelectItem>
                    <SelectItem value="2">Spicy</SelectItem>
                    <SelectItem value="3">Extra Hot</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="text-xs">
                Cancel
              </Button>
              <Button type="submit" className="text-xs font-bold bg-primary">
                Save Food Item
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
