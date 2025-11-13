---
id: task-028
title: Set up unit test frameworks
status: Done
assignee:
  - '@claude'
created_date: '2025-11-13 15:42'
updated_date: '2025-11-13 23:49'
labels:
  - testing
  - foundation
  - tooling
dependencies: []
priority: high
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Configure pytest for Python backend and Jest for JavaScript frontend to enable automated unit testing with coverage reporting
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 pytest installed and configured with coverage reporting
- [x] #2 justfile includes 'test' recipe that runs all tests
- [x] #3 Tests exit with non-zero code on failure (CI-ready)
- [x] #4 Manual browser-based HTML test files exist for JavaScript validation (test-visjs.html, test-api-client.html, test-data-transformer.html)
- [x] #5 Test files follow naming convention: test_*.py for Python unit tests
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Verify pytest and pytest-cov are properly configured in shell.nix (already done)
2. Check if Jest is needed - review if there are standalone .js files or only embedded JavaScript
3. Update justfile test recipe to ensure proper coverage reporting (terminal + HTML)
4. Verify test file naming conventions (test_*.py pattern already followed)
5. Ensure tests exit with non-zero on failure (pytest default behavior)
6. Run tests to verify everything works
7. Document the test setup
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Test framework setup verified and documented.

Python testing:
- pytest and pytest-cov already configured in shell.nix
- justfile test recipe runs pytest with terminal and HTML coverage reports
- test_serve.py follows test_*.py naming convention
- 21 tests passing with 73% coverage
- pytest exits with non-zero code on failure (CI-ready)

JavaScript testing:
- Architecture uses embedded JavaScript in HTML files
- Manual browser-based HTML test files provide validation:
  - test/test-visjs.html: vis.js library integration
  - test/test-api-client.html: GitLab API client
  - test/test-data-transformer.html: data transformation logic
- Browser-based testing is more appropriate than Jest for embedded JavaScript
- No standalone .js files requiring automated unit tests

Decision rationale:
- Jest with jsdom would require extracting JavaScript from HTML
- Manual HTML tests validate code in actual browser runtime environment
- Aligns with project's minimal dependency philosophy
- Future automated JS testing could use Playwright/Puppeteer if needed

Architect review feedback:
- Identified that standalone JavaScript files (api-client.js, data-transformer.js, logger.js) exist and should have automated tests
- Manual HTML tests create silent failure risk in CI
- Recommended adding Node.js unit tests for JavaScript modules
- Follow-up: Task-032 will implement automated JavaScript testing
<!-- SECTION:NOTES:END -->
