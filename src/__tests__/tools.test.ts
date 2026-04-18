import { describe, it, expect, vi, beforeAll, beforeEach } from "vitest"

vi.hoisted(() => {
  process.env.MCP_PCLOUD_TOKEN = "test-token"
})

import {
  listTrash,
  restoreFromTrash,
  listRewindEvents,
  restoreFromRewind,
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
