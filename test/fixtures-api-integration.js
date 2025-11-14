/**
 * Realistic API Fixtures for Integration Testing
 *
 * Contains mock GitLab API responses for:
 * - Multi-page results (pagination)
 * - Rate limiting scenarios
 * - Error conditions
 * - Large datasets
 */

const API_FIXTURES = {
    // Projects fixture - 3 projects
    projects: [
        {
            id: 101,
            name: "backend-api",
            path_with_namespace: "team/backend-api",
            web_url: "https://gitlab.example.com/team/backend-api"
        },
        {
            id: 102,
            name: "frontend-app",
            path_with_namespace: "team/frontend-app",
            web_url: "https://gitlab.example.com/team/frontend-app"
        },
        {
            id: 103,
            name: "infra-tools",
            path_with_namespace: "team/infra-tools",
            web_url: "https://gitlab.example.com/team/infra-tools"
        }
    ],

    // Pipelines - Page 1 (30 items)
    pipelines_page1: Array.from({ length: 30 }, (_, i) => ({
        id: 1000 + i,
        project_id: 101,
        status: ['success', 'failed', 'running'][i % 3],
        ref: 'main',
        sha: `abc${i}`.padEnd(40, '0'),
        created_at: new Date(Date.now() - (30 - i) * 3600000).toISOString(),
        updated_at: new Date(Date.now() - (30 - i) * 3600000 + 600000).toISOString(),
        started_at: new Date(Date.now() - (30 - i) * 3600000 + 60000).toISOString(),
        finished_at: i % 3 === 2 ? null : new Date(Date.now() - (30 - i) * 3600000 + 600000).toISOString(),
        duration: i % 3 === 2 ? null : 300 + i * 10,
        web_url: `https://gitlab.example.com/team/backend-api/-/pipelines/${1000 + i}`,
        user: {
            id: 1 + (i % 3),
            username: ['alice', 'bob', 'charlie'][i % 3],
            name: ['Alice Anderson', 'Bob Brown', 'Charlie Chen'][i % 3]
        }
    })),

    // Pipelines - Page 2 (30 items)
    pipelines_page2: Array.from({ length: 30 }, (_, i) => ({
        id: 2000 + i,
        project_id: 101,
        status: ['success', 'canceled', 'pending'][i % 3],
        ref: 'main',
        sha: `def${i}`.padEnd(40, '0'),
        created_at: new Date(Date.now() - (60 - i) * 3600000).toISOString(),
        updated_at: new Date(Date.now() - (60 - i) * 3600000 + 600000).toISOString(),
        started_at: i % 3 === 2 ? null : new Date(Date.now() - (60 - i) * 3600000 + 60000).toISOString(),
        finished_at: i % 3 === 2 ? null : new Date(Date.now() - (60 - i) * 3600000 + 600000).toISOString(),
        duration: i % 3 === 2 ? null : 250 + i * 10,
        web_url: `https://gitlab.example.com/team/backend-api/-/pipelines/${2000 + i}`,
        user: {
            id: 1 + (i % 3),
            username: ['alice', 'bob', 'charlie'][i % 3],
            name: ['Alice Anderson', 'Bob Brown', 'Charlie Chen'][i % 3]
        }
    })),

    // Pipelines - Page 3 (10 items - last page)
    pipelines_page3: Array.from({ length: 10 }, (_, i) => ({
        id: 3000 + i,
        project_id: 101,
        status: ['success', 'failed'][i % 2],
        ref: 'main',
        sha: `ghi${i}`.padEnd(40, '0'),
        created_at: new Date(Date.now() - (90 - i) * 3600000).toISOString(),
        updated_at: new Date(Date.now() - (90 - i) * 3600000 + 600000).toISOString(),
        started_at: new Date(Date.now() - (90 - i) * 3600000 + 60000).toISOString(),
        finished_at: new Date(Date.now() - (90 - i) * 3600000 + 600000).toISOString(),
        duration: 200 + i * 10,
        web_url: `https://gitlab.example.com/team/backend-api/-/pipelines/${3000 + i}`,
        user: {
            id: 1 + (i % 2),
            username: ['alice', 'bob'][i % 2],
            name: ['Alice Anderson', 'Bob Brown'][i % 2]
        }
    })),

    // Jobs for a single pipeline
    jobs_pipeline_1000: [
        {
            id: 10001,
            name: "build",
            stage: "build",
            status: "success",
            created_at: new Date(Date.now() - 30 * 3600000).toISOString(),
            started_at: new Date(Date.now() - 30 * 3600000 + 30000).toISOString(),
            finished_at: new Date(Date.now() - 30 * 3600000 + 150000).toISOString(),
            duration: 120,
            web_url: "https://gitlab.example.com/team/backend-api/-/jobs/10001",
            user: {
                id: 1,
                username: "alice",
                name: "Alice Anderson"
            }
        },
        {
            id: 10002,
            name: "test",
            stage: "test",
            status: "success",
            created_at: new Date(Date.now() - 30 * 3600000 + 150000).toISOString(),
            started_at: new Date(Date.now() - 30 * 3600000 + 180000).toISOString(),
            finished_at: new Date(Date.now() - 30 * 3600000 + 300000).toISOString(),
            duration: 120,
            web_url: "https://gitlab.example.com/team/backend-api/-/jobs/10002",
            user: {
                id: 1,
                username: "alice",
                name: "Alice Anderson"
            }
        },
        {
            id: 10003,
            name: "deploy",
            stage: "deploy",
            status: "success",
            created_at: new Date(Date.now() - 30 * 3600000 + 300000).toISOString(),
            started_at: new Date(Date.now() - 30 * 3600000 + 330000).toISOString(),
            finished_at: new Date(Date.now() - 30 * 3600000 + 600000).toISOString(),
            duration: 270,
            web_url: "https://gitlab.example.com/team/backend-api/-/jobs/10003",
            user: {
                id: 1,
                username: "alice",
                name: "Alice Anderson"
            }
        }
    ],

    // Generate jobs for multiple pipelines
    generateJobs(pipelineId, count = 3) {
        return Array.from({ length: count }, (_, i) => ({
            id: pipelineId * 100 + i,
            name: ["build", "test", "deploy"][i % 3],
            stage: ["build", "test", "deploy"][i % 3],
            status: ["success", "failed", "running"][i % 3],
            created_at: new Date(Date.now() - 3600000 + i * 300000).toISOString(),
            started_at: new Date(Date.now() - 3600000 + i * 300000 + 30000).toISOString(),
            finished_at: i % 3 === 2 ? null : new Date(Date.now() - 3600000 + i * 300000 + 150000).toISOString(),
            duration: i % 3 === 2 ? null : 120,
            web_url: `https://gitlab.example.com/team/backend-api/-/jobs/${pipelineId * 100 + i}`,
            user: {
                id: 1,
                username: "alice",
                name: "Alice Anderson"
            }
        }));
    },

    // Large dataset: 50 projects
    largeDataset_projects: Array.from({ length: 50 }, (_, i) => ({
        id: 200 + i,
        name: `project-${i}`,
        path_with_namespace: `org/project-${i}`,
        web_url: `https://gitlab.example.com/org/project-${i}`
    })),

    // Large dataset: 10 pipelines per project (500 total)
    largeDataset_pipelines: function(projectId) {
        return Array.from({ length: 10 }, (_, i) => ({
            id: projectId * 1000 + i,
            project_id: projectId,
            status: ['success', 'failed', 'running'][i % 3],
            ref: 'main',
            sha: `${projectId}${i}`.padEnd(40, '0'),
            created_at: new Date(Date.now() - (10 - i) * 3600000).toISOString(),
            updated_at: new Date(Date.now() - (10 - i) * 3600000 + 600000).toISOString(),
            started_at: new Date(Date.now() - (10 - i) * 3600000 + 60000).toISOString(),
            finished_at: i % 3 === 2 ? null : new Date(Date.now() - (10 - i) * 3600000 + 600000).toISOString(),
            duration: i % 3 === 2 ? null : 300 + i * 10,
            web_url: `https://gitlab.example.com/org/project-${projectId - 200}/-/pipelines/${projectId * 1000 + i}`,
            user: {
                id: 1 + (i % 3),
                username: ['alice', 'bob', 'charlie'][i % 3],
                name: ['Alice Anderson', 'Bob Brown', 'Charlie Chen'][i % 3]
            }
        }));
    },

    // Error responses
    error_unauthorized: {
        message: "401 Unauthorized"
    },

    error_notFound: {
        message: "404 Project Not Found"
    },

    error_rateLimit: {
        message: "429 Too Many Requests"
    }
};

// Export for use in tests
window.API_FIXTURES = API_FIXTURES;
