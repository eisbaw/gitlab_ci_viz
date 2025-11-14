---
id: task-047
title: Replace handler class state with closure or instance attributes
status: Done
assignee:
  - '@claude'
created_date: '2025-11-14 04:16'
updated_date: '2025-11-14 04:50'
labels:
  - refactor
  - backend
dependencies: []
priority: low
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
ConfigInjectingHandler stores state on class (ConfigInjectingHandler.config_js) which violates minimal state principle. Should use closure or instance attributes instead.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Handler uses closure or instance attributes for config
- [x] #2 No class-level mutable state remains
- [x] #3 Tests verify handler isolation
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Review current handler implementation and identify class-level state
2. Refactor to use instance attributes instead of class variables
3. Update handler instantiation to pass config and token
4. Update tests to verify handler isolation
5. Run tests to ensure all pass
6. Run linting and build checks
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Refactored ConfigInjectingHandler to eliminate class-level mutable state.

Changes:
- Replaced class variables (config_js, token) with instance attributes
- Created factory function create_handler() that returns handler class with config/token bound via closure
- Updated main() to use factory: handler_class = create_handler(config_js, token)
- Added test_handler_isolation() to verify multiple handlers don't share state\n- Updated test_config_injection_flow() to test factory pattern\n\nAll 55 tests pass with 87% coverage. Handler instances are now fully isolated.
<!-- SECTION:NOTES:END -->
