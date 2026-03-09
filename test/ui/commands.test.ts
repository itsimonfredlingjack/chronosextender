import assert from "node:assert/strict";
import test from "node:test";

import { createNavActions } from "../../src/lib/commands";

test("createNavActions exposes reports as a first-class destination", () => {
  const navigated: string[] = [];
  let closed = 0;
  const actions = createNavActions(
    (path) => {
      navigated.push(path);
    },
    () => {
      closed += 1;
    }
  );

  const reports = actions.find((action) => action.id === "nav-reports");

  assert.ok(reports);
  assert.equal(reports?.label, "Go to Reports");

  reports?.execute();

  assert.deepEqual(navigated, ["/reports"]);
  assert.equal(closed, 1);
});

test("createNavActions uses Today as the primary home destination label", () => {
  const actions = createNavActions(() => {}, () => {});
  const dashboard = actions.find((action) => action.id === "nav-dashboard");

  assert.ok(dashboard);
  assert.equal(dashboard?.label, "Go to Today");
});
