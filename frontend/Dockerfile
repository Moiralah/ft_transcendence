FROM node:22-alpine AS dev
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Production target — not used by local `make up`/`make security` (docker-compose.yml
# pins `target: dev` explicitly and bind-mounts source over this anyway). Used by
# docker-compose.prod.yml.
#
# Serves plain HTTP internally, not HTTPS like the dev target does. `next start` doesn't
# support `--experimental-https` at all — it's dev-only (Next.js's own docs). The WAF
# terminates TLS publicly and reverse-proxies to this over the Docker network; :3000 is
# never published externally in the security stack, so there's no exposure from dropping
# TLS on this internal hop.
FROM node:22-alpine AS prod
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# NEXT_PUBLIC_* values are baked into the client bundle at build time (Next.js
# substitutes them in `next build`, not read at container start) — lib/supabaseClient.js
# creates its client unconditionally at module load, which Next's build-time static
# prerender pass actually executes, so these must be real values here, not just set on
# the running container. Passed in via docker-compose.prod.yml's build.args.
ARG NEXT_PUBLIC_SUPABASE_URL
ARG NEXT_PUBLIC_SUPABASE_ANON_KEY
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
ENV NEXT_PUBLIC_SUPABASE_ANON_KEY=$NEXT_PUBLIC_SUPABASE_ANON_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
RUN npm run build
EXPOSE 3000
CMD ["npm", "run", "start"]
