# DeepDraw SDK

This directory vendors the Java SDK jars needed by the DeepDraw CLI internal distribution.

## Layout

| Path | Purpose |
| --- | --- |
| `dop-sdk-1.6.0.jar` | DeepDraw OpenAPI SDK models and requests |
| `sdk-core-java-1.1.0.jar` | Aliyun API Gateway SDK core |
| `lib/*.jar` | Java SDK runtime dependency jars |

The CLI classpath loads both `vendor/deepdraw-sdk/*` and `vendor/deepdraw-sdk/lib/*`.

## Source

The DeepDraw jars came from:

```text
/Users/xingyicheng/Downloads/dop-jar.zip
```

The original zip also contained `.DS_Store` and `__MACOSX` metadata. This directory keeps only jar files and this README.

Third-party dependency jars came from the local Maven cache and are vendored so internal users do not need Maven or internet access after checkout.

## SHA-256

| File | SHA-256 |
| --- | --- |
| `dop-sdk-1.6.0.jar` | `81d1265762062e90363cffd8c4a865571c373e46f8a41471ab37fbedd0e2a627` |
| `sdk-core-java-1.1.0.jar` | `a9eb423b2522c9be4c632d75bd763a4dee7a6d4c1c982772ab3cf4309f37f3d3` |
| `lib/commons-codec-1.15.jar` | `b3e9f6d63a790109bf0d056611fbed1cf69055826defeb9894a71369d246ed63` |
| `lib/commons-collections-3.2.2.jar` | `eeeae917917144a68a741d4c0dff66aa5c5c5fd85593ff217bced3fc8ca783b8` |
| `lib/commons-collections4-4.1.jar` | `b1fe8b5968b57d8465425357ed2d9dc695504518bed2df5b565c4b8e68c1c8a5` |
| `lib/commons-io-2.4.jar` | `cc6a41dc3eaacc9e440a6bd0d2890b20d36b4ee408fe2d67122f328bb6e01581` |
| `lib/commons-lang3-3.11.jar` | `4ee380259c068d1dbe9e84ab52186f2acd65de067ec09beff731fca1697fdb16` |
| `lib/commons-logging-1.2.jar` | `daddea1ea0be0f56978ab3006b8ac92834afeefbd9b7e4e6316fca57df0fa636` |
| `lib/fastjson-1.2.76.jar` | `cecd7e33139c3b762548584b0a50ba0d2e31f589ae02f4699aa850d6b6eec3fe` |
| `lib/guava-20.0.jar` | `36a666e3b71ae7f0f0dca23654b67e086e6c93d192f60ba5dfd5519db6c288c8` |
| `lib/httpclient-4.5.13.jar` | `6fe9026a566c6a5001608cf3fc32196641f6c1e5e1986d1037ccdbd5f31ef743` |
| `lib/httpcore-4.4.14.jar` | `f956209e450cb1d0c51776dfbd23e53e9dd8db9a1298ed62b70bf0944ba63b28` |
| `lib/okhttp-3.8.1.jar` | `c1d57f913f74f61d424d4250a92723ba9a61affc12a0ab194d84cc179b472841` |
| `lib/okio-1.13.0.jar` | `734269c3ebc5090e3b23566db558f421f0b4027277c79ad5d176b8ec168bb850` |
| `lib/slf4j-api-1.7.25.jar` | `18c4a0095d5c1da6b817592e767bb23d29dd2f560ad74df75ff3961dbde25b79` |

## Security

Credentials must stay outside this directory. Configure tenants with environment variables or `deepdraw auth login --stdin-json`; do not add `appSecret`, `dopKey`, or tenant credential JSON to this vendor folder.
