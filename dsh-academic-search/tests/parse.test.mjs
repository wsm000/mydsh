import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  parseArXivResults,
  parseS2Results,
  parsePubMedSearchResults,
  parsePubMedSummaryResults,
  parseCoreResults,
  deduplicateSources,
  rankSources,
} from "../lib/index.js";

test("parseArXivResults - extracts entries from Atom XML", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <id>http://arxiv.org/abs/1706.03762v7</id>
    <title>Attention Is All You Need</title>
    <summary>The dominant sequence transduction models are based on complex recurrent or
convolutional neural networks in an encoder-decoder configuration.</summary>
    <author><name>Ashish Vaswani</name></author>
    <author><name>Noam Shazeer</name></author>
    <published>2017-06-12T17:57:34Z</published>
  </entry>
</feed>`;

  const results = parseArXivResults(xml);
  
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "http://arxiv.org/abs/1706.03762v7");
  assert.equal(results[0].title, "Attention Is All You Need");
  assert.ok(results[0].snippet.includes("sequence transduction"));
  assert.deepEqual(results[0].authors, ["Ashish Vaswani", "Noam Shazeer"]);
  assert.equal(results[0].year, 2017);
  assert.equal(results[0].source, "arXiv");
});

test("parseS2Results - extracts papers from JSON", () => {
  const json = {
    data: [
      {
        paperId: "204e3073870fae3d05bcbc2f6a8e263d9b72e776",
        title: "Attention Is All You Need",
        abstract: "The dominant sequence transduction models...",
        authors: [{ name: "Ashish Vaswani" }, { name: "Noam Shazeer" }],
        year: 2017,
        citationCount: 85234,
        externalIds: { DOI: "10.48550/arXiv.1706.03762", ArXiv: "1706.03762" },
        url: "https://www.semanticscholar.org/paper/204e3073870fae3d05bcbc2f6a8e263d9b72e776"
      }
    ]
  };

  const results = parseS2Results(json);
  
  assert.equal(results.length, 1);
  assert.ok(results[0].url.includes("doi.org"));
  assert.equal(results[0].title, "Attention Is All You Need");
  assert.equal(results[0].year, 2017);
  assert.equal(results[0].citations, 85234);
  assert.equal(results[0].doi, "10.48550/arXiv.1706.03762");
  assert.equal(results[0].source, "Semantic Scholar");
});

test("parsePubMedSearchResults - extracts PMIDs", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<eSearchResult>
  <IdList>
    <Id>34567890</Id>
    <Id>34567891</Id>
  </IdList>
</eSearchResult>`;

  const pmids = parsePubMedSearchResults(xml);
  
  assert.deepEqual(pmids, ["34567890", "34567891"]);
});

test("parsePubMedSummaryResults - extracts paper details", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<DocumentSummarySet>
  <DocumentSummary uid="34567890">
    <Title>CRISPR-Cas9 gene editing in human cells</Title>
    <Source>Nature</Source>
    <PubDate>2021 May 15</PubDate>
    <AuthorList>
      <Author><Name>John Doe</Name></Author>
      <Author><Name>Jane Smith</Name></Author>
    </AuthorList>
  </DocumentSummary>
</DocumentSummarySet>`;

  const results = parsePubMedSummaryResults(xml);
  
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://pubmed.ncbi.nlm.nih.gov/34567890/");
  assert.equal(results[0].title, "CRISPR-Cas9 gene editing in human cells");
  assert.equal(results[0].snippet, "Published in: Nature");
  assert.deepEqual(results[0].authors, ["John Doe", "Jane Smith"]);
  assert.equal(results[0].year, 2021);
  assert.equal(results[0].source, "PubMed");
});

test("parseCoreResults - extracts papers from JSON", () => {
  const json = {
    results: [
      {
        id: 123456,
        title: "Deep Learning Review",
        abstract: "A comprehensive review of deep learning methods...",
        authors: ["Alice Brown", "Bob Wilson"],
        yearPublished: 2020,
        doi: "10.1234/example.2020.001",
        downloadUrl: "https://core.ac.uk/download/123456.pdf"
      }
    ]
  };

  const results = parseCoreResults(json);
  
  assert.equal(results.length, 1);
  assert.equal(results[0].url, "https://core.ac.uk/download/123456.pdf");
  assert.equal(results[0].title, "Deep Learning Review");
  assert.ok(results[0].snippet.includes("comprehensive review"));
  assert.deepEqual(results[0].authors, ["Alice Brown", "Bob Wilson"]);
  assert.equal(results[0].year, 2020);
  assert.equal(results[0].doi, "10.1234/example.2020.001");
  assert.equal(results[0].source, "CORE");
});

test("deduplicateSources - removes duplicates by DOI", () => {
  const sources = [
    {
      url: "https://arxiv.org/abs/1706.03762",
      title: "Attention Is All You Need",
      doi: "10.48550/arXiv.1706.03762",
      source: "arXiv"
    },
    {
      url: "https://doi.org/10.48550/arXiv.1706.03762",
      title: "Attention Is All You Need",
      doi: "10.48550/arXiv.1706.03762",
      citations: 85234,
      source: "Semantic Scholar"
    }
  ];

  const deduplicated = deduplicateSources(sources);
  
  assert.equal(deduplicated.length, 1);
  // Should keep the one with citations (better metadata)
  assert.equal(deduplicated[0].citations, 85234);
  assert.equal(deduplicated[0].source, "Semantic Scholar");
});

test("deduplicateSources - removes duplicates by arXiv ID", () => {
  const sources = [
    {
      url: "https://arxiv.org/abs/1706.03762",
      title: "Attention Is All You Need",
      arxivId: "1706.03762",
      source: "arXiv"
    },
    {
      url: "https://arxiv.org/pdf/1706.03762.pdf",
      title: "Attention Is All You Need",
      arxivId: "1706.03762",
      snippet: "Abstract text here",
      source: "CORE"
    }
  ];

  const deduplicated = deduplicateSources(sources);
  
  assert.equal(deduplicated.length, 1);
  // Should keep the one with snippet
  assert.ok(deduplicated[0].snippet);
});

test("rankSources - ranks by relevance and citations", () => {
  const sources = [
    {
      url: "https://example.com/1",
      title: "Deep Learning Methods",
      citations: 100,
      source: "Test"
    },
    {
      url: "https://example.com/2",
      title: "Machine Learning Introduction",
      citations: 500,
      source: "Test"
    },
    {
      url: "https://example.com/3",
      title: "Deep Learning Tutorial",
      citations: 50,
      source: "Test"
    }
  ];

  const ranked = rankSources(sources, "deep learning");
  
  // "Deep Learning Tutorial" and "Deep Learning Methods" should rank higher
  // than "Machine Learning Introduction" due to better title match
  assert.ok(ranked[0].title.includes("Deep Learning"));
  assert.ok(ranked[1].title.includes("Deep Learning"));
});

test("rankSources - exact query match ranks highest", () => {
  const sources = [
    {
      url: "https://example.com/1",
      title: "Attention Is All You Need",
      citations: 85000,
      source: "Test"
    },
    {
      url: "https://example.com/2",
      title: "Attention Mechanisms in Neural Networks",
      citations: 5000,
      source: "Test"
    }
  ];

  const ranked = rankSources(sources, "attention is all you need");
  
  // Exact match should rank first despite lower citation difference
  assert.equal(ranked[0].title, "Attention Is All You Need");
});

test("parseArXivResults - handles empty response", () => {
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
</feed>`;

  const results = parseArXivResults(xml);
  assert.equal(results.length, 0);
});

test("parseS2Results - handles empty data", () => {
  const json = { data: [] };
  const results = parseS2Results(json);
  assert.equal(results.length, 0);
});

test("parseS2Results - handles missing fields gracefully", () => {
  const json = {
    data: [
      {
        paperId: "abc123",
        title: "Test Paper",
        // Missing abstract, authors, year, citations
      }
    ]
  };

  const results = parseS2Results(json);
  assert.equal(results.length, 1);
  assert.equal(results[0].title, "Test Paper");
  assert.ok(!results[0].snippet);
  assert.ok(!results[0].authors || results[0].authors.length === 0);
});
