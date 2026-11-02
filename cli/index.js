#!/usr/bin/env node
import { createServer } from "node:http";
import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, watch, writeFileSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { zipSync } from "fflate";

const here = dirname(fileURLToPath(import.meta.url));
const pkg = resolve(here, "..");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".mp3": "audio/mpeg",
  ".ogg": "audio/ogg",
  ".wav": "audio/wav",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
};

const LIMITS = { archive: 5 << 20, unpacked: 50 << 20, files: 1000, file: 10 << 20 };

const HELP = `eolymp-widget — build widget problems for Eolymp

  eolymp-widget init [dir]              create a starter widget in dir (default: ./widget)
  eolymp-widget dev [dir] [--port N]    run the widget in a local host that behaves like Eolymp
  eolymp-widget dev --url <url>         host a widget served elsewhere (e.g. a Vite dev server)
  eolymp-widget pack [dir] [-o file]    check the folder against the platform rules and zip it

Docs: https://github.com/eolymp/widget-sdk#readme`;

function args(list) {
  const out = { _: [] };
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (a === "--port" || a === "-p") out.port = Number(list[++i]);
    else if (a === "--url") out.url = list[++i];
    else if (a === "-o" || a === "--out") out.out = list[++i];
    else if (a === "--entry") out.entry = list[++i];
    else if (a === "--force") out.force = true;
    else if (a === "-h" || a === "--help") out.help = true;
    else out._.push(a);
  }
  return out;
}

function walk(root) {
  const files = [];
  const skipped = [];
  const visit = (dir) => {
    for (const name of readdirSync(dir).sort()) {
      const full = join(dir, name);
      const rel = relative(root, full).split(sep).join("/");
      if (name.startsWith(".") || name === "node_modules" || name === "__MACOSX") {
        skipped.push(rel);
        continue;
      }
      const stat = lstatSync(full);
      if (stat.isSymbolicLink()) files.push({ path: rel, full, symlink: true, size: 0 });
      else if (stat.isDirectory()) visit(full);
      else files.push({ path: rel, full, size: stat.size });
    }
  };
  visit(root);
  return { files, skipped };
}

function check(root, entry) {
  const errors = [];
  const warnings = [];
  const all = walk(root).files;
  const files = all.filter((f) => !/\.md$/i.test(f.path));
  const docs = all.filter((f) => /\.md$/i.test(f.path)).map((f) => f.path);

  if (existsSync(join(root, "package.json"))) {
    errors.push(
      "this folder has a package.json, so it looks like a project rather than a build. Pack the build output instead (for Vite: `eolymp-widget pack dist`).",
    );
    return { files, docs, errors, warnings, total: 0 };
  }

  if (!files.some((f) => f.path === entry)) {
    errors.push(`${entry} not found — it is the page Eolymp loads`);
  }

  if (files.length > LIMITS.files) errors.push(`${files.length} files; at most ${LIMITS.files} are accepted`);

  let total = 0;
  let client = false;
  for (const f of files) {
    total += f.size;
    if (f.symlink) errors.push(`${f.path} is a symbolic link`);
    if (!TYPES[extname(f.path).toLowerCase()]) errors.push(`${f.path} has an unsupported file type`);
    if (f.size > LIMITS.file) errors.push(`${f.path} is ${mb(f.size)}; at most ${mb(LIMITS.file)} per file`);

    if (/\.(html?|m?js|css)$/i.test(f.path) && !f.symlink) {
      const text = readFileSync(f.full, "utf8");
      if (text.includes("eolymp.widget.v1")) client = true;

      for (const m of text.matchAll(/(?:src|href)\s*=\s*["'](https?:)?\/\/[^"']+|url\(\s*["']?https?:\/\/[^)"']+|from\s+["']https?:\/\/[^"']+|import\(\s*["']https?:\/\/[^"']+|fetch\(\s*["']https?:\/\/[^"']+/g)) {
        if (/^(?:src|href)\s*=\s*["']https?:\/\/www\.w3\.org/.test(m[0])) continue;
        warnings.push(`${f.path}: "${m[0].slice(0, 80)}" — the widget is sandboxed and cannot load anything from outside the archive`);
      }

      if (/\.html?$/i.test(f.path)) {
        for (const m of text.matchAll(/(?:src|href)\s*=\s*["'](\/(?!\/)[^"']*)["']/g)) {
          errors.push(`${f.path}: "${m[1]}" is an absolute path; use a relative one ("./${m[1].replace(/^\/+/, "")}"). For Vite set \`base: "./"\`.`);
        }
      }
    }
  }

  if (total > LIMITS.unpacked) errors.push(`unpacked size is ${mb(total)}; at most ${mb(LIMITS.unpacked)}`);
  if (!client) warnings.push("no widget client found — include widget-sdk.js (or import @eolymp/widget-sdk) and call eolymp.widget(...)");

  return { files, docs, errors, warnings, total };
}

function mb(n) {
  return n < 1024 * 1024 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function pack(opts) {
  const root = resolve(opts._[0] ?? ".");
  const entry = opts.entry ?? "index.html";
  const { files, docs, errors, warnings, total } = check(root, entry);

  if (docs.length) console.log(`skipped ${docs.join(", ")} (Markdown is not served)`);
  for (const w of warnings) console.warn(`warning: ${w}`);
  if (errors.length && !opts.force) {
    for (const e of errors) console.error(`error: ${e}`);
    console.error(`\n${errors.length} problem(s); nothing was written.`);
    process.exit(1);
  }

  const zip = zipSync(Object.fromEntries(files.map((f) => [f.path, readFileSync(f.full)])), { level: 9 });
  const out = resolve(opts.out ?? `${basename(root) || "widget"}.zip`);

  if (zip.length > LIMITS.archive) {
    console.error(`error: the archive is ${mb(zip.length)}; at most ${mb(LIMITS.archive)} is accepted`);
    process.exit(1);
  }

  writeFileSync(out, zip);
  console.log(`${relative(process.cwd(), out) || out}: ${files.length} files, ${mb(total)} unpacked, ${mb(zip.length)} zipped`);
  console.log("Upload it in the console: Problems → your problem → Widget.");
}

function init(opts) {
  const target = resolve(opts._[0] ?? "widget");
  if (existsSync(target) && readdirSync(target).length && !opts.force) {
    console.error(`error: ${target} is not empty (use --force to write into it anyway)`);
    process.exit(1);
  }
  mkdirSync(target, { recursive: true });
  cpSync(join(pkg, "template"), target, { recursive: true });
  mkdirSync(join(target, "lib"), { recursive: true });
  cpSync(join(pkg, "dist", "widget-sdk.js"), join(target, "lib", "widget-sdk.js"));
  cpSync(join(pkg, "dist", "style.css"), join(target, "lib", "widget-sdk.css"));
  cpSync(join(pkg, "AGENTS.md"), join(target, "AGENTS.md"));

  const rel = relative(process.cwd(), target) || ".";
  console.log(`Created ${rel}. Next:\n\n  npx @eolymp/widget-sdk dev ${rel}\n  npx @eolymp/widget-sdk pack ${rel}\n`);
}

function dev(opts) {
  const root = resolve(opts._[0] ?? ".");
  const port = opts.port || 4300;
  const harness = readFileSync(join(here, "harness.html"), "utf8");
  const clients = new Set();

  if (!opts.url && !existsSync(root)) {
    console.error(`error: ${root} does not exist`);
    process.exit(1);
  }

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? "/", "http://localhost");

    if (url.pathname === "/" || url.pathname === "/index.html") {
      const src = opts.url ?? `/w/${opts.entry ?? "index.html"}`;
      res.writeHead(200, { "content-type": TYPES[".html"], "cache-control": "no-store" });
      res.end(harness.replace("__WIDGET_SRC__", JSON.stringify(src)));
      return;
    }

    if (url.pathname === "/__events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write("retry: 1000\n\n");
      clients.add(res);
      req.on("close", () => clients.delete(res));
      return;
    }

    if (url.pathname.startsWith("/w/") && !opts.url) {
      const rel = decodeURIComponent(url.pathname.slice(3));
      const full = resolve(root, rel);
      if (!full.startsWith(root + sep) || !existsSync(full) || lstatSync(full).isDirectory()) {
        res.writeHead(404).end("not found");
        return;
      }
      const type = TYPES[extname(full).toLowerCase()];
      if (!type) {
        res.writeHead(415).end(`${rel}: this file type is refused by Eolymp`);
        return;
      }
      const self = `http://${req.headers.host}`;
      res.writeHead(200, {
        "content-type": type,
        "cache-control": "no-store",
        "content-security-policy": `sandbox allow-scripts allow-forms; default-src ${self} data: blob: 'unsafe-inline'; script-src ${self} 'unsafe-inline'`,
      });
      res.end(readFileSync(full));
      return;
    }

    res.writeHead(404).end("not found");
  });

  if (!opts.url) {
    let timer;
    watch(root, { recursive: true }, () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const c of clients) c.write("data: reload\n\n");
      }, 100);
    });
  }

  server.listen(port, () => {
    console.log(`Widget host: http://localhost:${port}`);
    console.log(opts.url ? `Hosting ${opts.url}` : `Serving ${relative(process.cwd(), root) || "."}, reloading on change`);
  });
}

const opts = args(process.argv.slice(3));
const command = process.argv[2];

if (!command || opts.help || command === "help") console.log(HELP);
else if (command === "init") init(opts);
else if (command === "dev") dev(opts);
else if (command === "pack") pack(opts);
else {
  console.error(`unknown command "${command}"\n\n${HELP}`);
  process.exit(1);
}
