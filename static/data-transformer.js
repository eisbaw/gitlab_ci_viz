/**
 * Data Transformer Module
 *
 * Transforms GitLab API responses into domain model and vis.js Timeline format.
 * Implements user-centric organization with proper hierarchical grouping.
 *
 * Domain Model:
 * - User: Represents a GitLab user who triggered pipelines
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
 * Domain Model: User
 * Represents a GitLab user who triggered pipelines
 */
class User {
    /**
     * Create a User instance
     * @param {number} id - User ID
     * @param {string} username - Username
     * @param {string} [name] - Display name (defaults to username)
     */
    constructor(id, username, name) {
        this.id = id;
        this.username = username;
        this.name = name || username;
        this.pipelines = [];
    }

    /**
     * Add a pipeline to this user
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
        return this.name || this.username || `User ${this.id}`;
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
     * @param {User} user - User who triggered the pipeline
     */
    constructor(id, projectId, status, createdAt, startedAt, finishedAt, duration, webUrl, user) {
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
        this.status = status;
        this.createdAt = createdAt;
        this.startedAt = startedAt;
        this.finishedAt = finishedAt;
        this.duration = duration;
        this.webUrl = webUrl;
        this.user = user;
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
     * Falls back to created_at if started_at is null (pending pipelines)
     * @returns {string} ISO 8601 timestamp
     */
    getStartTime() {
        return this.startedAt || this.createdAt;
    }

    /**
     * Get effective end time for timeline
     * For running pipelines, uses current time
     * For pending pipelines, uses created_at + small offset for visibility
     *
     * Note: Pending pipelines are shown with a 5-minute bar to ensure visibility
     * on the timeline without cluttering it with long-pending items. This is a
     * display concern - the actual pipeline state is preserved.
     * @returns {string} ISO 8601 timestamp
     */
    getEndTime() {
        if (this.finishedAt) {
            return this.finishedAt;
        }

        // Running pipeline: show until now
        if (this.startedAt) {
            return new Date().toISOString();
        }

        // Pending pipeline: show small bar for visibility (5 minutes)
        // WHY 5 minutes: Provides visibility without cluttering timeline.
        // Based on typical GitLab pending queue times before runner assignment.
        const created = new Date(this.createdAt);
        const PENDING_VISIBILITY_MS = 5 * 60 * 1000;
        const endTime = new Date(created.getTime() + PENDING_VISIBILITY_MS);
        return endTime.toISOString();
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
     */
    constructor(id, name, stage, status, createdAt, startedAt, finishedAt, duration, webUrl, pipelineId) {
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
     * Falls back to created_at if started_at is null (pending jobs)
     * @returns {string} ISO 8601 timestamp
     */
    getStartTime() {
        return this.startedAt || this.createdAt;
    }

    /**
     * Get effective end time for timeline
     * For running jobs, uses current time
     * For pending jobs, uses created_at + small offset for visibility
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

        // Pending job: show small bar for visibility (2 minutes)
        // WHY 2 minutes: Shorter than pipelines (5 min) since jobs typically start quickly
        // once runner is assigned. Balances visibility vs timeline clutter.
        const created = new Date(this.createdAt);
        const PENDING_VISIBILITY_MS = 2 * 60 * 1000;
        const endTime = new Date(created.getTime() + PENDING_VISIBILITY_MS);
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
     * @returns {Array<User>} - Array of User domain objects with nested pipelines and jobs
     */
    static transformToDomainModel(pipelines, jobs, projectMap = null) {
        // Create user map: userId -> User object (or projectId -> User object when grouping by project)
        const userMap = new Map();

        // Create pipeline map: pipelineId -> Pipeline object
        const pipelineMap = new Map();

        // Step 1: Process pipelines and group by project (if projectMap provided) or user
        for (const apiPipeline of pipelines) {
            let userId, username, name;

            if (projectMap) {
                // Group by project instead of user
                const project = projectMap.get(apiPipeline.project_id);
                if (project) {
                    userId = project.id;
                    username = project.path || project.name;
                    name = project.name;
                } else {
                    // Fallback if project not found
                    userId = apiPipeline.project_id;
                    username = `project-${apiPipeline.project_id}`;
                    name = username;
                }
            } else {
                // Original behavior: group by user
                userId = apiPipeline.user?.id || 0;
                username = apiPipeline.user?.username || 'unknown';
                name = apiPipeline.user?.name || username;
            }

            // Get or create user (or project-as-user)
            if (!userMap.has(userId)) {
                userMap.set(userId, new User(userId, username, name));
            }
            const user = userMap.get(userId);

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
                user
            );

            // Add to user and map
            user.addPipeline(pipeline);
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

            // Create job domain object
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
                pipelineId
            );

            // Add to pipeline
            pipeline.addJob(job);
        }

        // Return array of users sorted by username
        return Array.from(userMap.values()).sort((a, b) =>
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
     * @param {User[]} users - Array of User domain objects
     * @returns {{groups: VisGroup[], items: VisItem[]}} Object with groups and items arrays for vis.js Timeline
     */
    static transformToVisFormat(users) {
        const groups = [];
        const items = [];

        for (const user of users) {
            // Create user group (parent)
            const userGroupId = `user-${user.id}`;
            const userGroup = {
                id: userGroupId,
                content: this.escapeHtml(user.getDisplayName()),
                nestedGroups: [],
                showNested: true  // Show nested groups by default
            };

            // Process each pipeline for this user
            for (const pipeline of user.pipelines) {
                // Create pipeline group (child of user)
                const pipelineGroupId = `pipeline-${pipeline.id}`;
                userGroup.nestedGroups.push(pipelineGroupId);

                const pipelineGroup = {
                    id: pipelineGroupId,
                    content: `Pipeline #${pipeline.id}`,
                    nestedGroups: [],
                    showNested: false  // Enable collapse/expand functionality
                };
                groups.push(pipelineGroup);

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
                    groups.push(jobGroup);

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

            // Add user group last (after nested groups are populated)
            groups.push(userGroup);
        }

        return { groups, items };
    }

    /**
     * Main transformation pipeline: GitLab API → vis.js format
     *
     * @param {Object[]} pipelines - Array of pipeline objects from GitLab API
     * @param {Object[]} jobs - Array of job objects from GitLab API
     * @returns {{groups: VisGroup[], items: VisItem[]}} Object with groups and items arrays for vis.js Timeline
     * @throws {Error} If no users/pipelines found (indicates API issue or wrong time range)
     */
    static transform(pipelines, jobs, projectMap = null) {
        console.log(`Transforming ${pipelines.length} pipelines and ${jobs.length} jobs`);

        // Validate input
        if (!Array.isArray(pipelines) || pipelines.length === 0) {
            throw new Error('No pipelines to transform - check if GitLab API returned data for the specified time range and projects');
        }

        // Step 1: Transform to domain model
        const users = this.transformToDomainModel(pipelines, jobs, projectMap);
        const groupType = projectMap ? 'projects' : 'users';
        console.log(`Grouped into ${users.length} ${groupType} with ${users.reduce((sum, u) => sum + u.pipelines.length, 0)} pipelines`);

        // Validate domain model (fail fast if transformation produced no users)
        if (!Array.isArray(users) || users.length === 0) {
            throw new Error('Transformation produced no users - this indicates a data integrity issue');
        }

        // Step 2: Transform to vis.js format
        const result = this.transformToVisFormat(users);
        console.log(`Generated ${result.groups.length} groups and ${result.items.length} timeline items`);

        return result;
    }
}

// Export for use in other modules
// Note: This uses global scope since we're not using ES modules
window.DataTransformer = DataTransformer;
