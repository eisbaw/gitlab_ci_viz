/**
 * D3.js GANTT Chart Implementation
 *
 * Renders GitLab CI pipeline data as an interactive GANTT timeline.
 * Replaces vis.js with pure d3.js for better performance and control.
 *
 * Features:
 * - Time-based sorting (newest pipelines first)
 * - Project-based color coding (consistent colors per project)
 * - Status indication via border styles (dashed for failed, dotted for running, etc.)
 * - Unexecuted job styling (manual/skipped: grey, 50% opacity, circular shape)
 * - Collapsible pipeline groups
 * - Interactive tooltips
 * - Click to open GitLab pages
 * - Resource contention visualization
 * - Auto-zoom to data range
 * - Smooth animations
 * - Zoom and pan controls (mouse wheel, buttons, keyboard shortcuts)
 * - Keyboard accessibility (Tab navigation, Enter/Space activation)
 * - ARIA labels for screen readers
 * - Focus indicators for keyboard users
 */

class D3GanttChart {
    constructor(containerId, config) {
        this.container = document.getElementById(containerId);
        this.config = config;

        // Layout configuration - optimized for maximum density
        this.margin = { top: 40, right: 15, bottom: 20, left: 85 };
        this.rowHeight = 12;  // Reduced for thinner jobs
        this.barHeight = 10;  // Much thinner bars
        this.labelPadding = 6;
        this.indentWidth = 15;
        this.minBarWidthForText = 40;  // Minimum bar width to show text label

        // Avatar configuration
        this.avatarSize = 16;  // Small circular avatars (16px diameter)
        this.avatarOffset = -22;  // Position to the left of bars (margin from bar start)

        // State
        this.expandedPipelines = new Set();
        this.data = [];
        this.contentionPeriods = [];
        this.cachedRows = null; // Cache transformed rows for zoom/pan performance

        // Project color mapping
        this.projectColorCache = new Map(); // Cache project colors for consistency

        // Runner color mapping
        this.runnerColorCache = new Map(); // Cache runner colors for consistency

        // D3 scales
        this.xScale = null;
        this.yScale = null;

        // Zoom state
        this.zoom = null;
        this.currentTransform = d3.zoomIdentity;
        this.baseXScale = null; // Store original scale for reset

        // SVG elements
        this.svg = null;
        this.chartGroup = null;
        this.tooltip = d3.select('#tooltip');

        // Performance optimizations
        this.zoomRafId = null; // For debouncing zoom re-renders
        this.textMeasureCache = new Map(); // Cache for text width measurements
        this.canvasContext = null; // For fast text measurements

        this.initializeSVG();
    }

    /**
     * Initialize SVG container and structure
     */
    initializeSVG() {
        // Clear existing content
        this.container.innerHTML = '';

        // Create SVG with accessibility attributes
        this.svg = d3.select(this.container)
            .append('svg')
            .attr('width', '100%')
            .attr('height', '100%')
            .attr('role', 'img')
            .attr('aria-label', 'GitLab CI Pipeline Timeline')
            .style('display', 'block');

        // Add description for screen readers (no title to avoid interfering with element-specific tooltips)
        this.svg.append('desc')
            .text('Interactive timeline showing GitLab CI pipelines and jobs. Use Tab to navigate, Enter or Space to open items in GitLab.');

        // Create main chart group
        this.chartGroup = this.svg.append('g')
            .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

        // Create layers (order matters for z-index)
        this.chartGroup.append('g').attr('class', 'grid-layer');
        this.chartGroup.append('g').attr('class', 'contention-layer');
        this.chartGroup.append('g').attr('class', 'pipeline-backgrounds-layer');
        this.chartGroup.append('g').attr('class', 'pipeline-click-overlay-layer'); // Clickable overlay behind jobs
        this.chartGroup.append('g').attr('class', 'arrows-layer'); // Arrows for parent-child pipeline relationships
        this.chartGroup.append('g').attr('class', 'bars-layer');
        this.chartGroup.append('g').attr('class', 'running-stripes-layer'); // Animated stripes for running jobs
        this.chartGroup.append('g').attr('class', 'avatars-layer');
        this.chartGroup.append('g').attr('class', 'current-time-layer');
        this.chartGroup.append('g').attr('class', 'axis-layer');
        this.svg.append('g').attr('class', 'labels-layer')
            .attr('transform', `translate(0,${this.margin.top})`);

        // Define circular clipPath for avatars (reusable)
        const defs = this.svg.append('defs');
        defs.append('clipPath')
            .attr('id', 'avatar-clip')
            .append('circle')
            .attr('cx', this.avatarSize / 2)
            .attr('cy', this.avatarSize / 2)
            .attr('r', this.avatarSize / 2);

        // Define arrowhead marker for parent-child pipeline arrows
        defs.append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '0 -5 10 10')
            .attr('refX', 8)
            .attr('refY', 0)
            .attr('markerWidth', 6)
            .attr('markerHeight', 6)
            .attr('orient', 'auto')
            .append('path')
            .attr('d', 'M0,-5L10,0L0,5')
            .attr('fill', '#666');

        // Define diagonal stripe pattern for running jobs (warning tape effect)
        // Pattern width is 28px, containing two 14px stripes (one visible, one transparent)
        const pattern = defs.append('pattern')
            .attr('id', 'diagonal-stripes')
            .attr('patternUnits', 'userSpaceOnUse')
            .attr('width', 28)
            .attr('height', 28)
            .attr('patternTransform', 'rotate(45)');

        // Create two identical stripe cycles for seamless wrapping
        // First cycle (0-28px)
        pattern.append('rect')
            .attr('x', 0)
            .attr('width', 14)
            .attr('height', 28)
            .attr('fill', 'rgba(255, 255, 255, 0.3)');

        pattern.append('rect')
            .attr('x', 14)
            .attr('width', 14)
            .attr('height', 28)
            .attr('fill', 'transparent');

        // Start animation
        this.animateStripePattern();
    }

    /**
     * Animate the diagonal stripe pattern for running jobs
     * Uses requestAnimationFrame for smooth, seamless scrolling without wrap stutter
     */
    animateStripePattern() {
        const pattern = this.svg.select('#diagonal-stripes');
        if (pattern.empty()) return;

        let offset = 0;
        let lastTime = performance.now();

        const animate = (currentTime) => {
            // Calculate time delta for frame-rate independent animation
            const deltaTime = currentTime - lastTime;
            lastTime = currentTime;

            // Move at constant speed: 28px per second (one full cycle)
            const speed = 28; // pixels per second
            offset += (speed * deltaTime) / 1000;

            // Seamless wrap: pattern repeats every 28px, so wrapping is invisible
            if (offset >= 28) {
                offset = offset % 28;
            }

            // Update pattern transform
            pattern.attr('patternTransform', `rotate(45) translate(${offset}, 0)`);

            requestAnimationFrame(animate);
        };

        requestAnimationFrame(animate);
    }

    /**
     * Render GANTT chart with given data
     * @param {Array} domainModel - Array of GroupKey objects with pipelines (projects or users)
     * @param {Array} contentionPeriods - Resource contention periods
     */
    render(domainModel, contentionPeriods = []) {
        console.log('D3 GANTT: Rendering with', domainModel.length, 'groups');

        this.data = domainModel;
        this.contentionPeriods = contentionPeriods;

        // Auto-expand first 4 pipelines on initial render (based on display order)
        if (this.expandedPipelines.size === 0) {
            // Transform to get pipelines in display order (newest first)
            const tempRows = this.transformToRows(domainModel);
            const pipelineRows = tempRows.filter(r => r.type === 'pipeline');

            // Expand first 4 pipelines in display order
            pipelineRows.slice(0, 4).forEach(row => {
                if (row.pipeline) {
                    this.expandedPipelines.add(row.pipeline.id);
                }
            });
            console.log('D3 GANTT: Auto-expanded first 4 pipelines:', Array.from(this.expandedPipelines));
        }

        // Transform data to flat row structure
        const rows = this.transformToRows(domainModel);
        this.cachedRows = rows; // Cache for zoom/pan performance
        console.log('D3 GANTT: Generated', rows.length, 'rows');

        if (rows.length === 0) {
            console.warn('No rows to render');
            return;
        }

        // Calculate dimensions
        const containerRect = this.container.getBoundingClientRect();
        const width = containerRect.width - this.margin.left - this.margin.right;
        const height = Math.max(rows.length * this.rowHeight, 400);

        // Update SVG height
        this.svg.attr('height', height + this.margin.top + this.margin.bottom);

        // Get time extent from all activities
        const allActivities = rows.filter(r => r.type !== 'group');
        if (allActivities.length === 0) {
            console.warn('No activities to render');
            return;
        }

        const timeExtent = d3.extent(allActivities.flatMap(r => [
            new Date(r.start),
            new Date(r.end)
        ]));

        // Add 5% padding to time range
        const timePadding = (timeExtent[1] - timeExtent[0]) * 0.05;
        timeExtent[0] = new Date(timeExtent[0].getTime() - timePadding);
        timeExtent[1] = new Date(timeExtent[1].getTime() + timePadding);

        // Create scales
        this.baseXScale = d3.scaleTime()
            .domain(timeExtent)
            .range([0, width]);

        // If viewport start time is provided and this is initial render, zoom to viewport
        if (this.config.viewportStart && !this.hasInitialViewportSet) {
            const viewportStartTime = new Date(this.config.viewportStart);
            const now = new Date();

            // Calculate zoom transform to show viewport range
            const fullDomain = timeExtent;
            const viewportDomain = [viewportStartTime, now];

            // Calculate scale factor (k) to fit viewport in the full domain
            const fullRange = fullDomain[1] - fullDomain[0];
            const viewportRange = viewportDomain[1] - viewportDomain[0];
            const k = fullRange / viewportRange;

            // Calculate translation (x) to center the viewport
            const fullStart = this.baseXScale(fullDomain[0]);
            const viewportStart = this.baseXScale(viewportDomain[0]);
            const x = -(viewportStart * k - fullStart);

            // Apply initial viewport transform
            this.currentTransform = d3.zoomIdentity.translate(x, 0).scale(k);
            this.hasInitialViewportSet = true;
        }

        // Apply current zoom transform to scale
        this.xScale = this.currentTransform.rescaleX(this.baseXScale);

        this.yScale = d3.scaleBand()
            .domain(rows.map((r, i) => i))
            .range([0, height])
            .padding(0.05);

        // Initialize zoom behavior (only once)
        if (!this.zoom) {
            this.initializeZoom(width, height);
            // Sync zoom behavior with viewport transform (if set)
            if (this.currentTransform && this.currentTransform.k !== 1) {
                this.svg.call(this.zoom.transform, this.currentTransform);
            }
        }

        // Render layers
        this.renderGrid(width, height);
        this.renderContention(width);
        this.renderPipelineBackgrounds(rows);
        this.renderArrows(rows);
        this.renderBars(rows);
        this.renderRunningStripes(rows);
        this.renderAvatars(rows);
        this.renderCurrentTime(height);
        this.renderAxis(width);
        this.renderLabels(rows);
    }

    /**
     * Transform domain model to flat row structure for rendering
     * Sorts by start time (newest first) instead of grouping by project
     */
    transformToRows(domainModel) {
        const rows = [];

        // Collect all pipelines from all projects
        const allPipelines = [];
        for (const project of domainModel) {
            for (const pipeline of project.pipelines) {
                allPipelines.push({
                    pipeline: pipeline,
                    projectName: project.getDisplayName(),
                    projectId: project.id
                });
            }
        }

        // Sort pipelines by start time (newest first)
        allPipelines.sort((a, b) => {
            const timeA = new Date(a.pipeline.getStartTime());
            const timeB = new Date(b.pipeline.getStartTime());
            return timeB - timeA; // Descending (newest first)
        });

        // Create rows for each pipeline
        for (const { pipeline, projectName, projectId } of allPipelines) {
            const pipelineExpanded = this.expandedPipelines.has(pipeline.id);

            // Pipeline bar row
            const projectPath = pipeline.projectPathWithNamespace;
            console.log(`Pipeline ${pipeline.id}: projectPathWithNamespace = ${projectPath}, projectId = ${projectId}`);

            rows.push({
                type: 'pipeline',
                level: 0,
                label: `P#${pipeline.id}`,
                start: pipeline.getStartTime(),
                end: pipeline.getEndTime(),
                status: pipeline.status,
                expanded: pipelineExpanded,
                pipeline: pipeline,
                projectId: projectId,
                projectName: projectName,
                projectPath: projectPath
            });

            // Job rows (if pipeline expanded)
            if (pipelineExpanded) {
                for (const job of pipeline.jobs) {
                    rows.push({
                        type: 'job',
                        level: 1,
                        label: `${job.stage}: ${job.name}`,
                        start: job.getStartTime(),
                        end: job.getEndTime(),
                        status: job.status,
                        job: job,
                        pipeline: pipeline,  // Add pipeline reference for avatar resolution
                        pipelineId: pipeline.id,
                        projectId: projectId,
                        projectName: projectName,
                        projectPath: job.projectPathWithNamespace
                    });
                }
            }
        }

        return rows;
    }

    /**
     * Extract user object from a row for avatar display.
     *
     * Implements a clear fallback strategy for determining which user to associate
     * with a pipeline or job row. The fallback logic prioritizes:
     *
     * For pipeline rows:
     *   1. pipeline.triggeringUser (actual GitLab user who triggered the pipeline)
     *   2. pipeline.group (may be project or user, used as last resort)
     *
     * For job rows:
     *   1. job.user (user who manually triggered/retried the job)
     *   2. pipeline.triggeringUser (if job has no user, inherit from pipeline)
     *   3. pipeline.group (last resort fallback)
     *
     * For all other row types:
     *   - Returns null (no user association)
     *
     * @param {Object} row - Row object from transformData()
     * @param {string} row.type - Row type: 'pipeline', 'job', or 'group'
     * @param {Pipeline} [row.pipeline] - Pipeline object (for pipeline/job rows)
     * @param {Job} [row.job] - Job object (for job rows)
     *
     * @returns {Object|null} User object with expected fields, or null if no user found
     *
     * Expected user object structure:
     * @typedef {Object} UserObject
     * @property {number} id - User ID
     * @property {string} username - Username (login name)
     * @property {string} name - Display name (human-readable)
     * @property {string|null} avatar_url - URL to user's avatar image (may be null)
     *
     * Design rationale:
     * - Pure function: no side effects, same input always produces same output
     * - Explicit handling: all row types have explicit cases (fail fast on unknown types)
     * - Testable: can be tested independently without rendering code
     * - Composable: can be reused anywhere user extraction is needed
     * - Clear fallback chain: easy to understand priority order
     */
    getUserForRow(row) {
        // Handle pipeline rows
        if (row.type === 'pipeline') {
            if (!row.pipeline) {
                // Log warning for malformed data but don't crash
                console.warn('Pipeline row missing pipeline object:', row);
                return null;
            }
            // Prefer actual triggering user over group (which may be a project)
            return row.pipeline.triggeringUser || row.pipeline.group || null;
        }

        // Handle job rows
        if (row.type === 'job') {
            if (!row.job) {
                // Log warning for malformed data but don't crash
                console.warn('Job row missing job object:', row);
                return null;
            }
            // Priority: job's user > pipeline's triggering user > pipeline's group
            if (row.job.user) {
                return row.job.user;
            }
            if (row.pipeline?.triggeringUser) {
                return row.pipeline.triggeringUser;
            }
            if (row.pipeline?.group) {
                return row.pipeline.group;
            }
            return null;
        }

        // Handle group rows (no user association)
        if (row.type === 'group') {
            return null;
        }

        // Unknown row type - fail fast with clear error
        console.error('Unknown row type for user extraction:', row.type, row);
        return null;
    }

    /**
     * Get consistent color for a project based on project name
     * Uses HSL color space for better visual distribution
     */
    getProjectColor(projectName) {
        if (!projectName) {
            return { fill: '#6c757d', stroke: '#5a6268' }; // Neutral gray for unknown projects
        }

        // Check cache first
        if (this.projectColorCache.has(projectName)) {
            return this.projectColorCache.get(projectName);
        }

        // Generate consistent hash from project name
        let hash = 0;
        for (let i = 0; i < projectName.length; i++) {
            hash = projectName.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash & hash; // Convert to 32-bit integer
        }

        // Use hash to generate hue (0-360)
        const hue = Math.abs(hash % 360);

        // Use moderate saturation and lightness for good visibility
        // Saturation: 55-65% for vibrant but not garish colors
        // Lightness: 45-55% for good contrast with white text
        const saturation = 55 + (Math.abs(hash >> 8) % 10);
        const lightness = 45 + (Math.abs(hash >> 16) % 10);

        const fillColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;

        // Darker stroke for border (reduce lightness by 10%)
        const strokeColor = `hsl(${hue}, ${saturation}%, ${Math.max(lightness - 10, 25)}%)`;

        const colors = { fill: fillColor, stroke: strokeColor };
        this.projectColorCache.set(projectName, colors);

        return colors;
    }

    /**
     * Get consistent matte color for a runner
     * @param {string} runnerName - Runner name/description to hash
     * @returns {Object} Object with fill and stroke colors
     *
     * Uses 16-bit hash truncation mapped to HSV hue with matte saturation
     */
    getRunnerColor(runnerName) {
        if (!runnerName) {
            return { fill: '#6c757d', stroke: '#5a6268' }; // Neutral gray for unknown runners
        }

        // Check cache first
        if (this.runnerColorCache.has(runnerName)) {
            return this.runnerColorCache.get(runnerName);
        }

        // Hash runner name using simple string hash
        let hash = 0;
        for (let i = 0; i < runnerName.length; i++) {
            hash = runnerName.charCodeAt(i) + ((hash << 5) - hash);
            hash = hash | 0; // Convert to 32-bit integer
        }

        // Ensure positive and truncate to 16-bit number (0-65535)
        // Use unsigned right shift to ensure positive value
        const hash16 = (hash >>> 16) ^ (hash & 0xFFFF);

        // Scale to hue (0-360 degrees)
        const hue = (hash16 / 65535) * 360;

        // Matte appearance: low saturation, higher lightness for brightness
        const saturation = 35;  // Low saturation for matte look
        const lightness = 70;   // Higher lightness for brighter appearance

        const fillColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        const strokeColor = `hsl(${hue}, ${saturation}%, ${Math.max(lightness - 10, 30)}%)`;

        const colors = { fill: fillColor, stroke: strokeColor };
        this.runnerColorCache.set(runnerName, colors);

        return colors;
    }

    /**
     * Get list of runners currently displayed in the chart
     * @returns {Array<{name: string, colors: {fill: string, stroke: string}}>}
     */
    getDisplayedRunners() {
        return Array.from(this.runnerColorCache.entries())
            .map(([name, colors]) => ({ name, colors }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get list of projects currently displayed in the chart
     * @returns {Array<{name: string, colors: {fill: string, stroke: string}}>}
     */
    getDisplayedProjects() {
        return Array.from(this.projectColorCache.entries())
            .map(([name, colors]) => ({ name, colors }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Get runner name from job data
     * @param {Object} d - Row data object
     * @returns {string|null} Runner name/description or null
     */
    getRunnerName(d) {
        if (d.type !== 'job' || !d.job || !d.job.runner) {
            return null;
        }

        // Use description if available (more descriptive), otherwise use name
        return d.job.runner.description || d.job.runner.name || null;
    }

    /**
     * Get border style based on status (for visual status indication)
     */
    getStatusBorderStyle(status) {
        const styles = {
            'success': { width: 2, dasharray: 'none' },
            'failed': { width: 3, dasharray: '4,2' },      // Dashed border for failed
            'running': { width: 2, dasharray: '2,2' },      // Dotted border for running
            'pending': { width: 2, dasharray: '6,3' },      // Long dashes for pending
            'canceled': { width: 2, dasharray: '3,3,1,3' }, // Dash-dot for canceled
            'cancelled': { width: 2, dasharray: '3,3,1,3' }
        };
        return styles[status] || { width: 2, dasharray: 'none' };
    }

    /**
     * Initialize zoom and pan behavior
     */
    initializeZoom(width, height) {
        // Create zoom behavior with custom filter
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 20]) // Allow 2x zoom out to 20x zoom in
            .translateExtent([[0, 0], [width, height]]) // Limit panning to chart bounds
            .filter((event) => {
                // Allow drag to pan
                if (event.type === 'mousedown') return true;

                // For wheel events: only zoom on Ctrl+wheel or horizontal scroll
                if (event.type === 'wheel') {
                    // Ctrl+wheel = zoom
                    if (event.ctrlKey) return true;

                    // Horizontal scroll = zoom
                    if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return true;

                    // Vertical scroll = page scroll (don't capture)
                    return false;
                }

                return true; // Allow other events (touch, etc.)
            })
            .on('zoom', (event) => this.handleZoom(event));

        // Apply zoom to chart group
        this.svg.call(this.zoom);
    }

    /**
     * Handle zoom events (debounced with requestAnimationFrame for performance)
     */
    handleZoom(event) {
        // Store current transform
        this.currentTransform = event.transform;

        // Update x scale with transform
        this.xScale = this.currentTransform.rescaleX(this.baseXScale);

        // Debounce re-renders using requestAnimationFrame
        if (this.zoomRafId) {
            cancelAnimationFrame(this.zoomRafId);
        }

        this.zoomRafId = requestAnimationFrame(() => {
            // Re-render affected layers using cached rows for performance
            const rows = this.cachedRows || this.transformToRows(this.data);
            this.renderGrid(this.getChartWidth(), this.getChartHeight());
            this.renderContention(this.getChartWidth());
            this.renderPipelineBackgrounds(rows);
            this.renderArrows(rows, 'zoom');
            // Use zoom mode for minimal DOM updates (only x-positions and widths)
            this.renderBars(rows, 'zoom');
            this.renderRunningStripes(rows, 'zoom');
            this.renderAvatars(rows);
            this.renderCurrentTime(this.getChartHeight());
            this.renderAxis(this.getChartWidth());
            this.zoomRafId = null;
        });
    }

    /**
     * Reset zoom to default view (instant for better performance)
     */
    resetZoom() {
        this.svg.call(this.zoom.transform, d3.zoomIdentity);
    }

    /**
     * Pan the view by specified pixel amounts
     * @param {number} dx - Horizontal pan in pixels (positive = right, negative = left)
     * @param {number} dy - Vertical pan in pixels (positive = down, negative = up)
     */
    pan(dx, dy) {
        if (!this.zoom || !this.svg || !this.currentTransform) {
            return;
        }

        // Get current transform or use identity
        const transform = this.currentTransform || d3.zoomIdentity;

        // Create new transform with adjusted translation
        const newTransform = transform.translate(dx, dy);

        // Apply with smooth transition
        this.svg.transition()
            .duration(300)
            .call(this.zoom.transform, newTransform);
    }

    /**
     * Get current chart width
     */
    getChartWidth() {
        const containerRect = this.container.getBoundingClientRect();
        return containerRect.width - this.margin.left - this.margin.right;
    }

    /**
     * Get current chart height
     */
    getChartHeight() {
        const svgHeight = parseFloat(this.svg.attr('height'));
        return svgHeight - this.margin.top - this.margin.bottom;
    }

    /**
     * Render background grid
     */
    renderGrid(width, height) {
        const gridLayer = this.chartGroup.select('.grid-layer');
        gridLayer.selectAll('*').remove();

        // Vertical grid lines at time intervals
        const xTicks = this.xScale.ticks(10);

        gridLayer.selectAll('line')
            .data(xTicks)
            .join('line')
            .attr('class', 'gantt-grid')
            .attr('x1', d => this.xScale(d))
            .attr('x2', d => this.xScale(d))
            .attr('y1', 0)
            .attr('y2', height);
    }

    /**
     * Render resource contention background in axis area
     * Shows as a thin colored strip behind the timeline axis
     */
    renderContention(width) {
        const contentionLayer = this.chartGroup.select('.contention-layer');
        contentionLayer.selectAll('*').remove();

        if (!this.contentionPeriods || this.contentionPeriods.length === 0) {
            return;
        }

        // Render in axis area: from -30px (above day labels) to -2px (below time labels)
        const axisY = -30;
        const axisHeight = 28;

        contentionLayer.selectAll('rect')
            .data(this.contentionPeriods)
            .join('rect')
            .attr('class', d => `contention-${d.level}`)
            .attr('x', d => this.xScale(new Date(d.start)))
            .attr('y', axisY)
            .attr('width', d => {
                const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                return Math.max(w, 2); // Minimum 2px width
            })
            .attr('height', axisHeight);
    }

    /**
     * Render arrows connecting parent pipelines to their child pipelines
     * @param {Array} rows - Row data from transformToRows()
     * @param {string} mode - 'full' or 'zoom' for rendering optimization
     */
    renderArrows(rows, mode = 'full') {
        const arrowsLayer = this.chartGroup.select('.arrows-layer');

        // Build map of pipeline ID to row index for quick lookup
        const pipelineRowMap = new Map();
        rows.forEach((row, index) => {
            if (row.type === 'pipeline' && row.pipeline) {
                pipelineRowMap.set(row.pipeline.id, { row, index });
            }
        });

        // Find all parent-child relationships
        const arrowData = [];
        rows.forEach((row, rowIndex) => {
            if (row.type === 'pipeline' && row.pipeline) {
                const pipeline = row.pipeline;

                // Check if this pipeline has child pipelines
                if (pipeline.childPipelines && pipeline.childPipelines.length > 0) {
                    for (const childPipeline of pipeline.childPipelines) {
                        const childInfo = pipelineRowMap.get(childPipeline.id);
                        if (childInfo) {
                            arrowData.push({
                                parentPipeline: pipeline,
                                parentRow: row,
                                parentIndex: rowIndex,
                                childPipeline: childPipeline,
                                childRow: childInfo.row,
                                childIndex: childInfo.index
                            });
                        }
                    }
                }
            }
        });

        // Fast path for zoom: only update path positions
        if (mode === 'zoom') {
            arrowsLayer.selectAll('path.pipeline-arrow')
                .attr('d', d => this.generateArrowPath(d));
            return;
        }

        // Full render path
        const arrows = arrowsLayer.selectAll('path.pipeline-arrow')
            .data(arrowData, d => `${d.parentPipeline.id}-${d.childPipeline.id}`);

        arrows.join(
            enter => enter.append('path')
                .attr('class', 'pipeline-arrow')
                .attr('d', d => this.generateArrowPath(d))
                .attr('fill', 'none')
                .attr('stroke', '#666')
                .attr('stroke-width', 1.5)
                .attr('stroke-dasharray', '4,2')
                .attr('marker-end', 'url(#arrowhead)')
                .attr('opacity', 0.7)
                .append('title')
                    .text(d => `Pipeline #${d.parentPipeline.id} triggers #${d.childPipeline.id}`),
            update => update
                .attr('d', d => this.generateArrowPath(d))
        );
    }

    /**
     * Generate SVG path for arrow between parent and child pipeline
     * Uses a curved bezier path for better aesthetics
     */
    generateArrowPath(arrowData) {
        const { parentRow, parentIndex, childRow, childIndex } = arrowData;

        // Calculate parent bar position (left edge, vertical center of bar)
        const parentStartX = this.xScale(new Date(parentRow.start));
        const parentBarY = this.yScale(parentIndex) + (this.rowHeight - this.barHeight) / 2;
        const parentY = parentBarY + this.barHeight / 2;

        // Calculate child bar position (left edge, vertical center of bar)
        const childStartX = this.xScale(new Date(childRow.start));
        const childBarY = this.yScale(childIndex) + (this.rowHeight - this.barHeight) / 2;
        const childY = childBarY + this.barHeight / 2;

        // Start from left edge of parent
        const startX = parentStartX;
        const startY = parentY;

        // End at left edge of child
        const endX = childStartX;
        const endY = childY;

        // Calculate control points for bezier curve
        // Arrow goes from parent's left edge to child's left edge
        const yDiff = endY - startY;

        // For left-to-left arrows, curve to the left of both points
        const curveOffset = Math.max(30, Math.min(Math.abs(yDiff) * 0.3, 60));

        if (yDiff === 0) {
            // Same row - simple horizontal line
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        } else {
            // Curve to the left of both bars, then down/up to the child
            const leftOffset = -curveOffset; // Curve goes left
            const cp1x = startX + leftOffset;
            const cp1y = startY;
            const cp2x = endX + leftOffset;
            const cp2y = endY;
            return `M ${startX} ${startY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${endX} ${endY}`;
        }
    }

    /**
     * Check if a job is a manual job (requires human intervention)
     */
    isManualJob(d) {
        return d.type === 'job' && d.status === 'manual';
    }

    /**
     * Check if a job is an unexecuted job (manual or skipped)
     * These jobs haven't actually run, so they get grey/transparent/circular styling
     */
    isUnexecutedJob(d) {
        return d.type === 'job' && (d.status === 'manual' || d.status === 'skipped');
    }

    /**
     * Check if a job is pending (created but not yet running)
     * These are jobs waiting in the queue to be picked up by a runner
     */
    isPendingJob(d) {
        if (d.type !== 'job') return false;
        const pendingStatuses = ['created', 'pending', 'waiting_for_resource', 'preparing'];
        return pendingStatuses.includes(d.status);
    }

    /**
     * Get outline color for jobs based on status and allow_failure flag
     * - Green: success
     * - Red: failed (and not allowed to fail)
     * - Yellow: failed but allowed to fail
     * - Project color: other statuses or pipelines
     */
    getJobOutlineColor(d) {
        // Only apply colored outlines to jobs, not pipelines
        if (d.type !== 'job') {
            const colors = this.getProjectColor(d.projectName);
            return colors.stroke;
        }

        // Canceled jobs get black outline
        if (d.status === 'canceled' || d.status === 'cancelled') {
            return '#000000';  // Black
        }

        // Unexecuted jobs (manual/skipped) get grey
        if (this.isUnexecutedJob(d)) {
            return '#757575';
        }

        // Success jobs get green outline
        if (d.status === 'success') {
            return '#28a745';  // Green
        }

        // Failed jobs
        if (d.status === 'failed') {
            // Yellow if allowed to fail, red otherwise
            return d.job?.allowFailure ? '#ffc107' : '#dc3545';  // Yellow or Red
        }

        // Default: use project color for other statuses
        const colors = this.getProjectColor(d.projectName);
        return colors.stroke;
    }

    /**
     * Render background boxes for expanded pipelines
     */
    renderPipelineBackgrounds(rows) {
        const backgroundsLayer = this.chartGroup.select('.pipeline-backgrounds-layer');

        // Find all expanded pipelines and their jobs
        const expandedPipelines = [];

        for (let i = 0; i < rows.length; i++) {
            const row = rows[i];
            if (row.type === 'pipeline' && row.expanded) {
                // Find all job rows for this pipeline
                const jobs = [];
                let minTime = new Date(row.start);
                let maxTime = new Date(row.end);
                let firstJobIndex = i + 1;
                let lastJobIndex = i;

                // Collect all jobs for this pipeline
                for (let j = i + 1; j < rows.length && rows[j].type === 'job'; j++) {
                    if (rows[j].pipelineId === row.pipeline.id) {
                        jobs.push(rows[j]);
                        lastJobIndex = j;

                        // Update time range to encompass all jobs
                        const jobStart = new Date(rows[j].start);
                        const jobEnd = new Date(rows[j].end);
                        if (jobStart < minTime) minTime = jobStart;
                        if (jobEnd > maxTime) maxTime = jobEnd;
                    }
                }

                if (jobs.length > 0) {
                    expandedPipelines.push({
                        pipeline: row.pipeline,
                        pipelineRowIndex: i,
                        firstJobIndex: firstJobIndex,
                        lastJobIndex: lastJobIndex,
                        minTime: minTime,
                        maxTime: maxTime,
                        projectName: row.projectName
                    });
                }
            }
        }

        // Render background boxes
        const backgrounds = backgroundsLayer.selectAll('rect.pipeline-background')
            .data(expandedPipelines, d => d.pipeline.id);

        backgrounds.join(
            enter => enter.append('rect')
                .attr('class', 'pipeline-background')
                .attr('x', d => this.xScale(d.minTime))
                .attr('y', d => {
                    // Position at first job row
                    return this.yScale(d.firstJobIndex) - 2; // Small padding above
                })
                .attr('width', d => {
                    const w = this.xScale(d.maxTime) - this.xScale(d.minTime);
                    return Math.max(w, 4);
                })
                .attr('height', d => {
                    // Height spans all job rows plus padding
                    const jobCount = d.lastJobIndex - d.firstJobIndex + 1;
                    return this.yScale(d.firstJobIndex + jobCount - 1) - this.yScale(d.firstJobIndex) + this.rowHeight + 4; // Small padding below
                })
                .attr('rx', 3)
                .attr('fill', d => {
                    const colors = this.getProjectColor(d.projectName);
                    return colors.fill;
                })
                .attr('fill-opacity', 0.08)
                .attr('stroke', d => {
                    const colors = this.getProjectColor(d.projectName);
                    return colors.stroke;
                })
                .attr('stroke-width', 1.5)
                .attr('stroke-opacity', 0.25)
                .attr('stroke-dasharray', '4,4')
                .attr('pointer-events', 'none'),
            update => update
                .attr('x', d => this.xScale(d.minTime))
                .attr('y', d => {
                    return this.yScale(d.firstJobIndex) - 2;
                })
                .attr('width', d => {
                    const w = this.xScale(d.maxTime) - this.xScale(d.minTime);
                    return Math.max(w, 4);
                })
                .attr('height', d => {
                    const jobCount = d.lastJobIndex - d.firstJobIndex + 1;
                    return this.yScale(d.firstJobIndex + jobCount - 1) - this.yScale(d.firstJobIndex) + this.rowHeight + 4;
                })
                .attr('fill', d => {
                    const colors = this.getProjectColor(d.projectName);
                    return colors.fill;
                })
                .attr('stroke', d => {
                    const colors = this.getProjectColor(d.projectName);
                    return colors.stroke;
                })
                .attr('pointer-events', 'none')
        );

        // Render background labels for expanded pipelines (multi-line text)
        const labelGroups = backgroundsLayer.selectAll('g.pipeline-background-label-group')
            .data(expandedPipelines, d => d.pipeline.id);

        const mergedGroups = labelGroups.join(
            enter => {
                const g = enter.append('g')
                    .attr('class', 'pipeline-background-label-group')
                    .attr('pointer-events', 'none');

                // Add three text lines: project, sha, ref
                g.append('text')
                    .attr('class', 'pipeline-label-project')
                    .attr('x', 0)
                    .attr('y', 0)
                    .attr('text-anchor', 'start')
                    .attr('font-size', '24px')
                    .attr('font-weight', '600')
                    .attr('fill', d => {
                        const colors = this.getProjectColor(d.projectName);
                        return colors.stroke;
                    })
                    .attr('fill-opacity', 0.25);

                g.append('text')
                    .attr('class', 'pipeline-label-sha')
                    .attr('x', 0)
                    .attr('y', 24)
                    .attr('text-anchor', 'start')
                    .attr('font-size', '24px')
                    .attr('font-weight', '600')
                    .attr('fill', d => {
                        const colors = this.getProjectColor(d.projectName);
                        return colors.stroke;
                    })
                    .attr('fill-opacity', 0.25);

                g.append('text')
                    .attr('class', 'pipeline-label-ref')
                    .attr('x', 0)
                    .attr('y', 48)
                    .attr('text-anchor', 'start')
                    .attr('font-size', '24px')
                    .attr('font-weight', '600')
                    .attr('fill', d => {
                        const colors = this.getProjectColor(d.projectName);
                        return colors.stroke;
                    })
                    .attr('fill-opacity', 0.25);

                return g;
            },
            update => update
        );

        // Position the label groups (for both enter and update)
        mergedGroups.attr('transform', d => {
            const x = this.xScale(d.minTime) - 10; // 10px padding to the left of the box
            const firstJobY = this.yScale(d.firstJobIndex) - 2;
            const jobCount = d.lastJobIndex - d.firstJobIndex + 1;
            const boxHeight = this.yScale(d.firstJobIndex + jobCount - 1) - this.yScale(d.firstJobIndex) + this.rowHeight + 4;
            const y = firstJobY + boxHeight / 2 - 24; // Center vertically, offset up by 24px (one line height)
            return `translate(${x}, ${y})`;
        });

        // Update text content (for both enter and update)
        mergedGroups.selectAll('.pipeline-label-project')
            .text(d => d.projectName || 'Unknown');

        mergedGroups.selectAll('.pipeline-label-sha')
            .text(d => d.pipeline.sha ? d.pipeline.sha.substring(0, 8) : '');

        mergedGroups.selectAll('.pipeline-label-ref')
            .text(d => d.pipeline.ref || '');

        // Render invisible clickable overlays on top of everything
        const overlayLayer = this.chartGroup.select('.pipeline-click-overlay-layer');
        const overlays = overlayLayer.selectAll('rect.pipeline-click-overlay')
            .data(expandedPipelines, d => d.pipeline.id);

        overlays.join(
            enter => enter.append('rect')
                .attr('class', 'pipeline-click-overlay')
                .attr('fill', 'transparent')
                .attr('stroke', 'none')
                .attr('cursor', 'pointer')
                .on('click', (event, d) => {
                    event.stopPropagation();
                    window.open(d.pipeline.webUrl, '_blank');
                })
                .on('mouseenter', function(event, d) {
                    // Highlight the corresponding background box
                    const bg = backgroundsLayer.selectAll('rect.pipeline-background')
                        .filter(bgData => bgData.pipeline.id === d.pipeline.id);
                    bg.attr('fill-opacity', 0.15)
                        .attr('stroke-opacity', 0.5);
                })
                .on('mouseleave', function(event, d) {
                    // Restore the corresponding background box
                    const bg = backgroundsLayer.selectAll('rect.pipeline-background')
                        .filter(bgData => bgData.pipeline.id === d.pipeline.id);
                    bg.attr('fill-opacity', 0.08)
                        .attr('stroke-opacity', 0.25);
                })
                .append('title')
                    .text(d => `Click to open pipeline ${d.pipeline.id} in GitLab`),
            update => update
        );

        // Position the clickable overlays to match the background boxes
        overlays
            .attr('x', d => this.xScale(d.minTime))
            .attr('y', d => this.yScale(d.firstJobIndex) - 2)
            .attr('width', d => {
                const w = this.xScale(d.maxTime) - this.xScale(d.minTime);
                return Math.max(w, 4);
            })
            .attr('height', d => {
                const jobCount = d.lastJobIndex - d.firstJobIndex + 1;
                return this.yScale(d.firstJobIndex + jobCount - 1) - this.yScale(d.firstJobIndex) + this.rowHeight + 4;
            });
    }

    /**
     * Render timeline bars (pipelines and jobs)
     */
    renderBars(rows, mode = 'full') {
        const barsLayer = this.chartGroup.select('.bars-layer');

        // Filter out expanded pipeline bars (they're shown as background boxes)
        // but keep collapsed pipeline bars and all job bars
        const barsToRender = rows.filter(r => {
            if (r.type === 'group') return false;
            if (r.type === 'pipeline' && r.expanded) return false; // Skip expanded pipeline bars
            return true;
        });

        const bars = barsLayer.selectAll('rect.gantt-bar')
            .data(barsToRender, (d, i) => `${d.type}-${i}`);

        // Fast path for zoom: only update x-positions and widths (70% fewer DOM operations)
        if (mode === 'zoom') {
            bars.attr('x', d => this.xScale(new Date(d.start)))
                .attr('width', d => {
                    const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return Math.max(w, 4);
                });

            // Update text labels on zoom (only for bars that are actually rendered)
            const barTexts = barsLayer.selectAll('text.gantt-bar-text')
                .data(barsToRender, (d, i) => `${d.type}-${i}`);

            barTexts.attr('x', d => {
                const barX = this.xScale(new Date(d.start));
                return barX + 4;  // Small padding from left edge
            })
            .text(d => {
                const barWidth = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                return this.getBarText(d, barWidth);
            })
            .style('display', d => {
                const barWidth = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                return barWidth >= this.minBarWidthForText ? 'block' : 'none';
            });

            return;
        }

        // Full rendering path: complete enter/update/exit cycle
        // Enter + Update
        bars.join(
            enter => enter.append('rect')
                .attr('class', d => `gantt-bar${d.status === 'running' ? ' running' : ''}`)
                .attr('tabindex', '0')
                .attr('role', 'button')
                .attr('aria-label', d => this.getBarAriaLabel(d))
                .attr('x', d => this.xScale(new Date(d.start)))
                .attr('y', (d, i) => {
                    const rowIndex = rows.indexOf(d);
                    return this.yScale(rowIndex) + (this.rowHeight - this.barHeight) / 2;
                })
                .attr('width', 0)
                .attr('height', this.barHeight)
                .attr('rx', d => {
                    // Circular for unexecuted jobs (manual/skipped) and pending jobs
                    if (this.isUnexecutedJob(d) || this.isPendingJob(d)) {
                        return this.barHeight / 2;
                    }
                    return 2;
                })
                .attr('fill', d => {
                    // Black for canceled jobs
                    if (d.status === 'canceled' || d.status === 'cancelled') {
                        return '#000000';
                    }
                    if (this.isUnexecutedJob(d)) {
                        return '#9e9e9e';  // Grey for unexecuted jobs (manual/skipped)
                    }
                    // Jobs: use runner color if available, otherwise project color
                    if (d.type === 'job') {
                        const runnerName = this.getRunnerName(d);
                        if (runnerName) {
                            const colors = this.getRunnerColor(runnerName);
                            return colors.fill;
                        }
                    }
                    // Pipelines or jobs without runner: use project color
                    const colors = this.getProjectColor(d.projectName);
                    return colors.fill;
                })
                .attr('fill-opacity', d => {
                    // 50% opacity for unexecuted and pending jobs
                    if (this.isUnexecutedJob(d) || this.isPendingJob(d)) {
                        return 0.5;
                    }
                    return 1;
                })
                .attr('stroke', d => this.getJobOutlineColor(d))
                .attr('stroke-opacity', d => this.isUnexecutedJob(d) ? 0.7 : 1)
                .attr('stroke-width', d => {
                    const borderStyle = this.getStatusBorderStyle(d.status);
                    return borderStyle.width;
                })
                .attr('stroke-dasharray', d => {
                    const borderStyle = this.getStatusBorderStyle(d.status);
                    return borderStyle.dasharray;
                })
                .on('click', (event, d) => this.handleBarClick(event, d))
                .on('keydown', (event, d) => this.handleBarKeydown(event, d))
                .on('mouseenter', (event, d) => this.showTooltip(event, d))
                .on('mouseleave', () => this.hideTooltip())
                .on('focus', (event, d) => this.handleBarFocus(event, d))
                .on('blur', () => this.hideTooltip())
                .attr('width', d => {
                    const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return Math.max(w, 4); // Minimum 4px width
                }),
            update => update
                .attr('class', d => `gantt-bar${d.status === 'running' ? ' running' : ''}`)
                .attr('aria-label', d => this.getBarAriaLabel(d))
                .attr('x', d => this.xScale(new Date(d.start)))
                .attr('y', (d, i) => {
                    const rowIndex = rows.indexOf(d);
                    return this.yScale(rowIndex) + (this.rowHeight - this.barHeight) / 2;
                })
                .attr('width', d => {
                    const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return Math.max(w, 4);
                })
                .attr('rx', d => {
                    // Circular for unexecuted jobs (manual/skipped) and pending jobs
                    if (this.isUnexecutedJob(d) || this.isPendingJob(d)) {
                        return this.barHeight / 2;
                    }
                    return 2;
                })
                .attr('fill', d => {
                    // Black for canceled jobs
                    if (d.status === 'canceled' || d.status === 'cancelled') {
                        return '#000000';
                    }
                    if (this.isUnexecutedJob(d)) {
                        return '#9e9e9e';  // Grey for unexecuted jobs (manual/skipped)
                    }
                    // Jobs: use runner color if available, otherwise project color
                    if (d.type === 'job') {
                        const runnerName = this.getRunnerName(d);
                        if (runnerName) {
                            const colors = this.getRunnerColor(runnerName);
                            return colors.fill;
                        }
                    }
                    // Pipelines or jobs without runner: use project color
                    const colors = this.getProjectColor(d.projectName);
                    return colors.fill;
                })
                .attr('fill-opacity', d => {
                    // 50% opacity for unexecuted and pending jobs
                    if (this.isUnexecutedJob(d) || this.isPendingJob(d)) {
                        return 0.5;
                    }
                    return 1;
                })
                .attr('stroke', d => this.getJobOutlineColor(d))
                .attr('stroke-opacity', d => this.isUnexecutedJob(d) ? 0.7 : 1)
                .attr('stroke-width', d => {
                    const borderStyle = this.getStatusBorderStyle(d.status);
                    return borderStyle.width;
                })
                .attr('stroke-dasharray', d => {
                    const borderStyle = this.getStatusBorderStyle(d.status);
                    return borderStyle.dasharray;
                })
        );

        // Render text labels on bars
        this.renderBarLabels(rows, barsLayer);
    }

    /**
     * Render text labels on timeline bars
     */
    renderBarLabels(rows, barsLayer) {
        // Filter to match bars being rendered (exclude expanded pipelines)
        const barsToRender = rows.filter(r => {
            if (r.type === 'group') return false;
            if (r.type === 'pipeline' && r.expanded) return false;
            return true;
        });

        const barTexts = barsLayer.selectAll('text.gantt-bar-text')
            .data(barsToRender, (d, i) => `${d.type}-${i}`);

        barTexts.join(
            enter => enter.append('text')
                .attr('class', 'gantt-bar-text')
                .attr('x', d => {
                    const barX = this.xScale(new Date(d.start));
                    return barX + 4;  // Small padding from left edge
                })
                .attr('y', (d, i) => {
                    const rowIndex = rows.indexOf(d);
                    return this.yScale(rowIndex) + this.rowHeight / 2;
                })
                .attr('dy', '0.35em')
                .attr('font-size', '9px')
                .attr('fill', 'white')
                .attr('pointer-events', 'none')  // Don't block clicks on bars
                .style('font-weight', '500')
                .text(d => {
                    const barWidth = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return this.getBarText(d, barWidth);
                })
                .style('display', d => {
                    const barWidth = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return barWidth >= this.minBarWidthForText ? 'block' : 'none';
                }),
            update => update
                .attr('x', d => {
                    const barX = this.xScale(new Date(d.start));
                    return barX + 4;
                })
                .attr('y', (d, i) => {
                    const rowIndex = rows.indexOf(d);
                    return this.yScale(rowIndex) + this.rowHeight / 2;
                })
                .text(d => {
                    const barWidth = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return this.getBarText(d, barWidth);
                })
                .style('display', d => {
                    const barWidth = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return barWidth >= this.minBarWidthForText ? 'block' : 'none';
                })
        );
    }

    /**
     * Render animated diagonal stripes overlay for running jobs
     */
    renderRunningStripes(rows, mode = 'full') {
        const stripesLayer = this.chartGroup.select('.running-stripes-layer');

        // Filter to only running jobs (exclude expanded pipelines, groups, and non-running)
        const runningJobs = rows.filter(r => {
            if (r.type === 'group') return false;
            if (r.type === 'pipeline' && r.expanded) return false;
            return r.status === 'running';
        });

        const stripes = stripesLayer.selectAll('rect.running-stripe')
            .data(runningJobs, (d, i) => `${d.type}-${i}`);

        // Fast path for zoom: only update x-positions and widths
        if (mode === 'zoom') {
            stripes.attr('x', d => this.xScale(new Date(d.start)))
                .attr('width', d => {
                    const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return Math.max(w, 4);
                });
            return;
        }

        // Full rendering path
        stripes.join(
            enter => enter.append('rect')
                .attr('class', 'running-stripe')
                .attr('x', d => this.xScale(new Date(d.start)))
                .attr('y', (d, i) => {
                    const rowIndex = rows.indexOf(d);
                    return this.yScale(rowIndex) + (this.rowHeight - this.barHeight) / 2;
                })
                .attr('width', d => {
                    const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return Math.max(w, 4);
                })
                .attr('height', this.barHeight)
                .attr('rx', d => {
                    // Match bar shape (circular for pending jobs)
                    if (this.isPendingJob(d)) {
                        return this.barHeight / 2;
                    }
                    return 2;
                })
                .attr('fill', 'url(#diagonal-stripes)')
                .attr('pointer-events', 'none'), // Don't block clicks on bars
            update => update
                .attr('x', d => this.xScale(new Date(d.start)))
                .attr('y', (d, i) => {
                    const rowIndex = rows.indexOf(d);
                    return this.yScale(rowIndex) + (this.rowHeight - this.barHeight) / 2;
                })
                .attr('width', d => {
                    const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                    return Math.max(w, 4);
                })
                .attr('rx', d => {
                    if (this.isPendingJob(d)) {
                        return this.barHeight / 2;
                    }
                    return 2;
                })
        );
    }

    /**
     * Get appropriate text for bar label based on available width
     */
    getBarText(d, barWidth) {
        if (barWidth < this.minBarWidthForText) {
            return '';
        }

        // For jobs, show the job name (without stage prefix)
        if (d.type === 'job' && d.job) {
            const fullText = d.job.name;
            // Estimate available characters (rough approximation: 6px per char)
            const availableChars = Math.floor((barWidth - 8) / 6);

            if (fullText.length <= availableChars) {
                return fullText;
            }

            // Truncate with ellipsis
            return fullText.substring(0, Math.max(1, availableChars - 1)) + '…';
        }

        // For pipelines, show pipeline ID
        if (d.type === 'pipeline' && d.pipeline) {
            return `P#${d.pipeline.id}`;
        }

        return '';
    }

    /**
     * Generate accessible label for timeline bar
     */
    getBarAriaLabel(d) {
        const projectLabel = d.projectName ? `Project ${d.projectName}, ` : '';
        if (d.type === 'pipeline' && d.pipeline) {
            return `${projectLabel}Pipeline ${d.pipeline.id}, status: ${d.status}. Press Enter to open in GitLab.`;
        } else if (d.type === 'job' && d.job) {
            return `${projectLabel}Job ${d.job.name}, stage: ${d.job.stage}, status: ${d.status}. Press Enter to open in GitLab.`;
        }
        return 'Timeline item';
    }

    /**
     * Handle keyboard events on bars
     */
    handleBarKeydown(event, d) {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            this.handleBarClick(event, d);
        }
    }

    /**
     * Handle focus on bar (show tooltip)
     */
    handleBarFocus(event, d) {
        // Get bar element position for tooltip placement
        const barElement = event.target;
        const rect = barElement.getBoundingClientRect();

        // Create a synthetic event with page coordinates for tooltip
        const syntheticEvent = {
            pageX: rect.left + rect.width / 2,
            pageY: rect.top - 10
        };

        this.showTooltip(syntheticEvent, d);
    }

    /**
     * Render user avatars next to pipeline and job bars
     */
    renderAvatars(rows) {
        const avatarsLayer = this.chartGroup.select('.avatars-layer');

        // Get all bars that should have avatars (exclude expanded pipelines)
        const barsWithAvatars = rows.filter(r => {
            if (r.type === 'group') return false;
            if (r.type === 'pipeline' && r.expanded) return false;
            return true;
        });

        // Extract avatar data from rows using pure function
        const avatarData = barsWithAvatars.map((row, i) => {
            const rowIndex = rows.indexOf(row);
            const user = this.getUserForRow(row);
            const avatarUrl = user?.avatar_url || null;

            return {
                rowIndex: rowIndex,
                row: row,
                user: user,
                avatarUrl: avatarUrl,
                username: user?.username || 'unknown',
                name: user?.name || user?.username || 'Unknown User'
            };
        });

        // Create avatar groups (one per bar)
        const avatarGroups = avatarsLayer.selectAll('g.avatar-container')
            .data(avatarData, (d, i) => `${d.row.type}-${d.rowIndex}`);

        const merged = avatarGroups.join(
            enter => {
                const g = enter.append('g')
                    .attr('class', 'avatar-container')
                    .attr('transform', d => {
                        const barX = this.xScale(new Date(d.row.start));
                        const barY = this.yScale(d.rowIndex) + (this.rowHeight - this.avatarSize) / 2;
                        return `translate(${barX + this.avatarOffset}, ${barY})`;
                    });

                // Check if avatar URL is available
                g.each((d, i, nodes) => {
                    const group = d3.select(nodes[i]);

                    if (d.avatarUrl) {
                        // Build absolute avatar URL with proper URL API
                        let optimizedUrl;
                        try {
                            optimizedUrl = this.buildAvatarUrl(d.avatarUrl);
                        } catch (error) {
                            console.error(`Failed to construct avatar URL for ${d.name}: ${error.message}`, {
                                avatarUrl: d.avatarUrl,
                                gitlabUrl: this.config.gitlabUrl
                            });
                            // Fall back to initials on URL construction failure
                            const initials = this.getInitials(d.name);
                            this.renderFallbackAvatar(group, initials);

                            // Add border circle for fallback avatars
                            group.append('circle')
                                .attr('class', 'avatar-border')
                                .attr('cx', this.avatarSize / 2)
                                .attr('cy', this.avatarSize / 2)
                                .attr('r', this.avatarSize / 2)
                                .attr('fill', 'none')
                                .attr('stroke', '#dee2e6')
                                .attr('stroke-width', 1);
                            return; // Skip image rendering
                        }

                        // Render avatar image
                        const chart = this;  // Capture chart instance for error handler
                        group.append('image')
                            .attr('class', 'avatar-image')
                            .attr('xlink:href', optimizedUrl)
                            .attr('width', this.avatarSize)
                            .attr('height', this.avatarSize)
                            .attr('clip-path', 'url(#avatar-clip)')
                            .attr('preserveAspectRatio', 'xMidYMid slice')
                            .on('error', function(event) {
                                console.error(`Avatar image failed to load: ${optimizedUrl}`, event);
                                // Fallback: replace with initials circle if image fails to load
                                const imageElement = this;
                                d3.select(imageElement).remove();
                                const parent = d3.select(imageElement.parentNode);
                                const initials = chart.getInitials(d.name);
                                chart.renderFallbackAvatar(parent, initials);
                            });

                        // Add border circle
                        group.append('circle')
                            .attr('class', 'avatar-border')
                            .attr('cx', this.avatarSize / 2)
                            .attr('cy', this.avatarSize / 2)
                            .attr('r', this.avatarSize / 2)
                            .attr('fill', 'none')
                            .attr('stroke', '#dee2e6')
                            .attr('stroke-width', 1);
                    } else {
                        // No avatar URL or relative URL (won't load from localhost): render fallback (initials)
                        const initials = this.getInitials(d.name);
                        this.renderFallbackAvatar(group, initials);

                        // Add border circle for fallback avatars
                        group.append('circle')
                            .attr('class', 'avatar-border')
                            .attr('cx', this.avatarSize / 2)
                            .attr('cy', this.avatarSize / 2)
                            .attr('r', this.avatarSize / 2)
                            .attr('fill', 'none')
                            .attr('stroke', '#dee2e6')
                            .attr('stroke-width', 1);
                    }
                });

                return g;
            },
            update => update
                .attr('transform', d => {
                    const barX = this.xScale(new Date(d.row.start));
                    const barY = this.yScale(d.rowIndex) + (this.rowHeight - this.avatarSize) / 2;
                    return `translate(${barX + this.avatarOffset}, ${barY})`;
                })
        );

        // Add/update tooltips on merged selection (both enter and update)
        merged.each(function(d) {
            const group = d3.select(this);

            // Remove existing title if present
            group.select('title').remove();

            // Add fresh tooltip with username
            const tooltipText = d.username && d.name
                ? `${d.name} (@${d.username})`
                : d.name || d.username || 'Unknown';

            group.append('title')
                .text(tooltipText);
        });
    }

    /**
     * Build absolute avatar URL with proper URL API
     *
     * Handles:
     * - Relative URLs (starting with /) by prepending gitlabUrl
     * - Protocol-relative URLs (//)
     * - Absolute URLs (pass through)
     * - Query parameter optimization (width)
     *
     * Fails fast with clear error if:
     * - Relative URL provided but gitlabUrl not configured
     * - Invalid URL format
     *
     * @param {string} avatarUrl - Avatar URL from GitLab API
     * @returns {string} Absolute optimized avatar URL
     * @throws {Error} If URL cannot be constructed
     */
    buildAvatarUrl(avatarUrl) {
        if (!avatarUrl || typeof avatarUrl !== 'string') {
            throw new Error('Avatar URL must be a non-empty string');
        }

        let absoluteUrl;

        // Handle relative URLs (starting with /)
        if (avatarUrl.startsWith('/') && !avatarUrl.startsWith('//')) {
            // Validate gitlabUrl is configured
            if (!this.config.gitlabUrl) {
                throw new Error('Relative avatar URL provided but config.gitlabUrl is not set');
            }

            // Validate gitlabUrl format
            let baseUrl;
            try {
                baseUrl = new URL(this.config.gitlabUrl);
            } catch (error) {
                throw new Error(`Invalid config.gitlabUrl: ${error.message}`);
            }

            // Construct absolute URL properly (URL constructor handles path joining)
            try {
                absoluteUrl = new URL(avatarUrl, baseUrl);
            } catch (error) {
                throw new Error(`Failed to construct absolute URL: ${error.message}`);
            }
        } else {
            // Absolute or protocol-relative URL - parse directly
            try {
                // Protocol-relative URLs need protocol prepended
                if (avatarUrl.startsWith('//')) {
                    absoluteUrl = new URL('https:' + avatarUrl);
                } else {
                    absoluteUrl = new URL(avatarUrl);
                }
            } catch (error) {
                throw new Error(`Invalid avatar URL format: ${error.message}`);
            }
        }

        // Add or update width parameter for optimization using URLSearchParams
        const targetWidth = this.avatarSize * 2; // 2x for retina displays
        absoluteUrl.searchParams.set('width', targetWidth.toString());

        return absoluteUrl.toString();
    }

    /**
     * Get initials from name (for avatar fallback)
     */
    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(/\s+/);
        if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }

    /**
     * Render fallback avatar (colored circle with initials)
     */
    renderFallbackAvatar(group, initials) {
        // Generate consistent color from initials
        let hash = 0;
        for (let i = 0; i < initials.length; i++) {
            hash = initials.charCodeAt(i) + ((hash << 5) - hash);
        }
        const hue = Math.abs(hash % 360);

        // Background circle
        group.append('circle')
            .attr('class', 'avatar-fallback-bg')
            .attr('cx', this.avatarSize / 2)
            .attr('cy', this.avatarSize / 2)
            .attr('r', this.avatarSize / 2)
            .attr('fill', `hsl(${hue}, 55%, 60%)`);

        // Initials text
        group.append('text')
            .attr('class', 'avatar-fallback-text')
            .attr('x', this.avatarSize / 2)
            .attr('y', this.avatarSize / 2)
            .attr('dy', '0.35em')
            .attr('text-anchor', 'middle')
            .attr('font-size', `${Math.floor(this.avatarSize * 0.5)}px`)
            .attr('font-weight', '600')
            .attr('fill', 'white')
            .text(initials);

        // Border circle
        group.append('circle')
            .attr('class', 'avatar-border')
            .attr('cx', this.avatarSize / 2)
            .attr('cy', this.avatarSize / 2)
            .attr('r', this.avatarSize / 2)
            .attr('fill', 'none')
            .attr('stroke', '#dee2e6')
            .attr('stroke-width', 1);
    }

    /**
     * Render current time indicator
     */
    renderCurrentTime(height) {
        const currentTimeLayer = this.chartGroup.select('.current-time-layer');
        currentTimeLayer.selectAll('*').remove();

        const now = new Date();

        // Only show if within time range
        if (now >= this.xScale.domain()[0] && now <= this.xScale.domain()[1]) {
            currentTimeLayer.append('line')
                .attr('class', 'gantt-current-time')
                .attr('x1', this.xScale(now))
                .attr('x2', this.xScale(now))
                .attr('y1', 0)
                .attr('y2', height);
        }
    }

    /**
     * Render time axis
     */
    renderAxis(width) {
        const axisLayer = this.chartGroup.select('.axis-layer');
        axisLayer.selectAll('*').remove();

        // Top axis - compressed for density
        const xAxisTop = d3.axisTop(this.xScale)
            .ticks(10)
            .tickFormat(d3.timeFormat('%b %d %H:%M'));

        axisLayer.append('g')
            .attr('class', 'gantt-axis')
            .attr('transform', `translate(0, -6)`)
            .call(xAxisTop);

        // Major time labels (dates) - compressed spacing
        const xAxisDays = d3.axisTop(this.xScale)
            .ticks(d3.timeDay.every(1))
            .tickFormat(d3.timeFormat('%a %b %d'));

        axisLayer.append('g')
            .attr('class', 'gantt-axis')
            .attr('transform', `translate(0, -20)`)
            .call(xAxisDays)
            .selectAll('text')
            .style('font-weight', 'bold');
    }

    /**
     * Get or create canvas context for fast text measurement
     */
    getTextMeasureContext() {
        if (!this.canvasContext) {
            const canvas = document.createElement('canvas');
            this.canvasContext = canvas.getContext('2d');
            // Match the font used in CSS for .gantt-label
            this.canvasContext.font = '11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
        }
        return this.canvasContext;
    }

    /**
     * Measure text width using cached canvas context (much faster than DOM)
     */
    measureTextWidth(text) {
        const cacheKey = text;
        if (this.textMeasureCache.has(cacheKey)) {
            return this.textMeasureCache.get(cacheKey);
        }

        const ctx = this.getTextMeasureContext();
        const width = ctx.measureText(text).width;
        this.textMeasureCache.set(cacheKey, width);
        return width;
    }

    /**
     * Truncate text to fit within maxWidth (using fast canvas measurement)
     */
    truncateText(text, maxWidth) {
        let textContent = text;
        while (this.measureTextWidth(textContent) > maxWidth && textContent.length > 0) {
            textContent = textContent.slice(0, -1);
        }
        return textContent.length < text.length ? textContent + '...' : textContent;
    }

    /**
     * Render row labels (projects, pipelines, jobs)
     */
    renderLabels(rows) {
        const labelsLayer = this.svg.select('.labels-layer');

        const labels = labelsLayer.selectAll('g')
            .data(rows, (d, i) => `${d.type}-${i}`);

        // Enter + Update
        labels.join(
            enter => {
                const g = enter.append('g')
                    .attr('transform', (d, i) => `translate(0, ${this.yScale(i)})`);

                // Background rect for click area
                g.append('rect')
                    .attr('width', this.margin.left)
                    .attr('height', this.rowHeight)
                    .attr('fill', 'transparent')
                    .style('cursor', d => d.type === 'pipeline' ? 'pointer' : 'default')
                    .on('click', (event, d) => {
                        if (d.type === 'pipeline') {
                            this.togglePipeline(d.pipeline.id);
                        }
                    });

                // Expand/collapse icon for pipelines
                g.filter(d => d.type === 'pipeline')
                    .append('text')
                    .attr('class', 'gantt-expand-icon')
                    .attr('tabindex', '0')
                    .attr('role', 'button')
                    .attr('aria-label', d => `${d.expanded ? 'Collapse' : 'Expand'} pipeline ${d.pipeline.id}`)
                    .attr('aria-expanded', d => d.expanded ? 'true' : 'false')
                    .attr('x', d => d.level * this.indentWidth)
                    .attr('y', this.rowHeight / 2)
                    .attr('dy', '0.35em')
                    .attr('font-size', '11px')
                    .text(d => d.expanded ? '▼' : '▶')
                    .on('click', (event, d) => {
                        event.stopPropagation();
                        this.togglePipeline(d.pipeline.id);
                    })
                    .on('keydown', (event, d) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault();
                            event.stopPropagation();
                            this.togglePipeline(d.pipeline.id);
                        }
                    });

                // Label text - show project name for pipelines, job info for jobs
                g.append('text')
                    .attr('class', 'gantt-label')
                    .attr('x', d => d.level * this.indentWidth + (d.type === 'pipeline' ? 15 : this.labelPadding))
                    .attr('y', this.rowHeight / 2)
                    .attr('dy', '0.35em')
                    .text(d => {
                        if (d.type === 'pipeline') {
                            // Show project name for pipelines
                            const maxWidth = 70;
                            return this.truncateText(d.projectName || `P#${d.pipeline.id}`, maxWidth);
                        } else {
                            // Show job info for jobs
                            const maxWidth = 70;
                            return this.truncateText(d.label, maxWidth);
                        }
                    });

                return g;
            },
            update => update
                .attr('transform', (d, i) => `translate(0, ${this.yScale(i)})`)
                .call(update => {
                    update.select('.gantt-expand-icon')
                        .attr('aria-label', d => `${d.expanded ? 'Collapse' : 'Expand'} pipeline ${d.pipeline.id}`)
                        .attr('aria-expanded', d => d.expanded ? 'true' : 'false')
                        .text(d => d.expanded ? '▼' : '▶');

                    // Update labels
                    update.select('.gantt-label')
                        .text(d => {
                            if (d.type === 'pipeline') {
                                // Show project name for pipelines
                                const maxWidth = 70;
                                return this.truncateText(d.projectName || `P#${d.pipeline.id}`, maxWidth);
                            } else {
                                // Show job info for jobs
                                const maxWidth = 70;
                                return this.truncateText(d.label, maxWidth);
                            }
                        });
                })
        );
    }

    /**
     * Expand a pipeline (only if not already expanded)
     */
    expandPipeline(pipelineId) {
        if (!this.expandedPipelines.has(pipelineId)) {
            this.expandedPipelines.add(pipelineId);
            this.cachedRows = null;
            this.render(this.data, this.contentionPeriods);
        }
    }

    /**
     * Toggle pipeline expand/collapse
     */
    togglePipeline(pipelineId) {
        const wasExpanded = this.expandedPipelines.has(pipelineId);

        if (wasExpanded) {
            this.expandedPipelines.delete(pipelineId);
        } else {
            this.expandedPipelines.add(pipelineId);
        }

        // Announce to screen readers
        this.announceAction(
            wasExpanded
                ? `Pipeline ${pipelineId} collapsed`
                : `Pipeline ${pipelineId} expanded`
        );

        // Invalidate cache before re-render (structure changed)
        this.cachedRows = null;

        // Re-render with new state
        this.render(this.data, this.contentionPeriods);
    }

    /**
     * Announce action to screen readers
     */
    announceAction(message) {
        const announcer = document.getElementById('sr-action-announcer');
        if (announcer) {
            announcer.textContent = '';
            setTimeout(() => {
                announcer.textContent = message;
            }, 100);
        }
    }

    /**
     * Handle bar click (open GitLab page)
     */
    handleBarClick(event, d) {
        let url = null;

        if (d.type === 'job' && d.job) {
            // Use project path if available, otherwise fall back to numeric ID
            const projectIdentifier = d.projectPath || d.projectId;
            console.log(`Opening job ${d.job.id}, projectPath: ${d.projectPath}, projectId: ${d.projectId}, using: ${projectIdentifier}`);
            url = `${this.config.gitlabUrl}/${projectIdentifier}/-/jobs/${d.job.id}`;
        } else if (d.type === 'pipeline' && d.pipeline) {
            // Use project path if available, otherwise fall back to numeric ID
            const projectIdentifier = d.projectPath || d.projectId;
            console.log(`Opening pipeline ${d.pipeline.id}, projectPath: ${d.projectPath}, projectId: ${d.projectId}, using: ${projectIdentifier}`);
            url = `${this.config.gitlabUrl}/${projectIdentifier}/-/pipelines/${d.pipeline.id}`;
        }

        if (url) {
            console.log(`Final URL: ${url}`);
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * Show tooltip on hover
     */
    showTooltip(event, d) {
        let tooltipText = '';

        if (d.type === 'pipeline' && d.pipeline) {
            tooltipText = this.formatPipelineTooltip(d.pipeline, d.projectName);
        } else if (d.type === 'job' && d.job) {
            tooltipText = this.formatJobTooltip(d.job, d.projectName);
        }

        // Set content and make visible to measure dimensions
        this.tooltip
            .style('display', 'block')
            .html(tooltipText);

        // Get tooltip dimensions for proper positioning
        const tooltipNode = this.tooltip.node();
        const tooltipWidth = tooltipNode.offsetWidth;
        const tooltipHeight = tooltipNode.offsetHeight;

        // Position tooltip on the left side of cursor
        // Default: 10px to the left of cursor
        let left = event.pageX - tooltipWidth - 10;
        let top = event.pageY - 10;

        // Handle edge case: if tooltip would go off-screen on the left
        // Fall back to right side positioning
        const minLeftMargin = 5; // Minimum distance from left edge
        if (left < minLeftMargin) {
            left = event.pageX + 10; // Position on right side instead
        }

        // Handle vertical edge case: prevent tooltip from going off bottom of screen
        const windowHeight = window.innerHeight;
        if (top + tooltipHeight > windowHeight) {
            top = windowHeight - tooltipHeight - 5;
        }

        // Handle vertical edge case: prevent tooltip from going off top of screen
        if (top < 5) {
            top = 5;
        }

        this.tooltip
            .style('left', left + 'px')
            .style('top', top + 'px');
    }

    /**
     * Hide tooltip
     */
    hideTooltip() {
        this.tooltip.style('display', 'none');
    }

    /**
     * Format pipeline tooltip
     */
    formatPipelineTooltip(pipeline, projectName) {
        const parts = [];
        if (projectName) {
            parts.push(`Project: ${projectName}`);
        }
        parts.push(`Pipeline #${pipeline.id}`);
        parts.push(`Status: ${pipeline.status}`);

        if (pipeline.startedAt) {
            parts.push(`Started: ${this.formatRelativeTime(pipeline.startedAt)}`);
        } else {
            parts.push(`Created: ${this.formatRelativeTime(pipeline.createdAt)}`);
        }

        if (pipeline.duration) {
            parts.push(`Duration: ${this.formatDuration(pipeline.duration)}`);
        }

        return parts.join('\n');
    }

    /**
     * Format job tooltip
     */
    formatJobTooltip(job, projectName) {
        const parts = [];
        if (projectName) {
            parts.push(`Project: ${projectName}`);
        }
        parts.push(`Job: ${job.name}`);
        parts.push(`Stage: ${job.stage}`);
        parts.push(`Status: ${job.status}`);

        // Add note for manual jobs
        if (job.status === 'manual') {
            parts.push(`⚠ Requires manual trigger`);
        }

        // Add note for skipped jobs
        if (job.status === 'skipped') {
            parts.push(`⊘ Skipped (conditions not met)`);
        }

        // Add runner information if available
        if (job.runner) {
            let runnerLabel = '';

            if (job.runner.description) {
                // Take substring up to first space, remove trailing punctuation
                const firstWord = job.runner.description.split(' ')[0];
                runnerLabel = firstWord.replace(/[,;:.!?]+$/, '');
            } else if (job.runner.name) {
                // Take substring up to first space, remove trailing punctuation
                const firstWord = job.runner.name.split(' ')[0];
                runnerLabel = firstWord.replace(/[,;:.!?]+$/, '');
            }

            if (runnerLabel) {
                parts.push(`Runner: ${runnerLabel}`);
            }

            // Add runner ID for reference
            if (job.runner.id) {
                parts.push(`Runner ID: ${job.runner.id}`);
            }
        }

        if (job.startedAt) {
            parts.push(`Started: ${this.formatRelativeTime(job.startedAt)}`);
        } else {
            parts.push(`Created: ${this.formatRelativeTime(job.createdAt)}`);
        }

        if (job.duration) {
            parts.push(`Duration: ${this.formatDuration(job.duration)}`);
        }

        return parts.join('\n');
    }

    /**
     * Format relative time (e.g., "2 hours ago")
     */
    formatRelativeTime(date) {
        const now = new Date();
        const diffMs = now - new Date(date);
        const diffSec = Math.floor(diffMs / 1000);
        const diffMin = Math.floor(diffSec / 60);
        const diffHour = Math.floor(diffMin / 60);
        const diffDay = Math.floor(diffHour / 24);

        if (diffSec < 60) {
            return 'just now';
        } else if (diffMin < 60) {
            return `${diffMin} minute${diffMin !== 1 ? 's' : ''} ago`;
        } else if (diffHour < 24) {
            return `${diffHour} hour${diffHour !== 1 ? 's' : ''} ago`;
        } else if (diffDay < 7) {
            return `${diffDay} day${diffDay !== 1 ? 's' : ''} ago`;
        } else {
            const diffWeek = Math.floor(diffDay / 7);
            return `${diffWeek} week${diffWeek !== 1 ? 's' : ''} ago`;
        }
    }

    /**
     * Format duration in human-readable format
     */
    formatDuration(seconds) {
        if (!seconds || seconds < 0) return 'N/A';

        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = Math.floor(seconds % 60);

        if (hours > 0) {
            return `${hours}h ${minutes}m ${secs}s`;
        } else if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        } else {
            return `${secs}s`;
        }
    }
}

// Export to window for use in index.html
window.D3GanttChart = D3GanttChart;
