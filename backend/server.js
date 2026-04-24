const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const net = require('net');
const { ImapFlow } = require('imapflow');
const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { simpleParser } = require('mailparser');
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3001;
const JWT_SECRET = process.env.JWT_SECRET || 'supersecret';
const DMS_CONFIG_PATH = '/tmp/docker-mailserver'; // Mounted volume
const METADATA_PATH = path.join(DMS_CONFIG_PATH, 'lifemail-metadata.json');
const DEFAULT_DOMAIN = 'asianoel.space';

const normalizeEmail = (email) => {
  if (!email || typeof email !== 'string') return email;
  if (email === 'admin') return email;
  const config = metadata.getConfig();
  return email.includes('@') ? email : `${email}@${config.defaultDomain}`;
};

app.use(cors());
app.use(bodyParser.json());

// --- Metadata Helper ---
const metadata = {
  load: () => {
    if (!fs.existsSync(METADATA_PATH)) return { users: {}, config: { defaultDomain: 'asianoel.space' } };
    try {
      const content = fs.readFileSync(METADATA_PATH, 'utf8');
      if (!content.trim()) return { users: {}, config: { defaultDomain: 'asianoel.space' } };
      return JSON.parse(content);
    } catch (e) {
      console.error('Metadata Load Error:', e);
      return { users: {}, config: { defaultDomain: 'asianoel.space' } };
    }
  },
  save: (data) => {
    fs.writeFileSync(METADATA_PATH, JSON.stringify(data, null, 2));
  },
  getUser: (email) => {
    const data = metadata.load();
    return data.users[email] || { role: 'user', theme: 'serious', quota: 10 };
  },
  updateUser: (email, updates) => {
    const data = metadata.load();
    data.users[email] = { ...(data.users[email] || { role: 'user', theme: 'serious', signature: '', quota: 10 }), ...updates };
    metadata.save(data);
  },
  getConfig: () => {
    const data = metadata.load();
    return data.config || { defaultDomain: 'asianoel.space' };
  },
  updateConfig: (updates) => {
    const data = metadata.load();
    data.config = { ...(data.config || { defaultDomain: 'asianoel.space' }), ...updates };
    metadata.save(data);
  },
  getDirectorySize: (dirPath) => {
    if (!fs.existsSync(dirPath)) return 0;
    const stats = fs.statSync(dirPath);
    if (stats.isFile()) return stats.size;
    
    let total = 0;
    try {
      const files = fs.readdirSync(dirPath);
      for (const file of files) {
        total += metadata.getDirectorySize(path.join(dirPath, file));
      }
    } catch (e) {
      // Ignore errors for individual files (e.g. permission denied)
    }
    return total;
  }
};

// Middleware to protect admin routes
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err || decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    req.admin = decoded;
    next();
  });
};

// --- Admin Logic ---
const adminUtils = {
  addUser: (email, password, role = 'user') => {
    const accountLine = `${email}|{PLAIN}${password}\n`; 
    fs.appendFileSync(path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf'), accountLine, { encoding: 'utf8', flag: 'a' });
    const content = fs.readFileSync(path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf'), 'utf8');
    fs.writeFileSync(path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf'), content.replace(/\r\n/g, '\n'), 'utf8');
    metadata.updateUser(email, { role });
  },
  listUsers: () => {
    const filePath = path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf');
    if (!fs.existsSync(filePath)) return [];
    const accounts = fs.readFileSync(filePath, 'utf8')
      .split('\n')
      .filter(line => line.trim())
      .map(line => {
        const [email] = line.split('|');
        return { email, ...metadata.getUser(email) };
      });
    return accounts;
  },
  updateUserPassword: (email, newPassword) => {
    const filePath = path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf');
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const newLines = lines.map(line => {
      if (line.startsWith(email + '|')) {
        return `${email}|{PLAIN}${newPassword}`;
      }
      return line;
    });
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
  },
  deleteUser: (email) => {
    const filePath = path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf');
    if (!fs.existsSync(filePath)) return;
    const lines = fs.readFileSync(filePath, 'utf8').split('\n');
    const newLines = lines.filter(line => line.trim() && !line.startsWith(email + '|'));
    fs.writeFileSync(filePath, newLines.join('\n'), 'utf8');
    
    // Remove from metadata
    const data = metadata.load();
    delete data.users[email];
    metadata.save(data);
  }
};

// --- Routes ---

// Login (Unified)
app.post('/api/auth/login', (req, res) => {
  let { email, password } = req.body;
  email = normalizeEmail(email);
  
  // Check if it's the master admin
  if (email === 'admin' && password === 'admin123') {
    const token = jwt.sign({ email: 'admin', role: 'admin' }, JWT_SECRET);
    return res.json({ token, role: 'admin', email: 'admin' });
  }

  // Check against mailserver accounts
  const users = adminUtils.listUsers();
  const filePath = path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf');
  const accountsRaw = fs.readFileSync(filePath, 'utf8');
  const hasAccount = accountsRaw.includes(`${email}|{PLAIN}${password}`);

  if (hasAccount) {
    const userMeta = metadata.getUser(email);
    const token = jwt.sign({ email, role: userMeta.role }, JWT_SECRET);
    return res.json({ token, role: userMeta.role, email, theme: userMeta.theme, signature: userMeta.signature });
  }

  res.status(401).json({ error: 'Invalid credentials' });
});

// Admin: Manage Config
app.get('/api/admin/config', authenticateAdmin, (req, res) => {
  res.json(metadata.getConfig());
});

app.patch('/api/admin/config', authenticateAdmin, (req, res) => {
  metadata.updateConfig(req.body);
  res.json({ success: true });
});

// Admin: Manage Users
app.get('/api/admin/users', authenticateAdmin, (req, res) => {
  res.json(adminUtils.listUsers());
});

app.post('/api/admin/users', authenticateAdmin, (req, res) => {
  let { email, password, role } = req.body;
  email = normalizeEmail(email);
  try {
    const { quota = 10 } = req.body;
    adminUtils.addUser(email, password, role);
    metadata.updateUser(email, { quota: Number(quota) });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to add user' });
  }
});

app.post('/api/admin/users/role', authenticateAdmin, (req, res) => {
  const { email, role } = req.body;
  metadata.updateUser(email, { role });
  res.json({ success: true });
});

app.patch('/api/admin/users', authenticateAdmin, (req, res) => {
  let { email, password, role } = req.body;
  email = normalizeEmail(email);
  try {
    const { quota } = req.body;
    if (password) adminUtils.updateUserPassword(email, password);
    const updates = {};
    if (role) updates.role = role;
    if (quota !== undefined) updates.quota = Number(quota);
    if (Object.keys(updates).length > 0) metadata.updateUser(email, updates);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update user' });
  }
});

app.delete('/api/admin/users', authenticateAdmin, (req, res) => {
  let { email } = req.body;
  email = normalizeEmail(email);
  try {
    adminUtils.deleteUser(email);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// User Storage Info
app.post('/api/user/storage', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    
    const userMeta = metadata.getUser(email);
    const domain = email.includes('@') ? email.split('@')[1] : DEFAULT_DOMAIN;
    const userPart = email.split('@')[0];
    const userMailPath = `/var/mail/${domain}/${userPart}`;
    
    const used = metadata.getDirectorySize(userMailPath);
    res.json({ used, quota: userMeta.quota || 10 });
  } catch (err) {
    console.error('Storage API Error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Admin: Total Storage
app.get('/api/admin/storage', authenticateAdmin, (req, res) => {
  const totalUsed = metadata.getDirectorySize('/var/mail');
  res.json({ totalUsed });
});

// Webmail: Fetch Emails (IMAP)
app.post('/api/mail/list', async (req, res) => {
  let { email, password, folder = 'INBOX', starredOnly = false } = req.body;
  email = normalizeEmail(email);
  
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    let messages = [];
    const allFolders = await client.list();

    if (starredOnly) {
      for (let f of allFolders) {
        try {
          const lock = await client.getMailboxLock(f.path);
          try {
            const uids = await client.search({ flagged: true });
            if (uids.length > 0) {
              for await (let msg of client.fetch(uids, { envelope: true, flags: true })) {
                messages.push({
                  uid: msg.uid, seq: msg.seq, subject: msg.envelope.subject,
                  from: msg.envelope.from[0]?.address, date: msg.envelope.date,
                  seen: msg.flags.has('\\Seen'), starred: true, folder: f.path
                });
              }
            }
          } finally { lock.release(); }
        } catch (e) {}
      }
      messages.sort((a, b) => new Date(b.date) - new Date(a.date));
    } else {
      // Find the actual folder path from the list (more resiliently)
      const target = allFolders.find(f => 
        f.name.toLowerCase() === folder.toLowerCase() || 
        f.path.toLowerCase() === folder.toLowerCase() ||
        (folder.toLowerCase() === 'inbox' && f.path.toUpperCase() === 'INBOX')
      ) || { path: folder };
      
      if (['Sent', 'Trash'].includes(target.path)) {
        try { await client.mailboxCreate(target.path); } catch(e) {}
      }

      const lock = await client.getMailboxLock(target.path);
      try {
        const uids = await client.search({ all: true }); // Use all: true for broader compatibility
        if (uids.length > 0) {
          const lastUids = uids.slice(-50);
          for await (let msg of client.fetch(lastUids, { envelope: true, flags: true })) {
            messages.push({
              uid: msg.uid, seq: msg.seq, subject: msg.envelope.subject,
              from: msg.envelope.from[0]?.address, date: msg.envelope.date,
              seen: msg.flags.has('\\Seen'), starred: msg.flags.has('\\Flagged'),
              folder: target.path
            });
          }
        }
      } finally { lock.release(); }
      messages.reverse();
    }

    await client.logout();
    res.json(messages);
  } catch (err) {
    console.error(`IMAP List Error:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

// Webmail: List Folders
app.post('/api/mail/folders', async (req, res) => {
  let { email, password } = req.body;
  email = normalizeEmail(email);
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    const folders = await client.list();
    await client.logout();
    res.json(folders.map(f => ({ path: f.path, name: f.name })));
  } catch (err) {
    console.error(`IMAP Folders Error for ${email}:`, err);
    res.status(500).json({ error: err.message, stack: err.stack });
  }
});

// Webmail: Create Folder
app.post('/api/mail/folders/create', async (req, res) => {
  let { email, password, folderName } = req.body;
  email = normalizeEmail(email);
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    await client.mailboxCreate(folderName);
    await client.logout();
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webmail: Move Email
app.post('/api/mail/move', async (req, res) => {
  let { email, password, uid, sourceFolder, targetFolder } = req.body;
  email = normalizeEmail(email);
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    const mailbox = await client.getMailboxLock(sourceFolder);
    try {
      await client.mailboxCreate(targetFolder); // Ensure target exists
      await client.messageMove(uid.toString(), targetFolder, { uid: true });
      res.json({ success: true });
    } finally {
      mailbox.release();
    }
    await client.logout();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webmail: Download Attachment
app.get('/api/mail/attachment', async (req, res) => {
  let { email, password, uid, folder, filename } = req.query;
  email = normalizeEmail(email);
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    const mailbox = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(uid, { source: true }, { uid: true });
      const parsed = await simpleParser(msg.source);
      const attachment = parsed.attachments.find(a => a.filename === filename);
      
      if (!attachment) return res.status(404).send('Attachment not found');
      
      res.setHeader('Content-Type', attachment.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(attachment.filename)}"`);
      res.send(attachment.content);
    } finally {
      mailbox.release();
    }
    await client.logout();
  } catch (err) {
    res.status(500).send(err.message);
  }
});

// User: Sync Theme
app.post('/api/user/theme', (req, res) => {
  let { email, theme } = req.body;
  email = normalizeEmail(email);
  metadata.updateUser(email, { theme });
  res.json({ success: true });
});

// Webmail: Toggle Star
app.post('/api/mail/toggle-star', async (req, res) => {
  let { email, password, uid, starred, folder = 'INBOX' } = req.body;
  email = normalizeEmail(email);
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    const mailbox = await client.getMailboxLock(folder);
    try {
      if (starred) {
        await client.messageFlagsAdd(uid.toString(), ['\\Flagged'], { uid: true });
      } else {
        await client.messageFlagsRemove(uid.toString(), ['\\Flagged'], { uid: true });
      }
      res.json({ success: true });
    } finally {
      mailbox.release();
    }
    await client.logout();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webmail: Fetch Content & Mark Read
app.post('/api/mail/fetch', async (req, res) => {
  let { email, password, uid, folder = 'INBOX' } = req.body;
  email = normalizeEmail(email);
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    const mailbox = await client.getMailboxLock(folder);
    try {
      const msg = await client.fetchOne(uid.toString(), { source: true }, { uid: true });
      // Mark as read
      await client.messageFlagsAdd(uid.toString(), ['\\Seen'], { uid: true });
      
      const parsed = await simpleParser(msg.source);
      res.json({
        text: parsed.text,
        html: parsed.html || parsed.textAsHtml,
        attachments: parsed.attachments?.map(a => ({ filename: a.filename, size: a.size }))
      });
    } finally {
      mailbox.release();
    }
    await client.logout();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Webmail: Delete/Move to Trash
app.post('/api/mail/delete', async (req, res) => {
  let { email, password, uid, folder = 'INBOX' } = req.body;
  email = normalizeEmail(email);
  const client = new ImapFlow({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 143, secure: false, auth: { user: email, pass: password },
    tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
  });

  try {
    await client.connect();
    const mailbox = await client.getMailboxLock(folder);
    try {
      if (folder.toLowerCase() === 'trash') {
        // Permanent Delete
        await client.messageDelete(uid.toString(), { uid: true });
      } else {
        // Ensure Trash exists before moving
        try { await client.mailboxCreate('Trash'); } catch (e) {}
        await client.messageMove(uid.toString(), 'Trash', { uid: true });
      }
      res.json({ success: true });
    } finally {
      mailbox.release();
    }
    await client.logout();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User: Update Signature
app.post('/api/user/signature', (req, res) => {
  let { email, signature } = req.body;
  email = normalizeEmail(email);
  metadata.updateUser(email, { signature });
  res.json({ success: true });
});

// Webmail: Send Email (SMTP + Append to Sent)
app.post('/api/mail/send', upload.array('attachments'), async (req, res) => {
  let { email, password, to, subject, body } = req.body;
  const userEmail = normalizeEmail(email);
  const userPass = password;
  
  let transporter = nodemailer.createTransport({
    host: process.env.MAIL_SERVER_HOST || 'mailserver',
    port: 587, secure: false, auth: { user: userEmail, pass: userPass },
    tls: { rejectUnauthorized: false }
  });

  try {
    const attachments = req.files?.map(file => ({
      filename: file.originalname,
      content: file.buffer,
      contentType: file.mimetype
    })) || [];

    const mailOptions = {
      from: userEmail, to, subject, text: body, html: `<div>${body.replace(/\n/g, '<br>')}</div>`,
      attachments
    };
    
    let info = await transporter.sendMail(mailOptions);
    
    // Append to Sent folder
    const client = new ImapFlow({
      host: process.env.MAIL_SERVER_HOST || 'mailserver',
      port: 143, secure: false, auth: { user: userEmail, pass: userPass },
      tls: { rejectUnauthorized: false }, ignoreTLS: true, logger: false,
    });
    await client.connect();
    try {
      // Create raw message for appending
      const raw = await new Promise(async (resolve, reject) => {
        const mail = require('nodemailer/lib/mail-composer');
        new mail(mailOptions).compile().build((err, message) => {
          if (err) reject(err);
          else resolve(message);
        });
      });
      // Ensure Sent exists
      try { await client.mailboxCreate('Sent'); } catch (e) {}
      await client.append('Sent', raw, ['\\Seen']);
    } catch (e) {
      console.warn('Failed to append to Sent folder:', e.message);
    }
    await client.logout();

    res.json({ success: true });
  } catch (err) {
    console.error('Send error:', err);
    res.status(500).json({ error: err.message });
  }
});

// User Settings
app.post('/api/user/password', async (req, res) => {
  const { email, oldPassword, newPassword } = req.body;
  const filePath = path.join(DMS_CONFIG_PATH, 'postfix-accounts.cf');
  const accountsRaw = fs.readFileSync(filePath, 'utf8');
  
  if (accountsRaw.includes(`${email}|{PLAIN}${oldPassword}`)) {
    adminUtils.updateUserPassword(email, newPassword);
    res.json({ success: true });
  } else {
    res.status(401).json({ error: 'Incorrect old password' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`LifeMail Backend running on http://0.0.0.0:${PORT}`);
});
