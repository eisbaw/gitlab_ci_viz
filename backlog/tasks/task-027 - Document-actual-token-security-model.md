---
id: task-027
title: Document actual token security model
status: To Do
assignee: []
created_date: '2025-11-13 15:42'
labels:
  - security
  - documentation
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Document the real security properties of token handling, actual threat model, and limitations to prevent misleading security claims and guide safe usage
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Document where token is actually visible (browser memory, DevTools, extensions)
- [ ] #2 Document actual threat model (what we protect against vs what we don't)
- [ ] #3 Document why this approach is acceptable for localhost dev tool
- [ ] #4 Add warning that refuses to serve on non-localhost without explicit override
- [ ] #5 Add token redaction in all error messages and logs
- [ ] #6 Documentation added to README.md security section
<!-- AC:END -->
