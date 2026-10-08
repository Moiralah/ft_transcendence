# Vault: secrets kept on solsys, not in `.env`

Picture: `diagram/vault-remote-env.html`. Everything below was rehearsed on a laptop
first (2026-10-08). Two places hold secrets, both on solsys, in one server-mode Vault:

| Path | Who can read it | Used by |
|---|---|---|
| `secret/family-tree/prod` | the production backend (AppRole `backend`) and the admin | `make prod` / `make deploy` |
| `secret/family-tree/dev` | every teammate (userpass, policy `dev-read`) and the admin | `make up` on laptops |

The unseal key is split into 5 shares (Tiara, solsys, Yiwei, Jon, Moira); any 2 open Vault.

## Everyday commands

| Command | Where | What it does |
|---|---|---|
| `make up` | your laptop, WireGuard on | logs in to Vault (password once a day), loads the dev secrets into memory, starts the app on local Supabase at https://localhost:3000 |
| `make up-env` | your laptop | the old way, values from `.env`; for when Vault or WireGuard is down |
| `make deploy` | your laptop (needs SSH to solsys) | pulls `branchsaurus` on solsys and runs `make prod` there |
| `make unseal` | any share holder's laptop, WireGuard on | type your share after solsys restarts; solsys adds its own |

After a reboot of solsys the pages still load, but the API answers 502 (nobody can log in)
until Vault is unsealed. It comes back by itself within seconds of the second share;
no redeploy needed.

## Switch day on solsys (one time, with Tiara there)

Run in `~/ft_transcendence`, after this work is merged into `branchsaurus` and pulled.

1. Add Vault to `docker-compose.home.yml` (untracked, solsys only), so laptops can reach it
   through WireGuard and nothing else can:
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
3. Keep solsys's share where `make prod` looks for it, owner-only:
   `mkdir -m 700 ~/.ft-vault && (umask 077; echo '<share 2>' > ~/.ft-vault/unseal-share)`
4. Move the production secrets in, and give the backend its login:
   ```sh
   VAULT_USER=tiara scripts/vault/put-secrets.sh prod .env
   VAULT_USER=tiara scripts/vault/backend-creds.sh  # writes vault/backend-approle.env
   ```
   Then the dev secrets (`put-secrets.sh dev <file>`; today only `JWT_SECRET`).
5. `make prod`. It now sees `vault/backend-approle.env` and uses the server-mode Vault.
   Check https://ft.natscho.my, then remove the secret lines from `.env`.
6. Hand each person their share and their initial password (in person, never in chat),
   then **delete `~/vault-init.json` and `~/vault-passwords.txt`**. Each person changes
   their password.

Undo, if something goes wrong before step 6: `mv vault/backend-approle.env ~/` and
`make prod`. That is the old dev-mode Vault refilled from `.env`, exactly as before.

## Rotating

- A secret: `put-secrets.sh prod <file> KEY`, then `make prod`. Vault keeps old versions.
- The backend's login: `backend-creds.sh`, then `make prod` (older logins are revoked).
- A teammate leaving: the admin deletes their user (`auth/userpass/users/<name>`), and
  the 5 shares are re-made with `vault operator rekey`.
