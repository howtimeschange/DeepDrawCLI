import assert from "node:assert/strict";
import { test } from "node:test";
import {
  DEFAULT_BALABALA_TEST_TARGETS,
  parseBalabalaTestTargets,
  resolveBalabalaRemoteTarget,
} from "../src/brands/balabala/remote-targets.js";

test("test mode permits only a configured exact target SPU and preserves its formal source SPU", () => {
  const permitted = resolveBalabalaRemoteTarget({
    mode: "test",
    userSpecifiedTargetSpu: "204426140121-test",
    testTargets: DEFAULT_BALABALA_TEST_TARGETS,
  });
  assert.deepEqual(permitted, {
    mode: "test",
    sourceSpu: "204426140121",
    targetSpu: "204426140121-test",
    userSpecifiedTargetSpu: "204426140121-test",
  });
  assert.throws(() => resolveBalabalaRemoteTarget({ mode: "test", userSpecifiedTargetSpu: "204426140121" }), /configured exact targetSpu/);
  assert.throws(() => resolveBalabalaRemoteTarget({ mode: "test", userSpecifiedTargetSpu: "204426140121-test9" }), /configured exact targetSpu/);
  assert.throws(() => resolveBalabalaRemoteTarget({ mode: "test", userSpecifiedTargetSpu: "204426140122-test" }), /configured exact targetSpu/);
});

test("test config accepts only explicit unique formal-to-test mappings", () => {
  const targets = parseBalabalaTestTargets({ targets: [{ sourceSpu: "202426107128", targetSpu: "202426107128-test" }] });
  assert.deepEqual(resolveBalabalaRemoteTarget({ mode: "test", userSpecifiedTargetSpu: "202426107128-test", testTargets: targets }), {
    mode: "test",
    sourceSpu: "202426107128",
    targetSpu: "202426107128-test",
    userSpecifiedTargetSpu: "202426107128-test",
  });
  assert.throws(() => parseBalabalaTestTargets({ targets: [{ sourceSpu: "202426107128-test", targetSpu: "202426107128-test" }] }), /sourceSpu/);
  assert.throws(() => parseBalabalaTestTargets({ targets: [{ sourceSpu: "202426107128", targetSpu: "202426107128" }] }), /targetSpu/);
});

test("production preserves the one explicit formal SPU and never derives a test target", () => {
  assert.deepEqual(resolveBalabalaRemoteTarget({ mode: "production", userSpecifiedTargetSpu: "202426107128" }), {
    mode: "production",
    sourceSpu: "202426107128",
    targetSpu: "202426107128",
    userSpecifiedTargetSpu: "202426107128",
  });
  assert.throws(() => resolveBalabalaRemoteTarget({ mode: "production", userSpecifiedTargetSpu: "202426107128-test" }), /formal numeric SPU/);
});
