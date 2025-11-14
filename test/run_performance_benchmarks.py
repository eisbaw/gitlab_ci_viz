#!/usr/bin/env python3
"""
Performance Benchmark Runner

Runs browser-based performance benchmarks using Selenium.
Opens test-performance-benchmarks.html, runs tests, and reports results.
"""

import sys
import subprocess
from pathlib import Path

from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC
from selenium.webdriver.chrome.options import Options


def get_git_commit_hash():
    """Get current git commit hash

    Raises:
        RuntimeError: If git command fails or is not available
    """
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True,
            text=True,
            check=True,
            cwd=Path(__file__).parent.parent,
        )
        return result.stdout.strip()
    except subprocess.CalledProcessError as e:
        raise RuntimeError(f"Failed to get git commit hash: {e.stderr}") from e
    except FileNotFoundError:
        raise RuntimeError(
            "git command not found - check nix-shell environment"
        ) from None


def run_benchmarks():
    """Run performance benchmarks in headless Chrome"""
    # Get test file path
    test_file = Path(__file__).parent / "test-performance-benchmarks.html"
    if not test_file.exists():
        print(f"Error: Test file not found: {test_file}")
        return False

    test_url = f"file://{test_file.absolute()}"

    # Configure headless Chrome
    chrome_options = Options()
    chrome_options.add_argument("--headless")
    chrome_options.add_argument("--disable-gpu")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")

    print("Starting headless Chrome...")
    driver = None

    try:
        driver = webdriver.Chrome(options=chrome_options)
        driver.get(test_url)

        print(f"Loaded: {test_url}")
        print("Running benchmarks...")

        # Wait for page to load
        WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((By.ID, "run-tests"))
        )

        # Click run tests button
        run_button = driver.find_element(By.ID, "run-tests")
        run_button.click()

        # Wait for tests to complete (button text changes back)
        WebDriverWait(driver, 30).until(
            lambda d: d.find_element(By.ID, "run-tests").text == "Run Benchmarks Again"
        )

        print("\nBenchmarks complete!")

        # Get summary
        summary = driver.find_element(By.CLASS_NAME, "summary")
        print("\n" + "=" * 80)
        print("SUMMARY")
        print("=" * 80)
        print(summary.text)

        # Get individual test results
        test_results = driver.find_elements(By.CLASS_NAME, "test-result")
        print("\n" + "=" * 80)
        print("RESULTS")
        print("=" * 80)

        all_passed = True
        for result in test_results:
            print(result.text)
            print("-" * 80)
            if "FAIL" in result.text:
                all_passed = False

        # Get metadata
        metadata = driver.find_element(By.CLASS_NAME, "metadata")
        print("\n" + "=" * 80)
        print("METADATA")
        print("=" * 80)
        print(metadata.text)
        print("=" * 80)

        return all_passed

    except Exception as e:
        print(f"Error running benchmarks: {e}")
        return False

    finally:
        if driver:
            driver.quit()


if __name__ == "__main__":
    success = run_benchmarks()
    sys.exit(0 if success else 1)
