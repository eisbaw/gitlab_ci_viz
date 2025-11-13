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
 * Domain Model: User
 * Represents a GitLab user who triggered pipelines
 */
class User {
    constructor(id, username, name) {
        this.id = id;
        this.username = username;
        this.name = name || username;
        this.pipelines = [];
    }

    addPipeline(pipeline) {
        this.pipelines.push(pipeline);
    }

    /**
     * Get display name for UI
     * Prioritizes human-readable name over username
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
    constructor(id, projectId, status, createdAt, startedAt, finishedAt, duration, webUrl, user) {
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

    addJob(job) {
        this.jobs.push(job);
    }

    /**
     * Get effective start time for timeline
     * Falls back to created_at if started_at is null (pending pipelines)
     */
    getStartTime() {
        return this.startedAt || this.createdAt;
    }

    /**
     * Get effective end time for timeline
     * For running pipelines, uses current time
     * For pending pipelines, uses created_at + small offset for visibility
     */
    getEndTime() {
        if (this.finishedAt) {
            return this.finishedAt;
        }

        // Running pipeline: show until now
        if (this.startedAt) {
            return new Date().toISOString();
        }

        // Pending pipeline: show small bar for visibility
        const created = new Date(this.createdAt);
        if (isNaN(created.getTime())) {
            throw new Error(`Invalid createdAt timestamp: ${this.createdAt} for Pipeline ${this.id}`);
        }

        const PENDING_VISIBILITY_MS = 5 * 60 * 1000;  // 5 minutes
        const endTime = new Date(created.getTime() + PENDING_VISIBILITY_MS);
        return endTime.toISOString();
    }

    /**
     * Check if pipeline is currently active (running or pending)
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
    constructor(id, name, stage, status, createdAt, startedAt, finishedAt, duration, webUrl, pipelineId) {
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
     * Get effective start time for timeline
     * Falls back to created_at if started_at is null (pending jobs)
     */
    getStartTime() {
        return this.startedAt || this.createdAt;
    }

    /**
     * Get effective end time for timeline
     * For running jobs, uses current time
     * For pending jobs, uses created_at + small offset for visibility
     */
    getEndTime() {
        if (this.finishedAt) {
            return this.finishedAt;
        }

        // Running job: show until now
        if (this.startedAt) {
            return new Date().toISOString();
        }

        // Pending job: show small bar for visibility
        const created = new Date(this.createdAt);
        if (isNaN(created.getTime())) {
            throw new Error(`Invalid createdAt timestamp: ${this.createdAt} for Job ${this.id} (${this.name})`);
        }

        const PENDING_VISIBILITY_MS = 2 * 60 * 1000;  // 2 minutes
        const endTime = new Date(created.getTime() + PENDING_VISIBILITY_MS);
        return endTime.toISOString();
    }

    /**
     * Check if job is currently active (running or pending)
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
     * @returns {Array<User>} - Array of User domain objects with nested pipelines and jobs
     */
    static transformToDomainModel(pipelines, jobs) {
        // Create user map: userId -> User object
        const userMap = new Map();

        // Create pipeline map: pipelineId -> Pipeline object
        const pipelineMap = new Map();

        // Step 1: Process pipelines and group by user
        for (const apiPipeline of pipelines) {
            // Extract user info (handle missing user gracefully)
            const userId = apiPipeline.user?.id || 0;
            const username = apiPipeline.user?.username || 'unknown';
            const name = apiPipeline.user?.name || username;

            // Get or create user
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
     * Transform domain model to vis.js Timeline format
     *
     * @param {Array<User>} users - Array of User domain objects
     * @returns {Object} - Object with groups and items arrays for vis.js Timeline:
     *   {
     *     groups: [{id, content, nestedGroups}],
     *     items: [{id, group, content, start, end, type, className}]
     *   }
     */
    static transformToVisFormat(users) {
        const groups = [];
        const items = [];

        for (const user of users) {
            // Create user group (parent)
            const userGroupId = `user-${user.id}`;
            const userGroup = {
                id: userGroupId,
                content: user.getDisplayName(),
                nestedGroups: []
            };

            // Process each pipeline for this user
            for (const pipeline of user.pipelines) {
                // Create pipeline group (child of user)
                const pipelineGroupId = `pipeline-${pipeline.id}`;
                userGroup.nestedGroups.push(pipelineGroupId);

                const pipelineGroup = {
                    id: pipelineGroupId,
                    content: `Pipeline #${pipeline.id}`,
                    nestedGroups: []
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
                    className: `pipeline-${pipeline.status}`
                };
                items.push(pipelineItem);

                // Process jobs within this pipeline
                for (const job of pipeline.jobs) {
                    // Create job group (child of pipeline)
                    const jobGroupId = `job-${job.id}`;
                    pipelineGroup.nestedGroups.push(jobGroupId);

                    const jobGroup = {
                        id: jobGroupId,
                        content: `${job.stage}: ${job.name}`
                    };
                    groups.push(jobGroup);

                    // Create job item (timeline bar)
                    const jobItem = {
                        id: `job-item-${job.id}`,
                        group: jobGroupId,
                        content: job.name,
                        start: job.getStartTime(),
                        end: job.getEndTime(),
                        type: 'range',
                        className: `job-${job.status}`
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
     * @param {Array} pipelines - Array of pipeline objects from GitLab API
     * @param {Array} jobs - Array of job objects from GitLab API
     * @returns {Object} - Object with groups and items arrays for vis.js Timeline
     */
    static transform(pipelines, jobs) {
        console.log(`Transforming ${pipelines.length} pipelines and ${jobs.length} jobs`);

        // Step 1: Transform to domain model
        const users = this.transformToDomainModel(pipelines, jobs);
        console.log(`Grouped into ${users.length} users with ${users.reduce((sum, u) => sum + u.pipelines.length, 0)} pipelines`);

        // Validate domain model
        if (!Array.isArray(users) || users.length === 0) {
            console.warn('No users found in transformed data - timeline will be empty');
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
