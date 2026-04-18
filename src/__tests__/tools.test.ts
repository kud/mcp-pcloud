import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.hoisted(() => {
  process.env.MCP_PCLOUD_TOKEN = "test-token"
})

import {
  listTrash,
  restoreFromTrash,
  listRewindEvents,
  restoreFromRewind,
  getUserInfo,
  listFolder,
  getFileStat,
  createFolder,
  copyFile,
  moveFile,
  renameFile,
  deleteFile,
  deleteFolder,
  getFileLink,
  getChecksum,
  listShares,
  shareFolder,
  acceptShare,
  declineShare,
  removeShare,
  createFilePublink,
  createFolderPublink,
  listPublinks,
  deletePublink,
  getZipLink,
  listRevisions,
  revertRevision,
  ok,
  err,
} from "../index.js"

const mockFetch = vi.fn()

beforeAll(() => {
  vi.stubGlobal("fetch", mockFetch)
})

beforeEach(() => {
  mockFetch.mockReset()
})

const res = (data: unknown) =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(data),
  } as Response)

const failRes = () =>
  Promise.resolve({
    ok: false,
    status: 500,
    json: () => Promise.resolve({}),
  } as Response)

const text = (result: { content: Array<{ text: string }> }) =>
  result.content[0].text

describe("ok / err helpers", () => {
  it("ok serialises data as JSON", () => {
    expect(text(ok({ id: 1 }))).toBe(JSON.stringify({ id: 1 }, null, 2))
  })

  it("err prefixes message", () => {
    expect(text(err("oops"))).toBe("Error: oops")
  })
})

describe("listTrash", () => {
  it("returns formatted trash items on success", async () => {
    mockFetch.mockReturnValue(
      res({
        result: 0,
        items: [
          {
            fileid: 42,
            name: "old.txt",
            path: "/old.txt",
            deletetime: 1700000000,
            size: 1024,
          },
        ],
      }),
    )
    const result = await listTrash()
    const parsed = JSON.parse(text(result))
    expect(parsed[0].fileid).toBe(42)
    expect(parsed[0].name).toBe("old.txt")
    expect(parsed[0].sizeBytes).toBe(1024)
    expect(mockFetch.mock.calls[0][0]).toContain("/listtrash")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await listTrash()
    expect(text(result)).toContain("Error:")
  })

  it("returns error on pCloud API error", async () => {
    mockFetch.mockReturnValue(res({ result: 2000, error: "Log in required." }))
    const result = await listTrash()
    expect(text(result)).toContain("Error:")
  })
})

describe("restoreFromTrash", () => {
  it("requires confirm=true", async () => {
    const result = await restoreFromTrash({ fileid: 42, confirm: false })
    expect(text(result)).toContain("Error:")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("restores file when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await restoreFromTrash({ fileid: 42, confirm: true })
    const parsed = JSON.parse(text(result))
    expect(parsed.restored).toBe(true)
    expect(parsed.fileid).toBe(42)
    expect(mockFetch.mock.calls[0][0]).toContain("/trash_restore")
    expect(mockFetch.mock.calls[0][0]).toContain("fileid=42")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await restoreFromTrash({ fileid: 42, confirm: true })
    expect(text(result)).toContain("Error:")
  })
})

describe("listRewindEvents", () => {
  it("returns formatted rewind events on success", async () => {
    mockFetch.mockReturnValue(
      res({
        result: 0,
        events: [{ fileid: 99, name: "doc.txt", time: 1700000000 }],
      }),
    )
    const result = await listRewindEvents({ path: "/doc.txt" })
    const parsed = JSON.parse(text(result))
    expect(parsed[0].fileid).toBe(99)
    expect(parsed[0].name).toBe("doc.txt")
    expect(mockFetch.mock.calls[0][0]).toContain("/listrewindevents")
    expect(mockFetch.mock.calls[0][0]).toContain("path=")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await listRewindEvents({ path: "/doc.txt" })
    expect(text(result)).toContain("Error:")
  })
})

describe("restoreFromRewind", () => {
  it("requires confirm=true", async () => {
    const result = await restoreFromRewind({
      fileid: 99,
      topath: "/recovered.txt",
      confirm: false,
    })
    expect(text(result)).toContain("Error:")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("restores file when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await restoreFromRewind({
      fileid: 99,
      topath: "/recovered.txt",
      confirm: true,
    })
    const parsed = JSON.parse(text(result))
    expect(parsed.restored).toBe(true)
    expect(parsed.topath).toBe("/recovered.txt")
    expect(mockFetch.mock.calls[0][0]).toContain("/file_restore")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await restoreFromRewind({
      fileid: 99,
      topath: "/recovered.txt",
      confirm: true,
    })
    expect(text(result)).toContain("Error:")
  })
})

describe("getUserInfo", () => {
  it("returns user info on success", async () => {
    mockFetch.mockReturnValue(
      res({
        result: 0,
        email: "user@example.com",
        quota: 10737418240,
        usedquota: 1073741824,
        plan: 0,
      }),
    )
    const result = await getUserInfo()
    const parsed = JSON.parse(text(result))
    expect(parsed.email).toBe("user@example.com")
    expect(parsed.quota).toBe(10737418240)
    expect(parsed.plan).toBe(0)
    expect(mockFetch.mock.calls[0][0]).toContain("/userinfo")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getUserInfo()
    expect(text(result)).toContain("Error:")
  })
})

describe("listFolder", () => {
  it("returns folder metadata on success", async () => {
    const metadata = { name: "root", contents: [] }
    mockFetch.mockReturnValue(res({ result: 0, metadata }))
    const result = await listFolder({ path: "/" })
    const parsed = JSON.parse(text(result))
    expect(parsed.name).toBe("root")
    expect(mockFetch.mock.calls[0][0]).toContain("/listfolder")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await listFolder({ path: "/" })
    expect(text(result)).toContain("Error:")
  })
})

describe("getFileStat", () => {
  it("returns file metadata on success", async () => {
    const metadata = { fileid: 123, name: "file.txt", size: 512 }
    mockFetch.mockReturnValue(res({ result: 0, metadata }))
    const result = await getFileStat({ fileid: 123 })
    const parsed = JSON.parse(text(result))
    expect(parsed.fileid).toBe(123)
    expect(mockFetch.mock.calls[0][0]).toContain("/stat")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getFileStat({ fileid: 123 })
    expect(text(result)).toContain("Error:")
  })
})

describe("createFolder", () => {
  it("returns folder metadata on success", async () => {
    const metadata = { folderid: 55, name: "newfolder" }
    mockFetch.mockReturnValue(res({ result: 0, metadata }))
    const result = await createFolder({ path: "/newfolder" })
    const parsed = JSON.parse(text(result))
    expect(parsed.folderid).toBe(55)
    expect(mockFetch.mock.calls[0][0]).toContain("/createfolderifnotexists")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await createFolder({ path: "/newfolder" })
    expect(text(result)).toContain("Error:")
  })
})

describe("copyFile", () => {
  it("returns metadata on success", async () => {
    const metadata = { fileid: 200, name: "copy.txt" }
    mockFetch.mockReturnValue(res({ result: 0, metadata }))
    const result = await copyFile({ fileid: 100, topath: "/copy.txt" })
    const parsed = JSON.parse(text(result))
    expect(parsed.fileid).toBe(200)
    expect(mockFetch.mock.calls[0][0]).toContain("/copyfile")
    expect(mockFetch.mock.calls[0][0]).toContain("fileid=100")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await copyFile({ fileid: 100, topath: "/copy.txt" })
    expect(text(result)).toContain("Error:")
  })
})

describe("moveFile", () => {
  it("returns metadata on success", async () => {
    const metadata = { fileid: 100, name: "moved.txt" }
    mockFetch.mockReturnValue(res({ result: 0, metadata }))
    const result = await moveFile({ fileid: 100, topath: "/moved.txt" })
    const parsed = JSON.parse(text(result))
    expect(parsed.fileid).toBe(100)
    expect(mockFetch.mock.calls[0][0]).toContain("/renamefile")
    expect(mockFetch.mock.calls[0][0]).toContain("topath=")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await moveFile({ fileid: 100, topath: "/moved.txt" })
    expect(text(result)).toContain("Error:")
  })
})

describe("renameFile", () => {
  it("returns metadata on success", async () => {
    const metadata = { fileid: 100, name: "renamed.txt" }
    mockFetch.mockReturnValue(res({ result: 0, metadata }))
    const result = await renameFile({ fileid: 100, toname: "renamed.txt" })
    const parsed = JSON.parse(text(result))
    expect(parsed.fileid).toBe(100)
    expect(mockFetch.mock.calls[0][0]).toContain("/renamefile")
    expect(mockFetch.mock.calls[0][0]).toContain("toname=")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await renameFile({ fileid: 100, toname: "renamed.txt" })
    expect(text(result)).toContain("Error:")
  })
})

describe("deleteFile", () => {
  it("requires confirm=true", async () => {
    const result = await deleteFile({ fileid: 100, confirm: false })
    expect(text(result)).toContain("Error:")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("deletes file when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: 0, metadata: {} }))
    const result = await deleteFile({ fileid: 100, confirm: true })
    const parsed = JSON.parse(text(result))
    expect(parsed.deleted).toBe(true)
    expect(parsed.fileid).toBe(100)
    expect(mockFetch.mock.calls[0][0]).toContain("/deletefile")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await deleteFile({ fileid: 100, confirm: true })
    expect(text(result)).toContain("Error:")
  })
})

describe("deleteFolder", () => {
  it("requires confirm=true", async () => {
    const result = await deleteFolder({ folderid: 55, confirm: false })
    expect(text(result)).toContain("Error:")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("deletes folder when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await deleteFolder({ folderid: 55, confirm: true })
    const parsed = JSON.parse(text(result))
    expect(parsed.deleted).toBe(true)
    expect(parsed.folderid).toBe(55)
    expect(mockFetch.mock.calls[0][0]).toContain("/deletefolderrecursive")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await deleteFolder({ folderid: 55, confirm: true })
    expect(text(result)).toContain("Error:")
  })
})

describe("getFileLink", () => {
  it("returns download URL on success", async () => {
    mockFetch.mockReturnValue(
      res({ result: 0, hosts: ["cdn.pcloud.com"], path: "/dl/file.txt" }),
    )
    const result = await getFileLink({ fileid: 100 })
    const parsed = JSON.parse(text(result))
    expect(parsed.url).toBe("https://cdn.pcloud.com/dl/file.txt")
    expect(mockFetch.mock.calls[0][0]).toContain("/getfilelink")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getFileLink({ fileid: 100 })
    expect(text(result)).toContain("Error:")
  })
})

describe("getChecksum", () => {
  it("returns checksums on success", async () => {
    mockFetch.mockReturnValue(
      res({
        result: 0,
        sha256: "abc123",
        sha1: "def456",
        md5: "ghi789",
      }),
    )
    const result = await getChecksum({ fileid: 100 })
    const parsed = JSON.parse(text(result))
    expect(parsed.sha256).toBe("abc123")
    expect(parsed.md5).toBe("ghi789")
    expect(mockFetch.mock.calls[0][0]).toContain("/checksumfile")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getChecksum({ fileid: 100 })
    expect(text(result)).toContain("Error:")
  })
})

describe("listShares", () => {
  it("returns shares on success", async () => {
    mockFetch.mockReturnValue(
      res({ result: 0, shares: [{ shareid: 1, folderid: 55 }] }),
    )
    const result = await listShares()
    const parsed = JSON.parse(text(result))
    expect(parsed[0].shareid).toBe(1)
    expect(mockFetch.mock.calls[0][0]).toContain("/listshares")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await listShares()
    expect(text(result)).toContain("Error:")
  })
})

describe("shareFolder", () => {
  it("returns share confirmation on success", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await shareFolder({
      folderid: 55,
      mail: "friend@example.com",
      permissions: 3,
    })
    const parsed = JSON.parse(text(result))
    expect(parsed.shared).toBe(true)
    expect(parsed.mail).toBe("friend@example.com")
    expect(mockFetch.mock.calls[0][0]).toContain("/sharefolder")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await shareFolder({
      folderid: 55,
      mail: "friend@example.com",
      permissions: 3,
    })
    expect(text(result)).toContain("Error:")
  })
})

describe("acceptShare", () => {
  it("returns accepted confirmation on success", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await acceptShare({ sharerequestid: 7 })
    const parsed = JSON.parse(text(result))
    expect(parsed.accepted).toBe(true)
    expect(parsed.sharerequestid).toBe(7)
    expect(mockFetch.mock.calls[0][0]).toContain("/acceptshare")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await acceptShare({ sharerequestid: 7 })
    expect(text(result)).toContain("Error:")
  })
})

describe("declineShare", () => {
  it("returns declined confirmation on success", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await declineShare({ sharerequestid: 7 })
    const parsed = JSON.parse(text(result))
    expect(parsed.declined).toBe(true)
    expect(parsed.sharerequestid).toBe(7)
    expect(mockFetch.mock.calls[0][0]).toContain("/declineshare")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await declineShare({ sharerequestid: 7 })
    expect(text(result)).toContain("Error:")
  })
})

describe("removeShare", () => {
  it("requires confirm=true", async () => {
    const result = await removeShare({ sharerequestid: 7, confirm: false })
    expect(text(result)).toContain("Error:")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("removes share when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await removeShare({ sharerequestid: 7, confirm: true })
    const parsed = JSON.parse(text(result))
    expect(parsed.removed).toBe(true)
    expect(parsed.sharerequestid).toBe(7)
    expect(mockFetch.mock.calls[0][0]).toContain("/removeshare")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await removeShare({ sharerequestid: 7, confirm: true })
    expect(text(result)).toContain("Error:")
  })
})

describe("createFilePublink", () => {
  it("returns link and code on success", async () => {
    mockFetch.mockReturnValue(
      res({ result: 0, link: "https://my.pcloud.com/link", code: "abc123" }),
    )
    const result = await createFilePublink({ fileid: 100 })
    const parsed = JSON.parse(text(result))
    expect(parsed.link).toBe("https://my.pcloud.com/link")
    expect(parsed.code).toBe("abc123")
    expect(mockFetch.mock.calls[0][0]).toContain("/getfilepublink")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await createFilePublink({ fileid: 100 })
    expect(text(result)).toContain("Error:")
  })
})

describe("createFolderPublink", () => {
  it("returns link and code on success", async () => {
    mockFetch.mockReturnValue(
      res({ result: 0, link: "https://my.pcloud.com/flink", code: "xyz789" }),
    )
    const result = await createFolderPublink({ folderid: 55 })
    const parsed = JSON.parse(text(result))
    expect(parsed.link).toBe("https://my.pcloud.com/flink")
    expect(parsed.code).toBe("xyz789")
    expect(mockFetch.mock.calls[0][0]).toContain("/getfolderpublink")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await createFolderPublink({ folderid: 55 })
    expect(text(result)).toContain("Error:")
  })
})

describe("listPublinks", () => {
  it("returns publinks on success", async () => {
    mockFetch.mockReturnValue(
      res({ result: 0, publinks: [{ code: "abc123", link: "https://..." }] }),
    )
    const result = await listPublinks()
    const parsed = JSON.parse(text(result))
    expect(parsed[0].code).toBe("abc123")
    expect(mockFetch.mock.calls[0][0]).toContain("/listpublinks")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await listPublinks()
    expect(text(result)).toContain("Error:")
  })
})

describe("deletePublink", () => {
  it("requires confirm=true", async () => {
    const result = await deletePublink({ code: "abc123", confirm: false })
    expect(text(result)).toContain("Error:")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("deletes publink when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: 0 }))
    const result = await deletePublink({ code: "abc123", confirm: true })
    const parsed = JSON.parse(text(result))
    expect(parsed.deleted).toBe(true)
    expect(parsed.code).toBe("abc123")
    expect(mockFetch.mock.calls[0][0]).toContain("/deletepublink")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await deletePublink({ code: "abc123", confirm: true })
    expect(text(result)).toContain("Error:")
  })
})

describe("getZipLink", () => {
  it("returns ZIP download URL on success", async () => {
    mockFetch.mockReturnValue(
      res({ result: 0, hosts: ["cdn.pcloud.com"], path: "/zip/archive.zip" }),
    )
    const result = await getZipLink({ fileids: [100, 101] })
    const parsed = JSON.parse(text(result))
    expect(parsed.url).toBe("https://cdn.pcloud.com/zip/archive.zip")
    expect(mockFetch.mock.calls[0][0]).toContain("/getziplink")
    expect(mockFetch.mock.calls[0][0]).toContain("fileids=")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await getZipLink({ fileids: [100] })
    expect(text(result)).toContain("Error:")
  })
})

describe("listRevisions", () => {
  it("returns revisions on success", async () => {
    mockFetch.mockReturnValue(
      res({
        result: 0,
        revisions: [{ revisionid: 1, created: 1700000000 }],
      }),
    )
    const result = await listRevisions({ fileid: 100 })
    const parsed = JSON.parse(text(result))
    expect(parsed[0].revisionid).toBe(1)
    expect(mockFetch.mock.calls[0][0]).toContain("/listrevisions")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await listRevisions({ fileid: 100 })
    expect(text(result)).toContain("Error:")
  })
})

describe("revertRevision", () => {
  it("requires confirm=true", async () => {
    const result = await revertRevision({
      fileid: 100,
      revisionid: 1,
      confirm: false,
    })
    expect(text(result)).toContain("Error:")
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("reverts revision when confirmed", async () => {
    mockFetch.mockReturnValue(res({ result: 0, metadata: {} }))
    const result = await revertRevision({
      fileid: 100,
      revisionid: 1,
      confirm: true,
    })
    const parsed = JSON.parse(text(result))
    expect(parsed.reverted).toBe(true)
    expect(parsed.fileid).toBe(100)
    expect(parsed.revisionid).toBe(1)
    expect(mockFetch.mock.calls[0][0]).toContain("/revertrevision")
  })

  it("returns error when fetch fails", async () => {
    mockFetch.mockReturnValue(failRes())
    const result = await revertRevision({
      fileid: 100,
      revisionid: 1,
      confirm: true,
    })
    expect(text(result)).toContain("Error:")
  })
})
