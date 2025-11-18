## pcIST Backend — Tech Highlights (CV-ready)

- Purpose: Backend for pcIST club — auth/membership, event registration (solo/team) with payment tracking, branded PAD statements & invoices as PDFs, push notifications, and real-time group chat.
- Core stack: Node.js (Express 5), MongoDB (Mongoose), JWT auth, Socket.IO (websocket chat).
- PDF generation: Puppeteer(-core) + pdf-lib for A4, logo/serial/date stamping, signature layout; Cloudinary upload; email/download endpoints.
- Media & storage: Cloudinary (images, PDFs as raw), Multer memory storage, Sharp image compression.
- Notifications: Firebase Admin (FCM) — topic/device push (notify all / single).
- Emailing: Nodemailer (Gmail SMTP) — OTP, password recovery, PAD/invoice attachments.
- Scheduling: Agenda (Mongo-backed jobs) — auto-expire membership after duration.
- Events: CRUD, gallery uploads, membership-gated registration, solo/team rosters, payment status updates, participation history on user.
- Security/utilities: bcryptjs, validator, slugify, cors, dotenv; axios + streamifier for signed Cloudinary downloads.
- Deployment: Heroku-compatible headless Chrome flags; Vercel `@vercel/node` routing for `server.js`.
