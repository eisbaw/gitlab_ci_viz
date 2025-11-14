---
id: task-055
title: Remove unsafe timeline window state preservation
status: To Do
assignee: []
created_date: '2025-11-14 07:05'
labels:
  - architecture
  - ui
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Auto-refresh mechanism preserves timeline viewport window without validating against new data, which can result in showing empty or partial timeline when new data exists outside the preserved view. This violates fail-fast principles and single source of truth.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Timeline window state preservation logic removed from auto-refresh
- [ ] #2 Timeline auto-fits to new data on refresh
- [ ] #3 Integration test verifies timeline shows all data after refresh
<!-- AC:END -->
