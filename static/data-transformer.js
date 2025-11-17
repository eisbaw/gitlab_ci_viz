/**
 * Data Transformer Module
 *
 * Transforms GitLab API responses into domain model and vis.js Timeline format.
 * Implements grouping organization (by project or user) with proper hierarchical grouping.
 *
 * Domain Model:
 * - GroupKey: Represents a grouping key for organizing pipelines (either project or user)
 * - Pipeline: Represents a CI/CD pipeline execution
 * - Job: Represents individual jobs within a pipeline
 * - Activity: Represents a time-bound activity (pipeline or job) on the timeline
 *
 * Data Flow:
 * GitLab API → Domain Model → vis.js format
 */

/**
 * @typedef {Object} VisGroup
 * @property {string} id - Unique group identifier
 * @property {string} content - Display text for group
 * @property {string[]} [nestedGroups] - Array of nested group IDs
 * @property {boolean} [showNested] - Whether nested groups are expanded
 */

/**
 * @typedef {Object} VisItem
 * @property {string} id - Unique item identifier
 * @property {string} group - Group ID this item belongs to
 * @property {string} content - Display text for item
 * @property {string} start - ISO 8601 start timestamp
 * @property {string} end - ISO 8601 end timestamp
 * @property {string} type - Item type (e.g., 'range')
 * @property {string} className - CSS class name for styling
 * @property {string} title - Tooltip text
 */

/**
 * @typedef {Object} TimeRangeInfo
 * @property {string} durationLabel - Human-readable duration label
 * @property {string} startDateStr - Formatted start date string
 * @property {string} endDateStr - Formatted end date string
 */

/**
 * Domain Model: GroupKey
 * Represents a grouping key for organizing pipelines.
 * This can represent either a GitLab project (when grouping by project)
 * or a GitLab user (when grouping by user).
 *
 * Note: This is NOT the triggering user of a pipeline - see pipeline.triggeringUser for that.
 */
class GroupKey {
    /**
     * Create a GroupKey instance
     * @param {number} id - Group ID (project ID or user ID depending on grouping mode)
     * @param {string} username - Username or project path
     * @param {string} [name] - Display name (defaults to username)
     * @param {string} [avatar_url] - Avatar URL from GitLab/Gravatar (null for projects)
     */
    constructor(id, username, name, avatar_url = null) {
        this.id = id;
        this.username = username;
        this.name = name || username;
        this.avatar_url = avatar_url;
        this.pipelines = [];
    }

    /**
     * Add a pipeline to this group
     * @param {Pipeline} pipeline - Pipeline to add
     * @returns {void}
     */
    addPipeline(pipeline) {
        this.pipelines.push(pipeline);
    }

    /**
     * Get display name for UI
     * Prioritizes human-readable name over username
     * @returns {string} Display name
     */
    getDisplayName() {
        return this.name || this.username || `Group ${this.id}`;
    }
}

/**
 * Domain Model: Pipeline
 * Represents a CI/CD pipeline execution
 */
class Pipeline {
    /**
     * Create a Pipeline instance
     * @param {number} id - Pipeline ID
     * @param {number} projectId - Project ID
     * @param {string} status - Pipeline status
     * @param {string} createdAt - ISO 8601 creation timestamp
     * @param {string|null} startedAt - ISO 8601 start timestamp
     * @param {string|null} finishedAt - ISO 8601 finish timestamp
     * @param {number|null} duration - Duration in seconds
     * @param {string} webUrl - URL to pipeline page
     * @param {GroupKey} group - The group this pipeline belongs to for display (project or user)
     * @param {string|null} projectPathWithNamespace - Project path (e.g., 'group/project-name')
     * @param {Object|null} triggeringUser - The actual GitLab user who triggered this pipeline (from API)
     */
    constructor(id, projectId, status, createdAt, startedAt, finishedAt, duration, webUrl, group, projectPathWithNamespace = null, triggeringUser = null) {
        // Validate required fields
        if (!id || !projectId || !status || !createdAt) {
            throw new Error(`Invalid pipeline data: missing required fields (id=${id}, projectId=${projectId}, status=${status}, createdAt=${createdAt})`);
        }

        // Validate timestamp format (fail fast on malformed data)
        if (!this.isValidTimestamp(createdAt)) {
            throw new Error(`Invalid createdAt timestamp: ${createdAt} for Pipeline ${id}`);
        }
        if (startedAt && !this.isValidTimestamp(startedAt)) {
            throw new Error(`Invalid startedAt timestamp: ${startedAt} for Pipeline ${id}`);
        }
        if (finishedAt && !this.isValidTimestamp(finishedAt)) {
            throw new Error(`Invalid finishedAt timestamp: ${finishedAt} for Pipeline ${id}`);
        }

        this.id = id;
        this.projectId = projectId;
        this.projectPathWithNamespace = projectPathWithNamespace;
        this.status = status;
        this.createdAt = createdAt;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
        this.duration = duration;
        this.webUrl = webUrl;
        this.group = group; // The group this pipeline belongs to (project or user, for display purposes)
        this.triggeringUser = triggeringUser; // Actual GitLab user who triggered this pipeline
        this.jobs = [];
    }

    /**
     * Validate timestamp format
     * @param {string} ts - ISO 8601 timestamp string
     * @returns {boolean} - true if valid or null/undefined, false if invalid
     */
    isValidTimestamp(ts) {
        if (!ts) return true;  // null/undefined is acceptable
        return !isNaN(new Date(ts).getTime());
    }

    /**
     * Add a job to this pipeline
     * @param {Job} job - Job to add
     * @returns {void}
     */
    addJob(job) {
        this.jobs.push(job);
    }

    /**
     * Get effective start time for timeline
     * Returns the minimum of:
     * - Pipeline's own start time (or created_at if pending)
     * - Earliest job start time (if jobs exist)
     *
     * This ensures pipeline bars encompass all their contained jobs.
     * @returns {string} ISO 8601 timestamp
     */
    getStartTime() {
        // Start with pipeline's own start time
        let pipelineStart = this.startedAt || this.createdAt;
        let minTime = new Date(pipelineStart);

        // Check all jobs to find earliest start
        for (const job of this.jobs) {
            const jobStart = new Date(job.getStartTime());
            if (jobStart < minTime) {
                minTime = jobStart;
            }
        }

        return minTime.toISOString();
    }

    /**
     * Get effective end time for timeline
     * Returns the maximum of:
     * - Pipeline's own end time (finished_at, "now" if running, or small offset if pending)
     * - Latest job end time (if jobs exist)
     *
     * This ensures pipeline bars encompass all their contained jobs.
     *
     * For running pipelines, uses current time
     * For pending pipelines, uses created_at + small offset for visibility
     *
     * Note: Pending pipelines are shown with a 5-minute bar to ensure visibility
     * on the timeline without cluttering it with long-pending items. This is a
     * display concern - the actual pipeline state is preserved.
     * @returns {string} ISO 8601 timestamp
     */
    getEndTime() {
        let pipelineEnd;

        if (this.finishedAt) {
            pipelineEnd = this.finishedAt;
        } else if (this.startedAt) {
            // Running pipeline: show until now
            pipelineEnd = new Date().toISOString();
        } else {
            // Pending pipeline: show small bar for visibility (5 minutes)
            // WHY 5 minutes: Provides visibility without cluttering timeline.
            // Based on typical GitLab pending queue times before runner assignment.
            const created = new Date(this.createdAt);
            const PENDING_VISIBILITY_MS = 5 * 60 * 1000;
            pipelineEnd = new Date(created.getTime() + PENDING_VISIBILITY_MS).toISOString();
        }

        // Start with pipeline's own end time
        let maxTime = new Date(pipelineEnd);

        // Check all jobs to find latest end
        for (const job of this.jobs) {
            const jobEnd = new Date(job.getEndTime());
            if (jobEnd > maxTime) {
                maxTime = jobEnd;
            }
        }

        return maxTime.toISOString();
    }

    /**
     * Check if pipeline is currently active (running or pending)
     * @returns {boolean} True if pipeline is active
     */
    isActive() {
        return !this.finishedAt;
    }
}

/**
 * Domain Model: Job
 * Represents individual job within a pipeline
 */
class Job {
    /**
     * Create a Job instance
     * @param {number} id - Job ID
     * @param {string} name - Job name
     * @param {string} stage - Stage name
     * @param {string} status - Job status
     * @param {string} createdAt - ISO 8601 creation timestamp
     * @param {string|null} startedAt - ISO 8601 start timestamp
     * @param {string|null} finishedAt - ISO 8601 finish timestamp
     * @param {number|null} duration - Duration in seconds
     * @param {string} webUrl - URL to job page
     * @param {number} pipelineId - Parent pipeline ID
     * @param {string|null} projectPathWithNamespace - Project path (e.g., 'group/project-name')
     * @param {Object|null} user - User who triggered the job (optional, for manual jobs)
     * @param {boolean} allowFailure - Whether job is allowed to fail without failing pipeline
     */
    constructor(id, name, stage, status, createdAt, startedAt, finishedAt, duration, webUrl, pipelineId, projectPathWithNamespace = null, user = null, allowFailure = false) {
        // Validate required fields
        if (!id || !name || !status || !createdAt || !pipelineId) {
            throw new Error(`Invalid job data: missing required fields (id=${id}, name=${name}, status=${status}, createdAt=${createdAt}, pipelineId=${pipelineId})`);
        }

        // Validate timestamp format (fail fast on malformed data)
        if (!this.isValidTimestamp(createdAt)) {
            throw new Error(`Invalid createdAt timestamp: ${createdAt} for Job ${id} (${name})`);
        }
        if (startedAt && !this.isValidTimestamp(startedAt)) {
            throw new Error(`Invalid startedAt timestamp: ${startedAt} for Job ${id} (${name})`);
        }
        if (finishedAt && !this.isValidTimestamp(finishedAt)) {
            throw new Error(`Invalid finishedAt timestamp: ${finishedAt} for Job ${id} (${name})`);
        }

        this.id = id;
        this.name = name;
        this.stage = stage;
        this.status = status;
        this.createdAt = createdAt;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
        this.duration = duration;
        this.webUrl = webUrl;
        this.pipelineId = pipelineId;
        this.projectPathWithNamespace = projectPathWithNamespace;
        this.user = user;
        this.allowFailure = allowFailure;
    }

    /**
     * Validate timestamp format
     * @param {string} ts - ISO 8601 timestamp string
     * @returns {boolean} - true if valid or null/undefined, false if invalid
     */
    isValidTimestamp(ts) {
        if (!ts) return true;  // null/undefined is acceptable
        return !isNaN(new Date(ts).getTime());
    }

    /**
     * Get effective start time for timeline
     * - Started jobs: use startedAt
     * - Pending jobs: use current time (positioned at "Now" line)
     * @returns {string} ISO 8601 timestamp
     */
    getStartTime() {
        // If job has started, use actual start time
        if (this.startedAt) {
            return this.startedAt;
        }

        // Pending jobs: position at current time (to the right of "Now" line)
        return new Date().toISOString();
    }

    /**
     * Get effective end time for timeline
     * For running jobs, uses current time
     * For pending jobs, uses now + small offset for visibility
     *
     * Note: Pending jobs are shown with a 2-minute bar (shorter than pipelines)
     * since jobs are typically smaller units that start quickly. This helps
     * distinguish pending jobs from pending pipelines visually.
     * @returns {string} ISO 8601 timestamp
     */
    getEndTime() {
        if (this.finishedAt) {
            return this.finishedAt;
        }

        // Running job: show until now
        if (this.startedAt) {
            return new Date().toISOString();
        }

        // Pending job: show small bar to the right of "Now" (2 minutes)
        // WHY 2 minutes: Shorter than pipelines (5 min) since jobs typically start quickly
        // once runner is assigned. Balances visibility vs timeline clutter.
        const now = new Date();
        const PENDING_VISIBILITY_MS = 2 * 60 * 1000;
        const endTime = new Date(now.getTime() + PENDING_VISIBILITY_MS);
        return endTime.toISOString();
    }

    /**
     * Check if job is currently active (running or pending)
     * @returns {boolean} True if job is active
     */
    isActive() {
        return !this.finishedAt;
    }
}

/**
 * Data Transformer
 * Transforms GitLab API data to domain model and vis.js format
 */
class DataTransformer {
    /**
     * Transform GitLab API data to domain model
     *
     * @param {Array} pipelines - Array of pipeline objects from GitLab API
     * @param {Array} jobs - Array of job objects from GitLab API
     * @param {Map} projectMap - Map of project ID to project object (optional, for project-based grouping)
     * @returns {Array<GroupKey>} - Array of GroupKey domain objects with nested pipelines and jobs
     */
    static transformToDomainModel(pipelines, jobs, projectMap = null) {
        // Create group map: groupId -> GroupKey object (projectId or userId depending on grouping mode)
        const groupMap = new Map();

        // Create pipeline map: pipelineId -> Pipeline object
        const pipelineMap = new Map();

        // Step 1: Process pipelines and group by project (if projectMap provided) or user
        for (const apiPipeline of pipelines) {
            let groupId, username, name, avatar_url;
            let projectPathWithNamespace = null;

            if (projectMap) {
                // Group by project
                const project = projectMap.get(apiPipeline.project_id);
                if (project) {
                    groupId = project.id;
                    username = project.path || project.name;
                    name = project.name;
                    projectPathWithNamespace = project.path_with_namespace;
                    avatar_url = null; // Projects don't have avatars
                } else {
                    // Fallback if project not found
                    groupId = apiPipeline.project_id;
                    username = `project-${apiPipeline.project_id}`;
                    name = username;
                    avatar_url = null;
                }
            } else {
                // Group by user
                groupId = apiPipeline.user?.id || 0;
                username = apiPipeline.user?.username || 'unknown';
                name = apiPipeline.user?.name || username;
                avatar_url = apiPipeline.user?.avatar_url || null;
            }

            // Get or create group key
            if (!groupMap.has(groupId)) {
                groupMap.set(groupId, new GroupKey(groupId, username, name, avatar_url));
            }
            const group = groupMap.get(groupId);

            // Create pipeline domain object
            const pipeline = new Pipeline(
                apiPipeline.id,
                apiPipeline.project_id,
                apiPipeline.status,
                apiPipeline.created_at,
                apiPipeline.started_at,
                apiPipeline.finished_at,
                apiPipeline.duration,
                apiPipeline.web_url,
                group,
                projectPathWithNamespace,
                apiPipeline.user || null  // Store actual triggering user from API
            );

            // Add to group and map
            group.addPipeline(pipeline);
            pipelineMap.set(pipeline.id, pipeline);
        }

        // Step 2: Process jobs and attach to pipelines
        for (const apiJob of jobs) {
            const pipelineId = apiJob.pipeline_id;

            // Find parent pipeline (fail fast on orphaned jobs - indicates data integrity issue)
            const pipeline = pipelineMap.get(pipelineId);
            if (!pipeline) {
                throw new Error(`Data integrity error: Job ${apiJob.id} (${apiJob.name}) references unknown pipeline ${pipelineId}`);
            }

            // Create job domain object (inherit project path from parent pipeline)
            const job = new Job(
                apiJob.id,
                apiJob.name,
                apiJob.stage,
                apiJob.status,
                apiJob.created_at,
                apiJob.started_at,
                apiJob.finished_at,
                apiJob.duration,
                apiJob.web_url,
                pipelineId,
                pipeline.projectPathWithNamespace,
                apiJob.user || null,
                apiJob.allow_failure || false
            );

            // Add to pipeline
            pipeline.addJob(job);
        }

        // Return array of groups sorted by username
        return Array.from(groupMap.values()).sort((a, b) =>
            a.username.localeCompare(b.username)
        );
    }

    /**
     * Format relative time (e.g., "2 hours ago", "3 days ago")
     * @param {string|Date} date - Date to format
     * @returns {string} Human-readable relative time
     */
    static formatRelativeTime(date) {
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
     * Format time range for activity window display
     *
     * @param {string} startTimestamp - ISO 8601 timestamp for range start
     * @param {Date} endDate - End date (defaults to now)
     * @returns {Object} - Object with {durationLabel, startDateStr, endDateStr}
     * @throws {Error} - If startTimestamp is invalid
     */
    static formatTimeRange(startTimestamp, endDate = new Date()) {
        // Validate input
        const startDate = new Date(startTimestamp);
        if (isNaN(startDate.getTime())) {
            throw new Error(
                `Invalid start timestamp: "${startTimestamp}". ` +
                `Expected ISO 8601 format (e.g., "2025-01-13T10:00:00Z"). ` +
                `This indicates a configuration error.`
            );
        }

        // Format dates for display
        const startDateStr = startDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: startDate.getFullYear() !== endDate.getFullYear() ? 'numeric' : undefined
        });
        const endDateStr = endDate.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric'
        });

        // Calculate duration
        const durationMs = endDate - startDate;
        const durationDays = Math.floor(durationMs / (1000 * 60 * 60 * 24));

        let durationLabel;
        if (durationDays < 1) {
            const durationHours = Math.floor(durationMs / (1000 * 60 * 60));
            durationLabel = `Last ${durationHours} hour${durationHours !== 1 ? 's' : ''}`;
        } else if (durationDays < 7) {
            durationLabel = `Last ${durationDays} day${durationDays !== 1 ? 's' : ''}`;
        } else {
            const durationWeeks = Math.floor(durationDays / 7);
            durationLabel = `Last ${durationWeeks} week${durationWeeks !== 1 ? 's' : ''}`;
        }

        return {
            durationLabel,
            startDateStr,
            endDateStr
        };
    }

    /**
     * Format duration in human-readable format
     * @param {number|null} seconds - Duration in seconds
     * @returns {string} Human-readable duration (e.g., "1h 23m 45s")
     */
    static formatDuration(seconds) {
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

    /**
     * Create tooltip for pipeline item
     * @param {Pipeline} pipeline - Pipeline domain object
     * @returns {string} Tooltip text
     */
    static createPipelineTooltip(pipeline) {
        const parts = [];
        parts.push(`Pipeline #${pipeline.id}`);
        parts.push(`Status: ${pipeline.status}`);

        // Show relative time for start
        if (pipeline.startedAt) {
            const relativeTime = this.formatRelativeTime(pipeline.startedAt);
            parts.push(`Started: ${relativeTime}`);
        } else {
            const relativeTime = this.formatRelativeTime(pipeline.createdAt);
            parts.push(`Created: ${relativeTime}`);
        }

        // Show duration if available
        if (pipeline.duration) {
            parts.push(`Duration: ${this.formatDuration(pipeline.duration)}`);
        }

        return parts.join('\n');
    }

    /**
     * Create tooltip for job item
     * @param {Job} job - Job domain object
     * @returns {string} Tooltip text
     */
    static createJobTooltip(job) {
        const parts = [];
        parts.push(`Job: ${job.name}`);
        parts.push(`Stage: ${job.stage}`);
        parts.push(`Status: ${job.status}`);

        // Show relative time for start
        if (job.startedAt) {
            const relativeTime = this.formatRelativeTime(job.startedAt);
            parts.push(`Started: ${relativeTime}`);
        } else {
            const relativeTime = this.formatRelativeTime(job.createdAt);
            parts.push(`Created: ${relativeTime}`);
        }

        // Show duration if available
        if (job.duration) {
            parts.push(`Duration: ${this.formatDuration(job.duration)}`);
        }

        return parts.join('\n');
    }

    /**
     * Escape HTML special characters to prevent XSS
     * @param {string} str - String to escape
     * @returns {string} HTML-escaped string
     */
    static escapeHtml(str) {
        if (!str) return str;
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    /**
     * Transform domain model to vis.js Timeline format
     *
     * @param {GroupKey[]} groups - Array of GroupKey domain objects
     * @returns {{groups: VisGroup[], items: VisItem[]}} Object with groups and items arrays for vis.js Timeline
     */
    static transformToVisFormat(groups) {
        const visGroups = [];
        const items = [];

        for (const groupKey of groups) {
            // Create group (parent)
            const groupId = `group-${groupKey.id}`;
            const visGroup = {
                id: groupId,
                content: this.escapeHtml(groupKey.getDisplayName()),
                nestedGroups: [],
                showNested: true  // Show nested groups by default
            };

            // Process each pipeline for this group
            for (const pipeline of groupKey.pipelines) {
                // Create pipeline group (child of group)
                const pipelineGroupId = `pipeline-${pipeline.id}`;
                visGroup.nestedGroups.push(pipelineGroupId);

                const pipelineGroup = {
                    id: pipelineGroupId,
                    content: `Pipeline #${pipeline.id}`,
                    nestedGroups: [],
                    showNested: false  // Enable collapse/expand functionality
                };
                visGroups.push(pipelineGroup);

                // Create pipeline item (timeline bar)
                const pipelineItem = {
                    id: `pipeline-item-${pipeline.id}`,
                    group: pipelineGroupId,
                    content: `Pipeline #${pipeline.id}`,
                    start: pipeline.getStartTime(),
                    end: pipeline.getEndTime(),
                    type: 'range',
                    className: `pipeline-${pipeline.status}`,
                    title: this.createPipelineTooltip(pipeline)
                };
                items.push(pipelineItem);

                // Process jobs within this pipeline
                for (const job of pipeline.jobs) {
                    // Create job group (child of pipeline)
                    const jobGroupId = `job-${job.id}`;
                    pipelineGroup.nestedGroups.push(jobGroupId);

                    const jobGroup = {
                        id: jobGroupId,
                        content: `${this.escapeHtml(job.stage)}: ${this.escapeHtml(job.name)}`
                    };
                    visGroups.push(jobGroup);

                    // Create job item (timeline bar)
                    const jobItem = {
                        id: `job-item-${job.id}`,
                        group: jobGroupId,
                        content: this.escapeHtml(job.name),
                        start: job.getStartTime(),
                        end: job.getEndTime(),
                        type: 'range',
                        className: `job-${job.status}`,
                        title: this.createJobTooltip(job)
                    };
                    items.push(jobItem);
                }
            }

            // Add group last (after nested groups are populated)
            visGroups.push(visGroup);
        }

        return { groups: visGroups, items };
    }

    /**
     * Main transformation pipeline: GitLab API → vis.js format
     *
     * @param {Object[]} pipelines - Array of pipeline objects from GitLab API
     * @param {Object[]} jobs - Array of job objects from GitLab API
     * @returns {{groups: VisGroup[], items: VisItem[]}} Object with groups and items arrays for vis.js Timeline
     * @throws {Error} If no groups/pipelines found (indicates API issue or wrong time range)
     */
    static transform(pipelines, jobs, projectMap = null) {
        console.log(`Transforming ${pipelines.length} pipelines and ${jobs.length} jobs`);

        // Validate input
        if (!Array.isArray(pipelines) || pipelines.length === 0) {
            throw new Error('No pipelines to transform - check if GitLab API returned data for the specified time range and projects');
        }

        // Step 1: Transform to domain model
        const groups = this.transformToDomainModel(pipelines, jobs, projectMap);
        const groupType = projectMap ? 'projects' : 'users';
        console.log(`Grouped into ${groups.length} ${groupType} with ${groups.reduce((sum, g) => sum + g.pipelines.length, 0)} pipelines`);

        // Validate domain model (fail fast if transformation produced no groups)
        if (!Array.isArray(groups) || groups.length === 0) {
            throw new Error('Transformation produced no groups - this indicates a data integrity issue');
        }

        // Step 2: Transform to vis.js format
        const result = this.transformToVisFormat(groups);
        console.log(`Generated ${result.groups.length} groups and ${result.items.length} timeline items`);

        return result;
    }
}

// Export for use in other modules
// Note: This uses global scope since we're not using ES modules
window.DataTransformer = DataTransformer;
