import { WebError } from "@deepseek-ai/dsh-web";
//#region lib/types/provider.js
/**
 * Keyless web search over multiple free HTML endpoints. No API key, no per-query
 * billing. Backend chain (first relevant result set wins):
 *
 *   1. Bing      — best quality when healthy; `ensearch=1` international mode.
 *   2. Mojeek    — bot-tolerant independent index; strong for en/tech, empty for zh.
 *   3. Baidu     — Chinese web; intermittently serves a "网络不给力" placeholder.
 *   4. So.com    — Chinese web; stable, results carry so.com/link redirect hrefs.
 *
 * Poisoning: Bing's zh market intermittently answers untrusted clients with a
 * fully-populated but UNRELATED result page (trending/popular content). A result
 * set is accepted only when it is small (<5, honest sparse hits) or when at least
 * one result contains a meaningful query token; large token-free sets are treated
 * as poisoned and the next backend is tried. With `DSH_WEB_SEARCH_FREE_BESTEFFORT=1`
 * the first non-empty set is returned even when nothing is relevant.
 *
 * Network: Node 24 built-in fetch honors `$NODE_USE_ENV_PROXY` + `$HTTPS_PROXY`,
 * so on the normal dsh launch path (Clash Verge) requests ride the system proxy.
 * @module dsh-web-search-free/provider
 */
/** Stable id this provider registers under. */
const FREE_PROVIDER_ID = "free-web";
/** Bing web-search endpoint (HTML, not the XHR/JSON API). */
const SEARCH_ENDPOINT_BING = "https://www.bing.com/search";
/** Mojeek search endpoint. */
const SEARCH_ENDPOINT_MOJEEK = "https://www.mojeek.com/search";
/** Baidu search endpoint. */
const SEARCH_ENDPOINT_BAIDU = "https://www.baidu.com/s";
/** So.com (360) search endpoint. */
const SEARCH_ENDPOINT_SO360 = "https://www.so.com/s";
/** Hard cap on results requested from a backend in one call. */
const MAX_COUNT = 20;
/** Per-backend cooperative timeouts. */
const TIMEOUTS = { bing: 15000, mojeek: 10000, baidu: 12000, so360: 12000 };
/** Optional market override for Bing (e.g. `zh-CN` / `en-US`); empty = auto. */
const MARKET = process.env.DSH_WEB_SEARCH_FREE_MKT ?? "";
/**
 * Bing international-mode flag. Empirically required: the zh market poisons some
 * CJK queries entirely (unrelated trending pages); `ensearch=1` fixes that and
 * does not degrade ordinary queries. Set `0` to fall back to local mode.
 */
const ENSEARCH = process.env.DSH_WEB_SEARCH_FREE_ENSEARCH ?? "1";
/**
 * When `1`, the first non-empty result set wins even if nothing is relevant
 * (best-effort); default `0` returns an honest empty result instead of junk.
 */
const BESTEFFORT = process.env.DSH_WEB_SEARCH_FREE_BESTEFFORT ?? "0";
/** Browser-like UA keeps classic HTML markup stable and avoids soft walls. */
const USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const NAMED_ENTITIES = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: "\"",
	apos: "'",
	nbsp: " ",
	ensp: " ",
	emsp: " ",
	thinsp: " ",
	middot: "·",
	hellip: "…",
	darr: "→",
	ldquo: "“",
	rdquo: "”",
	lsquo: "‘",
	rsquo: "’",
	mdash: "—",
	ndash: "–",
	copy: "©",
	reg: "®",
	trade: "™",
	deg: "°"
};
/** Decode HTML entities (`&#174;`, `&#x27;`, and a pragmatic named subset). */
function decodeEntities(text) {
	return text.replace(/&(#[xX]?[0-9a-fA-F]+|[a-zA-Z][a-zA-Z0-9]*);/g, (whole, body) => {
		if (body.charCodeAt(0) === 35) {
			const code = body.charCodeAt(1) === 120 || body.charCodeAt(1) === 88 ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
			return Number.isInteger(code) && code > 0 && code <= 1114111 ? String.fromCodePoint(code) : whole;
		}
		return NAMED_ENTITIES[body.toLowerCase()] ?? whole;
	});
}
/** Remove tags, collapse whitespace, and decode entities into display text. */
function textOf(html) {
	return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}
/**
 * Resolve a result href to a clean target URL. Bing `/ck/a` redirects are
 * decoded; unusable values (relative links, javascript:) map to "".
 */
function unwrapResultUrl(rawUrl) {
	let url;
	try {
		url = new URL(rawUrl);
	} catch {
		return "";
	}
	if (url.protocol !== "http:" && url.protocol !== "https:") return "";
	if ((url.hostname === "www.bing.com" || url.hostname === "bing.com" || url.hostname === "cn.bing.com") && url.pathname === "/ck/a") {
		const encoded = url.searchParams.get("u");
		if (encoded == null || !encoded.startsWith("a1")) return "";
		try {
			const decoded = Buffer.from(encoded.slice(2), "base64url").toString("utf8");
			if (!/^https?:\/\//u.test(decoded)) return "";
			return decoded;
		} catch {
			return "";
		}
	}
	return url.href;
}
/**
 * Build the relevance vocabulary for a query: whitespace-separated terms of
 * ≥3 chars (or any CJK term ≥2), minus stopwords, plus the whole normalized
 * query as one token.
 */
function relevantTokens(query) {
	const trimmed = query.trim().toLowerCase();
	if (trimmed.length === 0) return [];
	const stopwords = new Set(["how", "what", "why", "when", "where", "which", "who", "does", "doesn", "to", "of", "the", "a", "an", "in", "on", "for", "and", "or", "with", "from", "by", "at", "is", "it", "as", "are", "was", "be", "not", "you", "i", "this", "that", "do", "don", "can", "whats"]);
	const hasCjk = /\p{Script=Han}/u.test(trimmed);
	const bigEnough = (t) => hasCjk ? t.length >= 2 : t.length >= 3;
	const cleanParts = trimmed.split(/\s+/).map((part) => part.replace(/[^\p{L}\p{N}]+/gu, "")).filter((t) => t.length > 0);
	const meaningfulParts = cleanParts.filter((t) => bigEnough(t) && !stopwords.has(t));
	const tokens = new Set(meaningfulParts);
	const whole = trimmed.replace(/[^\p{L}\p{N}]+/gu, "");
	if (cleanParts.length === 1) {
		if (bigEnough(whole) && !stopwords.has(whole)) tokens.add(whole);
	} else if (meaningfulParts.length > 0) {
		if (bigEnough(whole) && !stopwords.has(whole)) tokens.add(whole);
	}
	return [...tokens];
}
/**
 * Relevance gate for anti-poisoning: accept small honest result sets (<5) or
 * any set where at least one source carries a query token. Large token-free
 * sets are almost certainly poisoning.
 */
function isRelevant(sources, tokens) {
	if (sources.length === 0) return false;
	if (tokens.length === 0) return true;
	if (sources.length < 5) return true;
	return sources.some((source) => {
		const hay = `${source.url} ${source.title ?? ""} ${source.snippet ?? ""}`.toLowerCase();
		return tokens.some((token) => hay.includes(token));
	});
}
/** One `<h2><a href="...">title</a></h2>` heading plus its following caption. */
const BING_HEADING_PATTERN = /<h2\b[^>]*>\s*<a\b[^>]*?\bhref\s*=\s*(?:"([^"]*)"|'([^']*)')[^>]*>([\s\S]*?)<\/a\s*>/gi;
/** Pull the snippet paragraph out of the HTML that follows one heading. */
function captionAfter(tail) {
	const patterns = [
		/<div[^>]*class="[^"]*\bb_caption\b[^"]*"[^>]*>[\s\S]*?<p\b[^>]*>([\s\S]*?)<\/p>/i,
		/<p[^>]*class="[^"]*\bb_lineclamp\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i,
		/<div[^>]*class="[^"]*\bb_snippet\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i,
		/<(?:p|span)[^>]*class="[^"]*\bb_par[^"]*"[^>]*>([\s\S]*?)<\/(?:p|span)>/i
	];
	for (const pattern of patterns) {
		const match = tail.match(pattern);
		if (match !== null) return textOf(match[1]);
	}
	return "";
}
/**
 * Parse Bing's SERP HTML. Dedup by resolved URL; titles/snippets cleaned.
 * @param html - the full response body.
 * @returns the parsed sources.
 */
function parseBingResults(html) {
	const sources = [];
	const seen = new Set();
	for (const match of html.matchAll(BING_HEADING_PATTERN)) {
		const url = unwrapResultUrl(decodeEntities(match[1] ?? match[2] ?? ""));
		if (url.length === 0 || seen.has(url)) continue;
		const title = textOf(match[3]);
		if (title.length === 0) continue;
		const tail = html.slice(match.index + match[0].length, match.index + match[0].length + 4000);
		const snippet = captionAfter(tail);
		seen.add(url);
		sources.push({
			url,
			title,
			...(snippet.length > 0 ? { snippet } : {})
		});
	}
	return sources;
}
/** False when Bing served a bot-challenge / verification wall instead of a SERP. */
function isBingBlocked(html) {
	return /captcha|are you a robot|unusual traffic|challenge\/|verify you (?:are|'re) human|enable javascript and cookies to continue/i.test(html);
}
/** Parse Mojeek's `<li class="rN"><h2><a class="title" href>….` results. */
function parseMojeekResults(html) {
	const sources = [];
	const seen = new Set();
	const pattern = /<h2[^>]*>\s*<a\b(?=[^>]*class="[^"]*\btitle\b[^"]*")(?=[^>]*\bhref\s*=\s*"([^"]+)")[^>]*>([\s\S]*?)<\/a\s*>\s*<\/h2>/gi;
	for (const match of html.matchAll(pattern)) {
		const url = unwrapResultUrl(decodeEntities(match[1]));
		if (url.length === 0 || seen.has(url)) continue;
		const title = textOf(match[2]);
		if (title.length === 0) continue;
		const tail = html.slice(match.index + match[0].length, match.index + match[0].length + 2000);
		const sm = tail.match(/<p[^>]*class="[^"]*\bs\b[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
		seen.add(url);
		sources.push({
			url,
			title,
			...(sm !== null ? { snippet: textOf(sm[1]) } : {})
		});
	}
	return sources;
}
/** True when Baidu served its transient "网络不给力" placeholder page. */
function isBaiduPlaceholder(html) {
	return /网络不给力|timeout-img|timeout-title/.test(html);
}
/** Parse Baidu's `<h3><a href="…">title</a></h3>` results with a generic snippet grab. */
function parseBaiduResults(html) {
	const sources = [];
	const seen = new Set();
	const pattern = /<h3\b[^>]*>\s*<a\b[^>]*?\bhref\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a\s*>\s*<\/h3>/gi;
	for (const match of html.matchAll(pattern)) {
		const url = unwrapResultUrl(decodeEntities(match[1]));
		if (url.length === 0 || seen.has(url)) continue;
		const title = textOf(match[2]);
		if (title.length === 0) continue;
		const tail = html.slice(match.index + match[0].length, match.index + match[0].length + 5000);
		const sm = tail.match(/<span[^>]*class="[^"]*(?:content-right|c-color-text)[^"]*"[^>]*>([\s\S]*?)<\/span>/i)
			?? tail.match(/<div[^>]*class="[^"]*c-abstract[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
			?? tail.match(/<div[^>]*class="[^"]*c-span-last[^"]*"[^>]*>([\s\S]*?)<\/div>/i);
		seen.add(url);
		sources.push({
			url,
			title,
			...(sm !== null ? { snippet: textOf(sm[1]) } : {})
		});
	}
	return sources;
}
/** Parse So.com (360)'s `<li class="res-list"><h3 class="res-title"><a….` results. */
function parseSo360Results(html) {
	const sources = [];
	const seen = new Set();
	const pattern = /<h3[^>]*class="[^"]*res-title[^"]*"[^>]*>\s*<a\b[^>]*?\bhref\s*=\s*"([^"]+)"[^>]*>([\s\S]*?)<\/a\s*>\s*<\/h3>/gi;
	for (const match of html.matchAll(pattern)) {
		const url = unwrapResultUrl(decodeEntities(match[1]));
		if (url.length === 0 || seen.has(url)) continue;
		const title = textOf(match[2]);
		if (title.length === 0) continue;
		const tail = html.slice(match.index + match[0].length, match.index + match[0].length + 2500);
		const sm = tail.match(/<p[^>]*class="[^"]*res-desc[^"]*"[^>]*>([\s\S]*?)<\/p>/i);
		seen.add(url);
		sources.push({
			url,
			title,
			...(sm !== null ? { snippet: textOf(sm[1]) } : {})
		});
	}
	return sources;
}
/** True for a fetch/`AbortSignal` abort, surfaced as `WEB_ABORTED`. */
function isAbortError(error) {
	return error instanceof DOMException && error.name === "AbortError" || error instanceof Error && error.name === "TimeoutError";
}
/** Throw the provider's stable cancellation error when the caller already aborted. */
function throwIfSearchAborted(signal) {
	if (signal?.aborted === true) throw searchAborted(signal);
}
/** Build the provider's stable cancellation error while retaining the caller's reason. */
function searchAborted(signal, fallback) {
	return new WebError("Free web search aborted", "WEB_ABORTED", { cause: signal?.aborted === true ? signal.reason : fallback });
}
/** The free multi-backend search provider; registered as `free-web` in ctx.web. */
var FreeWebSearchProvider = class {
	id = FREE_PROVIDER_ID;
	/** Credential-free by design: always usable once the plugin is loaded. */
	available() {
		return true;
	}
	async search(request, signal) {
		const query = typeof request.query === "string" ? request.query.trim() : "";
		if (query.length === 0) throw new WebError("web_search received an empty query", "WEB_PROVIDER_ERROR");
		const want = Number.isInteger(request.maxResults) && request.maxResults > 0 ? Math.min(request.maxResults, MAX_COUNT) : 10;
		const tokens = relevantTokens(query);
		let firstNonEmpty = void 0;
		let lastTransportError = void 0;
		for (const backend of this.backends(query, want)) {
			throwIfSearchAborted(signal);
			let sources;
			try {
				sources = await backend.run(signal);
			} catch (error) {
				if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
				lastTransportError = error;
				continue;
			}
			if (sources.length === 0) continue;
			if (firstNonEmpty === void 0) firstNonEmpty = sources;
			if (isRelevant(sources, tokens) || BESTEFFORT === "1") {
				return {
					sources,
					truncated: false
				};
			}
		}
		if (BESTEFFORT === "1" && firstNonEmpty !== void 0) {
			return {
				sources: firstNonEmpty,
				truncated: false
			};
		}
		if (firstNonEmpty !== void 0) return { sources: [], truncated: false };
		if (lastTransportError !== void 0) throw new WebError(`All search backends failed (last error: ${String(lastTransportError)})`, "WEB_PROVIDER_ERROR", { cause: lastTransportError });
		return { sources: [], truncated: false };
	}
	/**
	 * Build the ordered backend attempts for one search. Each backend yields
	 * `{ run(signal) -> sources }`; transport/HTTP errors reject (skipped by the
	 * caller), while blocked/poisoned/empty pages resolve to `[]` so the chain
	 * continues to the next backend.
	 * @param query - the trimmed query.
	 * @param want - requested result count (clamped).
	 */
	backends(query, want) {
		const count = String(Math.max(want, 10));
		const bingParams = new URLSearchParams({ q: query, count });
		if (MARKET.length > 0) bingParams.set("mkt", MARKET);
		if (ENSEARCH === "1") bingParams.set("ensearch", "1");
		const bingUrl = `${SEARCH_ENDPOINT_BING}?${bingParams}`;
		const mojeekUrl = `${SEARCH_ENDPOINT_MOJEEK}?${new URLSearchParams({ q: query })}`;
		const baiduUrl = `${SEARCH_ENDPOINT_BAIDU}?${new URLSearchParams({ wd: query })}`;
		const so360Url = `${SEARCH_ENDPOINT_SO360}?${new URLSearchParams({ q: query })}`;
		const headers = {
			"user-agent": USER_AGENT,
			"accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
			"accept-language": "zh-CN,zh;q=0.9,en;q=0.8"
		};
		const run = (url, timeoutMs, parse, blocked = () => false) => async (signal) => {
			const timeout = AbortSignal.timeout(timeoutMs);
			const deadline = signal !== void 0 ? AbortSignal.any([signal, timeout]) : timeout;
			let response;
			try {
				response = await fetch(url, {
					method: "GET",
					redirect: "follow",
					headers,
					signal: deadline
				});
			} catch (error) {
				if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
				throw new WebError(`search request to ${new URL(url).hostname} failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
			}
			if (!response.ok) throw new WebError(`search backend ${new URL(url).hostname} returned HTTP ${response.status}`, "WEB_PROVIDER_ERROR");
			let body;
			try {
				body = await response.text();
			} catch (error) {
				if (signal?.aborted === true || isAbortError(error)) throw searchAborted(signal, error);
				throw new WebError(`search backend ${new URL(url).hostname} body read failed: ${String(error)}`, "WEB_PROVIDER_ERROR", { cause: error });
			}
			if (blocked(body)) return [];
			return parse(body);
		};
		return [
			{ id: "bing", run: run(bingUrl, TIMEOUTS.bing, parseBingResults, isBingBlocked) },
			{ id: "mojeek", run: run(mojeekUrl, TIMEOUTS.mojeek, parseMojeekResults) },
			{ id: "baidu", run: run(baiduUrl, TIMEOUTS.baidu, parseBaiduResults, isBaiduPlaceholder) },
			{ id: "so360", run: run(so360Url, TIMEOUTS.so360, parseSo360Results) }
		];
	}
};
//#endregion
//#region lib/types/index.js
/**
 * Register a keyless free search provider in `ctx.web`. Multi-backend
 * (Bing → Mojeek → Baidu → So.com) with anti-poisoning relevance gating —
 * the metered DeepSeek native `web_search_20250305` route's unpaid replacement.
 * @module dsh-web-search-free
 */
/** Cordis plugin name used by loader diagnostics. */
const name = "web-search-free";
/** The web seam this provider registers into. */
const inject = ["web"];
/** Register the free search provider with `ctx.web`. */
function apply(ctx) {
	ctx.web.registerSearchProvider(new FreeWebSearchProvider());
}
//#endregion
export { FREE_PROVIDER_ID, FreeWebSearchProvider, SEARCH_ENDPOINT_BAIDU, SEARCH_ENDPOINT_BING, SEARCH_ENDPOINT_MOJEEK, SEARCH_ENDPOINT_SO360, apply, captionAfter, decodeEntities, inject, isBaiduPlaceholder, isBingBlocked, isRelevant, name, parseBaiduResults, parseBingResults, parseMojeekResults, parseSo360Results, relevantTokens, textOf, unwrapResultUrl };