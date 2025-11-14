{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Node.js (required for chrome-devtools-mcp MCP server - needs >=20.19.0)
    nodejs_22

    # Python development
    python3
    python3Packages.pytest
    python3Packages.pytest-cov
    ruff

    # Performance testing dependencies
    # Browser required because Performance API tests must run in real browser environment
    # Python selenium + chromium enables headless automated benchmarking
    python3Packages.selenium
    chromium
    chromedriver

    # GitLab CI visualization
    glab

    # Task automation
    just
  ];

  shellHook = ''
    echo "GitLab CI GANTT Visualizer - Development Environment"
    python --version
    glab --version

    # Export paths for Chrome DevTools MCP integration
    export CHROMIUM_PATH="${pkgs.chromium}/bin/chromium"
    export CHROME_PROFILE_DIR="$(pwd)/.chrome-profile"

    # Create project-local Chrome profile directory if it doesn't exist
    mkdir -p "$CHROME_PROFILE_DIR"
  '';
}
