"use client";

import { useState, useEffect } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, Plus, Search, Barcode, Tag, Layers, RefreshCw, Printer, X, ShieldCheck, Layers3, DollarSign, Warehouse, Sliders, Sparkles, Stethoscope, Smartphone, Shirt, Gem, Settings, Car, BookOpen, Wrench, Armchair, Utensils, Factory, Glasses, Sparkle, Dog, FlaskConical, Sprout, Baby, PlusCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { BarcodeTagModal } from "@/components/commerce/barcode-tag-modal";
import { sanitizeErrorMessage } from "@/lib/commerce/barcode-utils";
import Link from "next/link";

interface CustomFieldDef {
  id: string;
  name: string;
  type: "TEXT" | "NUMBER" | "DROPDOWN" | "BOOLEAN";
  options?: string;
  value?: any;
}

export default function ProductsPage() {
  const { activeWorkspace } = useWorkspace();
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeTab, setActiveTab] = useState<"BASIC" | "UNITS_PRICING" | "TAX" | "INVENTORY" | "SETTINGS" | "CUSTOM_FIELDS">("BASIC");
  const [activeTemplate, setActiveTemplate] = useState("GARMENT");

  // Barcode Tag Modal state
  const [showTagModal, setShowTagModal] = useState(false);
  const [selectedBarcodeProduct, setSelectedBarcodeProduct] = useState<any | null>(null);

  // Core Form State
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [aliasName, setAliasName] = useState("");
  const [manufacturer, setManufacturer] = useState("");
  const [department, setDepartment] = useState("");
  const [brandName, setBrandName] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [subCategoryName, setSubCategoryName] = useState("");
  const [preferredSupplier, setPreferredSupplier] = useState("");
  const [productStatus, setProductStatus] = useState("ACTIVE");

  const [baseUnit, setBaseUnit] = useState("PCS");
  const [purchaseUnit, setPurchaseUnit] = useState("BOX");
  const [conversionFactor, setConversionFactor] = useState("12");
  const [purchasePrice, setPurchasePrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [wholesaleRate, setWholesaleRate] = useState("");
  const [distributorRate, setDistributorRate] = useState("");
  const [onlineRate, setOnlineRate] = useState("");
  const [mrp, setMrp] = useState("");
  const [minSellingPrice, setMinSellingPrice] = useState("");

  const [hsnSacCode, setHsnSacCode] = useState("6203");
  const [taxRate, setTaxRate] = useState("5");
  const [cessRate, setCessRate] = useState("0");
  const [isTaxInclusive, setIsTaxInclusive] = useState(true);

  const [initialStock, setInitialStock] = useState("0");
  const [reorderLevel, setReorderLevel] = useState("10");
  const [reorderQuantity, setReorderQuantity] = useState("50");
  const [minStockLevel, setMinStockLevel] = useState("5");
  const [maxStockLevel, setMaxStockLevel] = useState("1000");
  const [shelfNumber, setShelfNumber] = useState("");
  const [binLocation, setBinLocation] = useState("");

  const [allowNegativeStock, setAllowNegativeStock] = useState(false);
  const [trackBatch, setTrackBatch] = useState(false);
  const [trackSerial, setTrackSerial] = useState(false);
  const [trackExpiry, setTrackExpiry] = useState(false);

  // 19 Industry Template Fields
  // Grocery
  const [packSize, setPackSize] = useState("");
  const [netWeight, setNetWeight] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [storageCondition, setStorageCondition] = useState("");
  const [bestBeforeDate, setBestBeforeDate] = useState("");
  const [isOrganic, setIsOrganic] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  const [countryOfOrigin, setCountryOfOrigin] = useState("India");

  // Pharmacy
  const [saltComposition, setSaltComposition] = useState("");
  const [medicineType, setMedicineType] = useState("TABLET");
  const [dosageForm, setDosageForm] = useState("");
  const [strength, setStrength] = useState("");
  const [mfgLicense, setMfgLicense] = useState("");
  const [isScheduleDrug, setIsScheduleDrug] = useState(false);
  const [isControlledDrug, setIsControlledDrug] = useState(false);
  const [expiryAlertDays, setExpiryAlertDays] = useState("60");

  // Garments & Apparel
  const [apparelSize, setApparelSize] = useState("");
  const [apparelColor, setApparelColor] = useState("");
  const [apparelFabric, setApparelFabric] = useState("");
  const [apparelFit, setApparelFit] = useState("");
  const [genderTarget, setGenderTarget] = useState("UNISEX");
  const [seasonCode, setSeasonCode] = useState("");
  const [sleeveType, setSleeveType] = useState("");
  const [neckType, setNeckType] = useState("");
  const [pattern, setPattern] = useState("");
  const [styleCode, setStyleCode] = useState("");

  // Footwear
  const [heelHeight, setHeelHeight] = useState("");
  const [soleMaterial, setSoleMaterial] = useState("");
  const [closureType, setClosureType] = useState("");
  const [isWaterproof, setIsWaterproof] = useState(false);

  // Electronics
  const [modelNumber, setModelNumber] = useState("");
  const [warrantyMonths, setWarrantyMonths] = useState("12");
  const [processor, setProcessor] = useState("");
  const [ramSize, setRamSize] = useState("");
  const [storageCapacity, setStorageCapacity] = useState("");
  const [displaySize, setDisplaySize] = useState("");
  const [batteryCapacity, setBatteryCapacity] = useState("");

  // Jewellery
  const [karatPurity, setKaratPurity] = useState("22K");
  const [grossWeightGrams, setGrossWeightGrams] = useState("");
  const [netWeightGrams, setNetWeightGrams] = useState("");
  const [stoneWeightGrams, setStoneWeightGrams] = useState("");
  const [diamondWeightCarat, setDiamondWeightCarat] = useState("");
  const [makingCharge, setMakingCharge] = useState("");
  const [makingChargeType, setMakingChargeType] = useState("FIXED_PER_GRAM");
  const [wastagePercent, setWastagePercent] = useState("");
  const [hallmarkNumber, setHallmarkNumber] = useState("");

  // Auto Parts
  const [oemPartNumber, setOemPartNumber] = useState("");
  const [vehicleFitment, setVehicleFitment] = useState("");
  const [engineType, setEngineType] = useState("");
  const [vehicleYear, setVehicleYear] = useState("");
  const [partPosition, setPartPosition] = useState("FRONT_LEFT");

  // Books
  const [isbnNumber, setIsbnNumber] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [publisher, setPublisher] = useState("");
  const [edition, setEdition] = useState("");
  const [language, setLanguage] = useState("English");
  const [bindingType, setBindingType] = useState("PAPERBACK");

  // Hardware & Furniture
  const [materialGrade, setMaterialGrade] = useState("");
  const [furnitureDimensions, setFurnitureDimensions] = useState("");
  const [woodMaterialType, setWoodMaterialType] = useState("");
  const [weightCapacityKg, setWeightCapacityKg] = useState("");
  const [isAssemblyRequired, setIsAssemblyRequired] = useState(false);

  // Restaurant & Manufacturing
  const [kotStation, setKotStation] = useState("Main Kitchen");
  const [recipeCode, setRecipeCode] = useState("");
  const [isVeg, setIsVeg] = useState(true);
  const [isJain, setIsJain] = useState(false);
  const [spicyLevel, setSpicyLevel] = useState("MEDIUM");
  const [bomReference, setBomReference] = useState("");
  const [yieldPercent, setYieldPercent] = useState("100");

  // Optical
  const [frameSize, setFrameSize] = useState("");
  const [lensType, setLensType] = useState("SINGLE_VISION");
  const [lensPowerSph, setLensPowerSph] = useState("");
  const [lensCylinderCyl, setLensCylinderCyl] = useState("");
  const [lensAxis, setLensAxis] = useState("");

  // Cosmetics
  const [shadeCode, setShadeCode] = useState("");
  const [skinType, setSkinType] = useState("ALL_SKIN_TYPES");
  const [spfRating, setSpfRating] = useState("");
  const [volumeMl, setVolumeMl] = useState("");

  // Pet Store & Agriculture & Baby
  const [petType, setPetType] = useState("DOG");
  const [petBreed, setPetBreed] = useState("");
  const [seedVariety, setSeedVariety] = useState("");
  const [cropType, setCropType] = useState("");
  const [hazardClass, setHazardClass] = useState("");
  const [unNumber, setUnNumber] = useState("");
  const [babyAgeGroup, setBabyAgeGroup] = useState("");
  const [isBpaFree, setIsBpaFree] = useState(true);

  // Interactive Ad-Hoc Custom Fields Builder
  const [customFields, setCustomFields] = useState<CustomFieldDef[]>([]);
  const [newFieldName, setNewFieldName] = useState("");
  const [newFieldType, setNewFieldType] = useState<"TEXT" | "NUMBER" | "DROPDOWN" | "BOOLEAN">("TEXT");
  const [newFieldOptions, setNewFieldOptions] = useState("");

  const [saving, setSaving] = useState(false);

  // Load Active Industry Template configured once in Master Settings
  const syncTemplateFromSettings = () => {
    let saved = null;
    if (typeof window !== "undefined") {
      if (activeWorkspace?.id) {
        saved = localStorage.getItem(`retail_template_${activeWorkspace.id}`);
      }
      if (!saved) {
        saved = localStorage.getItem("retail_template_active");
      }
    }
    const tmpl = saved || "GARMENT";
    setActiveTemplate(tmpl);
    applyTemplateDefaults(tmpl);
  };

  useEffect(() => {
    syncTemplateFromSettings();
  }, [activeWorkspace?.id]);

  const applyTemplateDefaults = (presetId: string) => {
    switch (presetId) {
      case "GROCERY":
        setBaseUnit("KG"); setPurchaseUnit("BAG"); setConversionFactor("25");
        setHsnSacCode("1006"); setTaxRate("5");
        setTrackBatch(true); setTrackExpiry(true); setTrackSerial(false);
        break;
      case "PHARMACY":
        setBaseUnit("STRIP"); setPurchaseUnit("BOX"); setConversionFactor("10");
        setHsnSacCode("3004"); setTaxRate("12");
        setTrackBatch(true); setTrackExpiry(true); setTrackSerial(false);
        break;
      case "GARMENT":
        setBaseUnit("PCS"); setPurchaseUnit("PACK"); setConversionFactor("6");
        setHsnSacCode("6203"); setTaxRate("5");
        setTrackBatch(false); setTrackExpiry(false); setTrackSerial(false);
        break;
      case "FOOTWEAR":
        setBaseUnit("PAIR"); setPurchaseUnit("CARTON"); setConversionFactor("10");
        setHsnSacCode("6403"); setTaxRate("12");
        setTrackBatch(false); setTrackExpiry(false); setTrackSerial(false);
        break;
      case "ELECTRONICS":
        setBaseUnit("PCS"); setPurchaseUnit("CARTON"); setConversionFactor("1");
        setHsnSacCode("8517"); setTaxRate("18");
        setTrackBatch(false); setTrackExpiry(false); setTrackSerial(true);
        break;
      case "JEWELLERY":
        setBaseUnit("GRAM"); setPurchaseUnit("BOX"); setConversionFactor("1");
        setHsnSacCode("7113"); setTaxRate("3");
        setTrackBatch(true); setTrackExpiry(false); setTrackSerial(true);
        break;
      case "AUTOMOBILE":
        setBaseUnit("PCS"); setPurchaseUnit("BOX"); setConversionFactor("10");
        setHsnSacCode("8708"); setTaxRate("28");
        setTrackBatch(false); setTrackExpiry(false); setTrackSerial(true);
        break;
      case "BOOKS_STATIONERY":
        setBaseUnit("PCS"); setPurchaseUnit("BUNDLE"); setConversionFactor("20");
        setHsnSacCode("4901"); setTaxRate("0");
        setTrackBatch(false); setTrackExpiry(false); setTrackSerial(false);
        break;
      case "FURNITURE":
        setBaseUnit("SET"); setPurchaseUnit("PACK"); setConversionFactor("1");
        setHsnSacCode("9403"); setTaxRate("18");
        setTrackBatch(false); setTrackExpiry(false); setTrackSerial(false);
        break;
      case "OPTICAL":
        setBaseUnit("PCS"); setPurchaseUnit("BOX"); setConversionFactor("1");
        setHsnSacCode("9004"); setTaxRate("12");
        setTrackBatch(false); setTrackExpiry(false); setTrackSerial(true);
        break;
      case "COSMETICS":
        setBaseUnit("PCS"); setPurchaseUnit("BOX"); setConversionFactor("12");
        setHsnSacCode("3304"); setTaxRate("18");
        setTrackBatch(true); setTrackExpiry(true); setTrackSerial(false);
        break;
      case "PET_STORE":
        setBaseUnit("BAG"); setPurchaseUnit("CARTON"); setConversionFactor("10");
        setHsnSacCode("2309"); setTaxRate("5");
        setTrackBatch(true); setTrackExpiry(true); setTrackSerial(false);
        break;
      case "CHEMICAL_PAINT":
        setBaseUnit("LTR"); setPurchaseUnit("DRUM"); setConversionFactor("200");
        setHsnSacCode("3208"); setTaxRate("18");
        setTrackBatch(true); setTrackExpiry(true); setTrackSerial(false);
        break;
      case "AGRICULTURE":
        setBaseUnit("BAG"); setPurchaseUnit("TONNE"); setConversionFactor("20");
        setHsnSacCode("3105"); setTaxRate("5");
        setTrackBatch(true); setTrackExpiry(true); setTrackSerial(false);
        break;
      case "BABY_PRODUCTS":
        setBaseUnit("PCS"); setPurchaseUnit("BOX"); setConversionFactor("12");
        setHsnSacCode("9619"); setTaxRate("12");
        setTrackBatch(true); setTrackExpiry(true); setTrackSerial(false);
        break;
      default:
        setBaseUnit("PCS"); setPurchaseUnit("PACK"); setConversionFactor("6");
        setHsnSacCode("6203"); setTaxRate("5");
        break;
    }
  };

  const handleAddCustomField = () => {
    if (!newFieldName.trim()) {
      toast.error("Custom Field Name is required");
      return;
    }
    const newField: CustomFieldDef = {
      id: Date.now().toString(),
      name: newFieldName.trim(),
      type: newFieldType,
      options: newFieldOptions ? newFieldOptions : undefined,
      value: "",
    };
    setCustomFields((prev) => [...prev, newField]);
    setNewFieldName("");
    setNewFieldOptions("");
    toast.success(`Added custom field "${newField.name}"`);
  };

  const handleRemoveCustomField = (id: string) => {
    setCustomFields((prev) => prev.filter((f) => f.id !== id));
  };

  const fetchProducts = async () => {
    if (!activeWorkspace?.id) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/commerce/products?workspace_id=${activeWorkspace.id}&query=${encodeURIComponent(query)}`);
      const json = await res.json();
      if (res.ok && json.products) {
        setProducts(json.products);
      }
    } catch (err) {
      toast.error("Failed to load product catalog");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [activeWorkspace?.id, query]);

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeWorkspace?.id || !name || !sku) {
      toast.error("Product Name and SKU are required");
      return;
    }

    setSaving(true);
    try {
      const customValuesMap: Record<string, any> = {};
      customFields.forEach((cf) => {
        if (cf.name) {
          customValuesMap[cf.name] = cf.value;
        }
      });

      const res = await fetch("/api/commerce/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          name,
          sku,
          barcode: barcode || undefined,
          alias_name: aliasName || undefined,
          manufacturer_name: manufacturer || undefined,
          department_name: department || undefined,
          brand_name: brandName || undefined,
          category_name: categoryName || undefined,
          sub_category_name: subCategoryName || undefined,
          preferred_supplier: preferredSupplier || undefined,
          product_status: productStatus,
          hsn_sac_code: hsnSacCode,
          base_unit: baseUnit,
          purchase_unit: purchaseUnit,
          unit_conversion_factor: Number(conversionFactor || 1),
          purchase_price: Number(purchasePrice || 0),
          selling_price: Number(sellingPrice || 0),
          wholesale_rate: Number(wholesaleRate || sellingPrice || 0),
          distributor_rate: Number(distributorRate || sellingPrice || 0),
          online_rate: Number(onlineRate || sellingPrice || 0),
          mrp: Number(mrp || sellingPrice || 0),
          min_selling_price: Number(minSellingPrice || 0),
          tax_rate: Number(taxRate || 0),
          cess_rate: Number(cessRate || 0),
          is_tax_inclusive: isTaxInclusive,
          initial_stock: Number(initialStock || 0),
          reorder_level: Number(reorderLevel || 10),
          reorder_quantity: Number(reorderQuantity || 50),
          min_stock_level: Number(minStockLevel || 5),
          max_stock_level: Number(maxStockLevel || 1000),
          shelf_number: shelfNumber || undefined,
          bin_location: binLocation || undefined,
          allow_negative_stock: allowNegativeStock,
          track_batch: trackBatch,
          track_serial: trackSerial,
          track_expiry: trackExpiry,
          attributes: {
            industry_template: activeTemplate,
            // Grocery
            pack_size: packSize || undefined,
            net_weight: netWeight || undefined,
            gross_weight: grossWeight || undefined,
            storage_condition: storageCondition || undefined,
            best_before_date: bestBeforeDate || undefined,
            is_organic: isOrganic,
            is_frozen: isFrozen,
            country_of_origin: countryOfOrigin || undefined,
            // Pharmacy
            salt_composition: saltComposition || undefined,
            medicine_type: medicineType,
            dosage_form: dosageForm || undefined,
            strength: strength || undefined,
            mfg_license: mfgLicense || undefined,
            is_schedule_drug: isScheduleDrug,
            is_controlled_drug: isControlledDrug,
            expiry_alert_days: expiryAlertDays,
            // Garments & Footwear
            apparel_size: apparelSize || undefined,
            apparel_color: apparelColor || undefined,
            apparel_fabric: apparelFabric || undefined,
            apparel_fit: apparelFit || undefined,
            gender_target: genderTarget,
            season_code: seasonCode || undefined,
            sleeve_type: sleeveType || undefined,
            neck_type: neckType || undefined,
            pattern: pattern || undefined,
            style_code: styleCode || undefined,
            heel_height: heelHeight || undefined,
            sole_material: soleMaterial || undefined,
            closure_type: closureType || undefined,
            is_waterproof: isWaterproof,
            // Electronics
            model_number: modelNumber || undefined,
            warranty_months: warrantyMonths || undefined,
            processor: processor || undefined,
            ram_size: ramSize || undefined,
            storage_capacity: storageCapacity || undefined,
            display_size: displaySize || undefined,
            battery_capacity: batteryCapacity || undefined,
            // Jewellery
            karat_purity: karatPurity || undefined,
            gross_weight_grams: grossWeightGrams || undefined,
            net_weight_grams: netWeightGrams || undefined,
            stone_weight_grams: stoneWeightGrams || undefined,
            diamond_weight_carat: diamondWeightCarat || undefined,
            making_charge: makingCharge || undefined,
            making_charge_type: makingChargeType,
            wastage_percent: wastagePercent || undefined,
            hallmark_number: hallmarkNumber || undefined,
            // Auto Parts
            oem_part_number: oemPartNumber || undefined,
            vehicle_fitment: vehicleFitment || undefined,
            engine_type: engineType || undefined,
            vehicle_year: vehicleYear || undefined,
            part_position: partPosition,
            // Books
            isbn_number: isbnNumber || undefined,
            author_name: authorName || undefined,
            publisher: publisher || undefined,
            edition: edition || undefined,
            language: language,
            binding_type: bindingType,
            // Hardware & Furniture
            material_grade: materialGrade || undefined,
            furniture_dimensions: furnitureDimensions || undefined,
            wood_material_type: woodMaterialType || undefined,
            weight_capacity_kg: weightCapacityKg || undefined,
            is_assembly_required: isAssemblyRequired,
            // Restaurant & Manufacturing
            kot_station: kotStation || undefined,
            recipe_code: recipeCode || undefined,
            is_veg: isVeg,
            is_jain: isJain,
            spicy_level: spicyLevel,
            bom_reference: bomReference || undefined,
            yield_percent: yieldPercent,
            // Optical & Cosmetics & Pet & Chemical & Agriculture & Baby
            frame_size: frameSize || undefined,
            lens_type: lensType,
            lens_power_sph: lensPowerSph || undefined,
            lens_cylinder_cyl: lensCylinderCyl || undefined,
            lens_axis: lensAxis || undefined,
            shade_code: shadeCode || undefined,
            skin_type: skinType,
            spf_rating: spfRating || undefined,
            volume_ml: volumeMl || undefined,
            pet_type: petType,
            pet_breed: petBreed || undefined,
            seed_variety: seedVariety || undefined,
            crop_type: cropType || undefined,
            hazard_class: hazardClass || undefined,
            un_number: unNumber || undefined,
            baby_age_group: babyAgeGroup || undefined,
            is_bpa_free: isBpaFree,
            // Ad-Hoc User Configured Custom Fields
            custom_user_fields: customValuesMap,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to create product");

      toast.success("Enterprise Product Master Created!");
      setShowAddModal(false);
      setName("");
      setSku("");
      setBarcode("");
      setPurchasePrice("");
      setSellingPrice("");
      fetchProducts();

      if (json.product) {
        setSelectedBarcodeProduct(json.product);
        setShowTagModal(true);
      }
    } catch (err: any) {
      const msg = sanitizeErrorMessage(err, "Failed to save product");
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Package className="h-6 w-6 text-[#00aef0]" />
            Products & Enterprise Master Catalog
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Manage multi-unit conversions, tiered rates, HSN codes, custom attributes, and bin locations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/settings?tab=retail">
            <Button variant="outline" className="border-slate-800 text-slate-300 gap-1.5 rounded-xl h-11">
              <Settings className="h-4 w-4 text-[#00aef0]" />
              Master Template: <span className="text-white font-bold">{activeTemplate}</span>
            </Button>
          </Link>
          <Button
            onClick={() => {
              syncTemplateFromSettings();
              setSku(`SKU-${Date.now().toString().slice(-5)}`);
              setBarcode(`890${Date.now().toString().slice(-10)}`);
              setActiveTab("BASIC");
              setShowAddModal(true);
            }}
            className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl shadow-lg shadow-[#00aef0]/20 gap-2 h-11"
          >
            <Plus className="h-4 w-4" />
            Add New Product
          </Button>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="flex items-center gap-3 bg-slate-900/80 p-3 rounded-2xl border border-slate-800 backdrop-blur-md">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            type="text"
            placeholder="Search by Product Name, SKU, Barcode, Size, Color, or Brand..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="pl-10 h-10 bg-slate-950/80 border-slate-800 text-white rounded-xl focus:border-[#00aef0]"
          />
        </div>
        <Button variant="outline" onClick={fetchProducts} className="h-10 border-slate-800 text-slate-300 gap-1.5 rounded-xl">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>

      {/* Products Table */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900/50 backdrop-blur-xl overflow-hidden shadow-2xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs font-semibold uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4">Product Name</th>
                <th className="py-3.5 px-4">SKU / Barcode</th>
                <th className="py-3.5 px-4">HSN Code</th>
                <th className="py-3.5 px-4">Units & Conversion</th>
                <th className="py-3.5 px-4 text-right">MRP</th>
                <th className="py-3.5 px-4 text-right">Selling Price</th>
                <th className="py-3.5 px-4 text-right">GST Rate</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                    Loading Products...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500 text-sm">
                    No products added yet. Click &quot;Add New Product&quot; to populate catalog.
                  </td>
                </tr>
              ) : (
                products.map((product) => (
                  <tr key={product.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3.5 px-4 font-semibold text-white">
                      {product.name}
                      {product.attributes?.apparel_size && (
                        <span className="block text-[11px] text-purple-400 font-normal">
                          Size: {product.attributes.apparel_size} | Color: {product.attributes.apparel_color || 'Default'}
                        </span>
                      )}
                      {product.attributes?.salt_composition && (
                        <span className="block text-[11px] text-emerald-400 font-normal">
                          Salt: {product.attributes.salt_composition}
                        </span>
                      )}
                      {product.attributes?.oem_part_number && (
                        <span className="block text-[11px] text-amber-400 font-normal">
                          OEM #: {product.attributes.oem_part_number} | Fitment: {product.attributes.vehicle_fitment || 'Universal'}
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      <div>{product.sku}</div>
                      {product.barcode && (
                        <div className="flex items-center gap-1 text-[11px] text-[#00aef0] mt-0.5">
                          <Barcode className="h-3 w-3" />
                          {product.barcode}
                        </div>
                      )}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-xs text-slate-400">
                      {product.hsn_sac_code || "6203"}
                    </td>
                    <td className="py-3.5 px-4 text-xs text-slate-400">
                      {product.base_unit || "PCS"} (1 {product.purchase_unit || "PACK"} = {product.unit_conversion_factor || 6})
                    </td>
                    <td className="py-3.5 px-4 text-right text-slate-400">
                      ₹{Number(product.mrp || product.selling_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right font-bold text-[#00aef0]">
                      ₹{Number(product.selling_price).toFixed(2)}
                    </td>
                    <td className="py-3.5 px-4 text-right text-xs text-slate-400">
                      {product.tax_rate}%
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedBarcodeProduct(product);
                          setShowTagModal(true);
                        }}
                        className="border-slate-800 hover:border-[#00aef0] text-slate-300 hover:text-[#00aef0] font-semibold text-xs rounded-xl gap-1.5 h-8"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        Print Tag
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Barcode Tag Modal Component */}
      <BarcodeTagModal
        isOpen={showTagModal}
        onClose={() => setShowTagModal(false)}
        product={selectedBarcodeProduct}
        workspaceName={activeWorkspace?.name || "Daily CRM Store"}
      />

      {/* Multi-Tab Add Product Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-xl font-bold text-white flex items-center gap-2">
                <Package className="h-5 w-5 text-[#00aef0]" />
                Add Enterprise Product Master
              </h2>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Configured Master Template Info Bar */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="h-4 w-4 text-[#00aef0]" />
                <span className="text-slate-400">Active Business Template:</span>
                <span className="font-extrabold text-white text-sm">{activeTemplate}</span>
              </div>
              <Link href="/settings?tab=retail" className="text-[11px] text-[#00aef0] hover:underline flex items-center gap-1 font-semibold">
                <Settings className="h-3 w-3" /> Settings
              </Link>
            </div>

            {/* Modal Tabs Header */}
            <div className="flex items-center gap-1 border-b border-slate-800 pb-2 overflow-x-auto">
              {[
                { id: "BASIC", label: "Basic Info", icon: Package },
                { id: "UNITS_PRICING", label: "Units & Rates", icon: DollarSign },
                { id: "TAX", label: "GST & Statutory", icon: ShieldCheck },
                { id: "INVENTORY", label: "Stock & Location", icon: Warehouse },
                { id: "SETTINGS", label: "Tracking & Flags", icon: Sliders },
                { id: "CUSTOM_FIELDS", label: "+ Custom Fields Builder", icon: PlusCircle },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-xl flex items-center gap-1.5 transition-all whitespace-nowrap ${
                      activeTab === tab.id
                        ? "bg-[#00aef0] text-white shadow-md shadow-[#00aef0]/20"
                        : "text-slate-400 hover:text-white hover:bg-slate-800/50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" />
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <form onSubmit={handleCreateProduct} className="space-y-4">
              {/* Tab 1: Basic Info */}
              {activeTab === "BASIC" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs text-slate-300">Product Name *</Label>
                    <Input
                      required
                      type="text"
                      placeholder="e.g. Men's Cotton Denim Shirt / Paracetamol 650mg / Frame Glasses"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10"
                    />
                  </div>

                  {/* DYNAMIC CARD: GARMENTS & APPAREL ATTRIBUTES */}
                  {activeTemplate === "GARMENT" && (
                    <div className="space-y-2.5 bg-purple-500/10 p-3.5 rounded-2xl border border-purple-500/20 sm:col-span-2">
                      <Label className="text-xs text-purple-300 font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                        <Shirt className="h-4 w-4 text-purple-400" /> Garment & Apparel Attributes (Size, Color, Fabric, Fit)
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-slate-300">Apparel Size</Label>
                          <Input
                            type="text"
                            placeholder="e.g. S / M / L / XL / 38 / 40"
                            value={apparelSize}
                            onChange={(e) => setApparelSize(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-300">Color / Shade</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Navy Blue / Crimson / Off-White"
                            value={apparelColor}
                            onChange={(e) => setApparelColor(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-300">Fabric / Material</Label>
                          <Input
                            type="text"
                            placeholder="e.g. 100% Cotton / Denim / Silk"
                            value={apparelFabric}
                            onChange={(e) => setApparelFabric(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-300">Fit / Style</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Slim Fit / Regular / Oversized"
                            value={apparelFit}
                            onChange={(e) => setApparelFit(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC CARD: FOOTWEAR SHOWROOM ATTRIBUTES */}
                  {activeTemplate === "FOOTWEAR" && (
                    <div className="space-y-2.5 bg-cyan-500/10 p-3.5 rounded-2xl border border-cyan-500/20 sm:col-span-2">
                      <Label className="text-xs text-cyan-300 font-extrabold flex items-center gap-1.5 uppercase tracking-wider">
                        <Tag className="h-4 w-4 text-cyan-400" /> Footwear Showroom Attributes (Size, Heel Height, Sole, Closure)
                      </Label>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <Label className="text-[11px] text-slate-300">Shoe Size (UK / US / EU)</Label>
                          <Input
                            type="text"
                            placeholder="e.g. UK 6 / UK 7 / UK 8 / UK 9 / EU 42"
                            value={apparelSize}
                            onChange={(e) => setApparelSize(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-300">Color / Shade</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Tan Brown / Matte Black / White"
                            value={apparelColor}
                            onChange={(e) => setApparelColor(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-300">Upper / Sole Material</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Genuine Leather / Rubber / EVA"
                            value={soleMaterial}
                            onChange={(e) => setSoleMaterial(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-300">Heel Height / Type</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Flat / 2 Inches / Block Heel"
                            value={heelHeight}
                            onChange={(e) => setHeelHeight(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div>
                          <Label className="text-[11px] text-slate-300">Closure Type</Label>
                          <Input
                            type="text"
                            placeholder="e.g. Lace-Up / Slip-On / Velcro"
                            value={closureType}
                            onChange={(e) => setClosureType(e.target.value)}
                            className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                          />
                        </div>
                        <div className="flex items-center pt-5">
                          <label className="flex items-center gap-2 text-xs text-cyan-300 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={isWaterproof}
                              onChange={(e) => setIsWaterproof(e.target.checked)}
                              className="rounded border-slate-800 text-cyan-500"
                            />
                            Waterproof / All-Weather Footwear
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC CARD: OPTICAL STORE */}
                  {activeTemplate === "OPTICAL" && (
                    <div className="space-y-1.5 bg-blue-500/10 p-3.5 rounded-2xl border border-blue-500/20 sm:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-blue-400 font-bold flex items-center gap-1.5">
                          <Glasses className="h-4 w-4" /> Frame Size / Model
                        </Label>
                        <Input
                          type="text"
                          placeholder="e.g. 52-18-140 / Ray-Ban RB5154"
                          value={frameSize}
                          onChange={(e) => setFrameSize(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-blue-400 font-bold">Lens Sph / Cyl Power</Label>
                        <Input
                          type="text"
                          placeholder="e.g. SPH -2.50 / CYL -1.00"
                          value={lensPowerSph}
                          onChange={(e) => setLensPowerSph(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs font-mono mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC CARD: COSMETICS */}
                  {activeTemplate === "COSMETICS" && (
                    <div className="space-y-1.5 bg-pink-500/10 p-3.5 rounded-2xl border border-pink-500/20 sm:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-pink-400 font-bold flex items-center gap-1.5">
                          <Sparkle className="h-4 w-4" /> Shade Code / Color Name
                        </Label>
                        <Input
                          type="text"
                          placeholder="e.g. Ruby Woo / Shade 120"
                          value={shadeCode}
                          onChange={(e) => setShadeCode(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-pink-400 font-bold">Volume (ml / grams)</Label>
                        <Input
                          type="text"
                          placeholder="e.g. 50 ml / 100g"
                          value={volumeMl}
                          onChange={(e) => setVolumeMl(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC CARD: PET STORE */}
                  {activeTemplate === "PET_STORE" && (
                    <div className="space-y-1.5 bg-amber-500/10 p-3.5 rounded-2xl border border-amber-500/20 sm:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-amber-400 font-bold flex items-center gap-1.5">
                          <Dog className="h-4 w-4" /> Pet Type & Breed
                        </Label>
                        <Input
                          type="text"
                          placeholder="e.g. Dog (Golden Retriever / German Shepherd)"
                          value={petBreed}
                          onChange={(e) => setPetBreed(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-amber-400 font-bold">Food Flavor / Weight</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Chicken & Rice / 10 Kg Bag"
                          value={packSize}
                          onChange={(e) => setPackSize(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC CARD: CHEMICALS & PAINT */}
                  {activeTemplate === "CHEMICAL_PAINT" && (
                    <div className="space-y-1.5 bg-red-500/10 p-3.5 rounded-2xl border border-red-500/20 sm:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-red-400 font-bold flex items-center gap-1.5">
                          <FlaskConical className="h-4 w-4" /> Hazard Class / UN Number
                        </Label>
                        <Input
                          type="text"
                          placeholder="e.g. Class 3 Flammable / UN 1263"
                          value={hazardClass}
                          onChange={(e) => setHazardClass(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white font-mono text-xs rounded-xl h-9 mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-red-400 font-bold">Color Shade Code / Viscosity</Label>
                        <Input
                          type="text"
                          placeholder="e.g. RAL 9010 Pure White"
                          value={shadeCode}
                          onChange={(e) => setShadeCode(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC CARD: AGRICULTURE */}
                  {activeTemplate === "AGRICULTURE" && (
                    <div className="space-y-1.5 bg-emerald-500/10 p-3.5 rounded-2xl border border-emerald-500/20 sm:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-emerald-400 font-bold flex items-center gap-1.5">
                          <Sprout className="h-4 w-4" /> Seed Variety / Fertilizer Grade
                        </Label>
                        <Input
                          type="text"
                          placeholder="e.g. NPK 19-19-19 / Hybrid Cotton"
                          value={seedVariety}
                          onChange={(e) => setSeedVariety(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-emerald-400 font-bold">Target Crop / Season</Label>
                        <Input
                          type="text"
                          placeholder="e.g. Wheat / Kharif Season"
                          value={cropType}
                          onChange={(e) => setCropType(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}

                  {/* DYNAMIC CARD: BABY PRODUCTS */}
                  {activeTemplate === "BABY_PRODUCTS" && (
                    <div className="space-y-1.5 bg-yellow-500/10 p-3.5 rounded-2xl border border-yellow-500/20 sm:col-span-2 grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-xs text-yellow-400 font-bold flex items-center gap-1.5">
                          <Baby className="h-4 w-4" /> Baby Age Group (Months)
                        </Label>
                        <Input
                          type="text"
                          placeholder="e.g. 0-6 Months / 1-2 Years"
                          value={babyAgeGroup}
                          onChange={(e) => setBabyAgeGroup(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                      <div>
                        <Label className="text-xs text-yellow-400 font-bold">Safety Standard / Material</Label>
                        <Input
                          type="text"
                          placeholder="e.g. BPA-Free Food Grade Silicone"
                          value={apparelFabric}
                          onChange={(e) => setApparelFabric(e.target.value)}
                          className="bg-slate-950 border-slate-800 text-white rounded-xl h-9 text-xs mt-1"
                        />
                      </div>
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">SKU Code *</Label>
                    <Input
                      required
                      type="text"
                      value={sku}
                      onChange={(e) => setSku(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white font-mono text-xs rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Barcode (13-Digit EAN/UPC)</Label>
                    <Input
                      type="text"
                      value={barcode}
                      onChange={(e) => setBarcode(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white font-mono text-xs rounded-xl h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Alias Name</Label>
                    <Input
                      type="text"
                      placeholder="Alternate search term"
                      value={aliasName}
                      onChange={(e) => setAliasName(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Manufacturer / Brand</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Levi's / Nike / Zara / Cipla / Ray-Ban"
                      value={manufacturer}
                      onChange={(e) => setManufacturer(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Tab 2: Units & Multi-Tier Pricing */}
              {activeTab === "UNITS_PRICING" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Base Sales Unit</Label>
                    <Input
                      type="text"
                      value={baseUnit}
                      onChange={(e) => setBaseUnit(e.target.value)}
                      placeholder="PCS / KG / LTR / PAIR"
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Purchase Packaging Unit</Label>
                    <Input
                      type="text"
                      value={purchaseUnit}
                      onChange={(e) => setPurchaseUnit(e.target.value)}
                      placeholder="PACK / BOX / CARTON"
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs text-slate-300">Conversion Factor (e.g. 1 Pack = 6 Pieces)</Label>
                    <Input
                      type="number"
                      value={conversionFactor}
                      onChange={(e) => setConversionFactor(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Purchase Rate (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={purchasePrice}
                      onChange={(e) => setPurchasePrice(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">MRP (Maximum Retail Price ₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={mrp}
                      onChange={(e) => setMrp(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Standard Selling Rate (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={sellingPrice}
                      onChange={(e) => setSellingPrice(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white font-bold rounded-xl h-10 text-xs text-[#00aef0]"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Wholesale Rate (₹)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={wholesaleRate}
                      onChange={(e) => setWholesaleRate(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white rounded-xl h-10 text-xs"
                    />
                  </div>
                </div>
              )}

              {/* Tab 3: Tax & Statutory */}
              {activeTab === "TAX" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">HSN / SAC Code</Label>
                    <Input
                      type="text"
                      value={hsnSacCode}
                      onChange={(e) => setHsnSacCode(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white font-mono text-xs rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">GST Slab Rate (%)</Label>
                    <Input
                      type="number"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="5"
                      className="bg-slate-950 border-slate-800 text-white font-mono text-xs rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer pt-2">
                      <input
                        type="checkbox"
                        checked={isTaxInclusive}
                        onChange={(e) => setIsTaxInclusive(e.target.checked)}
                        className="rounded border-slate-800 text-[#00aef0]"
                      />
                      Selling Price is Tax Inclusive (GST Included)
                    </label>
                  </div>
                </div>
              )}

              {/* Tab 4: Stock & Warehousing Location */}
              {activeTab === "INVENTORY" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Initial Opening Stock</Label>
                    <Input
                      type="number"
                      value={initialStock}
                      onChange={(e) => setInitialStock(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white font-mono text-xs rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Reorder Threshold Level</Label>
                    <Input
                      type="number"
                      value={reorderLevel}
                      onChange={(e) => setReorderLevel(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white font-mono text-xs rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Shelf Number</Label>
                    <Input
                      type="text"
                      placeholder="e.g. Rack A-2"
                      value={shelfNumber}
                      onChange={(e) => setShelfNumber(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs rounded-xl h-10"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-slate-300">Bin Location Code</Label>
                    <Input
                      type="text"
                      placeholder="e.g. BIN-204"
                      value={binLocation}
                      onChange={(e) => setBinLocation(e.target.value)}
                      className="bg-slate-950 border-slate-800 text-white text-xs rounded-xl h-10"
                    />
                  </div>
                </div>
              )}

              {/* Tab 5: Tracking & Flags */}
              {activeTab === "SETTINGS" && (
                <div className="space-y-3 pt-2">
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trackBatch}
                      onChange={(e) => setTrackBatch(e.target.checked)}
                      className="rounded border-slate-800 text-[#00aef0]"
                    />
                    Enable Batch Number & Expiry Date Tracking (FEFO)
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={trackSerial}
                      onChange={(e) => setTrackSerial(e.target.checked)}
                      className="rounded border-slate-800 text-[#00aef0]"
                    />
                    Enable Serial Number / IMEI Tracking
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowNegativeStock}
                      onChange={(e) => setAllowNegativeStock(e.target.checked)}
                      className="rounded border-slate-800 text-[#00aef0]"
                    />
                    Allow Sales when Stock is Zero / Negative
                  </label>
                </div>
              )}

              {/* Tab 6: Interactive Ad-Hoc Custom Fields Builder */}
              {activeTab === "CUSTOM_FIELDS" && (
                <div className="space-y-4 pt-2">
                  <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-3">
                    <Label className="text-xs text-[#00aef0] font-bold flex items-center gap-1.5">
                      <PlusCircle className="h-4 w-4" /> Add Custom Field Definition for {activeTemplate}
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <Input
                        type="text"
                        placeholder="Field Name (e.g. Bluetooth Version / Designer Name)"
                        value={newFieldName}
                        onChange={(e) => setNewFieldName(e.target.value)}
                        className="bg-slate-900 border-slate-800 text-white text-xs h-9"
                      />
                      <select
                        value={newFieldType}
                        onChange={(e) => setNewFieldType(e.target.value as any)}
                        className="bg-slate-900 border-slate-800 text-slate-200 text-xs rounded-xl px-2 h-9"
                      >
                        <option value="TEXT">Text Field</option>
                        <option value="NUMBER">Number Field</option>
                        <option value="DROPDOWN">Dropdown List</option>
                        <option value="BOOLEAN">Yes / No Toggle</option>
                      </select>
                      <Button
                        type="button"
                        onClick={handleAddCustomField}
                        className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold text-xs h-9 rounded-xl gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Add Field
                      </Button>
                    </div>
                  </div>

                  {/* Render Added Custom Fields */}
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {customFields.length === 0 ? (
                      <div className="text-center py-6 text-slate-500 text-xs">
                        No ad-hoc custom fields added yet. Use the builder above to add fields like Bluetooth Version, Designer Name, or Wi-Fi Standard.
                      </div>
                    ) : (
                      customFields.map((cf) => (
                        <div key={cf.id} className="flex items-center justify-between bg-slate-950 p-2.5 rounded-xl border border-slate-800 text-xs">
                          <div className="flex-1 pr-2">
                            <Label className="text-xs text-slate-300 font-bold">{cf.name}</Label>
                            <Input
                              type={cf.type === "NUMBER" ? "number" : "text"}
                              placeholder={`Enter ${cf.name}...`}
                              value={cf.value || ""}
                              onChange={(e) =>
                                setCustomFields((prev) =>
                                  prev.map((item) => (item.id === cf.id ? { ...item, value: e.target.value } : item))
                                )
                              }
                              className="bg-slate-900 border-slate-800 text-white text-xs h-8 mt-1"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveCustomField(cf.id)}
                            className="text-rose-400 hover:text-rose-300 p-1"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-800">
                <Button type="button" variant="outline" onClick={() => setShowAddModal(false)} className="border-slate-800 text-slate-300 rounded-xl h-10">
                  Cancel
                </Button>
                <Button type="submit" disabled={saving} className="bg-[#00aef0] hover:bg-[#0284c7] text-white font-bold rounded-xl h-10 px-6">
                  {saving ? "Saving Product..." : "Save Product Master"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
