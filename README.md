# ESTG TSS School Patron System

A React and Express application for student registration, daily attendance, student permissions, behaviour records, and CSV reports. Records are stored in MySQL; the server initializes the application tables and the configured school classes when it starts.

## Requirements

- Node.js 20.19+ (or 22.12+) and npm
- MySQL 8+

## Run locally

1. Create a MySQL database and a database user with permission to create and update tables in that database.
2. Copy `.env.example` to `.env` and set the database credentials, a unique JWT secret, and a one-time administrator account. Use a secret password and do not commit `.env`.
3. Install packages with `npm install`.
4. Start the API in one terminal with `npm run server`.
5. Start the React app in a second terminal with `npm run dev`.
6. Open the URL printed by Vite and sign in with `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env`.

Teachers, class monitors, and students use separate **Request account** options on the sign-in screen. Student registration matches the student ID and full name against an active school record; teacher and monitor requests include class details. All three account types need administrator approval before they can sign in. Requests appear in the administrator's **Account Requests** page with Approve and Reject actions. Students can view only their own linked records.

In-app notifications are available to administrators. To also email the administrator when a request arrives, configure the SMTP settings below on the API host. Never commit real SMTP credentials. Until SMTP is configured, requests are still saved and visible in the administrator's account request list.

## Install as a mobile app

The Vite build produces an installable PWA named **ETG TSS**. The install banner appears only when the browser offers installation; on iPhone and iPad it provides Safari **Share → Add to Home Screen** steps. The app shell and static assets are precached. Authenticated API calls, records, and credentials are not cached, so attendance and other live data require the API, MySQL, and a network connection.

The home-screen icons are generated from the graduation-cap mark already used in the app interface. No official school logo asset was present in the project. Replace the two PNGs under `public/icons/` with approved school artwork if provided, keeping both required dimensions and filenames.

## Production build and deployment

1. Deploy the frontend build output from `dist/` to a static web host with HTTPS enabled. The PWA requires HTTPS in public deployments; `localhost` is suitable only for local testing.
2. Deploy the Express API and MySQL database separately to reachable hosting. Do not point the public app at `localhost`; configure `VITE_API_URL` to the public HTTPS API URL ending in `/api` before building.
3. Configure the API's `CLIENT_ORIGIN` with the exact HTTPS frontend origin and set production MySQL credentials and a unique `JWT_SECRET` on the API host. Do not place database secrets in frontend variables.
4. Rebuild and publish the generated assets whenever the frontend changes:

```sh
npm install
npm run build
npm run preview
```

`npm run preview` is for local production-build checks; it is not a public host. Configure the chosen frontend host to publish `dist/` at its site root; if deploying under a subpath, update the Vite base path, manifest `start_url`/`scope`, and service-worker paths together.

If the host requires SPA rewrites, send frontend navigation requests to `index.html`. When the API shares the same domain, route `/api/*` to Express before applying that fallback so API responses are never replaced by the frontend shell.

On Android, visit the HTTPS site in Chrome and choose **Install ETG TSS App** when offered. On iPhone/iPad, open the HTTPS site in Safari, tap **Share**, then **Add to Home Screen**. Launch the new icon; the browser address bar is hidden when `display-mode: standalone` is active.

The first server start creates the schema, seeds the currently configured level/trade/class combinations, and creates the initial administrator if that username does not already exist. The initial administrator password is hashed with bcrypt. The bootstrap account uses the configured `ADMIN_USERNAME` and `ADMIN_PASSWORD`; the bootstrap password must be at least 8 characters. This bootstrap-only minimum is weaker than the 12-character requirement for subsequently created accounts, so use a strong password before production. If you need to reset an existing bootstrap administrator's password, set `RESET_ADMIN_PASSWORD=true` alongside `ADMIN_USERNAME` and the new `ADMIN_PASSWORD`, deploy/restart the API once, then remove `RESET_ADMIN_PASSWORD` from the environment. After first startup, remove the bootstrap `ADMIN_PASSWORD` and `ADMIN_NAME` values from the environment; create further accounts through the authenticated admin user API.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PORT` | Express API port (default `4000`) |
| `CLIENT_ORIGIN` | Comma-separated allowed browser origins (defaults to localhost and 127.0.0.1 on port 5173) |
| `DB_HOST`, `DB_PORT` | MySQL host and port |
| `DB_NAME`, `DB_USER`, `DB_PASSWORD` | Existing database and application credentials |
| `JWT_SECRET` | Random secret of at least 32 characters used to sign 12-hour access tokens |
| `ADMIN_USERNAME`, `ADMIN_PASSWORD`, `ADMIN_NAME` | Optional first-run bootstrap administrator |
| `RESET_ADMIN_PASSWORD` | Set to `true` temporarily to reset the configured bootstrap administrator's password at startup |
| `VITE_API_URL` | API base URL for the frontend (default `https://estgtss-api.onrender.com/api`) |
| `ADMIN_NOTIFICATION_EMAIL` | Administrator email for new account-request alerts (defaults to `ADMIN_USERNAME`) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE` | SMTP server host, port (default `587`), and TLS mode (`true` to force TLS; port `465` uses TLS automatically) |
| `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM` | SMTP authentication and optional sender address; keep credentials private on the API host |

`server/server.js` contains the idempotent schema bootstrap. Back up the MySQL database regularly and use TLS and restricted database/network access for deployment. This local starter does not configure automated backups or production hosting.

## Features

- Student creation, search, editing, active/inactive status, and class placement validation.
- Student registration records **Internal/External** type and **Boarding/Day Scholar** accommodation. Only active internal boarders are included in attendance registers and attendance reports; external students and day scholars remain in the student directory and other student records.
- Global student search and student profiles with personal, attendance, permission, discipline, behaviour-point, and summary tabs.
- School structure: Levels 3–5; SOD classes A and B at all levels; ELET class A at Levels 3–4 and classes A and B at Level 5.
- Roll call with **Present**, **Absent**, **Late**, **Authorized Away**, and **Not Marked** statuses. Unmarked students are never counted as present. The register clearly reports when attendance has not been recorded; an all-unmarked class cannot be saved as attendance.
- Permission requests with role-restricted approval/rejection and recorded departure/return actions. Permission rows open the full request details and audit history, including actual return time.
- Behaviour awards and incident deductions with reasons and staff attribution.
- Attendance date-range reports, permission and behaviour views with CSV export and print support.
- Administrator, Patron, Authorized Approver, Read-only Staff, Teacher, Class Monitor, and Student roles. Student/attendance/permission/behaviour write endpoints reject read-only accounts.
- Separate teacher, class monitor, and student account requests; student accounts must match an active registered student ID and name. Administrator notifications, email alerts (when SMTP is configured), and Approve/Reject actions manage pending requests.
- Teachers can submit a subject assignment for each class they teach across Levels 3–5 and the SOD/ELET trades. Administrators approve assignments before teachers can submit class reports or access student records in that class. The administrator can suspend and restore a teacher account without deleting their audit history or submitted reports.
- Teachers and class monitors request accounts with their assigned class; monitor requests include the class mistress's name. Student accounts are limited to their own linked attendance, permission, behaviour, and report records.
- The public welcome page introduces Ecole secondaire Technique de Gisenyi, its technical trades, and the school portal. Authenticated sessions are kept in per-tab session storage; the API reloads the current active account and role from the database on each request.
- The public school website has linked Home, About, Trades, News, Gallery, Student Life, Clubs, Events, and Contact pages. The contact form delivers messages to the administrator's portal inbox; administrators can publish and remove school news under **School News**. News is stored in MySQL and shown on the public News page.
- The hero and gallery use original local SVG illustrations, so they do not depend on remote image hosts. Replace these illustrations with approved school photographs when available. The Instagram and X links currently lead to the platforms, not verified ESTG accounts.
- Class monitors record attendance as themselves or the class mistress and can explicitly submit the register to the administrator. Teachers and monitors submit daily subject/lesson reports; teachers can refer student behaviour concerns to the administrator.
- Permission approval creates a Kinyarwanda guardian message in the administrator's outbox when a guardian phone number is registered. The message is queued for review only; sending SMS requires a configured SMS gateway and credentials.
- Administrators can review or reject staff account requests and delete unnecessary daily reports. Account approvals, attendance, and report removals are auditable.
- Account holders can change their own password from Settings after confirming their current password; new passwords must be at least 12 characters.
- Audit entries for student changes, attendance changes, permission decisions, and behaviour transactions.

## REST API

All routes except `POST /api/auth/login` require a bearer token.

- `POST /api/auth/login`; `GET /api/auth/me`; authenticated `POST /api/auth/change-password`
- `GET /api/classes`
- Administrator only: `POST /api/classes`
- `GET/POST /api/students`; `PATCH /api/students/:id`; `GET /api/students/:id/profile`
- `GET/POST /api/attendance`
- `GET/POST /api/permissions`; `POST /api/permissions/:id/{approve,reject,depart,return}`
- `GET/POST /api/behaviour`
- `GET /api/dashboard?date=YYYY-MM-DD`
- `GET /api/public/classes`; `POST /api/auth/register` (teacher and class monitor account requests); `POST /api/auth/register/student` (student account request matched to an active student record)
- Public website: `GET /api/public/news`; `POST /api/public/contact`
- Administrator only: `POST/DELETE /api/admin/school-news`; `GET/PATCH/DELETE /api/admin/school-messages`
- Teacher only: `GET/POST /api/teacher/assignments`; `DELETE /api/teacher/assignments/:id`
- Administrator only: `GET /api/admin/teacher-assignments`; `PATCH /api/admin/teacher-assignments/:id/approval`; `PATCH /api/users/:id/status` (suspend/restore approved teacher accounts)
- `GET/POST /api/reports`; Administrator only: `DELETE /api/reports/:id`
- Administrator only: `GET/POST /api/users`; `GET /api/admin/notifications`; `PATCH /api/users/:id/approval`

## Validation

Run `npm run build` and `npm run lint` from the project directory.
