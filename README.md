# Displace

A fully open-source alternative to Discord, this platform focuses on providing traditional forum functionality
and search-engine compatibility with modern features such as voice, rich text, moderation, and more.
Think SMF/Xenforo with voice and a platform built around it.

Forums were easier to read and hold multiple discussions at once. Discord, however, made it easier to talk
directly to friends and provided a free alternative to Teamspeak and Ventrilo. Mounds of information is now
buried within non-indexed "servers" requiring an account to even discover.

**Displace will provide:**
- A platform for communities to create their own spaces
- A forum-first design for discussion centered around topics and discoverability
- Voice chat rooms and chat channels
- Comprehensive moderation, role, and "place" management features
- Full transparency around policy, terms, and software use
- Fair rate limits for developer API
- Self-hostability with single-community mode

## Infrastructure

### Applications

- **Web API:** Node.js and TypeScript using NestJS with the Fastify adapter. Provides a REST API with OpenAPI documentation, WebSocket-based realtime features, background jobs, and integration with the voice service.
- **Web app:** Next.js, React, and TypeScript. Server-side rendering and static rendering keep public forum content discoverable by search engines.
- **Desktop app:** Tauri with a Rust shell and the shared React/TypeScript interface. This keeps the native application small while reusing web UI and API client code.
- **Mobile app:** React Native with Expo and TypeScript, sharing domain types and API client code with the web app.

### Voice

- **LiveKit Server:** A self-hosted, standalone service for WebRTC signaling and voice rooms. It is deployed separately from the Web API so voice capacity can scale independently.
- **TURN server:** coturn supplies STUN/TURN relay support for clients that cannot establish a direct WebRTC connection.
- The Web API manages room policy and issues short-lived LiveKit access tokens; clients connect directly to LiveKit for media.

### Data And Supporting Services

- **PostgreSQL:** Authoritative store for users, communities, forums, posts, roles, moderation, and configuration.
- **Redis:** Cache, presence, rate limiting, pub/sub, and BullMQ-backed background jobs.
- **S3-compatible object storage:** MinIO for self-hosted deployments, storing uploads and other media.
- **Meilisearch:** Full-text search for publicly discoverable forum content.

### Deployment

- **Docker Compose:** [`compose.dev.yaml`](compose.dev.yaml) runs the local web app and development stack. [`compose.prod.yaml`](compose.prod.yaml) provides production web, API, background worker, migrations, PostgreSQL, Redis, MinIO, Meilisearch, and LiveKit services with externally supplied secrets and local reverse-proxy bindings.
- **Containers:** Each service is independently deployable; production installations can move to Kubernetes only when their scale warrants it.