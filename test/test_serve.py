#!/usr/bin/env python3
"""
Test suite for serve.py

Tests the backend server functionality without actually starting the HTTP server.
"""

import sys
import unittest
from pathlib import Path
from unittest.mock import patch, MagicMock

# Add parent directory to path to import serve
sys.path.insert(0, str(Path(__file__).parent.parent))

import serve


class TestGitLabToken(unittest.TestCase):
    """Test GitLab token acquisition."""

    @patch('subprocess.run')
    def test_get_gitlab_token_success(self, mock_run):
        """Test successful token retrieval."""
        mock_run.return_value = MagicMock(
            stdout='glpat-abc123xyz789\n',
            returncode=0
        )
        token = serve.get_gitlab_token()
        self.assertEqual(token, 'glpat-abc123xyz789')
        mock_run.assert_called_once_with(
            ['glab', 'auth', 'token'],
            capture_output=True,
            text=True,
            check=True
        )

    @patch('subprocess.run')
    @patch('sys.exit')
    def test_get_gitlab_token_empty(self, mock_exit, mock_run):
        """Test handling of empty token output."""
        mock_run.return_value = MagicMock(
            stdout='',
            returncode=0
        )
        serve.get_gitlab_token()
        mock_exit.assert_called_once_with(1)


class TestArgumentParsing(unittest.TestCase):
    """Test command-line argument parsing."""

    def test_parse_arguments_with_group(self):
        """Test parsing with --group argument."""
        test_args = [
            'serve.py',
            '--group', '12345',
            '--since', '2 days ago'
        ]
        with patch('sys.argv', test_args):
            args = serve.parse_arguments()
            self.assertEqual(args.group, '12345')
            self.assertIsNone(args.projects)
            self.assertEqual(args.since, '2 days ago')
            self.assertEqual(args.port, 8000)
            self.assertEqual(args.gitlab_url, 'https://gitlab.com')

    def test_parse_arguments_with_projects(self):
        """Test parsing with --projects argument."""
        test_args = [
            'serve.py',
            '--projects', '100,200,300',
            '--since', '2025-01-10'
        ]
        with patch('sys.argv', test_args):
            args = serve.parse_arguments()
            self.assertIsNone(args.group)
            self.assertEqual(args.projects, '100,200,300')
            self.assertEqual(args.since, '2025-01-10')

    def test_parse_arguments_with_custom_port(self):
        """Test parsing with custom port."""
        test_args = [
            'serve.py',
            '--group', '12345',
            '--since', '1 week ago',
            '--port', '9000'
        ]
        with patch('sys.argv', test_args):
            args = serve.parse_arguments()
            self.assertEqual(args.port, 9000)

    def test_parse_arguments_with_custom_gitlab_url(self):
        """Test parsing with custom GitLab URL."""
        test_args = [
            'serve.py',
            '--group', '12345',
            '--since', '1 day ago',
            '--gitlab-url', 'https://gitlab.example.com'
        ]
        with patch('sys.argv', test_args):
            args = serve.parse_arguments()
            self.assertEqual(args.gitlab_url, 'https://gitlab.example.com')


class TestConfigGeneration(unittest.TestCase):
    """Test JavaScript configuration generation."""

    def test_create_config_js_with_group(self):
        """Test config generation with group ID."""
        args = MagicMock(
            group='12345',
            projects=None,
            gitlab_url='https://gitlab.com',
            since='2 days ago',
            port=8000
        )
        config_js = serve.create_config_js('test-token-123', args)

        # Verify config contains expected values (JSON format)
        self.assertIn('"gitlabToken": "test-token-123"', config_js)
        self.assertIn('"gitlabUrl": "https://gitlab.com"', config_js)
        self.assertIn('"since": "2 days ago"', config_js)
        self.assertIn('"port": 8000', config_js)
        self.assertIn('"groupId": "12345"', config_js)
        self.assertNotIn('projectIds', config_js)

    def test_create_config_js_with_projects(self):
        """Test config generation with project IDs."""
        args = MagicMock(
            group=None,
            projects='100, 200, 300',
            gitlab_url='https://gitlab.com',
            since='2025-01-10',
            port=8000
        )
        config_js = serve.create_config_js('test-token-456', args)

        # Verify config contains expected values (JSON format)
        self.assertIn('"gitlabToken": "test-token-456"', config_js)
        self.assertIn('"projectIds":', config_js)
        self.assertIn('"100"', config_js)
        self.assertIn('"200"', config_js)
        self.assertIn('"300"', config_js)
        self.assertNotIn('groupId', config_js)

    def test_create_config_js_escapes_quotes(self):
        """Test that quotes in values are properly escaped via JSON."""
        args = MagicMock(
            group='123',
            projects=None,
            gitlab_url='https://gitlab.com/test"quote',
            since='1 day ago',
            port=8000
        )
        config_js = serve.create_config_js('token"with"quotes', args)

        # Verify JSON escaping
        self.assertIn(r'"gitlabToken": "token\"with\"quotes"', config_js)
        self.assertIn(r'"gitlabUrl": "https://gitlab.com/test\"quote"', config_js)


class TestArgumentValidation(unittest.TestCase):
    """Test argument validation."""

    @patch('sys.exit')
    def test_validate_invalid_port_low(self, mock_exit):
        """Test validation rejects port below range."""
        args = MagicMock(port=0, gitlab_url='https://gitlab.com', projects='123')
        serve.validate_arguments(args)
        mock_exit.assert_called_once_with(1)

    @patch('sys.exit')
    def test_validate_invalid_port_high(self, mock_exit):
        """Test validation rejects port above range."""
        args = MagicMock(port=70000, gitlab_url='https://gitlab.com', projects='123')
        serve.validate_arguments(args)
        mock_exit.assert_called_once_with(1)

    @patch('sys.exit')
    def test_validate_invalid_gitlab_url(self, mock_exit):
        """Test validation rejects invalid URL."""
        args = MagicMock(port=8000, gitlab_url='not-a-url', projects='123')
        serve.validate_arguments(args)
        mock_exit.assert_called_once_with(1)

    @patch('sys.exit')
    def test_validate_empty_project_ids(self, mock_exit):
        """Test validation rejects empty project IDs."""
        args = MagicMock(port=8000, gitlab_url='https://gitlab.com', projects='100,,200', group=None)
        serve.validate_arguments(args)
        mock_exit.assert_called_once_with(1)

    def test_validate_valid_arguments(self):
        """Test validation accepts valid arguments."""
        args = MagicMock(port=8080, gitlab_url='https://gitlab.com', projects='100,200', group=None)
        # Should not raise or exit
        serve.validate_arguments(args)


if __name__ == '__main__':
    unittest.main()
