const assert = require("node:assert/strict");
const logic = require("../js/media-logic.js");

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test("buildSearchText aggregates core fields", () => {
  const text = logic.buildSearchText({
    title: "Wreck Dive",
    description: "Cold water",
    location: "Great Lakes",
    badge: "VIDEO",
    type: "video",
    tags: ["wreck", "training"],
    meta: ["Night"],
  });
  assert.equal(
    text,
    "wreck dive cold water great lakes video video wreck training night"
  );
});

test("normalizeKey strips non-alnum and lowercases", () => {
  assert.equal(logic.normalizeKey(" Great-Lakes !! "), "greatlakes");
});

test("matchesItemFilter supports partial tag matches", () => {
  const item = { tags: ["wreck", "greatlakes"] };
  assert.equal(logic.matchesItemFilter(item, "great"), true);
  assert.equal(logic.matchesItemFilter(item, "reef"), false);
});

test("matchesItemSelectedTags checks all selected tags", () => {
  const item = { tags: ["video", "wreck", "greatlakes"] };
  assert.equal(logic.matchesItemSelectedTags(item, new Set(["video", "wreck"])), true);
  assert.equal(logic.matchesItemSelectedTags(item, new Set(["video", "reef"])), false);
});

test("matchesItemSelectedLocation resolves via location map", () => {
  const byId = new Map([["great-lakes", "Great Lakes"]]);
  assert.equal(
    logic.matchesItemSelectedLocation({ location: "Great Lakes" }, "great-lakes", byId),
    true
  );
  assert.equal(
    logic.matchesItemSelectedLocation({ location: "Caribbean" }, "great-lakes", byId),
    false
  );
});

test("matchesItemSearch enforces all terms", () => {
  const item = { title: "Wreck Training", description: "Cold water" };
  assert.equal(logic.matchesItemSearch(item, "wreck cold"), true);
  assert.equal(logic.matchesItemSearch(item, "wreck tropical"), false);
});

test("applySort recent uses descending date", () => {
  const items = [
    { id: "a", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "b", createdAt: "2025-01-01T00:00:00.000Z" },
  ];
  const out = logic.applySort(items, { sort: "recent", indexMap: new Map([["a", 0], ["b", 1]]) });
  assert.deepEqual(out.list.map((x) => x.id), ["b", "a"]);
});

test("applySort oldest uses ascending date", () => {
  const items = [
    { id: "a", createdAt: "2024-01-01T00:00:00.000Z" },
    { id: "b", createdAt: "2025-01-01T00:00:00.000Z" },
  ];
  const out = logic.applySort(items, { sort: "oldest", indexMap: new Map([["a", 0], ["b", 1]]) });
  assert.deepEqual(out.list.map((x) => x.id), ["a", "b"]);
});

test("applySort views uses descending views", () => {
  const items = [
    { id: "a", views: "10" },
    { id: "b", views: "250" },
    { id: "c", views: 42 },
  ];
  const out = logic.applySort(items, { sort: "views" });
  assert.deepEqual(out.list.map((x) => x.id), ["b", "c", "a"]);
});

test("applySort shuffle keeps provided shuffle order", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const out = logic.applySort(items, { sort: "shuffle", shuffleOrder: ["c", "a", "b"] });
  assert.deepEqual(out.list.map((x) => x.id), ["c", "a", "b"]);
});

test("applySort shuffle generates order when missing", () => {
  const items = [{ id: "a" }, { id: "b" }, { id: "c" }];
  const out = logic.applySort(items, { sort: "shuffle", rng: () => 0 });
  assert.deepEqual(out.shuffleOrder.length, 3);
  assert.deepEqual(out.list.map((x) => x.id).sort(), ["a", "b", "c"]);
});

console.log("All media logic tests passed.");
