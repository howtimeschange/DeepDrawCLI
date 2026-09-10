import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { promisify } from "node:util";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const bridgeClass = "DeepdrawProductIncrementalUpdateCli";
const bridgeSource = join(process.cwd(), "java", `${bridgeClass}.java`);
const sdkDir = join(process.cwd(), "vendor", "deepdraw-sdk");
const sdkClasspath = [join(sdkDir, "*"), join(sdkDir, "lib", "*")].join(delimiter);

type BridgeResult = {
  exitCode: number | null;
  stdout: string;
  stderr: string;
};

async function commandAvailable(command: string): Promise<boolean> {
  try {
    await execFileAsync(command, ["-version"]);
    return true;
  } catch {
    return false;
  }
}

async function runBridge(classDir: string, input: unknown): Promise<BridgeResult> {
  return new Promise((resolve, reject) => {
    const child = spawn("java", ["-cp", [classDir, join(sdkDir, "*"), join(sdkDir, "lib", "*")].join(delimiter), bridgeClass], {
      cwd: process.cwd(),
      env: { PATH: process.env.PATH ?? "", DEEPDRAW_SDK_DUMP_REQUEST: "1" },
      stdio: ["pipe", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

test("generic incremental bridge keeps empty places out of the v2 Product request", async (t) => {
  if (!(await commandAvailable("java")) || !(await commandAvailable("javac"))) {
    t.skip("JDK is unavailable");
    return;
  }
  try {
    await access(bridgeSource);
    await access(join(sdkDir, "dop-sdk-1.6.25.jar"));
  } catch {
    t.skip("bundled DeepDraw SDK is unavailable");
    return;
  }

  const classDir = await mkdtemp(join(tmpdir(), "deepdraw-product-incremental-bridge-"));
  try {
    await execFileAsync("javac", ["-source", "1.8", "-target", "1.8", "-cp", sdkClasspath, "-d", classDir, bridgeSource]);
    const valid = await runBridge(classDir, {
      config: { appKey: "dummy-app", appSecret: "dummy-secret", dopKey: "dummy-dop", host: "https://example.test" },
      query: { productId: "ed18698170c54da4baa88541d66e3536" },
      product: {
        title: "增量测试标题",
        fields: {
          颜色: "蓝色,blue;绿色,green",
          尺码: "26;27",
        },
      },
    });
    assert.equal(valid.exitCode, 0, valid.stderr);
    const dump = JSON.parse(valid.stdout) as { path: string; query: Record<string, string>; body: string; checkColor: boolean; checkSizes: boolean };
    const body = JSON.parse(dump.body) as { product: { title: string; places?: unknown; productFields: Record<string, unknown> } };
    assert.equal(dump.path, "/rest/v2");
    assert.equal(dump.query.type, "dp.product.incremental.update");
    assert.equal(dump.query.productId, "ed18698170c54da4baa88541d66e3536");
    assert.equal(dump.checkColor, true);
    assert.equal(dump.checkSizes, true);
    assert.equal(body.product.title, "增量测试标题");
    assert.equal("places" in body.product, false);
    assert.equal(body.product.productFields.颜色, "蓝色,blue;绿色,green");
    assert.equal(body.product.productFields.尺码, "26;27");

    const invalid = await runBridge(classDir, {
      config: { appKey: "dummy-app", appSecret: "dummy-secret", dopKey: "dummy-dop", host: "https://example.test" },
      query: { productId: "ed18698170c54da4baa88541d66e3536" },
      product: { fields: { 商家SKU: { title: "价格", blue: { "26": "SKU001" } } } },
    });
    assert.notEqual(invalid.exitCode, 0);
    assert.equal(invalid.stdout.trim(), "");
    assert.match(invalid.stderr, /颜色.*尺码|尺码.*颜色/);
  } finally {
    await rm(classDir, { recursive: true, force: true });
  }
});
