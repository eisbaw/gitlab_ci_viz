#!/usr/bin/env python3
"""
Mock GitLab API Server for Testing and Development

Emulates GitLab API v4 endpoints with realistic mock data.
Runs on port 8001 (configurable) with dynamic job status updates.

Usage:
    python mock_gitlab_server.py --port 8001
    python serve.py --gitlab-url mock --group 1 --since "1 day ago"
"""

import argparse
import json
import logging
import random
import threading
import time
from datetime import datetime, timedelta, timezone
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s"
)

# GraphQL pagination constants
GRAPHQL_PAGE_SIZE = 100
GRAPHQL_JOBS_PER_PIPELINE = 100


class MockDataStore:
    """In-memory data store for mock GitLab data with dynamic updates"""

    def __init__(self):
        self._lock = threading.Lock()
        self.groups = self._generate_groups()
        self.projects = self._generate_projects()
        self.pipelines = self._generate_pipelines()
        self.jobs = self._generate_jobs()
        self.bridges = self._generate_bridges()
        logging.info(
            f"Generated {len(self.projects)} projects, {len(self.pipelines)} pipelines, "
            f"{len(self.jobs)} jobs, {len(self.bridges)} bridge jobs"
        )

    def _generate_groups(self):
        """Generate mock groups"""
        return [
            {
                "id": 1,
                "name": "Development Team",
                "path": "dev-team",
                "description": "Main development group",
            }
        ]

    def _generate_projects(self):
        """Generate mock projects"""
        return [
            {
                "id": 101,
                "name": "backend-api",
                "path_with_namespace": "dev-team/backend-api",
                "web_url": "http://localhost:8001/dev-team/backend-api",
                "description": "Backend REST API service",
            },
            {
                "id": 102,
                "name": "frontend-app",
                "path_with_namespace": "dev-team/frontend-app",
                "web_url": "http://localhost:8001/dev-team/frontend-app",
                "description": "Frontend React application",
            },
            {
                "id": 103,
                "name": "infra-tools",
                "path_with_namespace": "dev-team/infra-tools",
                "web_url": "http://localhost:8001/dev-team/infra-tools",
                "description": "Infrastructure and deployment tools",
            },
        ]

    def _generate_pipelines(self):
        """Generate pipelines for each project"""
        pipelines = []
        base_time = datetime.now(timezone.utc)

        for project_id in [101, 102, 103]:
            for i in range(10):  # 10 pipelines per project
                pipeline_id = project_id * 1000 + i
                created_at = base_time - timedelta(hours=24 - i * 2)

                # First 7 pipelines are finished (success or failed)
                if i < 7:
                    status = (
                        random.choice(["success", "failed"])
                        if i % 3 == 0
                        else "success"
                    )
                    started_at = created_at + timedelta(minutes=1)
                    finished_at = started_at + timedelta(minutes=random.randint(5, 20))
                    duration = int((finished_at - started_at).total_seconds())
                # Next 2 are running
                elif i < 9:
                    status = "running"
                    started_at = created_at + timedelta(minutes=1)
                    finished_at = None
                    duration = None
                # Last one is pending
                else:
                    status = "pending"
                    started_at = None
                    finished_at = None
                    duration = None

                pipelines.append(
                    {
                        "id": pipeline_id,
                        "project_id": project_id,
                        "status": status,
                        "ref": "main" if i % 2 == 0 else "develop",
                        "sha": f"abc{i:03d}".ljust(40, "0"),
                        "created_at": created_at.isoformat(),
                        "updated_at": (
                            finished_at or started_at or created_at
                        ).isoformat(),
                        "started_at": started_at.isoformat() if started_at else None,
                        "finished_at": finished_at.isoformat() if finished_at else None,
                        "duration": duration,
                        "web_url": f"http://localhost:8001/dev-team/project/-/pipelines/{pipeline_id}",
                        "user": {
                            "id": 1 + (i % 3),
                            "username": ["alice", "bob", "charlie"][i % 3],
                            "name": ["Alice Anderson", "Bob Brown", "Charlie Chen"][
                                i % 3
                            ],
                            "avatar_url": f"https://www.gravatar.com/avatar/{i % 3}?d=identicon",
                        },
                    }
                )

        return pipelines

    def _generate_jobs(self):
        """Generate jobs for each pipeline"""
        jobs = []
        stages = ["build", "test", "deploy"]

        for pipeline in self.pipelines:
            pipeline_id = pipeline["id"]
            project_id = pipeline["project_id"]

            for stage_idx, stage in enumerate(stages):
                job_id = pipeline_id * 10 + stage_idx

                # Job timing based on pipeline status
                if pipeline["started_at"]:
                    created_at = datetime.fromisoformat(pipeline["started_at"])
                    started_at = created_at + timedelta(minutes=stage_idx * 3)

                    # Determine job status based on pipeline status
                    if pipeline["status"] == "running":
                        # Last job is running, others are success
                        if stage_idx == 2:
                            status = "running"
                            finished_at = None
                            duration = None
                        else:
                            status = "success"
                            finished_at = started_at + timedelta(
                                minutes=random.randint(2, 5)
                            )
                            duration = int((finished_at - started_at).total_seconds())
                    elif pipeline["status"] == "failed":
                        # Middle job failed, first succeeded, last was skipped
                        if stage_idx == 0:
                            status = "success"
                            finished_at = started_at + timedelta(minutes=3)
                            duration = 180
                        elif stage_idx == 1:
                            status = "failed"
                            finished_at = started_at + timedelta(minutes=2)
                            duration = 120
                        else:
                            status = "skipped"
                            started_at = None  # Skipped jobs never started
                            finished_at = None
                            duration = None
                    else:  # success
                        status = "success"
                        finished_at = started_at + timedelta(
                            minutes=random.randint(2, 5)
                        )
                        duration = int((finished_at - started_at).total_seconds())
                else:
                    # Pending pipeline - all jobs pending
                    created_at = datetime.fromisoformat(pipeline["created_at"])
                    started_at = None
                    finished_at = None
                    status = "pending"
                    duration = None

                jobs.append(
                    {
                        "id": job_id,
                        "name": stage,
                        "stage": stage,
                        "status": status,
                        "pipeline": {
                            "id": pipeline_id,
                            "project_id": project_id,
                            "ref": pipeline["ref"],
                        },
                        "created_at": created_at.isoformat(),
                        "started_at": started_at.isoformat() if started_at else None,
                        "finished_at": finished_at.isoformat() if finished_at else None,
                        "duration": duration,
                        "web_url": f"http://localhost:8001/dev-team/project/-/jobs/{job_id}",
                        "user": pipeline["user"],
                        "runner": {
                            "id": (job_id % 5) + 1,
                            "description": f"runner-{(job_id % 5) + 1}",
                            "active": True,
                        }
                        if status not in ["pending", "skipped"]
                        else None,
                    }
                )

        return jobs

    def _generate_bridges(self):
        """Generate bridge jobs that trigger downstream/child pipelines.

        Creates realistic parent-child pipeline relationships:
        - Some pipelines have bridge jobs that trigger child pipelines
        - Child pipelines are in the same project (parent_pipeline source)
        - Bridge jobs include downstream_pipeline info
        """
        bridges = []

        # Create bridge jobs for selected pipelines (every 3rd pipeline in project 101)
        # These will trigger child pipelines in the same project
        for pipeline in self.pipelines:
            project_id = pipeline["project_id"]
            pipeline_id = pipeline["id"]

            # Only add bridges to some finished pipelines in project 101
            # Pipeline IDs: 101000-101009 for project 101
            if project_id != 101:
                continue
            if pipeline["status"] not in ["success", "failed"]:
                continue
            # Every 3rd pipeline gets a bridge job
            if (pipeline_id % 3) != 0:
                continue

            bridge_id = pipeline_id * 100 + 99  # Unique ID for bridge job

            # Calculate timing based on pipeline
            if pipeline["started_at"]:
                created_at = datetime.fromisoformat(pipeline["started_at"])
                started_at = created_at + timedelta(minutes=8)  # After other jobs

                if pipeline["status"] == "success":
                    finished_at = started_at + timedelta(seconds=30)
                    status = "success"
                    duration = 30
                else:
                    finished_at = started_at + timedelta(seconds=15)
                    status = "failed"
                    duration = 15
            else:
                created_at = datetime.fromisoformat(pipeline["created_at"])
                started_at = None
                finished_at = None
                status = "pending"
                duration = None

            # Create a child pipeline that this bridge triggers
            # Child pipeline ID is derived from parent
            child_pipeline_id = pipeline_id + 50000

            # Add the child pipeline to our pipelines list
            child_created_at = started_at or created_at
            child_started_at = (
                child_created_at + timedelta(seconds=5) if started_at else None
            )
            child_finished_at = (
                child_started_at + timedelta(minutes=3)
                if finished_at and child_started_at
                else None
            )
            child_status = pipeline["status"] if finished_at else "running"

            child_pipeline = {
                "id": child_pipeline_id,
                "project_id": project_id,
                "status": child_status,
                "source": "parent_pipeline",  # Indicates this is a child pipeline
                "ref": pipeline["ref"],
                "sha": f"child{pipeline_id:06d}".ljust(40, "0"),
                "created_at": child_created_at.isoformat(),
                "updated_at": (
                    child_finished_at or child_started_at or child_created_at
                ).isoformat(),
                "started_at": child_started_at.isoformat()
                if child_started_at
                else None,
                "finished_at": (
                    child_finished_at.isoformat() if child_finished_at else None
                ),
                "duration": (
                    int((child_finished_at - child_started_at).total_seconds())
                    if child_finished_at and child_started_at
                    else None
                ),
                "web_url": f"http://localhost:8001/dev-team/backend-api/-/pipelines/{child_pipeline_id}",
                "user": pipeline["user"],
            }
            self.pipelines.append(child_pipeline)

            # Create jobs for the child pipeline
            child_stages = ["child-build", "child-test"]
            for stage_idx, stage in enumerate(child_stages):
                child_job_id = child_pipeline_id * 10 + stage_idx
                if child_started_at:
                    job_started_at = child_started_at + timedelta(minutes=stage_idx)
                    job_finished_at = (
                        job_started_at + timedelta(minutes=1)
                        if child_finished_at
                        else None
                    )
                    job_status = child_status if job_finished_at else "running"
                    job_duration = 60 if job_finished_at else None
                else:
                    job_started_at = None
                    job_finished_at = None
                    job_status = "pending"
                    job_duration = None

                self.jobs.append(
                    {
                        "id": child_job_id,
                        "name": stage,
                        "stage": stage,
                        "status": job_status,
                        "pipeline": {
                            "id": child_pipeline_id,
                            "project_id": project_id,
                            "ref": pipeline["ref"],
                        },
                        "created_at": child_created_at.isoformat(),
                        "started_at": (
                            job_started_at.isoformat() if job_started_at else None
                        ),
                        "finished_at": (
                            job_finished_at.isoformat() if job_finished_at else None
                        ),
                        "duration": job_duration,
                        "web_url": f"http://localhost:8001/dev-team/backend-api/-/jobs/{child_job_id}",
                        "user": pipeline["user"],
                        "runner": {
                            "id": (child_job_id % 5) + 1,
                            "description": f"runner-{(child_job_id % 5) + 1}",
                            "active": True,
                        }
                        if job_status not in ["pending", "skipped"]
                        else None,
                    }
                )

            # Create the bridge job
            bridges.append(
                {
                    "id": bridge_id,
                    "name": "trigger-child",
                    "stage": "trigger",
                    "status": status,
                    "pipeline": {
                        "id": pipeline_id,
                        "project_id": project_id,
                        "ref": pipeline["ref"],
                    },
                    "created_at": created_at.isoformat(),
                    "started_at": started_at.isoformat() if started_at else None,
                    "finished_at": finished_at.isoformat() if finished_at else None,
                    "duration": duration,
                    "web_url": f"http://localhost:8001/dev-team/backend-api/-/jobs/{bridge_id}",
                    "user": pipeline["user"],
                    "downstream_pipeline": {
                        "id": child_pipeline_id,
                        "sha": child_pipeline["sha"],
                        "ref": child_pipeline["ref"],
                        "status": child_status,
                        "created_at": child_created_at.isoformat(),
                        "updated_at": child_pipeline["updated_at"],
                        "web_url": child_pipeline["web_url"],
                        "project_id": project_id,  # Same project for child pipelines
                    },
                }
            )

        return bridges


class MockGitLabHandler(BaseHTTPRequestHandler):
    """HTTP request handler for mock GitLab API"""

    def do_OPTIONS(self):
        """Handle CORS preflight requests"""
        self.send_response(200)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header(
            "Access-Control-Allow-Headers",
            "Content-Type, Authorization, PRIVATE-TOKEN",
        )
        self.send_header("Access-Control-Max-Age", "86400")
        self.end_headers()

    def do_GET(self):
        """Handle GET requests"""
        parsed = urlparse(self.path)
        path = parsed.path
        query_params = parse_qs(parsed.query)

        # Extract pagination parameters
        page = int(query_params.get("page", ["1"])[0])
        per_page = int(query_params.get("per_page", ["100"])[0])

        # Route to appropriate handler
        if path.startswith("/api/v4/groups/") and path.endswith("/projects"):
            self._handle_group_projects(path, page, per_page)
        elif (
            path.startswith("/api/v4/projects/")
            and "/pipelines/" in path
            and "/bridges" in path
        ):
            self._handle_pipeline_bridges(path, page, per_page)
        elif (
            path.startswith("/api/v4/projects/")
            and "/pipelines/" in path
            and "/jobs" in path
        ):
            self._handle_pipeline_jobs(path, page, per_page, query_params)
        elif path.startswith("/api/v4/projects/") and "/pipelines" in path:
            self._handle_project_pipelines(path, page, per_page, query_params)
        elif path.startswith("/api/v4/projects/"):
            self._handle_project(path)
        else:
            self._send_error(404, "Not Found")

    def do_POST(self):
        """Handle POST requests (GraphQL)"""
        parsed = urlparse(self.path)
        path = parsed.path

        if path == "/api/graphql":
            self._handle_graphql()
        else:
            self._send_error(404, "Not Found")

    def _handle_graphql(self):
        """Handle GraphQL queries for pipelines with nested jobs"""
        try:
            # Read request body
            content_length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(content_length).decode("utf-8")
            request = json.loads(body)

            variables = request.get("variables", {})
            project_path = variables.get("projectId", "")
            updated_after = variables.get("updatedAfter")
            cursor = variables.get("after")

            # Find project by path (projects are static, no lock needed)
            project = next(
                (
                    p
                    for p in self.server.data_store.projects
                    if p["path_with_namespace"] == project_path
                ),
                None,
            )

            if not project:
                self._send_json_response({"data": {"project": None}})
                return

            project_id = project["id"]

            # Acquire lock to safely read dynamic data (jobs/pipelines can change)
            with self.server.data_store._lock:
                # Copy pipelines for this project
                pipelines = [
                    p.copy()
                    for p in self.server.data_store.pipelines
                    if p["project_id"] == project_id
                ]
                # Copy all jobs (we'll filter later)
                all_jobs = [j.copy() for j in self.server.data_store.jobs]

            # Apply updated_after filter if provided
            if updated_after:
                try:
                    cutoff = datetime.fromisoformat(
                        updated_after.replace("Z", "+00:00")
                    )
                    pipelines = [
                        p
                        for p in pipelines
                        if datetime.fromisoformat(p["updated_at"]) >= cutoff
                    ]
                except ValueError as e:
                    logging.warning(f"Invalid updatedAfter: '{updated_after}' - {e}")
                    self._send_error(
                        400, f"Invalid updatedAfter format: {updated_after}"
                    )
                    return

            # Sort by created_at descending
            pipelines.sort(key=lambda p: p["created_at"], reverse=True)

            # Handle cursor-based pagination (decode cursor as index)
            start_index = 0
            if cursor:
                try:
                    start_index = int(cursor)
                except ValueError:
                    logging.warning(f"Invalid cursor: '{cursor}', using 0")

            # Paginate
            page_pipelines = pipelines[start_index : start_index + GRAPHQL_PAGE_SIZE]
            has_next_page = start_index + GRAPHQL_PAGE_SIZE < len(pipelines)
            end_cursor = str(start_index + GRAPHQL_PAGE_SIZE) if has_next_page else None

            # Transform pipelines to GraphQL format
            pipeline_nodes = []
            for p in page_pipelines:
                # Get jobs for this pipeline
                pipeline_jobs = [j for j in all_jobs if j["pipeline"]["id"] == p["id"]]

                # Transform jobs to GraphQL format
                job_nodes = []
                for j in pipeline_jobs[:GRAPHQL_JOBS_PER_PIPELINE]:
                    # Transform runner to GraphQL format
                    runner_data = None
                    if j.get("runner"):
                        runner_data = {
                            "id": f"gid://gitlab/Ci::Runner/{j['runner']['id']}",
                            "description": j["runner"]["description"],
                        }

                    job_nodes.append(
                        {
                            "id": f"gid://gitlab/Ci::Build/{j['id']}",
                            "name": j["name"],
                            "stage": {"name": j["stage"]},
                            "status": j["status"].upper(),
                            "createdAt": j["created_at"],
                            "startedAt": j["started_at"],
                            "finishedAt": j["finished_at"],
                            "duration": j["duration"],
                            "webPath": f"/{project['path_with_namespace']}/-/jobs/{j['id']}",
                            "allowFailure": False,
                            "runner": runner_data,
                        }
                    )

                # Build pipeline user (GraphQL format)
                user_data = None
                if p.get("user"):
                    user_data = {
                        "id": f"gid://gitlab/User/{p['user']['id']}",
                        "username": p["user"]["username"],
                        "name": p["user"]["name"],
                        "avatarUrl": p["user"]["avatar_url"],
                    }

                pipeline_nodes.append(
                    {
                        "id": f"gid://gitlab/Ci::Pipeline/{p['id']}",
                        "iid": str(p["id"] % 1000),
                        "status": p["status"].upper(),
                        "source": (p.get("source") or "push").upper(),
                        "ref": p["ref"],
                        "sha": p["sha"],
                        "createdAt": p["created_at"],
                        "updatedAt": p["updated_at"],
                        "startedAt": p["started_at"],
                        "finishedAt": p["finished_at"],
                        "duration": p["duration"],
                        "user": user_data,
                        "jobs": {
                            "nodes": job_nodes,
                            "pageInfo": {
                                "hasNextPage": len(pipeline_jobs)
                                > GRAPHQL_JOBS_PER_PIPELINE,
                                "endCursor": str(GRAPHQL_JOBS_PER_PIPELINE)
                                if len(pipeline_jobs) > GRAPHQL_JOBS_PER_PIPELINE
                                else None,
                            },
                        },
                    }
                )

            # Build response
            response = {
                "data": {
                    "project": {
                        "id": f"gid://gitlab/Project/{project_id}",
                        "fullPath": project["path_with_namespace"],
                        "pipelines": {
                            "nodes": pipeline_nodes,
                            "pageInfo": {
                                "hasNextPage": has_next_page,
                                "endCursor": end_cursor,
                            },
                        },
                    }
                }
            }

            self._send_json_response(response)

        except json.JSONDecodeError:
            self._send_error(400, "Invalid JSON in request body")
        except Exception as e:
            logging.error(f"GraphQL error: {type(e).__name__}: {e}", exc_info=True)
            self._send_error(500, f"Internal server error: {str(e)}")

    def _handle_group_projects(self, path, page, per_page):
        """Handle /api/v4/groups/:id/projects"""
        try:
            _group_id = int(path.split("/")[4])  # Validate group ID is an integer
        except (IndexError, ValueError):
            self._send_error(400, "Invalid group ID")
            return

        # Return all projects for the group
        data = self.server.data_store.projects
        self._send_paginated_response(data, page, per_page)

    def _handle_project(self, path):
        """Handle /api/v4/projects/:id"""
        try:
            project_id = int(path.split("/")[4])
        except (IndexError, ValueError):
            self._send_error(400, "Invalid project ID")
            return

        project = next(
            (p for p in self.server.data_store.projects if p["id"] == project_id), None
        )

        if project:
            self._send_json_response(project)
        else:
            self._send_error(404, "Project Not Found")

    def _handle_project_pipelines(self, path, page, per_page, query_params):
        """Handle /api/v4/projects/:id/pipelines"""
        try:
            project_id = int(path.split("/")[4])
        except (IndexError, ValueError):
            self._send_error(400, "Invalid project ID")
            return

        # Filter pipelines for this project
        pipelines = [
            p for p in self.server.data_store.pipelines if p["project_id"] == project_id
        ]

        # Apply updated_after filter if provided
        updated_after = query_params.get("updated_after", [None])[0]
        if updated_after:
            try:
                cutoff = datetime.fromisoformat(updated_after.replace("Z", "+00:00"))
                pipelines = [
                    p
                    for p in pipelines
                    if datetime.fromisoformat(p["updated_at"]) >= cutoff
                ]
            except ValueError as e:
                logging.warning(
                    f"Invalid updated_after parameter: '{updated_after}' - {e}. Ignoring filter."
                )

        # Sort by created_at descending (most recent first)
        pipelines.sort(key=lambda p: p["created_at"], reverse=True)

        self._send_paginated_response(pipelines, page, per_page)

    def _handle_pipeline_jobs(self, path, page, per_page, query_params):
        """Handle /api/v4/projects/:id/pipelines/:pipeline_id/jobs"""
        try:
            parts = path.split("/")
            _project_id = int(parts[4])  # Validate project ID is an integer
            pipeline_id = int(parts[6])
        except (IndexError, ValueError):
            self._send_error(400, "Invalid project or pipeline ID")
            return

        # Filter jobs for this pipeline
        jobs = [
            j for j in self.server.data_store.jobs if j["pipeline"]["id"] == pipeline_id
        ]

        self._send_paginated_response(jobs, page, per_page)

    def _handle_pipeline_bridges(self, path, page, per_page):
        """Handle /api/v4/projects/:id/pipelines/:pipeline_id/bridges"""
        try:
            parts = path.split("/")
            _project_id = int(parts[4])  # Validate project ID is an integer
            pipeline_id = int(parts[6])
        except (IndexError, ValueError):
            self._send_error(400, "Invalid project or pipeline ID")
            return

        # Filter bridges for this pipeline
        bridges = [
            b
            for b in self.server.data_store.bridges
            if b["pipeline"]["id"] == pipeline_id
        ]

        self._send_paginated_response(bridges, page, per_page)

    def _send_json_response(self, data, status=200, headers=None):
        """Send JSON response"""
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Access-Control-Allow-Origin", "*")

        if headers:
            for key, value in headers.items():
                self.send_header(key, value)

        self.end_headers()
        self.wfile.write(json.dumps(data, indent=2).encode("utf-8"))

    def _send_paginated_response(self, data, page, per_page):
        """Send paginated JSON response with Link header"""
        total = len(data)
        start = (page - 1) * per_page
        end = start + per_page

        page_data = data[start:end]

        headers = {}
        if end < total:
            # Add Link header for next page
            next_page = page + 1
            headers["Link"] = (
                f'<http://localhost:8001{self.path.split("?")[0]}?page={next_page}&per_page={per_page}>; rel="next"'
            )

        self._send_json_response(page_data, headers=headers)

    def _send_error(self, status, message):
        """Send error response"""
        self._send_json_response({"message": message}, status=status)

    def log_message(self, format, *args):
        """Override to use logging module"""
        logging.info(f"{self.address_string()} - {format % args}")


class DynamicJobUpdater(threading.Thread):
    """Background thread that updates job statuses over time to simulate real pipeline execution"""

    def __init__(self, data_store, interval=5):
        super().__init__(daemon=True)
        self.data_store = data_store
        self.interval = interval
        self.running = True

    def run(self):
        """Update job statuses periodically"""
        logging.info(f"Dynamic job updater started (interval: {self.interval}s)")
        while self.running:
            time.sleep(self.interval)
            self._update_jobs()

    def _update_jobs(self):
        """Transition pending → running → success/failed"""
        now = datetime.now(timezone.utc)
        updated_count = 0

        # Acquire lock to safely mutate shared state
        with self.data_store._lock:
            for job in self.data_store.jobs:
                # Transition pending → running
                if job["status"] == "pending" and random.random() < 0.3:
                    job["status"] = "running"
                    job["started_at"] = now.isoformat()
                    job["runner"] = {
                        "id": (job["id"] % 5) + 1,
                        "description": f'runner-{(job["id"] % 5) + 1}',
                        "active": True,
                    }
                    logging.info(
                        f"Job {job['id']} ({job['name']}) started on {job['runner']['description']}"
                    )
                    updated_count += 1

                # Transition running → success/failed
                elif job["status"] == "running" and job["started_at"]:
                    started = datetime.fromisoformat(job["started_at"])
                    elapsed = (now - started).total_seconds()

                    # Finish jobs after 60 seconds (simulates typical build time)
                    # 20% chance per check (with 5s interval = ~50% chance within 15s)
                    if elapsed > 60 and random.random() < 0.2:
                        job["status"] = random.choice(
                            ["success", "success", "success", "failed"]
                        )  # 75% success
                        job["finished_at"] = now.isoformat()
                        job["duration"] = int(elapsed)
                        logging.info(
                            f"Job {job['id']} ({job['name']}) finished: {job['status']} (duration: {job['duration']}s)"
                        )
                        updated_count += 1

            # Update pipeline statuses based on jobs
            for pipeline in self.data_store.pipelines:
                if pipeline["status"] in ["pending", "running"]:
                    pipeline_jobs = [
                        j
                        for j in self.data_store.jobs
                        if j["pipeline"]["id"] == pipeline["id"]
                    ]

                    # Check if all jobs are finished
                    all_finished = all(
                        j["status"] in ["success", "failed", "skipped", "canceled"]
                        for j in pipeline_jobs
                    )

                    if all_finished:
                        # Pipeline succeeds only if all jobs succeeded
                        any_failed = any(j["status"] == "failed" for j in pipeline_jobs)
                        pipeline["status"] = "failed" if any_failed else "success"
                        pipeline["finished_at"] = now.isoformat()
                        pipeline["updated_at"] = now.isoformat()

                        # Calculate total duration
                        start_time = datetime.fromisoformat(pipeline["started_at"])
                        pipeline["duration"] = int((now - start_time).total_seconds())

                        logging.info(
                            f"Pipeline {pipeline['id']} finished: {pipeline['status']}"
                        )
                        updated_count += 1

                    # Check if any job is running
                    elif pipeline["status"] == "pending":
                        any_running = any(
                            j["status"] == "running" for j in pipeline_jobs
                        )
                        if any_running:
                            pipeline["status"] = "running"
                            if not pipeline["started_at"]:
                                pipeline["started_at"] = now.isoformat()
                            pipeline["updated_at"] = now.isoformat()
                            logging.info(f"Pipeline {pipeline['id']} started")
                            updated_count += 1

            if updated_count > 0:
                logging.debug(f"Updated {updated_count} items")

    def stop(self):
        """Stop the updater thread"""
        self.running = False


def create_mock_server(port=8001, dynamic_updates=True):
    """Create and return mock GitLab server"""

    # Create data store
    data_store = MockDataStore()

    # Create HTTP server
    server = HTTPServer(("127.0.0.1", port), MockGitLabHandler)
    server.data_store = data_store

    # Start dynamic updater if enabled
    if dynamic_updates:
        updater = DynamicJobUpdater(data_store, interval=5)
        updater.start()
        server.updater = updater

    return server


def main():
    parser = argparse.ArgumentParser(
        description="Mock GitLab API Server for Development and Testing"
    )
    parser.add_argument(
        "--port", type=int, default=8001, help="Server port (default: 8001)"
    )
    parser.add_argument(
        "--no-dynamic-updates",
        action="store_true",
        help="Disable dynamic job status updates",
    )
    parser.add_argument(
        "--update-interval",
        type=int,
        default=5,
        help="Update interval in seconds (default: 5)",
    )
    args = parser.parse_args()

    logging.info("=" * 60)
    logging.info("Mock GitLab API Server")
    logging.info("=" * 60)
    logging.info(f"Port: {args.port}")
    logging.info(
        f"Dynamic updates: {'enabled' if not args.no_dynamic_updates else 'disabled'}"
    )
    if not args.no_dynamic_updates:
        logging.info(f"Update interval: {args.update_interval}s")

    server = create_mock_server(
        port=args.port, dynamic_updates=not args.no_dynamic_updates
    )

    logging.info("=" * 60)
    logging.info(f"Server running at: http://localhost:{args.port}/")
    logging.info("API endpoints:")
    logging.info(
        "  POST /api/graphql                                   (pipelines + jobs)"
    )
    logging.info("  GET  /api/v4/groups/1/projects")
    logging.info("  GET  /api/v4/projects/:id")
    logging.info("  GET  /api/v4/projects/:id/pipelines")
    logging.info("  GET  /api/v4/projects/:id/pipelines/:pipeline_id/jobs")
    logging.info("  GET  /api/v4/projects/:id/pipelines/:pipeline_id/bridges")
    logging.info("=" * 60)
    logging.info("Press Ctrl+C to stop")
    logging.info("")

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        logging.info("\nShutting down...")
        if hasattr(server, "updater"):
            server.updater.stop()
        server.server_close()
        logging.info("Server stopped")


if __name__ == "__main__":
    main()
