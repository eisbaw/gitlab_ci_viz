---
id: task-047
title: Replace handler class state with closure or instance attributes
status: To Do
assignee: []
created_date: '2025-11-14 04:16'
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
- [ ] #1 Handler uses closure or instance attributes for config
- [ ] #2 No class-level mutable state remains
- [ ] #3 Tests verify handler isolation
<!-- AC:END -->
