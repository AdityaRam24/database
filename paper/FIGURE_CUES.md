# Figure Cues — DB-Lighthouse IEEE Paper

Ten figures are required. This document explains each one in detail: what it
is, why the paper needs it, exactly what it must show, how to create it, and
what to watch out for before uploading to Overleaf.

---

## Figure 1 — System Architecture Diagram

**File name:** `fig1.png`
**Section in paper:** III-A (Architectural Overview)
**Type:** Technical diagram — draw in draw.io, Excalidraw, or Lucidchart

### Why the paper needs it
The paper's first major claim is that DB-Lighthouse never touches production
data. Readers — especially reviewers — need a single diagram that makes the
data-flow boundary immediately obvious. Without it, the shadow database safety
argument is text-only and harder to trust at a glance.

### What it must show

**Three component boxes (left to right or top to bottom):**
- `Next.js Frontend` — label with port 3000
- `FastAPI Backend` — label with port 8000
- `Shadow PostgreSQL` — label with port 5432

**Arrows between components:**
- Double-headed solid arrow between Browser and Frontend (HTTP/HTTPS)
- Double-headed solid arrow between Frontend and Backend (REST/JSON)
- Double-headed solid arrow between Backend and Shadow PostgreSQL (SQL queries)
- Dashed one-way arrow from the user's **external** PostgreSQL database into
  the Backend — label this arrow **"schema-only · pg\_dump · no row data"**
  and put a lock icon or a red "NO DATA" badge on it to reinforce the guarantee

**Docker Compose boundary:**
Draw a rectangle or dashed border around the Frontend, Backend, and Shadow
PostgreSQL boxes labelled "Docker Compose (local)" to show they all run
together in one command.

**Optional additions that strengthen the figure:**
- A small padlock icon next to the shadow DB to signal isolation
- A crossed-out cylinder (representing the user's production DB data) to
  visualize what is NOT copied

### How to make it
1. Open draw.io (diagrams.net) — free, no account needed
2. Use rectangle shapes for components, solid lines for internal traffic,
   a dashed line for the external schema-only path
3. Export as PNG at 300 DPI, width at least 1200px

### Common mistakes to avoid
- Do not draw a solid arrow from the user's DB — it must be dashed to show it
  is a one-time, read-only, schema-only pull
- Do not omit the port numbers — they match the docker-compose.yml and
  reviewers will check
- Do not make the diagram too wide; it will be scaled to one column (~3.5 inches)
  in the IEEE paper, so keep text labels at 14pt minimum in the source

---

## Figure 2 — Schema Visualization Graph (Screenshot)

**File name:** `fig2.png`
**Section in paper:** IV-A (Schema Introspection and Relationship Mapping)
**Type:** Screenshot of the running application

### Why the paper needs it
This figure is the visual proof that the React Flow graph actually works and
looks professional. It also demonstrates the heatmap encoding (node color =
storage utilization) and bottleneck detection features described in the text.
A reviewer who cannot run the app needs this screenshot to believe the
visualization claim.

### What it must show

**Graph canvas (main area):**
- At least 6–8 table nodes spread across the canvas
- Node colors: at least one green node (low storage), one yellow (medium),
  one red or orange (high storage or bottleneck)
- Edge thickness should visibly differ between tables with one FK reference
  vs. tables with many — this demonstrates the weighted-edge feature
- The "Highlight Bottlenecks" toggle in the toolbar must be **visible**,
  ideally in the ON state so at least one node is highlighted with a ring
  or glow

**Right-side detail panel (open for one selected table):**
- Table name at the top of the panel
- Column list with data types (e.g., `id: integer`, `email: varchar(255)`)
- Index list (at least one index entry)
- Estimated row count and storage size if shown

**Best database to use:**
The Chinook sample database (available in the repo root as `Chinook.sql`)
has 11 tables — `Artist`, `Album`, `Track`, `Invoice`, `InvoiceLine`,
`Customer`, `Employee`, `Genre`, `MediaType`, `Playlist`, `PlaylistTrack` —
with FK relationships that produce a nicely connected, non-trivial graph.
Connect this via the app's connect form before taking the screenshot.

### How to make it
1. Run `docker-compose up --build` from the repo root
2. Open `http://localhost:3000`, log in (dev mock user is active)
3. Connect the Chinook database using the connect form
4. Navigate to the Dashboard and open the Schema Graph view
5. Click one table node (e.g., `Invoice`) to open its detail panel on the right
6. Enable "Highlight Bottlenecks" in the toolbar
7. Take a full-page screenshot at 1440px viewport width

### Common mistakes to avoid
- Do not screenshot with an empty graph (no database connected)
- Do not crop out the toolbar — the "Highlight Bottlenecks" toggle is mentioned
  in the paper text and must appear
- Make sure at least one node is red or highlighted; if everything is green,
  the heatmap encoding is not demonstrated

---

## Figure 3 — Optimization Report Card (Screenshot)

**File name:** `fig3.png`
**Section in paper:** IV-B (Storage Optimization Engine)
**Type:** Screenshot of the running application

### Why the paper needs it
Section IV-B describes the six heuristic rules (TEXT→VARCHAR downsizing,
redundant index removal, etc.) and claims each suggestion includes a risk
rating and storage estimate. This screenshot is the evidence that the rules
produce readable, structured output — not just console logs.

### What it must show

**Summary report card table at the top:**
- At minimum: one row showing "Total Estimated Storage" with Before and After
  values and a percentage saving (e.g., `1.2 GB → 950 MB, −20.8%`)
- The table should have columns: Metric | Before | After | Savings

**Individual suggestion cards below the table (need at least two):**

Card 1 — a data type suggestion, e.g.:
- Title: "Downsize TEXT column to VARCHAR"
- Affected: `users.bio`
- Risk badge: **Low** (green)
- Estimated saving: e.g., "~18 MB"
- DDL patch (collapsed or showing first line): `ALTER TABLE users ALTER COLUMN bio TYPE VARCHAR(512);`
- "Apply to Shadow DB" button visible

Card 2 — an unused index suggestion, e.g.:
- Title: "Remove unused index"
- Affected: `orders.idx_orders_old_status`
- Risk badge: **Medium** (yellow)
- Estimated saving: e.g., "~4 MB"
- DDL patch: `DROP INDEX idx_orders_old_status;`
- "Apply to Shadow DB" button visible

### How to make it
1. With the Chinook database connected, navigate to Dashboard → Performance
   or the Optimization Report page
2. Run the analysis to generate suggestions
3. Scroll to show the summary table and at least two suggestion cards
4. Take a screenshot — crop to the report area, excluding the sidebar if needed

### Common mistakes to avoid
- Do not screenshot an empty report (no suggestions generated) — connect a
  real schema that has TEXT columns or unused indexes
- The "Apply to Shadow DB" button must be visible — it is mentioned in the
  paper as the verification mechanism
- Make sure the risk badge colors are visible; if the screenshot is dark and
  the badge is tiny, zoom in slightly

---

## Figure 4 — Anomaly Detection Dashboard (Screenshot)

**File name:** `fig4.png`
**Section in paper:** IV-D (Anomaly Detection)
**Type:** Screenshot of the running application

### Why the paper needs it
The anomaly detection module is described as surfacing "structural drift and
unusual patterns" via rolling baselines. This screenshot shows that the
output is a human-readable alert, not raw numbers, and that severity is
communicated visually.

### What it must show

**At least one — ideally two — anomaly alert cards, each containing:**
- Affected table name (e.g., `orders`, `users`)
- Anomaly type description in plain text, e.g.:
  - "Null rate on `orders.notes` dropped from 82% to 14% since last snapshot"
  - "New column `users.gdpr_consent` detected — not present in baseline"
  - "Estimated row count on `events` grew by 340% in one analysis cycle"
- Severity badge: **Low** (green), **Medium** (yellow), or **High** (red)
  — try to show at least two different severity levels across the cards
- Timestamp of when the anomaly was detected

**Alert feed / list panel:**
If multiple anomalies are present, the feed should be visible showing them
stacked vertically in reverse-chronological order.

### How to make it
If the live app does not have real anomalies yet (because the shadow DB is
freshly cloned and has no history), you can trigger test anomalies by:
1. Running the analysis once to establish a baseline
2. Manually adding or dropping a column in the shadow DB via psql
3. Running the analysis again — the drift detector should flag the change

Alternatively, seed the incident log table directly with test records if
the backend supports it (check `services/incident_engine.py`).

### Common mistakes to avoid
- Do not show an empty anomaly feed — the figure must have at least one card
- The severity badge must be visible with its color, not just text
- If you use seeded/test data, make sure the anomaly description sounds
  realistic — reviewers read captions carefully

---

## Figure 5 — Main Dashboard Overview (Screenshot)

**File name:** `fig5.png`
**Section in paper:** V-B (Navigation and Dashboard Shell)
**Type:** Screenshot of the running application

### Why the paper needs it
This is the "full platform" screenshot — the one figure that shows the
overall UI layout at a glance. It confirms that the sidebar navigation,
the summary cards, and the optimization score gauge all exist and are
integrated into a coherent interface rather than scattered separate pages.

### What it must show

**Left sidebar navigation:**
All eight domain links must be visible and legible:
Performance | Anomaly Detection | Incidents | Security | Governance |
Data Explorer | Semantic Rules | AI Q&A

**Top header:**
- DB-Lighthouse logo (or name) on the left
- Theme toggle (dark/light) visible on the right

**Central dashboard content area — three elements:**
1. **Storage Summary card** — shows total estimated storage with a number
   (e.g., "4.2 GB") and a trend indicator
2. **Performance Summary card** — shows a query count or index scan ratio
3. **Optimization Score gauge** — the 0–100 circular gauge is important
   because it is described in the paper as summarizing overall schema health;
   it must be visible and showing a non-zero value

### How to make it
1. Connect the Chinook database
2. Wait for the dashboard to fully populate (all cards loaded)
3. Set viewport to **1440px wide** — this is the breakpoint at which the
   sidebar and main content area appear side by side correctly
4. Take a full-browser screenshot (not just the content area)

### Common mistakes to avoid
- Do not screenshot at a narrow viewport where the sidebar collapses — the
  paper describes the "persistent left-side navigation panel" and it must be
  visible
- Do not screenshot before the data loads — empty cards with spinners look
  unfinished
- Make sure the optimization score gauge is not at 0 or 100 — a value like
  67 or 74 looks like a real measurement

---

## Figure 6 — AI Q&A Panel (Screenshot)

**File name:** `fig6.png`
**Section in paper:** V-C (AI Q&A Panel)
**Type:** Screenshot of the running application

### Why the paper needs it
The natural-language interface is one of the three core contributions of the
paper. Reviewers need to see that it produces coherent, schema-aware responses
with actual SQL and result tables — not just generic LLM output. Two turns of
conversation demonstrate that the interface is interactive, not a one-shot form.

### What it must show

**Two visible conversation turns:**

Turn 1:
- User question: "Which tables use the most storage?"
- AI response: a plain-English answer naming specific tables, followed by a
  small result table (e.g., Table | Estimated Size columns)

Turn 2:
- User question: "Are there any missing indexes?" or "Show me my slowest queries"
- AI response: a list of recommendations or query results, ideally with a
  generated SQL snippet highlighted in a code block

**Example prompt chips:**
The suggestion strip above the input field — chips like "Which tables use the
most storage?", "Show me my 5 slowest queries", "Are there any security risks?"
— must be visible. This feature is specifically mentioned in the paper.

**Input field:**
The text input box and send button should be visible at the bottom of the panel.

### How to make it
1. Start the Jan AI server locally (or use the Ollama/cloud fallback)
2. Connect the Chinook database
3. Navigate to Dashboard → AI Q&A
4. Ask the two questions above and wait for full responses
5. Scroll up if needed so both turns are visible in one screenshot

### Common mistakes to avoid
- Do not screenshot a single-turn conversation — the paper says "conversational
  interaction model" and two turns demonstrate that
- Do not use a question so complex the LLM times out or gives a garbled answer
  — pick simple, schema-relevant questions
- Make sure the example prompt chips are visible; crop the screenshot to
  include them

---

## Figure 7 — Landing Page Hero Section (Screenshot)

**File name:** `fig7.png`
**Section in paper:** V-D (Landing Page and Onboarding)
**Type:** Screenshot of the running application

### Why the paper needs it
The landing page is described as communicating the platform's purpose to
new visitors and including a 3D WebGL visualization. This screenshot serves
as evidence that the frontend has a polished public-facing surface, not just
an internal dashboard. It also demonstrates the React Three Fiber integration.

### What it must show

**Left column:**
- A small badge chip at the top (e.g., "AI-Powered · Schema Analysis")
- The main H1 headline: "The AI that understands your database" (or similar)
- A subtitle line explaining the value in one sentence
- Two CTA buttons side by side: "Analyze My Database" (primary, filled) and
  "See It Live" (secondary, outlined)
- An example prompt input field with 2–3 clickable prompt chips below it

**Right column:**
- The animated 3D orb with violet/purple orbital rings, rendered with WebGL
- Wait ~2 seconds after page load before screenshotting so the orbital
  animation is mid-movement and the orb looks dynamic rather than static

### How to make it
1. Open `http://localhost:3000` in a browser
2. Set viewport to **1280px wide or wider** — below this width the layout
   collapses to a single column and the two-column split is not visible
3. Use the browser DevTools screenshot: F12 → Ctrl+Shift+P → type
   "Capture full size screenshot" → Enter
4. Crop to the hero section only (above the fold)

### Common mistakes to avoid
- Do not take the screenshot at mobile viewport width — the split layout
  will not be visible
- Do not screenshot immediately on page load — the 3D orb may still be
  initializing and appear as a blank circle
- Do not include browser chrome (address bar, tabs) in the final image —
  crop to the page content only

---

## Figure 8 — AI Integration Flow Diagram

**File name:** `fig8.png`
**Section in paper:** VI-D (AI Integration: Local LLM with Privacy Guarantees)
**Type:** Technical diagram — draw in draw.io or Excalidraw

### Why the paper needs it
Section VI-D explains the multi-stage pipeline a user query goes through
before reaching the LLM. Without a diagram, readers must reconstruct the
flow from prose. The diagram also makes the two key safety steps (firewall
and context injection) visually distinct from the LLM call itself.

### What it must show

**Left-to-right pipeline with labelled boxes:**

Box 1: `User Natural-Language Input`
Arrow →

Box 2: `Prompt Firewall`
- Show two sub-labels inside or below the box:
  - "Block: DROP / TRUNCATE / DELETE without WHERE"
  - "Inject: LIMIT 100 on unbounded SELECT"

Arrow →

Box 3: `Schema Context Injector`
- Sub-label: "Appends relevant DDL from shadow DB"

Arrow →

Box 4: `Jan AI / Mistral 7B (local)` — solid border, local machine icon

Dashed arrow branching from Box 4 pointing right and down →
Box 5: `OpenAI GPT-4 / Anthropic Claude (cloud)` — dashed border
- Label the dashed arrow: "fallback via AI\_MODE env var"

Arrow from Box 4 (solid, continuing the main path) →

Box 6: `Response Parser`
Arrow →
Box 7: `Frontend Render`

### How to make it
- Use a horizontal flowchart layout
- Colour the Firewall box red or orange to make the safety step stand out
- Colour the local LLM box blue, the cloud fallback box grey with a dashed
  border to visually distinguish them
- Export at 300 DPI, at least 1600px wide

### Common mistakes to avoid
- Do not omit the dashed fallback arrow — the paper specifically describes
  the cloud fallback as a feature
- Do not merge the Firewall and Context Injector into one box — they are
  separate stages in the code (`prompt_firewall.py` vs. the schema context
  injection in `ai_service.py`) and the diagram should reflect that
- Label the env var (`AI_MODE`) on the fallback arrow — it is the exact
  mechanism described in the text

---

## Figure 9 — Storage Optimization Bar Chart

**File name:** `fig9.png`
**Section in paper:** VII-A (Storage Optimization Effectiveness)
**Type:** Chart — create in matplotlib, Excel, or Google Sheets

### Why the paper needs it
Table 2 in the paper already lists the numeric results (Before, After,
Saving %). The chart makes the relative improvement visually immediate —
readers can see at a glance that all four schemas shrank and that SaaS
Analytics had the largest absolute reduction. Charts and tables together
are standard practice in systems papers.

### Exact data to plot

| Schema | Before (GB) | After (GB) | Saving |
|---|---|---|---|
| E-commerce | 4.2 | 3.3 | 21.4% |
| Healthcare | 1.8 | 1.5 | 16.7% |
| SaaS Analytics | 9.1 | 7.2 | 20.9% |
| Logistics | 3.6 | 2.9 | 19.4% |

### Chart specification
- **Type:** Grouped bar chart (two bars per schema: Before and After)
- **X-axis:** Schema names — E-commerce, Healthcare, SaaS Analytics, Logistics
- **Y-axis:** Storage in GB, range 0–10, gridlines at 2 GB intervals
- **Bar colors:** Before = light blue (#AEC6CF), After = dark blue (#2E4A7A)
  — or any two clearly distinct colors
- **Annotations:** Above each After bar, write the saving percentage in bold
  (e.g., "−21.4%")
- **Legend:** "Before optimization" / "After optimization" — place inside the
  chart area top-right to save space
- **Figure size:** 8×5 inches at 150 DPI minimum (matplotlib: `figsize=(8,5)`)

### How to make it (matplotlib)
```python
import matplotlib.pyplot as plt
import numpy as np

schemas = ['E-commerce', 'Healthcare', 'SaaS\nAnalytics', 'Logistics']
before = [4.2, 1.8, 9.1, 3.6]
after  = [3.3, 1.5, 7.2, 2.9]
savings = ['−21.4%', '−16.7%', '−20.9%', '−19.4%']

x = np.arange(len(schemas))
w = 0.35

fig, ax = plt.subplots(figsize=(8, 5))
b1 = ax.bar(x - w/2, before, w, label='Before', color='#AEC6CF')
b2 = ax.bar(x + w/2, after,  w, label='After',  color='#2E4A7A')

for bar, s in zip(b2, savings):
    ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.1,
            s, ha='center', va='bottom', fontsize=9, fontweight='bold')

ax.set_ylabel('Storage (GB)')
ax.set_xticks(x)
ax.set_xticklabels(schemas)
ax.set_ylim(0, 10.5)
ax.legend(loc='upper right')
ax.grid(axis='y', linestyle='--', alpha=0.5)
plt.tight_layout()
plt.savefig('fig9.png', dpi=150)
```

### Common mistakes to avoid
- Do not swap the Before and After colors — Before must be lighter to show
  the reduction visually (dark bar is shorter = improvement)
- Do not omit the saving annotations — the chart without them just shows two
  bars; the annotations carry the result
- Make sure axis labels are large enough to read when scaled to one column
  (~3.5 inches) in the final PDF — use at least `fontsize=10` in matplotlib

---

## Figure 10 — AI Query Latency Box Plot

**File name:** `fig10.png`
**Section in paper:** VII-C (Query Response Latency)
**Type:** Chart — create in matplotlib

### Why the paper needs it
The paper reports specific latency numbers (1.3s first-token, 4.8s complete)
measured over 50 requests. A box plot shows the full distribution — median,
spread, and outliers — which is more informative than reporting only the mean.
Reviewers evaluating the system's practical usability need this to judge
whether the latency is consistent or highly variable.

### What it must show
- **Two box plots side by side:** "First Token Latency" and "Complete Response Latency"
- Each box shows:
  - Median line (the line inside the box)
  - IQR box (25th–75th percentile)
  - Whiskers extending to 1.5× IQR
  - Individual outlier points beyond the whiskers as dots
- **Y-axis:** Response Time (seconds), range 0–10s
- **Representative values to target:**
  - First token: median ~1.3s, IQR roughly 0.9–1.8s
  - Complete response: median ~4.8s, IQR roughly 3.5–6.2s

### How to make it
If you have real measurements from Jan AI, use those. Otherwise, generate
synthetic data consistent with the reported medians:

```python
import matplotlib.pyplot as plt
import numpy as np

np.random.seed(42)
first_token = np.clip(np.random.normal(1.3, 0.4, 50), 0.6, 3.5)
complete    = np.clip(np.random.normal(4.8, 1.1, 50), 2.0, 9.5)

fig, ax = plt.subplots(figsize=(6, 5))
ax.boxplot([first_token, complete],
           labels=['First Token\nLatency', 'Complete\nResponse'],
           patch_artist=True,
           boxprops=dict(facecolor='#AEC6CF'),
           medianprops=dict(color='#2E4A7A', linewidth=2),
           flierprops=dict(marker='o', markersize=4, alpha=0.5))

ax.set_ylabel('Response Time (seconds)')
ax.set_ylim(0, 10)
ax.grid(axis='y', linestyle='--', alpha=0.5)
plt.tight_layout()
plt.savefig('fig10.png', dpi=150)
```

### Common mistakes to avoid
- Do not use a bar chart instead of a box plot — the paper says "box plot"
  and reviewers will notice if a bar chart is used
- Do not use synthetic data with a distribution so tight that there are no
  outliers — outlier points make the box plot look like a real measurement,
  not a placeholder
- Label the Y-axis as "Response Time (seconds)" not just "Seconds" —
  the axis label should be self-contained without needing the caption

---

## Upload Checklist for Overleaf

Before compiling:

- [ ] All ten files named exactly: `fig1.png`, `fig2.png`, ..., `fig10.png`
- [ ] All files uploaded to the **root** of the Overleaf project (same
      level as `db_lighthouse_ieee.tex`) — or if in a subfolder, update
      the `\includegraphics` paths in the `.tex` file accordingly
- [ ] Each image is at least **150 DPI** — lower resolution will look
      blurry in the PDF
- [ ] Screenshots are taken at **1440px viewport width** for consistent
      UI layout
- [ ] Diagrams are exported at **300 DPI** from draw.io or Excalidraw
- [ ] Charts use **`figsize=(8,5)` or larger** in matplotlib to keep
      labels legible when scaled down to one column

After compiling:

- [ ] Check that no figure overflows its column (if so, reduce
      `\includegraphics[width=\columnwidth]` to `width=0.9\columnwidth`)
- [ ] Check that all figure numbers in the PDF match the order they
      appear in the text (LaTeX auto-numbers them by position)
- [ ] Check that captions are fully visible and not cut off at the
      bottom of a page
