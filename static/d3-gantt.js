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

        // Add title and description for screen readers
        this.svg.append('title')
            .text('GitLab CI Pipeline Timeline');

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
        this.chartGroup.append('g').attr('class', 'bars-layer');
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

        // Apply current zoom transform to scale
        this.xScale = this.currentTransform.rescaleX(this.baseXScale);

        this.yScale = d3.scaleBand()
            .domain(rows.map((r, i) => i))
            .range([0, height])
            .padding(0.05);

        // Initialize zoom behavior (only once)
        if (!this.zoom) {
            this.initializeZoom(width, height);
        }

        // Render layers
        this.renderGrid(width, height);
        this.renderContention(width);
        this.renderPipelineBackgrounds(rows);
        this.renderBars(rows);
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
        // Create zoom behavior
        this.zoom = d3.zoom()
            .scaleExtent([0.5, 20]) // Allow 2x zoom out to 20x zoom in
            .translateExtent([[0, 0], [width, height]]) // Limit panning to chart bounds
            .on('zoom', (event) => this.handleZoom(event));

        // Apply zoom to chart group
        this.svg.call(this.zoom);

        // Prevent default scrolling on the visualization container
        this.svg.on('wheel.zoom', (event) => {
            event.preventDefault();
        });
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
            // Use zoom mode for minimal DOM updates (only x-positions and widths)
            this.renderBars(rows, 'zoom');
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
     * Render resource contention background
     */
    renderContention(width) {
        const contentionLayer = this.chartGroup.select('.contention-layer');
        contentionLayer.selectAll('*').remove();

        if (!this.contentionPeriods || this.contentionPeriods.length === 0) {
            return;
        }

        // Get SVG height for full-height background
        const svgHeight = parseFloat(this.svg.attr('height')) - this.margin.top - this.margin.bottom;

        contentionLayer.selectAll('rect')
            .data(this.contentionPeriods)
            .join('rect')
            .attr('class', d => `contention-${d.level}`)
            .attr('x', d => this.xScale(new Date(d.start)))
            .attr('y', 0)
            .attr('width', d => {
                const w = this.xScale(new Date(d.end)) - this.xScale(new Date(d.start));
                return Math.max(w, 2); // Minimum 2px width
            })
            .attr('height', svgHeight);
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
                    .attr('text-anchor', 'end')
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
                    .attr('text-anchor', 'end')
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
                    .attr('text-anchor', 'end')
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
            const boxWidth = this.xScale(d.maxTime) - this.xScale(d.minTime);
            const x = this.xScale(d.minTime) + boxWidth - 10; // 10px padding from right edge
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

        // Extract avatar data from rows
        const avatarData = barsWithAvatars.map((row, i) => {
            const rowIndex = rows.indexOf(row);
            let user = null;

            if (row.type === 'pipeline' && row.pipeline) {
                // Use triggeringUser (actual GitLab user) instead of group (which may be project)
                user = row.pipeline.triggeringUser || row.pipeline.group;
            } else if (row.type === 'job' && row.job) {
                // Jobs may have their own user field (who triggered the manual job)
                // Fall back to pipeline's triggering user if not available
                user = row.job.user || (row.pipeline ? row.pipeline.triggeringUser : null) || (row.pipeline ? row.pipeline.group : null);
            }

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

        avatarGroups.join(
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
                        // Add width parameter to optimize image size
                        const optimizedUrl = d.avatarUrl.includes('?')
                            ? `${d.avatarUrl}&width=${this.avatarSize * 2}`
                            : `${d.avatarUrl}?width=${this.avatarSize * 2}`;

                        // Render avatar image
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
                                d3.select(this).remove();
                                const parent = d3.select(this.parentNode);
                                const initials = this.getInitials(d.name);
                                this.renderFallbackAvatar(parent, initials);
                            }.bind(this));

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
                        // No avatar URL: render fallback (initials)
                        const initials = this.getInitials(d.name);
                        this.renderFallbackAvatar(group, initials);
                    }
                });

                // Add tooltip
                g.append('title')
                    .text(d => d.name || d.username);

                return g;
            },
            update => update
                .attr('transform', d => {
                    const barX = this.xScale(new Date(d.row.start));
                    const barY = this.yScale(d.rowIndex) + (this.rowHeight - this.avatarSize) / 2;
                    return `translate(${barX + this.avatarOffset}, ${barY})`;
                })
        );
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
