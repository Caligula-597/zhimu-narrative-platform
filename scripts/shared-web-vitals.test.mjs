import assert from "node:assert/strict";
import test from "node:test";
import { reportWebVital } from "../shared/web-vitals.js";

test("reportWebVital invokes onMetric callback", () => {
  const seen = [];
  reportWebVital({ name: "LCP", value: 1200, id: "lcp-1" }, {
    onMetric: (metric) => seen.push(metric)
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0].name, "LCP");
});
