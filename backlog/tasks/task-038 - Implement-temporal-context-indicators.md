---
id: task-038
title: Implement temporal context indicators
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:50'
updated_date: '2025-11-14 02:10'
labels:
  - frontend
  - usability
  - feature
dependencies: []
priority: medium
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Provide clear temporal framing so users understand the recency and relevance of displayed CI/CD activity
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Timeline displays 'now' marker line for current time
- [x] #2 Activity window clearly labeled (e.g., 'Last 7 Days: Jan 6 - Jan 13')
- [x] #3 Visual distinction between completed and ongoing activity
- [x] #4 Relative time labels where appropriate (e.g., tooltips show '2 hours ago')
- [x] #5 Current time updates on auto-refresh
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify AC#1 (now marker) - already implemented via showCurrentTime
2. Implement AC#2 - Add activity window label
3. Implement AC#3 - Visual distinction for completed vs ongoing (already exists via status colors)
4. Implement AC#4 - Add relative time tooltips
5. Implement AC#5 - Update current time on auto-refresh
6. Test all features
7. Check all acceptance criteria
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Implemented temporal context indicators with proper architectural separation.

## Implementation

**Activity Window Label (AC#2)**
- Added time-range-label div displaying activity window
- Uses DataTransformer.formatTimeRange() for business logic
- Calculates duration label (hours/days/weeks) and date range
- Updates on auto-refresh to reflect current time
- Styled with info-blue background for visibility

**Relative Time Tooltips (AC#4)**
- Added DataTransformer.formatRelativeTime() helper (single source)
- Enhanced pipeline tooltips with "Started: X ago" or "Created: X ago"
- Enhanced job tooltips with relative time and duration
- Tooltips show: name, status, relative start time, duration
- Format handles: "just now", minutes, hours, days, weeks

**Time Range Formatting (new)**
- Added DataTransformer.formatTimeRange() with fail-fast validation
- Validates input timestamp and throws descriptive error on invalid format
- Centralizes date formatting logic in domain layer
- Returns structured {durationLabel, startDateStr, endDateStr}

**Visual Distinction (AC#3)**
- Already implemented via existing status color coding
- Running items: blue, completed: green, failed: red, etc.
- No changes needed

**Now Marker (AC#1)**
- Already implemented via vis.js showCurrentTime: true
- No changes needed

**Current Time Updates (AC#5)**
- vis.js automatically updates current time marker
- Activity window label refreshes on auto-refresh
- No additional changes needed

## Architectural Improvements

**Fixed Code Duplication**
- Removed duplicate formatRelativeTime() from index.html
- Single source of truth in DataTransformer module

**Proper Separation of Concerns**
- Extracted time range calculation to DataTransformer.formatTimeRange()
- Business logic now in domain layer, presentation in HTML
- updateTimeRangeLabel() only handles DOM updates

**Added Error Handling**
- formatTimeRange() validates input and fails fast on invalid timestamps
- Descriptive error messages guide debugging

## Files Modified
- index.html: Added time-range-label div, simplified updateTimeRangeLabel()
- static/data-transformer.js: Added formatTimeRange(), formatRelativeTime(), formatDuration(), tooltip creators

## Testing
- All 54 unit tests passing
- 87% code coverage maintained
- Visual features require browser testing for full validation
<!-- SECTION:NOTES:END -->
