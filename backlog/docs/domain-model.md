# CI/CD Activity Intelligence Domain Model

## Overview

This document defines the core domain concepts, ubiquitous language, and business value framework for the GitLab CI GANTT Visualizer. The domain model ensures that the implementation serves user needs by providing intelligence about CI/CD activity patterns rather than just technical visualization.

## Core Domain Concepts

### 1. Activity Pattern

**Definition**: A recurring or notable temporal pattern in CI/CD execution across projects and team members.

**Business Value**: Understanding activity patterns helps teams:
- Identify peak usage times that may require additional runner capacity
- Recognize when pipelines typically succeed or fail
- Spot unusual activity that might indicate issues or urgent work

**Manifestations**:
- **Temporal clustering**: Multiple pipelines running simultaneously
- **Regular cadence**: Daily deployment patterns, nightly build schedules
- **Anomalies**: Unusual activity outside normal patterns

**Implementation**: Visualized through timeline density, overlapping ranges, and temporal distribution.

### 2. Workflow

**Definition**: The complete execution lifecycle of a pipeline, including all jobs, from creation to completion.

**Business Value**: Workflows reveal:
- How long end-to-end processes take
- Where time is spent in the pipeline
- Which stages or jobs are bottlenecks

**Components**:
- **Pipeline**: The container workflow representing the entire CI/CD run
- **Jobs**: Individual units of work within a pipeline
- **Stages**: Logical groupings of jobs (implicit in job organization)
- **Status progression**: created → pending → running → completed (success/failed/canceled)

**Implementation**: Hierarchical visualization (User → Pipeline → Jobs) with temporal positioning showing execution flow.

### 3. Resource Contention

**Definition**: Competition for shared CI/CD resources (runners, infrastructure) when multiple workflows execute concurrently.

**Business Value**: Identifying contention helps teams:
- Understand why pipelines queue or delay
- Right-size runner infrastructure
- Schedule long-running jobs to avoid conflicts
- Optimize pipeline timing to reduce costs

**Indicators**:
- **Temporal overlap**: Multiple pipelines running at the same time
- **Queue duration**: Time between creation and start
- **Execution density**: Number of concurrent activities in a time window

**Implementation**: Visualized through overlapping timeline items, stacking within groups, and pending-to-running transitions.

### 4. Team Member Workload

**Definition**: The distribution and intensity of CI/CD activity attributed to individual team members.

**Business Value**: Understanding workload helps:
- Identify who is actively developing and deploying
- Balance work across the team
- Recognize high-activity periods for individuals
- Understand collaboration patterns

**Metrics**:
- **Pipeline frequency**: How often a user triggers pipelines
- **Temporal distribution**: When a user is active
- **Success rate**: Ratio of successful to failed pipelines
- **Activity duration**: How long pipelines take for each user

**Implementation**: User-centric grouping as the primary organization axis, with all pipelines nested under the triggering user.

### 5. Pipeline Lifecycle

**Definition**: The complete state transitions and temporal progression of a pipeline from creation to final outcome.

**Business Value**: Lifecycle understanding enables:
- Identifying where pipelines get stuck
- Measuring actual vs expected duration
- Recognizing patterns in failures
- Monitoring active pipelines in real-time

**States**:
- **Created**: Pipeline exists but hasn't started
- **Pending**: Waiting for resources to begin
- **Running**: Actively executing jobs
- **Completed**: Terminal state (success, failed, canceled)

**Temporal Characteristics**:
- **Creation time**: When the pipeline was initiated
- **Queue time**: Duration from creation to start
- **Execution time**: Duration from start to completion
- **Total lifecycle**: End-to-end duration

**Implementation**: Status-based color coding, temporal ranges showing lifecycle phases, and real-time updates for active pipelines.

## Ubiquitous Language Glossary

This glossary defines terms used consistently across code, documentation, and user interface.

### Primary Entities

| Term | Definition | Aliases / Related |
|------|------------|-------------------|
| **User** | A GitLab user who triggers CI/CD pipelines | Team Member, Developer, Triggering User |
| **Pipeline** | A complete CI/CD workflow execution containing multiple jobs | Workflow, Run, Build |
| **Job** | An individual unit of work within a pipeline | Task, Step, Stage Job |
| **Project** | A GitLab project containing source code and CI/CD configuration | Repository, Codebase |
| **Activity** | Any time-bound CI/CD execution (pipeline or job) visible on the timeline | Execution, Run |

### Temporal Concepts

| Term | Definition | Usage |
|------|------------|-------|
| **Timeline** | The horizontal time axis showing when activities occurred | "View last 7 days on the timeline" |
| **Range** | The time span of an activity from start to end | "Pipeline range shows execution duration" |
| **Since** | The starting point for the time window being visualized | "Show activity since 2 days ago" |
| **Active** | Currently running or pending (not yet completed) | "Active pipelines appear in blue" |
| **Completed** | Finished execution with a final state | "Completed pipelines show their actual duration" |

### Status Taxonomy

| Term | Definition | Visual Indicator |
|------|------------|------------------|
| **Success** | Completed with all jobs passing | Green |
| **Failed** | Completed with one or more job failures | Red |
| **Running** | Currently executing | Blue |
| **Pending** | Created but not yet started (waiting for resources) | Gray |
| **Canceled** | Manually stopped before completion | Orange |
| **Skipped** | Intentionally not executed based on conditions | Gray |

### Organizational Concepts

| Term | Definition | Implementation |
|------|------------|----------------|
| **Group** | A visual container organizing related items | vis.js group hierarchy |
| **Nested Group** | Child container within a parent group | User → Pipeline → Job hierarchy |
| **Collapse/Expand** | Show or hide nested children of a group | vis.js `showNested` property |
| **Hierarchy** | The three-level structure: User > Pipeline > Job | Primary organizational model |

### Intelligence Concepts

| Term | Definition | Business Value |
|------|------------|----------------|
| **Contention** | Multiple activities competing for resources | Identify infrastructure bottlenecks |
| **Workload** | Volume and distribution of activity per user | Understand team activity patterns |
| **Pattern** | Recurring temporal or behavioral characteristics | Predict resource needs, spot anomalies |
| **Lifecycle** | Complete progression through states over time | Understand where delays occur |

## User Mental Model

Understanding how users think about CI/CD activity informs the domain model and UI design.

### Primary User Perspectives

#### 1. Team Lead / Manager Perspective

**Mental Model**: "Who is working on what, and how is the work progressing?"

**Needs**:
- See all team activity in one view
- Identify who is actively developing
- Understand resource usage across projects
- Spot patterns indicating problems (repeated failures, long queues)

**Domain Mapping**:
- **User-centric organization** maps to "who is working"
- **Pipeline hierarchy** maps to "what they're working on"
- **Temporal visualization** maps to "when and how long"
- **Status colors** map to "how it's progressing"

#### 2. DevOps Engineer Perspective

**Mental Model**: "Are runners keeping up, and where are the bottlenecks?"

**Needs**:
- See when pipelines overlap (resource contention)
- Identify long-running jobs
- Understand queue times and delays
- Determine if more runners are needed

**Domain Mapping**:
- **Temporal overlap** maps to "resource contention"
- **Pending duration** maps to "queue times"
- **Job-level detail** maps to "bottleneck identification"
- **Multi-project view** maps to "overall system load"

#### 3. Developer Perspective

**Mental Model**: "Is my pipeline running, and how long will it take?"

**Needs**:
- See own pipeline status
- Compare with typical duration
- Identify which jobs are slow
- Monitor progress in real-time

**Domain Mapping**:
- **User grouping** maps to "my pipelines"
- **Job breakdown** maps to "which jobs are slow"
- **Real-time updates** maps to "monitor progress"
- **Historical context** maps to "typical duration"

### Navigation Mental Model

Users think about CI/CD activity in these dimensions:

1. **Who**: Which team member triggered it (primary axis)
2. **What**: Which project and pipeline
3. **When**: Time of day, day of week, relative to now
4. **How long**: Duration from start to finish
5. **Outcome**: Did it succeed or fail

The domain model and UI hierarchy (User → Pipeline → Job) directly reflects this mental model.

## Success Metrics

Metrics that measure whether the tool delivers value to users.

### Functional Success Metrics

| Metric | Target | Rationale |
|--------|--------|-----------|
| **Time to first insight** | < 5 seconds | Users should quickly see activity patterns |
| **Time range coverage** | 7+ days for 10+ projects | Sufficient context for pattern recognition |
| **Data freshness** | ≤ 60 seconds lag | Real-time monitoring of active pipelines |
| **Visual clarity** | Identify overlaps at a glance | Resource contention must be obvious |
| **Drill-down speed** | Expand/collapse ≤ 1 second | Smooth navigation between levels |

### User Value Metrics

| Metric | Success Indicator | User Benefit |
|--------|-------------------|--------------|
| **Bottleneck identification** | User can name slowest job within 10 seconds | Faster optimization cycles |
| **Contention visibility** | User can spot peak usage times visually | Better runner capacity planning |
| **Team awareness** | User knows who is active without asking | Reduced coordination overhead |
| **Pattern recognition** | User notices recurring issues in < 1 minute | Proactive problem resolution |
| **Status confidence** | User trusts displayed state matches reality | Reduced manual verification |

### Technical Success Metrics

| Metric | Target | Impact |
|--------|--------|--------|
| **API call efficiency** | < 100 calls for 10 projects over 7 days | Stay within rate limits |
| **Initial load time** | < 10 seconds for typical use case | Acceptable wait for value |
| **Browser memory** | < 200MB for 1000 activities | Stable for large datasets |
| **Update latency** | < 2 seconds for incremental refresh | Smooth real-time experience |

## Value Proposition Framework

### Core Value: **CI/CD Activity Intelligence**

The tool transforms raw GitLab API data into actionable intelligence about team activity, resource usage, and workflow patterns.

### Value Hierarchy

1. **Primary Value**: **Unified Temporal View**
   - See all CI/CD activity across projects in one timeline
   - Understand "what happened when" across the entire team

2. **Secondary Value**: **Resource Intelligence**
   - Identify when and where contention occurs
   - Optimize runner capacity and job scheduling

3. **Tertiary Value**: **Team Coordination**
   - Understand who is working on what
   - Recognize collaboration patterns and workload distribution

### Value Realization Scenarios

#### Scenario 1: Identifying Runner Bottlenecks

**User Story**: As a DevOps engineer, I notice pipelines taking longer than usual.

**Tool Value**:
1. Open visualizer with last 24 hours
2. Visually identify temporal clustering (many overlapping pipelines)
3. Observe long pending durations before pipelines start
4. Correlate high-activity periods with slowdowns
5. **Outcome**: Add runners during peak hours, reducing queue times

#### Scenario 2: Understanding Team Activity

**User Story**: As a team lead, I want to understand who is actively deploying.

**Tool Value**:
1. Open visualizer with last week
2. Scan user groups to see distribution of activity
3. Notice one user has many failed pipelines
4. Expand to see which jobs are failing
5. **Outcome**: Proactive help offered, issue resolved quickly

#### Scenario 3: Optimizing Pipeline Duration

**User Story**: As a developer, my pipelines seem slower than before.

**Tool Value**:
1. Open visualizer filtered to my pipelines
2. Compare recent durations with historical average
3. Expand pipeline to see job-level timing
4. Identify one job taking 80% of pipeline time
5. **Outcome**: Optimize slow job, reduce overall pipeline time

## Domain Boundaries

### What Is In Scope

- **Activity Intelligence**: Understanding patterns, contention, workload
- **Temporal Visualization**: When things happened and for how long
- **User-Centric Organization**: Who triggered what
- **Status Awareness**: Current state of pipelines and jobs
- **Multi-Project Aggregation**: Unified view across projects

### What Is Out of Scope

- **Pipeline Triggering**: Tool is read-only, no ability to start pipelines
- **Configuration Management**: No editing of `.gitlab-ci.yml`
- **Deep Job Logs**: Visualization only, detailed logs in GitLab UI
- **Performance Metrics**: Duration visibility, but not CPU/memory profiling
- **Alerts/Notifications**: Passive visualization, no active monitoring
- **Historical Trends**: Real-time + recent history, not long-term analytics
- **Cross-Instance Aggregation**: Single GitLab instance only

## Domain Model Evolution

### Current State (MVP)

- User-centric three-level hierarchy
- Basic temporal visualization
- Status-based color coding
- Collapse/expand navigation

### Potential Future Extensions

1. **Enhanced Intelligence**
   - Pattern detection algorithms
   - Anomaly highlighting
   - Predictive duration estimates

2. **Advanced Organization**
   - Runner-centric view (group by runner instead of user)
   - Project-centric view (group by project instead of user)
   - Stage-level visualization (show pipeline stages explicitly)

3. **Filtering & Search**
   - Filter by status, project, time range
   - Search by pipeline ID, job name
   - Saved views and bookmarks

4. **Deeper Context**
   - Commit information display
   - Branch/tag attribution
   - Merge request correlation

## Consistency Principles

To maintain domain integrity throughout the codebase:

1. **Use domain terms consistently**: "Pipeline" not "build", "User" not "actor"
2. **Respect hierarchy**: User → Pipeline → Job is the canonical organization
3. **Temporal precision**: Always use ISO 8601 timestamps, UTC timezone
4. **Fail fast on bad data**: Invalid timestamps or missing required fields throw errors
5. **User-facing language**: Match GitLab's terminology where users expect it
6. **Code clarity**: Domain classes mirror concepts (User, Pipeline, Job)

## References

- **PRD**: `/home/mpedersen/topics/gitlab_ci_viz/PRD.md` - Product requirements and technical specifications
- **GitLab API**: https://docs.gitlab.com/ee/api/pipelines.html - Source of truth for data model
- **vis.js Timeline**: https://visjs.github.io/vis-timeline/docs/timeline/ - Visualization library concepts
