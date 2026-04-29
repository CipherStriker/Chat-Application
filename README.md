# System Design -- Technical Architecture Document

A complete blueprint of the self-hosted real-time chat application: every service, every table, every socket event, and every environment variable documented in one place.

---

## Table of Contents

1. [High-Level Architecture](#1-high-level-architecture)
2. [Full Tech Stack](#2-full-tech-stack)
3. [Docker Orchestration](#3-docker-orchestration-the-network-map)
4. [Database Schema](#4-database-schema)
5. [Real-Time Communication Flow](#5-real-time-communication-flow)
6. [File Storage Logic](#6-file-storage-logic)
7. [Authentication Flow](#7-authentication-flow)
8. [REST API Reference](#8-rest-api-reference)
9. [Environment Variables](#9-environment-variables)
10. [Automated Setup Script](#10-automated-setup-script)

---

## 1. High-Level Architecture

This application follows a **sovereign / self-hosted** model. Every component -- the database, the file storage, the API server, and the WebSocket server -- runs on infrastructure you own and control. There is no dependency on third-party SaaS platforms for core functionality. A single `docker compose up` command brings the entire stack online.

### Production Architecture

```
                              +------- Docker Network (internal) -------+
                              |                                         |
+-----------+   HTTPS :443    |  +-------+     +----------------+       |
|           | --------------->|  | Nginx |---->| frontend  :80  |       |
|  Browser  |   (all traffic) |  | Proxy |     | (React SPA)    |       |
|  (any     |                 |  |       |     +----------------+       |
|   device  |                 |  |       |                              |
|   on LAN) |                 |  |       |-/api/-->+---------------+    |
|           |                 |  |       |         | api-gateway   |    |
|           | <---------------|  |       |<--------|  :5001        |    |
+-----------+   JSON / Events |  |       |         +------+--------+    |
                              |  |       |                |    |        |
                              |  |       |-/socket.io/--->+----+---+    |
                              |  |       |   (WSS)       | real-time|   |
                              |  |       |               | :5002    |   |
                              |  |       |               +----------+   |
                              |  |       |                              |
                              |  |       |-/chat-files/-->+---------+   |
                              |  |       |               | minio   |   |
                              |  |       |               | :9000   |   |
                              |  +-------+               +---------+   |
                              |                                         |
                              |            +-------------+              |
                              |            | PostgreSQL  |              |
                              |            |  :5432      |              |
                              |            +-------------+              |
                              +-----------------------------------------+
```

All traffic enters through a single port -- **443 (HTTPS)** -- via the Nginx reverse proxy. No backend service port is exposed to the host. The proxy terminates SSL using an auto-generated self-signed certificate and routes requests by path:

- `/api/*` routes to the API Gateway
- `/socket.io/*` routes to the Real-Time Service (with WebSocket upgrade headers)
- `/chat-files/*` routes to MinIO for file retrieval
- `/*` (everything else) routes to the frontend container serving the built React SPA

**Frontend** -- A React single-page application built at Docker image creation time via a multi-stage Dockerfile. Stage 1 compiles with Vite; Stage 2 serves the static assets from an Nginx container on port 80 (internal only). For local development, the Vite dev server still runs on port 5173 outside Docker.

**Backend** -- Two Node.js processes:

- **API Gateway** (internal port 5001): Express server handling authentication, chat CRUD, message persistence, file uploads, and user management. Connects to PostgreSQL and MinIO.
- **Real-Time Service** (internal port 5002): Stateless Socket.IO server that relays events between connected clients.

**Data Layer** -- Two containers:

- **PostgreSQL 15**: The single source of truth for users, chats, memberships, and messages.
- **MinIO**: S3-compatible object store for uploaded files in the `chat-files` bucket.

**Reverse Proxy (Nginx)** -- Terminates TLS, enforces a 50MB upload limit, proxies all traffic to the correct internal service, and injects WebSocket upgrade headers for Socket.IO.

### Request Lifecycle (Simplified)

1. User types a message and presses Enter.
2. The browser sends an HTTPS POST to `https://<host>/api/messages` (port 443).
3. The Nginx proxy strips TLS and forwards the request to `api-gateway:5001`.
4. The API Gateway validates the JWT, checks membership and block status, inserts the message into PostgreSQL, and returns the saved message.
5. The frontend receives the HTTP response and immediately emits a `send_message` Socket.IO event through the proxy's `/socket.io/` path.
6. The Real-Time Service broadcasts a `receive_message` event to all other sockets in that chat room.
7. Every other connected client receives the event and updates their local state.

---

## 2. Full Tech Stack

### Frontend

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Framework | React | 18.3 | Component-based UI |
| Language | TypeScript | 5.5 | Type safety |
| Build Tool | Vite | 5.4 | Dev server and production bundler |
| Styling | Material UI (MUI) | 7.3 | Component library and theming |
| Styling (utility) | Tailwind CSS | 3.4 | Utility-first CSS classes |
| HTTP Client | Axios | 1.13 | REST API calls with interceptors |
| WebSocket Client | socket.io-client | 4.8 | Real-time bidirectional events |
| Routing | react-router-dom | 7.13 | Client-side SPA routing |
| Icons | Lucide React | 0.344 | SVG icon components |
| Emoji Picker | emoji-picker-react | 4.18 | In-chat emoji selection |

### Backend -- API Gateway

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 18 (Alpine) | JavaScript server runtime |
| Framework | Express | 4.21 | HTTP routing and middleware |
| Database Driver | pg (node-postgres) | 8.13 | PostgreSQL connection pool |
| Authentication | jsonwebtoken | 9.0 | JWT creation and verification |
| Password Hashing | bcryptjs | 2.4 | Bcrypt hashing (10 salt rounds) |
| File Upload Parsing | Multer | 2.1 | Multipart form-data handling |
| Object Storage SDK | minio | 8.0 | S3-compatible file storage client |
| ID Generation | uuid | 9.0 | UUIDv4 for all primary keys |
| Env Config | dotenv | 16.4 | Environment variable loading |
| CORS | cors | 2.8 | Cross-origin request handling |

### Backend -- Real-Time Service

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Runtime | Node.js | 18 (Alpine) | JavaScript server runtime |
| WebSocket Server | socket.io | 4.8 | Event-based real-time communication |
| CORS | cors | 2.8 | Cross-origin WebSocket handling |

### Infrastructure

| Category | Technology | Version | Purpose |
|---|---|---|---|
| Containerization | Docker | -- | Process isolation and reproducibility |
| Orchestration | Docker Compose | 3.8 | Multi-container management |
| Reverse Proxy / TLS | Nginx | Alpine | SSL termination and request routing |
| Database | PostgreSQL | 15 (Alpine) | Relational data persistence |
| Object Storage | MinIO | Latest | S3-compatible file storage |

---

## 3. Docker Orchestration (The Network Map)

All services are defined in `chat-app-backend/docker-compose.yml` and share a default Docker bridge network, allowing inter-container communication by service name. Only the reverse proxy exposes a port to the host -- all other services communicate internally.

### Service Map

| Service | Image / Build Context | External Port | Internal Port | Purpose |
|---|---|---|---|---|
| `proxy` | `../nginx` (Dockerfile) | **443** | 443 | Nginx reverse proxy with auto-generated self-signed SSL |
| `frontend` | `../` (multi-stage Dockerfile) | _(none)_ | 80 | Nginx serving the production React build |
| `api-gateway` | `./api-gateway` (Dockerfile) | _(none)_ | 5001 | Express REST API server |
| `real-time-service` | `./real-time-service` (Dockerfile) | _(none)_ | 5002 | Socket.IO event relay server |
| `database` | `postgres:15-alpine` | _(none)_ | 5432 | PostgreSQL database server |
| `minio` | `minio/minio:latest` | _(none)_ | 9000, 9001 | S3-compatible object storage |

### Single Entry Point

Only **port 443** is exposed to the host machine and the local network. The Nginx reverse proxy handles all routing:

| URL Path | Proxied To | Protocol |
|---|---|---|
| `/api/*` | `http://api-gateway:5001` | HTTP |
| `/socket.io/*` | `http://real-time-service:5002` | HTTP with WebSocket upgrade |
| `/chat-files/*` | `http://minio:9000` | HTTP |
| `/*` (catch-all) | `http://frontend:80` | HTTP |

### Container Networking

```
Host Machine (0.0.0.0)
  |
  |--- :443 (HTTPS)  Nginx Reverse Proxy
  |                      |
  |                      |--> frontend:80         (React SPA)
  |                      |--> api-gateway:5001    (REST API)
  |                      |      |--> database:5432
  |                      |      |--> minio:9000
  |                      |--> real-time-service:5002  (WebSocket)
  |                      |--> minio:9000          (file downloads)
  |
  |--- :5173  Vite Dev Server (runs outside Docker, for development only)
```

### SSL / TLS

The reverse proxy Dockerfile auto-generates a self-signed certificate at image build time:

- **Certificate**: `/etc/nginx/ssl/nginx.crt` (RSA 2048-bit, valid 365 days)
- **Key**: `/etc/nginx/ssl/nginx.key`
- Protocols: TLSv1.2 and TLSv1.3 only
- Browsers will show a certificate warning since it is self-signed. Accept the warning to proceed, or replace with a CA-signed certificate for production.

### Docker Volumes

| Volume Name | Mounted At (inside container) | Purpose |
|---|---|---|
| `chat_db_data` | `/var/lib/postgresql/data` | Persistent PostgreSQL data files. All tables, indexes, and WAL logs survive container restarts and rebuilds. |
| `minio_data` | `/data` | Persistent MinIO object storage. All uploaded files (images, documents) in the `chat-files` bucket survive container restarts. |

Both volumes are Docker named volumes. On Linux, their physical location is typically `/var/lib/docker/volumes/<volume_name>/_data`. On Docker Desktop (macOS/Windows), they reside inside the Docker VM's filesystem.

### Network Visibility

In production (Docker), all traffic flows through the proxy on port 443. Any device on the local network can reach the app at `https://<host-ip>`. For development, the Vite dev server is configured with `server.host: true` in `vite.config.ts`, binding to `0.0.0.0` so it is also LAN-accessible at `http://<host-ip>:5173`.

### Startup Dependencies

The `proxy` service declares `depends_on: [frontend, api-gateway, real-time-service, minio]`, ensuring all upstream services start first. The `api-gateway` service declares `depends_on: [database, minio]`, ensuring the data layer is ready before the API starts.

---

## 4. Database Schema

The database is PostgreSQL 15. Schema initialization runs automatically when the API Gateway starts -- it reads `api-gateway/src/db/init.sql` and executes it via `db_init.js`. All statements use `IF NOT EXISTS` / `IF NOT EXISTS` guards, making the initialization idempotent.

### Entity-Relationship Diagram

```
+------------------+        +------------------+        +------------------+
|      users       |        |      chats       |        |    messages      |
|------------------|        |------------------|        |------------------|
| id (PK, UUID)    |<---+   | id (PK, UUID)    |<---+   | id (PK, UUID)    |
| username (UNIQUE)|    |   | name             |    |   | chat_id (FK)     |----> chats.id
| password_hash    |    |   | is_group_chat    |    |   | sender_id (FK)   |----> users.id
| avatar_url       |    |   | admin_id (FK)    |----+   | content          |
| created_at       |    |   | avatar_url       |        | is_read          |
+------------------+    |   | created_at       |        | file_url         |
        |               |   +------------------+        | file_type        |
        |               |           |                   | created_at       |
        |               |           |                   +------------------+
        |               |           |
        |               |   +------------------+
        |               |   |  chat_members    |
        |               +-->|------------------|
        |                   | chat_id (PK, FK) |----> chats.id
        +------------------>| user_id (PK, FK) |----> users.id
                            | left_at          |
                            | cleared_at       |
                            | hide_history_before|
                            +------------------+
                            
+------------------+
|  blocked_users   |
|------------------|
| blocker_id (PK, FK) |----> users.id
| blocked_id (PK, FK) |----> users.id
| created_at       |
+------------------+
```

### Table Details

#### `users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique user identifier |
| `username` | VARCHAR(50) | UNIQUE, NOT NULL | Display name and login credential |
| `password_hash` | VARCHAR(255) | NOT NULL | Bcrypt hash (10 salt rounds) |
| `avatar_url` | VARCHAR(500) | NULLABLE | URL to profile picture in MinIO |
| `created_at` | TIMESTAMPTZ | DEFAULT `now()` | Account creation timestamp |

#### `chats`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique chat/room identifier |
| `name` | VARCHAR(100) | NULLABLE | Group chat display name (NULL for 1:1 chats) |
| `is_group_chat` | BOOLEAN | DEFAULT `false` | Distinguishes group chats from direct messages |
| `admin_id` | UUID | FK -> `users.id`, NULLABLE | Group creator/admin (NULL for 1:1 chats) |
| `avatar_url` | VARCHAR(500) | NULLABLE | Group profile picture URL |
| `created_at` | TIMESTAMPTZ | DEFAULT `now()` | Chat creation timestamp |

#### `chat_members` (Junction Table)

| Column | Type | Constraints | Description |
|---|---|---|---|
| `chat_id` | UUID | PK (composite), FK -> `chats.id` ON DELETE CASCADE | Chat reference |
| `user_id` | UUID | PK (composite), FK -> `users.id` ON DELETE CASCADE | User reference |
| `left_at` | TIMESTAMPTZ | NULLABLE, DEFAULT NULL | When the user left the group (NULL = still active) |
| `cleared_at` | TIMESTAMPTZ | NULLABLE, DEFAULT NULL | When the user cleared their chat view (NULL = visible) |
| `hide_history_before` | TIMESTAMPTZ | NULLABLE, DEFAULT NULL | Messages before this timestamp are hidden from this user. Set when "Share history" is unchecked during member addition. |

#### `messages`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `id` | UUID | PRIMARY KEY, DEFAULT `gen_random_uuid()` | Unique message identifier |
| `chat_id` | UUID | NOT NULL, FK -> `chats.id` ON DELETE CASCADE | Target chat room |
| `sender_id` | UUID | NOT NULL, FK -> `users.id` ON DELETE CASCADE | Message author |
| `content` | TEXT | NOT NULL | Message text body |
| `is_read` | BOOLEAN | DEFAULT `false` | Read receipt tracking |
| `file_url` | VARCHAR | NULLABLE | URL to attached file in MinIO |
| `file_type` | VARCHAR | NULLABLE | MIME type of attached file (e.g., `image/png`) |
| `created_at` | TIMESTAMPTZ | DEFAULT `now()` | Message send timestamp |

#### `blocked_users`

| Column | Type | Constraints | Description |
|---|---|---|---|
| `blocker_id` | UUID | PK (composite), FK -> `users.id` ON DELETE CASCADE | User who initiated the block |
| `blocked_id` | UUID | PK (composite), FK -> `users.id` ON DELETE CASCADE | User who was blocked |
| `created_at` | TIMESTAMPTZ | DEFAULT `now()` | Block timestamp |

### Indexes

| Index Name | Table | Column(s) | Purpose |
|---|---|---|---|
| `idx_messages_chat_id` | messages | `chat_id` | Fast message lookup by chat room |
| `idx_messages_sender_id` | messages | `sender_id` | Fast lookup by message author |
| `idx_messages_created_at` | messages | `created_at` | Efficient ordering and range queries |
| `idx_messages_is_read` | messages | `is_read` | Fast unread count calculations |
| `idx_chat_members_user_id` | chat_members | `user_id` | Fast "which chats is this user in?" lookups |
| `idx_blocked_users_blocked_id` | blocked_users | `blocked_id` | Fast "is this user blocked by someone?" checks |

### Privacy-Aware Queries

The `chat_members.hide_history_before` column enforces chat history privacy at the SQL level. Three queries in `chatRoutes.js` (GET `/`) are filtered by this column:

1. **Last message preview**: The sidebar subquery that fetches the most recent message for each chat includes `AND m.created_at >= COALESCE(my_membership.hide_history_before, '1970-01-01')`, so a new member added without history sharing sees no preview for old messages.
2. **Unread counter**: The unread count subquery includes the same filter, preventing old messages from inflating a new member's badge count.
3. **Message fetch**: The `GET /messages/:chatId` endpoint builds a dynamic WHERE clause that excludes messages before `hide_history_before`.

---

## 5. Real-Time Communication Flow

### Technology

The WebSocket layer uses **Socket.IO** (v4.8), which provides automatic reconnection, room-based broadcasting, and fallback to HTTP long-polling if WebSockets are unavailable. The client connects on page load and disconnects on logout.

### Connection Lifecycle

```
1. User logs in successfully
2. Dashboard mounts -> connectSocket() establishes WebSocket to :5002
3. emitUserConnected() -> broadcasts 'refresh_user_list' to all other clients
4. registerUser(userId) -> joins personal room 'user_{userId}' for targeted events
5. joinMultipleChats(chatIds) -> joins a Socket.IO room for every chat the user belongs to
6. User interacts with the app, emitting and receiving events...
7. User logs out -> disconnectSocket() closes the connection
```

### Socket.IO Event Map

Every event in the system, organized by category:

#### Messaging Events

| Client Emits | Server Broadcasts | Scope | Description |
|---|---|---|---|
| `send_message` | `receive_message` | Chat room | Relays a new message to all other members of the chat room. Payload includes `chat_id`, `id`, `text`, `content`, `timestamp`, `sender_id`, `sender_username`, `fileUrl`, `fileType`. |

#### Chat List Events

| Client Emits | Server Broadcasts | Scope | Description |
|---|---|---|---|
| `new_chat_initiated` | `refresh_chat_list` | All clients | Signals that a new 1:1 chat was created with a first message. Receivers re-fetch their chat list. |

#### Typing Indicator Events

| Client Emits | Server Broadcasts | Scope | Description |
|---|---|---|---|
| `typing` | `display_typing` | Chat room | Shows "{username} is typing..." in the chat window and sidebar. |
| `stop_typing` | `hide_typing` | Chat room | Hides the typing indicator. Auto-emitted after 2 seconds of inactivity. |

#### User Presence Events

| Client Emits | Server Broadcasts | Scope | Description |
|---|---|---|---|
| `user_connected_announcement` | `refresh_user_list` | All clients | Triggers re-fetch of the user list after a new user connects. |
| `profile_updated` | `refresh_global_data` | All clients | Triggers full data re-fetch (chats, users, blocked list) after a profile change. |
| `block_status_changed` | `refresh_global_data` | All clients | Triggers full data re-fetch after a block/unblock action. |

#### Group Management Events

| Client Emits | Server Broadcasts | Scope | Description |
|---|---|---|---|
| `join_chat` | _(room join)_ | Server-side | Adds the socket to a Socket.IO room. Used both for single chat selection and bulk room joining. |
| `register_user` | _(room join)_ | Server-side | Adds the socket to a personal room `user_{userId}` for targeted events. |
| `group_updated` | `refresh_global_data` | Chat room | Notifies room members after group name/avatar changes. |
| `user_removed_from_group` | `removed_from_group` + `refresh_global_data` | Targeted user + chat room | Sends a targeted event to the removed user and a refresh to remaining members. |
| `user_left_group` | `refresh_global_data` | Chat room | Notifies remaining members when someone leaves voluntarily. |
| `group_deleted` | `group_deleted_notification` | Targeted users | Sends individual notifications to each former member via their `user_{id}` room. |
| `added_to_group` | `added_to_group_notification` + `refresh_global_data` | Targeted users + chat room | Notifies newly added members via personal rooms and existing members via the chat room. |

### Message Flow: User A Sends "Hello" to User B

```
User A (Browser)                    API Gateway (:5001)         Real-Time Svc (:5002)        User B (Browser)
     |                                    |                            |                           |
     |-- POST /api/messages ------------->|                            |                           |
     |   { chatId, content: "Hello" }     |                            |                           |
     |                                    |-- INSERT INTO messages --->|                           |
     |                                    |   (PostgreSQL)             |                           |
     |<-- 201 { message } ---------------|                            |                           |
     |                                    |                            |                           |
     |-- emit('send_message') ---------------------------------------->|                           |
     |   { chat_id, text, sender_id, ... }|                            |                           |
     |                                    |                            |-- emit('receive_message')->|
     |                                    |                            |   to room: chatId         |
     |                                    |                            |                           |
     |                                    |                            |            User B updates: |
     |                                    |                            |            - message list  |
     |                                    |                            |            - sidebar text  |
     |                                    |                            |            - unread count  |
```

Key detail: the message is **persisted first** via HTTP, then **broadcast second** via WebSocket. This guarantees that no message is lost even if the WebSocket relay fails -- the recipient will see it on their next data refresh or page reload.

---

## 6. File Storage Logic

### Architecture

File storage uses **MinIO**, an S3-compatible object storage server. Files are uploaded to the API Gateway, which streams them into a MinIO bucket. The resulting public URL is then attached to a message.

### Upload Flow

```
React UI                          API Gateway (:5001)                   MinIO (:9000)
   |                                    |                                    |
   | 1. User selects file               |                                    |
   |    (FileInput onChange)             |                                    |
   |                                    |                                    |
   | 2. POST /api/upload                |                                    |
   |    Content-Type: multipart/form-data                                    |
   |    Body: FormData { file }         |                                    |
   |----------------------------------->|                                    |
   |                                    | 3. Multer parses file to           |
   |                                    |    memory buffer                   |
   |                                    |                                    |
   |                                    | 4. Generate unique filename:       |
   |                                    |    {uuid}.{ext}                    |
   |                                    |                                    |
   |                                    | 5. minioClient.putObject()         |
   |                                    |----------------------------------->|
   |                                    |    Bucket: "chat-files"            |
   |                                    |    Key: "{uuid}.{ext}"            |
   |                                    |    Body: file buffer               |
   |                                    |    ContentType: file.mimetype      |
   |                                    |                                    |
   |                                    |<--- 200 OK ----------------------|
   |                                    |                                    |
   |                                    | 6. Build public URL:               |
   |                                    |    http://localhost:9000/           |
   |                                    |    chat-files/{uuid}.{ext}         |
   |                                    |                                    |
   |<-- 201 { fileUrl, fileType } ------|                                    |
   |                                    |                                    |
   | 7. Call handleSendMessage('', fileUrl, fileType)                        |
   |    which POST /api/messages with fileUrl attached                       |
   | 8. Message saved to PostgreSQL with file_url and file_type columns      |
   | 9. Socket event broadcast to other users with fileUrl in payload        |
```

### Storage Details

- **Bucket name**: `chat-files`
- **Bucket policy**: Public-read (any browser can GET files by URL without authentication)
- **File naming**: `{UUIDv4}.{original_extension}` -- guarantees uniqueness and preserves file type
- **Accepted types**: Images (`image/*`), PDFs, Office documents, text files, archives, spreadsheets
- **Storage location**: Docker volume `minio_data` mounted at `/data` inside the MinIO container
- **Access URL pattern**: `http://localhost:9000/chat-files/{filename}`

### MinIO Console

The MinIO admin dashboard is accessible at `http://localhost:9001` with credentials defined in `docker-compose.yml` (`minio_admin` / `minio_secret_password`). From here you can browse uploaded files, manage buckets, and monitor storage usage.

---

## 7. Authentication Flow

### Technology

Authentication uses **JSON Web Tokens (JWT)** with bcrypt password hashing. There is no session storage on the server -- the token itself carries the user's identity.

### Registration Flow

```
1. User submits username + password to POST /api/auth/register
2. Server validates:
   - Username: 3-50 characters
   - Password: minimum 6 characters
3. Password hashed with bcrypt (10 salt rounds)
4. New user row inserted into PostgreSQL with UUIDv4 primary key
5. Server returns 201 with user info (no token -- user must log in separately)
```

### Login Flow

```
1. User submits username + password to POST /api/auth/login
2. Server queries PostgreSQL for matching username
3. bcrypt.compare() verifies password against stored hash
4. On success, server signs a JWT:
   - Payload: { userId, username }
   - Secret: process.env.JWT_SECRET
   - Expiry: 7 days
5. Server returns { token, user: { id, username } }
6. Frontend stores token in localStorage under key 'token'
7. Frontend stores user object in localStorage under key 'chat_user'
8. AuthContext updates state: isAuthenticated = true
9. Axios interceptor attaches 'Authorization: Bearer {token}' to all future requests
```

### Token Verification (Every Protected Request)

```
1. Client sends HTTP request with header: Authorization: Bearer {token}
2. authMiddleware.js extracts the token from the header
3. jwt.verify() validates signature and expiry using JWT_SECRET
4. Decoded payload { userId, username } is attached to req.user
5. Request proceeds to the route handler
6. If verification fails: 401 Unauthorized response
```

### Session Persistence Across Page Reloads

```
1. User refreshes the page
2. AuthContext initializer reads localStorage for 'token' and 'chat_user'
3. If both exist, state is hydrated: isAuthenticated = true, user = storedUser
4. useEffect sets the Axios Authorization header from the stored token
5. ProtectedRoute checks isAuthenticated and renders Dashboard (no re-login needed)
6. Token expiry (7 days) is the only mechanism that forces re-authentication
```

### Logout Flow

```
1. User clicks logout button
2. AuthContext.logout() clears 'token' and 'chat_user' from localStorage
3. Axios Authorization header is removed
4. Socket.IO connection is disconnected
5. React Router redirects to /login
```

### Auto-Logout on 401

The Axios response interceptor watches for 401 status codes. If any API call returns 401 (expired or invalid token), the token is automatically removed from localStorage, and the next navigation check will redirect to the login page.

---

## 8. REST API Reference

All endpoints are prefixed with `/api` and served by the API Gateway on port 5001.

### Authentication (`/api/auth`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | No | Create a new user account |
| POST | `/auth/login` | No | Authenticate and receive a JWT |

### Users (`/api/users`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/users` | Yes | List all users except the current user |
| GET | `/users/me` | Yes | Get the current user's profile |
| PUT | `/users/me` | Yes | Update username and/or avatar_url |
| POST | `/users/block/:userId` | Yes | Block a user |
| POST | `/users/unblock/:userId` | Yes | Unblock a user |
| GET | `/users/blocked` | Yes | List IDs of all users blocked by the current user |

### Chats (`/api/chats`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/chats` | Yes | List all chats for the current user (with members, last message, unread count) |
| POST | `/chats` | Yes | Create a new 1:1 or group chat |
| PUT | `/chats/:chatId` | Yes | Update group name and/or avatar (admin only) |
| PUT | `/chats/:chatId/read` | Yes | Mark all messages in a chat as read |
| PUT | `/chats/:chatId/clear` | Yes | Clear chat from the current user's view |
| POST | `/chats/:chatId/members` | Yes | Add members to a group (admin only, with optional history sharing) |
| DELETE | `/chats/:chatId/members/:userId` | Yes | Remove a member from a group (admin only) |
| POST | `/chats/:chatId/leave` | Yes | Leave a group chat (non-admin members) |
| DELETE | `/chats/:chatId` | Yes | Delete a group chat and all its data (admin only) |

### Messages (`/api/messages`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/messages/:chatId` | Yes | Fetch all visible messages for a chat (respects `hide_history_before` and `left_at`) |
| POST | `/messages` | Yes | Send a new message (text and/or file attachment) |

### File Upload (`/api/upload`)

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/upload` | Yes | Upload a file (multipart/form-data). Returns `{ fileUrl, fileType }`. |

---

## 9. Environment Variables

All secrets are generated automatically by the setup script (see section 10). No credentials are hardcoded in `docker-compose.yml` -- it reads from the generated `chat-app-backend/.env` file via Docker Compose variable interpolation (`${VAR_NAME}` syntax).

### Frontend (`.env` in project root -- development only)

These variables are used by the Vite dev server on port 5173. They are not needed in production since the React app is compiled into the `frontend` Docker image at build time and all traffic goes through the proxy.

| Variable | Example Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `http://localhost:5001/api` | Base URL for REST API calls (dev server) |
| `VITE_SOCKET_URL` | `http://localhost:5002` | WebSocket server URL (dev server) |
| `VITE_MINIO_PUBLIC_URL` | `http://localhost:9000` | Public file access URL (dev server) |

### Backend (`chat-app-backend/.env` -- consumed by docker-compose.yml)

| Variable | Generated As | Consumed By | Description |
|---|---|---|---|
| `POSTGRES_USER` | `chatadmin` (static) | database, api-gateway | PostgreSQL superuser username |
| `POSTGRES_PASSWORD` | 64-char random hex | database, api-gateway | PostgreSQL superuser password |
| `POSTGRES_DB` | `chatdb` (static) | database, api-gateway | Database name created on first startup |
| `MINIO_ACCESS_KEY` | 20-char random hex | minio, api-gateway | MinIO root username / S3 access key |
| `MINIO_SECRET_KEY` | 64-char random hex | minio, api-gateway | MinIO root password / S3 secret key |
| `JWT_SECRET` | 64-char random hex | api-gateway | HMAC key for signing and verifying JWTs |
| `CORS_ORIGIN` | `https://localhost` | api-gateway, real-time-service | Allowed origin for CORS headers |
| `PUBLIC_FILE_BASE_URL` | `https://localhost/chat-files` | api-gateway | Base URL prefix for uploaded file URLs returned to clients |

### Hardcoded Service Values (set directly in `docker-compose.yml`)

These are infrastructure constants that do not need to be secret:

| Variable | Value | Container | Description |
|---|---|---|---|
| `DATABASE_HOST` | `database` | api-gateway | PostgreSQL hostname (Docker service name) |
| `DATABASE_PORT` | `5432` | api-gateway | PostgreSQL port |
| `MINIO_ENDPOINT` | `minio` | api-gateway | MinIO hostname (Docker service name) |
| `MINIO_PORT` | `9000` | api-gateway | MinIO API port |

---

## 10. Automated Setup Script

### Purpose

The `setup.js` script in the project root generates cryptographically secure secrets so that no credentials are ever hardcoded in source control. It uses only built-in Node.js modules (`crypto`, `fs`, `path`, `readline`) -- no `npm install` is needed to run it.

### Usage

```bash
node setup.js
cd chat-app-backend
docker compose up --build -d
```

### What It Does

1. Generates four cryptographic secrets using `crypto.randomBytes()`:
   - `POSTGRES_PASSWORD` -- 64-character hex string (32 random bytes)
   - `MINIO_ACCESS_KEY` -- 20-character hex string (10 random bytes)
   - `MINIO_SECRET_KEY` -- 64-character hex string (32 random bytes)
   - `JWT_SECRET` -- 64-character hex string (32 random bytes)

2. Writes two `.env` files:
   - **`chat-app-backend/.env`** -- Backend secrets, CORS origin, and file URL base consumed by `docker-compose.yml`
   - **`.env`** (project root) -- Frontend Vite dev server variables (URLs only, no secrets)

3. If either `.env` file already exists, prompts for confirmation before overwriting.

### Security Notes

- Both `.env` and `.env.backup` are listed in `.gitignore` and will never be committed.
- Re-running `setup.js` regenerates all secrets. If the database already has data, the `POSTGRES_PASSWORD` change will require resetting the Docker volume (`docker compose down -v`) or manually updating the PostgreSQL password.
