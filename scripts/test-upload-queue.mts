import assert from "node:assert/strict";
import test from "node:test";
import { pendingUploads, uploadFilesSequentially, type UploadItem } from "../src/lib/upload-queue.ts";

function item(name: string, start = "2026-10-01", end = start): UploadItem {
  return { id: name, file: new File(["report"], name), period: { start, end }, status: "ready" };
}

test("uploads in order with each file's period, continues on failure, and retries only failed files", async () => {
  let items = [item("1001.csv"), item("1002~1003.xlsx", "2026-10-02", "2026-10-03"), item("1004.csv", "2026-10-04")];
  const requests: string[] = [];
  let active = 0;
  let maxActive = 0;
  let fail = true;
  const send: typeof fetch = async (_url, init) => {
    active++;
    maxActive = Math.max(maxActive, active);
    const form = init!.body as FormData;
    const file = form.get("file") as File;
    const expected = items.find((entry) => entry.file.name === file.name)!;
    assert.equal(form.get("periodStart"), expected.period!.start);
    assert.equal(form.get("periodEnd"), expected.period!.end);
    requests.push(file.name);
    await new Promise((resolve) => setTimeout(resolve, 5));
    active--;
    return fail && file.name === "1002~1003.xlsx"
      ? Response.json({ error: "파싱 실패" }, { status: 422 })
      : Response.json({ ok: true, inserted: 2 });
  };
  const update = (id: string, value: Pick<UploadItem, "status" | "result">) => {
    items = items.map((entry) => entry.id === id ? { ...entry, ...value } : entry);
  };
  await uploadFilesSequentially(items, update, send);
  assert.equal(maxActive, 1);
  assert.deepEqual(requests, ["1001.csv", "1002~1003.xlsx", "1004.csv"]);
  assert.deepEqual(items.map((entry) => entry.status), ["success", "error", "success"]);
  assert.equal(items[1].result?.error, "파싱 실패");
  fail = false;
  await uploadFilesSequentially(items, update, send);
  assert.deepEqual(requests, ["1001.csv", "1002~1003.xlsx", "1004.csv", "1002~1003.xlsx"]);
  assert.ok(items.every((entry) => entry.status === "success"));
});

test("invalid, completed, and already uploading files never enter the queue", async () => {
  const items = [
    { ...item("report.csv"), period: null },
    { ...item("1001.txt"), validationError: "지원하지 않는 형식" },
    { ...item("1002.csv"), status: "success" as const },
    { ...item("1003.csv"), status: "uploading" as const },
  ];
  assert.equal(pendingUploads(items).length, 0);
  await uploadFilesSequentially(items, () => assert.fail("unexpected update"), async () => assert.fail("unexpected request"));
});

test("network errors, non-JSON responses, and HTTP errors do not stop later uploads", async () => {
  const items = [item("1001.csv"), item("1002.csv"), item("1003.csv"), item("1004.csv")];
  const completed: Pick<UploadItem, "status" | "result">[] = [];
  let request = 0;
  await uploadFilesSequentially(items, (_id, value) => { if (value.result) completed.push(value); }, async () => {
    request++;
    if (request === 1) throw new TypeError("Network failed");
    if (request === 2) return new Response("Bad Gateway", { status: 502 });
    if (request === 3) return Response.json({ ok: true }, { status: 500 });
    return Response.json({ ok: true, inserted: 5 });
  });
  assert.deepEqual(completed.map((value) => value.status), ["error", "error", "error", "success"]);
  assert.ok(completed.slice(0, 3).every((value) => value.result?.error));
});

test("overlapping report periods keep the selected order", async () => {
  const requests: string[] = [];
  await uploadFilesSequentially([item("week.xlsx", "2026-10-01", "2026-10-07"), item("1003.csv", "2026-10-03")], () => {}, async (_url, init) => {
    requests.push(((init!.body as FormData).get("file") as File).name);
    return Response.json({ ok: true, inserted: 1 });
  });
  assert.deepEqual(requests, ["week.xlsx", "1003.csv"]);
});
