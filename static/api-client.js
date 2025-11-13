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
    constructor() {
        // Read configuration from injected CONFIG object
        if (typeof CONFIG === 'undefined') {
            throw new Error('CONFIG object not found. Server configuration missing.');
        }

        this.gitlabToken = CONFIG.gitlabToken;
        this.gitlabUrl = CONFIG.gitlabUrl;

        if (!this.gitlabToken) {
            throw new Error('GitLab token not found in configuration');
        }

        if (!this.gitlabUrl) {
            throw new Error('GitLab URL not found in configuration');
        }

        // Normalize URL (remove trailing slash)
        this.gitlabUrl = this.gitlabUrl.replace(/\/$/, '');
        this.apiBaseUrl = `${this.gitlabUrl}/api/v4`;
    }

    /**
     * Make authenticated request to GitLab API
     *
     * @param {string} endpoint - API endpoint path (without /api/v4 prefix)
     * @param {object} options - Fetch API options
     * @returns {Promise<object>} - Parsed JSON response
     * @throws {Error} - With user-friendly error message
     */
    async request(endpoint, options = {}) {
        // Ensure endpoint starts with /
        const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
        const url = `${this.apiBaseUrl}${normalizedEndpoint}`;

        // Add authentication header
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        // Always set Authorization header (prevent override)
        headers['Authorization'] = `Bearer ${this.gitlabToken}`;

        try {
            const response = await fetch(url, {
                ...options,
                headers
            });

            // Handle HTTP errors
            if (!response.ok) {
                await this._handleErrorResponse(response);
            }

            return await response.json();
        } catch (error) {
            // Re-throw our custom errors (already have context)
            if (error.name === 'GitLabAPIError') {
                throw error;
            }

            // Handle network errors with context
            const contextError = this._createError(
                'NetworkError',
                `Network error while connecting to GitLab: ${error.message}`
            );
            contextError.url = url;
            contextError.endpoint = normalizedEndpoint;
            contextError.originalError = error;
            throw contextError;
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
            // Response body not JSON, ignore
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
        error.name = 'GitLabAPIError';
        error.errorType = name;
        return error;
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
     *     user: {id: number, username: string, name: string}
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
     *     user: {id: number, username: string, name: string}|null
     *   }]
     */
    async getPipelineJobs(projectId, pipelineId) {
        return this.request(`/projects/${projectId}/pipelines/${pipelineId}/jobs`);
    }
}

// Export for use in other modules
// Note: This uses global scope since we're not using ES modules
window.GitLabAPIClient = GitLabAPIClient;
