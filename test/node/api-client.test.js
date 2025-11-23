/**
 * Node.js tests for GitLabAPIClient
 *
 * Run with: npm test
 * Or: node --test test/node/api-client.test.js
 */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { API_FIXTURES } from './fixtures/api-fixtures.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Mock window object BEFORE loading modules
global.window = {
    logger: console,
    performance: {
        now: () => Date.now()
    }
};

// Load api-client.js as a script (evaluates in global context)
const apiClientCode = readFileSync(join(__dirname, '../../static/api-client.js'), 'utf8');
eval(apiClientCode);

// Now GitLabAPIClient should be available on global
const { GitLabAPIClient } = global;

describe('GitLabAPIClient', () => {
    describe('constructor validation', () => {
        it('should throw error when CONFIG is null', () => {
            assert.throws(
                () => new GitLabAPIClient(null),
                {
                    name: 'ConfigurationError',
                    message: /CONFIG object not found/
                },
                'Should reject null config'
            );
        });

        it('should throw error when gitlabToken is missing', () => {
            const config = {
                gitlabUrl: 'https://gitlab.example.com'
            };

            assert.throws(
                () => new GitLabAPIClient(config),
                {
                    name: 'ConfigurationError',
                    message: /GitLab token is missing/
                },
                'Should reject config without token'
            );
        });

        it('should throw error when gitlabUrl is missing', () => {
            const config = {
                gitlabToken: 'test-token'
            };

            assert.throws(
                () => new GitLabAPIClient(config),
                {
                    name: 'ConfigurationError',
                    message: /GitLab URL is missing/
                },
                'Should reject config without URL'
            );
        });

        it('should create client with valid config', () => {
            const config = {
                gitlabToken: 'test-token',
                gitlabUrl: 'https://gitlab.example.com'
            };

            const client = new GitLabAPIClient(config);

            assert.strictEqual(client.gitlabToken, 'test-token');
            assert.strictEqual(client.gitlabUrl, 'https://gitlab.example.com');
        });
    });

    describe('fetchProjects', () => {
        it('should fetch projects by IDs', async () => {
            const config = {
                gitlabToken: 'test-token',
                gitlabUrl: 'https://gitlab.example.com',
                projectIds: [101, 102, 103]
            };

            // Mock fetch to return project data
            global.fetch = async (url) => {
                const projectId = parseInt(url.match(/projects\/(\d+)/)?.[1]);
                const project = API_FIXTURES.projects.find(p => p.id === projectId);

                return {
                    ok: true,
                    status: 200,
                    headers: new Map(),
                    json: async () => project
                };
            };

            const client = new GitLabAPIClient(config);
            const projects = await client.fetchProjects();

            assert.strictEqual(projects.length, 3);
            assert.strictEqual(projects[0].id, 101);
            assert.strictEqual(projects[0].name, 'backend-api');
            assert.strictEqual(projects[1].id, 102);
            assert.strictEqual(projects[2].id, 103);
        });

        it('should handle fetch errors', async () => {
            const config = {
                gitlabToken: 'test-token',
                gitlabUrl: 'https://gitlab.example.com',
                projectIds: [999]
            };

            // Mock fetch to return 404
            global.fetch = async () => ({
                ok: false,
                status: 404,
                statusText: 'Not Found',
                headers: new Map(),
                text: async () => JSON.stringify({ message: 'Project not found' })
            });

            const client = new GitLabAPIClient(config);

            await assert.rejects(
                () => client.fetchProjects(),
                {
                    name: 'ProjectFetchError'
                },
                'Should throw error on failed fetch'
            );
        });
    });
});
