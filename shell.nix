{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
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

    # GitLab CLI
    glab

    # Task automation
    just
  ];

  shellHook = ''
    echo "GitLab CI GANTT Visualizer - Development Environment"
    python --version
    glab --version
  '';
}
