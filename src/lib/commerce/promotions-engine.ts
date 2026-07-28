// src/lib/commerce/promotions-engine.ts
// ===========================================================================
// Decoupled Enterprise Promotion Evaluator & Priority Precedence Hierarchy Engine
// ===========================================================================

export interface PromotionEvaluationRequest {
  workspace_id: string;
  customer_id?: string;
  customer_type?: "RETAIL" | "WHOLESALE" | "DISTRIBUTOR";
  price_list_id?: string;
  items: Array<{
    product_id: string;
    category_id?: string;
    brand_id?: string;
    quantity: number;
    selling_price: number;
    mrp: number;
  }>;
  coupon_code?: string;
}

export interface AppliedPromotion {
  campaign_id: string;
  campaign_name: string;
  campaign_code?: string;
  offer_type: string;
  discount_amount: number;
  is_stackable: boolean;
  priority: number;
}

export interface EvaluatedItemResult {
  product_id: string;
  original_price: number;
  final_price: number;
  total_discount_amount: number;
  applied_promotions: AppliedPromotion[];
}

/**
 * Priority Hierarchy Evaluator:
 * Product (P1) > Customer Group (P2) > Brand (P3) > Category (P4) > Price List (P5) > Global/Festival (P6)
 */
export async function evaluatePromotions(
  supabase: any,
  req: PromotionEvaluationRequest
): Promise<{
  items: EvaluatedItemResult[];
  total_order_discount: number;
  applied_campaigns: AppliedPromotion[];
}> {
  const { workspace_id, customer_type, items, coupon_code } = req;

  // 1. Fetch Active Promotion Campaigns within Valid Date Range
  const now = new Date().toISOString();
  const { data: campaigns, error: campaignError } = await supabase
    .from("commerce_promotion_campaigns")
    .select(`
      id,
      name,
      code,
      priority,
      is_stackable,
      coupon_required,
      min_bill_amount,
      max_discount_amount,
      commerce_promotion_targets(*),
      commerce_promotion_benefits(*)
    `)
    .eq("workspace_id", workspace_id)
    .eq("status", "ACTIVE")
    .lte("start_date", now)
    .gte("end_date", now)
    .order("priority", { ascending: false });

  if (campaignError || !campaigns || campaigns.length === 0) {
    return {
      items: items.map((i) => ({
        product_id: i.product_id,
        original_price: i.selling_price,
        final_price: i.selling_price,
        total_discount_amount: 0,
        applied_promotions: [],
      })),
      total_order_discount: 0,
      applied_campaigns: [],
    };
  }

  const evaluatedItems: EvaluatedItemResult[] = [];
  let totalOrderDiscount = 0;
  const appliedCampaignsMap = new Map<string, AppliedPromotion>();

  for (const item of items) {
    let currentPrice = item.selling_price;
    let itemDiscountTotal = 0;
    const itemPromotions: AppliedPromotion[] = [];

    // Filter campaigns matching product targets or global scope
    for (const campaign of campaigns) {
      if (campaign.coupon_required && coupon_code !== campaign.code) {
        continue;
      }

      const targets = campaign.commerce_promotion_targets || [];
      const benefits = campaign.commerce_promotion_benefits || [];

      // Check if target matches product, category, or brand
      const matchesTarget = targets.length === 0 || targets.some((t: any) => {
        if (t.target_type === "PRODUCT" && t.target_id === item.product_id) return true;
        if (t.target_type === "CATEGORY" && t.target_id === item.category_id) return true;
        if (t.target_type === "BRAND" && t.target_id === item.brand_id) return true;
        if (t.target_type === "CUSTOMER_GROUP" && t.target_id === customer_type) return true;
        return false;
      });

      if (!matchesTarget) continue;

      // Calculate benefit discount amount
      for (const benefit of benefits) {
        let discount = 0;
        if (benefit.offer_type === "PERCENTAGE_DISCOUNT" && benefit.discount_percent > 0) {
          discount = (currentPrice * benefit.discount_percent) / 100;
        } else if (benefit.offer_type === "FLAT_AMOUNT_DISCOUNT" && benefit.flat_discount_amount > 0) {
          discount = benefit.flat_discount_amount;
        } else if (benefit.offer_type === "FIXED_SELLING_PRICE" && benefit.fixed_price > 0) {
          discount = Math.max(0, currentPrice - benefit.fixed_price);
        }

        if (discount > 0) {
          // Check max campaign limit
          if (campaign.max_discount_amount > 0) {
            discount = Math.min(discount, campaign.max_discount_amount);
          }

          itemDiscountTotal += discount;
          currentPrice = Math.max(0, currentPrice - discount);

          const appliedPromo: AppliedPromotion = {
            campaign_id: campaign.id,
            campaign_name: campaign.name,
            campaign_code: campaign.code,
            offer_type: benefit.offer_type,
            discount_amount: discount,
            is_stackable: campaign.is_stackable,
            priority: campaign.priority,
          };

          itemPromotions.push(appliedPromo);
          appliedCampaignsMap.set(campaign.id, appliedPromo);

          // If not stackable, apply best discount and stop evaluating lower priority rules
          if (!campaign.is_stackable) {
            break;
          }
        }
      }

      if (itemPromotions.length > 0 && !campaign.is_stackable) {
        break;
      }
    }

    evaluatedItems.push({
      product_id: item.product_id,
      original_price: item.selling_price,
      final_price: currentPrice,
      total_discount_amount: itemDiscountTotal,
      applied_promotions: itemPromotions,
    });

    totalOrderDiscount += itemDiscountTotal * item.quantity;
  }

  return {
    items: evaluatedItems,
    total_order_discount: totalOrderDiscount,
    applied_campaigns: Array.from(appliedCampaignsMap.values()),
  };
}
