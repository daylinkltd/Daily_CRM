/**
 * DailyBuz Universal Marketing AI — Brand Asset Selector
 *
 * Content-aware intelligent asset selection algorithm.
 * Selects only relevant tenant brand assets (Logos, Products, UI Screenshots, People, Backgrounds)
 * based on user request, detected domain, and asset metadata.
 */

export type BrandAssetCategory = 'LOGOS' | 'PRODUCTS' | 'UI_DIGITAL' | 'PEOPLE' | 'OTHER';

export interface BrandAsset {
  id: string;
  workspace_id?: string;
  name: string;
  category: BrandAssetCategory;
  sub_category?: string;
  description?: string;
  storage_path?: string;
  public_url: string;
  mime_type?: string;
  file_size_bytes?: number;
  dimensions?: string;
}

export interface SelectedAssetReference {
  id: string;
  name: string;
  category: BrandAssetCategory;
  sub_category?: string;
  public_url: string;
  description?: string;
  usageInstruction: string;
  relevanceScore: number;
}

export interface BrandProfileData {
  id?: string;
  workspace_id?: string;
  company_name: string;
  website?: string;
  business_description?: string;
  industry?: string;
  target_audience?: string;
  brand_voice?: string;
  brand_personality?: string;
  primary_color?: string;
  secondary_color?: string;
  brand_guidelines?: string;
}

/**
 * Intelligent Asset Relevance Selector
 */
export function selectRelevantBrandAssets(params: {
  topic: string;
  userRequest?: string;
  contentType?: string;
  objective?: string;
  availableAssets: BrandAsset[];
}): SelectedAssetReference[] {
  const { topic, userRequest = '', contentType = 'social', objective = '', availableAssets } = params;

  if (!availableAssets || availableAssets.length === 0) {
    return [];
  }

  const combinedQuery = `${topic} ${userRequest} ${objective}`.toLowerCase();
  const queryTokens = combinedQuery
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  // Intent classification flags
  const isPeopleTopic =
    /\b(founder|ceo|team|leadership|welcome|hiring|interview|behind the scenes|culture|employee)\b/i.test(
      combinedQuery
    );
  const isUiDigitalTopic =
    /\b(app|application|dashboard|software|saas|platform|portal|feature|screen|ui|ux|mobile app|website|crm|analytics)\b/i.test(
      combinedQuery
    );
  const hasPhysicalProductKeywords =
    /\b(candle|fragrance|pizza|food|restaurant|sneaker|shoes|shoe|fashion|clothing|jewel|bottle|package|drink|coffee|collection|menu|merch)\b/i.test(
      combinedQuery
    );
  const isProductTopic = hasPhysicalProductKeywords || (!isPeopleTopic && !isUiDigitalTopic);

  const scoredAssets: Array<{ asset: BrandAsset; score: number; usage: string }> = [];

  for (const asset of availableAssets) {
    let score = 0;
    let usage = 'Use as secondary brand context';

    const assetNameLower = (asset.name || '').toLowerCase();
    const assetDescLower = (asset.description || '').toLowerCase();
    const assetSubCatLower = (asset.sub_category || '').toLowerCase();
    const assetFullText = `${assetNameLower} ${assetDescLower} ${assetSubCatLower}`;

    // Token match count
    let tokenMatches = 0;
    for (const token of queryTokens) {
      if (assetFullText.includes(token)) {
        tokenMatches += 1;
      }
    }

    switch (asset.category) {
      case 'LOGOS':
        // Primary logo gets base score for branding/closing frame
        score = 50;
        if (assetSubCatLower.includes('primary') || assetNameLower.includes('primary') || assetNameLower.includes('logo')) {
          score += 20;
        }
        usage = "Use the company's actual logo for subtle branding in the final frame and corner watermark.";
        break;

      case 'PRODUCTS':
        if (isProductTopic && !isPeopleTopic && !isUiDigitalTopic) {
          score = 60 + tokenMatches * 25;
          usage = 'Use the provided product image as the primary product reference.';
        } else if (hasPhysicalProductKeywords && tokenMatches > 0) {
          score = 50 + tokenMatches * 25;
          usage = 'Use the provided product image as the primary product reference.';
        } else {
          // Irrelevant product for people/pure UI post
          score = tokenMatches > 0 ? 15 + tokenMatches * 10 : 0;
          usage = 'Use as contextual product imagery.';
        }
        break;

      case 'UI_DIGITAL':
        if (isUiDigitalTopic) {
          score = 65 + tokenMatches * 25;
          usage = 'Use as the interface reference displayed on the device screen (laptop/mobile).';
        } else {
          // Do not include UI screenshots for food or candle posts
          score = tokenMatches > 0 ? 10 : 0;
          usage = 'Use as UI screen reference.';
        }
        break;

      case 'PEOPLE':
        if (isPeopleTopic) {
          score = 70 + tokenMatches * 25;
          usage = 'Use as the subject portrait / person reference.';
        } else {
          // Strongly penalize founder/people photos for physical product promotion
          score = tokenMatches > 0 ? 5 : 0;
          usage = 'Use as people reference.';
        }
        break;

      case 'OTHER':
        score = 20 + tokenMatches * 15;
        usage = 'Use as the atmospheric brand background / environment reference.';
        break;
    }

    if (score > 10) {
      scoredAssets.push({ asset, score, usage });
    }
  }

  // Sort descending by score
  scoredAssets.sort((a, b) => b.score - a.score);

  // Pick top 1 Logo + up to 2 specific category assets (max 3 total)
  const selected: SelectedAssetReference[] = [];
  let logoIncluded = false;
  let nonLogoCount = 0;

  for (const item of scoredAssets) {
    if (item.asset.category === 'LOGOS') {
      if (!logoIncluded) {
        selected.push({
          id: item.asset.id,
          name: item.asset.name,
          category: item.asset.category,
          sub_category: item.asset.sub_category,
          public_url: item.asset.public_url,
          description: item.asset.description,
          usageInstruction: item.usage,
          relevanceScore: item.score,
        });
        logoIncluded = true;
      }
    } else {
      if (nonLogoCount < 2) {
        selected.push({
          id: item.asset.id,
          name: item.asset.name,
          category: item.asset.category,
          sub_category: item.asset.sub_category,
          public_url: item.asset.public_url,
          description: item.asset.description,
          usageInstruction: item.usage,
          relevanceScore: item.score,
        });
        nonLogoCount += 1;
      }
    }
  }

  return selected;
}

/**
 * Formats referenced asset instructions into clean prompt directives
 */
export function formatAssetReferencesForPrompt(selectedAssets: SelectedAssetReference[]): {
  imageAssetDirectives: string[];
  videoAssetDirectives: string[];
} {
  const imageAssetDirectives: string[] = [];
  const videoAssetDirectives: string[] = [];

  if (!selectedAssets || selectedAssets.length === 0) {
    return { imageAssetDirectives, videoAssetDirectives };
  }

  for (const asset of selectedAssets) {
    if (asset.category === 'LOGOS') {
      imageAssetDirectives.push(
        `Use the company's actual logo for subtle branding:\n${asset.public_url}`
      );
      videoAssetDirectives.push(
        `Use the company logo in the final frame:\n${asset.public_url}`
      );
    } else if (asset.category === 'PRODUCTS') {
      imageAssetDirectives.push(
        `Use the provided product image as the primary product reference:\n${asset.public_url}`
      );
      videoAssetDirectives.push(
        `Use this product image as the primary visual reference:\n${asset.public_url}`
      );
    } else if (asset.category === 'UI_DIGITAL') {
      imageAssetDirectives.push(
        `Use this UI/app screenshot as the exact interface reference on the device display:\n${asset.public_url}`
      );
      videoAssetDirectives.push(
        `Use this UI/app screenshot as the screen recording / interface visual reference:\n${asset.public_url}`
      );
    } else if (asset.category === 'PEOPLE') {
      imageAssetDirectives.push(
        `Use this portrait photo as the visual subject reference:\n${asset.public_url}`
      );
      videoAssetDirectives.push(
        `Use this portrait photo as the main subject reference:\n${asset.public_url}`
      );
    } else {
      imageAssetDirectives.push(
        `Use this brand asset as visual styling reference:\n${asset.public_url}`
      );
      videoAssetDirectives.push(
        `Use this brand asset as visual styling reference:\n${asset.public_url}`
      );
    }
  }

  return { imageAssetDirectives, videoAssetDirectives };
}
