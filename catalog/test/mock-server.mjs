import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "public");
const port = Number(process.env.PORT || 8910);
const box = {
  id: 1, public_id: "box_demo", code: "B", name: "Build tools", description: "Shared construction and repair tools.",
  room_location: "A101 · west wall · shelf 2", current_location: "A101 · west wall · shelf 2", status: "available",
  checked_out_to: null, last_holder: "Jordan Lee", item_count: 2
};
const items = [
  { id: 1, public_id: "item_pliers", asset_tag: "TOOL-001", box_id: 1, box_code: "B", box_name: "Build tools", box_public_id: "box_demo", name: "Locking pliers", description: "Pliers that lock firmly onto a workpiece.", identifying_notes: "Silver jaws with a screw at the end of one handle.", quantity: 2, room_location: "Inside Box B", current_location: "Inside Box B", resolved_location: "Inside Box B", status: "available", resolved_status: "available", checked_out_to: null, resolved_holder: null, last_holder: "Jordan Lee", box_status: "available" },
  { id: 2, public_id: "item_multimeter", asset_tag: "ELEC-008", box_id: null, box_code: null, name: "Digital multimeter", description: "Measures voltage, current, and resistance.", identifying_notes: "Yellow protective shell and black rotary dial.", quantity: 1, room_location: "A101 · electronics cabinet", current_location: "Circuit Lab practice room", resolved_location: "Circuit Lab practice room", status: "checked_out", resolved_status: "checked_out", checked_out_to: "Maya Chen", resolved_holder: "Maya Chen", last_holder: "Maya Chen" }
];
const history = [{ action: "created", from_location: null, to_location: "Inside Box B", holder: null, notes: "", actor_name: "Catalog Tester", created_at: "2026-08-29 16:00:00" }];

function json(response, payload) {
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify(payload));
}

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (url.pathname === "/api/me") return json(response, { user: { id: 1, email: "tester@example.invalid", name: "Catalog Tester", role: "admin" }, csrf: "fixture" });
  if (url.pathname === "/api/catalog") return json(response, { boxes: [box], items });
  if (url.pathname === "/api/users") return json(response, { users: [{ id: 1, email: "tester@example.invalid", name: "Catalog Tester", role: "admin", last_login_at: "2026-08-29 16:00:00" }] });
  if (url.pathname === "/api/boxes/box_demo") return json(response, { box, items: [items[0]], history });
  if (url.pathname === "/api/items/item_pliers") return json(response, { item: items[0], history });
  if (url.pathname === "/api/items/item_multimeter") return json(response, { item: items[1], history });
  if (url.pathname.startsWith("/api/qr/")) {
    response.writeHead(200, { "content-type": "image/svg+xml" });
    return response.end(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="white"/><path fill="#172019" d="M8 8h32v32H8zm8 8v16h16V16zm64-8h32v32H80zm8 8v16h16V16zM8 80h32v32H8zm8 8v16h16V88zm40-72h8v8h-8zm0 16h16v8H56zm0 16h8v16h-8zm16 8h16v8H72zm24 0h16v8H96zM48 72h16v8H48zm24 0h8v16h-8zm16 8h24v8H88zm-32 8h8v24h-8zm16 8h16v16H72zm24 0h16v8H96z"/></svg>`);
  }
  const requested = url.pathname === "/" || !extname(url.pathname) ? "index.html" : url.pathname.slice(1);
  try {
    const body = await readFile(join(root, requested));
    const types = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript" };
    response.writeHead(200, { "content-type": types[extname(requested)] || "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, "127.0.0.1", () => console.log(`Catalog fixture at http://127.0.0.1:${port}`));
