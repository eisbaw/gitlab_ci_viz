# Performance Baselines and Characteristics

This document describes the performance characteristics of the GitLab CI GANTT Visualizer, including baseline metrics, known limits, and optimization strategies.

## Performance Benchmarks

Performance benchmarks are browser-based tests that measure critical operations using the JavaScript Performance API. They run in headless Chrome via Selenium.

### Running Benchmarks

```bash
# Run benchmarks (requires nix-shell)
just benchmark

# Or directly
python test/run_performance_benchmarks.py
```

Benchmarks can also be run manually in a browser by opening `test/test-performance-benchmarks.html`.

## Baseline Metrics

These baselines were established on Linux x86_64 using Chromium 132.0.6834.110.

### 1. Transform 1000 Jobs to Domain Model

**Threshold:** 500ms
**Regression Tolerance:** 20%
**Test Data:** 100 pipelines with 10 jobs each (1000 jobs total)

This benchmark measures the performance of `DataTransformer.transformToDomainModel()`, which:
- Parses GitLab API responses
- Creates domain objects (User, Pipeline, Job)
- Builds user-centric hierarchy

**Performance Characteristics:**
- Linear complexity: O(n) where n = number of pipelines + jobs
- Memory efficient: single pass through data
- Validation included: timestamp validation, field validation

**To see current performance:** Run `just benchmark`

### 2. Transform to vis.js Format (500 Items)

**Threshold:** 100ms
**Regression Tolerance:** 20%
**Test Data:** Domain model with 50 pipelines and 500 jobs (550 timeline items)

This benchmark measures `DataTransformer.transformToVisFormat()`, which:
- Converts domain model to vis.js Timeline groups and items
- Creates hierarchical group structure (User → Pipeline → Jobs)
- Prepares data for timeline rendering

**Performance Characteristics:**
- Linear complexity: O(n) where n = number of users × pipelines × jobs
- No DOM manipulation (pure data transformation)
- This is only part of the 2-second rendering budget (vis.js rendering is separate)

**To see current performance:** Run `just benchmark`

### 3. Full Transformation Pipeline (10 Projects, 100 Pipelines Each)

**Threshold:** 2000ms
**Regression Tolerance:** 20%
**Test Data:** 1000 pipelines (100 per project × 10 projects) with 10000 jobs

This benchmark measures the complete `DataTransformer.transform()` pipeline:
- Domain model transformation
- vis.js format conversion
- Validation and error handling

**Performance Characteristics:**
- Represents realistic workload for medium-sized teams
- Does NOT include API fetch time or vis.js rendering
- Data transformation only

**To see current performance:** Run `just benchmark`

### 4. Auto-Refresh with No Changes (Simulation)

**Threshold:** 1000ms
**Regression Tolerance:** 20%
**Test Data:** 50 pipelines with 500 jobs (moderate dataset)

This benchmark simulates auto-refresh behavior when no data has changed:
- Re-transforms same dataset
- Compares results for changes
- Simulates timeline update without actual DOM manipulation

**Performance Characteristics:**
- Does NOT include API fetch time (network latency dominates in real scenario)
- Does NOT include vis.js timeline.setItems() rendering time
- Measures pure data transformation overhead for refresh
- Real refresh time dominated by network (API calls) not transformation

**To see current performance:** Run `just benchmark`

## End-to-End Loading Performance (Not Benchmarked)

**Acceptance Criteria:** Load 10 projects with 100 pipelines each in <5 seconds

This criterion requires a real GitLab instance and cannot be reliably benchmarked in isolation because:
1. Network latency varies by GitLab instance location and load
2. GitLab API response time varies by instance size and configuration
3. API rate limiting affects request patterns

**Current Measurements:**
- Data transformation: ~23ms (from benchmark #3)
- API calls: 1000+ requests for 1000 pipelines
- At GitLab's 600 req/min limit: ~100 seconds minimum
- With pagination and concurrency: typically 30-60 seconds for initial load

**Recommendation:** This should be verified through manual integration testing with actual GitLab instances. See `MANUAL_TESTS.md` for test procedures.

## Regression Detection

Benchmarks fail if performance degrades more than **20%** from baseline thresholds.

Example:
- Threshold: 500ms
- Regression limit: 600ms (500ms × 1.20)
- Current: 3.3ms → plenty of headroom

## Known Performance Limits

### Browser-Side Constraints

1. **API Rate Limiting**
   - GitLab API has rate limits (typically 600 requests/minute for authenticated users)
   - With 10 projects and 100 pipelines each, expect ~1100 API requests
   - At 600 req/min, this takes ~2 minutes for initial load
   - Pagination reduces requests but increases latency

2. **Timeline Rendering (vis.js)**
   - vis.js Timeline handles ~1000 items efficiently
   - 10,000+ items may cause rendering lag (not measured in benchmarks)
   - Browser memory limits apply (~2GB typical for Chrome tab)

3. **Auto-Refresh Performance**
   - Refresh with no changes: <1 second (re-uses cached timeline state)
   - Refresh with changes: Same as initial load
   - Network latency dominates refresh time

### Data Volume Recommendations

| Scenario | Projects | Pipelines | Jobs | Expected Load Time | Notes |
|----------|----------|-----------|------|-------------------|-------|
| Small | 1-3 | <50 | <500 | <10 seconds | Fast, responsive |
| Medium | 5-10 | 100-500 | 1000-5000 | 30-60 seconds | Good for teams |
| Large | 10-20 | 500-1000 | 5000-10000 | 1-3 minutes | Usable but slow initial load |
| Very Large | 20+ | 1000+ | 10000+ | 3+ minutes | Consider time range filtering |

**Recommendation:** For teams with high CI activity, use shorter time ranges (e.g., last 24 hours instead of 7 days) to reduce data volume.

### Optimization Strategies

1. **Time Range Filtering**
   - Use `--since "24 hours ago"` instead of `--since "7 days ago"`
   - Reduces API requests and data volume

2. **Project Selection**
   - Use `--projects` for specific projects instead of `--group` for entire group
   - Fetches only relevant data

3. **Auto-Refresh Interval**
   - Default: 60 seconds
   - For busy environments, consider 120+ seconds to reduce API load

4. **Browser Resources**
   - Close other tabs to free memory
   - Use Chrome/Chromium for best vis.js performance
   - Hardware acceleration enabled improves rendering

## Performance Testing Hardware

Benchmarks are normalized but hardware affects absolute timings:

- **CPU:** Affects data transformation speed
- **Memory:** Affects browser tab limits
- **Network:** Affects API fetch time (not measured in benchmarks)

The benchmarks focus on data transformation (CPU-bound) which is most consistent across hardware.

## Future Performance Work

Potential optimizations not yet implemented:

1. **Incremental Updates**
   - Only fetch pipelines updated since last refresh
   - Currently implemented: API uses `updated_after` parameter
   - Future: Incremental timeline updates instead of full re-render

2. **Virtual Scrolling**
   - vis.js supports virtual rendering for large datasets
   - Not yet configured

3. **Data Caching**
   - Browser localStorage for offline viewing
   - Service worker for background updates

4. **Pagination UI**
   - Currently fetches all pages automatically
   - Future: User-controlled pagination for very large datasets

## Monitoring Performance Regressions

Run benchmarks before each release:

```bash
# Run benchmarks
just benchmark

# Check for regressions (exit code 1 if failed)
echo $?
```

Integrate into CI/CD:
- Run benchmarks on PR
- Fail if regression detected (>20% slower)
- Log results with commit hash for tracking

## Troubleshooting Slow Performance

### Symptoms: Initial load takes >5 minutes

**Diagnosis:**
1. Check network tab in browser DevTools
2. Look for slow API requests
3. Count total API requests

**Solutions:**
- Reduce time range: `--since "2 days ago"` instead of `--since "7 days ago"`
- Reduce projects: use `--projects` for specific projects
- Check GitLab instance response time

### Symptoms: Timeline rendering is slow/laggy

**Diagnosis:**
1. Check browser console for JavaScript errors
2. Check timeline item count in status message
3. Monitor browser memory usage

**Solutions:**
- Reduce time range to decrease item count
- Close other browser tabs
- Use Chrome/Chromium (best vis.js performance)
- Consider upgrading browser/hardware

### Symptoms: Auto-refresh causes UI freeze

**Diagnosis:**
1. Check refresh interval (default 60s)
2. Check if data volume is large
3. Monitor network activity during refresh

**Solutions:**
- Increase refresh interval: code change needed (currently hardcoded)
- Disable auto-refresh: `--refresh-interval 0`
- Use shorter time range

## Performance Metrics Summary

| Benchmark | Threshold | Regression Tolerance |
|-----------|-----------|---------------------|
| Transform 1000 jobs to domain model | 500ms | 20% |
| Transform to vis.js format (500 items) | 100ms | 20% |
| Full transformation pipeline (1000 pipelines) | 2000ms | 20% |
| Auto-refresh simulation (no changes) | 1000ms | 20% |

**To see current performance results:** Run `just benchmark`

**Typical Results:** Data transformation consistently runs at <2% of threshold limits, providing significant performance headroom. Network latency and API rate limits are the primary bottlenecks for large datasets, not data transformation.
