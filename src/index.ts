#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "fs"
import { createServer } from "http"
import { homedir } from "os"
import { join } from "path"
import { exec } from "child_process"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

interface StoredTokens {
  access_token: string
  hostname?: string
}

const TOKENS_PATH = join(homedir(), ".config", "pcloud", "tokens.json")

const loadStoredTokens = (): StoredTokens | null => {
  try {
    return JSON.parse(readFileSync(TOKENS_PATH, "utf8")) as StoredTokens
  } catch {
    return null
  }
}

const saveTokens = (tokens: StoredTokens) => {
  mkdirSync(join(homedir(), ".config", "pcloud"), { recursive: true })
  writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2))
}

const openBrowser = (url: string) => {
  const cmd =
    process.platform === "darwin"
      ? "open"
      : process.platform === "win32"
        ? "start"
        : "xdg-open"
  exec(`${cmd} "${url}"`)
}

const runOAuthFlow = (
  clientId: string,
  clientSecret: string,
): Promise<StoredTokens> =>
  new Promise((resolve, reject) => {
    const httpServer = createServer(async (req, res) => {
      const url = new URL(req.url!, "http://localhost")
      const code = url.searchParams.get("code")

      if (!code) {
        res.writeHead(400)
        res.end("Missing code parameter")
        return
      }

      res.writeHead(200, { "Content-Type": "text/html" })
      res.end(
        "<html><body><h2>✅ Authenticated with pCloud! You can close this tab.</h2></body></html>",
      )
      httpServer.close()

      try {
        const tokenUrl = new URL("https://api.pcloud.com/oauth2_token")
        tokenUrl.searchParams.set("client_id", clientId)
        tokenUrl.searchParams.set("client_secret", clientSecret)
        tokenUrl.searchParams.set("code", code)

        const response = await fetch(tokenUrl.toString())
        const data = (await response.json()) as {
          access_token?: string
          hostname?: string
          error?: string
        }

        if (!data.access_token) {
          reject(new Error(data.error ?? "Token exchange failed"))
          return
        }

        resolve({ access_token: data.access_token, hostname: data.hostname })
      } catch (e) {
        reject(e)
      }
    })

    httpServer.listen(0, "localhost", () => {
      const port = (httpServer.address() as { port: number }).port
      const authUrl = new URL("https://my.pcloud.com/oauth2/authorize")
      authUrl.searchParams.set("client_id", clientId)
      authUrl.searchParams.set(
        "redirect_uri",
        `http://localhost:${port}/callback`,
      )
      authUrl.searchParams.set("response_type", "code")

      console.error("Opening browser for pCloud authentication…")
      console.error(
        `If the browser does not open, visit:\n${authUrl.toString()}`,
      )
      openBrowser(authUrl.toString())
    })
  })

const resolveAuth = async (): Promise<{ token: string; apiBase: string }> => {
  if (process.env["MCP_PCLOUD_TOKEN"]) {
    return {
      token: process.env["MCP_PCLOUD_TOKEN"],
      apiBase: "https://api.pcloud.com",
    }
  }

  const stored = loadStoredTokens()
  if (stored?.access_token) {
    return {
      token: stored.access_token,
      apiBase: `https://${stored.hostname ?? "api.pcloud.com"}`,
    }
  }

  const clientId = process.env["MCP_PCLOUD_CLIENT_ID"]
  const clientSecret = process.env["MCP_PCLOUD_CLIENT_SECRET"]
  if (clientId && clientSecret) {
    const tokens = await runOAuthFlow(clientId, clientSecret)
    saveTokens(tokens)
    return {
      token: tokens.access_token,
      apiBase: `https://${tokens.hostname ?? "api.pcloud.com"}`,
    }
  }

  console.error(
    "No pCloud token found. Set MCP_PCLOUD_TOKEN, or MCP_PCLOUD_CLIENT_ID + MCP_PCLOUD_CLIENT_SECRET, or create ~/.config/pcloud/tokens.json.",
  )
  process.exit(1)
}

let ACCESS_TOKEN: string
let API_BASE: string

export const apiFetch = async <T>(
  path: string,
  params: Record<string, string> = {},
): Promise<T | null> => {
  const url = new URL(`${API_BASE}${path}`)
  url.searchParams.set("access_token", ACCESS_TOKEN!)
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)

  try {
    const response = await fetch(url.toString())
    if (!response.ok) {
      console.error(`API error: ${response.status} ${path}`)
      return null
    }
    const data = (await response.json()) as T & {
      result: number
      error?: string
    }
    if ((data as { result: number }).result !== 0) {
      console.error(
        `pCloud error on ${path}: ${(data as { error?: string }).error ?? "unknown"}`,
      )
      return null
    }
    return data
  } catch (e) {
    console.error(`Fetch failed: ${path}`, e)
    return null
  }
}

export const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

export const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

// ─── Trash ───

interface TrashItem {
  fileid: number
  name: string
  path: string
  deletetime: number
  size: number
}

interface ListTrashResponse {
  result: number
  items: TrashItem[]
}

export const listTrash = async () => {
  const data = await apiFetch<ListTrashResponse>("/listtrash")
  if (!data) return err("failed to list trash")
  return ok(
    data.items.map((item) => ({
      fileid: item.fileid,
      name: item.name,
      path: item.path,
      deletedAt: new Date(item.deletetime * 1000).toISOString(),
      sizeBytes: item.size,
    })),
  )
}

export const restoreFromTrash = async ({
  fileid,
  confirm,
}: {
  fileid: number
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to restore a file from trash")
  const data = await apiFetch<{ result: number }>("/trash_restore", {
    fileid: String(fileid),
  })
  return data
    ? ok({ restored: true, fileid })
    : err("failed to restore from trash")
}

// ─── Rewind ───

interface RewindItem {
  fileid: number
  name: string
  time: number
}

interface ListRewindResponse {
  result: number
  events: RewindItem[]
}

export const listRewindEvents = async ({ path }: { path: string }) => {
  const data = await apiFetch<ListRewindResponse>("/listrewindevents", { path })
  if (!data) return err("failed to list rewind events")
  return ok(
    data.events.map((event) => ({
      fileid: event.fileid,
      name: event.name,
      time: new Date(event.time * 1000).toISOString(),
    })),
  )
}

export const restoreFromRewind = async ({
  fileid,
  topath,
  confirm,
}: {
  fileid: number
  topath: string
  confirm: boolean
}) => {
  if (!confirm)
    return err("set confirm=true to restore a file from rewind history")
  const data = await apiFetch<{ result: number }>("/file_restore", {
    fileid: String(fileid),
    topath,
  })
  return data
    ? ok({ restored: true, fileid, topath })
    : err("failed to restore from rewind")
}

// ─── User ───

interface UserInfoResponse {
  result: number
  email: string
  quota: number
  usedquota: number
  plan: number
}

export const getUserInfo = async () => {
  const data = await apiFetch<UserInfoResponse>("/userinfo")
  if (!data) return err("failed to get user info")
  return ok({
    email: data.email,
    quota: data.quota,
    usedquota: data.usedquota,
    plan: data.plan,
  })
}

// ─── Files ───

export const listFolder = async ({
  path,
  folderid,
  recursive,
}: {
  path?: string
  folderid?: number
  recursive?: boolean
}) => {
  const params: Record<string, string> = {}
  if (path !== undefined) params.path = path
  if (folderid !== undefined) params.folderid = String(folderid)
  if (recursive !== undefined) params.recursive = recursive ? "1" : "0"
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/listfolder",
    params,
  )
  if (!data) return err("failed to list folder")
  return ok(data.metadata)
}

export const getFileStat = async ({
  path,
  fileid,
}: {
  path?: string
  fileid?: number
}) => {
  const params: Record<string, string> = {}
  if (path !== undefined) params.path = path
  if (fileid !== undefined) params.fileid = String(fileid)
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/stat",
    params,
  )
  if (!data) return err("failed to get file stat")
  return ok(data.metadata)
}

export const createFolder = async ({ path }: { path: string }) => {
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/createfolderifnotexists",
    { path },
  )
  if (!data) return err("failed to create folder")
  return ok(data.metadata)
}

export const copyFile = async ({
  fileid,
  topath,
}: {
  fileid: number
  topath: string
}) => {
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/copyfile",
    { fileid: String(fileid), topath },
  )
  if (!data) return err("failed to copy file")
  return ok(data.metadata)
}

export const moveFile = async ({
  fileid,
  topath,
}: {
  fileid: number
  topath: string
}) => {
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/renamefile",
    { fileid: String(fileid), topath },
  )
  if (!data) return err("failed to move file")
  return ok(data.metadata)
}

export const renameFile = async ({
  fileid,
  toname,
}: {
  fileid: number
  toname: string
}) => {
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/renamefile",
    { fileid: String(fileid), toname },
  )
  if (!data) return err("failed to rename file")
  return ok(data.metadata)
}

export const deleteFile = async ({
  fileid,
  confirm,
}: {
  fileid: number
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete a file")
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/deletefile",
    { fileid: String(fileid) },
  )
  if (!data) return err("failed to delete file")
  return ok({ deleted: true, fileid })
}

export const deleteFolder = async ({
  folderid,
  confirm,
}: {
  folderid: number
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete a folder")
  const data = await apiFetch<{ result: number }>("/deletefolderrecursive", {
    folderid: String(folderid),
  })
  if (!data) return err("failed to delete folder")
  return ok({ deleted: true, folderid })
}

export const getFileLink = async ({
  fileid,
  forcedownload,
}: {
  fileid: number
  forcedownload?: boolean
}) => {
  const params: Record<string, string> = { fileid: String(fileid) }
  if (forcedownload !== undefined)
    params.forcedownload = forcedownload ? "1" : "0"
  const data = await apiFetch<{
    result: number
    hosts: string[]
    path: string
  }>("/getfilelink", params)
  if (!data) return err("failed to get file link")
  return ok({ url: `https://${data.hosts[0]}${data.path}` })
}

export const getChecksum = async ({ fileid }: { fileid: number }) => {
  const data = await apiFetch<{
    result: number
    sha256: string
    sha1: string
    md5: string
  }>("/checksumfile", { fileid: String(fileid) })
  if (!data) return err("failed to get checksum")
  return ok({ sha256: data.sha256, sha1: data.sha1, md5: data.md5 })
}

// ─── Sharing ───

export const listShares = async () => {
  const data = await apiFetch<{ result: number; shares: unknown[] }>(
    "/listshares",
  )
  if (!data) return err("failed to list shares")
  return ok(data.shares)
}

export const shareFolder = async ({
  folderid,
  mail,
  permissions,
}: {
  folderid: number
  mail: string
  permissions: number
}) => {
  const data = await apiFetch<{ result: number }>("/sharefolder", {
    folderid: String(folderid),
    mail,
    permissions: String(permissions),
  })
  if (!data) return err("failed to share folder")
  return ok({ shared: true, folderid, mail, permissions })
}

export const acceptShare = async ({
  sharerequestid,
}: {
  sharerequestid: number
}) => {
  const data = await apiFetch<{ result: number }>("/acceptshare", {
    sharerequestid: String(sharerequestid),
  })
  if (!data) return err("failed to accept share")
  return ok({ accepted: true, sharerequestid })
}

export const declineShare = async ({
  sharerequestid,
}: {
  sharerequestid: number
}) => {
  const data = await apiFetch<{ result: number }>("/declineshare", {
    sharerequestid: String(sharerequestid),
  })
  if (!data) return err("failed to decline share")
  return ok({ declined: true, sharerequestid })
}

export const removeShare = async ({
  sharerequestid,
  confirm,
}: {
  sharerequestid: number
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to remove a share")
  const data = await apiFetch<{ result: number }>("/removeshare", {
    sharerequestid: String(sharerequestid),
  })
  if (!data) return err("failed to remove share")
  return ok({ removed: true, sharerequestid })
}

// ─── Public links ───

export const createFilePublink = async ({
  fileid,
  expire,
  maxdownloads,
}: {
  fileid: number
  expire?: string
  maxdownloads?: number
}) => {
  const params: Record<string, string> = { fileid: String(fileid) }
  if (expire !== undefined) params.expire = expire
  if (maxdownloads !== undefined) params.maxdownloads = String(maxdownloads)
  const data = await apiFetch<{ result: number; link: string; code: string }>(
    "/getfilepublink",
    params,
  )
  if (!data) return err("failed to create file public link")
  return ok({ link: data.link, code: data.code })
}

export const createFolderPublink = async ({
  folderid,
  expire,
}: {
  folderid: number
  expire?: string
}) => {
  const params: Record<string, string> = { folderid: String(folderid) }
  if (expire !== undefined) params.expire = expire
  const data = await apiFetch<{ result: number; link: string; code: string }>(
    "/getfolderpublink",
    params,
  )
  if (!data) return err("failed to create folder public link")
  return ok({ link: data.link, code: data.code })
}

export const listPublinks = async () => {
  const data = await apiFetch<{ result: number; publinks: unknown[] }>(
    "/listpublinks",
  )
  if (!data) return err("failed to list public links")
  return ok(data.publinks)
}

export const deletePublink = async ({
  code,
  confirm,
}: {
  code: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete a public link")
  const data = await apiFetch<{ result: number }>("/deletepublink", { code })
  if (!data) return err("failed to delete public link")
  return ok({ deleted: true, code })
}

// ─── Zip ───

export const getZipLink = async ({
  fileids,
  folderids,
  filename,
}: {
  fileids: number[]
  folderids?: number[]
  filename?: string
}) => {
  const params: Record<string, string> = {
    fileids: fileids.join(","),
  }
  if (folderids !== undefined) params.folderids = folderids.join(",")
  if (filename !== undefined) params.filename = filename
  const data = await apiFetch<{
    result: number
    hosts: string[]
    path: string
  }>("/getziplink", params)
  if (!data) return err("failed to get zip link")
  return ok({ url: `https://${data.hosts[0]}${data.path}` })
}

// ─── Revisions ───

export const listRevisions = async ({ fileid }: { fileid: number }) => {
  const data = await apiFetch<{ result: number; revisions: unknown[] }>(
    "/listrevisions",
    { fileid: String(fileid) },
  )
  if (!data) return err("failed to list revisions")
  return ok(data.revisions)
}

export const revertRevision = async ({
  fileid,
  revisionid,
  confirm,
}: {
  fileid: number
  revisionid: number
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to revert a revision")
  const data = await apiFetch<{ result: number; metadata: unknown }>(
    "/revertrevision",
    { fileid: String(fileid), revisionid: String(revisionid) },
  )
  if (!data) return err("failed to revert revision")
  return ok({ reverted: true, fileid, revisionid })
}

// ─── Server ───

const server = new McpServer({ name: "mcp-pcloud", version: "1.0.0" })

server.registerTool(
  "list_trash",
  {
    description: "List all files currently in the pCloud trash",
    inputSchema: {},
  },
  listTrash,
)

server.registerTool(
  "restore_from_trash",
  {
    description: "Restore a file from the pCloud trash by its file ID",
    inputSchema: {
      fileid: z.number().describe("File ID to restore from trash"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the restore"),
    },
  },
  restoreFromTrash,
)

server.registerTool(
  "list_rewind_events",
  {
    description: "List version history (rewind events) for a file path",
    inputSchema: {
      path: z.string().describe("pCloud file path to list rewind events for"),
    },
  },
  listRewindEvents,
)

server.registerTool(
  "restore_from_rewind",
  {
    description: "Restore a file from its rewind history to a new path",
    inputSchema: {
      fileid: z.number().describe("File ID from rewind history to restore"),
      topath: z.string().describe("Destination path for the restored file"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the restore"),
    },
  },
  restoreFromRewind,
)

server.registerTool(
  "get_user_info",
  {
    description: "Get pCloud account info: quota, email, and plan",
    inputSchema: {},
  },
  getUserInfo,
)

server.registerTool(
  "list_folder",
  {
    description: "List the contents of a pCloud folder",
    inputSchema: {
      path: z.string().optional().describe("Folder path"),
      folderid: z.number().optional().describe("Folder ID"),
      recursive: z
        .boolean()
        .optional()
        .describe("Recursively list all contents"),
    },
  },
  listFolder,
)

server.registerTool(
  "get_file_stat",
  {
    description: "Get metadata for a file or folder",
    inputSchema: {
      path: z.string().optional().describe("File or folder path"),
      fileid: z.number().optional().describe("File ID"),
    },
  },
  getFileStat,
)

server.registerTool(
  "create_folder",
  {
    description: "Create a folder (no-op if it already exists)",
    inputSchema: {
      path: z.string().describe("Path of the folder to create"),
    },
  },
  createFolder,
)

server.registerTool(
  "copy_file",
  {
    description: "Copy a file to a new path",
    inputSchema: {
      fileid: z.number().describe("File ID to copy"),
      topath: z.string().describe("Destination path"),
    },
  },
  copyFile,
)

server.registerTool(
  "move_file",
  {
    description: "Move a file to a new path",
    inputSchema: {
      fileid: z.number().describe("File ID to move"),
      topath: z.string().describe("Destination path"),
    },
  },
  moveFile,
)

server.registerTool(
  "rename_file",
  {
    description: "Rename a file",
    inputSchema: {
      fileid: z.number().describe("File ID to rename"),
      toname: z.string().describe("New file name"),
    },
  },
  renameFile,
)

server.registerTool(
  "delete_file",
  {
    description: "Permanently delete a file",
    inputSchema: {
      fileid: z.number().describe("File ID to delete"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the deletion"),
    },
  },
  deleteFile,
)

server.registerTool(
  "delete_folder",
  {
    description: "Recursively delete a folder and all its contents",
    inputSchema: {
      folderid: z.number().describe("Folder ID to delete"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the deletion"),
    },
  },
  deleteFolder,
)

server.registerTool(
  "get_file_link",
  {
    description: "Get a download URL for a file",
    inputSchema: {
      fileid: z.number().describe("File ID"),
      forcedownload: z
        .boolean()
        .optional()
        .describe("Force a download prompt in browsers"),
    },
  },
  getFileLink,
)

server.registerTool(
  "get_checksum",
  {
    description: "Get SHA256, SHA1, and MD5 checksums for a file",
    inputSchema: {
      fileid: z.number().describe("File ID"),
    },
  },
  getChecksum,
)

server.registerTool(
  "list_shares",
  {
    description: "List all active folder shares",
    inputSchema: {},
  },
  listShares,
)

server.registerTool(
  "share_folder",
  {
    description:
      "Share a folder with another pCloud user (permissions: 1=Create, 2=Modify, 4=Delete, combine with bitwise OR)",
    inputSchema: {
      folderid: z.number().describe("Folder ID to share"),
      mail: z.string().describe("Email address of the recipient"),
      permissions: z
        .number()
        .describe("Permission bitmask: 1=Create, 2=Modify, 4=Delete"),
    },
  },
  shareFolder,
)

server.registerTool(
  "accept_share",
  {
    description: "Accept an incoming share request",
    inputSchema: {
      sharerequestid: z.number().describe("Share request ID to accept"),
    },
  },
  acceptShare,
)

server.registerTool(
  "decline_share",
  {
    description: "Decline an incoming share request",
    inputSchema: {
      sharerequestid: z.number().describe("Share request ID to decline"),
    },
  },
  declineShare,
)

server.registerTool(
  "remove_share",
  {
    description: "Remove an active share",
    inputSchema: {
      sharerequestid: z.number().describe("Share request ID to remove"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the removal"),
    },
  },
  removeShare,
)

server.registerTool(
  "create_file_publink",
  {
    description: "Create a public download link for a file",
    inputSchema: {
      fileid: z.number().describe("File ID"),
      expire: z
        .string()
        .optional()
        .describe("Expiry datetime (YYYY-MM-DD HH:MM:SS)"),
      maxdownloads: z
        .number()
        .optional()
        .describe("Maximum number of downloads allowed"),
    },
  },
  createFilePublink,
)

server.registerTool(
  "create_folder_publink",
  {
    description: "Create a public link for a folder",
    inputSchema: {
      folderid: z.number().describe("Folder ID"),
      expire: z
        .string()
        .optional()
        .describe("Expiry datetime (YYYY-MM-DD HH:MM:SS)"),
    },
  },
  createFolderPublink,
)

server.registerTool(
  "list_publinks",
  {
    description: "List all active public links",
    inputSchema: {},
  },
  listPublinks,
)

server.registerTool(
  "delete_publink",
  {
    description: "Delete a public link by its code",
    inputSchema: {
      code: z.string().describe("Public link code to delete"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the deletion"),
    },
  },
  deletePublink,
)

server.registerTool(
  "get_zip_link",
  {
    description: "Get a download URL for a ZIP archive of files and/or folders",
    inputSchema: {
      fileids: z.array(z.number()).describe("File IDs to include in the ZIP"),
      folderids: z
        .array(z.number())
        .optional()
        .describe("Folder IDs to include in the ZIP"),
      filename: z.string().optional().describe("Name for the ZIP file"),
    },
  },
  getZipLink,
)

server.registerTool(
  "list_revisions",
  {
    description: "List all revisions for a file",
    inputSchema: {
      fileid: z.number().describe("File ID"),
    },
  },
  listRevisions,
)

server.registerTool(
  "revert_revision",
  {
    description: "Revert a file to a previous revision",
    inputSchema: {
      fileid: z.number().describe("File ID to revert"),
      revisionid: z.number().describe("Revision ID to revert to"),
      confirm: z
        .boolean()
        .default(false)
        .describe("Must be true to execute the revert"),
    },
  },
  revertRevision,
)

const main = async () => {
  const auth = await resolveAuth()
  ACCESS_TOKEN = auth.token
  API_BASE = auth.apiBase

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-pcloud running")
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
