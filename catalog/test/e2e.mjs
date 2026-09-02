import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const port = 3910 + Math.floor(Math.random() * 500);
const base = `http://127.0.0.1:${port}`;
const dataDir = await mkdtemp(join(tmpdir(), "scioly-catalog-test-"));
const setupToken = "test-setup-token";
const server = spawn(process.execPath, ["server.js"], {
  cwd: new URL("..", import.meta.url),
  env: { ...process.env, NODE_ENV: "test", PORT: String(port), PUBLIC_URL: base, DATA_DIR: dataDir, SETUP_TOKEN: setupToken, COOKIE_SECURE: "false", MAIL_TRANSPORT: "json", SMTP_USER: "westviewso.ss@gmail.com", MAIL_FROM: "westviewso.ss@gmail.com" },
  stdio: ["ignore", "pipe", "pipe"]
});

let serverOutput = "";
server.stdout.on("data", (chunk) => { serverOutput += chunk; });
server.stderr.on("data", (chunk) => { serverOutput += chunk; });

async function waitForServer() {
  for (let attempt = 0; attempt < 200; attempt += 1) {
    try {
      if ((await fetch(`${base}/healthz`)).ok) return;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Server did not start:\n${serverOutput}`);
}

function client() {
  let cookie = "";
  let csrf = "";
  return {
    get csrf() { return csrf; },
    async request(path, { method = "GET", body, headers = {} } = {}) {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
          ...(csrf && method !== "GET" ? { "x-csrf-token": csrf } : {}),
          ...headers
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const setCookie = response.headers.get("set-cookie");
      if (setCookie) cookie = setCookie.split(";", 1)[0];
      const type = response.headers.get("content-type") || "";
      const payload = type.includes("json") ? await response.json() : await response.text();
      if (!response.ok) throw new Error(`${method} ${path} -> ${response.status}: ${JSON.stringify(payload)}`);
      return { response, payload };
    },
    setCsrf(value) { csrf = value; }
  };
}

try {
  await waitForServer();
  const checkedOutPage = (await client().request("/checked-out")).payload;
  assert.match(checkedOutPage, /data-route="\/checked-out"/);
  assert.match(checkedOutPage, /catalog\.js\?v=8/);
  const catalogScript = (await client().request("/catalog.js?v=8")).payload;
  assert.match(catalogScript, /path === "\/checked-out"/);

  const admin = client();
  await admin.request("/api/setup", {
    method: "POST",
    headers: { "x-setup-token": setupToken },
    body: { email: "admin@example.com", name: "Admin", password: "a-secure-test-password" }
  });
  const me = (await admin.request("/api/me")).payload;
  admin.setCsrf(me.csrf);
  assert.equal(me.user.role, "admin");

  const boxId = (await admin.request("/api/boxes", {
    method: "POST",
    body: { code: "B", name: "Build tools", room_location: "A101 · west wall · shelf 2", description: "Shared construction tools" }
  })).payload.id;
  const itemId = (await admin.request("/api/items", {
    method: "POST",
    body: { box_id: boxId, name: "Locking pliers", asset_tag: "TOOL-001", quantity: 2, room_location: "Inside Box B", description: "Pliers that lock onto a workpiece", identifying_notes: "Silver jaws with a screw at the end of one handle" }
  })).payload.id;

  let catalog = (await admin.request("/api/catalog")).payload;
  const box = catalog.boxes[0];
  const item = catalog.items[0];
  assert.equal(box.item_count, 1);
  assert.equal(item.box_code, "B");

  await admin.request("/api/move", { method: "POST", body: { entity_type: "box", id: boxId, action: "checked_out", holder: "Alex", location: "Competition build room" } });
  let detail = (await admin.request(`/api/items/${item.public_id}`)).payload;
  assert.equal(detail.item.resolved_status, "checked_out");
  assert.equal(detail.item.resolved_holder, "Alex");
  assert.equal(detail.item.resolved_location, "Competition build room");
  assert.match((await admin.request(`/api/qr/box/${box.public_id}.svg`)).payload, /<svg/);

  await admin.request("/api/move", { method: "POST", body: { entity_type: "box", id: boxId, action: "returned", location: "" } });
  const createdMember = (await admin.request("/api/users", { method: "POST", body: { email: "member@example.com", name: "Member", password: "admin-cannot-choose-this", role: "member" } })).payload;
  assert.equal(createdMember.invited[0].email, "member@example.com");
  const memberInviteToken = new URL(createdMember.invited[0].test_setup_url).hash.slice("#invite=".length);
  const memberPassword = "member-chosen-password";
  const invitedMember = client();
  await assert.rejects(invitedMember.request("/api/login", { method: "POST", body: { email: "member@example.com", password: "admin-cannot-choose-this" } }), /401/);
  await invitedMember.request("/api/set-password", { method: "POST", body: { token: memberInviteToken, password: memberPassword, password_confirmation: memberPassword } });
  await assert.rejects(invitedMember.request("/api/set-password", { method: "POST", body: { token: memberInviteToken, password: memberPassword, password_confirmation: memberPassword } }), /410/);
  const users = (await admin.request("/api/users")).payload.users;
  const memberUser = users.find((user) => user.email === "member@example.com");

  const imported = (await admin.request("/api/users/import", {
    method: "POST",
    body: { users: [
      { row: 2, name: "Generated Password", email: "generated@example.com", role: "member" },
      { row: 3, name: "Imported Admin", email: "imported-admin@example.com", password: "imported-password-123", role: "admin" },
      { row: 4, name: "Existing Member", email: "member@example.com", password: "another-password-123", role: "member" },
      { row: 5, name: "Bad Address", email: "not-an-email", password: "", role: "member" }
    ] }
  })).payload;
  assert.equal(imported.created, 2);
  assert.equal(imported.skipped, 1);
  assert.equal(imported.errors.length, 1);
  const generatedInvitation = imported.invited.find((user) => user.email === "generated@example.com");
  assert.ok(generatedInvitation.test_setup_url.includes("#invite="));
  await assert.rejects(client().request("/api/login", { method: "POST", body: { email: "imported-admin@example.com", password: "imported-password-123" } }), /401/);

  const generatedUser = client();
  const generatedPassword = "generated-user-password";
  await generatedUser.request("/api/set-password", { method: "POST", body: { token: new URL(generatedInvitation.test_setup_url).hash.slice("#invite=".length), password: generatedPassword, password_confirmation: generatedPassword } });
  await generatedUser.request("/api/login", { method: "POST", body: { email: "generated@example.com", password: generatedPassword } });
  assert.equal((await generatedUser.request("/api/me")).payload.user.role, "member");

  const member = client();
  await member.request("/api/login", { method: "POST", body: { email: "member@example.com", password: memberPassword } });
  const memberMe = (await member.request("/api/me")).payload;
  member.setCsrf(memberMe.csrf);
  await assert.rejects(member.request("/api/users/import", { method: "POST", body: { users: [{ name: "Nope", email: "nope@example.com" }] } }), /403/);
  await member.request("/api/move", { method: "POST", body: { entity_type: "item", id: itemId, action: "relocated", location: "A101 · demo table", notes: "Used for identification demo" } });

  await admin.request(`/api/users/${memberUser.id}`, { method: "DELETE" });
  assert.equal((await admin.request("/api/users")).payload.users.some((user) => user.id === memberUser.id), false);
  detail = (await admin.request(`/api/items/${item.public_id}`)).payload;
  assert.equal(detail.history[0].actor_name, "Member");
  assert.equal(detail.history[0].to_location, "A101 · demo table");
  await assert.rejects(member.request("/api/me"), /401/);

  console.log("Catalog end-to-end test passed");
} finally {
  if (server.exitCode === null) {
    const exited = new Promise((resolve) => server.once("exit", resolve));
    server.kill("SIGTERM");
    await exited;
  }
  await rm(dataDir, { recursive: true, force: true });
}
