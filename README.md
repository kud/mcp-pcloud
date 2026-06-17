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

<a href="https://kud.io/projects/mcp-pcloud">Website</a> · <a href="https://kud.io/projects/mcp-pcloud/docs">Documentation</a>

</div>

---

An MCP server for pCloud — manage trash and file rewind recovery directly from your AI assistant.

## ✨ Features

- 🔐 Bearer token — reads from `~/.config/pcloud/tokens.json` or env var
- 🛠️ 4 tools covering trash management and file rewind/recovery
- ⚡ Built on TypeScript + MCP SDK 1.27
- 🗑️ List and restore files from trash
- ⏪ Browse version history and recover older file versions
- 🌍 Respects pCloud's dynamic API hostname (EU/US routing)

## 🚀 Install

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

## 📖 Documentation

Full tool reference, usage, and configuration live on the docs site:

**→ [kud.io/projects/mcp-pcloud/docs](https://kud.io/projects/mcp-pcloud/docs)**

## 🔧 Development

1. Run `npm run typecheck` — zero errors required
2. Run `npm run build` — must succeed
3. Follow the single-file pattern in `src/index.ts` — exported handlers, no inline comments

## License

[MIT](LICENSE)
