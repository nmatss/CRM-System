#!/usr/bin/env node
/**
 * Brings up the end-to-end environment the way production actually runs:
 * the application behind a TLS-terminating proxy.
 *
 * This matters for more than realism. The session cookie is `Secure` and the
 * production CSP emits `upgrade-insecure-requests`; over plain HTTP only
 * Chromium tolerates both, which used to limit the suite to one browser and
 * forced every API call through the page's own `fetch`. Terminating TLS here
 * lets Chromium, Firefox and WebKit all run the full suite against the real
 * production build.
 *
 * Everything lives in a disposable directory: a fresh database, a fresh
 * self-signed certificate, both discarded with the run.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createServer } from "node:https";
import { request as httpRequest } from "node:http";
import { join } from "node:path";

const dataDir = process.env.E2E_DATA_DIR;
if (!dataDir) {
  console.error("E2E_DATA_DIR must be set");
  process.exit(1);
}

const publicPort = Number(process.env.PORT ?? 5273);
// The application itself stays on plain HTTP, reachable only from this process.
const appPort = publicPort + 1;

rmSync(dataDir, { recursive: true, force: true });
mkdirSync(dataDir, { recursive: true });

const keyPath = join(dataDir, "e2e-key.pem");
const certPath = join(dataDir, "e2e-cert.pem");

/** A throwaway certificate for 127.0.0.1; the browsers are told to accept it. */
function ensureCertificate() {
  if (existsSync(keyPath) && existsSync(certPath)) return;
  try {
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-keyout",
        keyPath,
        "-out",
        certPath,
        "-days",
        "2",
        "-subj",
        "/CN=127.0.0.1",
        "-addext",
        "subjectAltName=IP:127.0.0.1,DNS:localhost",
      ],
      { stdio: ["ignore", "ignore", "pipe"] },
    );
  } catch (error) {
    console.error(
      "Failed to generate the end-to-end certificate. openssl is required to run this suite.",
    );
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  }
}

function run(command, args, extraEnv = {}) {
  return spawn(command, args, {
    stdio: ["ignore", "inherit", "inherit"],
    env: { ...process.env, ...extraEnv },
  });
}

async function seed() {
  return new Promise((resolve, reject) => {
    const child = run("npx", ["tsx", "e2e/scripts/seed-e2e.ts"]);
    child.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(`Seed failed with exit code ${code}`)),
    );
    child.on("error", reject);
  });
}

let app;
let proxy;

function shutdown(code) {
  proxy?.close();
  if (app && !app.killed) app.kill("SIGTERM");
  process.exit(code);
}

process.on("SIGTERM", () => shutdown(0));
process.on("SIGINT", () => shutdown(0));

ensureCertificate();

await seed();

app = run("node", ["dist/index.cjs"], { PORT: String(appPort) });
app.on("exit", (code) => {
  console.error(`Application exited with code ${code}`);
  shutdown(code ?? 1);
});

proxy = createServer(
  { key: readFileSync(keyPath), cert: readFileSync(certPath) },
  (clientRequest, clientResponse) => {
    const upstream = httpRequest(
      {
        host: "127.0.0.1",
        port: appPort,
        method: clientRequest.method,
        path: clientRequest.url,
        headers: {
          ...clientRequest.headers,
          // What a real TLS-terminating proxy tells the application.
          "x-forwarded-proto": "https",
          "x-forwarded-for": clientRequest.socket.remoteAddress ?? "127.0.0.1",
          "x-forwarded-host": clientRequest.headers.host ?? `127.0.0.1:${publicPort}`,
        },
      },
      (upstreamResponse) => {
        clientResponse.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
        upstreamResponse.pipe(clientResponse);
      },
    );

    upstream.on("error", (error) => {
      if (!clientResponse.headersSent) clientResponse.writeHead(502);
      clientResponse.end(`Proxy error: ${error.message}`);
    });

    clientRequest.pipe(upstream);
  },
);

proxy.listen(publicPort, "127.0.0.1", () => {
  console.log(`[e2e] TLS proxy listening on https://127.0.0.1:${publicPort} -> :${appPort}`);
});
