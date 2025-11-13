{ pkgs ? import <nixpkgs> {} }:

pkgs.mkShell {
  buildInputs = with pkgs; [
    # Python development
    python3
    python3Packages.pytest
    python3Packages.pytest-cov

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
