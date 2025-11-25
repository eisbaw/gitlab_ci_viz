/**
 * Contention Analyzer Module
 *
 * Analyzes pipeline timeline data to identify resource contention periods
 * where multiple pipelines are running concurrently.
 *
 * Used for US-2: Help DevOps engineers identify runner capacity bottlenecks
 */

/**
 * @typedef {Object} ContentionPeriod
 * @property {Date} start - Start time of contention period
 * @property {Date} end - End time of contention period
 * @property {number} count - Number of concurrent pipelines
 * @property {string} level - Contention level: 'low', 'medium', 'high', 'critical'
 */

/**
 * @typedef {Object} VisBackgroundItem
 * @property {string} id - Unique identifier for timeline item
 * @property {Date} start - Start time of background item
 * @property {Date} end - End time of background item
 * @property {string} type - Item type (always 'background')
 * @property {string} className - CSS class name for styling
 * @property {string} title - Tooltip text
 */

const ContentionAnalyzer = (function() {
    'use strict';

    /**
     * Calculate contention periods from pipeline data
     *
     * @param {Array<Pipeline>} pipelines - Array of Pipeline domain objects
     * @returns {ContentionPeriod[]} Array of contention period objects
     */
    function calculateContentionPeriods(pipelines) {
        if (!pipelines || pipelines.length === 0) {
            return [];
        }

        // Create event timeline: each pipeline start/end creates events
        const events = [];

        pipelines.forEach(pipeline => {
            const start = pipeline.getStartTime();
            const end = pipeline.getEndTime();

            if (!start || !end) {
                // Skip pipelines with invalid timestamps (fail-fast with verbose logging)
                console.warn(
                    `ContentionAnalyzer: Skipping pipeline ${pipeline.id} - ` +
                    `missing timestamps (start=${start}, end=${end})`
                );
                return;
            }

            const startTime = new Date(start).getTime();
            const endTime = new Date(end).getTime();

            if (isNaN(startTime) || isNaN(endTime)) {
                // Skip invalid timestamps (fail-fast with verbose logging)
                console.warn(
                    `ContentionAnalyzer: Skipping pipeline ${pipeline.id} - ` +
                    `invalid timestamps (start=${start}, end=${end})`
                );
                return;
            }

            // Add start event (+1 concurrent pipeline)
            events.push({
                time: startTime,
                delta: 1,
                pipelineId: pipeline.id
            });

            // Add end event (-1 concurrent pipeline)
            events.push({
                time: endTime,
                delta: -1,
                pipelineId: pipeline.id
            });
        });

        // Sort events by time (stable sort to preserve insertion order for same time)
        events.sort((a, b) => {
            if (a.time !== b.time) {
                return a.time - b.time;
            }
            // Process end events before start events at same time
            // This prevents creating zero-width contention periods
            return a.delta - b.delta;
        });

        // Calculate contention periods by sweeping through events
        const contentionPeriods = [];
        let currentConcurrent = 0;
        let periodStart = null;

        events.forEach((event, index) => {
            const prevConcurrent = currentConcurrent;
            currentConcurrent += event.delta;

            // Start new period when concurrency changes
            if (prevConcurrent !== currentConcurrent) {
                // Close previous period if it had contention (≥2 concurrent)
                if (periodStart !== null && prevConcurrent >= 2) {
                    contentionPeriods.push({
                        start: new Date(periodStart),
                        end: new Date(event.time),
                        count: prevConcurrent,
                        level: getContentionLevel(prevConcurrent)
                    });
                }

                // Start new period if new concurrency is ≥2
                if (currentConcurrent >= 2) {
                    periodStart = event.time;
                } else {
                    periodStart = null;
                }
            }
        });

        // Merge adjacent periods with same contention level
        // This reduces visual clutter while preserving contention information
        return mergeAdjacentPeriods(contentionPeriods);
    }

    /**
     * Categorize contention level based on concurrent pipeline count
     *
     * Thresholds based on typical shared runner pool capacity:
     * - low (2-3): Minimal pressure, occasional overlap
     * - medium (4): Moderate pressure, may see queuing
     * - high (5-7): High pressure, significant queuing likely
     * - critical (8+): Severe pressure, major capacity bottleneck
     *
     * Note: These thresholds assume ~10 shared runners. Organizations with
     * different runner capacity may experience different pressure levels.
     *
     * @param {number} count - Number of concurrent pipelines
     * @returns {string} Contention level: 'low', 'medium', 'high', 'critical'
     */
    function getContentionLevel(count) {
        if (count >= 8) return 'critical';
        if (count >= 5) return 'high';
        if (count >= 4) return 'medium';
        return 'low';  // 2-3 concurrent
    }

    /**
     * Merge adjacent contention periods with same level
     * Reduces visual clutter while preserving important information
     *
     * Performance: O(n) where n = number of periods (typically < 100)
     * Expected scale: Handles up to 10,000 periods without noticeable delay
     *
     * @param {Array} periods - Array of contention period objects
     * @returns {Array} Merged array of contention periods (immutable - creates new objects)
     */
    function mergeAdjacentPeriods(periods) {
        if (periods.length === 0) {
            return [];
        }

        const MERGE_GAP_THRESHOLD_MS = 1000; // Adjacent if within 1 second
        const merged = [];
        let current = periods[0];

        for (let i = 1; i < periods.length; i++) {
            const next = periods[i];

            // Check if periods are adjacent and have same level
            const gap = next.start.getTime() - current.end.getTime();
            const isAdjacent = gap <= MERGE_GAP_THRESHOLD_MS;
            const sameLevel = current.level === next.level;

            if (isAdjacent && sameLevel) {
                // Merge periods: create new merged period (immutable)
                current = {
                    start: current.start,
                    end: next.end,
                    count: Math.max(current.count, next.count),
                    level: current.level
                };
            } else {
                // Not mergeable: save current and start new
                merged.push(current);
                current = next;
            }
        }

        // Add last period
        merged.push(current);

        return merged;
    }

    /**
     * Convert contention periods to background items for timeline
     *
     * @param {ContentionPeriod[]} contentionPeriods - Array from calculateContentionPeriods()
     * @returns {VisBackgroundItem[]} Array of background item objects for timeline
     */
    function toVisBackgroundItems(contentionPeriods) {
        return contentionPeriods.map((period, index) => {
            return {
                id: `contention-${index}`,
                start: period.start,
                end: period.end,
                type: 'background',
                className: `contention-${period.level}`,
                title: `${period.count} concurrent pipelines\nRunner pressure: ${period.level}`
            };
        });
    }

    // Public API
    return {
        calculateContentionPeriods,
        toVisBackgroundItems,
        getContentionLevel
    };
})();

// Export to global scope for Node.js testing
if (typeof global !== 'undefined' && typeof window === 'undefined') {
    global.ContentionAnalyzer = ContentionAnalyzer;
}
