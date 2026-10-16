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
| `make up` | without `VAULT_USER` (evaluators, anyone without a login) | the same stack, values from `.env` |
| `make local` | any machine | like `make up`, on a local Supabase (test data only); not the team's way of working |
| `make deploy` | your laptop (needs SSH to solsys) | pulls `branchsaurus` on solsys and runs `make prod` there |
| `make unseal` | any share holder's laptop | type your share after solsys restarts (through your SSH tunnel); solsys adds its own (cron, every minute) |

## Your access (each person, once per machine)

Nobody's laptop is on WireGuard. Each person reaches Vault through their **own SSH
tunnel**: their own account on the GCP proxy (`tching`, `huidris`, `lechan`, `yiwei`, the
same names as the Vault logins) can only forward to Vault on solsys (10.8.0.1:8200), with
no shell and no password. Nobody has an account on solsys. `make up` opens the tunnel by
itself. The same steps work on a laptop and on a 42 machine.

From Tiara you need: your Vault password (in person, never in chat) and the two public
Supabase values for `.env`.

**On a 42 machine:** the shell is zsh and pasted `#` comments break it, so none of the
commands below have any; paste them as they are. Your 42 home is kept between sessions,
so this is done once per 42 account. Replace `<login>` with yours everywhere.

### 1. Make a key on this machine

```sh
ssh-keygen -t ed25519 -f ~/.ssh/ft_vault -C ft-vault-<login>
cat ~/.ssh/ft_vault.pub
```

Send Tiara that one `.pub` line and say which machine it is for. It is a public key, so
chat is fine. **Never send or copy `~/.ssh/ft_vault`** (no `.pub`): that is the private
key. A second machine (your laptop and a 42 session) gets its own key, made on that
machine.

### 2. Tiara adds it (her Mac, from the repo)

The first key for a login:

```sh
scripts/vault/tunnel-key.sh add <login> <login>.pub
scripts/vault/tunnel-key.sh list
```

`list` should show `<login>: key set`. `add` **replaces** the account's key, so a
second machine's key is appended by hand instead, with the same restrictions:

```sh
KEY=$(cut -d' ' -f1,2 <login>-42.pub) && echo "$KEY"
ssh gcp "echo 'restrict,port-forwarding,permitopen=\"10.8.0.1:8200\",command=\"/usr/sbin/nologin\" $KEY ft-vault-<login>-42' | sudo tee -a /home/<login>/.ssh/authorized_keys >/dev/null && sudo ssh-keygen -lf /home/<login>/.ssh/authorized_keys"
```

The first command must print `ssh-ed25519 AAAA…` and nothing else. The second lists one
fingerprint per machine. `remove <login>` deletes the account with all its keys.

### 3. Check the key and the tunnel (once, before `make up`)

```sh
ssh -i ~/.ssh/ft_vault <login>@ft.natscho.my
```

The first time, it asks you to confirm GCP's host key. Type `yes` **only** if the
fingerprint is `SHA256:teGq/ElfqZAFyQoJ04Q7Z6fZbKrYtYXOcgr10b077Bg`. Then expect
`This account is currently not available.` and the connection closes. That is correct:
the key works and the account has no shell. `Permission denied (publickey)` means the key
isn't on your account yet, or this is a different key from the one you sent.

Then the tunnel itself, which is what `make up` opens:

```sh
ssh -N -o ExitOnForwardFailure=yes -i ~/.ssh/ft_vault -L 127.0.0.1:18201:10.8.0.1:8200 <login>@ft.natscho.my
```

It prints nothing and keeps running: that is the tunnel up. In a second terminal:

```sh
curl -s http://127.0.0.1:18201/v1/sys/seal-status
```

Expect a line with `"sealed":false`. Then press Ctrl-C in the first terminal. If the
`ssh` stops straight away with an error instead, look it up in the table below.

### 4. Shell settings

```sh
echo 'export VAULT_USER=<login> VAULT_SSH_KEY=~/.ssh/ft_vault' >> ~/.zshrc
source ~/.zshrc
echo "$VAULT_USER $VAULT_SSH_KEY"
```

The last line must print your login and the key's full path. `make up` uses Vault only
when `VAULT_USER` is set; without it, it silently falls back to `.env`.

### 5. `.env` and the first run

In a clone of the repo:

```sh
cp .env.example .env
```

In `.env`, set **only** `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
to the values from Tiara (production's, not secret). Leave every secret line empty, and
check:

```sh
grep -E '^(JWT_SECRET|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|SUPABASE_AUTH_URL|SMTP_PASS)=' .env
```

Every line must end in `=`. Then `make up`. Expect, in order:

1. `[vault] opening your SSH tunnel to Vault (<login>@ft.natscho.my)...`
2. `Vault password for <login> (input hidden):` type it; nothing shows
3. `[vault] Logged in as <login> …` then `[vault] Loaded 5 dev secrets from Vault (in memory only).`
4. the build, then all containers up; open https://localhost:8443

The password is asked once per 12 hours (the token is kept in `~/.vault-token`,
owner-only). Ask Tiara to update section 8 of the progress tracker once this works.

**Your password:** you can't change it yourself (your login may only read the dev
secrets). If you want a new one, Tiara sets it with the admin login. Never put it in a
file or a chat.

### When you're done (a 42 machine, or any machine you share)

```sh
make down
rm -f ~/.vault-token
pkill -f 'ssh -f -N .*@ft.natscho.my' || true
```

Keep `~/.ssh/ft_vault` and the `.zshrc` line for next time.

### When it doesn't work

| What you see | Cause | Do this |
|---|---|---|
| `SSH tunnel failed. Has Tiara added your SSH key?` | printed for **every** tunnel failure, not only a missing key | run the tunnel command in step 3 to see the real error, then this table |
| "from the environment: (none)", then `JWT_SECRET is empty` | `VAULT_USER` not set in this terminal | `source ~/.zshrc`, or run `VAULT_USER=<login> VAULT_SSH_KEY=~/.ssh/ft_vault make up` in one line |
| `Permission denied (publickey)` | the key isn't on your account, or `VAULT_SSH_KEY` points at another key | `ssh-keygen -lf ~/.ssh/ft_vault.pub` and send Tiara the fingerprint; she checks it against GCP |
| logged in, then closes at once; or `bind … Address already in use` / `cannot listen to port: 18201` | port 18201 on your machine is taken, often by an old tunnel that died | `pkill -f 'ssh -f -N .*@ft.natscho.my'` and run again; or use another port: `VAULT_TUNNEL_PORT=18555 make up` |
| `Host key verification failed` or `REMOTE HOST IDENTIFICATION HAS CHANGED` | the host key isn't accepted yet, or doesn't match | step 3; if the fingerprint isn't `teGq/…`, stop and tell Tiara |
| connection times out | the network blocks port 22 | works from the 42 campus network (checked 13 Oct); otherwise a phone hotspot |
| `[vault] Login failed for '<login>'` | wrong password, or wrong `VAULT_USER` | run `make up` again; nothing is locked out |
| `Vault … is SEALED` | solsys restarted | solsys applies its own share within a minute: wait and retry. Still sealed: a share holder runs `make unseal` |
| `Can't reach Vault … (tunnel up, but no answer from solsys)` | solsys or its WireGuard link is down | tell Tiara |

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
   export VAULT_CONTAINER=familytree-vault-1 VAULT_ADDR=http://127.0.0.1:8200
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
