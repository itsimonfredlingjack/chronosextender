import assert from "node:assert/strict";
import test from "node:test";

import { getCurrentView } from "../../src/hooks/useAppContext";

test("getCurrentView keeps reports separate from timesheets", () => {
  assert.equal(getCurrentView("/reports"), "reports");
  assert.equal(getCurrentView("/timesheets"), "timesheets");
  assert.equal(getCurrentView("/dashboard"), "dashboard");
});
