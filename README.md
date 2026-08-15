# Armour Care

A wellbeing survey platform deployed as a Progressive Web App (PWA) at [armourcare.uk](https://armourcare.uk). Users complete a monthly psychology questionnaire; admins monitor team wellbeing through a dashboard with per-team and per-sub-team breakdowns.

**Last updated:** August 2026

---

## Live URLs

| URL | Purpose |
| --- | --- |
| https://armourcare.uk | Main app (user signup, login, questionnaire) |
| https://armourcare.uk/admin.html | Admin portal |

---

## Tech Stack

- **Backend:** Node.js (plain `http` module, no framework) — `server.js`
- **Frontend:** Vanilla JS/HTML/CSS PWA — `index.html` + `app.js` (user app), `admin.html` + `admin.js` (admin portal)
- **Storage:** Flat JSON files on the server (no database)
- **Auth:** bcrypt password hashing + JWT bearer tokens (7-day expiry)
- **Push notifications:** Web Push (VAPID) via `web-push`
- **Hosting:** VPS (`172.237.111.103`), Nginx reverse proxy with Let's Encrypt TLS, Node app on port 8000 managed by systemd (`armourcare.service`)

### Dependencies

```
bcryptjs, jsonwebtoken, web-push
```

---

## Project Structure

```
server.js          Node HTTP server: all API endpoints, auth, data access
index.html         User app shell (signup/login, questionnaire, personal stats)
app.js             User app logic
styles.css         User app styles
admin.html         Admin portal shell
admin.js           Admin portal logic (dashboard, users, submissions, questions,
                   notifications, security logs, admin management)
admin.css          Admin portal styles
sw.js              Service worker (PWA)
manifest.json      PWA manifest
deploy.sh          Deployment script (see Deployment below)
start.sh           Server start script
SECURITY.md        Security documentation
backups/           Local backups of server data files
```

### Data files (server-side, source of truth at `/opt/armourcare/`)

| File | Contents |
| --- | --- |
| `users.json` | Registered users (armour number, team, sub-team, bcrypt hash, nickname) |
| `admins.json` | Admin accounts (teams/sub-team scopes, permissions, master flag) |
| `submissions.json` | Questionnaire submissions keyed by month, then armour number |
| `questions.json` | Questionnaire definition (categories, questions, response presets) |
| `notifications.json` | Notification history |
| `push-subscriptions.json` | Web Push subscriptions per user |
| `auto-notif-config.json` | Automated notification schedule config |
| `security-log.json` | Security event log (logins, admin actions, etc.) |

---

## Teams and Sub-Teams

- There are **14 teams** (`1`–`14`).
- **Team 2 has 10 sub-teams** (`a`–`j`, displayed as **2A–2J**). All other teams are flat.
- Users signing up for team 2 must pick a sub-team. Users in team 2 without one show as **Unassigned**; admins can assign them from the Users page.
- Submissions record the user's team and sub-team at submission time.
- The dashboard shows one aggregate Team 2 row plus indented per-sub-team breakdown rows.

---

## Roles and Permissions

| Role | Access |
| --- | --- |
| **User** | Submit surveys, view own team stats, manage push subscription |
| **Sub-Admin** | Dashboard, users, and submissions for assigned scopes. Question Builder / Notifications / Security tabs gated by per-admin permission flags |
| **Master Admin** | Everything, including admin management and question editing |

### Admin team scoping (`teams` array in `admins.json`)

| Entry | Grants |
| --- | --- |
| `"all"` | Every team |
| `"5"` | All of team 5 |
| `"2"` | All of team 2, including every sub-team |
| `"2:a"` | Only sub-team 2A |

Scopes can be combined, e.g. `["3", "2:a", "2:b"]`.

---

## API Overview

### Public / user endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/signup` | POST | Register (requires `subTeam` when `team` is `"2"`) |
| `/api/login` | POST | User login, returns JWT |
| `/api/generate-armour` | GET | Generate an unused armour number |
| `/api/submit` | POST | Submit monthly questionnaire |
| `/api/team-stats` | GET | Team wellbeing stats |
| `/api/submission-status` | GET | Current month submission status |
| `/api/vapid-public-key` | GET | Web Push public key |
| `/api/push-subscribe` | POST | Save push subscription |

### Admin endpoints (JWT bearer token required)

| Endpoint | Methods | Purpose |
| --- | --- | --- |
| `/api/admin/login` | POST | Admin login |
| `/api/admin/admins` | GET/POST/PUT/DELETE | Manage admins (master only) |
| `/api/admin/change-password` | POST | Change own/another admin's password |
| `/api/admin/users` | GET/PUT/DELETE | List users, edit nickname/sub-team, delete |
| `/api/admin/submissions` | GET/DELETE | View submissions, reset a submission |
| `/api/admin/stats` | GET | Dashboard stats incl. `teamStats` and `subTeamStats` |
| `/api/admin/questions` | GET/PUT | View / edit questionnaire (edit is master only) |
| `/api/admin/notifications` | GET/POST/DELETE | Send and manage notifications |
| `/api/admin/auto-notif-config` | GET/POST | Automated notification schedule |
| `/api/admin/security-logs` | GET/DELETE | Security event log (master or `security` permission) |

---

## Running Locally

```bash
npm install
npm start          # or: node server.js
```

The server runs at `http://localhost:8000` (port is fixed in `server.js`). It reads/writes the JSON data files in the project root — note these are local copies synced from the server on each deploy.

---

## Deployment

```bash
./deploy.sh
```

The script:

1. Backs up local `questions.json`, `users.json`, `admins.json` to `backups/`
2. Copies application files (code only, not data) to the VPS at `/opt/armourcare/`
3. Initialises any missing data files on the server and runs `npm install`
4. Installs/refreshes the systemd service and restarts the app
5. **Pulls the server's data files back down** — the server is the source of truth for data
6. Prints QR codes for the app and admin portal

### Useful server commands

```bash
ssh root@172.237.111.103 'systemctl status armourcare'   # check status
ssh root@172.237.111.103 'systemctl restart armourcare'  # restart app
ssh root@172.237.111.103 'journalctl -u armourcare -f'   # tail logs
```

### Backing up all server data manually

```bash
mkdir -p backups/server_$(date +"%Y%m%d_%H%M%S") && \
scp "root@172.237.111.103:/opt/armourcare/*.json" backups/server_<timestamp>/
```

---

## Security

See [SECURITY.md](SECURITY.md) for full details. Highlights:

- bcrypt (cost 12) password hashing with automatic migration from legacy SHA-256 hashes on login
- JWT bearer tokens for all authenticated endpoints (7-day expiry, secret persisted in `.jwt-secret`)
- Rate limiting on login endpoints (10 attempts/minute per IP)
- CORS restricted to `armourcare.uk` and localhost
- Security headers (HSTS, X-Frame-Options, nosniff, etc.) on all responses
- Path traversal protection on static file serving
- Security event logging viewable in the admin portal
</CodeContent>
<parameter name="EmptyFile">false
