# DbGate server launcher

This package starts the DbGate API and web interface with the installed database plugins. Run `dbgate-serve` from an installation containing the built `dbgate-api`, `dbgate-web` and driver packages, then open `http://localhost:3000`.

Configuration is read from environment variables and a `.env` file in the working directory. Set `PORT` to change the listening port, `HOST` to select the listening address, and `WORKSPACE_DIR` to choose where local connections, settings and files are stored.

Database credentials, SSH tunnels and TLS settings belong to individual database connections. Oracle thick mode additionally requires Oracle Instant Client and the `ORACLE_INSTANT_CLIENT` directory setting.

For development and desktop packaging, see the [repository README](../../README.md).
