# DeepDraw CLI

`deepdraw` is an agent-friendly CLI for the DeepDraw OpenAPI.

## Setup

```bash
npm install
npm run build
npm link
```

## Java SDK Runtime

Most `dp.*` APIs use signed HTTP calls directly. These product APIs use the DeepDraw Java SDK bridge because their payloads rely on SDK entity mapping:

- `dp.product.create`
- `dp.product.update`
- `dp.product.resource`

Install a JDK that provides both `java` and `javac`, then make the DeepDraw SDK jars available by one of these methods:

```bash
mkdir -p vendor/deepdraw-sdk
# Put the DeepDraw SDK jars in this directory:
# - dop-sdk-1.6.0.jar
# - sdk-core-java-1.1.0.jar
```

Or point the CLI at an existing SDK location:

```bash
export DEEPDRAW_SDK_DIR=/absolute/path/to/deepdraw-sdk
# or provide the full classpath yourself
export DEEPDRAW_SDK_CLASSPATH="/absolute/path/dop-sdk-1.6.0.jar:/absolute/path/sdk-core-java-1.1.0.jar"
```

On Windows, use `;` between classpath entries:

```powershell
$env:DEEPDRAW_SDK_CLASSPATH="C:\deepdraw-sdk\dop-sdk-1.6.0.jar;C:\deepdraw-sdk\sdk-core-java-1.1.0.jar"
```

The CLI compiles the Java bridge classes into `.deepdraw-sdk/classes` on first Java-SDK execution. That directory is generated locally and ignored by git.

## Credentials

Credential login from stdin JSON:

```bash
deepdraw auth login --stdin-json < credentials.json
```

Credential storage:

- Environment variables take priority when all required `DEEPDRAW_*` values are set.
- `auth login --stdin-json` writes non-secret tenant config to the platform config path:
  - macOS/Linux: `~/.config/deepdraw/config.json`
  - Windows: `%APPDATA%\DeepDrawCli\config.json`
- Secrets are stored separately by credential reference. The current built-in default is a local `credentials.json` file beside the config file; tests use an injected fake store. Do not commit either file.
- Java SDK execution uses `DEEPDRAW_SDK_CLASSPATH`, `DEEPDRAW_SDK_DIR`, or `vendor/deepdraw-sdk`. The local Listingify SDK path is only a development-machine fallback.

## Safe Calls

Read-only call:

```bash
deepdraw call dp.colors.get
```

Risky call plan:

```bash
deepdraw call dp.product.search --execute --plan --param merchantId=MERCHANT_ID
```

Execute after explicit user approval:

```bash
deepdraw call dp.product.search --execute --yes --param merchantId=MERCHANT_ID
```

## Validation

```bash
npm test
npm run lint
npm run build
deepdraw config doctor --dry-run
deepdraw call dp.colors.get --dry-run
deepdraw call dp.product.resource --dry-run
```
