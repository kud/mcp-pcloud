<div align="center">

<img src="assets/logo.png" width="128" alt="mcp-pcloud icon" />

![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![npm](https://img.shields.io/badge/npm-%40kud%2Fmcp--pcloud-CB3837?style=flat-square&logo=npm&logoColor=white)
![MIT](https://img.shields.io/badge/licence-MIT-22C55E?style=flat-square)

**MCP server for pCloud — manage trash, rewind, and file recovery.**

<a href="https://kud.io/projects/mcp-pcloud">Website</a> · <a href="https://kud.io/projects/mcp-pcloud/docs">Documentation</a>

</div>

## Features

- **Trash management** — list deleted files and restore them by ID from pCloud trash.
- **Rewind recovery** — browse version history for any file path and restore a previous version to a new location.
- **File revisions** — list all revisions for a file and revert to any prior state.
- **Folder and file operations** — list, stat, copy, move, rename, create, and delete files and folders.
- **Sharing** — share folders with other pCloud users, accept or decline incoming share requests, and remove active shares.
- **Public links** — create, list, and delete public download links for files and folders, with optional expiry and download limits.

## Install

Add the server to your MCP client config:

```json
{
  "mcpServers": {
    "mcp-pcloud": {
      "command": "npx",
      "args": ["-y", "@kud/mcp-pcloud"],
      "env": {
        "MCP_PCLOUD_TOKEN": "your-pcloud-token"
      }
    }
  }
}
```

Authentication is resolved from environment variables. Set one of:

- `MCP_PCLOUD_TOKEN` — a pCloud access token (simplest)
- `MCP_PCLOUD_CLIENT_ID` + `MCP_PCLOUD_CLIENT_SECRET` — OAuth credentials

## Usage

Once configured, the following tools are available to your AI assistant:

| Tool                    | Description                                              |
| ----------------------- | -------------------------------------------------------- |
| `list_trash`            | List all files currently in pCloud trash                 |
| `restore_from_trash`    | Restore a file from trash by file ID                     |
| `list_rewind_events`    | List version history for a file path                     |
| `restore_from_rewind`   | Restore a file from its rewind history to a new path     |
| `list_revisions`        | List all revisions for a file                            |
| `revert_revision`       | Revert a file to a previous revision                     |
| `get_user_info`         | Get account info: quota, email, and plan                 |
| `list_folder`           | List the contents of a folder                            |
| `get_file_stat`         | Get metadata for a file or folder                        |
| `create_folder`         | Create a folder                                          |
| `copy_file`             | Copy a file to a new path                                |
| `move_file`             | Move a file to a new path                                |
| `rename_file`           | Rename a file                                            |
| `delete_file`           | Permanently delete a file                                |
| `delete_folder`         | Recursively delete a folder and all its contents         |
| `get_file_link`         | Get a download URL for a file                            |
| `get_checksum`          | Get SHA256, SHA1, and MD5 checksums for a file           |
| `get_zip_link`          | Get a download URL for a ZIP archive of files or folders |
| `list_shares`           | List all active folder shares                            |
| `share_folder`          | Share a folder with another pCloud user                  |
| `accept_share`          | Accept an incoming share request                         |
| `decline_share`         | Decline an incoming share request                        |
| `remove_share`          | Remove an active share                                   |
| `create_file_publink`   | Create a public download link for a file                 |
| `create_folder_publink` | Create a public link for a folder                        |
| `list_publinks`         | List all active public links                             |
| `delete_publink`        | Delete a public link by its code                         |

## Development

```sh
git clone https://github.com/kud/mcp-pcloud.git
cd mcp-pcloud
npm install
npm run dev
```

| Script              | Purpose                                           |
| ------------------- | ------------------------------------------------- |
| `npm run dev`       | Run from source via `tsx`                         |
| `npm run build`     | Compile TypeScript to `dist/`                     |
| `npm run typecheck` | Type-check without emitting                       |
| `npm test`          | Run the test suite with Vitest                    |
| `npm run inspect`   | Launch the MCP inspector against the built server |

---

📚 **Full documentation → [mcp-pcloud/docs](https://kud.io/projects/mcp-pcloud/docs)**
