# Displace API Client

`@displace/api-client` is the transport-neutral contract package used by the web, desktop, and mobile applications. The server remains the source of truth for REST contracts.

## Package Surface

- `src/schema.ts` is generated from `openapi.json`. Do not edit it directly.
- `src/http.ts` provides the typed OpenAPI client, JSON request helper, cursor serialization, and RFC 9457 errors.
- `src/realtime.ts` defines Socket.IO commands and server event payloads that OpenAPI cannot describe.
- `src/rich-text.ts` defines and validates the portable rich-text document format.
- `src/domain-values.ts` provides exhaustive runtime values for API unions used in controls and validation.

Platform adapters remain responsible for API origin selection, cookie and CSRF access, native secure token storage, connectivity state, and upload transport details.

## Usage

The typed client expects an API origin because generated paths already include `/api/v1`:

```ts
import { createApiClient } from '@displace/api-client/http';

const api = createApiClient({ baseUrl: 'https://api.example.com' });
const { data } = await api.GET('/api/v1/places', {
  params: { query: { limit: 25 } },
});
```

## Commands

Run from `repos/shared`:

```sh
pnpm install
pnpm generate
pnpm verify
pnpm check
pnpm test
```

`generate` replaces only `src/schema.ts`; handwritten modules must derive their wire types from that generated file where possible.