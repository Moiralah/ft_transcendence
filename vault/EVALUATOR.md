# Vault login for an evaluator

How to give an evaluator their own login to the Vault on solsys, so that their `make up`
takes its secrets from Vault and not from `.env`. It is the same access a teammate has
([README.md](README.md), "Your access"), under the name `evaluator`, removed after the evals.

Who does what:

| Part | Who | Where |
|---|---|---|
| A. Before the eval: make the login | Tiara (admin login `tching`) | her Mac, in the repo |
| B. At the eval: first run | the evaluator, with Tiara | the eval machine |
| C. After the evals: remove it | Tiara | her Mac |

Do part A at least a day early and test it (A4). The tunnel and the login are what usually
fail on the day.

## What the evaluator can and can't do

The login is two parts with the same name, `evaluator`:

- **A tunnel account on the GCP proxy.** It can only forward to Vault on solsys
  (10.8.0.1:8200), over WireGuard. No shell, no password, no other ports. Its
  `authorized_keys` belongs to root, so they can't change it.
- **A Vault userpass user** with policy `dev-read`. It can read `secret/family-tree/dev`
  and nothing else: not the prod secrets, not the users or the policies. It can't change its
  own password. A token lasts 12 hours (24 at most).

**Be aware:** the dev secret set holds the production database URLs and the Supabase
service-role key (see the top of [README.md](README.md)). With `make up` the app doesn't
use them (local-up.sh replaces them with the local Supabase), but they are loaded into memory
on the eval machine, and anyone who reads them from the shell can reach the real data. Only
`JWT_SECRET` from Vault is actually used. Vault's audit log records every read. If the eval
machine isn't one you trust, rotate the database password and the service key after the
evals (README, "Rotating").

## A. Before the eval (Tiara)

### A1. A key for the eval machine

On the eval machine (or ask the evaluator to run it):

```sh
ssh-keygen -t ed25519 -f ~/.ssh/ft_vault -C ft-vault-evaluator
cat ~/.ssh/ft_vault.pub
```

Copy that one `.pub` line into `evaluator.pub` on your Mac. It is a public key, so chat is
fine. The private key `~/.ssh/ft_vault` (no `.pub`) never leaves the eval machine.

If you don't know the eval machine yet, run A2 without the key file: the account is made with
no key, and nobody can log in until you run A2 again with the key.

### A2. The tunnel account on GCP

```sh
scripts/vault/tunnel-key.sh add evaluator evaluator.pub
scripts/vault/tunnel-key.sh list
```

`list` must show `evaluator: key set`.

### A3. The Vault user

Log in as admin. This also opens your tunnel on port 18201 and keeps it open:

```sh
VAULT_USER=tching make vault-login
```

Pick a password for the evaluator (letters and digits, 16 or more). Don't put it in a file or
a chat; you'll tell the evaluator in person. Then:

```sh
printf 'Evaluator password: '; stty -echo; read -r EVAL_PW; stty echo; echo
curl -s -o /dev/null -w '%{http_code}\n' -X POST \
  -H "X-Vault-Token: $(cat ~/.vault-token)" -H "Content-Type: application/json" \
  -d "{\"password\":\"$EVAL_PW\",\"token_policies\":\"dev-read\",\"token_ttl\":\"12h\",\"token_max_ttl\":\"24h\"}" \
  http://127.0.0.1:18201/v1/auth/userpass/users/evaluator
unset EVAL_PW
```

Expect `204`. `403` means your `tching` token expired: run `make vault-login` again. Check
the user:

```sh
curl -s -H "X-Vault-Token: $(cat ~/.vault-token)" \
  http://127.0.0.1:18201/v1/auth/userpass/users/evaluator | python3 -m json.tool | grep -A2 token_policies
```

It must show `"dev-read"` and nothing else. To set a new password later, run the same POST
with only `{"password":"..."}`.

### A4. Test it from your Mac

This uses your tunnel that is already open, and a separate token file, so your own `tching`
token stays as it is:

```sh
VAULT_USER=evaluator VAULT_TOKEN_FILE=/tmp/eval-token scripts/vault/login.sh
rm -f /tmp/eval-token
```

Type the evaluator password. Expect `[vault] Logged in as evaluator; token good for another
11h 59m.` This tests the Vault user only. The tunnel account gets tested in B2, on the eval
machine.

## B. At the eval (the evaluator, with Tiara)

The eval machine needs Docker, `make`, `curl`, `python3`, `ssh`, and the Supabase CLI
(`make up` starts a local Supabase). On a 42 machine, paste the commands as they are:
none of them have `#` comments, which break pasting into zsh.

### B1. Clone and an `.env` with no secrets

```sh
git clone https://github.com/Moiralah/ft_transcendence.git && cd ft_transcendence
cp .env.example .env
sed -i.bak -E 's/^(JWT_SECRET|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|SUPABASE_AUTH_URL|SMTP_PASS)=.*/\1=/' .env && rm .env.bak
grep -E '^(JWT_SECRET|SUPABASE_SERVICE_ROLE_KEY|DATABASE_URL|DIRECT_URL|SUPABASE_AUTH_URL|SMTP_PASS)=' .env
```

Every line `grep` prints must end in `=`. This shows the evaluator that `.env` holds no
secrets, so whatever the app runs with must come from somewhere else.

### B2. Check the tunnel

```sh
ssh -i ~/.ssh/ft_vault evaluator@ft.natscho.my
```

The first time, it asks to confirm GCP's host key. Type `yes` **only** if the fingerprint is
`SHA256:teGq/ElfqZAFyQoJ04Q7Z6fZbKrYtYXOcgr10b077Bg`. Then expect `This account is
currently not available.` and the connection closes. That is correct: the key works and the
account has no shell.

### B3. Run it

```sh
VAULT_USER=evaluator VAULT_SSH_KEY=~/.ssh/ft_vault make up
```

Expect, in order:

1. `[vault] opening your SSH tunnel to Vault (evaluator@ft.natscho.my)...`
2. `Vault password for evaluator (input hidden):` Tiara tells them the password; nothing
   shows while typing
3. `[vault] Logged in as evaluator …` then `[vault] Loaded 5 dev secrets from Vault (in memory only).`
4. `[vault-init] from the environment: JWT_SECRET SUPABASE_SERVICE_ROLE_KEY DATABASE_URL
   DIRECT_URL SUPABASE_AUTH_URL; the rest from .env`
5. the build, the schema push, then `[local-up] done. Open https://localhost:8443`

Line 3 is the proof: the secrets came from solsys, in memory, never written to a file. Line 4
shows `JWT_SECRET` came from the environment (Vault), not from the empty `.env`. Open
https://localhost:8443 in Chrome (Safari blocks the local Supabase calls; see README).

### B4. What else to show

- Without the login, the same command stops: `make up` with no `VAULT_USER` gives
  `[vault-init] ERROR: JWT_SECRET is empty`. Nothing secret is in the repo or in `.env`.
- Inside the stack, the backend reads its own secrets from the local Vault through AppRole
  (`scripts/vault-init.sh`), read-only, on exactly one path.
- A wrong password gives `[vault] Login failed for 'evaluator'`. Nothing is locked out.

If something fails, the table in README.md, "When it doesn't work", covers it: read
`<login>` as `evaluator`.

### B5. When done on the eval machine

```sh
make down
rm -f ~/.vault-token
pkill -f 'ssh -f -N .*@ft.natscho.my' || true
```

## C. After the evals (Tiara)

```sh
VAULT_USER=tching make vault-login
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE \
  -H "X-Vault-Token: $(cat ~/.vault-token)" \
  http://127.0.0.1:18201/v1/auth/userpass/users/evaluator
scripts/vault/tunnel-key.sh remove evaluator
scripts/vault/tunnel-key.sh list
```

Expect `204`, then `evaluator: account removed`, and `evaluator` gone from `list`. Deleting the
user doesn't cut off a token already issued. That token only reads the dev set and expires by
itself within 24 hours, and without the tunnel account it can't reach Vault anyway.

If the eval machine wasn't one you trust, rotate the database password and the Supabase
service key now (README, "Rotating"), then update both the dev and the prod sets with
`scripts/vault/put-secrets.sh`.
