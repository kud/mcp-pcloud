#!/usr/bin/env node
import { readFileSync } from "fs"
import { homedir } from "os"
import { join } from "path"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

interface StoredTokens {
  access_token: string
  hostname?: string
}

const loadStoredTokens = (): StoredTokens | null => {
  try {
    return JSON.parse(
      readFileSync(join(homedir(), ".config", "pcloud", "tokens.json"), "utf8"),
    ) as StoredTokens
  } catch {
    return null
  }
}

const stored = loadStoredTokens()
const ACCESS_TOKEN = process.env["MCP_PCLOUD_TOKEN"] ?? stored?.access_token

if (!ACCESS_TOKEN) {
  console.error(
    "No pCloud token found. Set MCP_PCLOUD_TOKEN or create ~/.config/pcloud/tokens.json.",
  )
  process.exit(1)
}

const API_BASE = `https://${stored?.hostname ?? "api.pcloud.com"}`

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

const main = async () => {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-pcloud running")
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
