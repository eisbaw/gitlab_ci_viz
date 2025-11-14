/**
 * Error Formatting Utilities
 *
 * Formats errors with user-friendly messages and actionable resolution steps.
 * Separates technical details (logged to console) from user-facing messages.
 */

/**
 * Escape HTML to prevent XSS
 */
function escapeHTML(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

/**
 * Format error with helpful resolution steps
 *
 * @param {Error} error - Error object with errorType property
 * @returns {string} - HTML string with formatted error message and resolution steps
 */
function formatError(error) {
    let message = `<strong>Error:</strong> ${escapeHTML(error.message)}`;
    let resolutionSteps = [];

    // Add specific resolution steps based on error type
    if (error.errorType === 'InvalidTokenError' || error.errorType === 'ExpiredTokenError') {
        resolutionSteps.push('Run <code>glab auth login</code> to authenticate');
        resolutionSteps.push('Restart the server after re-authenticating');
    } else if (error.errorType === 'TimeoutError') {
        resolutionSteps.push('Check if GitLab instance is accessible and responding');
        resolutionSteps.push('Verify network connectivity and firewall settings');
        resolutionSteps.push('GitLab may be experiencing high load - try again later');
        resolutionSteps.push('Consider reducing the time range to fetch less data');
    } else if (error.errorType === 'NetworkError' || error.name === 'TypeError') {
        // TypeError often indicates CORS or network issues
        resolutionSteps.push('Check if GitLab instance is accessible');
        resolutionSteps.push('If using self-hosted GitLab, check CORS configuration');
        resolutionSteps.push('Verify network connectivity');
        if (error.message && error.message.includes('Failed to fetch')) {
            message += '<br><br><strong>Possible CORS Issue:</strong> GitLab may be blocking requests from localhost.';
            resolutionSteps.push('For self-hosted GitLab, add localhost to CORS allowed origins');
            resolutionSteps.push('See: <a href="https://docs.gitlab.com/ee/api/#cors" target="_blank">GitLab CORS documentation</a>');
        }
    } else if (error.errorType === 'RateLimitError') {
        resolutionSteps.push('Wait a few minutes before retrying');
        resolutionSteps.push('Consider increasing time range to reduce API calls');
    } else if (error.errorType === 'ConfigurationError') {
        resolutionSteps.push('Check command-line arguments passed to serve.py');
        resolutionSteps.push('Ensure group ID or project IDs are valid');
        resolutionSteps.push('Verify time range format (e.g., "2 days ago" or "2025-01-10")');
    }

    if (resolutionSteps.length > 0) {
        message += '<div class="resolution-steps"><strong>Resolution steps:</strong><ol>';
        resolutionSteps.forEach(step => {
            message += `<li>${step}</li>`;
        });
        message += '</ol></div>';
    }

    return message;
}

// Export for use in other modules
window.escapeHTML = escapeHTML;
window.formatError = formatError;
