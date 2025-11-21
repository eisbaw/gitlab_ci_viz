#!/usr/bin/env python3
"""
Take screenshots of localhost:8000 using Selenium and headless Chromium
"""

import sys
import os
import time
from pathlib import Path
from selenium import webdriver
from selenium.webdriver.chrome.options import Options


def take_screenshots(commit_sha, wait_time=30):
    """Take screenshots of the GitLab CI visualization"""

    # Create output directory
    output_dir = Path(f"screenshots/{commit_sha}")
    output_dir.mkdir(parents=True, exist_ok=True)

    # Setup Chrome options for headless browsing
    chrome_options = Options()
    chrome_options.add_argument("--headless=new")
    chrome_options.add_argument("--no-sandbox")
    chrome_options.add_argument("--disable-dev-shm-usage")
    chrome_options.add_argument("--window-size=1920,1080")
    chrome_options.add_argument("--disable-gpu")

    # Use chromium from nix environment
    chromium_path = os.environ.get("CHROMIUM_PATH", "chromium")
    chrome_options.binary_location = chromium_path

    # Initialize driver
    driver = webdriver.Chrome(options=chrome_options)

    try:
        print("Loading http://localhost:8000...")
        start_time = time.time()
        driver.get("http://localhost:8000")

        # Wait for the page to load and render
        print(f"Waiting {wait_time} seconds for page to fully render...")
        time.sleep(wait_time)

        load_time = time.time() - start_time
        print(f"Page loaded in {load_time:.2f}s")

        # Take full page screenshot
        screenshot_path = output_dir / "screenshot.png"
        driver.save_screenshot(str(screenshot_path))
        print(f"Saved screenshot to {screenshot_path}")

        # Also take viewport screenshot
        viewport_path = output_dir / "viewport.png"
        driver.save_screenshot(str(viewport_path))
        print(f"Saved viewport screenshot to {viewport_path}")

        # Get page dimensions for reporting
        width = driver.execute_script("return document.body.scrollWidth")
        height = driver.execute_script("return document.body.scrollHeight")
        print(f"Page dimensions: {width}x{height}")

        return load_time

    finally:
        driver.quit()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python take_screenshot.py <commit-sha> [wait_time]")
        sys.exit(1)

    commit_sha = sys.argv[1]
    wait_time = int(sys.argv[2]) if len(sys.argv) > 2 else 30

    load_time = take_screenshots(commit_sha, wait_time)
    print("\\nScreenshots captured successfully!")
    print(f"Load time: {load_time:.2f}s")
