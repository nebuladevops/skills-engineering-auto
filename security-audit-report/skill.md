---
name: security-audit-report
description: >-
  Produce a formal, evidence-based code security audit and mandatory remediation
  plan as a polished, branded Word (.docx) document. Use when asked for a
  "security audit", "emergency security audit", "remediation plan", "audit report",
  "formal audit document", "compliance gap report", or to turn raw security
  findings into a leadership-ready deliverable. Reviews a codebase (or ingests
  existing findings) line by line, classifies findings P0–P3 with file:line
  evidence, maps each to a required fix, documents documentation-vs-reality drift
  and third-party data-processor exposure, and emits a tiered remediation roadmap.
license: Internal use.
allowed-tools: Read, Grep, Glob, Bash
---

# Security Audit Report — formal audit + remediation plan (.docx)

You are acting as a **senior application-security auditor**. Your job is to produce a
**leadership-ready, evidence-based security audit and mandatory remediation plan**,
delivered as a **polished, branded Word document**. The deliverable looks like a
professional consulting audit: executive verdict, severity-counted findings tables with
`file:line` evidence, a documentation-vs-reality section, the third-party data-processor
exposure scope, a tiered remediation roadmap, leadership confirmations, and an honest
"what the build already does right" section.

This single file is self-contained: it carries the method, the severity rubric, the
document structure, the findings data shape, and the **embedded document generator**.

---

## When to use

- The user asks for a **security audit**, **emergency security audit**, **remediation plan**,
  **audit report**, **formal audit document**, **compliance gap report**, or **threat report**
  as a real document (Word/.docx).
- The user has **raw findings** (their own notes, a scanner dump, another model's review) and
  wants them turned into a **formal, defensible deliverable**.
- A codebase needs a **start-to-end security/compliance review** written up for leadership,
  a board, an auditor, or an engineering team.

## When NOT to use

- For a quick inline list of bugs with no document deliverable — just answer directly.
- For **fixing** code — this produces the audit and the plan; implementation is separate work
  (a remediation roadmap is the output, not applied patches).
- For a formal **compliance certification** — state explicitly in the document that this is a
  **code-level technical audit, not a certification** (certification additionally needs policy,
  contractual, operational, and documentary evidence).

---

## Prerequisites

The generator uses Node.js and the `docx` npm library.

```bash
node --version            # need Node 16+
# Install docx locally in a scratch dir if it is not already available:
mkdir -p /tmp/audit-gen && cd /tmp/audit-gen && npm init -y >/dev/null 2>&1 && npm i docx >/dev/null 2>&1
```

Run the generator from a directory where `docx` resolves (e.g. `/tmp/audit-gen`, or any project
that already depends on it). The embedded script checks for `docx` and prints install guidance
if it is missing — never silently fail.

---

## The workflow (senior audit method)

Follow these phases in order. Do not skip the evidence discipline — it is what makes the
document defensible.

### Phase 1 — Scope and rules of engagement
- Confirm **what is in scope** (which repo/service/surface) and **what is excluded**. Record it
  verbatim in the document's *Scope* line.
- Confirm the **jurisdiction / regime target** (e.g. HIPAA, GDPR, SOC 2, ISO 27001, PCI-DSS,
  Ley 1581/Colombia, or simply "general application security"). This sets which controls are
  mandatory and appears in the *Scope* and *Required confirmations* sections.
- Confirm the **method stance**: this is an **evidence-based, code-level** audit. Nothing is
  assumed from documentation — claims are verified against the implementation.

### Phase 2 — Evidence-based review (the core discipline)
Read the code. For every issue, capture **`file:line` evidence**. Sweep at minimum:
- **Secrets & credentials** — secrets baked into images/configs, plaintext keys/tokens in the
  DB or env, weak/dev fallback keys, secrets in logs.
- **AuthN / AuthZ** — unauthenticated endpoints, missing ownership checks, broken access control
  (IDOR), MFA not enforced, missing role/attribute access control, CSRF, CORS wildcard-with-credentials.
- **Data protection** — sensitive data sent to third parties without an agreement or
  de-identification; encryption-at-rest gaps; cosmetic/deterministic encryption; cascade hard-deletes.
- **Audit & observability** — no durable/immutable audit trail, unaudited reads, falsified status
  codes, PII/PHI in logs or third-party traces.
- **AI/LLM pipeline (if present)** — model authoring records with fabricated identifiers, no
  output guardrails, no forced disclaimers, prompt content leaking to non-agreement vendors,
  retrieval quality gaps.
- **Infrastructure / DevSecOps** — public databases, prod-pointing-at-dev, no WAF, no security
  headers, no blocking SAST/SCA/secret/container scanning, disabled SBOM, plaintext transport,
  Terraform/state secrets.
- **Documentation vs reality** — every capability/compliance claim in README/docs checked against
  the code; record each lie/drift (it is itself a liability if it overclaims compliance).

### Phase 3 — Classify severity (rubric below)
Assign each finding **P0 / P1 / P2 / P3**. Group related defects under one ID when one fix closes
them (e.g. `SEC-1 / R-2`). Keep a running count per severity for the *Finding counts* table.

### Phase 4 — Map each finding to a required fix → control
Every finding gets a **concrete required fix** phrased as the control it implements
(e.g. "Inject secrets at runtime from the vault; rotate every baked credential. → secrets in vault").
Prefer reusing controls/helpers that **already exist but are unused** — that is the fastest, lowest-risk fix.

### Phase 5 — Third-party data-processor scope
List **every external service that touches sensitive data** and state that each needs a signed
agreement (BAA/DPA) before handling that data. This is the legal-exposure scope section.

### Phase 6 — Prioritized remediation roadmap (tiered)
Sequence the fixes:
- **Tier 0 — stop the bleeding** (do first; live exposure): the handful of P0s that are actively leaking.
- **Tier 1 — close immediately behind Tier 0**: the rest of the P0s.
- **Before production / broad rollout (P1)**.
- **This quarter (P2)** and **hygiene (P3)** as summaries.

### Phase 7 — Generate the document
Assemble the findings into the JSON spec (shape below), write the embedded generator to a temp
file, run it, and deliver the `.docx`. Then give the user a short plain-English summary
(verdict, counts, the Tier-0 list, where the file is).

---

## Severity rubric

| Severity | Meaning | Bar |
|---|---|---|
| **P0 — Critical** | Direct exposure of sensitive data / credentials, or an access-control failure. | Remediate **immediately**; blocks any real/production data. |
| **P1 — High** | Serious compliance or security gap. | Remediate **before** broad rollout / real data. |
| **P2 — Medium** | Material risk. | Plan within the quarter. |
| **P3 — Low** | Technical debt / hygiene. | Backlog. |

Honesty rules (non-negotiable):
- **Evidence or it does not go in.** Every finding carries `file:line`. If you cannot point to the
  code, mark it explicitly as an *unverified hypothesis*, not a finding.
- **No absolute guarantees in the prose** — write "designed to reduce / closes / mitigates", never
  "eliminates / guarantees / makes impossible". Overclaiming is itself a liability.
- **Credit what is right.** A senior audit names the real strengths to keep, not only the failures.
- **Documentation that overclaims compliance is a finding**, not a footnote.

---

## Document structure (the sections the generator emits)

1. **Title block** — org name, title, subtitle, a red rule, then Status / Scope / Method / Date /
   Classification, and an *Important* note (code-level audit, not a certification).
2. **Executive verdict** — one paragraph: the honest bottom line. Optional *Why this is urgent now*
   sub-section with numbered facts.
3. **Finding counts** — a Severity × Count/meaning table.
4. **Critical findings (P0)** — table: ID · Finding · Evidence (file:line) · Required fix → control.
5. **High findings (P1)** — same table shape.
6. **Medium & low (P2/P3)** — prose summaries.
7. **Documentation vs reality** — Claim × Reality table (omit if not applicable).
8. **Third parties that process sensitive data** — the agreement-scope paragraph.
9. **Prioritized remediation roadmap** — Tier 0 / Tier 1 / pre-production (P1) / quarter (P2).
10. **Required confirmations** — the questions leadership/compliance must answer.
11. **What the build already does right** — the strengths to keep.

---

## Findings data shape (the JSON the generator consumes)

Write a JSON file (e.g. `/tmp/audit-gen/spec.json`) in this shape. Only `branding`, `meta`,
`executiveVerdict`, `counts`, `p0`, and `roadmap` are required; the rest are optional and are
omitted from the document when absent.

```json
{
  "branding": {
    "org": "ACME HEALTH",
    "accent": "1F3864",
    "subAccent": "2E4C7E",
    "confidentialLabel": "CONFIDENTIAL",
    "runningHeadRight": "Security Audit",
    "footerNote": "Prepared for the engineering team — internal use only"
  },
  "meta": {
    "title": "Technical Security Audit",
    "subtitle": "& Mandatory Remediation Plan — <system name>",
    "status": "URGENT — active live exposure (real data in production, no signed agreements).",
    "statusUrgent": true,
    "scope": "Start-to-end review of the deployed source code — auth, data, crypto, infra/DevSecOps, compliance posture.",
    "method": "Evidence-based. Every finding is verified against the implementation and referenced by file:line.",
    "date": "Prepared for the engineering review of <month year>.",
    "classification": "Confidential — internal use only.",
    "importantNote": "This is a code-level technical audit, not a formal compliance certification. Certification additionally requires policy, contractual, operational, and documentary evidence."
  },
  "executiveVerdict": "The platform has <strengths>, but those are undermined by <the core failures>. In its current state it is not defensible before an auditor.",
  "urgency": {
    "heading": "Why this is urgent now",
    "intro": "Two facts make this an active exposure, not future work:",
    "points": ["Real data is live in production.", "No data-processing agreements are signed."],
    "outro": "Every day of operation in this state accrues legal and reputational exposure."
  },
  "counts": [
    { "sev": "P0 — Critical (9)", "meaning": "Direct exposure of data/credentials or access-control failure. Remediate immediately." },
    { "sev": "P1 — High (18)", "meaning": "Serious compliance or security gap. Remediate before any real data." },
    { "sev": "P2 — Medium (14)", "meaning": "Material risk; plan within the quarter." },
    { "sev": "P3 — Low (8)", "meaning": "Technical debt / hygiene." }
  ],
  "p0": [
    { "id": "AUD-1", "finding": "Unauthenticated endpoint returns any record by name; no ownership check.", "ev": "uploads/[file]/route.ts:5-24", "fix": "Require auth + ownership; route through the data-access layer. → single gated path, no side doors." }
  ],
  "p1": [
    { "id": "SEC-4", "finding": "MFA exists but is not enforced (warn, then success).", "ev": "auth/route.ts:99-115", "fix": "Enforce MFA at login." }
  ],
  "lowerSummary": {
    "p2": "no reranking; in-memory rate limiter; legacy CBC still supported; plaintext gRPC; storage shared-key auth.",
    "p3": "serialized embeddings; decrypted caches not cleared on logout; doc drift; dedup by content hash."
  },
  "docVsReality": [
    ["docling-serve for parsing", "Does not exist; PDFs are sent to a third party"],
    ["“Run completely offline / no cloud”", "Requires cloud KMS + blob + cloud models; no offline mode"]
  ],
  "thirdParties": "OpenAI · Anthropic · Deepgram (raw audio) · Pinecone · a tracing vendor · the primary DB host · the EHR. Each requires a signed agreement before handling sensitive data — none is signed today.",
  "roadmap": [
    { "tier": "Tier 0 — stop the bleeding (do first; live exposure)", "items": ["Close the unauthenticated endpoint. (AUD-1)", "Stop raw-data egress; route in-tenant or de-identify. (R-1)"] },
    { "tier": "Tier 1 — close immediately behind Tier 0", "items": ["Stand up a durable, immutable audit trail. (AUD-2)", "Get secrets out of the image; rotate everything exposed. (INF-1)"] },
    { "tier": "Before production (P1)", "items": ["Enforce MFA; build role-based access. (SEC-4, AUD-5)"] },
    { "tier": "Quarter (P2)", "paragraph": "Semantic chunking + reranking; prompt versioning; secret-manager migration; encrypted infra state; TLS on internal transport." }
  ],
  "confirmations": [
    "Are data-processing / business-associate agreements signed with each vendor that touches sensitive data?",
    "Jurisdiction: which regime(s) apply? (Changes the mandatory controls.)",
    "Is the system on real or test data only?"
  ],
  "strengths": "Credit where due: strong crypto primitives (Argon2id, authenticated AES-256-GCM), an owner-scoped data-access layer, and the fact that some routes already run in the secure tenant — proving the secure pattern is achievable and the leaks are fixable oversights, not constraints."
}
```

---

## Generate the document

1. Ensure `docx` is available (see Prerequisites).
2. Write the spec JSON (above) to `/tmp/audit-gen/spec.json`.
3. Write the generator below to `/tmp/audit-gen/generate-audit-docx.js`.
4. Run it:

```bash
cd /tmp/audit-gen && node generate-audit-docx.js spec.json "<OUTPUT_PATH>.docx"
```

### Embedded generator — `generate-audit-docx.js`

Write this verbatim. It is parameterized: it reads the spec JSON and emits the branded `.docx`,
including only the sections present in the spec.

```js
// generate-audit-docx.js — formal security-audit .docx generator (spec-driven)
// Usage: node generate-audit-docx.js <spec.json> <output.docx>
let docx;
try { docx = require("docx"); }
catch (e) {
  console.error("Missing dependency 'docx'. Install it first:\n  mkdir -p /tmp/audit-gen && cd /tmp/audit-gen && npm init -y && npm i docx\nThen run this script from that directory.");
  process.exit(1);
}
const fs = require("fs");
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  Header, Footer, AlignmentType, LevelFormat, TabStopType, TabStopPosition,
  TableOfContents, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, PageNumber, PageBreak
} = docx;

const specPath = process.argv[2] || "spec.json";
const outPath  = process.argv[3] || "security-audit.docx";
const spec = JSON.parse(fs.readFileSync(specPath, "utf8"));

const B = spec.branding || {};
const ACCENT = B.accent || "1F3864";
const SUBACCENT = B.subAccent || "2E4C7E";
const ORG = B.org || "ORGANIZATION";
const CONF = B.confidentialLabel || "CONFIDENTIAL";
const RUNHEAD = B.runningHeadRight || "Security Audit";
const FOOT = B.footerNote || "Internal use only";

const CW = 9360; // content width, US Letter, 1" margins
const border = { style: BorderStyle.SINGLE, size: 1, color: "BBBBBB" };
const borders = { top: border, bottom: border, left: border, right: border };
const cellMargins = { top: 60, bottom: 60, left: 100, right: 100 };
const HEAD_FILL = ACCENT;
const P0_FILL = "F8CBAD";
const P1_FILL = "FCE4D6";

const tx = (text, opts = {}) => new TextRun({ text, ...opts });

function headerCell(text, w) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: cellMargins,
    shading: { fill: HEAD_FILL, type: ShadingType.CLEAR }, verticalAlign: VerticalAlign.CENTER,
    children: [new Paragraph({ children: [tx(text, { bold: true, color: "FFFFFF", size: 18 })] })],
  });
}
function cell(text, w, fill, opts) {
  return new TableCell({
    borders, width: { size: w, type: WidthType.DXA }, margins: cellMargins,
    ...(fill ? { shading: { fill, type: ShadingType.CLEAR } } : {}),
    children: [new Paragraph({ children: [tx(text, { size: 18, ...(opts || {}) })] })],
  });
}
function findingsTable(rows, fill) {
  const widths = [820, 3340, 1700, 3500];
  const head = new TableRow({ tableHeader: true, children: [
    headerCell("ID", widths[0]), headerCell("Finding", widths[1]),
    headerCell("Evidence (file:line)", widths[2]), headerCell("Required fix → control", widths[3]),
  ]});
  const body = rows.map(r => new TableRow({ children: [
    cell(r.id, widths[0], fill, { bold: true }),
    cell(r.finding, widths[1], fill),
    cell(r.ev, widths[2], fill, { size: 16, italics: true, color: "555555" }),
    cell(r.fix, widths[3], fill),
  ]}));
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: widths, rows: [head, ...body] });
}
function twoColTable(headA, headB, wA, rows) {
  const widths = [wA, CW - wA];
  const head = new TableRow({ tableHeader: true, children: [headerCell(headA, widths[0]), headerCell(headB, widths[1])] });
  const body = rows.map(r => new TableRow({ children: [ cell(r[0], widths[0]), cell(r[1], widths[1]) ] }));
  return new Table({ width: { size: CW, type: WidthType.DXA }, columnWidths: widths, rows: [head, ...body] });
}
const H1 = t => new Paragraph({ heading: HeadingLevel.HEADING_1, children: [tx(t)] });
const H2 = t => new Paragraph({ heading: HeadingLevel.HEADING_2, children: [tx(t)] });
const para = (t, o = {}) => new Paragraph({ spacing: { after: 100 }, children: [tx(t, o)] });
const numItem = t => new Paragraph({ numbering: { reference: "nums", level: 0 }, children: [tx(t)] });

const M = spec.meta || {};
const children = [];

// ---- Title block ----
children.push(new Paragraph({ spacing: { before: 1200, after: 0 }, children: [tx(ORG, { bold: true, size: 56, color: ACCENT })] }));
children.push(new Paragraph({ spacing: { before: 80, after: 0 }, children: [tx(M.title || "Technical Security Audit", { bold: true, size: 40, color: SUBACCENT })] }));
if (M.subtitle) children.push(new Paragraph({ spacing: { before: 40, after: 240 }, children: [tx(M.subtitle, { size: 28, color: SUBACCENT })] }));
children.push(new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 8, color: "C00000", space: 4 } }, spacing: { after: 240 }, children: [] }));
if (M.status) children.push(new Paragraph({ spacing: { after: 60 }, children: [tx("Status: ", { bold: true }), tx(M.status, M.statusUrgent ? { color: "C00000", bold: true } : {})] }));
if (M.scope) children.push(new Paragraph({ spacing: { after: 60 }, children: [tx("Scope: ", { bold: true }), tx(M.scope)] }));
if (M.method) children.push(new Paragraph({ spacing: { after: 60 }, children: [tx("Method: ", { bold: true }), tx(M.method)] }));
if (M.date) children.push(new Paragraph({ spacing: { after: 60 }, children: [tx("Date: ", { bold: true }), tx(M.date)] }));
if (M.classification) children.push(new Paragraph({ spacing: { after: 60 }, children: [tx("Classification: ", { bold: true }), tx(M.classification)] }));
if (M.importantNote) children.push(new Paragraph({ spacing: { before: 200, after: 60 }, children: [tx("Important: ", { bold: true, color: "C00000" }), tx(M.importantNote, { italics: true })] }));
children.push(new Paragraph({ children: [new PageBreak()] }));

// ---- TOC ----
children.push(H1("Table of Contents"));
children.push(new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-2" }));
children.push(new Paragraph({ children: [new PageBreak()] }));

let n = 1;
// ---- Executive verdict ----
children.push(H1(`${n++}. Executive verdict`));
children.push(para(spec.executiveVerdict || ""));
if (spec.urgency) {
  children.push(H2(spec.urgency.heading || "Why this is urgent now"));
  if (spec.urgency.intro) children.push(para(spec.urgency.intro));
  (spec.urgency.points || []).forEach(pt => children.push(new Paragraph({ numbering: { reference: "nums", level: 0 }, children: [tx(pt, { bold: true })] })));
  if (spec.urgency.outro) children.push(new Paragraph({ spacing: { before: 80, after: 120 }, children: [tx(spec.urgency.outro)] }));
}
// ---- Finding counts ----
if (spec.counts && spec.counts.length) {
  children.push(H1(`${n++}. Finding counts`));
  children.push(twoColTable("Severity", "Count — meaning", 2600, spec.counts.map(c => [c.sev, c.meaning])));
}
// ---- P0 ----
if (spec.p0 && spec.p0.length) {
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240 }, children: [tx(`${n++}. Critical findings (P0) — close before any real data`)] }));
  children.push(findingsTable(spec.p0, P0_FILL));
}
// ---- P1 ----
if (spec.p1 && spec.p1.length) {
  children.push(new Paragraph({ heading: HeadingLevel.HEADING_1, spacing: { before: 240 }, children: [tx(`${n++}. High findings (P1) — close before broad rollout`)] }));
  children.push(findingsTable(spec.p1, P1_FILL));
}
// ---- P2/P3 ----
if (spec.lowerSummary) {
  children.push(H1(`${n++}. Medium & low findings (P2 / P3) — summary`));
  if (spec.lowerSummary.p2) children.push(new Paragraph({ children: [tx("Medium (P2): ", { bold: true }), tx(spec.lowerSummary.p2)] }));
  if (spec.lowerSummary.p3) children.push(new Paragraph({ spacing: { before: 80 }, children: [tx("Low (P3): ", { bold: true }), tx(spec.lowerSummary.p3)] }));
}
// ---- Doc vs reality ----
if (spec.docVsReality && spec.docVsReality.length) {
  children.push(H1(`${n++}. Documentation vs reality (claims not backed by code)`));
  children.push(para("Asserting capabilities or compliance the code does not support is itself a liability. Recommendation: soften the language to what the code actually does, and withdraw every compliance claim until formal certification."));
  children.push(twoColTable("Claim in documentation", "Reality", 4400, spec.docVsReality));
}
// ---- Third parties ----
if (spec.thirdParties) {
  children.push(H1(`${n++}. Third parties that process sensitive data (agreement scope)`));
  children.push(para(spec.thirdParties));
}
// ---- Roadmap ----
if (spec.roadmap && spec.roadmap.length) {
  children.push(H1(`${n++}. Prioritized remediation roadmap`));
  spec.roadmap.forEach(tier => {
    children.push(H2(tier.tier));
    if (tier.items) tier.items.forEach(it => children.push(numItem(it)));
    if (tier.paragraph) children.push(para(tier.paragraph));
  });
}
// ---- Confirmations ----
if (spec.confirmations && spec.confirmations.length) {
  children.push(H1(`${n++}. Required confirmations (for leadership / compliance)`));
  spec.confirmations.forEach(c => children.push(numItem(c)));
}
// ---- Strengths ----
if (spec.strengths) {
  children.push(H1(`${n++}. What the build already does right (keep these)`));
  children.push(para(spec.strengths));
}
children.push(new Paragraph({ spacing: { before: 240 }, border: { top: { style: BorderStyle.SINGLE, size: 4, color: "BBBBBB", space: 4 } }, children: [tx("This document consolidates the evidence-based code audit and the remediation plan. Every finding is traceable to file:line in the source repository.", { italics: true, size: 17, color: "666666" })] }));

const doc = new Document({
  creator: ORG,
  title: M.title || "Security Audit",
  styles: {
    default: { document: { run: { font: "Arial", size: 21 } } },
    paragraphStyles: [
      { id: "Heading1", name: "Heading 1", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 30, bold: true, font: "Arial", color: ACCENT },
        paragraph: { spacing: { before: 280, after: 160 }, outlineLevel: 0 } },
      { id: "Heading2", name: "Heading 2", basedOn: "Normal", next: "Normal", quickFormat: true,
        run: { size: 24, bold: true, font: "Arial", color: SUBACCENT },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 1 } },
    ],
  },
  numbering: { config: [
    { reference: "bullets", levels: [{ level: 0, format: LevelFormat.BULLET, text: "•", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
    { reference: "nums", levels: [{ level: 0, format: LevelFormat.DECIMAL, text: "%1.", alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 540, hanging: 280 } } } }] },
  ]},
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
    headers: { default: new Header({ children: [ new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: ACCENT, space: 1 } }, children: [ tx(`${ORG} — ${CONF}`, { size: 16, color: ACCENT, bold: true }), new TextRun({ text: `\t${RUNHEAD}`, size: 16, color: "777777" }) ], tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }] }) ] }) },
    footers: { default: new Footer({ children: [ new Paragraph({ children: [ tx(FOOT, { size: 15, color: "888888" }), new TextRun({ text: "\tPage ", size: 15, color: "888888" }), new TextRun({ children: [PageNumber.CURRENT], size: 15, color: "888888" }), new TextRun({ text: " of ", size: 15, color: "888888" }), new TextRun({ children: [PageNumber.TOTAL_PAGES], size: 15, color: "888888" }) ], tabStops: [{ type: TabStopType.RIGHT, position: TabStopPosition.MAX }] }) ] }) },
    children,
  }],
});

Packer.toBuffer(doc).then(buffer => { fs.writeFileSync(outPath, buffer); console.log("written:", outPath, buffer.length, "bytes"); });
```

---

## Customization

- **Branding**: set `branding.org`, `branding.accent` (hex, no `#`), `branding.subAccent`,
  `branding.confidentialLabel`, `branding.runningHeadRight`, `branding.footerNote`. The accent
  drives headings, the running head, and table-header fill. Default palette is navy
  (`1F3864` / `2E4C7E`); severity rows are fixed orange tints (P0 darker, P1 lighter).
- **Compliance regime**: name the regime(s) in `meta.scope` and put the regime questions in
  `confirmations`. For **dual-jurisdiction** work, pair each control (e.g. HIPAA §164.312 ∥ a local
  data-protection statute) inside the finding's `fix` text and add both to `confirmations`.
- **Non-emergency audits**: set `meta.statusUrgent` to `false`, give a neutral `meta.status`,
  and omit the `urgency` block.
- **Sections are conditional**: omit `docVsReality`, `thirdParties`, `lowerSummary`, `confirmations`,
  or `strengths` and the generator simply skips them and renumbers the headings.

---

## Quality bar (check before delivering)

- [ ] Every finding has real `file:line` evidence (or is labeled an unverified hypothesis).
- [ ] Severity counts in the *Finding counts* table match the actual number of P0/P1 rows.
- [ ] Each finding maps to a concrete **required fix → control**.
- [ ] The roadmap's Tier 0 contains only the live-exposure P0s; nothing safe is mislabeled urgent.
- [ ] Documentation overclaims (false compliance/offline/etc.) are captured if present.
- [ ] Third-party data-processor scope listed if any external service touches sensitive data.
- [ ] Prose uses hedged language ("reduces / closes / mitigates"), never absolute guarantees.
- [ ] Strengths section credits what is genuinely good.
- [ ] The `.docx` opens, the table of contents is present (right-click → *Update Field* in Word to
      populate page numbers), and branding/severity colors render.

## Output

Deliver the `.docx` path, then a 4–6 line plain-English summary: the executive verdict, the
severity counts, the Tier-0 "do this first" list, and where the file was saved. Note that the
document is an assessment, not a certification, and that fixes are a plan to implement — not applied.

## Installation

```bash
# Project-level (recommended — committed with the repo)
SKILL_DIR=".claude/skills/security-audit-report"
mkdir -p "$SKILL_DIR"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/security-audit-report/skill.md \
  -o "$SKILL_DIR/SKILL.md"
echo "Installed: security-audit-report (/security-audit-report)"

# Global (~/.claude/skills/ — available in all projects)
SKILL_DIR="$HOME/.claude/skills/security-audit-report"
mkdir -p "$SKILL_DIR"
curl -fsSL https://raw.githubusercontent.com/nebuladevops/skills-engineering-auto/main/security-audit-report/skill.md \
  -o "$SKILL_DIR/SKILL.md"
```

Then invoke with `/security-audit-report`, or just ask for "a security audit document" and it will
trigger on the description above.
