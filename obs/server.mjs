import http from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const files = new Map([
  ["/", ["index.html", "text/html; charset=utf-8"]],
  ["/overlay.css", ["overlay.css", "text/css; charset=utf-8"]],
  ["/overlay.js", ["overlay.js", "text/javascript; charset=utf-8"]],
]);

export function createObsServer() {
  let captions = {};
  const listeners = new Set();
  const snapshot = () => `data: ${JSON.stringify(captions)}\n\n`;
  const publish = () => {
    for (const listener of listeners) {
      if (!listener.write(snapshot())) listener.destroy();
    }
  };
  const heartbeat = setInterval(() => {
    for (const listener of listeners) listener.write(": heartbeat\n\n");
  }, 15000);
  heartbeat.unref();

  const server = http.createServer(async (req, res) => {
    const host = `127.0.0.1:${server.address().port}`;
    // Bind loopback AND reject other Host values (including DNS rebinding).
    if (req.headers.host !== host) { res.writeHead(403).end(); return; }
    const origin = req.headers.origin;
    const allowed = !origin || origin === `http://${host}` || /^chrome-extension:\/\/[a-p]{32}$/.test(origin);
    if (!allowed) { res.writeHead(403).end(); return; }
    res.setHeader("Cache-Control", "no-store");
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    }
    const pathname = new URL(req.url, `http://${host}`).pathname;
    if (pathname === "/captions" && req.method === "OPTIONS") {
      res.writeHead(204, {
        "Access-Control-Allow-Methods": "POST",
        "Access-Control-Allow-Headers": "Content-Type, X-Interpretab",
      }).end(); return;
    }
    if (pathname === "/captions" && req.method === "POST") {
      if (req.headers["x-interpretab"] !== "captions" ||
        req.headers["content-type"] !== "application/json") { res.writeHead(415).end(); return; }
      try {
        let body = "";
        for await (const chunk of req) {
          body += chunk;
          if (Buffer.byteLength(body) > 128 * 1024) { res.writeHead(413).end(); return; }
        }
        const events = JSON.parse(body);
        if (!Array.isArray(events) || events.length > 3 || events.some((event) =>
          !event || (event.type !== "clear" && !(event.type === "caption" &&
            ["tab", "mic"].includes(event.direction) && typeof event.text === "string" &&
            event.text.length <= 20000)))) { res.writeHead(400).end(); return; }
        for (const event of events) {
          if (event.type === "clear") captions = {};
          else captions[event.direction] = { text: event.text, updatedAt: Date.now() };
        }
        publish();
        res.writeHead(204).end();
      } catch { if (!res.headersSent) res.writeHead(400).end(); }
      return;
    }
    if (req.method !== "GET") { res.writeHead(405).end(); return; }
    if (pathname === "/events") {
      res.writeHead(200, { "Content-Type": "text/event-stream", "X-Accel-Buffering": "no" });
      res.write(snapshot());
      listeners.add(res);
      res.on("close", () => listeners.delete(res));
      return;
    }
    const file = files.get(pathname);
    if (!file) { res.writeHead(404).end(); return; }
    try {
      const body = await readFile(path.join(ROOT, file[0]));
      res.writeHead(200, {
        "Content-Type": file[1],
        "Content-Security-Policy": "default-src 'self'; style-src 'self' 'unsafe-inline'; frame-ancestors 'none'",
      }).end(body);
    } catch { res.writeHead(500).end(); }
  });
  server.on("close", () => clearInterval(heartbeat));
  return server;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const server = createObsServer();
  server.on("error", (error) => { console.error(`OBS server: ${error.message}`); process.exitCode = 1; });
  server.listen(8765, "127.0.0.1", () => console.log("OBS captions: http://127.0.0.1:8765/"));
  for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => {
    server.close(); server.closeAllConnections();
  });
}
