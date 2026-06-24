#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { runCli } from "./run.js";

const result = await runCli(process.argv.slice(2), {
  env: process.env,
  stdin: process.stdin.isTTY ? "" : readFileSync(0, "utf8"),
});

if (result.stdout) process.stdout.write(result.stdout);
if (result.stderr) process.stderr.write(result.stderr);
process.exitCode = result.exitCode;
