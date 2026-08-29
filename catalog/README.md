# Westview Science Olympiad equipment catalog

Private catalog for boxes and equipment stored in A101.

## Capabilities

- Local email/password accounts with administrator and member roles
- Boxes and individual items with permanent QR identifiers
- A101 home location, current location, current holder, and last holder
- Check-out, return, relocation, and preserved movement history
- Soft deletion for catalog records
- Administrator-managed member accounts
- CSV account imports with generated temporary passwords and duplicate handling

## Local development

```bash
npm install
SETUP_TOKEN=local-setup-token COOKIE_SECURE=false PUBLIC_URL=http://127.0.0.1:3010 npm run dev
```

Open `http://127.0.0.1:3010/#setup=local-setup-token` to create the first administrator.

## VPS layout

- Application: `/srv/scioly-catalog`
- Database: `/srv/scioly-catalog/data/catalog.db`
- Environment: `/etc/scioly-catalog.env`
- Service: `scioly-catalog.service`
- Public URL: `https://catalog.wvscioly.org`

The SQLite database is written atomically to `catalog.db`. Copy that file while the service is stopped for a consistent backup.
