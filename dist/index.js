#!/usr/bin/env node
import { readFileSync, mkdirSync, writeFileSync } from "fs";
import { createServer } from "http";
import { homedir } from "os";
import { join } from "path";
import { exec } from "child_process";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
const TOKENS_PATH = join(homedir(), ".config", "pcloud", "tokens.json");
const loadStoredTokens = () => {
    try {
        return JSON.parse(readFileSync(TOKENS_PATH, "utf8"));
    }
    catch {
        return null;
    }
};
const saveTokens = (tokens) => {
    mkdirSync(join(homedir(), ".config", "pcloud"), { recursive: true });
    writeFileSync(TOKENS_PATH, JSON.stringify(tokens, null, 2));
};
const openBrowser = (url) => {
    const cmd = process.platform === "darwin"
        ? "open"
        : process.platform === "win32"
            ? "start"
            : "xdg-open";
    exec(`${cmd} "${url}"`);
};
const runOAuthFlow = (clientId, clientSecret) => new Promise((resolve, reject) => {
    const httpServer = createServer(async (req, res) => {
        const url = new URL(req.url, "http://localhost");
        const code = url.searchParams.get("code");
        if (!code) {
            res.writeHead(400);
            res.end("Missing code parameter");
            return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<html><body><h2>✅ Authenticated with pCloud! You can close this tab.</h2></body></html>");
        httpServer.close();
        try {
            const tokenUrl = new URL("https://api.pcloud.com/oauth2_token");
            tokenUrl.searchParams.set("client_id", clientId);
            tokenUrl.searchParams.set("client_secret", clientSecret);
            tokenUrl.searchParams.set("code", code);
            const response = await fetch(tokenUrl.toString());
            const data = (await response.json());
            if (!data.access_token) {
                reject(new Error(data.error ?? "Token exchange failed"));
                return;
            }
            resolve({ access_token: data.access_token, hostname: data.hostname });
        }
        catch (e) {
            reject(e);
        }
    });
    httpServer.listen(0, "localhost", () => {
        const port = httpServer.address().port;
        const authUrl = new URL("https://my.pcloud.com/oauth2/authorize");
        authUrl.searchParams.set("client_id", clientId);
        authUrl.searchParams.set("redirect_uri", `http://localhost:${port}/callback`);
        authUrl.searchParams.set("response_type", "code");
        console.error("Opening browser for pCloud authentication…");
        console.error(`If the browser does not open, visit:\n${authUrl.toString()}`);
        openBrowser(authUrl.toString());
    });
});
const resolveAuth = async () => {
    if (process.env["MCP_PCLOUD_TOKEN"]) {
        return {
            token: process.env["MCP_PCLOUD_TOKEN"],
            apiBase: "https://api.pcloud.com",
        };
    }
    const stored = loadStoredTokens();
    if (stored?.access_token) {
        return {
            token: stored.access_token,
            apiBase: `https://${stored.hostname ?? "api.pcloud.com"}`,
        };
    }
    const clientId = process.env["MCP_PCLOUD_CLIENT_ID"];
    const clientSecret = process.env["MCP_PCLOUD_CLIENT_SECRET"];
    if (clientId && clientSecret) {
        const tokens = await runOAuthFlow(clientId, clientSecret);
        saveTokens(tokens);
        return {
            token: tokens.access_token,
            apiBase: `https://${tokens.hostname ?? "api.pcloud.com"}`,
        };
    }
    console.error("No pCloud token found. Set MCP_PCLOUD_TOKEN, or MCP_PCLOUD_CLIENT_ID + MCP_PCLOUD_CLIENT_SECRET, or create ~/.config/pcloud/tokens.json.");
    process.exit(1);
};
let ACCESS_TOKEN;
let API_BASE;
export const apiFetch = async (path, params = {}) => {
    const url = new URL(`${API_BASE}${path}`);
    url.searchParams.set("access_token", ACCESS_TOKEN);
    for (const [k, v] of Object.entries(params))
        url.searchParams.set(k, v);
    try {
        const response = await fetch(url.toString());
        if (!response.ok) {
            console.error(`API error: ${response.status} ${path}`);
            return null;
        }
        const data = (await response.json());
        if (data.result !== 0) {
            console.error(`pCloud error on ${path}: ${data.error ?? "unknown"}`);
            return null;
        }
        return data;
    }
    catch (e) {
        console.error(`Fetch failed: ${path}`, e);
        return null;
    }
};
export const ok = (data) => ({
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
});
export const err = (msg) => ({
    content: [{ type: "text", text: `Error: ${msg}` }],
});
export const listTrash = async () => {
    const data = await apiFetch("/listtrash");
    if (!data)
        return err("failed to list trash");
    return ok(data.items.map((item) => ({
        fileid: item.fileid,
        name: item.name,
        path: item.path,
        deletedAt: new Date(item.deletetime * 1000).toISOString(),
        sizeBytes: item.size,
    })));
};
export const restoreFromTrash = async ({ fileid, confirm, }) => {
    if (!confirm)
        return err("set confirm=true to restore a file from trash");
    const data = await apiFetch("/trash_restore", {
        fileid: String(fileid),
    });
    return data
        ? ok({ restored: true, fileid })
        : err("failed to restore from trash");
};
export const listRewindEvents = async ({ path }) => {
    const data = await apiFetch("/listrewindevents", { path });
    if (!data)
        return err("failed to list rewind events");
    return ok(data.events.map((event) => ({
        fileid: event.fileid,
        name: event.name,
        time: new Date(event.time * 1000).toISOString(),
    })));
};
export const restoreFromRewind = async ({ fileid, topath, confirm, }) => {
    if (!confirm)
        return err("set confirm=true to restore a file from rewind history");
    const data = await apiFetch("/file_restore", {
        fileid: String(fileid),
        topath,
    });
    return data
        ? ok({ restored: true, fileid, topath })
        : err("failed to restore from rewind");
};
export const getUserInfo = async () => {
    const data = await apiFetch("/userinfo");
    if (!data)
        return err("failed to get user info");
    return ok({
        email: data.email,
        quota: data.quota,
        usedquota: data.usedquota,
        plan: data.plan,
    });
};
// ─── Files ───
export const listFolder = async ({ path, folderid, recursive, }) => {
    const params = {};
    if (path !== undefined)
        params.path = path;
    if (folderid !== undefined)
        params.folderid = String(folderid);
    if (recursive !== undefined)
        params.recursive = recursive ? "1" : "0";
    const data = await apiFetch("/listfolder", params);
    if (!data)
        return err("failed to list folder");
    return ok(data.metadata);
};
export const getFileStat = async ({ path, fileid, }) => {
    const params = {};
    if (path !== undefined)
        params.path = path;
    if (fileid !== undefined)
        params.fileid = String(fileid);
    const data = await apiFetch("/stat", params);
    if (!data)
        return err("failed to get file stat");
    return ok(data.metadata);
};
export const createFolder = async ({ path }) => {
    const data = await apiFetch("/createfolderifnotexists", { path });
    if (!data)
        return err("failed to create folder");
    return ok(data.metadata);
};
export const copyFile = async ({ fileid, topath, }) => {
    const data = await apiFetch("/copyfile", { fileid: String(fileid), topath });
    if (!data)
        return err("failed to copy file");
    return ok(data.metadata);
};
export const moveFile = async ({ fileid, topath, }) => {
    const data = await apiFetch("/renamefile", { fileid: String(fileid), topath });
    if (!data)
        return err("failed to move file");
    return ok(data.metadata);
};
export const renameFile = async ({ fileid, toname, }) => {
    const data = await apiFetch("/renamefile", { fileid: String(fileid), toname });
    if (!data)
        return err("failed to rename file");
    return ok(data.metadata);
};
export const deleteFile = async ({ fileid, confirm, }) => {
    if (!confirm)
        return err("set confirm=true to delete a file");
    const data = await apiFetch("/deletefile", { fileid: String(fileid) });
    if (!data)
        return err("failed to delete file");
    return ok({ deleted: true, fileid });
};
export const deleteFolder = async ({ folderid, confirm, }) => {
    if (!confirm)
        return err("set confirm=true to delete a folder");
    const data = await apiFetch("/deletefolderrecursive", {
        folderid: String(folderid),
    });
    if (!data)
        return err("failed to delete folder");
    return ok({ deleted: true, folderid });
};
export const getFileLink = async ({ fileid, forcedownload, }) => {
    const params = { fileid: String(fileid) };
    if (forcedownload !== undefined)
        params.forcedownload = forcedownload ? "1" : "0";
    const data = await apiFetch("/getfilelink", params);
    if (!data)
        return err("failed to get file link");
    return ok({ url: `https://${data.hosts[0]}${data.path}` });
};
export const getChecksum = async ({ fileid }) => {
    const data = await apiFetch("/checksumfile", { fileid: String(fileid) });
    if (!data)
        return err("failed to get checksum");
    return ok({ sha256: data.sha256, sha1: data.sha1, md5: data.md5 });
};
// ─── Sharing ───
export const listShares = async () => {
    const data = await apiFetch("/listshares");
    if (!data)
        return err("failed to list shares");
    return ok(data.shares);
};
export const shareFolder = async ({ folderid, mail, permissions, }) => {
    const data = await apiFetch("/sharefolder", {
        folderid: String(folderid),
        mail,
        permissions: String(permissions),
    });
    if (!data)
        return err("failed to share folder");
    return ok({ shared: true, folderid, mail, permissions });
};
export const acceptShare = async ({ sharerequestid, }) => {
    const data = await apiFetch("/acceptshare", {
        sharerequestid: String(sharerequestid),
    });
    if (!data)
        return err("failed to accept share");
    return ok({ accepted: true, sharerequestid });
};
export const declineShare = async ({ sharerequestid, }) => {
    const data = await apiFetch("/declineshare", {
        sharerequestid: String(sharerequestid),
    });
    if (!data)
        return err("failed to decline share");
    return ok({ declined: true, sharerequestid });
};
export const removeShare = async ({ sharerequestid, confirm, }) => {
    if (!confirm)
        return err("set confirm=true to remove a share");
    const data = await apiFetch("/removeshare", {
        sharerequestid: String(sharerequestid),
    });
    if (!data)
        return err("failed to remove share");
    return ok({ removed: true, sharerequestid });
};
// ─── Public links ───
export const createFilePublink = async ({ fileid, expire, maxdownloads, }) => {
    const params = { fileid: String(fileid) };
    if (expire !== undefined)
        params.expire = expire;
    if (maxdownloads !== undefined)
        params.maxdownloads = String(maxdownloads);
    const data = await apiFetch("/getfilepublink", params);
    if (!data)
        return err("failed to create file public link");
    return ok({ link: data.link, code: data.code });
};
export const createFolderPublink = async ({ folderid, expire, }) => {
    const params = { folderid: String(folderid) };
    if (expire !== undefined)
        params.expire = expire;
    const data = await apiFetch("/getfolderpublink", params);
    if (!data)
        return err("failed to create folder public link");
    return ok({ link: data.link, code: data.code });
};
export const listPublinks = async () => {
    const data = await apiFetch("/listpublinks");
    if (!data)
        return err("failed to list public links");
    return ok(data.publinks);
};
export const deletePublink = async ({ code, confirm, }) => {
    if (!confirm)
        return err("set confirm=true to delete a public link");
    const data = await apiFetch("/deletepublink", { code });
    if (!data)
        return err("failed to delete public link");
    return ok({ deleted: true, code });
};
// ─── Zip ───
export const getZipLink = async ({ fileids, folderids, filename, }) => {
    const params = {
        fileids: fileids.join(","),
    };
    if (folderids !== undefined)
        params.folderids = folderids.join(",");
    if (filename !== undefined)
        params.filename = filename;
    const data = await apiFetch("/getziplink", params);
    if (!data)
        return err("failed to get zip link");
    return ok({ url: `https://${data.hosts[0]}${data.path}` });
};
// ─── Revisions ───
export const listRevisions = async ({ fileid }) => {
    const data = await apiFetch("/listrevisions", { fileid: String(fileid) });
    if (!data)
        return err("failed to list revisions");
    return ok(data.revisions);
};
export const revertRevision = async ({ fileid, revisionid, confirm, }) => {
    if (!confirm)
        return err("set confirm=true to revert a revision");
    const data = await apiFetch("/revertrevision", { fileid: String(fileid), revisionid: String(revisionid) });
    if (!data)
        return err("failed to revert revision");
    return ok({ reverted: true, fileid, revisionid });
};
// ─── Server ───
const server = new McpServer({ name: "mcp-pcloud", version: "1.0.0" });
server.registerTool("list_trash", {
    description: "List all files currently in the pCloud trash",
    inputSchema: {},
}, listTrash);
server.registerTool("restore_from_trash", {
    description: "Restore a file from the pCloud trash by its file ID",
    inputSchema: {
        fileid: z.number().describe("File ID to restore from trash"),
        confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to execute the restore"),
    },
}, restoreFromTrash);
server.registerTool("list_rewind_events", {
    description: "List version history (rewind events) for a file path",
    inputSchema: {
        path: z.string().describe("pCloud file path to list rewind events for"),
    },
}, listRewindEvents);
server.registerTool("restore_from_rewind", {
    description: "Restore a file from its rewind history to a new path",
    inputSchema: {
        fileid: z.number().describe("File ID from rewind history to restore"),
        topath: z.string().describe("Destination path for the restored file"),
        confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to execute the restore"),
    },
}, restoreFromRewind);
server.registerTool("get_user_info", {
    description: "Get pCloud account info: quota, email, and plan",
    inputSchema: {},
}, getUserInfo);
server.registerTool("list_folder", {
    description: "List the contents of a pCloud folder",
    inputSchema: {
        path: z.string().optional().describe("Folder path"),
        folderid: z.number().optional().describe("Folder ID"),
        recursive: z
            .boolean()
            .optional()
            .describe("Recursively list all contents"),
    },
}, listFolder);
server.registerTool("get_file_stat", {
    description: "Get metadata for a file or folder",
    inputSchema: {
        path: z.string().optional().describe("File or folder path"),
        fileid: z.number().optional().describe("File ID"),
    },
}, getFileStat);
server.registerTool("create_folder", {
    description: "Create a folder (no-op if it already exists)",
    inputSchema: {
        path: z.string().describe("Path of the folder to create"),
    },
}, createFolder);
server.registerTool("copy_file", {
    description: "Copy a file to a new path",
    inputSchema: {
        fileid: z.number().describe("File ID to copy"),
        topath: z.string().describe("Destination path"),
    },
}, copyFile);
server.registerTool("move_file", {
    description: "Move a file to a new path",
    inputSchema: {
        fileid: z.number().describe("File ID to move"),
        topath: z.string().describe("Destination path"),
    },
}, moveFile);
server.registerTool("rename_file", {
    description: "Rename a file",
    inputSchema: {
        fileid: z.number().describe("File ID to rename"),
        toname: z.string().describe("New file name"),
    },
}, renameFile);
server.registerTool("delete_file", {
    description: "Permanently delete a file",
    inputSchema: {
        fileid: z.number().describe("File ID to delete"),
        confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to execute the deletion"),
    },
}, deleteFile);
server.registerTool("delete_folder", {
    description: "Recursively delete a folder and all its contents",
    inputSchema: {
        folderid: z.number().describe("Folder ID to delete"),
        confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to execute the deletion"),
    },
}, deleteFolder);
server.registerTool("get_file_link", {
    description: "Get a download URL for a file",
    inputSchema: {
        fileid: z.number().describe("File ID"),
        forcedownload: z
            .boolean()
            .optional()
            .describe("Force a download prompt in browsers"),
    },
}, getFileLink);
server.registerTool("get_checksum", {
    description: "Get SHA256, SHA1, and MD5 checksums for a file",
    inputSchema: {
        fileid: z.number().describe("File ID"),
    },
}, getChecksum);
server.registerTool("list_shares", {
    description: "List all active folder shares",
    inputSchema: {},
}, listShares);
server.registerTool("share_folder", {
    description: "Share a folder with another pCloud user (permissions: 1=Create, 2=Modify, 4=Delete, combine with bitwise OR)",
    inputSchema: {
        folderid: z.number().describe("Folder ID to share"),
        mail: z.string().describe("Email address of the recipient"),
        permissions: z
            .number()
            .describe("Permission bitmask: 1=Create, 2=Modify, 4=Delete"),
    },
}, shareFolder);
server.registerTool("accept_share", {
    description: "Accept an incoming share request",
    inputSchema: {
        sharerequestid: z.number().describe("Share request ID to accept"),
    },
}, acceptShare);
server.registerTool("decline_share", {
    description: "Decline an incoming share request",
    inputSchema: {
        sharerequestid: z.number().describe("Share request ID to decline"),
    },
}, declineShare);
server.registerTool("remove_share", {
    description: "Remove an active share",
    inputSchema: {
        sharerequestid: z.number().describe("Share request ID to remove"),
        confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to execute the removal"),
    },
}, removeShare);
server.registerTool("create_file_publink", {
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
}, createFilePublink);
server.registerTool("create_folder_publink", {
    description: "Create a public link for a folder",
    inputSchema: {
        folderid: z.number().describe("Folder ID"),
        expire: z
            .string()
            .optional()
            .describe("Expiry datetime (YYYY-MM-DD HH:MM:SS)"),
    },
}, createFolderPublink);
server.registerTool("list_publinks", {
    description: "List all active public links",
    inputSchema: {},
}, listPublinks);
server.registerTool("delete_publink", {
    description: "Delete a public link by its code",
    inputSchema: {
        code: z.string().describe("Public link code to delete"),
        confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to execute the deletion"),
    },
}, deletePublink);
server.registerTool("get_zip_link", {
    description: "Get a download URL for a ZIP archive of files and/or folders",
    inputSchema: {
        fileids: z.array(z.number()).describe("File IDs to include in the ZIP"),
        folderids: z
            .array(z.number())
            .optional()
            .describe("Folder IDs to include in the ZIP"),
        filename: z.string().optional().describe("Name for the ZIP file"),
    },
}, getZipLink);
server.registerTool("list_revisions", {
    description: "List all revisions for a file",
    inputSchema: {
        fileid: z.number().describe("File ID"),
    },
}, listRevisions);
server.registerTool("revert_revision", {
    description: "Revert a file to a previous revision",
    inputSchema: {
        fileid: z.number().describe("File ID to revert"),
        revisionid: z.number().describe("Revision ID to revert to"),
        confirm: z
            .boolean()
            .default(false)
            .describe("Must be true to execute the revert"),
    },
}, revertRevision);
const main = async () => {
    const auth = await resolveAuth();
    ACCESS_TOKEN = auth.token;
    API_BASE = auth.apiBase;
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("mcp-pcloud running");
};
main().catch((e) => {
    console.error("Fatal:", e);
    process.exit(1);
});
//# sourceMappingURL=index.js.map