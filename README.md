# Google Cloud Logging automatic batching regression

Minimal, credential-free reproduction comparing the exact published `@google-cloud/logging` releases **11.2.1** and **12.0.0**.

v11 initializes `descriptors.batching.writeLogEntries` and coalesces compatible calls. v12 re-exports `@google-cloud/logging-api@0.2.0`, whose batching object is empty. Two compatible writes invoke the mocked transport once in v11 and twice in v12. Explicit higher-level multi-entry writes still work.

## Requirements and installation

Node.js 22 or newer and npm. Internet access is needed only for installing packages. No credentials, Cloud project, or Google Cloud API calls are needed.

```sh
npm ci --prefix versions/v11 --ignore-scripts --no-audit --no-fund
npm ci --prefix versions/v12 --ignore-scripts --no-audit --no-fund
```

No root dependency installation is necessary. Both dependency trees are locked with npm registry integrity hashes.

## Reproduce

```sh
npm run check:v11
npm run check:v12
npm run behavior
npm test
npm run test:expect-v11
```

Expected results:

| Check | 11.2.1 | 12.0.0 |
|---|---|---|
| `descriptors.batching` exists | true | true, empty |
| WriteLogEntries batching descriptor | present | absent |
| Two compatible writes | one transport invocation, two entries | two invocations, one entry each |
| Explicit `log.write([entry1, entry2])` | supported | supported |

`npm test` passes **five evidence tests** documenting the difference. It does not claim the v12 behavior meets the v11 expectation.

`npm run test:expect-v11` intentionally exits **1**, with exactly one failed assertion: v12 should retain v11 automatic coalescing (actual two calls, expected one). The other four tests pass.

Runtime results are written to `artifacts/v11-runtime.json`, `artifacts/v12-runtime.json`, and `artifacts/behavior.json`.

## Published-code comparison

```sh
npm run compare
```

This uses Unix `diff` and compares actual installed JavaScript, declarations, and client configuration. It locates the v12 implementation in `@google-cloud/logging-api`. The diff and line-number evidence are saved under `artifacts/`. On Windows without `diff`, the runtime checks and tests still work.

`npm run investigate` runs both checks, comparison, behavior checks, and passing evidence tests; it requires `diff`.

## How the tests avoid Cloud calls

The descriptor checks inspect synchronous constructor metadata and close the client without authenticating. The behavior checks replace `_gaxGrpc.createStub` before initialization, then exercise the real generated wrappers and each package's real google-gax scheduler. Tests forbid socket connections, HTTP/HTTPS requests, and fetch.

The diagnostic restoration test modifies only an in-memory v12 client: it supplies a BundleDescriptor, bundle settings, and the missing API-call selection. It demonstrates that v12's google-gax still supports coalescing. Installed package files are never modified. Higher-level array tests provide an explicit project/resource and replace the service write method; instrumentation entries are counted separately from the two user entries.

## Generation context

The old generation target supplied `logging_gapic.yaml`, while the separately generated package's Librarian onboarding omitted `nodejs.bundle_config`:

- [Historical Node.js Bazel target](https://github.com/googleapis/googleapis/blob/2b625c91510a2e8320a778bc88af8b65bc4a19a2/google/logging/v2/BUILD.bazel#L268)
- [Historical batching configuration](https://github.com/googleapis/googleapis/blob/2b625c91510a2e8320a778bc88af8b65bc4a19a2/google/logging/v2/logging_gapic.yaml)
- [logging-api onboarding #8863](https://github.com/googleapis/google-cloud-node/pull/8863)
- [Handwritten Logging package split #8929](https://github.com/googleapis/google-cloud-node/pull/8929)

The migration predates the v12 engine bump. These two releases are comparison points; this reproduction does not locate the first affected intermediate release.
