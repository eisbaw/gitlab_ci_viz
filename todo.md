# TODO

## Critical - Architectural Concerns

### State Preservation Violates MPED Principles
**Context**: The state preservation code (index.html lines 1048-1085) re-introduces logic that was intentionally removed in task-055 (commit cac6889).

**Issues**:
- Violates single source of truth: Creates duplicate state (savedWindow, expandedGroups) that can diverge from actual data
- Violates fail-fast principle: Silently shows empty viewport when preserved state doesn't match new data
- No validation that saved state matches new data structure

**Options**:
1. Remove state preservation entirely (revert to task-055 approach)
2. Redesign as opt-in feature with validation and fail-fast error handling
3. Implement auto-fit viewport with smart zoom instead of blind restoration

**Decision needed**: Accept architectural trade-off for UX, or fix the root cause properly?

## High Priority - Performance & Robustness

### Optimize enrichTimelineItems with Map Lookups
**Location**: index.html, enrichTimelineItems function

**Current**: O(n) linear search through jobs array for each item
**Better**: Create `jobMap = new Map(jobs.map(j => [j.id, j]))` for O(1) lookups

**Impact**: Constant factor improvement, especially noticeable with 1000+ jobs

### Improve Project Grouping Validation
**Location**: static/data-transformer.js, transformToDomainModel()

**Issues**:
- Variable names (userId, username) misleading when representing projects
- Silent fallback when project not found (no logging)
- Empty projectMap (size=0) treated as "use project grouping" instead of "use user grouping"

**Actions**:
1. Rename variables: `groupId`, `groupKey`, `groupDisplayName`
2. Add logging: `console.warn()` when project not found in projectMap
3. Check `if (projectMap && projectMap.size > 0)` instead of just `if (projectMap)`

## Medium Priority - Testing

### JavaScript Integration Test Failures
**Location**: test/test-api-integration.html

**Failing Tests**:
- Complete data flow test
- Rate limit handling
- Empty result handling
- Performance test with 50 pipelines

**Status**: Tests pass manually in browser but fail in headless Chrome
**Next Step**: Investigate if this is environmental issue or real bug

### Add Test Coverage for Edge Cases
**Missing Coverage**:
1. Project-based grouping edge cases (empty map, missing projects, mode switching)
2. enrichTimelineItems with malformed data (missing IDs, not found in arrays)
3. Race conditions (filter changes during fetch, multiple simultaneous refreshes)

## Low Priority

### Update glab CLI
**Current**: 1.51.0
**Latest**: 1.77.0
**Impact**: None on functionality, but newer version available
