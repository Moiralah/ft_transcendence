# Vault in SERVER mode (replaces dev mode for production; see
# diagram/vault-remote-env.html). Secrets are stored encrypted on disk and
# survive restarts; after every start Vault is SEALED until 2 of the 5
# unseal shares are entered (scripts/vault/unseal.sh).
storage "file" {
  path = "/vault/file"
}

# Plain HTTP inside the host: Vault is only ever published on loopback
# (laptops/backend on the same machine) or on the WireGuard address, and
# WireGuard already encrypts that hop.
listener "tcp" {
  address     = "0.0.0.0:8200"
  tls_disable = true
}

api_addr      = "http://127.0.0.1:8200"
ui            = false
# Containers can't always lock memory; Vault then warns instead of refusing to start.
disable_mlock = true
