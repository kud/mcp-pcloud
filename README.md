> ⚠️ **Draft — not working yet.** Authentication flow is under active development.

# pCloud MCP Server

<div align="center">
  <img src="assets/logo.png" width="120" alt="mcp-pcloud logo" />
</div>

<div align="center">

![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue?logo=typescript)
![Node.js](https://img.shields.io/badge/Node.js-20+-green?logo=node.js)
![MCP](https://img.shields.io/badge/MCP-1.0-purple?logo=anthropic)
![npm](https://img.shields.io/badge/npm-%40kud%2Fmcp--pcloud-red?logo=npm)
![License](https://img.shields.io/badge/License-MIT-blue)

**Manage pCloud trash and file rewind history directly from your AI assistant.**

[Features](#-features) • [Quick Start](#-quick-start) • [Installation](#-installation-guides) • [Tools](#-available-tools) • [Development](#-development)

</div>

---

## 🌟 Features

- 🔐 Bearer token — reads from `~/.config/pcloud/tokens.json` or env var
- 🛠️ 4 tools covering trash management and file rewind/recovery
- ⚡ Built on TypeScript + MCP SDK 1.27
- 🗑️ List and restore files from trash
- ⏪ Browse version history and recover older file versions
- 🌍 Respects pCloud's dynamic API hostname (EU/US routing)

---

## 🚀 Quick Start

### Prerequisites

- Node.js 20+
- A pCloud account
- A pCloud access token — via `MCP_PCLOUD_TOKEN` env var or `~/.config/pcloud/tokens.json`

### Installation

```bash
npx @kud/mcp-pcloud
```

Or clone locally:

```bash
git clone https://github.com/kud/mcp-pcloud.git
cd mcp-pcloud
npm install && npm run build
```

### Quick Setup (Claude Desktop)

```json
{
  "mcpServers": {
    "mcp-pcloud": {
      "command": "npx",
      "args": ["-y", "@kud/mcp-pcloud"]
    }
  }
}
```

✅ Restart Claude Desktop — pCloud tools will appear automatically.

---

## 📚 Installation Guides

- [Claude Code CLI](#-claude-code-cli)
- [Claude Desktop](#-claude-desktop-macos--windows)
- [Cursor](#-cursor)
- [Windsurf](#-windsurf)
- [VSCode](#-vscode)

---

<details>
<summary><h3>⌨️ Claude Code CLI</h3></summary>

```bash
claude mcp add mcp-pcloud -- npx -y @kud/mcp-pcloud
```

</details>

<details>
<summary><h3>🖥️ Claude Desktop (macOS + Windows)</h3></summary>

Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "mcp-pcloud": {
      "command": "npx",
      "args": ["-y", "@kud/mcp-pcloud"],
      "env": {
        "MCP_PCLOUD_TOKEN": "your-token-here"
      }
    }
  }
}
```

</details>

<details>
<summary><h3>🖱️ Cursor</h3></summary>

Add to `.cursor/mcp.json` in your project root:

```json
{
  "mcpServers": {
    "mcp-pcloud": {
      "command": "npx",
      "args": ["-y", "@kud/mcp-pcloud"]
    }
  }
}
```

</details>

<details>
<summary><h3>🌊 Windsurf</h3></summary>

Add to your Windsurf MCP config:

```json
{
  "mcpServers": {
    "mcp-pcloud": {
      "command": "npx",
      "args": ["-y", "@kud/mcp-pcloud"]
    }
  }
}
```

</details>

<details>
<summary><h3>🔵 VSCode</h3></summary>

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "mcp-pcloud": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "@kud/mcp-pcloud"]
    }
  }
}
```

</details>

---

## 🛠️ Available Tools

### 🗑️ Trash (2 tools)

| Tool                 | Description                                                    |
| -------------------- | -------------------------------------------------------------- |
| `list_trash`         | List all files currently in the pCloud trash                   |
| `restore_from_trash` | Restore a file from trash by file ID (requires `confirm=true`) |

### ⏪ Rewind (2 tools)

| Tool                  | Description                                                                |
| --------------------- | -------------------------------------------------------------------------- |
| `list_rewind_events`  | List version history events for a file path                                |
| `restore_from_rewind` | Restore a file from rewind history to a new path (requires `confirm=true`) |

### 👤 User (1 tool)

| Tool            | Description                              |
| --------------- | ---------------------------------------- |
| `get_user_info` | Get account info: email, quota, and plan |

### 📁 Files (10 tools)

| Tool            | Description                                           |
| --------------- | ----------------------------------------------------- |
| `list_folder`   | List the contents of a folder                         |
| `get_file_stat` | Get metadata for a file or folder                     |
| `create_folder` | Create a folder (no-op if already exists)             |
| `copy_file`     | Copy a file to a new path                             |
| `move_file`     | Move a file to a new path                             |
| `rename_file`   | Rename a file                                         |
| `delete_file`   | Permanently delete a file (requires `confirm=true`)   |
| `delete_folder` | Recursively delete a folder (requires `confirm=true`) |
| `get_file_link` | Get a download URL for a file                         |
| `get_checksum`  | Get SHA256, SHA1, and MD5 checksums for a file        |

### 🤝 Sharing (5 tools)

| Tool            | Description                                      |
| --------------- | ------------------------------------------------ |
| `list_shares`   | List all active folder shares                    |
| `share_folder`  | Share a folder with another pCloud user          |
| `accept_share`  | Accept an incoming share request                 |
| `decline_share` | Decline an incoming share request                |
| `remove_share`  | Remove an active share (requires `confirm=true`) |

### 🔗 Public Links (4 tools)

| Tool                    | Description                                    |
| ----------------------- | ---------------------------------------------- |
| `create_file_publink`   | Create a public download link for a file       |
| `create_folder_publink` | Create a public link for a folder              |
| `list_publinks`         | List all active public links                   |
| `delete_publink`        | Delete a public link (requires `confirm=true`) |

### 🗜️ Zip (1 tool)

| Tool           | Description                                                  |
| -------------- | ------------------------------------------------------------ |
| `get_zip_link` | Get a download URL for a ZIP archive of files and/or folders |

### 🔄 Revisions (2 tools)

| Tool              | Description                                                    |
| ----------------- | -------------------------------------------------------------- |
| `list_revisions`  | List all revisions for a file                                  |
| `revert_revision` | Revert a file to a previous revision (requires `confirm=true`) |

**Total: 27 Tools** covering the full pCloud API surface!

---

## 💬 Example Conversations

```
You: "What files do I have in my pCloud trash?"
AI: *calls list_trash and returns a formatted list of deleted files with dates and sizes*

You: "Restore file ID 12345 from my trash"
AI: *calls restore_from_trash with confirm=true and confirms the file was restored*

You: "Show me the version history for /Documents/report.pdf"
AI: *calls list_rewind_events and returns a timeline of previous versions*

You: "I need the version of report.pdf from two weeks ago"
AI: *identifies the matching rewind event fileid and asks for a destination path*

You: "Restore it to /Documents/report-recovered.pdf"
AI: *calls restore_from_rewind with the fileid and topath*

You: "Did I accidentally delete anything today?"
AI: *calls list_trash and filters results by today's date*
```

---

## 🧪 Development

### Project Structure

```
mcp-pcloud/
  src/
    index.ts              # Server entry, all tool handlers
    __tests__/
      tools.test.ts       # Vitest unit tests
  dist/                   # Compiled output
  package.json
  tsconfig.json
  CLAUDE.md
  .mcp.json
```

### Available Scripts

| Script                | Description                 |
| --------------------- | --------------------------- |
| `npm run build`       | Compile TypeScript to dist/ |
| `npm run build:watch` | Watch mode compilation      |
| `npm run dev`         | Run via tsx (no build)      |
| `npm test`            | Run test suite              |
| `npm run test:watch`  | Watch mode tests            |
| `npm run coverage`    | Test coverage report        |
| `npm run inspect`     | MCP Inspector (built)       |
| `npm run inspect:dev` | MCP Inspector (tsx)         |
| `npm run typecheck`   | Type-check without emitting |

### Development Workflow

Terminal 1 — watch compiler:

```bash
npm run build:watch
```

Terminal 2 — MCP Inspector:

```bash
npm run inspect:dev
```

### Testing with MCP Inspector

```bash
export MCP_PCLOUD_TOKEN=your-token
npm run inspect:dev
```

Open http://localhost:5173 to interact with tools live.

---

## 🔐 Authentication

The server resolves your token in this order:

1. `MCP_PCLOUD_TOKEN` environment variable
2. `~/.config/pcloud/tokens.json`

The token file format:

```json
{
  "access_token": "your-token-here",
  "hostname": "api.pcloud.com"
}
```

`hostname` is optional — omit it and the server defaults to `api.pcloud.com`. Use `eapi.pcloud.com` for EU accounts.

To verify your token manually:

```bash
curl "https://api.pcloud.com/userinfo?access_token=YOUR_TOKEN"
```

---

## 🐛 Troubleshooting

### Server Not Showing

- Confirm `node --version` is ≥ 20
- Run `claude mcp get mcp-pcloud` to check registration
- Check that `MCP_PCLOUD_TOKEN` is set or `pcloud login` has been run

### Authentication Errors

```bash
curl "https://api.pcloud.com/listtrash?access_token=YOUR_TOKEN"
```

A `result: 0` response confirms the token is valid.

### Check Logs

- macOS: `~/Library/Logs/Claude/mcp-server-mcp-pcloud.log`
- Windows: `%APPDATA%\Claude\logs\mcp-server-mcp-pcloud.log`
- CLI: `claude mcp get mcp-pcloud`

---

## 🔒 Security Best Practices

- ✅ Never hardcode your access token in source code
- ✅ Never commit `~/.config/pcloud/tokens.json`
- ✅ Set `MCP_PCLOUD_TOKEN` via your shell profile, not in project files
- ✅ Rotate your token at https://my.pcloud.com if exposed

---

## 📊 Tech Stack

**Runtime** Node.js 20+
**Language** TypeScript 5
**Protocol** Model Context Protocol 1.0
**HTTP Client** Native `fetch`
**Module System** ESM (`"type": "module"`)

---

## 🤝 Contributing

1. Run `npm run typecheck` — zero errors required
2. Run `npm run build` — must succeed
3. Follow the single-file pattern in `src/index.ts` — exported handlers, no inline comments

---

## 📄 License

[MIT](LICENSE)

---

## 🙏 Acknowledgments

- [Model Context Protocol](https://modelcontextprotocol.io)
- [pCloud API Docs](https://docs.pcloud.com/)

---

## 📮 Support

[Open an issue](https://github.com/kud/mcp-pcloud/issues)

---

<div align="center">

**Made with ❤️ for pCloud users**

⭐ Star this repo if it helped you!

[Back to Top](#pcloud-mcp-server)

</div>
