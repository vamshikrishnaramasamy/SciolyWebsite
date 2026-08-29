import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import cookie from "@fastify/cookie";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";
import initSqlJs from "sql.js";

const rootDir = dirname(fileURLToPath(import.meta.url));
const config = {
  host: process.env.HOST || "127.0.0.1",
  port: Number(process.env.PORT || 3010),
  publicUrl: (process.env.PUBLIC_URL || "http://127.0.0.1:3010").replace(/\/$/, ""),
  dataDir: process.env.DATA_DIR || join(rootDir, "data"),
  setupToken: process.env.SETUP_TOKEN || "",
  secureCookie: process.env.COOKIE_SECURE === "true" || (process.env.PUBLIC_URL || "").startsWith("https://")
};

mkdirSync(config.dataDir, { recursive: true });
const databasePath = join(config.dataDir, "catalog.db");
const databaseTempPath = join(config.dataDir, "catalog.db.tmp");
const SQL = await initSqlJs({ locateFile: (file) => join(rootDir, "node_modules", "sql.js", "dist", file) });
const sqlite = existsSync(databasePath) ? new SQL.Database(readFileSync(databasePath)) : new SQL.Database();

function persistDatabase() {
  writeFileSync(databaseTempPath, Buffer.from(sqlite.export()), { mode: 0o600 });
  renameSync(databaseTempPath, databasePath);
}

function bindValues(values) {
  return values.map((value) => value === undefined ? null : value);
}

const db = {
  pragma(statement) {
    sqlite.run(`PRAGMA ${statement}`);
  },
  exec(statement) {
    sqlite.run(statement);
    persistDatabase();
  },
  prepare(statement) {
    return {
      get(...values) {
        const prepared = sqlite.prepare(statement);
        prepared.bind(bindValues(values));
        const row = prepared.step() ? prepared.getAsObject() : undefined;
        prepared.free();
        return row;
      },
      all(...values) {
        const prepared = sqlite.prepare(statement);
        prepared.bind(bindValues(values));
        const rows = [];
        while (prepared.step()) rows.push(prepared.getAsObject());
        prepared.free();
        return rows;
      },
      run(...values) {
        sqlite.run(statement, bindValues(values));
        const last = sqlite.exec("SELECT last_insert_rowid() AS id");
        const lastInsertRowid = last[0]?.values?.[0]?.[0] || 0;
        const changes = sqlite.getRowsModified();
        persistDatabase();
        return { lastInsertRowid, changes };
      }
    };
  }
};

db.pragma("foreign_keys = ON");
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK(role IN ('admin','member')),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_login_at TEXT,
    disabled_at TEXT
  );

  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    csrf_token TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    expires_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS boxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    code TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    room_location TEXT NOT NULL,
    current_location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','checked_out')),
    checked_out_to TEXT,
    last_holder TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    public_id TEXT NOT NULL UNIQUE,
    asset_tag TEXT UNIQUE COLLATE NOCASE,
    box_id INTEGER REFERENCES boxes(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    identifying_notes TEXT NOT NULL DEFAULT '',
    quantity INTEGER NOT NULL DEFAULT 1 CHECK(quantity > 0),
    room_location TEXT NOT NULL,
    current_location TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','checked_out')),
    checked_out_to TEXT,
    last_holder TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    deleted_at TEXT
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('box','item')),
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL CHECK(action IN ('created','updated','checked_out','returned','relocated','deleted')),
    from_location TEXT,
    to_location TEXT,
    holder TEXT,
    notes TEXT NOT NULL DEFAULT '',
    actor_user_id INTEGER REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_items_box ON items(box_id);
  CREATE INDEX IF NOT EXISTS idx_movements_entity ON movements(entity_type, entity_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);
`);

const userColumns = db.prepare("PRAGMA table_info(users)").all();
if (!userColumns.some((column) => column.name === "disabled_at")) {
  db.exec("ALTER TABLE users ADD COLUMN disabled_at TEXT");
}

const app = Fastify({ logger: true, trustProxy: true, bodyLimit: 1_000_000 });
await app.register(cookie);
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "https://api.fontshare.com"],
      fontSrc: ["'self'", "https://cdn.fontshare.com", "data:"],
      imgSrc: ["'self'", "data:"],
      scriptSrc: ["'self'"]
    }
  }
});
await app.register(rateLimit, { max: 240, timeWindow: "1 minute" });

const SESSION_COOKIE = "scioly_catalog_session";
const SESSION_DAYS = 14;
const nowIso = () => new Date().toISOString();
const clean = (value, max = 500) => String(value ?? "").trim().slice(0, max);
const tokenHash = (token) => createHash("sha256").update(token).digest("hex");
const publicId = (prefix) => `${prefix}_${randomBytes(8).toString("base64url")}`;
const safeEqual = (a, b) => {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  return left.length === right.length && timingSafeEqual(left, right);
};

function sessionFor(request) {
  const token = request.cookies[SESSION_COOKIE];
  if (!token) return null;
  return db.prepare(`
    SELECT s.token_hash, s.csrf_token, s.expires_at,
           u.id AS user_id, u.email, u.name, u.role
    FROM sessions s JOIN users u ON u.id = s.user_id
    WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled_at IS NULL
  `).get(tokenHash(token), nowIso()) || null;
}

function requireUser(request, reply, { csrf = false, admin = false } = {}) {
  const session = sessionFor(request);
  if (!session) {
    reply.code(401).send({ error: "Login required" });
    return null;
  }
  if (admin && session.role !== "admin") {
    reply.code(403).send({ error: "Admin access required" });
    return null;
  }
  if (csrf && !safeEqual(request.headers["x-csrf-token"] || "", session.csrf_token)) {
    reply.code(403).send({ error: "Invalid security token. Refresh and try again." });
    return null;
  }
  return session;
}

function setSession(reply, userId) {
  const token = randomBytes(32).toString("base64url");
  const csrf = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + SESSION_DAYS * 86400000);
  db.prepare("DELETE FROM sessions WHERE expires_at <= ?").run(nowIso());
  db.prepare("INSERT INTO sessions (token_hash,user_id,csrf_token,expires_at) VALUES (?,?,?,?)")
    .run(tokenHash(token), userId, csrf, expires.toISOString());
  reply.setCookie(SESSION_COOKIE, token, {
    path: "/",
    httpOnly: true,
    secure: config.secureCookie,
    sameSite: "lax",
    expires
  });
}

function logMovement({ type, id, action, from = null, to = null, holder = null, notes = "", actor }) {
  db.prepare(`INSERT INTO movements
    (entity_type,entity_id,action,from_location,to_location,holder,notes,actor_user_id)
    VALUES (?,?,?,?,?,?,?,?)`)
    .run(type, id, action, from, to, holder, clean(notes, 1000), actor);
}

function activeBoxById(id) {
  return db.prepare("SELECT * FROM boxes WHERE id = ? AND deleted_at IS NULL").get(id);
}

function activeItemById(id) {
  return db.prepare("SELECT * FROM items WHERE id = ? AND deleted_at IS NULL").get(id);
}

function itemWithResolvedLocation(row) {
  if (!row) return row;
  const inherited = row.box_id && row.box_status === "checked_out";
  return {
    ...row,
    resolved_location: inherited ? row.box_current_location : row.current_location,
    resolved_holder: inherited ? row.box_checked_out_to : row.checked_out_to,
    resolved_status: inherited ? "checked_out" : row.status
  };
}

app.addHook("onRequest", async (request, reply) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method)) return;
  const origin = request.headers.origin;
  if (origin && origin !== new URL(config.publicUrl).origin) {
    return reply.code(403).send({ error: "Origin not allowed" });
  }
});

app.get("/healthz", async () => ({ ok: true }));

app.get("/api/status", async () => ({
  setupRequired: db.prepare("SELECT COUNT(*) AS count FROM users WHERE disabled_at IS NULL").get().count === 0
}));

app.post("/api/setup", { config: { rateLimit: { max: 5, timeWindow: "15 minutes" } } }, async (request, reply) => {
  if (db.prepare("SELECT COUNT(*) AS count FROM users WHERE disabled_at IS NULL").get().count > 0) {
    return reply.code(409).send({ error: "Setup already completed" });
  }
  if (!config.setupToken || !safeEqual(request.headers["x-setup-token"] || "", config.setupToken)) {
    return reply.code(403).send({ error: "Invalid setup link" });
  }
  const email = clean(request.body?.email, 254).toLowerCase();
  const name = clean(request.body?.name, 120);
  const password = String(request.body?.password || "");
  if (!email.includes("@") || !name || password.length < 12) {
    return reply.code(400).send({ error: "Name, valid email, and password of at least 12 characters required" });
  }
  const hash = await bcrypt.hash(password, 12);
  const result = db.prepare("INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,'admin')")
    .run(email, name, hash);
  setSession(reply, result.lastInsertRowid);
  return { ok: true };
});

app.post("/api/login", { config: { rateLimit: { max: 10, timeWindow: "15 minutes" } } }, async (request, reply) => {
  const email = clean(request.body?.email, 254).toLowerCase();
  const password = String(request.body?.password || "");
  const user = db.prepare("SELECT * FROM users WHERE email = ? AND disabled_at IS NULL").get(email);
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    return reply.code(401).send({ error: "Incorrect email or password" });
  }
  db.prepare("UPDATE users SET last_login_at = ? WHERE id = ?").run(nowIso(), user.id);
  setSession(reply, user.id);
  return { ok: true };
});

app.post("/api/logout", async (request, reply) => {
  const token = request.cookies[SESSION_COOKIE];
  if (token) db.prepare("DELETE FROM sessions WHERE token_hash = ?").run(tokenHash(token));
  reply.clearCookie(SESSION_COOKIE, { path: "/" });
  return { ok: true };
});

app.get("/api/me", async (request, reply) => {
  const session = requireUser(request, reply);
  if (!session) return;
  return { user: { id: session.user_id, email: session.email, name: session.name, role: session.role }, csrf: session.csrf_token };
});

app.get("/api/catalog", async (request, reply) => {
  if (!requireUser(request, reply)) return;
  const boxes = db.prepare(`
    SELECT b.*, COUNT(i.id) AS item_count
    FROM boxes b LEFT JOIN items i ON i.box_id = b.id AND i.deleted_at IS NULL
    WHERE b.deleted_at IS NULL GROUP BY b.id ORDER BY b.code COLLATE NOCASE
  `).all();
  const items = db.prepare(`
    SELECT i.*, b.code AS box_code, b.name AS box_name, b.public_id AS box_public_id,
           b.status AS box_status, b.current_location AS box_current_location,
           b.checked_out_to AS box_checked_out_to
    FROM items i LEFT JOIN boxes b ON b.id = i.box_id AND b.deleted_at IS NULL
    WHERE i.deleted_at IS NULL ORDER BY i.name COLLATE NOCASE
  `).all().map(itemWithResolvedLocation);
  return { boxes, items };
});

app.get("/api/boxes/:publicId", async (request, reply) => {
  if (!requireUser(request, reply)) return;
  const box = db.prepare("SELECT * FROM boxes WHERE public_id = ? AND deleted_at IS NULL").get(request.params.publicId);
  if (!box) return reply.code(404).send({ error: "Box not found" });
  const items = db.prepare("SELECT * FROM items WHERE box_id = ? AND deleted_at IS NULL ORDER BY name COLLATE NOCASE").all(box.id);
  const history = db.prepare(`
    SELECT m.*, u.name AS actor_name FROM movements m
    LEFT JOIN users u ON u.id = m.actor_user_id
    WHERE m.entity_type = 'box' AND m.entity_id = ? ORDER BY m.created_at DESC LIMIT 100
  `).all(box.id);
  return { box, items, history };
});

app.get("/api/items/:publicId", async (request, reply) => {
  if (!requireUser(request, reply)) return;
  const item = db.prepare(`
    SELECT i.*, b.code AS box_code, b.name AS box_name, b.public_id AS box_public_id,
           b.status AS box_status, b.current_location AS box_current_location,
           b.checked_out_to AS box_checked_out_to
    FROM items i LEFT JOIN boxes b ON b.id = i.box_id AND b.deleted_at IS NULL
    WHERE i.public_id = ? AND i.deleted_at IS NULL
  `).get(request.params.publicId);
  if (!item) return reply.code(404).send({ error: "Item not found" });
  const history = db.prepare(`
    SELECT m.*, u.name AS actor_name FROM movements m
    LEFT JOIN users u ON u.id = m.actor_user_id
    WHERE m.entity_type = 'item' AND m.entity_id = ? ORDER BY m.created_at DESC LIMIT 100
  `).all(item.id);
  return { item: itemWithResolvedLocation(item), history };
});

app.post("/api/boxes", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true });
  if (!session) return;
  const code = clean(request.body?.code, 40).toUpperCase();
  const name = clean(request.body?.name, 160);
  const room = clean(request.body?.room_location, 200);
  if (!code || !name || !room) return reply.code(400).send({ error: "Box code, name, and A101 location required" });
  try {
    const result = db.prepare(`INSERT INTO boxes
      (public_id,code,name,description,room_location,current_location,created_by)
      VALUES (?,?,?,?,?,?,?)`)
      .run(publicId("box"), code, name, clean(request.body?.description, 2000), room, room, session.user_id);
    logMovement({ type: "box", id: result.lastInsertRowid, action: "created", to: room, actor: session.user_id });
    return reply.code(201).send({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return reply.code(409).send({ error: "That box code already exists" });
    throw error;
  }
});

app.patch("/api/boxes/:id", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true });
  if (!session) return;
  const box = activeBoxById(Number(request.params.id));
  if (!box) return reply.code(404).send({ error: "Box not found" });
  const code = clean(request.body?.code ?? box.code, 40).toUpperCase();
  const name = clean(request.body?.name ?? box.name, 160);
  const room = clean(request.body?.room_location ?? box.room_location, 200);
  try {
    db.prepare(`UPDATE boxes SET code=?,name=?,description=?,room_location=?,updated_at=? WHERE id=?`)
      .run(code, name, clean(request.body?.description ?? box.description, 2000), room, nowIso(), box.id);
    logMovement({ type: "box", id: box.id, action: "updated", from: box.current_location, to: box.current_location, actor: session.user_id });
    return { ok: true };
  } catch (error) {
    if (String(error).includes("UNIQUE")) return reply.code(409).send({ error: "That box code already exists" });
    throw error;
  }
});

app.delete("/api/boxes/:id", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true });
  if (!session) return;
  const box = activeBoxById(Number(request.params.id));
  if (!box) return reply.code(404).send({ error: "Box not found" });
  const count = db.prepare("SELECT COUNT(*) AS count FROM items WHERE box_id=? AND deleted_at IS NULL").get(box.id).count;
  if (count) return reply.code(409).send({ error: "Move or delete items inside this box first" });
  db.prepare("UPDATE boxes SET deleted_at=?,updated_at=? WHERE id=?").run(nowIso(), nowIso(), box.id);
  logMovement({ type: "box", id: box.id, action: "deleted", from: box.current_location, actor: session.user_id });
  return { ok: true };
});

app.post("/api/items", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true });
  if (!session) return;
  const name = clean(request.body?.name, 180);
  const boxId = request.body?.box_id ? Number(request.body.box_id) : null;
  const box = boxId ? activeBoxById(boxId) : null;
  const room = clean(request.body?.room_location || (box ? `Inside Box ${box.code}` : ""), 200);
  if (!name || !room || (boxId && !box)) return reply.code(400).send({ error: "Item name and valid location required" });
  try {
    const result = db.prepare(`INSERT INTO items
      (public_id,asset_tag,box_id,name,description,identifying_notes,quantity,room_location,current_location,created_by)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
      .run(publicId("item"), clean(request.body?.asset_tag, 60) || null, boxId, name,
        clean(request.body?.description, 2000), clean(request.body?.identifying_notes, 2000),
        Math.max(1, Number(request.body?.quantity || 1)), room, room, session.user_id);
    logMovement({ type: "item", id: result.lastInsertRowid, action: "created", to: room, actor: session.user_id });
    return reply.code(201).send({ ok: true, id: result.lastInsertRowid });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return reply.code(409).send({ error: "That asset tag already exists" });
    throw error;
  }
});

app.patch("/api/items/:id", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true });
  if (!session) return;
  const item = activeItemById(Number(request.params.id));
  if (!item) return reply.code(404).send({ error: "Item not found" });
  const boxId = request.body?.box_id === "" || request.body?.box_id === null ? null : Number(request.body?.box_id ?? item.box_id);
  const box = boxId ? activeBoxById(boxId) : null;
  if (boxId && !box) return reply.code(400).send({ error: "Selected box not found" });
  try {
    db.prepare(`UPDATE items SET asset_tag=?,box_id=?,name=?,description=?,identifying_notes=?,quantity=?,room_location=?,updated_at=? WHERE id=?`)
      .run(clean(request.body?.asset_tag ?? item.asset_tag, 60) || null, boxId,
        clean(request.body?.name ?? item.name, 180), clean(request.body?.description ?? item.description, 2000),
        clean(request.body?.identifying_notes ?? item.identifying_notes, 2000),
        Math.max(1, Number(request.body?.quantity ?? item.quantity)),
        clean(request.body?.room_location ?? item.room_location, 200), nowIso(), item.id);
    logMovement({ type: "item", id: item.id, action: "updated", from: item.current_location, to: item.current_location, actor: session.user_id });
    return { ok: true };
  } catch (error) {
    if (String(error).includes("UNIQUE")) return reply.code(409).send({ error: "That asset tag already exists" });
    throw error;
  }
});

app.delete("/api/items/:id", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true });
  if (!session) return;
  const item = activeItemById(Number(request.params.id));
  if (!item) return reply.code(404).send({ error: "Item not found" });
  db.prepare("UPDATE items SET deleted_at=?,updated_at=? WHERE id=?").run(nowIso(), nowIso(), item.id);
  logMovement({ type: "item", id: item.id, action: "deleted", from: item.current_location, actor: session.user_id });
  return { ok: true };
});

app.post("/api/move", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true });
  if (!session) return;
  const type = request.body?.entity_type === "box" ? "box" : request.body?.entity_type === "item" ? "item" : null;
  const action = ["checked_out", "returned", "relocated"].includes(request.body?.action) ? request.body.action : null;
  const id = Number(request.body?.id);
  if (!type || !action || !id) return reply.code(400).send({ error: "Invalid movement" });
  const row = type === "box" ? activeBoxById(id) : activeItemById(id);
  if (!row) return reply.code(404).send({ error: `${type === "box" ? "Box" : "Item"} not found` });
  const location = clean(request.body?.location, 200);
  const holder = clean(request.body?.holder, 160);
  if (action === "checked_out" && (!location || !holder)) {
    return reply.code(400).send({ error: "Checkout location and person required" });
  }
  const table = type === "box" ? "boxes" : "items";
  let to = location;
  if (action === "checked_out") {
    db.prepare(`UPDATE ${table} SET status='checked_out',current_location=?,checked_out_to=?,last_holder=?,updated_at=? WHERE id=?`)
      .run(location, holder, holder, nowIso(), id);
  } else if (action === "returned") {
    to = location || row.room_location;
    db.prepare(`UPDATE ${table} SET status='available',current_location=?,checked_out_to=NULL,updated_at=? WHERE id=?`)
      .run(to, nowIso(), id);
  } else {
    if (!location) return reply.code(400).send({ error: "New location required" });
    db.prepare(`UPDATE ${table} SET current_location=?,updated_at=? WHERE id=?`).run(location, nowIso(), id);
  }
  logMovement({ type, id, action, from: row.current_location, to, holder: holder || row.checked_out_to, notes: request.body?.notes, actor: session.user_id });
  return { ok: true };
});

app.get("/api/users", async (request, reply) => {
  if (!requireUser(request, reply, { admin: true })) return;
  return { users: db.prepare("SELECT id,email,name,role,created_at,last_login_at FROM users WHERE disabled_at IS NULL ORDER BY name COLLATE NOCASE").all() };
});

app.post("/api/users", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true, admin: true });
  if (!session) return;
  const email = clean(request.body?.email, 254).toLowerCase();
  const name = clean(request.body?.name, 120);
  const password = String(request.body?.password || "");
  const role = request.body?.role === "admin" ? "admin" : "member";
  if (!email.includes("@") || !name || password.length < 12) {
    return reply.code(400).send({ error: "Name, valid email, and password of at least 12 characters required" });
  }
  try {
    const hash = await bcrypt.hash(password, 12);
    const existing = db.prepare("SELECT id,disabled_at FROM users WHERE email = ?").get(email);
    if (existing?.disabled_at) {
      db.prepare("UPDATE users SET name=?,password_hash=?,role=?,disabled_at=NULL,last_login_at=NULL WHERE id=?")
        .run(name, hash, role, existing.id);
    } else {
      db.prepare("INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,?)").run(email, name, hash, role);
    }
    return reply.code(201).send({ ok: true });
  } catch (error) {
    if (String(error).includes("UNIQUE")) return reply.code(409).send({ error: "A user with that email already exists" });
    throw error;
  }
});

app.delete("/api/users/:id", async (request, reply) => {
  const session = requireUser(request, reply, { csrf: true, admin: true });
  if (!session) return;
  const id = Number(request.params.id);
  if (id === session.user_id) return reply.code(400).send({ error: "You cannot delete your own account" });
  db.prepare("UPDATE users SET disabled_at = ? WHERE id = ?").run(nowIso(), id);
  db.prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
  return { ok: true };
});

app.get("/api/qr/:type/:publicId.svg", async (request, reply) => {
  if (!requireUser(request, reply)) return;
  const type = request.params.type === "box" ? "box" : request.params.type === "item" ? "item" : null;
  if (!type) return reply.code(404).send({ error: "Not found" });
  const table = type === "box" ? "boxes" : "items";
  const exists = db.prepare(`SELECT 1 FROM ${table} WHERE public_id=? AND deleted_at IS NULL`).get(request.params.publicId);
  if (!exists) return reply.code(404).send({ error: "Not found" });
  const svg = await QRCode.toString(`${config.publicUrl}/${type}/${request.params.publicId}`, {
    type: "svg", errorCorrectionLevel: "M", margin: 2, color: { dark: "#172019", light: "#ffffff" }
  });
  return reply.type("image/svg+xml").header("Cache-Control", "private, max-age=3600").send(svg);
});

await app.register(fastifyStatic, { root: join(rootDir, "public"), prefix: "/" });
app.setNotFoundHandler((request, reply) => {
  if (request.url.startsWith("/api/")) return reply.code(404).send({ error: "Not found" });
  return reply.sendFile("index.html");
});

try {
  await app.listen({ host: config.host, port: config.port });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
