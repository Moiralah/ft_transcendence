// Fetches secrets from HashiCorp Vault at boot and injects them into
// process.env, so every existing ConfigService.get()/process.env call
// elsewhere in the app keeps working unchanged.
//
// Auth is via AppRole (VAULT_ROLE_ID/VAULT_SECRET_ID), not a root token —
// this backend's AppRole is scoped to read-only on exactly one path
// (see docker-compose-security.yml and the Vault policy `backend-readonly`).
//
// If VAULT_ADDR isn't set, this is a no-op: local dev without the
// security stack running falls back to `.env` entirely, same as before
// Vault existed. Vault-provided values always win over `.env` for the
// same key, since dotenv's config() (called after this, in main.ts)
// does not overwrite already-set process.env vars.

const VAULT_SECRET_PATH = 'secret/data/family-tree/backend';

export async function loadSecretsFromVault(): Promise<void> {
	const vaultAddr = process.env.VAULT_ADDR;
	const roleId = process.env.VAULT_ROLE_ID;
	const secretId = process.env.VAULT_SECRET_ID;

	if (!vaultAddr || !roleId || !secretId) {
		console.log('[vault] VAULT_ADDR/VAULT_ROLE_ID/VAULT_SECRET_ID not set — skipping, falling back to .env');
		return;
	}

	const loginRes = await fetch(`${vaultAddr}/v1/auth/approle/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ role_id: roleId, secret_id: secretId }),
	});
	if (!loginRes.ok) {
		throw new Error(`[vault] AppRole login failed: ${loginRes.status} ${await loginRes.text()}`);
	}
	const loginData = await loginRes.json();
	const clientToken = loginData.auth?.client_token;
	if (!clientToken) {
		throw new Error('[vault] AppRole login response had no client_token');
	}

	const secretRes = await fetch(`${vaultAddr}/v1/${VAULT_SECRET_PATH}`, {
		headers: { 'X-Vault-Token': clientToken },
	});
	if (!secretRes.ok) {
		throw new Error(`[vault] reading ${VAULT_SECRET_PATH} failed: ${secretRes.status} ${await secretRes.text()}`);
	}
	const secretData = await secretRes.json();
	const secrets: Record<string, string> = secretData.data?.data ?? {};

	let count = 0;
	for (const [key, value] of Object.entries(secrets)) {
		process.env[key] = value;
		count++;
	}
	console.log(`[vault] loaded ${count} secrets from ${VAULT_SECRET_PATH}`);
}
