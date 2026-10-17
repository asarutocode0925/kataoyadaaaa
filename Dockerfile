# ASCII only on purpose: no encoding problems when this file is edited on a phone.
# Stage 1: install everything, check the files, build the browser bundle.
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci --no-audit --no-fund || npm install --no-audit --no-fund

# Take only top-level .js and .html files from the repository.
# (Never node_modules, never folders, so a stray local node_modules cannot break the build.)
COPY . /tmp/src
RUN find /tmp/src -maxdepth 1 -type f \( -name '*.js' -o -name '*.html' \) -exec cp {} /app/ \;

# Preflight: stop early with a message that says exactly what is wrong.
RUN set -e; \
    missing=""; \
    for f in index.html server.js shared-game.js client-main.js client-view.js client-audio.js client-admin.js client-settings.js; do \
      [ -f "/app/$f" ] || missing="$missing $f"; \
    done; \
    if [ -n "$missing" ]; then \
      echo "ERROR: missing files:$missing"; \
      echo "HINT: upload ALL files to the TOP of the repository. Do not use folders."; \
      echo "Top-level entries found in the repository:"; ls -1 /tmp/src; \
      exit 1; \
    fi; \
    if ! grep -q "client-main.js" /app/index.html; then \
      echo "ERROR: index.html is an OLD version. Replace it with the new index.html."; \
      exit 1; \
    fi; \
    for m in express compression socket.io vite three socket.io-client; do \
      [ -d "/app/node_modules/$m" ] || { echo "ERROR: package.json is OLD (dependency missing: $m). Replace package.json and package-lock.json."; exit 1; }; \
    done; \
    echo "preflight ok"

RUN npx vite build && test -f dist/index.html

# Stage 2: small runtime image (no vite, no three).
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund

COPY --from=build /app/server.js /app/shared-game.js ./
COPY --from=build /app/dist ./dist

# Boot test: start the server once while building. If it cannot start, the build fails here
# (instead of deploying a broken app).
# hadolint ignore=DL3001
RUN PORT=8099 node server.js > /tmp/smoke.log 2>&1 & \
    pid=$!; \
    ok=0; html=""; \
    for _ in 1 2 3 4 5 6 7 8 9 10; do \
      health=$(wget -q -O - http://127.0.0.1:8099/healthz 2>/dev/null || true); \
      if [ "$health" = "ok" ]; then ok=1; break; fi; \
      sleep 1; \
    done; \
    if [ "$ok" = "1" ]; then html=$(wget -q -O - http://127.0.0.1:8099/ 2>/dev/null || true); fi; \
    kill "$pid" 2>/dev/null || true; \
    if [ "$ok" != "1" ]; then echo "SMOKE TEST FAILED: the server did not start"; cat /tmp/smoke.log; exit 1; fi; \
    case "$html" in *"<!doctype"*|*"<!DOCTYPE"*|*"<html"*) ;; *) echo "SMOKE TEST FAILED: the page was not served"; exit 1;; esac; \
    echo "smoke test passed"

EXPOSE 8080
CMD ["node", "server.js"]
