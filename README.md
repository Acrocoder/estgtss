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

## Install as a mobile app

The Vite build produces an installable PWA named **ESTG TSS**. The install banner appears only when the browser offers installation; on iPhone and iPad it provides Safari **Share → Add to Home Screen** steps. The app shell and static assets are precached. Student records and credentials are not cached, so attendance and other live data require the API, MySQL, and a network connection.

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

On Android, visit the HTTPS site in Chrome and choose **Install ESTG TSS App** when offered. On iPhone/iPad, open the HTTPS site in Safari, tap **Share**, then **Add to Home Screen**. Launch the new icon; the browser address bar is hidden when `display-mode: standalone` is active.

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

`server/server.js` contains the idempotent schema bootstrap. Back up the MySQL database regularly and use TLS and restricted database/network access for deployment. This local starter does not configure automated backups or production hosting.

## Features

- Student creation, search, editing, active/inactive status, and class placement validation.
- Student registration records **Internal/External** type and **Boarding/Day Scholar** accommodation. Only active internal boarders are included in attendance registers and attendance reports; external students and day scholars remain in the student directory and other student records.
- Global student search and student profiles with personal, attendance, permission, discipline, behaviour-point, and summary tabs.
- School structure: Levels 3–5; SOD classes A and B at all levels; ELET class A at Levels 3–4 and classes A and B at Level 5.
- Roll call with **Present**, **Absent**, **Late**, **Authorized Away**, and **Not Marked** statuses. Unmarked students are never counted as present. The register clearly reports when attendance has not been recorded; an all-unmarked class cannot be saved as attendance.
- Patron-submitted permission requests with administrator-only approval/rejection and recorded departure/return actions. Permission rows open the full request details and audit history, including actual return time.
- Behaviour awards and incident deductions with reasons and staff attribution. Patrons can request mark removals; administrators review and audit those requests.
- Student Life with two club descriptions and school-wide administrator posts. Published images and videos appear on the public sign-in page and Student Life; uploads are limited to 8 MB.
- English, Kinyarwanda, and French selectors for navigation/sign-in, plus a saved day/night appearance toggle.
- Attendance date-range reports, permission and behaviour views with CSV export and print support.
- Administrator, Patron, Authorized Approver, and Read-only Staff roles. Student/attendance/permission/behaviour write endpoints reject read-only accounts.
- Account holders can change their own password from Settings after confirming their current password; new passwords must be at least 12 characters.
- Audit entries for student changes, attendance changes, permission decisions, and behaviour transactions.

## REST API

All routes except `POST /api/auth/login` and `GET /api/school-life/posts` require a bearer token.

- `POST /api/auth/login`; `GET /api/auth/me`; authenticated `POST /api/auth/change-password`
- `GET /api/classes`
- Administrator only: `POST /api/classes`
- `GET/POST /api/students`; `PATCH /api/students/:id`; `GET /api/students/:id/profile`
- `GET/POST /api/attendance`
- `GET/POST /api/permissions`; permission creation is Patron-only, approval/rejection is Administrator-only; `POST /api/permissions/:id/{approve,reject,depart,return}`
- `GET/POST /api/behaviour`
- Patron only: `POST /api/behaviour/:kind/:id/removal-requests`
- Administrator only: `GET /api/behaviour/removal-requests`; `POST /api/behaviour/removal-requests/:id/{approve,reject}`
- `GET /api/school-life/posts`; Administrator only: `POST /api/school-life/posts` (image/video data URL, max 8 MB)
- `GET /api/dashboard?date=YYYY-MM-DD`
- Administrator only: `GET/POST /api/users`

## Validation

Run `npm run build` and `npm run lint` from the project directory.
