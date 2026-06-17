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

**An MCP server for pCloud — manage trash, files, sharing, public links, and file rewind recovery from your AI assistant.**

<a href="https://kud.io/projects/mcp-pcloud">Website</a> · <a href="https://kud.io/projects/mcp-pcloud/docs">Documentation</a>

</div>

## Install

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

## Development

1. Run `npm run typecheck` — zero errors required
2. Run `npm run build` — must succeed
3. Follow the single-file pattern in `src/index.ts` — exported handlers, no inline comments

---

📚 **Full documentation → https://kud.io/projects/mcp-pcloud/docs**
