# CRC App – Request & Company Management System

Fullstack web app: **Node.js + Express** backend · **HTML/JS/CSS** frontend · **PostgreSQL** database.

Supports multi-language (vi/en/km/zh/my), role-based permissions, request approval workflows, notifications, and Docker deployment.

---

## 🚀 Quick Start (Docker — Recommended)

### Prerequisites
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running

### 1. Clone the repo
```bash
git clone https://github.com/leeanh1002/rqc_mps.git
cd rqc_mps
```

### 2. Configure environment
```bash
cp .env.example .env
# Edit .env with your credentials (see .env.example for all options)
```

### 3. Run with Docker Compose
```bash
docker compose up -d
```

App will be available at **http://localhost:5221**

> To stop: `docker compose down`

---

## 🛠️ Local Development (Without Docker)

### Prerequisites
- [Node.js](https://nodejs.org) v18+
- PostgreSQL instance (local or remote)

### 1. Install dependencies
```bash
npm install
```

### 2. Configure `.env`
```env
DATABASE_URL=postgres://crc_user:yourpassword@localhost:5432/crc_db
PORT=5221
JWT_SECRET=your_random_secret_here
```

### 3. Initialize database
```bash
psql -U crc_user -d crc_db -f init.sql
```

### 4. Run
```bash
npm start          # production
npm run dev        # dev mode with auto-reload
```

Open **http://localhost:5221** in your browser.

---

## 📁 Project Structure

```
CRC_app/
├── server/
│   ├── index.js                  ← Express entry point
│   ├── db.js                     ← PostgreSQL pool
│   ├── cron.js                   ← Scheduled jobs
│   ├── helpers/
│   │   ├── permissionHelper.js
│   │   ├── notificationHelper.js
│   │   ├── sseHelper.js
│   │   └── validation.js
│   └── routes/
│       ├── auth.js               ← Login / JWT
│       ├── actions.js            ← Workflow action rules
│       ├── dynamic_crud.js       ← Generic CRUD for all modules
│       ├── schema.js             ← Column/field schema
│       ├── permissions.js        ← Role-based column permissions
│       ├── myCompany.js          ← My Company module
│       ├── company.js            ← Company module
│       ├── department.js         ← Department module
│       ├── employee.js           ← Employee module
│       ├── contact.js            ← Contact module
│       ├── policy.js             ← Policy & Program module
│       ├── notifications.js      ← In-app notifications
│       ├── myViews.js            ← Saved user views
│       ├── systemSetup.js        ← System configuration
│       └── cmsSync.js            ← CMS data sync
├── public/
│   ├── index.html                ← Main SPA shell
│   ├── app.js                    ← Frontend logic
│   ├── config.js                 ← Module/field configuration
│   ├── style.css                 ← Styles
│   ├── i18n.js                   ← Internationalization
│   ├── notifications.js          ← Notification UI
│   ├── sw.js                     ← Service Worker (PWA)
│   └── locales/                  ← Translation files (vi/en/km/zh/my)
├── migrations/                   ← DB schema migrations
├── scripts/                      ← Utility scripts (db, deploy, import, seed)
├── docs/                         ← Documentation & guides
├── init.sql                      ← Full DB schema + seed data
├── docker-compose.yml            ← Standard Docker setup
├── docker-compose.standalone.yml ← Standalone (no external DB) setup
├── Dockerfile
├── .env.example                  ← Environment template
└── setup.sh / setup.ps1          ← One-click local setup scripts
```

---

## ⚙️ Environment Variables

| Variable | Description | Example |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgres://user:pass@host:5432/db` |
| `PORT` | App port | `5221` |
| `JWT_SECRET` | Secret for signing login tokens | `random_string_here` |
| `TUNNEL_TOKEN` | Cloudflare Tunnel token (optional) | `your_cf_token` |

See `.env.example` for full reference.

---

## 🐳 Deployment

For production deployment (VPS, Docker, multi-tenant), see [`docs/multi_tenant_deployment.md`](docs/multi_tenant_deployment.md).

---

## 📄 License

Internal use. Contact the repository owner for access.
