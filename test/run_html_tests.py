#!/usr/bin/env python3
"""
Simple HTML test runner that opens test files and checks for test results.
Uses Python's http.server to serve the files and a headless browser to run tests.
"""

import http.server
import socketserver
import threading
import time
import sys
from pathlib import Path

# Try to import selenium for headless browser testing
try:
    from selenium import webdriver
    from selenium.webdriver.chrome.options import Options
    from selenium.webdriver.common.by import By
    from selenium.webdriver.support.ui import WebDriverWait
    from selenium.webdriver.support import expected_conditions as EC
    SELENIUM_AVAILABLE = True
except ImportError:
    SELENIUM_AVAILABLE = False

def serve_files(port=8888):
    """Start a simple HTTP server to serve test files."""
    # Change to project root so we can serve both test/ and static/ directories
    project_root = Path(__file__).parent.parent

    class Handler(http.server.SimpleHTTPRequestHandler):
        def __init__(self, *args, **kwargs):
            super().__init__(*args, directory=str(project_root), **kwargs)

        def log_message(self, format, *args):
            # Suppress HTTP server logs
            pass

    with socketserver.TCPServer(("", port), Handler) as httpd:
        httpd.serve_forever()

def run_test_in_browser(test_file, port=8888):
    """Run a single HTML test file in headless browser."""
    if not SELENIUM_AVAILABLE:
        print(f"⚠ Selenium not available - skipping browser test for {test_file}")
        print("  Run manually in browser: http://localhost:8000/test/" + test_file)
        return True

    print(f"Running {test_file}...")

    # Setup Chrome in headless mode
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    driver = None
    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.get(f"http://localhost:{port}/test/{test_file}")

        # Wait for tests to complete (look for summary div)
        wait = WebDriverWait(driver, 30)
        summary = wait.until(
            EC.presence_of_element_located((By.CLASS_NAME, "summary"))
        )

        # Get test results
        summary_text = summary.text
        print(f"  {summary_text}")

        # Check if any tests failed
        if "Failed: 0" in summary_text:
            print(f"✓ All tests passed in {test_file}")
            return True
        else:
            print(f"✗ Some tests failed in {test_file}")

            # Print failed test details
            failed_tests = driver.find_elements(By.CLASS_NAME, "fail")
            for test in failed_tests:
                parent = test.find_element(By.XPATH, "..")
                print(f"  Failed: {parent.text}")

            return False

    except Exception as e:
        print(f"✗ Error running {test_file}: {e}")
        return False

    finally:
        if driver:
            driver.quit()

def main():
    """Main test runner."""
    # Start HTTP server in background thread
    print("Starting HTTP server on port 8888...")
    server_thread = threading.Thread(target=serve_files, daemon=True)
    server_thread.start()
    time.sleep(1)  # Give server time to start

    # Test files to run
    test_files = [
        "test-data-transformer.html",
        "test-api-integration.html",
    ]

    if not SELENIUM_AVAILABLE:
        print("\n" + "="*60)
        print("MANUAL TESTING REQUIRED")
        print("="*60)
        print("\nSelenium is not available. To run JavaScript tests manually:")
        print("\n1. Start the server:")
        print("   python serve.py --group 123 --since '1 day ago'")
        print("\n2. Open test files in browser:")
        for test_file in test_files:
            print(f"   http://localhost:8000/test/{test_file}")
        print("\n3. Verify all tests show green checkmarks")
        print("="*60 + "\n")
        return 0

    # Run tests
    all_passed = True
    for test_file in test_files:
        if not run_test_in_browser(test_file):
            all_passed = False

    # Print final result
    print("\n" + "="*60)
    if all_passed:
        print("✓ All HTML tests passed!")
    else:
        print("✗ Some HTML tests failed")
    print("="*60)

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
