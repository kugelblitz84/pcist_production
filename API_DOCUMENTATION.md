# pcIST Backend API Documentation

> All routes below are mounted under these base paths:
> - Users / PAD / Invoice: `GET/POST /api/v1/user/...`
> - Events: `GET/POST /api/v1/event/...`
> - Notifications (FCM): `POST /api/v1/notification/...`
> - Chat: `POST /api/v1/chat/...`
> - Proctor tools (role + exam management): `POST /api/v1/proctor/...` (router defined in `routes/proctorRouter.js`; mount it in `app.js` to expose these endpoints)

JWT payload shape:

```ts
interface JwtPayload {
  id: string;          // MongoDB ObjectId of user
  classroll: number;   // e.g. 123456
  email: string;       // Gmail only for members
  role: 1 | 2 | 3;     // 1 = member, 2 = admin, 3 = proctor
}
```

Unless otherwise mentioned:
- Request/response content-type is `application/json`.
- Every route defined in `routes/*.js` passes through `middlewares/validateRequest.js`, so payloads must satisfy the referenced Zod schema exactly (types + optionality).
- Authenticated routes expect header: `Authorization: Bearer <jwt_token>`.

---

## 1. User & Auth APIs (`/api/v1/user`)

### 1.1 Register member

`POST /api/v1/user/register`

**Body**

```ts
{
  classroll: number;          // required, unique
  email: string;              // required, must end with "@gmail.com"
  password: string;           // required, min length 8
}
```

**Response (200)**

```ts
{
  status: boolean;
  message: string;
  token?: string;             // JWT for member
  slug?: string;              // stringified classroll, unique
}
```

### 1.2 Login (member)

`POST /api/v1/user/login`

**Body**

```ts
{
  classroll: number;
  password: string;
}
```

**Response (200)**

```ts
{
  status: boolean;
  message: string;
  token?: string;   // JWT with role=1 or 2
  slug?: string;
}
```

### 1.3 Super-admin login (panel)

`POST /api/v1/user/super-admin`

**Body**

```ts
{
  email: string;    // must match ENV ADMIN_EMAIL
  password: string; // must match ENV ADMIN_PASSWORD
}
```

**Response (200)**

```ts
{
  status: boolean;
  token?: string;   // separate admin panel token
  message?: string;
}
```

### 1.4 Auth middleware contract

Most protected routes use one of the following middlewares:

- `auth` (member): requires JWT + the caller's `slug`; validates `decoded.email === user.email` and attaches `req.user`.
- `adminAuth` (admin): requires JWT + `slug`; validates `decoded.email === user.email && decoded.role === 2`.
- `proctorAuth` (proctor-only): same token requirement but enforces `decoded.role === 3`.

**Supplying the slug**

- Prefer to keep `slug` inside the JSON body when the route already accepts a body (all POST/PUT payloads shown below do this).
- For GET/DELETE requests or any multipart uploads where the JSON body is not available, pass the slug as either `?slug=<user-slug>` or a header: `x-user-slug: <user-slug>` (alias `x-slug`).
- `proctorAuth` currently reads `slug` only from the JSON body, so include it there when hitting `/api/v1/proctor/setExam`.

**Headers (member/admin/proctor)**

```http
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

### 1.5 Send email verification code (member)

`POST /api/v1/user/send-verification-email`

**Headers**: `Authorization` (member JWT)

**Body**

```ts
{
  slug: string;  // required, user's slug
}
```

**Response (200)**

```ts
{
  code: 200;
  status: true;
  message: string; // "Verification code sent successfully"
}
```

### 1.6 Verify user email

`POST /api/v1/user/verify-user`

**Headers**: `Authorization` (member JWT)

**Body**

```ts
{
  slug: string;      // required
  code: string;      // 6‑digit verification code
}
```

**Response (200)**

```ts
{
  code: 200;
  status: true;
  message: string; // "User verified successfully"
}
```

### 1.7 Send forgot-password code

`POST /api/v1/user/send-forgot-password-email`

**Body**

```ts
{
  email: string; // member's registered email
}
```

**Response**: standard success/error JSON.

### 1.8 Recover password

`POST /api/v1/user/recover-password`

**Body**

```ts
{
  email: string;
  code: string;        // OTP from email
  password: string;    // new password, min 8 chars
}
```

### 1.9 Update profile (member)

`PUT /api/v1/user/update-profile`

**Headers**: `Authorization` (member JWT)

**Body**

```ts
{
  slug: string;          // required, to resolve user via auth middleware
  name?: string;
  phone?: string;
  gender?: string;       // e.g. "Male" | "Female" | ...
  tshirt?: string;       // e.g. "S" | "M" | "L" ...
  batch?: number;
  dept?: string;         // department
  cfhandle?: string;     // Codeforces handle
  atchandle?: string;    // AtCoder handle
  cchandle?: string;     // CodeChef handle
}
```

### 1.10 Get user data by slug

`POST /api/v1/user/get-user-data`

**Body**

```ts
{
  slug: string;  // required
}
```

**Response (200)** – user document (password & sensitive fields stripped):

```ts
interface UserData {
  _id: string;
  classroll: number;
  email: string;
  name?: string;
  phone?: string;
  gender?: string;
  tshirt?: string;
  batch?: number;
  dept?: string;
  role: 1 | 2 | 3;
  membership: boolean;
  membershipExpiresAt: string | null; // ISO date
  cfhandle?: string;
  atchandle?: string;
  cchandle?: string;
  myParticipations?: {
    solo: { eventId: string; eventName: string }[];
    team: { eventId: string; eventName: string }[];
  };
}
```

### 1.11 Get user list (admin)

`POST /api/v1/user/get-user-list`

**Headers**: `Authorization` (admin JWT)

**Body**

```ts
{
  slug: string; // admin's slug, for adminAuth
}
```

**Response (200)**

```ts
{
  success: true;
  data: Array<{
    _id: string;
    name?: string;
    role: 1 | 2;
    slug: string;
    email: string;
    membership: boolean;
    membershipExpiresAt: string | null;
  }>;
}
```

### 1.12 Update membership status (admin)

`POST /api/v1/user/update-membership-status/:id`

**Path params**

- `id: string` – target user MongoDB `_id`.

**Headers**: `Authorization` (admin JWT)

**Body**

```ts
{
  slug: string;            // admin slug, required by adminAuth
  membership: boolean;     // true to enable, false to disable
  durationInMonths?: 1|2|3 // required when membership === true
}
```

**Notes**
- When enabling membership, an Agenda job is scheduled to auto-expire at `membershipExpiresAt`.

---

## 2. Event APIs (`/api/v1/event`)

### 2.1 Create event (admin)

`POST /api/v1/event/add_event`

**Headers**

```http
Authorization: Bearer <admin_jwt>
Content-Type: multipart/form-data
```

**Form fields**

```ts
eventName: string;            // required
eventType: "solo" | "team"; // required
date: string;                 // ISO date
registrationDeadline: string; // ISO date
location?: string;
description?: string;
needMembership: boolean;      // "true" | "false" in form-data
images: File[];               // up to 30 images, image/*
slug: string;                 // admin slug (for adminAuth)
```

### 2.2 Get all events

`GET /api/v1/event/get_all_event`

**Response (200)**

```ts
{
  message: string; // "All current events"
  soloEvents: SoloEvent[];
  teamEvents: TeamEvent[];
}

interface RegisteredMember {
  userId: string;
  classroll?: number;
  Name?: string;
  paymentStatus?: boolean;
}

interface SoloEvent {
  _id: string;
  eventName: string;
  date: string;                 // ISO
  registrationDeadline: string; // ISO
  location?: string;
  description?: string;
  images: { url: string; publicId: string }[];
  needMembership: boolean;
  registeredMembers: RegisteredMember[];
}

interface TeamEvent {
  _id: string;
  eventName: string;
  date: string;
  registrationDeadline: string;
  location?: string;
  description?: string;
  images: { url: string; publicId: string }[];
  needMembership: boolean;
  registeredTeams: Array<{
    teamName: string;
    members: RegisteredMember[];
  }>;
}
```

### 2.3 Get single event by id

`GET /api/v1/event/get_one_event/:id`

**Response (200)**

```ts
{
  eventType: "solo" | "team";
  message: string; // "Event found"
  data: SoloEvent | TeamEvent;
}
```

### 2.4 Update event (admin)

`PUT /api/v1/event/update_event/:id`

**Headers**: `Authorization` (admin JWT)

**Body (all optional)**

```ts
{
  slug: string;               // admin slug
  eventName?: string;
  date?: string;              // ISO
  description?: string;
  location?: string;
  registrationDeadline?: string; // ISO
}
```

### 2.5 Delete event (admin)

`POST /api/v1/event/delete_event/:id`

**Headers**: `Authorization` (admin JWT)

**Body**

```ts
{
  slug: string; // admin slug
}
```

### 2.6 Upload gallery images (admin)

`POST /api/v1/event/upload_images_to_gallery`

**Headers**

```http
Authorization: Bearer <admin_jwt>
Content-Type: multipart/form-data
```

**Form fields**

```ts
slug: string;   // admin slug
images: File[]; // image/*
```

### 2.7 Fetch gallery images

`GET /api/v1/event/fetch_gallery_images`

**Response (200)**

```ts
{
  message: string;
  images: { url: string; publicId: string }[];
}
```

### 2.8 Register for solo event (member)

`POST /api/v1/event/register_for_solo_event/:id`

**Headers**

```http
Authorization: Bearer <member_jwt>
Content-Type: application/json
```

**Body**

```ts
{
  slug: string; // member slug (required by auth middleware)
  Name: string; // display name for registration
}
```

**Membership rules**
- If `event.needMembership === true`, user must have `membership === true` and non-expired `membershipExpiresAt`.

### 2.9 Register for team event (member)

`POST /api/v1/event/register_for_team_event/:id`

**Headers**: same as solo registration.

**Body**

```ts
{
  slug: string;          // calling user's slug
  teamName: string;      // unique per event
  members: string[];     // array of member Gmail addresses
}
```

**Validation**
- All emails must correspond to existing users.
- If event requires membership, every member must have valid (non‑expired) membership.
- A user cannot join more than one team for the same event.

### 2.10 Get registered teams (for a team event)

`GET /api/v1/event/get_registered_teams/:id`

**Response**

```ts
{
  teams: TeamEvent["registeredTeams"];
}
```

### 2.11 Get registered members (for a solo event)

`GET /api/v1/event/get_registered_members/:id`

**Response**

```ts
{
  registeredMembers: RegisteredMember[];
}
```

### 2.12 Update payment status (admin)

`POST /api/v1/event/update_payment/:id`

Used to mark one or more participants as paid/unpaid and sync `user.myParticipations`.

**Headers**: `Authorization` (admin JWT)

**Body**

```ts
{
  slug: string; // admin slug
  members: Array<
    string |                                   // userId
    { userId?: string; classroll?: number; status?: boolean }
  >;
  paymentStatus?: boolean; // optional global status override
}
```

Rules:
- If `paymentStatus` is provided, all targeted members are set to that boolean.
- Otherwise each member object must include its own `status`.
- When a member's status becomes `true`, a participation record is added to the user's `myParticipations.solo` or `myParticipations.team` for that event.

---

## 3. PAD Statement APIs (`/api/v1/user/pad`)

All PAD routes are admin-only and protected with `adminAuth`. POST routes already include `slug` in their JSON bodies; for the GET downloads/history endpoints add `?slug=<admin-slug>` or send `x-user-slug: <admin-slug>` so the middleware can locate the caller.

### 3.1 Send PAD statement email

`POST /api/v1/user/pad/send`

**Headers**

```http
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

**Body**

```ts
{
  slug: string;              // admin slug
  receiverEmail: string;     // required
  subject?: string;          // default: "pcIST Statement"
  statement: string;         // required plain text
  authorizers?: Array<{
    name: string;
    role: string;
  }>;                        // 0–3 items, controls signature block
  contactEmail?: string;
  contactPhone?: string;
  address?: string;          // default: "Institute of Science & Technology (IST), Dhaka"
}
```

**Response (200)**

```ts
{
  success: true;
  message: string;  // "Statement email sent"
  serial: string;   // e.g. "pcIST-2025-0001"
  date: string;     // e.g. "02 September 2025"
  id: string;       // PadStatement _id
}
```

### 3.2 Generate & download PAD PDF from uploaded PDF

`POST /api/v1/user/pad/download`

**Headers**

```http
Authorization: Bearer <admin_jwt>
Content-Type: multipart/form-data
```

**Form-data fields**

```ts
slug: string;                 // admin slug
statementPdf: File;           // required, application/pdf
authorizers?: string | string[]; // JSON array or array of JSON strings
contactEmail?: string;
contactPhone?: string;
address?: string;
```

`authorizers` must be an array of:

```ts
{
  name: string;
  role: string;
}
```

**Response**
- `Content-Type: application/pdf`
- `Content-Disposition: attachment; filename="pcIST-YYYY-XXXX.pdf"`
- Body: PDF buffer.

### 3.3 Download PAD PDF by history id

`GET /api/v1/user/pad/download/:id`

**Headers**: `Authorization` (admin JWT)

Response is a PDF download. If the original PDF is missing in Cloudinary, it will be regenerated from stored statement data.

### 3.4 List PAD history

`GET /api/v1/user/pad/history`

**Headers**: `Authorization` (admin JWT)

**Response**

```ts
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    receiverEmail?: string;
    subject: string;
    statement?: string | null;
    authorizers: { name: string; role: string }[];
    contactEmail?: string;
    contactPhone?: string;
    address?: string;
    serial?: string;
    dateStr?: string;
    sent: boolean;
    sentAt?: string;
    downloadedAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

---

## 4. Invoice APIs (`/api/v1/user/invoice`)

All invoice routes are admin-only and require `adminAuth`. Provide `slug` in the JSON body for POST routes and via query/header for the GET endpoints.

Shared product shape:

```ts
interface InvoiceProductInput {
  description: string;
  quantity?: number;   // default 1
  unitPrice: number;   // per-unit price
}
```

### 4.1 Send invoice via email

`POST /api/v1/user/invoice/send`

**Headers**

```http
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

**Body**

```ts
{
  slug: string;                 // admin slug
  receiverEmail: string;        // required
  subject?: string;             // default: "Invoice from pcIST"
  products: InvoiceProductInput[]; // at least 1 item
  authorizerName?: string;
  authorizerDesignation?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}
```

**Response (200)**

```ts
{
  success: true;
  message: string;   // "Invoice email sent successfully"
  invoiceId: string; // Invoice _id
  serial: string;    // e.g. "INV-2025-0001"
  issueDate: string; // formatted (e.g. "02 September 2025")
  total: number;     // grand total
}
```

### 4.2 Download invoice (generate new record)

`POST /api/v1/user/invoice/download`

Same headers as 4.1.

**Body** – same structure as send, but without `receiverEmail`:

```ts
{
  slug: string;                 // admin slug
  products: InvoiceProductInput[];
  authorizerName?: string;
  authorizerDesignation?: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}
```

**Response**: PDF download (`Content-Type: application/pdf`).

### 4.3 Download invoice by id

`GET /api/v1/user/invoice/download/:id`

**Headers**: `Authorization` (admin JWT)

Regenerates invoice PDF from stored DB record and returns a PDF download.

### 4.4 List invoice history

`GET /api/v1/user/invoice/history`

**Headers**: `Authorization` (admin JWT)

**Response**

```ts
{
  success: true;
  count: number;
  data: Array<{
    _id: string;
    serial: string;
    products: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
    }>;
    grandTotal: number;
    authorizerName?: string;
    authorizerDesignation?: string;
    contactEmail?: string;
    contactPhone?: string;
    address: string;
    issueDate: string;  // ISO
    dateStr: string;    // human-readable
    sentViaEmail: boolean;
    sentAt?: string;
    downloadedAt?: string;
    createdAt: string;
    updatedAt: string;
  }>;
}
```

---

## 5. Notification APIs (Firebase FCM) (`/api/v1/notification`)

All notification endpoints are admin-protected.

### 5.1 Notify all users (topic broadcast)

`POST /api/v1/notification/notify_all_users`

**Headers**

```http
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

**Body**

```ts
{
  slug: string; // admin slug
  title: string;
  message: string;
}
```

### 5.2 Notify a single device

`POST /api/v1/notification/notify_one/:token`

**Path params**

- `token: string` – FCM registration token.

**Headers**: same as above.

**Body**

```ts
{
  slug: string; // admin slug
  title: string;
  message: string;
}
```

---

## 6. Chat APIs (`/api/v1/chat` + Socket.IO)

### 6.1 HTTP: get chat messages (admin)

`POST /api/v1/chat/get_chat_messages`

**Headers**

```http
Authorization: Bearer <admin_jwt>
Content-Type: application/json
```

**Body**

```ts
{
  slug: string;     // admin slug
  limit?: number;   // default 20
  skip?: number;    // default 0
}
```

**Response** – newest first:

```ts
Array<{
  _id: string;
  senderId: string;   // user ObjectId
  text: string;
  senderName: string;
  sentAt: string;     // ISO
}>
```

### 6.2 Realtime: Socket.IO chat

Socket.io server is attached to the same HTTP server.

- Connect to: `ws://<base-url>` (Socket.IO v4 client).
- On connection, server logs `User connected: <socket.id>`.
- Client should emit:

```ts
socket.emit("message", JSON.stringify({
  senderId: string;    // user ObjectId
  text: string;
  senderName: string;
  sentAt?: number;     // optional timestamp (ms)
}));
```

- Server persists the message to MongoDB and broadcasts to all other clients as a `"message"` event with the same JSON payload.

---

## 7. Error format & common status codes

Most controllers return JSON on error similar to:

```ts
{
  status?: boolean;   // often false
  success?: boolean;  // often false
  code?: number;      // mirrors HTTP status where used
  message: string;    // human-readable
}
```

Common HTTP statuses:
- `400` – validation / bad input
- `401` – missing or invalid token
- `403` – not enough permissions (e.g., non-member, non-admin)
- `404` – resource not found
- `500` – internal server error

---

## 8. Proctor APIs (`/api/v1/proctor`)

> Routes live in `routes/proctorRouter.js`. Mount them in `app.js` via `app.use('/api/v1/proctor', proctorRouter)` before deploying.

### 8.1 Promote a user to proctor (admin-only)

`POST /api/v1/proctor/setProctor/:userId`

**Path params**

- `userId: string` – MongoDB `_id` of the target member.

**Headers**

```http
Authorization: Bearer <admin_jwt>
```

Since the route body is empty, include the admin slug as `?slug=<admin-slug>` or header `x-user-slug: <admin-slug>` so `adminAuth` can authorize the call.

**Response (200)**

```ts
{
  message: "User role updated to proctor"
}
```

### 8.2 Create an exam (proctor-only)

`POST /api/v1/proctor/setExam`

**Headers**

```http
Authorization: Bearer <proctor_jwt>
Content-Type: application/json
```

`proctorAuth` expects the caller's slug inside the JSON body for now.

**Body**

```ts
{
  slug: string;                 // required, identifies the proctor
  title: string;                // required
  description?: string;
  date: string;                 // ISO date
  time: string;                 // e.g. "10:00 AM"
  duration: number;             // minutes
  totalMarks: number;           // exam total
  questions: Array<{
    questionText: string;
    options: string[];          // at least one entry
    correctOptionIndex: number; // zero-based index into options
    marks: number;
  }>;
}
```

**Response (201)**

```ts
{
  message: "Exam created successfully",
  exam: ExamDocument;
}
```

`ExamDocument` mirrors `models/examModel.js`, including timestamps and a `proctor` ObjectId that points to the authenticated proctor.

---

This document reflects the current codebase (routes, controllers, middlewares, and models) so frontend clients can integrate safely using the exact paths, headers, and payload types described above.
