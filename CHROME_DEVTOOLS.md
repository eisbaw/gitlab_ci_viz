# Chrome DevTools MCP Integration

This project includes Chrome DevTools MCP (Model Context Protocol) integration for browser automation and debugging, configured to use project-local resources.

## Features

- **Project-local Chrome profile**: Browser data stored in `.chrome-profile/` (git-ignored)
- **No global contamination**: Your personal Chrome settings remain untouched
- **Shareable configuration**: Team members get the same setup via nix-shell
- **Reproducible environment**: Chromium version pinned in shell.nix

## Quick Start

### 1. Enter nix-shell

```bash
nix-shell
```

This sets up:
- Node.js 22 (for chrome-devtools-mcp)
- Chromium browser
- Environment variables (CHROMIUM_PATH, CHROME_PROFILE_DIR)

### 2. Use Chrome in your workflow

```bash
# Launch Chrome with project-local profile
just chrome

# Launch Chrome with DevTools open
just chrome-devtools

# Visit your app (example)
just chrome http://localhost:8000
```

### 3. Claude Code Integration

The `.mcp.json` configuration enables Claude Code to control Chrome via MCP:

- The `chrome-devtools-mcp-wrapper.sh` script launches the MCP server
- It uses the nix-shell environment for correct Node.js and Chromium
- Browser sessions use the project-local profile

## Maintenance

```bash
# Clean Chrome profile (removes all browser data)
just clean-chrome
```

## How It Works

1. **shell.nix** exports environment variables:
   - `CHROMIUM_PATH`: Path to chromium binary from Nix
   - `CHROME_PROFILE_DIR`: Points to `.chrome-profile/` in project root

2. **chrome-devtools-mcp-wrapper.sh** launches the MCP server:
   - Validates environment and dependencies
   - Runs within nix-shell for correct Node.js and Chromium versions
   - Uses chrome-devtools-mcp@0.10.1 (pinned for reproducibility)
   - Passes environment variables to ensure project-local profile

3. **.mcp.json** configures Claude Code:
   - Registers the chrome-devtools MCP server
   - Points to the wrapper script

## For Team Members

When you clone this repository:

1. Run `nix-shell` (one-time setup downloads packages)
2. The Chrome profile directory is automatically created
3. Use `just chrome` or let Claude Code control the browser
4. Your personal Chrome remains unaffected

## Troubleshooting

**MCP not working in Claude Code:**
- Ensure you're running Claude Code from within the nix-shell
- Check that Node.js 22+ is available: `node --version`
- Verify CHROMIUM_PATH is set: `echo $CHROMIUM_PATH`

**Chrome won't launch:**
- Run `just chrome` from within nix-shell
- Check that `.chrome-profile/` directory exists

**Want to start fresh:**
- Run `just clean-chrome` to remove all browser data
