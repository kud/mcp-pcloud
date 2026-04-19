#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"
import { PCloudAPI } from "@kud/pcloud-sdk"
import { resolveAuth } from "@kud/pcloud-auth"

export const ok = (data: unknown) => ({
  content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
})

export const err = (msg: string) => ({
  content: [{ type: "text" as const, text: `Error: ${msg}` }],
})

let api: PCloudAPI

// ─── Tool handlers ───

export const listTrash = async () => {
  const res = await api.listTrash()
  if (res.result === 1000)
    return err(
      "Trash requires a session token — not supported with OAuth access tokens.",
    )
  if (res.result !== 0) return err(res.error ?? "failed to list trash")
  return ok(
    (res.contents ?? []).map((item: any) => ({
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
  const res = await api.restoreFromTrash(fileid)
  if (res.result === 1000)
    return err(
      "Trash requires a session token — not supported with OAuth access tokens.",
    )
  if (res.result !== 0) return err(res.error ?? "failed to restore from trash")
  return ok({ restored: true, fileid })
}

export const listRewindEvents = async ({ path }: { path: string }) => {
  const res = await api.listRewindFiles(path)
  if (res.result !== 0) return err(res.error ?? "failed to list rewind events")
  return ok(
    (res.contents ?? []).map((event: any) => ({
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
  const res = await api.restoreFromRewind(fileid, topath)
  if (res.result !== 0) return err(res.error ?? "failed to restore from rewind")
  return ok({ restored: true, fileid, topath })
}

export const getUserInfo = async () => {
  const res = await api.userInfo()
  if (res.result !== 0) return err(res.error ?? "failed to get user info")
  return ok({
    email: res.email,
    quota: res.quota,
    usedquota: res.usedquota,
    plan: res.plan,
  })
}

export const listFolder = async ({
  path,
  folderid,
  recursive,
}: {
  path?: string
  folderid?: number
  recursive?: boolean
}) => {
  const res = await api.request<{
    result: number
    error?: string
    metadata: unknown
  }>("listfolder", {
    ...(path !== undefined && { path }),
    ...(folderid !== undefined && { folderid }),
    ...(recursive !== undefined && { recursive: recursive ? 1 : 0 }),
  })
  if (res.result !== 0) return err(res.error ?? "failed to list folder")
  return ok(res.metadata)
}

export const getFileStat = async ({
  path,
  fileid,
}: {
  path?: string
  fileid?: number
}) => {
  const res = await api.request<{
    result: number
    error?: string
    metadata: unknown
  }>("stat", {
    ...(path !== undefined && { path }),
    ...(fileid !== undefined && { fileid }),
  })
  if (res.result !== 0) return err(res.error ?? "failed to get file stat")
  return ok(res.metadata)
}

export const createFolder = async ({ path }: { path: string }) => {
  const res = await api.createFolder(path)
  if (res.result !== 0) return err(res.error ?? "failed to create folder")
  return ok(res.metadata)
}

export const copyFile = async ({
  fileid,
  topath,
}: {
  fileid: number
  topath: string
}) => {
  const res = await api.copyFile(fileid, topath)
  if (res.result !== 0) return err(res.error ?? "failed to copy file")
  return ok(res.metadata)
}

export const moveFile = async ({
  fileid,
  topath,
}: {
  fileid: number
  topath: string
}) => {
  const res = await api.moveFile(fileid, topath)
  if (res.result !== 0) return err(res.error ?? "failed to move file")
  return ok(res.metadata)
}

export const renameFile = async ({
  fileid,
  toname,
}: {
  fileid: number
  toname: string
}) => {
  const res = await api.renameFile(fileid, toname)
  if (res.result !== 0) return err(res.error ?? "failed to rename file")
  return ok(res.metadata)
}

export const deleteFile = async ({
  fileid,
  confirm,
}: {
  fileid: number
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete a file")
  const res = await api.deleteFile(fileid)
  if (res.result !== 0) return err(res.error ?? "failed to delete file")
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
  const res = await api.deleteFolder(folderid)
  if (res.result !== 0) return err(res.error ?? "failed to delete folder")
  return ok({ deleted: true, folderid })
}

export const getFileLink = async ({
  fileid,
  forcedownload,
}: {
  fileid: number
  forcedownload?: boolean
}) => {
  const res = await api.request<{
    result: number
    error?: string
    hosts: string[]
    path: string
  }>("getfilelink", {
    fileid,
    ...(forcedownload !== undefined && {
      forcedownload: forcedownload ? 1 : 0,
    }),
  })
  if (res.result !== 0) return err(res.error ?? "failed to get file link")
  return ok({ url: `https://${res.hosts[0]}${res.path}` })
}

export const getChecksum = async ({ fileid }: { fileid: number }) => {
  const res = await api.checksumFile(fileid)
  if (res.result !== 0) return err(res.error ?? "failed to get checksum")
  return ok({ sha256: res.sha256, sha1: res.sha1, md5: res.md5 })
}

export const listShares = async () => {
  const res = await api.listShares()
  if (res.result !== 0) return err(res.error ?? "failed to list shares")
  return ok(res.shares)
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
  const res = await api.shareFolder(folderid, mail, permissions)
  if (res.result !== 0) return err(res.error ?? "failed to share folder")
  return ok({ shared: true, folderid, mail, permissions })
}

export const acceptShare = async ({
  sharerequestid,
}: {
  sharerequestid: number
}) => {
  const res = await api.acceptShare(sharerequestid)
  if (res.result !== 0) return err(res.error ?? "failed to accept share")
  return ok({ accepted: true, sharerequestid })
}

export const declineShare = async ({
  sharerequestid,
}: {
  sharerequestid: number
}) => {
  const res = await api.declineShare(sharerequestid)
  if (res.result !== 0) return err(res.error ?? "failed to decline share")
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
  const res = await api.removeShare(sharerequestid)
  if (res.result !== 0) return err(res.error ?? "failed to remove share")
  return ok({ removed: true, sharerequestid })
}

export const createFilePublink = async ({
  fileid,
  expire,
  maxdownloads,
}: {
  fileid: number
  expire?: string
  maxdownloads?: number
}) => {
  const res = await api.getFilePublink(fileid, expire, maxdownloads)
  if (res.result !== 0)
    return err(res.error ?? "failed to create file public link")
  return ok({ link: res.link, code: res.code })
}

export const createFolderPublink = async ({
  folderid,
  expire,
}: {
  folderid: number
  expire?: string
}) => {
  const res = await api.getFolderPublink(folderid, expire)
  if (res.result !== 0)
    return err(res.error ?? "failed to create folder public link")
  return ok({ link: res.link, code: res.code })
}

export const listPublinks = async () => {
  const res = await api.listPublinks()
  if (res.result !== 0) return err(res.error ?? "failed to list public links")
  return ok(res.publinks)
}

export const deletePublink = async ({
  code,
  confirm,
}: {
  code: string
  confirm: boolean
}) => {
  if (!confirm) return err("set confirm=true to delete a public link")
  const res = await api.deletePublink(code)
  if (res.result !== 0) return err(res.error ?? "failed to delete public link")
  return ok({ deleted: true, code })
}

export const getZipLink = async ({
  fileids,
  folderids,
  filename,
}: {
  fileids: number[]
  folderids?: number[]
  filename?: string
}) => {
  const res = await api.getZipLink(fileids, folderids, filename)
  if (res.result !== 0) return err(res.error ?? "failed to get zip link")
  return ok({ url: `https://${res.hosts[0]}${res.path}` })
}

export const listRevisions = async ({ fileid }: { fileid: number }) => {
  const res = await api.listRevisions(fileid)
  if (res.result !== 0) return err(res.error ?? "failed to list revisions")
  return ok(res.revisions)
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
  const res = await api.revertRevision(fileid, revisionid)
  if (res.result !== 0) return err(res.error ?? "failed to revert revision")
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
  api = await resolveAuth({
    tokenEnvVar: "MCP_PCLOUD_TOKEN",
    clientIdEnvVar: "MCP_PCLOUD_CLIENT_ID",
    clientSecretEnvVar: "MCP_PCLOUD_CLIENT_SECRET",
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error("mcp-pcloud running")
}

main().catch((e) => {
  console.error("Fatal:", e)
  process.exit(1)
})
