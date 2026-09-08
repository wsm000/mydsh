import { WebError } from "@deepseek-ai/dsh-web";

//#region lib/types/provider.js
/**
 * Academic paper search over multiple free scholarly endpoints. Supports:
 *
 *   1. arXiv          — preprints in physics, math, CS, stats, etc.
 *   2. Semantic Scholar — AI-powered academic search with citations
 *   3. PubMed         — biomedical and life sciences
 *   4. CORE           — open access research papers
 *
 * Results are merged, deduplicated by DOI/arXiv ID, and ranked by relevance
 * and citation count when available.
 *
 * Network: Node 24 built-in fetch honors `$NODE_USE_ENV_PROXY` + `$HTTPS_PROXY`.
 * @module dsh-academic-search/provider
 */

/** Stable id this provider registers under. */
const ACADEMIC_PROVIDER_ID = "academic-paper";

/** arXiv API endpoint */
const ARXIV_API = "http://export.arxiv.org/api/query";

/** Semantic Scholar API endpoint */
const S2_API = "https://api.semanticscholar.org/graph/v1/paper/search";

/** PubMed E-utilities endpoint */
const PUBMED_SEARCH_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi";
const PUBMED_SUMMARY_API = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi";

/** CORE API endpoint */
const CORE_API = "https://api.core.ac.uk/v3/search/works";

/** Hard cap on results requested from a backend in one call. */
const MAX_COUNT = 20;

/** Per-backend cooperative timeouts. */
const TIMEOUTS = { arxiv: 15000, s2: 12000, pubmed: 15000, core: 12000 };

/** Browser-like UA for better API compatibility. */
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";

/**
 * Parse arXiv Atom feed response.
 * @param {string} xml - The Atom XML response.
 * @returns {Array<{url: string, title: string, snippet?: string, authors?: string[], year?: number, citations?: number}>}
 */
function parseArXivResults(xml) {
  const sources = [];
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  for (const entry of entries) {
    // Extract ID (URL)
    const idMatch = entry.match(/<id>(.*?)<\/id>/);
    if (!idMatch) continue;
    const url = idMatch[1].trim();

    // Extract title
    const titleMatch = entry.match(/<title>([\s\S]*?)<\/title>/);
    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/\s+/g, " ").trim();

    // Extract abstract
    const summaryMatch = entry.match(/<summary>([\s\S]*?)<\/summary>/);
    const snippet = summaryMatch
      ? summaryMatch[1].replace(/\s+/g, " ").trim().slice(0, 300)
      : undefined;

    // Extract authors
    const authorMatches = entry.match(/<author>[\s\S]*?<name>(.*?)<\/name>[\s\S]*?<\/author>/g) || [];
    const authors = authorMatches.map((a) => {
      const nameMatch = a.match(/<name>(.*?)<\/name>/);
      return nameMatch ? nameMatch[1].trim() : "";
    }).filter(Boolean);

    // Extract publication year
    const publishedMatch = entry.match(/<published>(.*?)<\/published>/);
    const year = publishedMatch ? parseInt(publishedMatch[1].slice(0, 4), 10) : undefined;

    sources.push({
      url,
      title,
      ...(snippet ? { snippet } : {}),
      ...(authors.length > 0 ? { authors } : {}),
      ...(year ? { year } : {}),
      source: "arXiv"
    });
  }

  return sources;
}

/**
 * Parse Semantic Scholar JSON response.
 * @param {object} json - The JSON response.
 * @returns {Array<{url: string, title: string, snippet?: string, authors?: string[], year?: number, citations?: number}>}
 */
function parseS2Results(json) {
  if (!json.data || !Array.isArray(json.data)) return [];

  return json.data.map((paper) => {
    const url = paper.url || paper.externalIds?.DOI
      ? `https://doi.org/${paper.externalIds.DOI}`
      : paper.externalIds?.ArXiv
      ? `https://arxiv.org/abs/${paper.externalIds.ArXiv}`
      : `https://www.semanticscholar.org/paper/${paper.paperId}`;

    const authors = paper.authors?.map((a) => a.name).filter(Boolean) || [];
    
    return {
      url,
      title: paper.title || "",
      ...(paper.abstract ? { snippet: paper.abstract.slice(0, 300) } : {}),
      ...(authors.length > 0 ? { authors } : {}),
      ...(paper.year ? { year: paper.year } : {}),
      ...(paper.citationCount ? { citations: paper.citationCount } : {}),
      ...(paper.externalIds?.DOI ? { doi: paper.externalIds.DOI } : {}),
      ...(paper.externalIds?.ArXiv ? { arxivId: paper.externalIds.ArXiv } : {}),
      source: "Semantic Scholar"
    };
  }).filter((p) => p.title.length > 0);
}

/**
 * Parse PubMed search response (XML) to get PMIDs.
 * @param {string} xml - The XML response.
 * @returns {string[]} - Array of PubMed IDs.
 */
function parsePubMedSearchResults(xml) {
  const idMatches = xml.match(/<Id>(\d+)<\/Id>/g) || [];
  return idMatches.map((m) => m.match(/\d+/)[0]);
}

/**
 * Parse PubMed summary response (XML) to get paper details.
 * @param {string} xml - The XML response.
 * @returns {Array<{url: string, title: string, snippet?: string, authors?: string[], year?: number}>}
 */
function parsePubMedSummaryResults(xml) {
  const sources = [];
  const docSums = xml.match(/<DocumentSummary[\s\S]*?<\/DocumentSummary>/g) || [];

  for (const doc of docSums) {
    // Extract PMID
    const uidMatch = doc.match(/uid="(\d+)"/);
    if (!uidMatch) continue;
    const pmid = uidMatch[1];

    // Extract title
    const titleMatch = doc.match(/<Title>([\s\S]*?)<\/Title>/);
    if (!titleMatch) continue;
    const title = titleMatch[1].replace(/\s+/g, " ").trim();

    // Extract authors
    const authorMatches = doc.match(/<Author[\s\S]*?<Name>(.*?)<\/Name>[\s\S]*?<\/Author>/g) || [];
    const authors = authorMatches.map((a) => {
      const nameMatch = a.match(/<Name>(.*?)<\/Name>/);
      return nameMatch ? nameMatch[1].trim() : "";
    }).filter(Boolean);

    // Extract publication year
    const pubDateMatch = doc.match(/<PubDate>(.*?)<\/PubDate>/);
    const year = pubDateMatch ? parseInt(pubDateMatch[1].slice(0, 4), 10) : undefined;

    // Extract source (journal)
    const sourceMatch = doc.match(/<Source>(.*?)<\/Source>/);
    const snippet = sourceMatch ? `Published in: ${sourceMatch[1]}` : undefined;

    sources.push({
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      title,
      ...(snippet ? { snippet } : {}),
      ...(authors.length > 0 ? { authors } : {}),
      ...(year ? { year } : {}),
      source: "PubMed"
    });
  }

  return sources;
}

/**
 * Parse CORE JSON response.
 * @param {object} json - The JSON response.
 * @returns {Array<{url: string, title: string, snippet?: string, authors?: string[], year?: number}>}
 */
function parseCoreResults(json) {
  if (!json.results || !Array.isArray(json.results)) return [];

  return json.results.map((paper) => {
    const url = paper.downloadUrl || paper.sourceFulltextUrls?.[0] || 
                (paper.doi ? `https://doi.org/${paper.doi}` : `https://core.ac.uk/display/${paper.id}`);

    const authors = paper.authors?.map((a) => typeof a === 'string' ? a : a.name).filter(Boolean) || [];

    return {
      url,
      title: paper.title || "",
      ...(paper.abstract ? { snippet: paper.abstract.slice(0, 300) } : 
          paper.description ? { snippet: paper.description.slice(0, 300) } : {}),
      ...(authors.length > 0 ? { authors } : {}),
      ...(paper.yearPublished ? { year: paper.yearPublished } : {}),
      ...(paper.doi ? { doi: paper.doi } : {}),
      source: "CORE"
    };
  }).filter((p) => p.title.length > 0);
}

/**
 * Deduplicate sources by DOI, arXiv ID, or URL.
 * Prefer sources with more metadata (citations, abstract, etc.).
 */
function deduplicateSources(sources) {
  const seen = new Map(); // key -> best source

  for (const source of sources) {
    let key = null;
    
    // Prefer DOI as primary key
    if (source.doi) {
      key = `doi:${source.doi.toLowerCase()}`;
    } else if (source.arxivId) {
      key = `arxiv:${source.arxivId.toLowerCase()}`;
    } else {
      // Use normalized URL as fallback
      key = `url:${source.url.toLowerCase().replace(/\/$/, '')}`;
    }

    const existing = seen.get(key);
    if (!existing) {
      seen.set(key, source);
      continue;
    }

    // Keep the one with more metadata
    const existingScore = (existing.citations || 0) * 10 + 
                         (existing.snippet ? 5 : 0) + 
                         (existing.authors?.length || 0);
    const newScore = (source.citations || 0) * 10 + 
                    (source.snippet ? 5 : 0) + 
                    (source.authors?.length || 0);

    if (newScore > existingScore) {
      seen.set(key, source);
    }
  }

  return Array.from(seen.values());
}

/**
 * Rank sources by relevance and citation count.
 */
function rankSources(sources, query) {
  const queryLower = query.toLowerCase();
  const queryTokens = queryLower.split(/\s+/).filter((t) => t.length > 2);

  return sources.sort((a, b) => {
    // Calculate title relevance
    const aTitle = a.title.toLowerCase();
    const bTitle = b.title.toLowerCase();
    const aExact = aTitle.includes(queryLower) ? 100 : 0;
    const bExact = bTitle.includes(queryLower) ? 100 : 0;
    
    const aTokens = queryTokens.filter((t) => aTitle.includes(t)).length;
    const bTokens = queryTokens.filter((t) => bTitle.includes(t)).length;
    
    const aRelevance = aExact + aTokens * 10;
    const bRelevance = bExact + bTokens * 10;

    // Combine relevance with citations (if available)
    const aCitations = a.citations || 0;
    const bCitations = b.citations || 0;

    // Weighted score: relevance (70%) + citations (30%)
    const aScore = aRelevance * 0.7 + Math.log(1 + aCitations) * 0.3 * 50;
    const bScore = bRelevance * 0.7 + Math.log(1 + bCitations) * 0.3 * 50;

    return bScore - aScore;
  });
}

/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "TimeoutError")
  );
}

/** Throw the provider's stable cancellation error when the caller already aborted. */
function throwIfSearchAborted(signal) {
  if (signal?.aborted === true) throw searchAborted(signal);
}

/** Build the provider's stable cancellation error while retaining the caller's reason. */
function searchAborted(signal, fallback) {
  return new WebError("Academic search aborted", "WEB_ABORTED", {
    cause: signal?.aborted === true ? signal.reason : fallback,
  });
}

/** The academic paper search provider; registered as `academic-paper` in ctx.web. */
class AcademicSearchProvider {
  id = ACADEMIC_PROVIDER_ID;

  /** Always available - uses free public APIs. */
  available() {
    return true;
  }

  async search(request, signal) {
    const query = typeof request.query === "string" ? request.query.trim() : "";
    if (query.length === 0)
      throw new WebError("web_search received an empty query", "WEB_PROVIDER_ERROR");

    const want =
      Number.isInteger(request.maxResults) && request.maxResults > 0
        ? Math.min(request.maxResults, MAX_COUNT)
        : 10;

    const allSources = [];
    const errors = [];

    // Run all backends in parallel
    const backends = this.backends(query, want);
    const results = await Promise.allSettled(
      backends.map((backend) => backend.run(signal))
    );

    for (let i = 0; i < results.length; i++) {
      const result = results[i];
      if (result.status === "fulfilled") {
        allSources.push(...result.value);
      } else {
        errors.push(`${backends[i].id}: ${result.reason}`);
      }
    }

    // If all backends failed, throw error
    if (allSources.length === 0 && errors.length === backends.length) {
      throw new WebError(
        `All academic search backends failed: ${errors.join("; ")}`,
        "WEB_PROVIDER_ERROR"
      );
    }

    // Deduplicate and rank
    const deduplicated = deduplicateSources(allSources);
    const ranked = rankSources(deduplicated, query);
    const sources = ranked.slice(0, want);

    return {
      sources,
      truncated: ranked.length > want,
    };
  }

  /**
   * Build backend search tasks.
   * @param {string} query - the trimmed query.
   * @param {number} want - requested result count (clamped).
   */
  backends(query, want) {
    const headers = {
      "user-agent": USER_AGENT,
      "accept": "application/json, text/xml, */*",
    };

    const run = (url, timeoutMs, parse, isJson = true) => async (signal) => {
      const timeout = AbortSignal.timeout(timeoutMs);
      const deadline = signal !== undefined ? AbortSignal.any([signal, timeout]) : timeout;

      let response;
      try {
        response = await fetch(url, {
          method: "GET",
          redirect: "follow",
          headers,
          signal: deadline,
        });
      } catch (error) {
        if (signal?.aborted === true || isAbortError(error))
          throw searchAborted(signal, error);
        throw new WebError(
          `Request to ${new URL(url).hostname} failed: ${String(error)}`,
          "WEB_PROVIDER_ERROR",
          { cause: error }
        );
      }

      if (!response.ok)
        throw new WebError(
          `Backend ${new URL(url).hostname} returned HTTP ${response.status}`,
          "WEB_PROVIDER_ERROR"
        );

      let body;
      try {
        body = isJson ? await response.json() : await response.text();
      } catch (error) {
        if (signal?.aborted === true || isAbortError(error))
          throw searchAborted(signal, error);
        throw new WebError(
          `Backend ${new URL(url).hostname} body read failed: ${String(error)}`,
          "WEB_PROVIDER_ERROR",
          { cause: error }
        );
      }

      return parse(body);
    };

    // arXiv
    const arxivUrl = `${ARXIV_API}?${new URLSearchParams({
      search_query: `all:${query}`,
      start: "0",
      max_results: String(Math.min(want, 10)),
      sortBy: "relevance",
    })}`;

    // Semantic Scholar
    const s2Url = `${S2_API}?${new URLSearchParams({
      query: query,
      limit: String(Math.min(want, 10)),
      fields: "title,abstract,authors,year,citationCount,externalIds,url",
    })}`;

    // PubMed (two-step: search then summary)
    const pubmedSearchUrl = `${PUBMED_SEARCH_API}?${new URLSearchParams({
      db: "pubmed",
      term: query,
      retmax: String(Math.min(want, 10)),
      retmode: "xml",
    })}`;

    // CORE
    const coreUrl = `${CORE_API}?${new URLSearchParams({
      q: query,
      limit: String(Math.min(want, 10)),
    })}`;

    return [
      {
        id: "arxiv",
        run: run(arxivUrl, TIMEOUTS.arxiv, parseArXivResults, false),
      },
      {
        id: "semantic-scholar",
        run: run(s2Url, TIMEOUTS.s2, parseS2Results, true),
      },
      {
        id: "pubmed",
        run: async (signal) => {
          // First fetch PMIDs
          const pmids = await run(pubmedSearchUrl, TIMEOUTS.pubmed, parsePubMedSearchResults, false)(signal);
          
          if (pmids.length === 0) return [];

          // Then fetch summaries
          const summaryUrl = `${PUBMED_SUMMARY_API}?${new URLSearchParams({
            db: "pubmed",
            id: pmids.join(","),
            retmode: "xml",
          })}`;

          return await run(summaryUrl, TIMEOUTS.pubmed, parsePubMedSummaryResults, false)(signal);
        },
      },
      {
        id: "core",
        run: run(coreUrl, TIMEOUTS.core, parseCoreResults, true),
      },
    ];
  }
}
//#endregion

//#region lib/types/index.js
/**
 * Register an academic paper search provider in `ctx.web`. Multi-backend
 * (arXiv, Semantic Scholar, PubMed, CORE) with deduplication and citation-aware ranking.
 * @module dsh-academic-search
 */

/** Cordis plugin name used by loader diagnostics. */
const name = "academic-search";

/** The web seam this provider registers into. */
const inject = ["web"];

/** Register the academic search provider with `ctx.web`. */
function apply(ctx) {
  ctx.web.registerSearchProvider(new AcademicSearchProvider());
}
//#endregion

export {
  ACADEMIC_PROVIDER_ID,
  AcademicSearchProvider,
  apply,
  inject,
  name,
  parseArXivResults,
  parseS2Results,
  parsePubMedSearchResults,
  parsePubMedSummaryResults,
  parseCoreResults,
  deduplicateSources,
  rankSources,
};
