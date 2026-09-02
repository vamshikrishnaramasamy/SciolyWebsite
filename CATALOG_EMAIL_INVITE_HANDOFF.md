# Catalog email-invitation handoff

## Goal

Finish deploying password-setup invitations for the private equipment catalog. Invitations must be sent by the Google account `westviewso.ss@gmail.com`.

## Current state

- Repository: `https://github.com/vamshikrishnaramasamy/SciolyWebsite.git`
- Feature branch: `codex/email-password-invites`
- Ready commit: `58d1816`
- Production: `https://catalog.wvscioly.org`
- VPS: `ubuntu@159.54.170.7`
- SSH key: `/Users/vamshikrishnaramasamy/.ssh/id_ed25519`
- Service directory: `/srv/scioly-catalog`
- Data: `/srv/scioly-catalog/data/catalog.db`
- Environment file: `/etc/scioly-catalog.env`
- systemd service: `scioly-catalog`

Production is still running the previous password behavior. No invitation emails have been sent and the feature branch has not been merged into `main`.

The local NUC workspace was unavailable in the previous session. Clone the repository or use the saved project when it is mounted, then check out `codex/email-password-invites`.

## What is implemented

- Admin-created and CSV-imported users receive a password-setup email.
- Passwords never enter the admin form, CSV, or user-creation API.
- Setup links expire after 48 hours and work once.
- Only SHA-256 token hashes are stored in SQLite.
- Pending users cannot sign in before choosing a password.
- Failed email delivery rolls back account creation or reactivation.
- Admins can resend pending invitations.
- Existing production users migrate as already configured.
- `MAIL_FROM` must equal `SMTP_USER`; the server refuses a different sender.
- End-to-end tests use Nodemailer's JSON transport and do not send real mail.

## Verification already completed

From `catalog/`:

```bash
rtk npm run check
rtk proxy npm test
rtk npm audit --omit=dev
```

All passed. The Impeccable UI detector also returned no findings for the changed HTML, JavaScript, and CSS.

## Required Computer Use workflow

Use the explicitly requested `computer-use:computer-use` skill and Google Chrome. The signed-in Chrome profile should be the Westview Science Olympiad Student Board account, `westviewso.ss@gmail.com`.

1. Open `https://myaccount.google.com/apppasswords` in Chrome.
2. Confirm the displayed Google account is exactly `westviewso.ss@gmail.com` before proceeding.
3. If Google requests reauthentication or an OTP, hand control to the user.
4. Create an app password named `Westview Scioly Catalog`.
5. Creating an app password is persistent account access. Per Computer Use policy, ask for blocking confirmation immediately before the final **Create** action.
6. Do not print, quote, log, or place the generated app password in a tool call, chat response, source file, commit, or shell history.
7. Prefer Google's **Copy** control, then paste it directly into a hidden terminal prompt. Do not request a fresh accessibility snapshot while the credential is visible.

If App Passwords is unavailable, stop. Likely causes are missing two-step verification, Advanced Protection, or Workspace policy. Do not weaken account security. Report the exact Google UI message and propose Google OAuth2 or Workspace SMTP relay as the fallback.

## Save the Gmail credential on the VPS

Open Terminal through Computer Use and connect interactively:

```bash
ssh -t -i /Users/vamshikrishnaramasamy/.ssh/id_ed25519 ubuntu@159.54.170.7
```

Remove old mail keys, then collect the copied app password with terminal echo disabled. Type the following commands in the interactive terminal; paste the credential only at the `Google app password:` prompt:

```bash
sudo sed -i '/^SMTP_USER=/d;/^SMTP_PASS=/d;/^MAIL_FROM=/d' /etc/scioly-catalog.env
read -rsp 'Google app password: ' SCIOLY_MAIL_PASS
printf '\n'
SCIOLY_MAIL_PASS=${SCIOLY_MAIL_PASS// /}
printf 'SMTP_USER=westviewso.ss@gmail.com\nSMTP_PASS=%s\nMAIL_FROM=westviewso.ss@gmail.com\n' "$SCIOLY_MAIL_PASS" | sudo tee -a /etc/scioly-catalog.env >/dev/null
unset SCIOLY_MAIL_PASS
sudo chmod 600 /etc/scioly-catalog.env
```

Do not display `/etc/scioly-catalog.env` afterward. It contains production secrets.

## Merge and deploy

1. Fetch the remote feature branch and inspect the diff.
2. Merge `codex/email-password-invites` into `main` and push `main`. Resolve new upstream changes conservatively if `main` has advanced.
3. Back up the production database before restarting because startup adds the invitation table and `password_set_at` column. Use a new explicit backup filename under `/srv/scioly-catalog/data/backups/`; never overwrite an earlier backup.
4. Upload these changed application files without `--delete`:
   - `catalog/server.js`
   - `catalog/package.json`
   - `catalog/package-lock.json`
   - `catalog/public/catalog.js`
   - `catalog/public/catalog.css`
   - `catalog/public/index.html`
5. Run `npm ci --omit=dev` as the `scioly-catalog` service user in `/srv/scioly-catalog`.
6. Restart `scioly-catalog` and verify it is active.

Useful read-only checks:

```bash
curl -fsS https://catalog.wvscioly.org/healthz
ssh -i /Users/vamshikrishnaramasamy/.ssh/id_ed25519 ubuntu@159.54.170.7 'sudo systemctl is-active scioly-catalog'
ssh -i /Users/vamshikrishnaramasamy/.ssh/id_ed25519 ubuntu@159.54.170.7 'sudo journalctl -u scioly-catalog -n 50 --no-pager'
```

Never include environment values in journal, shell, or chat output.

## Gmail authentication test

Before sending mail, verify SMTP authentication with Nodemailer without printing the credential. Run a short server-side script that loads `/etc/scioly-catalog.env`, creates a Gmail Nodemailer transport, calls `transporter.verify()`, and emits only success/failure. Do not log the transport configuration.

Sending a test email is representational communication. Ask for confirmation immediately before sending one. If approved, send only to `westviewso.ss@gmail.com`, with a clearly labeled subject such as `Westview catalog email test`.

## End-to-end production test

After deployment, use the catalog's People page to invite `westviewso.ss+catalogtest@gmail.com` as a member. This routes back to the same Gmail inbox while exercising the real invitation flow.

Because this sends an email and creates a production user, ask for confirmation immediately before submitting the invitation. Then:

1. Confirm the message arrives from `westviewso.ss@gmail.com`.
2. Open the setup link.
3. Set a 12-or-more-character test password.
4. Confirm the link cannot be reused.
5. Sign in as the test user.
6. Return to the admin account and remove the test user. Deleting the account requires a separate action-time confirmation under Computer Use policy.

Do not invite or email any real students during setup verification.

## Completion criteria

- `main` contains commit `58d1816` or its merged equivalent.
- Production service is active and `/healthz` returns `{"ok":true}`.
- SMTP authentication succeeds for `westviewso.ss@gmail.com`.
- A confirmed test invitation arrives from that exact account.
- The test recipient sets a password and signs in.
- The setup link fails on reuse.
- No app password or other secret appears in source, Git history, tool output, logs, or chat.

