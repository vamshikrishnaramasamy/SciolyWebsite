# Westview Science Olympiad

## Product

Westview Science Olympiad operates a public team website and a private equipment catalog for supplies stored in room A101.

## Audiences

- Students and coaches who need to identify, locate, borrow, and return equipment
- Student-board administrators who manage catalog access
- Visitors to the public team website

## Catalog jobs

- Find an item by name, visual description, asset tag, box, holder, or location
- See an item's permanent home in A101 and its current location
- See who currently has equipment and who held it last
- Record checkout, return, and relocation history
- Scan a unique QR label on a box or item to open its authenticated detail page
- Add, edit, and remove boxes and items
- Create and remove member logins

## Product rules

- Catalog data is private and requires login
- QR scans require login, then continue to the scanned record
- Deletion removes records from active inventory but preserves movement history
- Items inside a checked-out box inherit that box's current location and holder
- Existing public website remains available without login

## Deployment

Public website remains static. Catalog runs as an isolated Node service with SQLite behind nginx on the user's VPS.
