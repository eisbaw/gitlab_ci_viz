/**
 * D3.js GANTT Chart Implementation
 *
 * Renders hierarchical GitLab CI pipeline data as an interactive GANTT timeline.
 * Replaces vis.js with pure d3.js for better performance and control.
 *
 * Features:
 * - Hierarchical grouping (Projects → Pipelines → Jobs)
 * - Collapsible pipeline groups
 * - Status-based color coding
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
        this.rowHeight = 18;
        this.barHeight = 14;
        this.labelPadding = 6;
        this.indentWidth = 15;

        // State
        this.expandedPipelines = new Set();
        this.data = [];
        this.contentionPeriods = [];

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
        this.chartGroup.append('g').attr('class', 'bars-layer');
        this.chartGroup.append('g').attr('class', 'current-time-layer');
        this.chartGroup.append('g').attr('class', 'axis-layer');
        this.svg.append('g').attr('class', 'labels-layer')
            .attr('transform', `translate(0,${this.margin.top})`);
    }

    /**
     * Render GANTT chart with given data
     * @param {Array} domainModel - Array of User/Project objects with pipelines
     * @param {Array} contentionPeriods - Resource contention periods
     */
    render(domainModel, contentionPeriods = []) {
        console.log('D3 GANTT: Rendering with', domainModel.length, 'groups');

        this.data = domainModel;
        this.contentionPeriods = contentionPeriods;

        // Transform data to flat row structure
        const rows = this.transformToRows(domainModel);
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
        this.renderBars(rows);
        this.renderCurrentTime(height);
        this.renderAxis(width);
        this.renderLabels(rows);
    }

    /**
     * Transform domain model to flat row structure for rendering
     */
    transformToRows(domainModel) {
        const rows = [];

        for (const project of domainModel) {
            // Project group row
            rows.push({
                type: 'group',
                level: 0,
                label: project.getDisplayName(),
                expanded: true,
                projectId: project.id
            });

            // Pipeline rows
            for (const pipeline of project.pipelines) {
                const pipelineExpanded = this.expandedPipelines.has(pipeline.id);

                // Pipeline bar row
                rows.push({
                    type: 'pipeline',
                    level: 1,
                    label: `P#${pipeline.id}`,
                    start: pipeline.getStartTime(),
                    end: pipeline.getEndTime(),
                    status: pipeline.status,
                    expanded: pipelineExpanded,
                    pipeline: pipeline,
                    projectId: pipeline.projectId
                });

                // Job rows (if pipeline expanded)
                if (pipelineExpanded) {
                    for (const job of pipeline.jobs) {
                        rows.push({
                            type: 'job',
                            level: 2,
                            label: `${job.stage}: ${job.name}`,
                            start: job.getStartTime(),
                            end: job.getEndTime(),
                            status: job.status,
                            job: job,
                            pipelineId: pipeline.id,
                            projectId: pipeline.projectId
                        });
                    }
                }
            }
        }

        return rows;
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
            // Re-render affected layers
            this.renderGrid(this.getChartWidth(), this.getChartHeight());
            this.renderContention(this.getChartWidth());
            this.renderBars(this.transformToRows(this.data));
            this.renderCurrentTime(this.getChartHeight());
            this.renderAxis(this.getChartWidth());
            this.zoomRafId = null;
        });

        // Sync zoom state to URL (debounced)
        this.syncZoomToURL();
    }

    /**
     * Sync zoom/pan state to URL (if URLStateManager available)
     */
    syncZoomToURL() {
        if (typeof URLStateManager !== 'undefined' && typeof FilterState !== 'undefined' && typeof JobSearchState !== 'undefined') {
            URLStateManager.debouncedSave({
                filters: FilterState.active,
                jobSearch: JobSearchState.searchTerm,
                zoom: this.currentTransform.k,
                panX: this.currentTransform.x,
                panY: this.currentTransform.y
            }, 1000); // Longer delay for zoom to avoid excessive updates
        }
    }

    /**
     * Apply zoom/pan transform from saved state
     */
    applyZoomFromState(zoom, panX, panY) {
        if (zoom !== null && panX !== null && panY !== null && this.zoom && this.svg) {
            const transform = d3.zoomIdentity
                .translate(panX, panY)
                .scale(zoom);
            this.svg.call(this.zoom.transform, transform);
            console.log(`Applied zoom from URL: scale=${zoom.toFixed(2)}, pan=(${panX.toFixed(0)}, ${panY.toFixed(0)})`);
        }
    }

    /**
     * Reset zoom to default view (instant for better performance)
     */
    resetZoom() {
        this.svg.call(this.zoom.transform, d3.zoomIdentity);
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
     * Render timeline bars (pipelines and jobs)
     */
    renderBars(rows) {
        const barsLayer = this.chartGroup.select('.bars-layer');

        const bars = barsLayer.selectAll('rect')
            .data(rows.filter(r => r.type !== 'group'), (d, i) => `${d.type}-${i}`);

        // Enter + Update
        bars.join(
            enter => enter.append('rect')
                .attr('class', d => `gantt-bar ${d.type}-${d.status}`)
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
                .attr('rx', 3)
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
        );
    }

    /**
     * Generate accessible label for timeline bar
     */
    getBarAriaLabel(d) {
        if (d.type === 'pipeline' && d.pipeline) {
            return `Pipeline ${d.pipeline.id}, status: ${d.status}. Press Enter to open in GitLab.`;
        } else if (d.type === 'job' && d.job) {
            return `Job ${d.job.name}, stage: ${d.job.stage}, status: ${d.status}. Press Enter to open in GitLab.`;
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

                // Label text - using cached measurements for performance
                g.append('text')
                    .attr('class', d => d.type === 'group' ? 'gantt-label gantt-group-label' : 'gantt-label')
                    .attr('x', d => d.level * this.indentWidth + (d.type === 'pipeline' ? 15 : this.labelPadding))
                    .attr('y', this.rowHeight / 2)
                    .attr('dy', '0.35em')
                    .text(d => {
                        const maxWidth = 70 - (d.level * 10);
                        return this.truncateText(d.label, maxWidth);
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

                    update.select('.gantt-label')
                        .text(d => {
                            const maxWidth = 70 - (d.level * 10);
                            return this.truncateText(d.label, maxWidth);
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
            url = `${this.config.gitlabUrl}/${d.projectId}/-/jobs/${d.job.id}`;
            console.log(`Opening job ${d.job.id}`);
        } else if (d.type === 'pipeline' && d.pipeline) {
            url = `${this.config.gitlabUrl}/${d.projectId}/-/pipelines/${d.pipeline.id}`;
            console.log(`Opening pipeline ${d.pipeline.id}`);
        }

        if (url) {
            window.open(url, '_blank', 'noopener,noreferrer');
        }
    }

    /**
     * Show tooltip on hover
     */
    showTooltip(event, d) {
        let tooltipText = '';

        if (d.type === 'pipeline' && d.pipeline) {
            tooltipText = this.formatPipelineTooltip(d.pipeline);
        } else if (d.type === 'job' && d.job) {
            tooltipText = this.formatJobTooltip(d.job);
        }

        this.tooltip
            .style('display', 'block')
            .html(tooltipText)
            .style('left', (event.pageX + 10) + 'px')
            .style('top', (event.pageY - 10) + 'px');
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
    formatPipelineTooltip(pipeline) {
        const parts = [];
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
    formatJobTooltip(job) {
        const parts = [];
        parts.push(`Job: ${job.name}`);
        parts.push(`Stage: ${job.stage}`);
        parts.push(`Status: ${job.status}`);

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
