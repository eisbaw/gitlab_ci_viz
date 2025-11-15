Read PRD.md.
You are an expert in usability and web-design, but also care about high quality data visualization.

**IMPORTANT**: This project uses d3.js (NOT vis.js) for timeline visualization. All mutations must work with the d3.js implementation in `static/d3-gantt.js`.

We shall do evolution, using two primitives:
1. Evaluate the current solution at git HEAD using multi-objective scoring.
2. Pick new HEAD from Pareto frontier and generate new mutation.
... and repeat these two operations forever.

# Multi-Objective Evolution

This approach prevents saturation at single-objective maxima (e.g., all solutions at 100.00 density) by tracking multiple independent quality dimensions.

# Step 1: Assign Multi-Objective Scores

Make sure all files are committed on HEAD before we produce new commits - i.e. the fan-out.
Once we have committed all files, we evaluate this HEAD across **four dimensions**:

## The Four Objectives (each 0-100):

### 1. Density (D): Information per Pixel
- **100**: Maximum useful data density, minimal whitespace, no crowding
- **70-89**: Good density but noticeable whitespace or sparse areas
- **30-69**: Shows data but lots of wasted space
- **0-29**: Mostly empty, little useful information visible

### 2. Usability (U): Feature Richness & Interactions
- **100**: Comprehensive features (keyboard nav, copy, tooltips, shortcuts, filters, etc.)
- **70-89**: Good feature set, most common operations supported
- **30-69**: Basic interactions work, missing useful features
- **0-29**: Minimal interactivity, hard to use

### 3. Performance (P): Speed & Responsiveness
- **100**: Instant load (<1s), smooth interactions, no lag
- **70-89**: Fast load (<3s), occasional brief delays
- **30-69**: Noticeable delays (3-10s), some lag
- **0-29**: Slow (>10s), frequent freezing

### 4. Accessibility (A): Keyboard & Screen Reader Support
- **100**: Full keyboard navigation, ARIA labels, focus indicators, semantic HTML
- **70-89**: Good keyboard support, some ARIA, mostly accessible
- **30-69**: Basic keyboard nav, missing ARIA, partial accessibility
- **0-29**: Mouse-only, no ARIA, inaccessible

## Evaluation Process:

1. Kill prior server on port 8000
2. Spin up via `nix-shell --run "just run"`
3. Use Chrome MCP server to load localhost:8000, wait 30 sec, take screenshot
4. Save screenshot under `screenshots/<commit-sha>/` and commit to git
5. Use sub-agents to evaluate:
   - **Screenshot agent**: Evaluate Density (D) and Usability (U) visually
   - **Performance agent**: Measure load time, check console for errors (P)
   - **Accessibility agent**: Test keyboard nav, check HTML semantics (A)
6. Set git tag with format: `d3js-D<score>-U<score>-P<score>-A<score>-<commit-sha>`
   - Example: `d3js-D98-U85-P92-A75-abc1234`
   - Tags MUST be prefixed with "d3js-" to distinguish from vis.js tags
   - Include commit-sha to prevent tag clobbering

## Scoring Guidelines:

**Density (D)** - Pure visual assessment from screenshot:
- Look at ratio of data pixels to whitespace pixels
- Check if timeline fills viewport efficiently
- Assess if text/bars are readable without excess spacing

**Usability (U)** - Review code + screenshot:
- Count available interactions (click, hover, keyboard shortcuts)
- Check for discoverable features (help panels, tooltips)
- Assess workflow efficiency

**Performance (P)** - Measure actual metrics:
- Page load time from server start to ready state
- Check Chrome DevTools console for errors/warnings
- Test interaction responsiveness (zoom, pan, click)

**Accessibility (A)** - Code + interaction testing:
- Can you navigate entire UI with keyboard only?
- Are focus indicators visible?
- Is semantic HTML used (proper headings, labels, ARIA)?

# Step 2: Select from Pareto Frontier

Instead of "top-3 by single score", we use **Pareto dominance**:

## Pareto Dominance Definition:

Solution A dominates solution B if:
- A is **better or equal** in all four objectives (D, U, P, A)
- A is **strictly better** in at least one objective

A solution is **non-dominated** (on the Pareto frontier) if no other solution dominates it.

## Selection Algorithm:

1. Parse all git tags matching pattern `d3js-D<num>-U<num>-P<num>-A<num>-<sha>`
2. Extract scores for each commit: `(D, U, P, A, sha)`
3. **ONLY consider tags with "d3js-" prefix** - ignore all vis.js tags
3. Compute Pareto frontier:
   ```
   frontier = []
   for each solution S:
       if no other solution dominates S:
           add S to frontier
   ```
4. **Pick randomly** from the Pareto frontier (not just top-3!)
5. Checkout the selected commit (detached HEAD is OK)

## Why This Works:

- At max Density (D=100), improvements in U, P, or A still advance evolution
- Solutions can't "saturate" - there's always room to improve underperforming dimensions
- Maintains diversity: both D100-U50-P90-A60 and D95-U95-P85-A85 can coexist on frontier
- Natural selection pressure across all objectives

## Implementation Notes:

Use a sub-agent to:
1. List all tags
2. Parse multi-objective scores
3. Calculate Pareto frontier
4. Return list of non-dominated commits
5. Pick one randomly

Example Pareto frontier (all are non-dominated):
```
d3js-D100-U80-P90-A70-abc1234  (max density, lower usability/accessibility)
d3js-D98-U95-P88-A75-def5678   (balanced)
d3js-D95-U90-P95-A90-ghi9012   (excellent all-around but not max density)
d3js-D100-U85-P85-A85-jkl3456  (max density, good others)
```

# Step 3: Generate Mutation

Once parent is selected from Pareto frontier:

1. Analyze parent's weaknesses (which objectives are lowest?)
2. Use sub-agent to create mutation targeting weakest dimension(s)
3. Examples:
   - Low U (Usability): Add keyboard shortcuts, tooltips, or filters
   - Low P (Performance): Optimize rendering, add caching, reduce bundle size
   - Low A (Accessibility): Add ARIA labels, improve keyboard nav, semantic HTML
   - Low D (Density): Reduce spacing, compress UI, increase info per pixel

4. Git commit the change, giving us new HEAD
5. Proceed to Step 1 to evaluate this new commit

Thus Step 1 and 2 form an evolutionary feedback loop that **never saturates** because improvements in any dimension advance the Pareto frontier.

# Help

If the algorithm gets stuck or produces poor mutations:
- Check the Pareto frontier size - should be 5-20 solutions typically
- If frontier collapses to 1-2 solutions, may need to restart or adjust scoring
- Can always go back to baseline tag and restart evolution

# Migration from Single-Objective

If you have existing single-score tags like `100.00-<sha>`:
1. Re-evaluate them with multi-objective scoring
2. Create new tags: `d3js-D100-U75-P85-A60-<sha>`
3. Keep old tags for reference but use new format going forward

# Important: d3.js Only

This evolution process works ONLY with d3.js implementations. All tags must use the "d3js-" prefix. When selecting parents or evaluating mutations:
- **ONLY** consider tags starting with "d3js-"
- **IGNORE** all vis.js tags (those without the prefix)
- All mutations must modify `static/d3-gantt.js` or related d3.js code

## Required Visual Design for Maximum Density

The d3.js implementation MUST follow these design principles for maximum information density:

- **Minimal vertical spacing**: Very little separation between pipelines to maximize density
- **No expandable/collapsible groups**: Do NOT use dropdown or expandable groups
- **Flat hierarchy**: Jobs rendered as thin lines directly under their pipeline line
- **Thin lines**: Both pipelines and jobs are thin horizontal lines (not thick bars)
- **Color coding**: Use colors to indicate status (success, pending, failure, blocked, etc.)
- **Tooltips**: Show details on hover for both jobs and pipelines
- **No wasted space**: Eliminate unnecessary padding, margins, and whitespace
