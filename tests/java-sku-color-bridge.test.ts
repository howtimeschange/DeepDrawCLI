import assert from "node:assert/strict";
import { execFile, spawn } from "node:child_process";
import { access, mkdtemp, rm } from "node:fs/promises";
import { promisify } from "node:util";
import { delimiter, join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

const execFileAsync = promisify(execFile);
const bridgeClass = "DeepdrawProductSkuColorIncrementalUpdateCli";
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
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", reject);
    child.on("close", (exitCode) => resolve({ exitCode, stdout, stderr }));
    child.stdin.end(JSON.stringify(input));
  });
}

function baseInput(product: Record<string, unknown>) {
  return {
    config: {
      appKey: "dummy-app",
      appSecret: "dummy-secret",
      dopKey: "dummy-dop",
      host: "https://example.test",
    },
    query: { productId: "123" },
    product,
  };
}

function validFields() {
  return {
    颜色: "黑色,black",
    尺码: "M",
    "商家 SKU": {
      title: "价格",
      black: { M: "SKU001" },
    },
  };
}

test("SKU color bridge emits no empty optional fields and rejects invalid required fields before prepare", async (t) => {
  if (!(await commandAvailable("java")) || !(await commandAvailable("javac"))) {
    t.skip("JDK is unavailable");
    return;
  }
  try {
    await access(bridgeSource);
    await access(join(sdkDir, "dop-sdk-1.6.24.jar"));
  } catch {
    t.skip("bundled DeepDraw SDK is unavailable");
    return;
  }

  const classDir = await mkdtemp(join(tmpdir(), "deepdraw-sku-color-bridge-"));
  try {
    await execFileAsync("javac", ["-source", "1.8", "-target", "1.8", "-cp", sdkClasspath, "-d", classDir, bridgeSource]);

    const validResult = await runBridge(classDir, baseInput({
      code: " ",
      title: null,
      retailPrice: "",
      date: "   ",
      remark: "",
      places: [],
      fields: validFields(),
    }));
    assert.equal(validResult.exitCode, 0, validResult.stderr);
    assert.equal(validResult.stderr, "");
    const validDump = JSON.parse(validResult.stdout) as { body: string; checkColor: boolean; checkSizes: boolean; checkSkus: boolean };
    const validBody = JSON.parse(validDump.body) as { product: Record<string, unknown> };
    assert.equal(validDump.checkColor, true);
    assert.equal(validDump.checkSizes, true);
    assert.equal(validDump.checkSkus, true);
    assert.equal("code" in validBody.product, false);
    assert.equal("title" in validBody.product, false);
    assert.equal("retailPrice" in validBody.product, false);
    assert.equal("date" in validBody.product, false);
    assert.equal("remark" in validBody.product, false);
    assert.equal("places" in validBody.product, false);
    const productFields = validBody.product.productFields as Record<string, unknown>;
    assert.equal(productFields["商家SKU"] !== undefined, true);
    assert.equal(productFields["颜色"], "黑色,black");
    assert.equal(productFields["尺码"], "M");

    const productFieldsResult = await runBridge(classDir, baseInput({ productFields: validFields() }));
    assert.equal(productFieldsResult.exitCode, 0, productFieldsResult.stderr);
    assert.equal(productFieldsResult.stderr, "");

    const requiredFields = ["颜色", "尺码", "商家SKU"] as const;
    const invalidValues: Array<{ label: string; missing?: boolean; value?: unknown }> = [
      { label: "missing", missing: true },
      { label: "blank", value: "   " },
      { label: "null", value: null },
      { label: "empty array", value: [] },
      { label: "empty object", value: {} },
    ];

    for (const field of requiredFields) {
      for (const invalid of invalidValues) {
        const fields = validFields() as Record<string, unknown>;
        delete fields["商家 SKU"];
        fields.商家SKU = {
          title: "价格",
          black: { M: "SKU001" },
        };
        if (invalid.missing) {
          delete fields[field];
        } else {
          fields[field] = invalid.value;
        }

        const result = await runBridge(classDir, baseInput({ fields }));
        assert.notEqual(result.exitCode, 0, `${field} ${invalid.label} unexpectedly succeeded`);
        assert.equal(result.stdout.trim(), "", `${field} ${invalid.label} prepared a request`);
        assert.ok(result.stderr.includes(field), `${field} ${invalid.label} did not identify the invalid field: ${result.stderr}`);
      }
    }
  } finally {
    await rm(classDir, { recursive: true, force: true });
  }
});
