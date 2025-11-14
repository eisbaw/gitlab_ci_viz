# Critical Fixes for Task-022 Error Handling

This document provides exact code fixes for the critical issues identified in the architecture review.

---

## FIX 1: Timeout on Paginated Requests (CRITICAL)

**Problem**: `_requestPaginated()` has no timeout protection, can hang indefinitely

**Current Code** (api-client.js lines 360-363):
```javascript
let response;
try {
    response = await fetch(url, { headers });
```

**Fixed Code**:
```javascript
let response;
try {
    // Create AbortController with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        response = await fetch(url, {
            headers,
            signal: controller.signal
        });
        clearTimeout(timeoutId);
    } catch (error) {
        clearTimeout(timeoutId);
        if (error.name === 'AbortError') {
            throw this._createError(
                'TimeoutError',
                `Paginated request timed out after ${timeout / 1000} seconds`
            );
        }
        throw error;
    }

    if (!response.ok) {
        await this._handleErrorResponse(response);
    }

    const pageResults = await response.json();
    allResults = allResults.concat(pageResults);

    // Check for Link header to determine if there's a next page
    const linkHeader = response.headers.get('Link');
    hasNextPage = linkHeader && linkHeader.includes('rel="next"');
    currentPage++;

} catch (error) {
    // Re-throw our custom errors
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
```

**Why This Works**:
- AbortController is standard browser API for canceling fetch
- TimeoutId is always cleared (even if abort succeeds)
- Distinguishes timeout (AbortError) from other network errors
- No memory leaks from dangling setTimeout

---

## FIX 2: XSS Protection in Error Messages (CRITICAL)

**Problem**: Error messages from API inserted into DOM without escaping

**Location**: index.html (need to add helper + modify formatError)

**Add this helper function** (after line 180, in the script section):

```javascript
/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML-safe text
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

**Replace formatError function** (lines 316-357):

```javascript
/**
 * Format error with helpful resolution steps
 */
function formatError(error) {
    // Escape error message to prevent XSS
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
            // Escape step text but preserve code tags
            const escapedStep = escapeHTML(step)
                .replace('&lt;code&gt;', '<code>')
                .replace('&lt;/code&gt;', '</code>');
            message += `<li>${escapedStep}</li>`;
        });
        message += '</ol></div>';
    }

    return message;
}
```

**Why This Works**:
- `escapeHTML()` converts `<`, `>`, `&` to HTML entities
- Prevents code injection via error message
- Preserves intentional HTML (`<code>`, `<a>` tags) by re-unescaping them
- textContent property handles conversion safely

---

## FIX 3: Log Response Parse Failures (CRITICAL)

**Problem**: Silent exception when response body isn't JSON

**Location**: api-client.js lines 110-117

**Replace silent catch**:

```javascript
// Try to get error details from response body
let errorDetails = '';
try {
    const body = await response.json();
    errorDetails = body.message || body.error || '';
} catch (parseError) {
    // Log parse failure for debugging
    const contentType = response.headers.get('content-type') || 'unknown';
    console.debug(
        `Failed to parse error response body as JSON`,
        {
            status: response.status,
            contentType: contentType,
            parseError: parseError.message
        }
    );
    // Continue without error details
}
```

**Why This Works**:
- Logs at DEBUG level (doesn't spam production)
- Includes context (status, content-type)
- Operator can identify malformed responses
- Gracefully continues without details

---

## FIX 4: Use AbortController in Main request() Method (HIGH)

**Problem**: setTimeout in Promise.race leaves hanging timeouts

**Current Code** (api-client.js lines 58-75):

```javascript
async request(endpoint, options = {}, timeout = 30000) {
    // ... setup code ...

    const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
            reject(this._createError(
                'TimeoutError',
                `Request timed out after ${timeout / 1000} seconds...`
            ));
        }, timeout);
    });

    try {
        const fetchPromise = fetch(url, {
            ...options,
            headers
        });

        const response = await Promise.race([fetchPromise, timeoutPromise]);
```

**Replace with**:

```javascript
async request(endpoint, options = {}, timeout = 30000) {
    // ... setup code (headers, etc) ...

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const response = await fetch(url, {
            ...options,
            headers,
            signal: controller.signal
        });

        // Clear timeout immediately after success
        clearTimeout(timeoutId);

        // Handle HTTP errors
        if (!response.ok) {
            await this._handleErrorResponse(response);
        }

        return await response.json();
    } catch (error) {
        // Always clear timeout
        clearTimeout(timeoutId);

        // Re-throw our custom errors (already have context)
        if (error.name === 'GitLabAPIError') {
            throw error;
        }

        // Distinguish timeout from other network errors
        if (error.name === 'AbortError') {
            throw this._createError(
                'TimeoutError',
                `Request timed out after ${timeout / 1000} seconds. GitLab may be slow or unreachable.`
            );
        }

        // Handle other network errors with context
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
```

**Why This Works**:
- AbortController is supported in all modern browsers
- fetch() respects abort signal automatically
- No dangling setTimeout promises
- Cleaner code than Promise.race

---

## FIX 5: Add HTML Entity Escape Helper

**Location**: index.html (add near top of script tag, line 162)

```javascript
/**
 * Define error resolution messages as data (not HTML)
 * Enables testing and reuse without DOM coupling
 */
const ERROR_RESOLUTIONS = {
    InvalidTokenError: {
        title: 'Authentication Error',
        steps: [
            'Run: glab auth login',
            'Restart the server after re-authenticating'
        ]
    },
    ExpiredTokenError: {
        title: 'Token Expired',
        steps: [
            'Run: glab auth login',
            'Restart the server after re-authenticating'
        ]
    },
    TimeoutError: {
        title: 'Request Timeout',
        steps: [
            'Check if GitLab instance is accessible and responding',
            'Verify network connectivity and firewall settings',
            'GitLab may be experiencing high load - try again later',
            'Consider reducing the time range to fetch less data'
        ]
    },
    NetworkError: {
        title: 'Network Connection Error',
        steps: [
            'Check if GitLab instance is accessible',
            'If using self-hosted GitLab, check CORS configuration',
            'Verify network connectivity'
        ]
    },
    RateLimitError: {
        title: 'Rate Limit Exceeded',
        steps: [
            'Wait a few minutes before retrying',
            'Consider increasing time range to reduce API calls'
        ]
    },
    ConfigurationError: {
        title: 'Configuration Error',
        steps: [
            'Check command-line arguments passed to serve.py',
            'Ensure group ID or project IDs are valid',
            'Verify time range format (e.g., "2 days ago" or "2025-01-10")'
        ]
    },
    NotFoundError: {
        title: 'Resource Not Found',
        steps: []
    },
    APIError: {
        title: 'GitLab API Error',
        steps: []
    }
};

/**
 * Escape HTML special characters to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} - Escaped HTML-safe text
 */
function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
```

---

## Testing These Fixes

### Test Timeout Protection
```javascript
// In browser console, add artificial delay:
const originalFetch = fetch;
window.fetch = function(...args) {
    return new Promise(resolve => {
        setTimeout(() => originalFetch(...args).then(resolve), 35000);
    });
};
// Now reload page - should show timeout error after 30s
```

### Test XSS Prevention
```javascript
// Inject malicious error message
const error = new Error('<img src=x onerror="alert(\'XSS\')">')
error.errorType = 'APIError';
formatError(error);
// Message should be escaped, not execute
```

### Test Error Message Data Separation
```javascript
// Should be testable without DOM
const errorData = formatErrorData(error);
const html = renderErrorHTML(errorData);
// Can assert on data independent of HTML rendering
```

---

## Validation Checklist

After applying these fixes:

- [ ] Pagination requests timeout after 30 seconds
- [ ] No console errors about unhandled rejections
- [ ] Error messages with HTML/quotes don't break page
- [ ] Response parse failures logged at DEBUG level
- [ ] API timeout errors show helpful message to user
- [ ] No memory growth over 100+ requests

---

## Timeline for Fixes

**Immediate (before next commit)**:
1. Fix 1: Pagination timeout
2. Fix 2: XSS protection
3. Fix 3: Response parse logging

**Next review cycle**:
4. Fix 4: AbortController refactor
5. Fix 5: Error message data structure

**Nice to have**:
- Structured logging throughout
- Partial failure warnings shown to user
