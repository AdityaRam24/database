# Figure Cues — DB-Lighthouse IEEE Paper

Ten figures are needed. Each cue below matches the `[DIAGRAM CUE]` note in the LaTeX source.

---

## Figure 1 — System Architecture Diagram
**Section:** III-A (Architectural Overview)
**Type:** Architecture/technical diagram (draw manually or use draw.io / Excalidraw)
**Content:**
- Three boxes: Next.js Frontend (port 3000), FastAPI Backend (port 8000), Shadow PostgreSQL (port 5432)
- Bidirectional arrows: browser ↔ frontend, frontend ↔ backend, backend ↔ shadow DB
- Dashed arrow from user's external PostgreSQL → backend, labelled **"schema-only (pg_dump, no data)"**
- Docker Compose boundary around all three components
- Emphasize the safety guarantee with a lock icon or red "NO DATA" label on the dashed arrow

---

## Figure 2 — Schema Visualization Graph
**Section:** IV-A (Schema Introspection)
**Type:** Screenshot — `npm run dev`, navigate to Dashboard after connecting a DB
**Content:**
- React Flow canvas with several tables as colored nodes (green/yellow/red heatmap)
- Edges of varying thickness representing FK relationships
- Right-side detail panel open for one selected table (showing columns, types, indexes)
- "Highlight Bottlenecks" toggle visible in the toolbar
**Tip:** Use the Chinook sample database (`Chinook.sql` in repo root) — it has 11 tables with FK relationships, ideal for this screenshot.

---

## Figure 3 — Optimization Report Card
**Section:** IV-B (Storage Optimization Engine)
**Type:** Screenshot — Dashboard → Performance / Optimization Report page
**Content:**
- The tabular report card (Metric / Before / After / Savings columns)
- At least one row like: "Total Estimated Storage: 1.2 GB → 950 MB (20.8%)"
- One or two individual suggestion cards below showing:
  - Risk badge (Low / Medium / High)
  - Estimated saving in MB
  - The "Apply to Shadow DB" button
  - The generated DDL patch (collapsed or expanded)

---

## Figure 4 — Anomaly Detection Dashboard
**Section:** IV-D (Anomaly Detection)
**Type:** Screenshot — Dashboard → Anomaly Detection page
**Content:**
- Active anomaly alert card(s) with:
  - Affected table name
  - Anomaly type description (e.g., "Unexpected null-rate change on orders.notes")
  - Severity badge (Low / Medium / High)
  - Timestamp
- The alert feed/list if multiple anomalies are present

---

## Figure 5 — Main Dashboard Overview
**Section:** V-B (Navigation and Dashboard Shell)
**Type:** Screenshot — Dashboard home page after connecting Chinook DB
**Content:**
- Full layout: left sidebar navigation with all 8 domain links visible
- Top header with DB-Lighthouse logo and theme toggle
- Central area: Storage Summary card, Performance Summary card, Optimization Score gauge (0–100)
**Tip:** Capture at 1440px viewport width for the best two-column layout.

---

## Figure 6 — AI Q&A Panel
**Section:** V-C (AI Q&A Panel)
**Type:** Screenshot — Dashboard → AI / Ask AI page
**Content:**
- At least two conversation turns visible:
  1. Question: "Which tables use the most storage?" → AI response with result table
  2. Question: "Are there any missing indexes?" → AI response with recommendations
- Example prompt suggestion chips at the top of the input area
- The input field with the send button

---

## Figure 7 — Landing Page Hero Section
**Section:** V-D (Landing Page and Onboarding)
**Type:** Screenshot — http://localhost:3000 (root page)
**Content:**
- Desktop viewport (≥1280px wide) to show the two-column split layout
- Left column: badge chip, H1 headline, subtitle, dual CTA buttons, example prompt input with chips
- Right column: the 3D animated violet orb with orbital rings (let it run for ~2s before screenshotting for best position)
**Tip:** Use browser screenshot tool (F12 → Ctrl+Shift+P → "Capture full size screenshot") for a clean capture.

---

## Figure 8 — AI Integration Architecture
**Section:** VI-D (AI Integration)
**Type:** Technical flow diagram (draw.io / Excalidraw)
**Content:**
- Left: "User natural-language input" box
- Arrow → "Prompt Firewall" box (show two sub-rules: "Block DROP/TRUNCATE/DELETE" and "Auto-append LIMIT 100")
- Arrow → "Schema Context Injector" box (label: "Appends relevant DDL from shadow DB")
- Arrow → "Jan AI / Mistral 7B (local)" box
- Dashed fallback arrow from the same stage → "OpenAI GPT-4 / Claude (cloud)" box, labelled "fallback via env var"
- Arrow → "Response Parser" → "Frontend Render"

---

## Figure 9 — Storage Optimization Bar Chart
**Section:** VII-A (Storage Optimization Effectiveness)
**Type:** Chart (create in Excel, Google Sheets, or matplotlib)
**Content:**
- Grouped bar chart, x-axis: four schemas (E-commerce, Healthcare, SaaS Analytics, Logistics)
- Two bars per group: Before (light color) and After (dark color) in GB
- Values: E-commerce 4.2→3.3, Healthcare 1.8→1.5, SaaS Analytics 9.1→7.2, Logistics 3.6→2.9
- Annotate each pair with the saving percentage: 21.4%, 16.7%, 20.9%, 19.4%
- Y-axis: Storage (GB), legend for Before/After

---

## Figure 10 — AI Query Latency Box Plot
**Section:** VII-C (Query Response Latency)
**Type:** Chart (matplotlib or similar)
**Content:**
- Two-group box plot: "First Token Latency" and "Complete Response Latency"
- Median lines, IQR boxes, whiskers, and outlier dots
- Representative values: first-token median ~1.3s, complete-response median ~4.8s
- Y-axis: Response Time (seconds)
- You can generate synthetic data consistent with these medians for illustration, or measure real latencies from your Jan AI instance

---

## Compilation Instructions

To compile the LaTeX to PDF:

```bash
# Install TeX Live or MiKTeX if not already installed, then:
pdflatex db_lighthouse_ieee.tex
pdflatex db_lighthouse_ieee.tex   # run twice for correct references
bibtex db_lighthouse_ieee         # only if using .bib file (not needed here)
```

Or use an online editor: upload `db_lighthouse_ieee.tex` to **Overleaf** (overleaf.com),
set compiler to **pdfLaTeX**, and click Compile. Overleaf is free and requires no local install.

Once figures are ready, place them in a `figures/` sub-folder and add to the LaTeX:
```latex
\begin{figure}[htbp]
    \centering
    \includegraphics[width=\columnwidth]{figures/fig1_architecture.png}
    \caption{Three-tier system architecture of DB-Lighthouse.}
    \label{fig:architecture}
\end{figure}
```

Replace each `[DIAGRAM CUE — Figure N: ...]` block in the `.tex` file with the
corresponding `\begin{figure}...\end{figure}` block above.
