/**
 * Mock API fixtures for Node.js testing
 * Simplified version of test/fixtures-api-integration.js
 */

export const API_FIXTURES = {
    projects: [
        {
            id: 101,
            name: 'backend-api',
            path_with_namespace: 'test-group/backend-api',
            web_url: 'https://gitlab.example.com/test-group/backend-api'
        },
        {
            id: 102,
            name: 'frontend-app',
            path_with_namespace: 'test-group/frontend-app',
            web_url: 'https://gitlab.example.com/test-group/frontend-app'
        },
        {
            id: 103,
            name: 'infra-tools',
            path_with_namespace: 'test-group/infra-tools',
            web_url: 'https://gitlab.example.com/test-group/infra-tools'
        }
    ],

    pipelines: [
        {
            id: 1001,
            project_id: 101,
            status: 'success',
            ref: 'main',
            sha: 'abc123' + '0'.repeat(34),
            created_at: '2025-01-13T10:00:00Z',
            updated_at: '2025-01-13T10:10:00Z',
            started_at: '2025-01-13T10:01:00Z',
            finished_at: '2025-01-13T10:10:00Z',
            duration: 540,
            web_url: 'https://gitlab.example.com/test-group/backend-api/-/pipelines/1001',
            user: {
                id: 1,
                username: 'alice',
                name: 'Alice Anderson'
            }
        },
        {
            id: 1002,
            project_id: 101,
            status: 'running',
            ref: 'main',
            sha: 'def456' + '0'.repeat(34),
            created_at: '2025-01-13T10:15:00Z',
            updated_at: '2025-01-13T10:18:00Z',
            started_at: '2025-01-13T10:16:00Z',
            finished_at: null,
            duration: null,
            web_url: 'https://gitlab.example.com/test-group/backend-api/-/pipelines/1002',
            user: {
                id: 2,
                username: 'bob',
                name: 'Bob Brown'
            }
        },
        {
            id: 1003,
            project_id: 102,
            status: 'failed',
            ref: 'develop',
            sha: 'ghi789' + '0'.repeat(34),
            created_at: '2025-01-13T09:00:00Z',
            updated_at: '2025-01-13T09:15:00Z',
            started_at: '2025-01-13T09:02:00Z',
            finished_at: '2025-01-13T09:15:00Z',
            duration: 780,
            web_url: 'https://gitlab.example.com/test-group/frontend-app/-/pipelines/1003',
            user: {
                id: 3,
                username: 'charlie',
                name: 'Charlie Chen'
            }
        }
    ],

    jobs: [
        {
            id: 10001,
            name: 'build',
            stage: 'build',
            status: 'success',
            pipeline: { id: 1001, project_id: 101 },
            created_at: '2025-01-13T10:01:00Z',
            started_at: '2025-01-13T10:01:30Z',
            finished_at: '2025-01-13T10:04:00Z',
            duration: 150,
            web_url: 'https://gitlab.example.com/test-group/backend-api/-/jobs/10001',
            user: {
                id: 1,
                username: 'alice',
                name: 'Alice Anderson'
            }
        },
        {
            id: 10002,
            name: 'test',
            stage: 'test',
            status: 'success',
            pipeline: { id: 1001, project_id: 101 },
            created_at: '2025-01-13T10:04:00Z',
            started_at: '2025-01-13T10:04:30Z',
            finished_at: '2025-01-13T10:08:00Z',
            duration: 210,
            web_url: 'https://gitlab.example.com/test-group/backend-api/-/jobs/10002',
            user: {
                id: 1,
                username: 'alice',
                name: 'Alice Anderson'
            }
        },
        {
            id: 10003,
            name: 'deploy',
            stage: 'deploy',
            status: 'success',
            pipeline: { id: 1001, project_id: 101 },
            created_at: '2025-01-13T10:08:00Z',
            started_at: '2025-01-13T10:08:30Z',
            finished_at: '2025-01-13T10:10:00Z',
            duration: 90,
            web_url: 'https://gitlab.example.com/test-group/backend-api/-/jobs/10003',
            user: {
                id: 1,
                username: 'alice',
                name: 'Alice Anderson'
            }
        },
        // Jobs for running pipeline
        {
            id: 10021,
            name: 'build',
            stage: 'build',
            status: 'success',
            pipeline: { id: 1002, project_id: 101 },
            created_at: '2025-01-13T10:16:00Z',
            started_at: '2025-01-13T10:16:30Z',
            finished_at: '2025-01-13T10:17:30Z',
            duration: 60,
            web_url: 'https://gitlab.example.com/test-group/backend-api/-/jobs/10021',
            user: {
                id: 2,
                username: 'bob',
                name: 'Bob Brown'
            }
        },
        {
            id: 10022,
            name: 'test',
            stage: 'test',
            status: 'running',
            pipeline: { id: 1002, project_id: 101 },
            created_at: '2025-01-13T10:17:30Z',
            started_at: '2025-01-13T10:18:00Z',
            finished_at: null,
            duration: null,
            web_url: 'https://gitlab.example.com/test-group/backend-api/-/jobs/10022',
            user: {
                id: 2,
                username: 'bob',
                name: 'Bob Brown'
            }
        }
    ]
};
