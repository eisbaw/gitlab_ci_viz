---
id: task-018
title: Implement auto-refresh mechanism
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:24'
updated_date: '2025-11-14 01:09'
labels:
  - frontend
  - feature
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add JavaScript polling to periodically fetch updated data from GitLab API and refresh the timeline without full page reload
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Data refreshes every 60 seconds by default
- [x] #2 Timeline updates without losing user's zoom/pan state
- [x] #3 Only new/updated pipelines fetched on refresh
- [x] #4 Refresh interval configurable via injected config
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Add refreshInterval config parameter (default 60s) to serve.py and inject into CONFIG
2. Create refresh mechanism in index.html that preserves zoom/pan state
3. Track last refresh timestamp and only fetch updated pipelines
4. Display last update timestamp in status area
5. Test refresh mechanism manually and verify state preservation
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented auto-refresh mechanism with the following features:

- Added --refresh-interval CLI argument (default 60s, 0 to disable)
- Injected refreshInterval config into JavaScript CONFIG object
- Created scheduleAutoRefresh() function that uses setTimeout for periodic refresh
- Modified fetchAndRender() to preserve timeline zoom/pan state during refresh
- Track lastRefreshTime to only fetch updated pipelines on refresh (incremental updates)
- Display last update timestamp in status message
- Updated all 15 test cases to include refresh_interval parameter

All acceptance criteria met:
1. Data refreshes every 60 seconds by default (configurable)
2. Timeline updates preserve user zoom/pan state via getWindow()/setWindow()
3. Only new/updated pipelines fetched on refresh using lastRefreshTime
4. Refresh interval configurable via --refresh-interval CLI argument
<!-- SECTION:NOTES:END -->
