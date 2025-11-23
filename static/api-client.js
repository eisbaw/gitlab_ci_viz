/**
 * GitLab API Client
 *
 * Handles authenticated requests to GitLab API v4.
 * Reads configuration from global CONFIG object injected by serve.py.
 *
 * Error handling:
 * - 401 Unauthorized: Invalid token
 * - 403 Forbidden: Token expired or insufficient permissions
 * - Network errors: Connection issues
 */

class GitLabAPIClient {
    /**
     * Create a GitLab API client
     *
     * @param {object} config - Configuration object
     * @param {string} config.gitlabToken - GitLab API token
     * @param {string} config.gitlabUrl - GitLab instance URL
     * @param {string} [config.groupId] - Optional GitLab group ID
     * @param {Array<number>} [config.projectIds] - Optional array of project IDs
     * @throws {Error} - If config is missing or invalid
     */
    constructor(config) {
        // Helper to create configuration errors
        const createConfigError = (message) => {
            const error = new Error(message);
            error.name = 'ConfigurationError';
            return error;
        };

        // Validate config object is provided
        if (!config || typeof config !== 'object' || Array.isArray(config)) {
            throw createConfigError('CONFIG object not found. Server configuration missing.');
        }

        // Validate required fields - check presence first, then type
        if (!config.gitlabToken) {
            throw createConfigError('GitLab token is missing or empty');
        }
        if (typeof config.gitlabToken !== 'string') {
            throw createConfigError('GitLab token must be a string, got ' + typeof config.gitlabToken);
        }

        if (!config.gitlabUrl) {
            throw createConfigError('GitLab URL is missing or empty');
        }
        if (typeof config.gitlabUrl !== 'string') {
            throw createConfigError('GitLab URL must be a string, got ' + typeof config.gitlabUrl);
        }

        // Validate optional fields if provided (allow null)
        if (config.groupId !== undefined && config.groupId !== null && typeof config.groupId !== 'string') {
            throw createConfigError('groupId must be a string or null if provided, got ' + typeof config.groupId);
        }
        if (config.projectIds !== undefined && config.projectIds !== null && !Array.isArray(config.projectIds)) {
            throw createConfigError('projectIds must be an array or null if provided, got ' + typeof config.projectIds);
        }

        // Store config reference for methods that need groupId/projectIds
        this.config = config;

        this.gitlabToken = config.gitlabToken;
        this.gitlabUrl = config.gitlabUrl;

        // Normalize URL (remove trailing slash)
        this.gitlabUrl = this.gitlabUrl.replace(/\/$/, '');
        this.apiBaseUrl = `${this.gitlabUrl}/api/v4`;
    }

    /**
     * Make GraphQL query to GitLab API
     *
     * @param {string} query - GraphQL query string
     * @param {object} variables - GraphQL variables object
     * @param {number} timeout - Request timeout in milliseconds (default: 30000)
     * @returns {Promise<object>} - GraphQL response data
     * @throws {Error} - With user-friendly error message
     */
    async graphqlQuery(query, variables = {}, timeout = 30000) {
        const url = `${this.gitlabUrl}/api/graphql`;

        // Log request start with timing
        const startTime = performance.now();
        if (window.logger) {
            window.logger.debug(`GraphQL query: ${query.substring(0, 50)}...`);
        }

        // Prepare GraphQL request body
        const body = JSON.stringify({
            query: query,
            variables: variables
        });

        // Add authentication header
        const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.gitlabToken}`
        };

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(this._createError(
                    'TimeoutError',
                    `GraphQL request timed out after ${timeout / 1000} seconds. GitLab may be slow or unreachable.`
                ));
            }, timeout);
        });

        try {
            const fetchPromise = fetch(url, {
                method: 'POST',
                headers,
                body
            });

            // Race between fetch and timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            // Handle HTTP errors
            if (!response.ok) {
                await this._handleErrorResponse(response);
            }

            const result = await response.json();

            // GraphQL can return 200 OK but still have errors in the response
            if (result.errors && result.errors.length > 0) {
                const errorMessages = result.errors.map(e => e.message).join('; ');
                throw this._createError(
                    'GraphQLError',
                    `GraphQL query failed: ${errorMessages}`
                );
            }

            // Log successful request with timing
            const duration = performance.now() - startTime;
            if (window.logger) {
                window.logger.info(`GraphQL query completed (${duration.toFixed(0)}ms)`);
            }

            return result.data;
        } catch (error) {
            // Log error with timing and full context
            const duration = performance.now() - startTime;
            if (window.logger) {
                window.logger.error(`GraphQL query failed (${duration.toFixed(0)}ms)`, {
                    errorType: error.errorType || error.name,
                    message: error.message
                });
            }

            // Re-throw our custom errors (already have context)
            if (error.errorType) {
                throw error;
            }

            // Handle network errors with context
            throw this._wrapNetworkError(error, url, 'graphql');
        }
    }

    /**
     * Make authenticated request to GitLab API with timeout
     *
     * @param {string} endpoint - API endpoint path (without /api/v4 prefix)
     * @param {object} options - Fetch API options
     * @param {number} timeout - Request timeout in milliseconds (default: 30000)
     * @returns {Promise<object>} - Parsed JSON response
     * @throws {Error} - With user-friendly error message
     */
    async request(endpoint, options = {}, timeout = 30000) {
        // Ensure endpoint starts with /
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.apiBaseUrl}${normalizedEndpoint}`;

        // Log request start with timing
        const startTime = performance.now();
        if (window.logger) {
            window.logger.debug(`API request: ${normalizedEndpoint}`);
        }

        // Add authentication header
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        // Always set Authorization header (prevent override)
        headers['Authorization'] = `Bearer ${this.gitlabToken}`;

        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject(this._createError(
                    'TimeoutError',
                    `Request timed out after ${timeout / 1000} seconds. GitLab may be slow or unreachable.`
                ));
            }, timeout);
        });

        try {
            const fetchPromise = fetch(url, {
                ...options,
                headers
            });

            // Race between fetch and timeout
            const response = await Promise.race([fetchPromise, timeoutPromise]);

            // Handle HTTP errors
            if (!response.ok) {
                await this._handleErrorResponse(response);
            }

            const data = await response.json();

            // Log successful request with timing
            const duration = performance.now() - startTime;
            if (window.logger) {
                window.logger.info(`API request completed: ${normalizedEndpoint} (${duration.toFixed(0)}ms)`);
            }

            return data;
        } catch (error) {
            // Log error with timing and full context
            const duration = performance.now() - startTime;
            if (window.logger) {
                window.logger.error(`API request failed: ${normalizedEndpoint} (${duration.toFixed(0)}ms)`, {
                    errorType: error.errorType || error.name,
                    message: error.message,
                    url: url
                });
            }

            // Re-throw our custom errors (already have context)
            if (error.errorType) {
                throw error;
            }

            // Handle network errors with context
            throw this._wrapNetworkError(error, url, normalizedEndpoint);
        }
    }

    /**
     * Handle HTTP error responses with user-friendly messages
     *
     * @param {Response} response - Fetch Response object
     * @throws {Error} - With user-friendly error message
     */
    async _handleErrorResponse(response) {
        const status = response.status;

        // Try to get error details from response body
        let errorDetails = '';
        try {
            const body = await response.json();
            errorDetails = body.message || body.error || '';
        } catch (e) {
            // Response body not JSON or parsing failed
            console.debug('Failed to parse error response body:', e.message);
        }

        // 401 Unauthorized - Invalid token
        if (status === 401) {
            throw this._createError(
                'InvalidTokenError',
                'GitLab token invalid. Run: glab auth login'
            );
        }

        // 403 Forbidden - Expired token or insufficient permissions
        if (status === 403) {
            throw this._createError(
                'ExpiredTokenError',
                'Token expired. Run: glab auth login'
            );
        }

        // 404 Not Found
        if (status === 404) {
            throw this._createError(
                'NotFoundError',
                `Resource not found: ${response.url}`
            );
        }

        // 429 Rate Limited
        if (status === 429) {
            throw this._createError(
                'RateLimitError',
                'GitLab API rate limit exceeded. Please wait before retrying.'
            );
        }

        // Generic error
        const message = errorDetails
            ? `GitLab API error (${status}): ${errorDetails}`
            : `GitLab API error (${status})`;

        throw this._createError('APIError', message);
    }

    /**
     * Create custom error object
     *
     * @param {string} name - Error name
     * @param {string} message - Error message
     * @returns {Error}
     */
    _createError(name, message) {
        const error = new Error(message);
        error.name = name;
        error.errorType = name;
        return error;
    }

    /**
     * Wrap network error with context
     *
     * @param {Error} error - Original error
     * @param {string} url - Request URL
     * @param {string} endpoint - API endpoint
     * @returns {Error} - Wrapped error with context
     */
    _wrapNetworkError(error, url, endpoint) {
        const contextError = this._createError(
            'NetworkError',
            `Network error while connecting to GitLab: ${error.message}`
        );
        contextError.url = url;
        contextError.endpoint = endpoint;
        contextError.originalError = error;
        return contextError;
    }

    /**
     * Get projects from a GitLab group
     *
     * @param {string} groupId - GitLab group ID
     * @returns {Promise<Array>} - Array of project objects with structure:
     *   [{
     *     id: number,
     *     name: string,
     *     path_with_namespace: string,
     *     web_url: string
     *   }]
     */
    async getGroupProjects(groupId) {
        return this.request(`/groups/${groupId}/projects`);
    }

    /**
     * Get pipelines for a project
     *
     * @param {string} projectId - GitLab project ID
     * @param {object} params - Query parameters (e.g., {updated_after: '2025-01-10T00:00:00Z', per_page: 100})
     * @returns {Promise<Array>} - Array of pipeline objects with structure:
     *   [{
     *     id: number,
     *     project_id: number,
     *     status: 'created'|'waiting_for_resource'|'preparing'|'pending'|'running'|'success'|'failed'|'canceled'|'skipped',
     *     ref: string,
     *     sha: string,
     *     created_at: string (ISO 8601),
     *     updated_at: string (ISO 8601),
     *     started_at: string|null (ISO 8601),
     *     finished_at: string|null (ISO 8601),
     *     duration: number|null (seconds),
     *     web_url: string,
     *     user: {id: number, username: string, name: string, avatar_url: string}
     *   }]
     */
    async getProjectPipelines(projectId, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const endpoint = `/projects/${projectId}/pipelines${queryString ? '?' + queryString : ''}`;
        return this.request(endpoint);
    }

    /**
     * Get jobs for a pipeline
     *
     * @param {string} projectId - GitLab project ID
     * @param {string} pipelineId - Pipeline ID
     * @returns {Promise<Array>} - Array of job objects with structure:
     *   [{
     *     id: number,
     *     name: string,
     *     stage: string,
     *     status: 'created'|'pending'|'running'|'success'|'failed'|'canceled'|'skipped'|'manual',
     *     created_at: string (ISO 8601),
     *     started_at: string|null (ISO 8601),
     *     finished_at: string|null (ISO 8601),
     *     duration: number|null (seconds),
     *     web_url: string,
     *     user: {id: number, username: string, name: string, avatar_url: string}|null
     *   }]
     */
    async getPipelineJobs(projectId, pipelineId) {
        return this.request(`/projects/${projectId}/pipelines/${pipelineId}/jobs`);
    }

    /**
     * Fetch projects based on configuration (either from group or specific project IDs)
     *
     * This is the main entry point for project fetching that handles both modes:
     * - Group mode: Fetches all projects from a GitLab group
     * - Project list mode: Fetches details for specific project IDs (partial failures allowed)
     *
     * @returns {Promise<Array>} - Array of project objects with structure:
     *   [{
     *     id: number,
     *     name: string,
     *     path_with_namespace: string,
     *     web_url: string
     *   }]
     * @throws {Error} - If configuration is invalid or all API calls fail
     */
    async fetchProjects() {
        // Mode 1: Fetch projects from a group
        if (this.config.groupId) {
            try {
                return await this.getGroupProjects(this.config.groupId);
            } catch (error) {
                // Wrap error with context instead of mutating
                if (error.errorType) {
                    const contextError = this._createError(
                        error.errorType,
                        `Failed to fetch projects from group ${this.config.groupId}: ${error.message}`
                    );
                    contextError.originalError = error;
                    throw contextError;
                }
                throw error;
            }
        }

        // Mode 2: Use specific project IDs
        if (this.config.projectIds && Array.isArray(this.config.projectIds)) {
            if (this.config.projectIds.length === 0) {
                throw this._createError(
                    'ConfigurationError',
                    'Project IDs list is empty'
                );
            }

            // Fetch project details for each ID using allSettled for partial success
            const projectPromises = this.config.projectIds.map(projectId =>
                this.request(`/projects/${projectId}`)
            );

            const results = await Promise.allSettled(projectPromises);

            const succeeded = results
                .filter(r => r.status === 'fulfilled')
                .map(r => r.value);

            const failed = results
                .filter(r => r.status === 'rejected')
                .map((r, idx) => ({ id: this.config.projectIds[idx], error: r.reason }));

            // Log warnings for failed projects but continue with successes
            if (failed.length > 0) {
                const failureRate = (failed.length / this.config.projectIds.length * 100).toFixed(0);
                console.warn(
                    `PARTIAL FAILURE: ${failed.length}/${this.config.projectIds.length} projects ` +
                    `(${failureRate}%) failed to fetch. Continuing with ${succeeded.length} projects.`
                );
                failed.forEach(f => console.warn(`  - Project ${f.id}: ${f.error.message}`));
            }

            // Only fail if ALL projects failed
            if (succeeded.length === 0) {
                throw this._createError(
                    'ProjectFetchError',
                    `Failed to fetch all ${this.config.projectIds.length} configured projects`
                );
            }

            return succeeded;
        }

        // Neither groupId nor projectIds is configured
        throw this._createError(
            'ConfigurationError',
            'Neither groupId nor projectIds found in configuration'
        );
    }

    /**
     * Make paginated request to GitLab API with timeout
     *
     * GitLab API uses Link headers for pagination with rel="next" for the next page.
     * This method follows pagination links until all pages are fetched.
     *
     * @param {string} endpoint - API endpoint path (without /api/v4 prefix)
     * @param {object} params - Query parameters
     * @param {number} timeout - Request timeout in milliseconds (default: 30000)
     * @returns {Promise<Array>} - Aggregated array of all results from all pages
     */
    async _requestPaginated(endpoint, params = {}, timeout = 30000) {
        let allResults = [];
        let currentPage = 1;
        let hasNextPage = true;

        // Set per_page to 100 if not specified
        // GitLab API maximum is 100; using smaller values wastes bandwidth and API calls
        const queryParams = {
            per_page: 100,
            ...params
        };

        if (window.logger) {
            window.logger.debug(`Starting paginated request: ${endpoint}`);
        }

        while (hasNextPage) {
            // Add page parameter
            queryParams.page = currentPage;

            const queryString = new URLSearchParams(queryParams).toString();
            const fullEndpoint = `${endpoint}${queryString ? '?' + queryString : ''}`;

            // Make request and capture response headers
            const normalizedEndpoint = fullEndpoint.startsWith('/') ? fullEndpoint : `/${fullEndpoint}`;
            const url = `${this.apiBaseUrl}${normalizedEndpoint}`;

            const startTime = performance.now();
            if (window.logger) {
                window.logger.debug(`Fetching page ${currentPage}: ${endpoint}`);
            }

            const headers = {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.gitlabToken}`
            };

            // Create timeout promise
            const timeoutPromise = new Promise((_, reject) => {
                setTimeout(() => {
                    reject(this._createError(
                        'TimeoutError',
                        `Paginated request timed out after ${timeout / 1000} seconds on page ${currentPage}. GitLab may be slow or unreachable.`
                    ));
                }, timeout);
            });

            let response;
            try {
                const fetchPromise = fetch(url, { headers });

                // Race between fetch and timeout
                response = await Promise.race([fetchPromise, timeoutPromise]);

                if (!response.ok) {
                    await this._handleErrorResponse(response);
                }

                const pageResults = await response.json();
                allResults = allResults.concat(pageResults);

                const duration = performance.now() - startTime;
                if (window.logger) {
                    window.logger.info(`Fetched page ${currentPage}: ${endpoint} - ${pageResults.length} items (${duration.toFixed(0)}ms)`);
                }

                // Check for Link header to determine if there's a next page
                const linkHeader = response.headers.get('Link');
                hasNextPage = linkHeader && linkHeader.includes('rel="next"');
                currentPage++;

            } catch (error) {
                const duration = performance.now() - startTime;
                if (window.logger) {
                    window.logger.error(`Paginated request failed on page ${currentPage}: ${endpoint} (${duration.toFixed(0)}ms)`, {
                        errorType: error.errorType || error.name,
                        message: error.message
                    });
                }

                // Re-throw our custom errors
                if (error.errorType) {
                    throw error;
                }

                // Handle network errors with context
                throw this._wrapNetworkError(error, url, normalizedEndpoint);
            }
        }

        if (window.logger) {
            window.logger.info(`Completed paginated request: ${endpoint} - total ${allResults.length} items across ${currentPage - 1} pages`);
        }

        return allResults;
    }

    /**
     * Fetch pipelines using GraphQL API (includes user information)
     *
     * GraphQL allows us to fetch user information with pipelines in a single query,
     * unlike the REST API which requires separate calls or extracting from jobs.
     *
     * @param {Array} projects - Array of project objects with id property
     * @param {string} updatedAfter - ISO 8601 timestamp to filter pipelines (required)
     * @returns {Promise<Array>} - Array of pipeline objects in REST API format
     * @throws {Error} - If GraphQL query fails
     */
    async fetchPipelinesGraphQL(projects, updatedAfter) {
        if (!Array.isArray(projects) || projects.length === 0) {
            throw this._createError(
                'ConfigurationError',
                'Projects array is empty or invalid'
            );
        }

        // GraphQL query to fetch pipelines with user information
        // Note: We query one project at a time to handle pagination properly
        const query = `
            query GetPipelines($projectId: ID!, $updatedAfter: Time, $after: String) {
                project(fullPath: $projectId) {
                    id
                    fullPath
                    pipelines(updatedAfter: $updatedAfter, first: 100, after: $after) {
                        nodes {
                            id
                            iid
                            status
                            ref
                            sha
                            createdAt
                            updatedAt
                            startedAt
                            finishedAt
                            duration
                            user {
                                id
                                username
                                name
                                avatarUrl
                            }
                        }
                        pageInfo {
                            hasNextPage
                            endCursor
                        }
                    }
                }
            }
        `;

        try {
            const allPipelines = [];

            // Fetch pipelines for each project (with pagination per project)
            for (const project of projects) {
                let hasNextPage = true;
                let cursor = null;
                let projectPipelines = [];

                // Use fullPath if available, otherwise construct from path_with_namespace or use ID
                const projectId = project.path_with_namespace || `gid://gitlab/Project/${project.id}`;

                while (hasNextPage) {
                    const variables = {
                        projectId: projectId,
                        updatedAfter: updatedAfter,
                        after: cursor
                    };

                    const data = await this.graphqlQuery(query, variables);

                    if (!data.project) {
                        console.warn(`Project not found in GraphQL response: ${projectId}`);
                        break;
                    }

                    // Extract numeric project ID from GraphQL ID (gid://gitlab/Project/123 -> 123)
                    const projectIdNumeric = project.id; // We already have this from input
                    const projectPath = data.project.fullPath || '';

                    if (data.project.pipelines && data.project.pipelines.nodes) {
                        for (const pipeline of data.project.pipelines.nodes) {
                            // Extract numeric pipeline ID from GraphQL ID
                            const pipelineIdMatch = pipeline.id.match(/\/(\d+)$/);
                            const pipelineId = pipelineIdMatch ? parseInt(pipelineIdMatch[1], 10) : null;

                            if (!pipelineId) {
                                console.warn(`Failed to extract pipeline ID from GraphQL ID: ${pipeline.id}`);
                                continue;
                            }

                            // Transform GraphQL format to REST API format
                            projectPipelines.push({
                                id: pipelineId,
                                iid: pipeline.iid,
                                project_id: projectIdNumeric,
                                status: pipeline.status.toLowerCase(), // GraphQL uses uppercase, REST uses lowercase
                                ref: pipeline.ref,
                                sha: pipeline.sha,
                                created_at: pipeline.createdAt,
                                updated_at: pipeline.updatedAt,
                                started_at: pipeline.startedAt,
                                finished_at: pipeline.finishedAt,
                                duration: pipeline.duration,
                                web_url: `${this.gitlabUrl}/${projectPath}/-/pipelines/${pipelineId}`,
                                user: pipeline.user ? {
                                    id: this._extractNumericId(pipeline.user.id),
                                    username: pipeline.user.username,
                                    name: pipeline.user.name,
                                    avatar_url: pipeline.user.avatarUrl
                                } : null
                            });
                        }
                    }

                    // Check if there's a next page
                    const pageInfo = data.project.pipelines?.pageInfo;
                    hasNextPage = pageInfo?.hasNextPage || false;
                    cursor = pageInfo?.endCursor || null;

                    if (hasNextPage && cursor) {
                        if (window.logger) {
                            window.logger.debug(`Fetching next page for project ${projectId} (cursor: ${cursor})`);
                        }
                    }
                }

                allPipelines.push(...projectPipelines);

                if (window.logger) {
                    window.logger.debug(`Fetched ${projectPipelines.length} pipelines from project ${projectId}`);
                }
            }

            if (window.logger) {
                window.logger.info(`GraphQL fetched ${allPipelines.length} pipelines from ${projects.length} projects`);
            }

            return allPipelines;

        } catch (error) {
            // Re-throw with context
            if (error.errorType) {
                throw error;
            }
            throw this._createError(
                'GraphQLError',
                `Failed to fetch pipelines via GraphQL: ${error.message}`
            );
        }
    }

    /**
     * Extract numeric ID from GitLab GraphQL global ID
     * GraphQL IDs are in format: gid://gitlab/Model/123
     *
     * @param {string} gid - GraphQL global ID
     * @returns {number|null} - Numeric ID or null if extraction fails
     */
    _extractNumericId(gid) {
        if (!gid) return null;
        const match = gid.match(/\/(\d+)$/);
        return match ? parseInt(match[1], 10) : null;
    }

    /**
     * Fetch pipelines for given projects within specified time range
     *
     * Fetches all pipelines for the provided projects, filtering by the provided
     * timestamp. Handles pagination automatically to retrieve all pipelines across
     * multiple pages.
     *
     * @param {Array} projects - Array of project objects with id property
     * @param {string} updatedAfter - ISO 8601 timestamp to filter pipelines (required)
     * @returns {Promise<Array>} - Array of pipeline objects with metadata:
     *   [{
     *     id: number,
     *     project_id: number,
     *     status: string,
     *     ref: string,
     *     created_at: string,
     *     updated_at: string,
     *     started_at: string|null,
     *     finished_at: string|null,
     *     duration: number|null,
     *     web_url: string,
     *     user: {id, username, name}
     *   }]
     * @throws {Error} - If all projects fail to fetch pipelines
     */
    async fetchPipelines(projects, updatedAfter) {
        if (!Array.isArray(projects) || projects.length === 0) {
            throw this._createError(
                'ConfigurationError',
                'Projects array is empty or invalid'
            );
        }

        // Validate projects have id property
        for (const project of projects) {
            if (!project.id) {
                throw this._createError(
                    'ConfigurationError',
                    'Project object missing required "id" property'
                );
            }
        }

        // Use provided updatedAfter or fall back to config.since
        const timestamp = updatedAfter || this.config.since;

        if (!timestamp) {
            throw this._createError(
                'ConfigurationError',
                'updatedAfter timestamp is required (either as parameter or in config.since)'
            );
        }

        // Try GraphQL first (includes user information), fall back to REST API
        try {
            if (window.logger) {
                window.logger.info('Attempting to fetch pipelines via GraphQL API (includes user data)');
            }

            const pipelines = await this.fetchPipelinesGraphQL(projects, timestamp);

            if (window.logger) {
                window.logger.info(`GraphQL fetch successful: ${pipelines.length} pipelines with user information`);
            }

            return pipelines;

        } catch (graphqlError) {
            // Log GraphQL failure and fall back to REST API
            if (window.logger) {
                window.logger.warn(
                    'GraphQL fetch failed, falling back to REST API (user info will be extracted from jobs)',
                    { error: graphqlError.message }
                );
            }

            // Fall back to REST API (original implementation)
            const pipelinePromises = projects.map(project =>
                this._requestPaginated(
                    `/projects/${project.id}/pipelines`,
                    {
                        updated_after: timestamp,
                        order_by: 'updated_at',
                        sort: 'desc'
                    }
                ).then(pipelines => {
                    return {
                        projectId: project.id,
                        success: true,
                        pipelines: pipelines.map(p => ({ ...p, project_id: project.id }))
                    };
                })
                .catch(error => ({
                    projectId: project.id,
                    success: false,
                    error: error
                }))
            );

            const results = await Promise.all(pipelinePromises);

            // Separate successful and failed fetches
            const succeeded = results.filter(r => r.success);
            const failed = results.filter(r => !r.success);

            // Log warnings for failed projects
            if (failed.length > 0) {
                console.warn(`Failed to fetch pipelines for ${failed.length} of ${projects.length} projects:`,
                    failed.map(f => `${f.projectId}: ${f.error.message}`));
            }

            // Fail if ALL projects failed
            if (succeeded.length === 0) {
                throw this._createError(
                    'PipelineFetchError',
                    `Failed to fetch pipelines for all ${projects.length} configured projects`
                );
            }

            // Flatten and return all successful pipeline results
            return succeeded.flatMap(s => s.pipelines);
        }
    }

    /**
     * Fetch jobs for given pipelines
     *
     * Fetches all jobs for the provided pipelines using the GitLab API.
     * Handles partial failures gracefully - if some pipelines fail to return jobs,
     * the function continues and returns jobs from successful fetches.
     *
     * @param {Array} pipelines - Array of pipeline objects with project_id and id properties
     * @returns {Promise<Array>} - Array of job objects with metadata:
     *   [{
     *     id: number,
     *     name: string,
     *     stage: string,
     *     status: string,
     *     created_at: string,
     *     started_at: string|null,
     *     finished_at: string|null,
     *     duration: number|null,
     *     web_url: string,
     *     user: {id, username, name, avatar_url}|null,
     *     project_id: number,
     *     pipeline_id: number
     *   }]
     * @throws {Error} - If pipelines array is empty or invalid
     */
    async fetchJobs(pipelines) {
        if (!Array.isArray(pipelines) || pipelines.length === 0) {
            throw this._createError(
                'ConfigurationError',
                'Pipelines array is empty or invalid'
            );
        }

        // Validate pipelines have required properties
        for (const pipeline of pipelines) {
            if (!pipeline.project_id || !pipeline.id) {
                throw this._createError(
                    'ConfigurationError',
                    'Pipeline object missing required "project_id" or "id" property'
                );
            }
        }

        // Fetch jobs for all pipelines in parallel
        // Each pipeline promise catches its own errors to allow partial success
        const jobPromises = pipelines.map(pipeline =>
            this.getPipelineJobs(pipeline.project_id, pipeline.id)
                .then(jobs => ({
                    pipelineId: pipeline.id,
                    projectId: pipeline.project_id,
                    success: true,
                    jobs: jobs.map(j => ({
                        ...j,
                        project_id: pipeline.project_id,
                        pipeline_id: pipeline.id
                    }))
                }))
                .catch(error => ({
                    pipelineId: pipeline.id,
                    projectId: pipeline.project_id,
                    success: false,
                    error: { name: error.name, message: error.message, errorType: error.errorType }
                }))
        );

        const results = await Promise.all(jobPromises);

        // Separate successful and failed fetches
        const succeeded = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        // Log warnings for failed pipelines
        if (failed.length > 0) {
            console.warn(`Failed to fetch jobs for ${failed.length} of ${pipelines.length} pipelines:`,
                failed.map(f => `pipeline ${f.pipelineId} (project ${f.projectId}): ${f.error.message}`));
        }

        // If ALL pipelines failed to fetch jobs, throw error (consistent with fetchPipelines)
        if (succeeded.length === 0 && failed.length > 0) {
            throw this._createError(
                'JobFetchError',
                `Failed to fetch jobs for all ${pipelines.length} pipelines`
            );
        }

        // Flatten and return all successful job results
        // Note: Empty array is valid when pipelines have no jobs yet (e.g., pending state)
        return succeeded.flatMap(s => s.jobs);
    }

}

// Export to global scope for both browser and Node.js
if (typeof window !== 'undefined') {
    window.GitLabAPIClient = GitLabAPIClient;
} else if (typeof global !== 'undefined') {
    global.GitLabAPIClient = GitLabAPIClient;
}
