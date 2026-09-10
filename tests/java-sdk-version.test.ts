import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { test } from "node:test";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const sdkDir = join(process.cwd(), "vendor", "deepdraw-sdk");

test("bundled SDK is exactly 1.6.25 with no competing dop jar on the wildcard classpath", async () => {
  const jars = (await readdir(sdkDir)).filter((name) => /^dop-sdk-.*\.jar$/.test(name));
  assert.deepEqual(jars, ["dop-sdk-1.6.25.jar"]);
  const jar = await readFile(join(sdkDir, jars[0]!));
  assert.equal(createHash("sha256").update(jar).digest("hex"), "3f57e6229b2b76ea633cf60f268d3db9691bc4b112c5d91d7aaf6c61229010f6");
});

test("SDK 1.6.25 compiles all bridges and detects duplicate sizes despite different remarks", async (t) => {
  try {
    await execFileAsync("java", ["-version"]);
    await execFileAsync("javac", ["-version"]);
  } catch {
    t.skip("JDK is unavailable");
    return;
  }
  const dir = await mkdtemp(join(tmpdir(), "deepdraw-sdk-version-"));
  const classpath = [join(sdkDir, "*"), join(sdkDir, "lib", "*")].join(delimiter);
  try {
    const probe = join(dir, "SdkSizeProbe.java");
    await writeFile(probe, `
import cn.deepdraw.api.rest.entity.Product;
public class SdkSizeProbe {
  public static void main(String[] args) {
    Product product = new Product();
    product.addProductField("尺码", "26*first;27*second");
    if (!product.checkSizes()) throw new AssertionError("distinct sizes must pass");
    product.addProductField("尺码", "26*first;26*second");
    if (product.checkSizes()) throw new AssertionError("same size with different remarks must fail");
    System.out.println("size-remarks-ok");
  }
}
`);
    const bridges = ["Create", "Update", "IncrementalUpdate", "SkuColorIncrementalUpdate", "Resource"]
      .map((name) => join(process.cwd(), "java", `DeepdrawProduct${name}Cli.java`));
    await execFileAsync("javac", ["-encoding", "UTF-8", "-cp", classpath, "-d", dir, ...bridges, probe]);
    const result = await execFileAsync("java", ["-cp", [dir, classpath].join(delimiter), "SdkSizeProbe"]);
    assert.equal(result.stdout.trim(), "size-remarks-ok");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
});
