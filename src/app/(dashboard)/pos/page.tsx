"use client";

import { useState, useEffect, useRef } from "react";
import { useWorkspace } from "@/hooks/use-workspace";
import { RequireModule } from "@/components/auth/require-module";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { 
  ShoppingCart, 
  Search, 
  Trash2, 
  Plus, 
  Minus, 
  Landmark,
  PauseCircle,
  PlayCircle,
  X,
  Calculator,
  Split
} from "lucide-react";
import { toast } from "sonner";
import { extractCleanSku } from "@/lib/commerce/barcode-utils";
import { IconAction } from "@/components/ui/icon-action";

interface CartItem {
  product_id: string;
  name: string;
  sku: string;
  barcode?: string;
  selling_price: number;
  tax_rate: number;
  quantity: number;
  serial_numbers?: string[];
  imei_numbers?: string[];
}

export default function POSTerminalPage() {
  return (
    <RequireModule module="retail">
      <POSTerminalPageContent />
    </RequireModule>
  );
}

function POSTerminalPageContent() {
  const { activeWorkspace } = useWorkspace();
  const [query, setQuery] = useState("");
  const [products, setProducts] = useState<any[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [, setLoadingProducts] = useState(false);
  
  // Customer & Pricing State
  const [customerType, setCustomerType] = useState<"RETAIL" | "WHOLESALE" | "DISTRIBUTOR">("RETAIL");
  const [customerMobile, setCustomerMobile] = useState("");
  const [customerGstin] = useState("");
  const [promoCode, setPromoCode] = useState("");

  // Payment States
  const [isGstBill] = useState(true);
  const [selectedPayment, setSelectedPayment] = useState<"CASH" | "UPI" | "CARD" | "SPLIT">("CASH");
  const [upiBankAccount, setUpiBankAccount] = useState("");
  const [bankAccountsList, setBankAccountsList] = useState<any[]>([]);
  
  // Split Payment Amounts
  const [splitCashAmount, setSplitCashAmount] = useState<number>(0);
  const [splitUpiAmount, setSplitUpiAmount] = useState<number>(0);

  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [cashReceived, setCashReceived] = useState<number>(0);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // Held Bills Drawer State
  const [heldBills, setHeldBills] = useState<any[]>([]);
  const [showHeldDrawer, setShowHeldDrawer] = useState(false);

  // Cash Denomination Drawer State for Z-Report Shift Closing
  const [showShiftCloseModal, setShowShiftCloseModal] = useState(false);
  const [denominations, setDenominations] = useState({
    "2000": 0, "500": 0, "200": 0, "100": 0, "50": 0, "20": 0, "10": 0, "coins": 0
  });

  // Serial/IMEI Modal State
  const [showSerialModal, setShowSerialModal] = useState(false);
  const [selectedItemForSerial, setSelectedItemForSerial] = useState<CartItem | null>(null);
  const [serialInput, setSerialInput] = useState("");

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus search input
  useEffect(() => {
    searchInputRef.current?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "F2") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Fetch products and load dynamic bank accounts
  useEffect(() => {
    if (!activeWorkspace?.id) return;

    // Load custom bank accounts
    const saved = localStorage.getItem(`retail_bank_accounts_${activeWorkspace.id}`);
    if (saved) {
      const parsed = JSON.parse(saved);
      setBankAccountsList(parsed);
      if (parsed.length > 0) {
        setUpiBankAccount(`${parsed[0].name} (vpa: ${parsed[0].vpa})`);
      }
    } else {
      const defaultAccounts = [
        { id: "1", name: "HDFC Bank Primary", vpa: "store@hdfc" },
        { id: "2", name: "ICICI Bank Current", vpa: "store@icici" },
        { id: "3", name: "SBI Business Account", vpa: "store@sbi" },
        { id: "4", name: "Store Static QR Code", vpa: "merchant@paytm" }
      ];
      setBankAccountsList(defaultAccounts);
      setUpiBankAccount("HDFC Bank Primary (vpa: store@hdfc)");
    }

    const fetchProducts = async () => {
      setLoadingProducts(true);
      const cleanSearchQuery = extractCleanSku(query);
      try {
        const res = await fetch(`/api/commerce/products?workspace_id=${activeWorkspace.id}&query=${encodeURIComponent(cleanSearchQuery)}`);
        const contentType = res.headers.get("content-type") || "";
        if (!res.ok || !contentType.includes("application/json")) {
          console.error("Fetch products failed with status:", res.status);
          return;
        }
        const json = await res.json();
        if (json.products) {
          setProducts(json.products);

          if (cleanSearchQuery && json.products.length === 1 && (json.products[0].barcode === cleanSearchQuery || json.products[0].sku === cleanSearchQuery)) {
            addToCart(json.products[0]);
            setQuery("");
          }
        }
      } catch (err: any) {
        console.error("Error fetching products:", err);
      } finally {
        setLoadingProducts(false);
      }
    };

    const timer = setTimeout(fetchProducts, 300);
    return () => clearTimeout(timer);
  }, [query, activeWorkspace?.id]);

  const addToCart = (product: any) => {
    setCart((prevCart) => {
      const existing = prevCart.find((item) => item.product_id === product.id);
      if (existing) {
        return prevCart.map((item) =>
          item.product_id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }
      return [
        ...prevCart,
        {
          product_id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          selling_price: Number(product.selling_price || 0),
          tax_rate: Number(product.tax_rate || 0),
          quantity: 1,
          serial_numbers: [],
          imei_numbers: [],
        },
      ];
    });
  };

  const updateQuantity = (productId: string, delta: number) => {
    setCart((prevCart) =>
      prevCart
        .map((item) => {
          if (item.product_id === productId) {
            const newQty = item.quantity + delta;
            return newQty > 0 ? { ...item, quantity: newQty } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (productId: string) => {
    setCart((prevCart) => prevCart.filter((item) => item.product_id !== productId));
  };

  // Hold Current Bill
  const handleHoldBill = () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }
    const newHold = {
      id: Date.now().toString(),
      hold_number: `HOLD-${Date.now().toString().slice(-4)}`,
      items: cart,
      customer_type: customerType,
      created_at: new Date().toLocaleTimeString(),
    };
    setHeldBills((prev) => [newHold, ...prev]);
    setCart([]);
    toast.success(`Bill ${newHold.hold_number} placed on hold!`);
  };

  // Recall Held Bill
  const handleRecallBill = (held: any) => {
    setCart(held.items);
    setHeldBills((prev) => prev.filter((h) => h.id !== held.id));
    setShowHeldDrawer(false);
    toast.success(`Recalled ${held.hold_number}`);
  };

  // Add Serial/IMEI to Item
  const handleSaveSerial = () => {
    if (!selectedItemForSerial || !serialInput.trim()) return;
    setCart((prev) =>
      prev.map((item) =>
        item.product_id === selectedItemForSerial.product_id
          ? { ...item, serial_numbers: [...(item.serial_numbers || []), serialInput.trim()] }
          : item
      )
    );
    setSerialInput("");
    setShowSerialModal(false);
    toast.success("Serial Number saved to item");
  };

  // Calculations
  const subtotal = cart.reduce((acc, item) => acc + item.quantity * item.selling_price, 0);
  const taxTotal = isGstBill
    ? cart.reduce((acc, item) => acc + (item.quantity * item.selling_price * item.tax_rate) / 100, 0)
    : 0;
  const grandTotal = Math.max(0, subtotal + taxTotal - discountAmount);
  const changeReturned = Math.max(0, cashReceived - grandTotal);

  // Auto-set Split UPI Amount when Split Cash changes
  useEffect(() => {
    if (selectedPayment === "SPLIT") {
      const remaining = Math.max(0, grandTotal - splitCashAmount);
      setSplitUpiAmount(remaining);
    }
  }, [splitCashAmount, grandTotal, selectedPayment]);

  // Shift Close Cash Counter Total
  const totalCountedCash = 
    denominations["2000"] * 2000 +
    denominations["500"] * 500 +
    denominations["200"] * 200 +
    denominations["100"] * 100 +
    denominations["50"] * 50 +
    denominations["20"] * 20 +
    denominations["10"] * 10 +
    denominations["coins"];

  // Receipt & Print Modal State
  const [completedOrder, setCompletedOrder] = useState<any>(null);
  const [showReceiptModal, setShowReceiptModal] = useState(false);
  const [showUpiQrModal, setShowUpiQrModal] = useState(false);

  const handleCheckout = async () => {
    if (cart.length === 0) {
      toast.error("Cart is empty");
      return;
    }

    if (!activeWorkspace?.id) return;

    let paymentBreakdown: any[] = [];
    if (selectedPayment === "SPLIT") {
      if (splitCashAmount + splitUpiAmount < grandTotal) {
        toast.error("Split payment amounts do not cover the Grand Total!");
        return;
      }
      paymentBreakdown = [
        { mode: "CASH", amount: splitCashAmount },
        { mode: "UPI", amount: splitUpiAmount, bank_account_id: upiBankAccount },
      ];
    } else if (selectedPayment === "UPI") {
      paymentBreakdown = [
        { mode: "UPI", amount: grandTotal, bank_account_id: upiBankAccount },
      ];
    } else {
      paymentBreakdown = [
        { mode: selectedPayment, amount: grandTotal },
      ];
    }

    setCheckoutLoading(true);
    try {
      const res = await fetch("/api/commerce/pos/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: activeWorkspace.id,
          customer_type: customerType,
          customer_mobile: customerMobile || undefined,
          customer_gstin: customerGstin || undefined,
          is_gst_bill: isGstBill,
          payment_method: selectedPayment,
          payment_breakdown: paymentBreakdown,
          discount_amount: Number(discountAmount || 0),
          cash_received: selectedPayment === "CASH" ? Number(cashReceived || 0) : grandTotal,
          change_returned: selectedPayment === "CASH" ? changeReturned : 0,
          promo_code_applied: promoCode || undefined,
          items: cart,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      let json: any = {};
      if (contentType.includes("application/json")) {
        json = await res.json();
      }

      if (!res.ok) {
        throw new Error(json.error || `Checkout endpoint error (${res.status}). Please restart dev server if route was recently added.`);
      }

      const orderData = json.order || {
        order_number: `ORD-${Date.now().toString().slice(-6)}`,
        created_at: new Date().toISOString(),
        grand_total: grandTotal,
        payment_method: selectedPayment,
      };

      toast.success(`Order #${orderData.order_number} completed!`);
      setCompletedOrder({
        order_number: orderData.order_number,
        date: new Date().toLocaleString(),
        items: [...cart],
        subtotal,
        taxTotal,
        discountAmount,
        grandTotal,
        customerMobile,
        payment_method: selectedPayment,
      });
      setShowReceiptModal(true);

      setCart([]);
      setDiscountAmount(0);
      setCashReceived(0);
      setSplitCashAmount(0);
      setSplitUpiAmount(0);
      setPromoCode("");
    } catch (err: any) {
      toast.error(err.message || "Checkout failed");
    } finally {
      setCheckoutLoading(false);
    }
  };

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col lg:flex-row gap-4 p-4 bg-background text-foreground overflow-hidden">
      {/* LEFT: Product Catalog & Search */}
      <div className="flex-1 flex flex-col gap-4 min-w-0">
        {/* Search Bar & Actions */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-card/90 p-2.5 sm:p-3.5 rounded-2xl border border-border backdrop-blur-md shadow-lg">
          <div className="relative flex-1 min-w-[180px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              ref={searchInputRef}
              type="text"
              placeholder="Scan Barcode or Search (F2)..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="pl-9 h-10 sm:h-11 bg-background border-border text-foreground rounded-xl focus:border-[#00aef0] font-medium text-xs sm:text-sm"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <IconAction label="Held Bills" icon={<PauseCircle className="h-4 w-4" />} variant="outline"
              onClick={() => setShowHeldDrawer(true)}
              className="h-10 sm:h-11 border-border bg-background text-amber-400 hover:bg-card gap-1.5 rounded-xl px-2.5 text-xs" />
            <IconAction label="Z-Report" icon={<Calculator className="h-4 w-4" />} variant="outline"
              onClick={() => setShowShiftCloseModal(true)}
              className="h-10 sm:h-11 border-border bg-background text-emerald-400 hover:bg-card gap-1.5 rounded-xl px-2.5 text-xs" />
          </div>
        </div>

        {/* Customer Type Selector */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card/50 p-2.5 rounded-xl border border-border/80 gap-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-xs text-muted-foreground font-bold shrink-0 pr-1">Customer Type:</span>
            {(["RETAIL", "WHOLESALE", "DISTRIBUTOR"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setCustomerType(type)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all whitespace-nowrap shrink-0 ${
                  customerType === type
                    ? "bg-[#00aef0] text-foreground shadow-md"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {type}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Input
              type="text"
              placeholder="Customer Mobile #"
              value={customerMobile}
              onChange={(e) => setCustomerMobile(e.target.value)}
              className="h-8 w-full sm:w-36 bg-background border-border text-xs text-foreground rounded-lg"
            />
          </div>
        </div>

        {/* Product Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 pr-1 content-start">
          {products.map((product) => {
            const stockQty = Number(product.current_stock ?? product.stock_quantity ?? 0);
            const isOutOfStock = stockQty <= 0;

            return (
              <div
                key={product.id}
                onClick={() => {
                  if (isOutOfStock) {
                    toast.error(`Cannot add ${product.name}: Item is Out of Stock!`);
                    return;
                  }
                  addToCart(product);
                }}
                className={`bg-card/60 border rounded-2xl p-3 flex flex-col justify-between cursor-pointer transition-all hover:scale-[1.02] shadow-md group relative overflow-hidden ${
                  isOutOfStock
                    ? "border-rose-500/40 opacity-75"
                    : "border-border hover:border-[#00aef0]/50"
                }`}
              >
                <div>
                  <div className="text-xs font-bold text-foreground group-hover:text-[#00aef0] transition-colors line-clamp-2">
                    {product.name}
                  </div>
                  <div className="flex items-center justify-between gap-1 mt-1">
                    <span className="text-[11px] font-mono text-muted-foreground">SKU: {product.sku}</span>
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                        isOutOfStock
                          ? "bg-rose-500/20 text-rose-500 border border-rose-500/30"
                          : stockQty <= 5
                          ? "bg-amber-500/20 text-amber-500 border border-amber-500/30"
                          : "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
                      }`}
                    >
                      {isOutOfStock ? "Out of Stock" : `Stock: ${stockQty}`}
                    </span>
                  </div>
                </div>
                <div className="flex flex-col gap-1.5 mt-3 pt-2 border-t border-border/60">
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      {product.mrp && Number(product.mrp) > Number(product.selling_price) && (
                        <span className="text-[10px] text-muted-foreground line-through">
                          ₹{Number(product.mrp).toFixed(2)}
                        </span>
                      )}
                      <span className="text-xs font-extrabold text-[#00aef0]">
                        ₹{Number(product.selling_price).toFixed(2)}
                      </span>
                    </div>
                    <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded-none font-mono">
                      {product.base_unit || "PCS"}
                    </span>
                  </div>
                  {product.mrp && Number(product.mrp) > Number(product.selling_price) && (
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded-lg border border-emerald-500/20">
                        {Math.round(((Number(product.mrp) - Number(product.selling_price)) / Number(product.mrp)) * 100)}% OFF
                      </span>
                      <span className="text-muted-foreground">
                        Save ₹{(Number(product.mrp) - Number(product.selling_price)).toFixed(0)}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* RIGHT: Current Cart Order Panel & Checkout */}
      <div className="w-full lg:w-96 bg-card/90 border border-border rounded-3xl p-4 flex flex-col justify-between shadow-2xl backdrop-blur-md">
        <div className="space-y-3 overflow-hidden flex flex-col h-full">
          <div className="flex items-center justify-between border-b border-border pb-3">
            <h2 className="font-extrabold text-foreground text-base flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-[#00aef0]" />
              Current Order
            </h2>
            <button
              onClick={handleHoldBill}
              className="text-amber-400 hover:text-amber-300 text-xs font-bold flex items-center gap-1 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/20"
            >
              <PauseCircle className="h-3.5 w-3.5" /> Hold Bill
            </button>
          </div>

          {/* Cart Items List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1">
            {cart.length === 0 ? (
              <div className="text-center py-16 text-muted-foreground text-xs">
                Cart is empty. Scan barcode or click product to add.
              </div>
            ) : (
              cart.map((item) => (
                <div key={item.product_id} className="bg-background p-2.5 rounded-xl border border-border/80 flex items-center justify-between">
                  <div className="flex-1 pr-2">
                    <div className="font-bold text-foreground text-xs line-clamp-1">{item.name}</div>
                    <div className="text-[11px] text-[#00aef0] font-semibold mt-0.5">
                      ₹{item.selling_price.toFixed(2)} × {item.quantity} = ₹{(item.selling_price * item.quantity).toFixed(2)}
                    </div>
                    {item.serial_numbers && item.serial_numbers.length > 0 && (
                      <div className="text-[10px] text-emerald-400 font-mono">
                        S/N: {item.serial_numbers.join(", ")}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => {
                        setSelectedItemForSerial(item);
                        setShowSerialModal(true);
                      }}
                      className="p-1 text-muted-foreground hover:text-foreground text-[10px] font-mono bg-card border border-border rounded-none"
                    >
                      +S/N
                    </button>
                    <button onClick={() => updateQuantity(item.product_id, -1)} className="p-1 text-muted-foreground hover:text-foreground">
                      <Minus className="h-3 w-3" />
                    </button>
                    <span className="font-bold text-foreground w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product_id, 1)} className="p-1 text-muted-foreground hover:text-foreground">
                      <Plus className="h-3 w-3" />
                    </button>
                    <button onClick={() => removeFromCart(item.product_id)} className="p-1 text-rose-400 hover:text-rose-300 ml-1">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Totals & Payment Actions */}
        <div className="border-t border-border pt-3 space-y-3 mt-2">
          <div className="space-y-1.5 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span className="text-foreground font-semibold">₹{subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between">
              <span>GST Total</span>
              <span className="text-foreground font-semibold">₹{taxTotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-emerald-400">
              <span>Discount</span>
              <span>-₹{Number(discountAmount || 0).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold text-foreground pt-2 border-t border-border">
              <span>Grand Total</span>
              <span className="text-[#00aef0]">₹{grandTotal.toFixed(2)}</span>
            </div>
          </div>

          {/* Payment Method Selector Grid */}
          <div className="grid grid-cols-4 gap-1 pt-1">
            {(["CASH", "UPI", "CARD", "SPLIT"] as const).map((method) => (
              <button
                key={method}
                onClick={() => setSelectedPayment(method)}
                className={`py-2 rounded-xl text-[11px] font-bold transition-all flex items-center justify-center gap-1 ${
                  selectedPayment === method
                    ? "bg-[#00aef0] text-foreground shadow-lg"
                    : "bg-background text-muted-foreground border border-border"
                }`}
              >
                {method === "SPLIT" && <Split className="h-3 w-3" />}
                {method}
              </button>
            ))}
          </div>

          {/* UPI Bank Account Selection & Dynamic QR Trigger */}
          {(selectedPayment === "UPI" || selectedPayment === "SPLIT") && (
            <div className="bg-background p-2.5 rounded-xl border border-border space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] text-[#00aef0] font-bold flex items-center gap-1">
                  <Landmark className="h-3.5 w-3.5" /> Destination Bank / UPI
                </Label>
                <button
                  type="button"
                  onClick={() => setShowUpiQrModal(true)}
                  className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30 hover:bg-emerald-500/20"
                >
                  View QR Code 📱
                </button>
              </div>
              <select
                value={upiBankAccount}
                onChange={(e) => setUpiBankAccount(e.target.value)}
                className="w-full bg-card border border-border text-foreground rounded-lg text-xs h-8 px-2"
              >
                {bankAccountsList.map((acc) => (
                  <option key={acc.id} value={`${acc.name} (vpa: ${acc.vpa})`}>
                    {acc.name} ({acc.vpa})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Split Payment Controls */}
          {selectedPayment === "SPLIT" && (
            <div className="bg-background p-2.5 rounded-xl border border-border space-y-2">
              <div className="flex justify-between items-center text-xs font-bold text-foreground">
                <span>Split Cash & UPI Payment</span>
                <span className="text-[#00aef0]">Total: ₹{grandTotal.toFixed(2)}</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-[10px] text-muted-foreground">Cash Amount (₹)</Label>
                  <Input
                    type="number"
                    value={splitCashAmount || ""}
                    onChange={(e) => setSplitCashAmount(Number(e.target.value || 0))}
                    placeholder="0.00"
                    className="bg-card border-border text-foreground text-xs h-8 font-bold"
                  />
                </div>
                <div>
                  <Label className="text-[10px] text-muted-foreground">UPI Amount (₹)</Label>
                  <Input
                    type="number"
                    value={splitUpiAmount || ""}
                    onChange={(e) => setSplitUpiAmount(Number(e.target.value || 0))}
                    placeholder="0.00"
                    className="bg-card border-border text-emerald-400 text-xs h-8 font-bold"
                  />
                </div>
              </div>
            </div>
          )}

          <Button
            onClick={handleCheckout}
            disabled={checkoutLoading || cart.length === 0}
            className="w-full bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold h-12 rounded-xl shadow-lg shadow-[#00aef0]/20 text-sm"
          >
            {checkoutLoading ? "Processing..." : `Complete Checkout (₹${grandTotal.toFixed(2)})`}
          </Button>
        </div>
      </div>

      {/* Held Bills Drawer Modal */}
      {showHeldDrawer && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <PauseCircle className="h-5 w-5 text-amber-400" />
                Held Bills Queue
              </h2>
              <button onClick={() => setShowHeldDrawer(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2 max-h-80 overflow-y-auto">
              {heldBills.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-xs">
                  No bills currently on hold.
                </div>
              ) : (
                heldBills.map((held) => (
                  <div key={held.id} className="p-3 bg-background border border-border rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-foreground text-xs">{held.hold_number}</div>
                      <div className="text-[11px] text-muted-foreground">{held.items.length} item(s) • Held at {held.created_at}</div>
                    </div>
                    <IconAction label="Recall" icon={<PlayCircle className="h-3.5 w-3.5" />} onClick={() => handleRecallBill(held)} className="bg-amber-500 hover:bg-amber-600 text-foreground font-bold text-xs rounded-lg gap-1" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Cash Denomination Shift Closing Modal */}
      {showShiftCloseModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calculator className="h-5 w-5 text-emerald-400" />
                Day-End Z-Report Cash Counter
              </h2>
              <button onClick={() => setShowShiftCloseModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              {(["500", "200", "100", "50", "20", "10", "coins"] as const).map((denom) => (
                <div key={denom} className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground uppercase">₹{denom} Count</Label>
                  <Input
                    type="number"
                    value={denominations[denom]}
                    onChange={(e) => setDenominations((prev) => ({ ...prev, [denom]: Number(e.target.value || 0) }))}
                    className="bg-background border-border text-foreground text-xs h-9"
                  />
                </div>
              ))}
            </div>

            <div className="pt-3 border-t border-border flex items-center justify-between">
              <div>
                <div className="text-xs text-muted-foreground">Total Counted Cash</div>
                <div className="text-xl font-extrabold text-emerald-400">₹{totalCountedCash.toFixed(2)}</div>
              </div>
              <Button onClick={() => { toast.success("Shift closed & Z-Report generated!"); setShowShiftCloseModal(false); }} className="bg-emerald-600 hover:bg-emerald-500 text-foreground font-bold rounded-xl h-10 px-4 text-xs">
                Close Shift
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Serial Number Modal */}
      {showSerialModal && selectedItemForSerial && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground">Add Serial / IMEI Number</h2>
              <button onClick={() => setShowSerialModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">{selectedItemForSerial.name}</Label>
              <Input
                type="text"
                placeholder="Scan or enter Serial # / IMEI"
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                className="bg-background border-border text-foreground text-xs h-10 font-mono"
              />
            </div>
            <Button onClick={handleSaveSerial} className="w-full bg-[#00aef0] text-foreground font-bold h-10 text-xs rounded-xl">
              Save Serial Number
            </Button>
          </div>
        </div>
      )}

      {/* Dynamic UPI QR Code Modal */}
      {showUpiQrModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground">Scan UPI QR Code</h2>
              <button onClick={() => setShowUpiQrModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="bg-white p-4 rounded-2xl inline-block mx-auto border border-border shadow-inner">
              {/* Dynamic QR SVG Representation */}
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                  `upi://pay?pa=${upiBankAccount.match(/vpa:\s*([^\)]+)/)?.[1] || "store@upi"}&pn=Store&am=${grandTotal}&cu=INR`
                )}`}
                alt="UPI QR Code"
                className="w-44 h-44 mx-auto"
              />
            </div>
            <div className="space-y-1 text-xs">
              <div className="font-extrabold text-lg text-emerald-400">₹{grandTotal.toFixed(2)}</div>
              <div className="text-muted-foreground font-mono text-[11px]">{upiBankAccount}</div>
            </div>
            <Button onClick={() => setShowUpiQrModal(false)} className="w-full bg-emerald-600 hover:bg-emerald-500 text-foreground font-bold h-10 text-xs rounded-xl">
              Done / Payment Received
            </Button>
          </div>
        </div>
      )}

      {/* Printable Thermal Receipt Modal */}
      {showReceiptModal && completedOrder && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border rounded-3xl max-w-sm w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border pb-3">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-1.5">
                <span>🧾</span> Order Receipt
              </h2>
              <button onClick={() => setShowReceiptModal(false)} className="text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Printable Thermal Receipt Preview Area */}
            <div id="printable-pos-receipt" className="bg-white text-black p-4 rounded-xl font-mono text-xs space-y-2 border border-slate-300">
              <div className="text-center font-bold text-sm border-b pb-1">
                <div>DAILYBIZ RETAIL STORE</div>
                <div className="text-[10px] font-normal text-slate-600">GSTIN: 29AAAAA0000A1Z5</div>
              </div>
              <div className="text-[10px] space-y-0.5 text-slate-700">
                <div>Order: #{completedOrder.order_number}</div>
                <div>Date: {completedOrder.date}</div>
                {completedOrder.customerMobile && <div>Customer: {completedOrder.customerMobile}</div>}
                <div>Payment: {completedOrder.payment_method}</div>
              </div>
              <div className="border-t border-b border-dashed border-slate-400 py-1 space-y-1">
                {completedOrder.items.map((it: any, i: number) => (
                  <div key={i} className="flex justify-between text-[11px]">
                    <div className="truncate pr-1">{it.quantity}x {it.name}</div>
                    <div className="shrink-0">₹{(it.selling_price * it.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="space-y-0.5 text-right font-bold text-[11px] pt-1">
                <div className="flex justify-between font-normal"><span>Subtotal:</span><span>₹{completedOrder.subtotal.toFixed(2)}</span></div>
                <div className="flex justify-between font-normal"><span>GST:</span><span>₹{completedOrder.taxTotal.toFixed(2)}</span></div>
                {completedOrder.discountAmount > 0 && (
                  <div className="flex justify-between font-normal text-slate-600"><span>Discount:</span><span>-₹{completedOrder.discountAmount.toFixed(2)}</span></div>
                )}
                <div className="flex justify-between text-sm pt-1 border-t border-slate-400"><span>Total:</span><span>₹{completedOrder.grandTotal.toFixed(2)}</span></div>
              </div>
              <div className="text-center text-[9px] text-slate-500 pt-2 border-t border-dashed">
                Thank you for shopping with us!
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2">
              <Button
                onClick={() => {
                  window.print();
                }}
                className="flex-1 bg-[#00aef0] hover:bg-[#0284c7] text-foreground font-bold h-10 text-xs rounded-xl"
              >
                🖨️ Print Receipt (80mm)
              </Button>
              <Button
                variant="outline"
                onClick={() => setShowReceiptModal(false)}
                className="h-10 text-xs rounded-xl border-border"
              >
                Close
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
