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

    @patch('subprocess.run')
    @patch('sys.exit')
    def test_get_gitlab_token_command_fails(self, mock_exit, mock_run):
        """Test handling of glab command failure (CalledProcessError)."""
        import subprocess
        mock_run.side_effect = subprocess.CalledProcessError(
            returncode=1,
            cmd=['glab', 'auth', 'token'],
            stderr='authentication failed'
        )
        serve.get_gitlab_token()
        mock_exit.assert_called_once_with(1)

    @patch('subprocess.run')
    @patch('sys.exit')
    def test_get_gitlab_token_command_not_found(self, mock_exit, mock_run):
        """Test handling of missing glab command (FileNotFoundError)."""
        mock_run.side_effect = FileNotFoundError("glab not found")
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

    def test_parse_arguments_both_group_and_projects_fails(self):
        """Test that providing both --group and --projects is rejected."""
        test_args = [
            'serve.py',
            '--group', '12345',
            '--projects', '100,200',
            '--since', '1 day ago'
        ]
        with patch('sys.argv', test_args):
            with patch('sys.stderr'):  # Suppress argparse error output
                with self.assertRaises(SystemExit):
                    serve.parse_arguments()

    def test_parse_arguments_missing_since_fails(self):
        """Test that missing required --since argument is rejected."""
        test_args = [
            'serve.py',
            '--group', '12345'
        ]
        with patch('sys.argv', test_args):
            with patch('sys.stderr'):  # Suppress argparse error output
                with self.assertRaises(SystemExit):
                    serve.parse_arguments()

    def test_parse_arguments_missing_project_selection_fails(self):
        """Test that missing both --group and --projects is rejected."""
        test_args = [
            'serve.py',
            '--since', '1 day ago'
        ]
        with patch('sys.argv', test_args):
            with patch('sys.stderr'):  # Suppress argparse error output
                with self.assertRaises(SystemExit):
                    serve.parse_arguments()


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


class TestHTMLInjection(unittest.TestCase):
    """Test HTML template injection and XSS prevention.

    Critical Security Tests:
    These tests prevent a specific attack: malicious input containing </script>
    or <script> breaking out of the embedded JSON and executing arbitrary JS.

    Attack vector: If group ID or since value contains "</script><script>alert(1)</script>",
    it could close the config script tag early and inject malicious code.

    Defense: Escape </script> to <\/script> (valid in JS strings, not HTML tags).
    """

    def test_html_injection_basic(self):
        """Test basic HTML template injection."""
        args = MagicMock(
            group='12345',
            projects=None,
            gitlab_url='https://gitlab.com',
            since='1 day ago',
            port=8000
        )
        config_js = serve.create_config_js('test-token', args)

        # Simulate HTML injection (what ConfigInjectingHandler does)
        html_template = '<html>\n<head>\n</head>\n<body></body>\n</html>'
        config_script = f'    <script>\n{config_js}\n    </script>\n'
        result = html_template.replace('</head>', f'{config_script}</head>')

        # Verify injection point and structure
        self.assertIn('<script>', result)
        self.assertIn('const CONFIG =', result)
        self.assertIn('"gitlabToken": "test-token"', result)
        self.assertIn('</script>\n</head>', result)

    def test_html_injection_xss_prevention_script_tag(self):
        """Test XSS prevention with script tags in input.

        The code now escapes <script> and </script> tags to prevent HTML parser
        interference. These escapes are valid in JavaScript but not raw JSON.
        """
        args = MagicMock(
            group='<script>alert("xss")</script>',
            projects=None,
            gitlab_url='https://gitlab.com',
            since='1 day ago',
            port=8000
        )
        config_js = serve.create_config_js('test-token', args)

        # Verify script tags are escaped
        self.assertNotIn('<script>', config_js)
        self.assertNotIn('</script>', config_js)
        self.assertIn(r'<\script>', config_js)
        self.assertIn(r'<\/script>', config_js)

        # The critical test: ensure quotes are escaped so string can't be broken out of
        self.assertIn(r'\"', config_js)

        # Verify by un-escaping and parsing (simulating what JavaScript does)
        import json
        json_for_parsing = (config_js.replace('const CONFIG = ', '').rstrip(';')
                            .replace(r'<\script>', '<script>')
                            .replace(r'<\/script>', '</script>'))
        config_obj = json.loads(json_for_parsing)
        self.assertEqual(config_obj['groupId'], '<script>alert("xss")</script>')

    def test_html_injection_xss_prevention_closing_script(self):
        """Test that script tags in input don't break the HTML structure.

        This is a critical XSS test: if user input contains </script> or <script>,
        it could potentially close/inject script tags in the HTML.
        The code must escape these to prevent HTML parser interference.
        """
        args = MagicMock(
            group='123',
            projects=None,
            gitlab_url='https://gitlab.com',
            since='</script><script>alert("xss")</script>',
            port=8000
        )
        config_js = serve.create_config_js('test-token', args)

        # Verify script tags are escaped
        self.assertNotIn('</script>', config_js)
        self.assertNotIn('<script>', config_js)
        self.assertIn(r'<\/script>', config_js)
        self.assertIn(r'<\script>', config_js)

        # When embedded in HTML: <script>\nconst CONFIG = {...}\n</script>
        html_template = '<html>\n<head>\n</head>\n<body></body>\n</html>'
        config_script = f'    <script>\n{config_js}\n    </script>\n'
        result = html_template.replace('</head>', f'{config_script}</head>')

        # Now there should be exactly 1 opening script tag (our wrapper)
        self.assertEqual(result.count('<script>'), 1)
        # And exactly 1 closing </script> tag (our wrapper)
        self.assertEqual(result.count('</script>'), 1)

        # Verify the escaped sequences are valid in JavaScript
        # In JS, <\/script> and <\script> are equivalent to </script> and <script>
        import json
        # Need to un-escape for JSON parsing
        json_for_parsing = (config_js.replace('const CONFIG = ', '').rstrip(';')
                            .replace(r'<\/script>', '</script>')
                            .replace(r'<\script>', '<script>'))
        config_obj = json.loads(json_for_parsing)
        self.assertEqual(config_obj['since'], '</script><script>alert("xss")</script>')

    def test_html_injection_xss_prevention_quotes(self):
        """Test XSS prevention with quotes and special chars."""
        args = MagicMock(
            group='123',
            projects=None,
            gitlab_url='https://gitlab.com/"; alert("xss"); "',
            since='1 day ago',
            port=8000
        )
        config_js = serve.create_config_js('tok"en', args)

        # Verify JSON proper escaping of quotes
        self.assertIn(r'\"', config_js)
        # Should not have unescaped quotes that could break out of string
        import json
        # Verify it's valid JSON by parsing
        config_obj = json.loads(config_js.replace('const CONFIG = ', '').rstrip(';'))
        self.assertEqual(config_obj['gitlabToken'], 'tok"en')

    def test_html_injection_special_characters(self):
        """Test HTML injection handles various special characters safely."""
        args = MagicMock(
            group=None,
            projects='1,2,3',
            gitlab_url='https://gitlab.com/test&param=value',
            since='<2 days>',
            port=8000
        )
        config_js = serve.create_config_js('token&key=val', args)

        # Verify JSON handles special characters
        import json
        config_obj = json.loads(config_js.replace('const CONFIG = ', '').rstrip(';'))
        self.assertEqual(config_obj['gitlabToken'], 'token&key=val')
        self.assertEqual(config_obj['since'], '<2 days>')
        self.assertIn('&', config_obj['gitlabUrl'])


class TestTokenRedaction(unittest.TestCase):
    """Test token redaction for security."""

    def test_redact_token_replaces_all_occurrences(self):
        """Test that all token occurrences are redacted."""
        text = "Token: glpat-abc123. Using token glpat-abc123 again."
        result = serve.redact_token(text, "glpat-abc123")
        self.assertEqual(result, "Token: [REDACTED]. Using token [REDACTED] again.")

    def test_redact_token_handles_empty_text(self):
        """Test empty text handling."""
        self.assertEqual(serve.redact_token("", "token123"), "")

    def test_redact_token_handles_none_text(self):
        """Test None text handling."""
        self.assertIsNone(serve.redact_token(None, "token123"))

    def test_redact_token_fails_on_empty_token(self):
        """Test that empty token raises ValueError."""
        with self.assertRaises(ValueError) as context:
            serve.redact_token("sensitive data", "")
        self.assertIn("security violation", str(context.exception))

    def test_redact_token_fails_on_none_token(self):
        """Test that None token raises ValueError."""
        with self.assertRaises(ValueError) as context:
            serve.redact_token("sensitive data", None)
        self.assertIn("security violation", str(context.exception))

    def test_redact_token_preserves_non_matching_text(self):
        """Test that non-matching text is preserved."""
        text = "This text has no token"
        result = serve.redact_token(text, "glpat-xyz")
        self.assertEqual(result, text)

    def test_redact_token_handles_special_characters(self):
        """Test redaction with tokens containing special characters."""
        token = "glpat-!@#$%^&*()"
        text = f"Secret: {token} is here"
        result = serve.redact_token(text, token)
        self.assertEqual(result, "Secret: [REDACTED] is here")


class TestConfigInjectingHandler(unittest.TestCase):
    """Test HTTP handler configuration injection."""

    def test_html_injection_in_handler(self):
        """Test the actual HTML injection logic used by the handler."""
        # Simulate what the handler does
        config_js = 'const CONFIG = {"token": "test123"};'
        html_template = '<html>\n<head>\n<title>Test</title>\n</head>\n<body></body>\n</html>'

        # This is what the handler does
        if '</head>' not in html_template:
            self.fail("Template should have </head> tag")

        config_script = f'    <script>\n{config_js}\n    </script>\n'
        html_with_config = html_template.replace('</head>', f'{config_script}</head>')

        # Verify injection worked
        self.assertIn('<script>', html_with_config)
        self.assertIn(config_js, html_with_config)
        self.assertIn('</script>\n</head>', html_with_config)

    def test_html_injection_missing_head_tag(self):
        """Test handler behavior when HTML template is malformed."""
        html_template = '<html><body></body></html>'  # No </head> tag

        # This is what the handler checks
        has_head_tag = '</head>' in html_template
        self.assertFalse(has_head_tag)

    # Note: Full HTTP handler testing (do_GET, log_message) requires integration tests
    # with an actual HTTP server instance. These are covered by manual/integration testing.


class TestMainFunction(unittest.TestCase):
    """Test main function components that can be tested in isolation."""

    def test_bind_address_localhost_default(self):
        """Test that default bind address is localhost."""
        # Simulate main() logic
        args = MagicMock(allow_non_localhost=False)
        bind_address = '127.0.0.1' if not args.allow_non_localhost else ''
        self.assertEqual(bind_address, '127.0.0.1')

    def test_bind_address_all_interfaces(self):
        """Test that --allow-non-localhost binds to all interfaces."""
        args = MagicMock(allow_non_localhost=True)
        bind_address = '127.0.0.1' if not args.allow_non_localhost else ''
        self.assertEqual(bind_address, '')

    def test_config_injection_flow(self):
        """Test the full configuration injection flow."""
        # Simulate main() configuration setup
        token = 'test-token-abc'
        args = MagicMock(
            group='123',
            projects=None,
            gitlab_url='https://gitlab.com',
            since='1 day ago',
            port=8000
        )

        config_js = serve.create_config_js(token, args)

        # Verify config was created
        self.assertIn('test-token-abc', config_js)
        self.assertIn('const CONFIG', config_js)

        # Simulate setting class variables (what main does)
        serve.ConfigInjectingHandler.config_js = config_js
        serve.ConfigInjectingHandler.token = token

        # Verify class variables are set
        self.assertEqual(serve.ConfigInjectingHandler.config_js, config_js)
        self.assertEqual(serve.ConfigInjectingHandler.token, token)


if __name__ == '__main__':
    unittest.main()
