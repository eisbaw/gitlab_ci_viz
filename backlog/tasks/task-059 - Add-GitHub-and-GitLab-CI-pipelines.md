---
id: task-059
title: Add GitHub and GitLab CI pipelines
status: Done
assignee:
  - '@claude'
created_date: '2025-11-25 21:12'
updated_date: '2025-11-25 21:26'
labels: []
dependencies: []
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
Add CI/CD pipelines for both GitHub and GitLab that call justfile recipes for linting and testing. Reference: https://github.com/eisbaw/rule72/blob/main/.github/workflows/ci.yml
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Add GitHub Actions workflow (.github/workflows/ci.yml) that calls justfile recipes
- [x] #2 Add GitLab CI pipeline (.gitlab-ci.yml) that calls the same justfile recipes
- [x] #3 CI should run lint and test recipes
- [x] #4 Both CI configurations should use nix-shell for reproducible environment
<!-- AC:END -->

## Implementation Plan

<!-- SECTION:PLAN:BEGIN -->
1. Create .github/workflows/ci.yml using cachix/install-nix-action and calling just lint and just test
2. Create .gitlab-ci.yml using nixos/nix Docker image and calling the same just recipes
3. Both configurations will ensure nix-shell environment is used
4. Test locally if possible or validate syntax
5. Update README.md to mention CI pipelines if appropriate
<!-- SECTION:PLAN:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Added CI pipelines for both GitHub and GitLab:

- GitHub Actions workflow (.github/workflows/ci.yml) with two jobs (lint, test)
- GitLab CI pipeline (.gitlab-ci.yml) with two stages (lint, test)
- Both use nix-shell for reproducible environment
- Both call justfile recipes (just lint, just test)
- GitHub uses cachix/install-nix-action@v30
- GitLab uses nixos/nix:latest Docker image
- Both configured with nixos-unstable channel for consistency with project shell.nix
<!-- SECTION:NOTES:END -->
