# Vault: secrets kept on solsys, not in `.env`

Picture: `diagram/vault-remote-env.html`. Everything below was rehearsed on a laptop
first (2026-10-08). Two places hold secrets, both on solsys, in one server-mode Vault:

| Path | Who can read it | Used by |
|---|---|---|
| `secret/family-tree/prod` | the production backend (AppRole `backend`) and the admin | `make prod` / `make deploy` |
| `secret/family-tree/dev` | every teammate (userpass, policy `dev-read`) and the admin | `make up` on laptops |

Both use the **production Supabase** (decided 2026-10-12): the dev set holds the same
database URLs, auth URL and service key as production, with its **own `JWT_SECRET`** (so a
login made on a laptop is not valid on ft.natscho.my) and **no `SMTP_PASS`** (a laptop
never emails real users; the feedback form answers "temporarily unavailable"). So every
teammate's `make up` works on the real users' data: test on your own test trees and
accounts. Vault's audit log records every read, and the values stay in memory only.
Removing someone then also means rotating the database password and the service key.

The unseal key is split into 5 shares (Tiara, solsys, Yiwei, Jon, Moira); any 2 open Vault.

## Everyday commands

| Command | Where | What it does |
|---|---|---|
| `make up` | your laptop, `VAULT_USER` set | opens your SSH tunnel, logs in to Vault (password once a day), loads the dev secrets into memory, starts the app, both WAFs and the local Vault at https://localhost:8443 |
| `make up` | without `VAULT_USER` (evaluators, 42 machines) | the same stack, values from `.env` |
| `make local` | any machine | like `make up`, on a local Supabase (test data only); not the team's way of working |
| `make deploy` | your laptop (needs SSH to solsys) | pulls `branchsaurus` on solsys and runs `make prod` there |
| `make unseal` | any share holder's laptop | type your share after solsys restarts (through your SSH tunnel); solsys adds its own (cron, every minute) |

## Your access (each person, one time)

Nobody's laptop is on WireGuard. Each person reaches Vault through their **own SSH
tunnel**: their own account on the GCP proxy (`tching`, `huidris`, `lechan`, `yiwei`, the
same names as the Vault logins) can only forward to Vault on solsys (10.8.0.1:8200), with
no shell and no password. Nobody has an account on solsys. `make up` opens the tunnel by
itself.

1. Make a key for this (or reuse yours) and send Tiara the **`.pub`** file only:
   `ssh-keygen -t ed25519 -f ~/.ssh/ft_vault -C ft-vault`
2. Tiara adds it: `scripts/vault/tunnel-key.sh add <login> <login>.pub`
   (`list` shows the accounts and who has a key, `remove <login>` deletes the account).
3. In `~/.zshrc`: `export VAULT_USER=<login>` and `export VAULT_SSH_KEY=~/.ssh/ft_vault`.
4. In `.env`, leave the secret lines empty (`JWT_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`,
   `DATABASE_URL`, `DIRECT_URL`, `SUPABASE_AUTH_URL`, `SMTP_PASS`) and set the public ones
   to the production project: `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   (not secret, Tiara sends them). Then run `make up`. The first time it asks your Vault
   password (from Tiara, in person); change it after.

After a reboot of solsys the pages still load, but the API answers 502 (nobody can log in)
until Vault is unsealed. It comes back by itself within seconds of the second share;
no redeploy needed.

## Switch day on solsys (one time, with Tiara there)

Run in `~/ft_transcendence`, after this work is merged into `branchsaurus` and pulled.

1. Add Vault to `docker-compose.home.yml` (untracked, solsys only), so the GCP proxy can
   reach it over WireGuard (for the teammates' SSH tunnels) and nothing else can:
   ```yaml
     vault:
       ports: !override
         - "127.0.0.1:8200:8200"
         - "10.8.0.1:8200:8200"
   ```
2. Start the new Vault (sealed, empty) and set it up:
   ```sh
   F="-f docker-compose.yml -f docker-compose-security.yml -f docker-compose.prod.yml -f docker-compose.vault-server.yml -f docker-compose.home.yml"
   docker compose $F up -d vault
   export VAULT_CONTAINER=ft_transcendence-vault-1 VAULT_ADDR=http://127.0.0.1:8200
   scripts/vault/init.sh ~/vault-init.json          # 5 shares + root token
   scripts/vault/unseal.sh                          # type any 2 shares
   scripts/vault/configure.sh ~/vault-init.json ~/vault-passwords.txt   # revokes the root token
   ```
3. Keep solsys's share where `make prod` looks for it, owner-only, and let solsys add it
   by itself after a reboot (so one teammate's `make unseal` is enough; without this, a
   reboot needs two people, or someone with SSH running `make prod`):
   ```sh
   mkdir -m 700 ~/.ft-vault && (umask 077; echo '<share 2>' > ~/.ft-vault/unseal-share)
   crontab -e   # add:
   * * * * * cd ~/ft_transcendence && VAULT_ADDR=http://127.0.0.1:8200 VAULT_LOCAL_SHARE_FILE=$HOME/.ft-vault/unseal-share scripts/vault/unseal.sh --machine-only >/dev/null 2>&1
   ```
4. Move the production secrets in, and give the backend its login:
   ```sh
   VAULT_USER=tching scripts/vault/put-secrets.sh prod .env
   VAULT_USER=tching scripts/vault/backend-creds.sh  # writes vault/backend-approle.env
   ```
   Then the dev secrets: production's Supabase values plus a new `JWT_SECRET`, no
   `SMTP_PASS` (see the top of this file). The file is owner-only and deleted at once:
   ```sh
   (umask 077; grep -E '^(SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|SUPABASE_AUTH_URL)=' .env > ~/dev.env
    echo "JWT_SECRET=$(openssl rand -hex 32)" >> ~/dev.env)
   VAULT_USER=tching scripts/vault/put-secrets.sh dev ~/dev.env JWT_SECRET SUPABASE_SERVICE_ROLE_KEY DATABASE_URL DIRECT_URL SUPABASE_AUTH_URL
   rm ~/dev.env
   ```
5. `make prod`. It now sees `vault/backend-approle.env` and uses the server-mode Vault.
   Check https://ft.natscho.my, then remove the secret lines from `.env`.
6. Hand each person their share and their initial password (in person, never in chat),
   then **delete `~/vault-init.json` and `~/vault-passwords.txt`**. Each person changes
   their password.

Undo, if something goes wrong before step 6: `mv vault/backend-approle.env ~/` and
`make prod`. That is the old dev-mode Vault refilled from `.env`, exactly as before.

## Rotating

- A secret: `put-secrets.sh prod <file> KEY`, then `make prod`. Vault keeps old versions.
  Only the named key changes; the others stay. A rotated Supabase value or database
  password must go into dev too (same project): `put-secrets.sh dev <file> KEY`.
- The backend's login: `backend-creds.sh`, then `make prod` (older logins are revoked).
- A teammate leaving: the admin deletes their user (`auth/userpass/users/<name>`), and
  the 5 shares are re-made with `vault operator rekey`.
