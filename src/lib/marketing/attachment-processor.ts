/**
 * Attachment-First Context Grounding & Semantic Relevance Engine
 * 
 * Ensures marketing and blog content generation is strictly grounded in uploaded
 * reference articles and documents rather than drifting into generic topics from keywords.
 */

export interface ReferenceArticle {
  id?: string;
  name: string;
  content: string;
  type?: string;
  source?: 'file' | 'pasted' | 'url' | string;
  size?: number;
}

export interface AttachmentAnalysis {
  hasAttachments: boolean;
  coreTopic: string;
  subTopics: string[];
  keyFacts: string[];
  keyTerminology: string[];
  keyEntities: string[];
  supportingPoints: string[];
  contentStructure: string[];
  suggestedAudience?: string;
  keyConcepts: string[];
  summary: string;
  sourceNames: string[];
  totalWordCount: number;
  warnings: string[];
}

export interface RelevanceValidationResult {
  score: number; // 0 to 100
  passed: boolean; // score >= 70
  matchedEntities: string[];
  matchedTerminology: string[];
  matchedFacts: string[];
  missingConcepts: string[];
  verdict: 'HIGHLY_GROUNDED' | 'MODERATELY_GROUNDED' | 'DRIFTED_UNRELATED';
  explanation: string;
}

export interface GenerationTraceContext {
  hasAttachments: boolean;
  hasReferenceArticles?: boolean;
  hasWebResearch?: boolean;
  attachedArticleNames: string[];
  extractedTopic: string;
  keyFactsExtracted: string[];
  keyEntities: string[];
  keyTerminology: string[];
  primaryKeywordUsed: string;
  generatedTopic: string;
  relevanceScore: number;
  relevancePassed: boolean;
  matchedEntities: string[];
  matchedTerminology: string[];
  regenerationAttempts: number;
  groundingConfidence: 'VERIFIED_GROUNDED' | 'LIVE_RESEARCH_GROUNDED' | 'DIRECT_AI_GENERATED' | 'FALLBACK_KEYWORD_ONLY';
  warnings: string[];
  webResearchReport?: {
    topic: string;
    searchQueries: string[];
    sourcesFound: number;
    sourcesSelected: number;
    topSources: string[];
    relevanceScore: number;
  };
}

const STOP_WORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren\'t',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'can\'t', 'cannot', 'could', 'couldn\'t', 'did', 'didn\'t', 'do', 'does', 'doesn\'t', 'doing',
  'don\'t', 'down', 'during', 'each', 'few', 'for', 'from', 'further', 'had', 'hadn\'t', 'has', 'hasn\'t',
  'have', 'haven\'t', 'having', 'he', 'he\'d', 'he\'ll', 'he\'s', 'her', 'here', 'here\'s', 'hers',
  'herself', 'him', 'himself', 'his', 'how', 'how\'s', 'i', 'i\'d', 'i\'ll', 'i\'m', 'i\'ve', 'if', 'in',
  'into', 'is', 'isn\'t', 'it', 'it\'s', 'its', 'itself', 'let\'s', 'me', 'more', 'most', 'mustn\'t', 'my',
  'myself', 'no', 'nor', 'not', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'ought', 'our', 'ours',
  'ourselves', 'out', 'over', 'own', 'same', 'shan\'t', 'she', 'she\'d', 'she\'ll', 'she\'s', 'should',
  'shouldn\'t', 'so', 'some', 'such', 'than', 'that', 'that\'s', 'the', 'their', 'theirs', 'them',
  'themselves', 'then', 'there', 'there\'s', 'these', 'they', 'they\'d', 'they\'ll', 'they\'re', 'they\'ve',
  'this', 'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'wasn\'t', 'we', 'we\'d',
  'we\'ll', 'we\'re', 'we\'ve', 'were', 'weren\'t', 'what', 'what\'s', 'when', 'when\'s', 'where', 'where\'s',
  'which', 'while', 'who', 'who\'s', 'whom', 'why', 'why\'s', 'with', 'won\'t', 'would', 'wouldn\'t', 'you',
  'you\'d', 'you\'ll', 'you\'re', 'you\'ve', 'your', 'yours', 'yourself', 'yourselves'
]);

/**
 * Normalizes and analyzes one or more reference articles.
 */
export function analyzeReferenceArticles(
  rawInput?: ReferenceArticle[] | Array<{ id?: string; name?: string; content?: string; type?: string; source?: string; size?: number }> | string[] | string
): AttachmentAnalysis {
  const warnings: string[] = [];

  // Normalize input into ReferenceArticle[]
  const articles: ReferenceArticle[] = [];

  if (typeof rawInput === 'string' && rawInput.trim().length > 0) {
    articles.push({
      name: 'Reference Document',
      content: rawInput.trim(),
    });
  } else if (Array.isArray(rawInput)) {
    rawInput.forEach((item, index) => {
      if (typeof item === 'string' && item.trim().length > 0) {
        articles.push({
          name: `Reference Document ${index + 1}`,
          content: item.trim(),
        });
      } else if (item && typeof item === 'object' && typeof item.content === 'string') {
        if (item.content.trim().length > 0) {
          articles.push({
            id: item.id,
            name: item.name?.trim() || `Reference Document ${index + 1}`,
            content: item.content.trim(),
            type: item.type,
            size: item.size,
          });
        } else {
          warnings.push(`Attachment "${item.name || `Document ${index + 1}`}" was empty and could not be processed.`);
        }
      }
    });
  }

  if (articles.length === 0) {
    return {
      hasAttachments: false,
      coreTopic: '',
      subTopics: [],
      keyFacts: [],
      keyTerminology: [],
      keyEntities: [],
      supportingPoints: [],
      contentStructure: [],
      keyConcepts: [],
      summary: '',
      sourceNames: [],
      totalWordCount: 0,
      warnings,
    };
  }

  const combinedContent = articles.map((a) => a.content).join('\n\n');
  const totalWordCount = combinedContent.split(/\s+/).filter(Boolean).length;
  const sourceNames = articles.map((a) => a.name);

  // 1. Extract Key Facts (Sentences with numbers, percentages, dates, metrics, protocols, or actions)
  const allSentences = combinedContent
    .split(/(?<=[.?!])\s+(?=[A-Z0-9])/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 25 && s.length <= 300);

  const factRegex = /(\d+[%mkb]?|\b\d{4}\b|\b(?:protocol|management|system|response|increase|decrease|mitigate|disaster|framework|strategy|emergency|policy|standard|measure|impact|report|data|finding|result|target)\b)/i;
  const keyFacts = Array.from(
    new Set(allSentences.filter((s) => factRegex.test(s)))
  ).slice(0, 8);

  // 2. Extract Proper Entities (e.g. "Nepal", "Bagmati", "NDRRMA", "WHO", "Disaster Management Authority", etc.)
  const entityMatches = combinedContent.match(/\b[A-Z][a-zA-Z0-9]*(?:\s+[A-Z][a-zA-Z0-9]*)*\b/g) || [];
  const entityFrequency = new Map<string, number>();

  for (const ent of entityMatches) {
    const trimmed = ent.trim();
    if (trimmed.length > 2 && !STOP_WORDS.has(trimmed.toLowerCase())) {
      entityFrequency.set(trimmed, (entityFrequency.get(trimmed) || 0) + 1);
    }
  }

  // Sort entities by frequency
  const keyEntities = Array.from(entityFrequency.entries())
    .filter(([name, count]) => count >= 1 && name.split(/\s+/).length <= 4)
    .sort((a, b) => b[1] - a[1])
    .map(([name]) => name)
    .slice(0, 10);

  // 3. Extract Terminology (Multi-word domain terms & significant keywords)
  const termMatches = combinedContent.toLowerCase().match(/\b[a-z]{3,}(?:-[a-z]{3,})*\b/g) || [];
  const termFrequency = new Map<string, number>();

  for (const t of termMatches) {
    if (!STOP_WORDS.has(t) && t.length > 3) {
      termFrequency.set(t, (termFrequency.get(t) || 0) + 1);
    }
  }

  const keyTerminology = Array.from(termFrequency.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([term]) => term)
    .slice(0, 15);

  // 4. Extract Headings / Structure
  const structureMatches = combinedContent
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('#') || line.match(/^(?:\d+\.|\b(?:Section|Chapter|Part)\s+\d+:?)\s+/i))
    .map((line) => line.replace(/^#+\s*/, '').replace(/^\d+\.\s*/, '').trim())
    .filter((line) => line.length > 3 && line.length < 90);

  const contentStructure = structureMatches.length >= 2 ? structureMatches.slice(0, 6) : [
    'Executive Overview & Background',
    'Core Assessment & Key Evidence',
    'Operational Frameworks & Strategies',
    'Actionable Implementation & Next Steps',
  ];

  // 5. Determine Core Topic
  // First look at document titles or top headings
  let coreTopic = '';
  const firstNonEmptyLine = combinedContent.split('\n').map((l) => l.trim()).find((l) => l.length > 5);

  if (firstNonEmptyLine && firstNonEmptyLine.length < 100 && !firstNonEmptyLine.endsWith('.')) {
    coreTopic = firstNonEmptyLine.replace(/^#+\s*/, '').trim();
  } else if (keyEntities.length > 0) {
    const topEntities = keyEntities.slice(0, 2).join(' ');
    const topTerms = keyTerminology.slice(0, 2).join(' ');
    coreTopic = `${topEntities} ${topTerms}`.trim();
  } else {
    coreTopic = articles[0]?.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' ') || 'Reference Knowledge Assessment';
  }

  // Capitalize core topic neatly
  coreTopic = coreTopic.charAt(0).toUpperCase() + coreTopic.slice(1);

  // 6. Supporting Points
  const supportingPoints = keyFacts.map((fact) => {
    return fact.length > 100 ? fact.slice(0, 97) + '...' : fact;
  }).slice(0, 5);

  // 7. Summary
  const summarySentences = allSentences.slice(0, 3);
  const summary = summarySentences.join(' ') || combinedContent.slice(0, 250);

  return {
    hasAttachments: true,
    coreTopic,
    subTopics: contentStructure,
    keyFacts,
    keyTerminology,
    keyEntities,
    supportingPoints,
    contentStructure,
    keyConcepts: Array.from(new Set([...keyEntities, ...keyTerminology.slice(0, 6)])),
    summary,
    sourceNames,
    totalWordCount,
    warnings,
  };
}

/**
 * Validates semantic relevance and factual grounding between attachment analysis and generated article.
 */
export function calculateRelevanceScore(params: {
  analysis: AttachmentAnalysis;
  requestedTopic: string;
  primaryKeyword: string;
  generatedTitle: string;
  generatedHeadings: Array<{ level?: number; text: string } | string>;
  generatedContent: string;
}): RelevanceValidationResult {
  const { analysis, primaryKeyword, generatedTitle, generatedHeadings, generatedContent } = params;

  if (!analysis.hasAttachments) {
    return {
      score: 100,
      passed: true,
      matchedEntities: [],
      matchedTerminology: [],
      matchedFacts: [],
      missingConcepts: [],
      verdict: 'HIGHLY_GROUNDED',
      explanation: 'No attachments provided; evaluated against standard prompt parameters.',
    };
  }

  const fullGeneratedText = [
    generatedTitle,
    ...generatedHeadings.map((h) => (typeof h === 'string' ? h : h.text)),
    generatedContent,
  ].join(' ').toLowerCase();

  // 1. Entity Overlap Match
  const matchedEntities: string[] = [];
  for (const entity of analysis.keyEntities) {
    if (fullGeneratedText.includes(entity.toLowerCase())) {
      matchedEntities.push(entity);
    }
  }

  // 2. Terminology Overlap Match
  const matchedTerminology: string[] = [];
  for (const term of analysis.keyTerminology) {
    if (fullGeneratedText.includes(term.toLowerCase())) {
      matchedTerminology.push(term);
    }
  }

  // 3. Factual Grounding Match (Check key facts or core numbers)
  const matchedFacts: string[] = [];
  for (const fact of analysis.keyFacts) {
    // Extract key numbers or phrases from the fact
    const factNumbers = fact.match(/\b\d+(?:[%mkb]|\.\d+)?\b/g) || [];
    const factWords = fact.toLowerCase().split(/\s+/).filter((w) => w.length > 5 && !STOP_WORDS.has(w));
    
    const hasNumbers = factNumbers.length > 0 && factNumbers.some((n) => fullGeneratedText.includes(n));
    const wordMatches = factWords.filter((w) => fullGeneratedText.includes(w)).length;

    if (hasNumbers || wordMatches >= Math.min(3, factWords.length)) {
      matchedFacts.push(fact);
    }
  }

  // 4. Missing concepts
  const missingConcepts = analysis.keyConcepts.filter(
    (c) => !fullGeneratedText.includes(c.toLowerCase())
  );

  // Score Calculations
  const entityScore = analysis.keyEntities.length > 0
    ? (matchedEntities.length / Math.min(5, analysis.keyEntities.length)) * 35
    : 35;

  const terminologyScore = analysis.keyTerminology.length > 0
    ? (matchedTerminology.length / Math.min(8, analysis.keyTerminology.length)) * 35
    : 35;

  const factualScore = analysis.keyFacts.length > 0
    ? (matchedFacts.length / Math.min(3, analysis.keyFacts.length)) * 20
    : 20;

  // Title & Topic alignment
  const titleLower = generatedTitle.toLowerCase();
  const topicAligned = analysis.keyEntities.some((e) => titleLower.includes(e.toLowerCase())) ||
    analysis.keyTerminology.slice(0, 5).some((t) => titleLower.includes(t.toLowerCase()));
  const topicScore = topicAligned ? 10 : 0;

  const rawScore = Math.round(entityScore + terminologyScore + factualScore + topicScore);
  const score = Math.min(100, Math.max(0, rawScore));
  const passed = score >= 70;

  let verdict: RelevanceValidationResult['verdict'] = 'DRIFTED_UNRELATED';
  if (score >= 80) verdict = 'HIGHLY_GROUNDED';
  else if (score >= 65) verdict = 'MODERATELY_GROUNDED';

  const explanation = passed
    ? `Article is verified grounded in "${analysis.sourceNames.join(', ')}" (${matchedEntities.length} entities and ${matchedTerminology.length} terminology matches).`
    : `Article score (${score}%) is below the 70% grounding threshold. Lacks key context from attached documents.`;

  return {
    score,
    passed,
    matchedEntities,
    matchedTerminology,
    matchedFacts,
    missingConcepts,
    verdict,
    explanation,
  };
}
