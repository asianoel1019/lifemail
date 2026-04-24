# LifeMail Project

LifeMail is a professional, high-end, and fully containerized mail server solution. It features a stunning web interface that rivals modern SaaS platforms, combined with a robust **Postfix + Dovecot** backend. 

Designed for ease of deployment and rich user experience, LifeMail provides a seamless transition to hosting your own private email ecosystem.

---

## 🚀 Getting Started

### 1. Initialization
Run the setup script to prepare the directory structure (no host-side Node.js required):
```bash
cd lifemail/
bash setup.sh
```

### 2. Launching Services
Start the entire stack using Docker Compose:
```bash
docker-compose up -d --build
```
> [!NOTE]
> The initial boot takes a few minutes to generate self-signed certificates and initialize the cryptographic database.

### 3. Management Access
Initially, use the **Admin Console** to configure your domain and users:
1. Open [http://localhost:3000](http://localhost:3000).
2. Click **"Admin Console"** on the login screen.
3. Login with default credentials: `admin` / `admin123`.
4. Go to **System Setting** to set your `@defaultDomain`.
5. Go to **Accounts** to provision your first user.

---

## ✨ Advanced Features

### 📬 Premium Webmail Experience
- **Dynamic Folders**: Full IMAP folder tree support. Create and manage custom folders directly from the sidebar.
- **Drag & Drop**: Move emails between folders (e.g., from Inbox to a custom project folder) with native drag-and-drop.
- **Global Starred Search**: A unified "Starred" view that aggregates flagged emails across ALL folders in your account.
- **Attachment Support**: Seamlessly view and download attachments directly to your device.
- **Rich Themes**: Support for multiple premium themes (Cartoon, Serious, Forest, Minimalist) with **server-side persistence** (your theme follows you to any device).

### 🛠️ System Administration
- **Centralized Config**: Manage the system-wide `@domain` setting from a dedicated System Setting panel.
- **User CRUD**: Full Create, Read, Update, and Delete operations for mail accounts.
- **Persistence Layer**: All mail data, account configurations, and user metadata are persisted via Docker volumes.

---

## 🏗️ Technical Architecture

- **Frontend**: React (Vite) + Framer Motion + Lucide Icons + Tailwind-inspired Custom CSS.
- **Backend**: Node.js + Express + `imapflow` (Advanced IMAP client) + `nodemailer` (SMTP).
- **Mail Engine**: `docker-mailserver` (The gold standard for self-hosted mail).
- **Data Store**: 
  - Mail Data: `/lifemail/config/dms/mail-data`
  - Account Config: `/lifemail/config/dms/mail-config`
  - App Metadata: `/lifemail/backend/lifemail-metadata.json`

---

## ✅ System Status

| Component | Status | Capability |
| :--- | :--- | :--- |
| **Mail Engine** | ✅ Online | SMTP (587) / IMAP (143) Active. |
| **Backend API** | ✅ Ready | Real-time proxying & Metadata Sync. |
| **Frontend UI** | ✅ Live | Multi-theme support & Dynamic D&D. |
| **Persistence** | ✅ Verified | Automatic volume recovery on reboot. |

---
*Developed by Antigravity - Modernizing the Self-Hosted Web.*
