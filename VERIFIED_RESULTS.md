# Verified results

Executed on 2026-10-13 with Node.js 24.10.0 and npm 11.6.1 on macOS arm64.

Both clean lockfile installations succeeded. This sandbox used npm's offline cache, populated with registry tarballs whose integrity hashes were verified. Normal users can run the README's `npm ci` commands against the npm registry.

- `npm run check:v11`: exit 0; batching descriptor present, google-gax 4.6.1.
- `npm run check:v12`: exit 0; batching object empty, logging-api 0.2.0, google-gax 5.0.8.
- `npm run compare`: exit 0; published implementation/configuration differences reproduced.
- `npm run behavior`: exit 0; v11 one call with two entries, v12 two calls with one entry each; diagnostic restored v12 batches again.
- `npm test`: exit 0; five evidence tests passing.
- `npm run investigate`: exit 0.
- `npm run test:expect-v11`: exit 1 intentionally; four passing tests and one failed parity assertion, actual two calls versus expected one.

No Google Cloud credentials or API calls were used. Dependencies and installed package implementations are unchanged.
