# Westview Science Olympiad — Website

A fast, hand-crafted static site for Westview High School Science Olympiad (Poway Unified, San Diego — Wolverines). Gold & black, zero build step, no framework.

```
index.html      → all markup (single-page site)
styles.css      → all styles (dark/gold design system, CSS variables)
three-hero.js   → WebGL hero: glowing DNA double-helix + particle field (Three.js, ES module)
script.js       → preloader, smooth scroll, cursor, magnetics, 3D tilt, scroll-fill, counters, filter, nav
assets/         → favicon.svg
deploy/         → nginx config for the Oracle VPS
```

## Dependencies (loaded from CDN at runtime)

No build step. The browser pulls these in — nothing to install on the server:

- **Three.js 0.160** (via importmap) — the 3D molecule hero
- **GSAP 3.12 + ScrollTrigger** — reveals, count-ups, pinned horizontal events
- **Lenis 1.0** — smooth scrolling
- **Font**: Satoshi (Fontshare) — falls back to SF Pro / system on Apple devices

These need internet access from the *visitor's* browser (always true). For a fully self-hosted / offline build, download the files into `assets/vendor/` and repoint the `<script>`/`<link>` tags in `index.html`.

Everything degrades gracefully:
- **No WebGL** → the hero shows a hand-drawn **static SVG molecule** (in `index.html`, `.hero__fallback`) instead of the 3D one. It never looks empty.
- **`prefers-reduced-motion`** → animations off, counters jump to final values, the pinned horizontal events become a normal swipeable row, everything stays visible.

## Preview locally

No build needed — it's plain HTML/CSS/JS. Any static server works:

```bash
# from the project root
python3 -m http.server 8080
# then open http://localhost:8080
```

## Editing content

Everything is plain HTML in `index.html`:

- **Events** — the 23 Division C (2026) events live in the `#events` grid. Each card has a `data-cat` (`life`, `earth`, `physical`, `eng`, `inquiry`) that drives the filter chips.
- **Team** — `#team` has Coaches / Executive Board / Event Leadership. Swap the placeholder titles for real names and update each avatar's `data-initials`.
- **Achievements** — `#achievements` numbers are placeholders; drop in real results.
- **Contact** — email `westviewso@gmail.com` and Instagram `@westviewscioly` are wired up in `#join` and the footer.

Color/typography tokens are CSS variables at the top of `styles.css` (`:root`).

## Deploy to the Oracle Cloud (free tier) VPS

On the server (Ubuntu):

```bash
sudo apt update && sudo apt install -y nginx
sudo mkdir -p /var/www/westview-scioly
```

From your machine, copy the site up (replace user/IP):

```bash
scp index.html styles.css script.js -r assets ubuntu@YOUR_VPS_IP:/tmp/site/
# on the server:
sudo cp -r /tmp/site/* /var/www/westview-scioly/
sudo chown -R www-data:www-data /var/www/westview-scioly
```

Install the nginx site config (see `deploy/nginx.conf`):

```bash
sudo cp deploy/nginx.conf /etc/nginx/sites-available/westview-scioly
sudo ln -s /etc/nginx/sites-available/westview-scioly /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

**Open the firewall** (Oracle blocks ports by default in two places):

1. In the OCI console: add an *ingress rule* to the VCN security list for TCP 80 and 443.
2. On the instance: `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT` (and 443), or use `ufw`.

### Free HTTPS with a domain

Point your domain's A record at the VPS public IP, then:

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

Certbot edits the nginx config and auto-renews.
