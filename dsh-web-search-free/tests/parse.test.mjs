import assert from "node:assert/strict";
import { test } from "node:test";
import {
	decodeEntities,
	isBaiduPlaceholder,
	isBingBlocked,
	isRelevant,
	parseBaiduResults,
	parseBingResults,
	parseMojeekResults,
	parseSo360Results,
	relevantTokens,
	textOf,
	unwrapResultUrl
} from "../lib/index.js";

/** Build a Bing `/ck/a` redirect href wrapping `target`. */
function ckHref(target) {
	const u = Buffer.from(target, "utf8").toString("base64url");
	return `https://www.bing.com/ck/a?!&p=1&u=a1${u}&ntb=1`;
}

function item(href, title, snippet) {
	return `<li class="b_algo"><h2 class=""><a target="_blank" target="_blank" href="${href}" h="ID=SERP,5100.2">${title}</a></h2><div class="b_caption"><p class="b_lineclamp2">${snippet}</p></div></li>`;
}

const FIXTURE = [
	"<html><body><ol id=\"b_results\">",
	item("https://nodejs.org/", "<strong>Node</strong>.js &#8212; Run JavaScript Everywhere", "Node.js&#174; is a free, open-source JavaScript runtime&nbsp;environment."),
	item(ckHref("https://example.com/deep/page?a=1&b=2"), "Example 页面 &quot;quoted&quot;", "A redirect-wrapped result with an <em>emphasis</em> tag inside."),
	item("https://attrs.example/path?x=1&amp;y=2#frag", "Attribute-escaped URL", "The href attribute itself carries &amp; escapes."),
	item("https://nodejs.org/", "Duplicate URL that must be dropped", "Second entry with the same resolved URL."),
	"</ol></body></html>"
].join("");

test("decodeEntities handles numeric and named entities", () => {
	assert.equal(decodeEntities("Node.js&#174; a&#x27;b &amp; c&nbsp;d &ensp;e"), "Node.js® a'b & c d  e");
});

test("textOf strips tags and collapses whitespace", () => {
	assert.equal(textOf("<strong>A</strong> B <em>C</em> &amp; D"), "A B C & D");
	// inline markup inside a word must not gain stray spaces
	assert.equal(textOf("<strong>Node</strong>.js"), "Node.js");
});

test("unwrapResultUrl passes plain https URLs through", () => {
	assert.equal(unwrapResultUrl("https://nodejs.org/en"), "https://nodejs.org/en");
});

test("unwrapResultUrl decodes bing /ck/a base64url redirects", () => {
	assert.equal(unwrapResultUrl(ckHref("https://example.com/deep/page?a=1&b=2")), "https://example.com/deep/page?a=1&b=2");
});

test("unwrapResultUrl rejects junk safely", () => {
	assert.equal(unwrapResultUrl(""), "");
	assert.equal(unwrapResultUrl("javascript:alert(1)"), "");
	assert.equal(unwrapResultUrl("not a url"), "");
	assert.equal(unwrapResultUrl("https://www.bing.com/ck/a?u=ZZZbad"), "");
});

test("parseBingResults extracts title/snippet, dedupes by URL", () => {
	const sources = parseBingResults(FIXTURE);
	assert.equal(sources.length, 3);
	assert.deepEqual(Object.keys(sources[0]), ["url", "title", "snippet"]);
	assert.equal(sources[0].url, "https://nodejs.org/");
	assert.equal(sources[0].title, "Node.js — Run JavaScript Everywhere");
	assert.match(sources[0].snippet, /free, open-source JavaScript runtime environment\.$/);
	assert.equal(sources[1].url, "https://example.com/deep/page?a=1&b=2");
	assert.equal(sources[1].title, "Example 页面 \"quoted\"");
	assert.match(sources[1].snippet, /emphasis tag inside\.$/);
	assert.equal(sources[2].url, "https://attrs.example/path?x=1&y=2#frag");
	assert.equal(sources[2].title, "Attribute-escaped URL");
});

test("parseBingResults tolerates markup variations (single quotes, no caption)", () => {
	const html = `<li class="b_algo"><h2><a href='https://single.example/'>Single quoted</a></h2></li>`
		+ `<li class="b_algo"><h2><a href="https://plain.example/">No caption here</a></h2><div>other stuff</div></li>`;
	const sources = parseBingResults(html);
	assert.equal(sources.length, 2);
	assert.equal(sources[0].url, "https://single.example/");
	assert.equal(sources[0].title, "Single quoted");
	assert.ok(!("snippet" in sources[0]));
	assert.equal(sources[1].title, "No caption here");
});

test("isBingBlocked flags challenge pages, not normal SERPs", () => {
	assert.ok(isBingBlocked("<div>Please complete the captcha to continue</div>"));
	assert.ok(!isBingBlocked(FIXTURE));
});

test("parseMojeekResults extracts title and snippet from result-column markup", () => {
	const html = `<ul class="results-standard"><li class="r1"><a class="ob" href="https://www.ngramextractor.com/"><p class="i"><span class="url">https://www.ngramextractor.com/</span></p></a><h2><a class="title" href="https://www.ngramextractor.com/">Ngram Extractor Online Free Tool</a></h2><p class="s">The same <strong>definition</strong> applies to <strong>n</strong>-<strong>gram</strong> phonemes.</p></li></ul>`;
	const sources = parseMojeekResults(html);
	assert.equal(sources.length, 1);
	assert.equal(sources[0].url, "https://www.ngramextractor.com/");
	assert.equal(sources[0].title, "Ngram Extractor Online Free Tool");
	assert.match(sources[0].snippet, /definition/);
});

test("parseBaiduResults extracts h3 results and detects the placeholder page", () => {
	const html = `<h3 class="c-title"><a href="https://baike.baidu.com/item/%E5%85%8B%E9%87%8C%E5%A7%86%E6%9E%97%E5%AE%AB">克里姆林宫 - 百度百科</a></h3><span class="content-right_8Zs40">克里姆林宫（俄语：Московский Кремль）</span>`;
	const sources = parseBaiduResults(html);
	assert.equal(sources.length, 1);
	assert.equal(sources[0].title, "克里姆林宫 - 百度百科");
	assert.match(sources[0].snippet, /Кремль/);
	assert.ok(isBaiduPlaceholder("<body><div class=\"timeout-img\"></div><div class=\"timeout-title\">网络不给力</div>"));
	assert.ok(!isBaiduPlaceholder(html));
});

test("parseSo360Results extracts res-list results with res-desc snippets", () => {
	const html = `<ul class="result"><li class="res-list"><h3 class="res-title "><a href="https://www.so.com/link?m=abc123" rel="noopener" target="_blank"><em>克里姆林宫</em>的<em>历史</em>?</a></h3><p class="res-desc"><em>克里姆林宫</em>的历史可以追溯到12世纪。</p></li></ul>`;
	const sources = parseSo360Results(html);
	assert.equal(sources.length, 1);
	assert.equal(sources[0].url, "https://www.so.com/link?m=abc123");
	assert.equal(sources[0].title, "克里姆林宫的历史?");
	assert.match(sources[0].snippet, /追溯到12世纪/);
});

test("relevantTokens keeps meaningful terms and drops stopwords", () => {
	const tokens = relevantTokens("ngram n-gram definition computational linguistics");
	for (const t of ["ngram", "definition", "computational", "linguistics"]) assert.ok(tokens.includes(t), `missing ${t}`);
	assert.ok(!tokens.includes("n"));
	assert.ok(!tokens.includes("to"));
	// CJK whole-string token survives
	assert.ok(relevantTokens("克里姆林宫 历史").includes("克里姆林宫"));
	// stopword-only query yields no tokens (gate defaults to accept)
	assert.equal(relevantTokens("how to").length, 0);
});

test("isRelevant accepts small sets, rejects large token-free poison sets", () => {
	const junk = Array.from({ length: 10 }, (_, i) => ({ url: `https://junk${i}.example/`, title: `Trending page ${i}`, snippet: "unrelated content" }));
	assert.ok(!isRelevant(junk, ["ngram", "definition"]));
	assert.ok(isRelevant([{ url: "https://a.example/", title: "ngram definition explained", snippet: "" }], ["ngram", "definition"]));
	// small honest sets are kept even without exact tokens
	assert.ok(isRelevant([{ url: "https://a.example/", title: "Some related paraphrase", snippet: "" }], ["ngram"]));
	// no tokens → accept anything non-empty
	assert.ok(isRelevant(junk, []));
	assert.ok(!isRelevant([], ["ngram"]));
});