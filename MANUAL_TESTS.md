# Manual End-to-End Test Suite

This document describes manual tests to validate the GitLab CI GANTT Visualizer with various configurations.

## Test Environment Setup

### Prerequisites
- GitLab account with access to projects and groups
- `glab` CLI authenticated (`glab auth login`)
- Development environment ready (`nix-shell`)

## Unit and Integration Tests

### Automated Tests
```bash
# Run all unit tests
nix-shell --run "just test"

# Expected: 52 tests pass, 87% coverage
# Coverage requirement: >90% (currently 87% - uncovered code is server startup logic)
```

### HTML Integration Tests
```bash
# Start server
python serve.py --group <your-group-id> --since '1 day ago'

# Open in browser:
http://localhost:8000/test/test-data-transformer.html
http://localhost:8000/test/test-api-integration.html
http://localhost:8000/test/test-error-message-ux.html

# Expected: All tests show green checkmarks
```

## Manual End-to-End Tests

### Test 1: Single Project with Various Time Ranges

#### Test 1.1: Recent Activity (Hours)
```bash
python serve.py --projects <project-id> --since "6 hours ago"
```
**Expected Results:**
- ✓ Timeline shows last 6 hours of pipeline activity
- ✓ User groups appear for pipeline triggers
- ✓ Pipelines show correct start time and duration
- ✓ Jobs within pipelines are visible and color-coded

#### Test 1.2: Recent Activity (Days)
```bash
python serve.py --projects <project-id> --since "3 days ago"
```
**Expected Results:**
- ✓ Timeline shows last 3 days of pipeline activity
- ✓ Time scale adjusts appropriately
- ✓ All pipelines within range are visible

#### Test 1.3: Longer Range (Weeks)
```bash
python serve.py --projects <project-id> --since "2 weeks ago"
```
**Expected Results:**
- ✓ Timeline shows last 2 weeks of pipeline activity
- ✓ Timeline remains navigable and performant
- ✓ Zoom and pan work smoothly

#### Test 1.4: Absolute Date
```bash
python serve.py --projects <project-id> --since "2025-01-01"
```
**Expected Results:**
- ✓ Timeline shows activity from specified date to now
- ✓ Date parsing works correctly

### Test 2: Multiple Projects

#### Test 2.1: Two Projects
```bash
python serve.py --projects <project-id-1>,<project-id-2> --since "1 day ago"
```
**Expected Results:**
- ✓ Pipelines from both projects appear in timeline
- ✓ User groups aggregate pipelines across projects
- ✓ Project names are visible in pipeline tooltips/labels
- ✓ Color coding distinguishes pipeline status

#### Test 2.2: Many Projects (5+)
```bash
python serve.py --projects <id1>,<id2>,<id3>,<id4>,<id5> --since "2 days ago"
```
**Expected Results:**
- ✓ All projects load successfully
- ✓ Timeline remains responsive
- ✓ User groups properly aggregate across all projects

### Test 3: Group-Based Project Discovery

#### Test 3.1: Small Group
```bash
python serve.py --group <small-group-id> --since "1 day ago"
```
**Expected Results:**
- ✓ All projects in group are discovered
- ✓ Pipelines from all group projects appear
- ✓ User grouping works across all group projects

#### Test 3.2: Large Group
```bash
python serve.py --group <large-group-id> --since "12 hours ago"
```
**Expected Results:**
- ✓ Group projects are fetched (may take longer)
- ✓ Performance remains acceptable
- ✓ All projects are included

### Test 4: Projects with Many Pipelines (Pagination)

```bash
python serve.py --projects <busy-project-id> --since "7 days ago"
```
**Expected Results:**
- ✓ GitLab API pagination is handled correctly
- ✓ All pipelines within time range are fetched
- ✓ No duplicate pipelines appear
- ✓ Performance remains acceptable
- ✓ Console shows pagination progress (if implemented)

### Test 5: Performance Test (10+ Projects, 7 Days)

```bash
python serve.py --group <large-group-id> --since "7 days ago"
# OR
python serve.py --projects <id1>,<id2>,...,<id10> --since "7 days ago"
```
**Performance Requirements:**
- ✓ Initial load completes in < 30 seconds
- ✓ Timeline rendering is smooth
- ✓ Zoom and pan operations are responsive (< 500ms)
- ✓ Auto-refresh doesn't cause UI freezing
- ✓ Memory usage remains stable over time

**Metrics to Check:**
- Browser DevTools → Performance tab
- Network tab → API request timing
- Memory tab → Heap size over time

### Test 6: Interactive Features

For any of the above configurations, verify:

#### Collapse/Expand
- ✓ User groups can be collapsed/expanded
- ✓ Pipeline groups can be collapsed/expanded
- ✓ State persists during session
- ✓ Collapsed items show summary information

#### Timeline Navigation
- ✓ Zoom in/out works smoothly
- ✓ Pan left/right works
- ✓ Double-click zoom to fit works
- ✓ Timeline controls are responsive

#### Auto-Refresh
- ✓ Timeline refreshes at configured interval (default 60s)
- ✓ Last update timestamp is displayed
- ✓ Refresh doesn't lose zoom/pan position
- ✓ Running pipelines update correctly
- ✓ Completed pipelines update status

#### Status Visualization
- ✓ Success pipelines: Green
- ✓ Failed pipelines: Red
- ✓ Running pipelines: Blue
- ✓ Pending pipelines: Gray
- ✓ Canceled pipelines: Orange

### Test 7: Error Handling

#### Test 7.1: Invalid Configuration
```bash
# Missing required args
python serve.py --since "1 day ago"
# Expected: Clear error message

# Invalid time spec
python serve.py --group 123 --since "invalid"
# Expected: Clear error message with supported formats

# Invalid port
python serve.py --group 123 --since "1 day ago" --port 99999
# Expected: Error about invalid port range
```

#### Test 7.2: Authentication Issues
```bash
# Logout from glab
glab auth logout

# Try to run
python serve.py --group 123 --since "1 day ago"
# Expected: Clear error about authentication
```

#### Test 7.3: Network/API Issues
- Disconnect network during operation
- **Expected:** Error messages are user-friendly
- **Expected:** Console shows detailed error for debugging

## Test Results Documentation

### Test Execution Date: [TO BE FILLED]

| Test Case | Status | Notes |
|-----------|--------|-------|
| Unit Tests (87% coverage) | ✓ | 52/52 passed |
| HTML Integration Tests | ✓ | All green checkmarks |
| Single Project - Hours | ⏳ | Requires manual testing |
| Single Project - Days | ⏳ | Requires manual testing |
| Single Project - Weeks | ⏳ | Requires manual testing |
| Single Project - Absolute Date | ⏳ | Requires manual testing |
| Multiple Projects (2) | ⏳ | Requires manual testing |
| Multiple Projects (5+) | ⏳ | Requires manual testing |
| Group Discovery - Small | ⏳ | Requires manual testing |
| Group Discovery - Large | ⏳ | Requires manual testing |
| Pagination Handling | ⏳ | Requires manual testing |
| Performance (10+ projects, 7 days) | ⏳ | Requires manual testing |
| Collapse/Expand | ⏳ | Requires manual testing |
| Timeline Navigation | ⏳ | Requires manual testing |
| Auto-Refresh | ⏳ | Requires manual testing |
| Status Colors | ⏳ | Requires manual testing |
| Error Handling | ⏳ | Requires manual testing |

## Performance Baseline

| Metric | Target | Actual |
|--------|--------|--------|
| 10+ projects, 7 days load time | < 30s | [TBD] |
| Timeline zoom/pan responsiveness | < 500ms | [TBD] |
| Memory usage (1 hour operation) | < 200MB | [TBD] |
| Auto-refresh impact | No UI freeze | [TBD] |

## Notes

- Coverage is 87%, below 90% target. Uncovered code is primarily server startup logic (lines 236-237, 314-343, 347-349, 354-407, 411 in serve.py)
- Server startup code is integration-level and difficult to unit test
- HTML-based integration tests provide coverage for API client and data transformation logic
- Manual tests above should be performed with real GitLab instance
- Test results should be documented when executed
