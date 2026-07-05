const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const rootDir = __dirname;
const dataDir = path.join(rootDir, "data");
const statePath = path.join(dataDir, "state.json");
const port = Number(process.env.PORT || 4173);
const host = process.env.HOST || "0.0.0.0";
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY;
const supabaseStateId = process.env.SUPABASE_STATE_ID || "main";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
};

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_000_000) {
        request.destroy();
        reject(new Error("Request body too large"));
      }
    });
    request.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    request.on("error", reject);
  });
}

function readSeedBooks() {
  const seedPath = path.join(rootDir, "seed-data.js");
  const seedSource = fs.readFileSync(seedPath, "utf8");
  const jsonText = seedSource
    .replace(/^window\.THREE_BOOKWORMS_FINISHED_BOOKS\s*=\s*/, "")
    .replace(/;\s*$/, "");
  return JSON.parse(jsonText);
}

function initialState() {
  const finishedBooks = readSeedBooks();
  return {
    people: [
      {
        id: "yuki",
        name: "Yuki",
        avatar: "Y",
        avatarColor: "#d9c8ff",
        currentBook: null,
        finishedBooks: finishedBooks.yuki || [],
      },
      {
        id: "momo",
        name: "Momo",
        avatar: "M",
        avatarColor: "#9fd8ff",
        currentBook: null,
        finishedBooks: finishedBooks.momo || [],
      },
      {
        id: "lusi",
        name: "Lusi",
        avatar: "L",
        avatarColor: "#ff9cc6",
        currentBook: null,
        finishedBooks: finishedBooks.lusi || [],
      },
    ],
  };
}

function hasSupabase() {
  return Boolean(supabaseUrl && supabaseKey);
}

function supabaseHeaders(prefer) {
  const headers = {
    apikey: supabaseKey,
    Authorization: `Bearer ${supabaseKey}`,
    "Content-Type": "application/json",
  };
  if (prefer) headers.Prefer = prefer;
  return headers;
}

async function readSupabaseState() {
  const endpoint = `${supabaseUrl}/rest/v1/app_state?id=eq.${encodeURIComponent(supabaseStateId)}&select=state`;
  const response = await fetch(endpoint, {
    headers: supabaseHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Supabase read failed: ${response.status}`);
  }

  const rows = await response.json();
  if (Array.isArray(rows[0]?.state?.people) && rows[0].state.people.length > 0) {
    return rows[0].state;
  }

  const seeded = initialState();
  await writeSupabaseState(seeded);
  return seeded;
}

async function writeSupabaseState(nextState) {
  if (!Array.isArray(nextState.people)) {
    throw new Error("Invalid state");
  }

  const cleanState = { people: nextState.people };
  const endpoint = `${supabaseUrl}/rest/v1/app_state`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: supabaseHeaders("resolution=merge-duplicates,return=representation"),
    body: JSON.stringify({
      id: supabaseStateId,
      state: cleanState,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Supabase write failed: ${response.status}`);
  }

  const rows = await response.json();
  return rows[0]?.state || cleanState;
}

function ensureStateFile() {
  fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(statePath)) {
    fs.writeFileSync(statePath, JSON.stringify(initialState(), null, 2));
  }
}

function readState() {
  ensureStateFile();
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function writeState(nextState) {
  if (!Array.isArray(nextState.people)) {
    throw new Error("Invalid state");
  }

  const cleanState = { people: nextState.people };
  fs.writeFileSync(statePath, JSON.stringify(cleanState, null, 2));
  return cleanState;
}

async function readAppState() {
  return hasSupabase() ? await readSupabaseState() : readState();
}

async function writeAppState(nextState) {
  return hasSupabase() ? await writeSupabaseState(nextState) : writeState(nextState);
}

function normalizeBookComments(state) {
  return {
    people: state.people.map((person) => ({
      ...person,
      finishedBooks: person.finishedBooks.map((book) => ({
        ...book,
        comments: Array.isArray(book.comments) ? book.comments : [],
      })),
    })),
  };
}

function echoesFromState(state) {
  return normalizeBookComments(state).people
    .flatMap((person) =>
      person.finishedBooks
        .filter((book) => book.note?.body)
        .map((book) => ({
          id: book.id,
          noteId: book.id,
          bookId: book.id,
          userId: person.id,
          userName: person.name,
          title: book.title,
          author: book.author || "",
          finishedAt: book.finishedAt,
          stars: book.stars || 0,
          note: book.note,
          comments: book.comments,
        })),
    )
    .sort((a, b) => new Date(`${b.finishedAt || "1900-01-01"}T00:00:00`) - new Date(`${a.finishedAt || "1900-01-01"}T00:00:00`));
}

function commentsFromState(state, bookId) {
  return echoesFromState(state)
    .filter((echo) => !bookId || echo.bookId === bookId)
    .flatMap((echo) =>
      echo.comments.map((comment) => ({
        ...comment,
        noteId: comment.noteId || echo.bookId,
        bookId: comment.bookId || echo.bookId,
      })),
    )
    .sort((a, b) => new Date(a.createdAt || 0) - new Date(b.createdAt || 0));
}

function appendComment(state, comment) {
  const safeComment = {
    id: comment.id || `comment-${crypto.randomUUID()}`,
    noteId: comment.noteId || comment.bookId,
    bookId: comment.bookId || comment.noteId,
    userId: comment.userId,
    userName: comment.userName,
    content: String(comment.content || "").trim(),
    createdAt: comment.createdAt || new Date().toISOString(),
  };

  if (!safeComment.bookId || !safeComment.userId || !safeComment.content) {
    throw new Error("Invalid comment");
  }

  let found = false;
  const nextState = normalizeBookComments(state);
  nextState.people = nextState.people.map((person) => ({
    ...person,
    finishedBooks: person.finishedBooks.map((book) => {
      if (book.id !== safeComment.bookId) return book;
      found = true;
      return {
        ...book,
        comments: [...book.comments, safeComment],
      };
    }),
  }));

  if (!found) throw new Error("Book not found");
  return nextState;
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  response.end(JSON.stringify(payload));
}

function sendStatic(request, response, pathname) {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  const rolePaths = new Set(["yuki", "momo", "lusi"]);
  const safePath = pathname === "/" || rolePaths.has(firstSegment) ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(rootDir, safePath));

  if (!filePath.startsWith(rootDir) || filePath.startsWith(dataDir)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || "application/octet-stream",
    });
    response.end(content);
  });
}

function printUrls() {
  const addresses = [];
  for (const network of Object.values(os.networkInterfaces())) {
    for (const info of network || []) {
      if (info.family === "IPv4" && !info.internal) {
        addresses.push(`http://${info.address}:${port}`);
      }
    }
  }

  console.log(`三只书虫已启动: http://localhost:${port}`);
  for (const address of addresses) {
    console.log(`手机同 Wi-Fi 可访问: ${address}`);
  }
  console.log("专属入口示例: /yuki /momo /lusi");
}

if (!hasSupabase()) {
  ensureStateFile();
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);

  try {
    if (url.pathname === "/api/state" && request.method === "GET") {
      sendJson(response, 200, normalizeBookComments(await readAppState()));
      return;
    }

    if (url.pathname === "/api/state" && request.method === "PUT") {
      const body = await readJsonBody(request);
      sendJson(response, 200, await writeAppState(normalizeBookComments(body)));
      return;
    }

    if (url.pathname === "/api/echoes" && request.method === "GET") {
      sendJson(response, 200, { echoes: echoesFromState(await readAppState()) });
      return;
    }

    if (url.pathname === "/api/comments" && request.method === "GET") {
      sendJson(response, 200, {
        comments: commentsFromState(await readAppState(), url.searchParams.get("bookId")),
      });
      return;
    }

    if (url.pathname === "/api/comments" && request.method === "POST") {
      const body = await readJsonBody(request);
      const nextState = appendComment(await readAppState(), body);
      sendJson(response, 200, await writeAppState(nextState));
      return;
    }

    sendStatic(request, response, decodeURIComponent(url.pathname));
  } catch (error) {
    sendJson(response, 500, { error: error.message });
  }
});

server.listen(port, host, printUrls);
