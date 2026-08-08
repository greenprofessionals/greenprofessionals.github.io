# SLPP North America Regional Ticketing v5

Public GitHub Pages target: `https://greenprofessionals.github.io/slppna/`

## Upload to GitHub
Upload only:
- `claim.html`
- `assets/js/ticket-renderer.js`
- `tickets/`

Do NOT upload `Code-regional-v5.gs` or the Google Sheet to the public repository. They are included in this package only as deployment source files.

## Backend setup
1. Convert `SLPP_NA_Regional_Ticketing_Template_v5.xlsx` to Google Sheets.
2. Open Extensions > Apps Script and paste `Code-regional-v5.gs`.
3. Deploy as Web app: Execute as Me, access Anyone.
4. Copy the `/exec` URL.
5. In `claim.html`, replace `PASTE_YOUR_APPS_SCRIPT_EXEC_URL_HERE` with the `/exec` URL.
6. Commit the public files to `greenprofessionals.github.io/slppna/`.

## Test URLs
- `https://greenprofessionals.github.io/slppna/claim.html?chapter=NEC&event=NEC-2026-INAUGURATION`
- `https://greenprofessionals.github.io/slppna/claim.html?chapter=NYC&event=NYC-2026-INAUGURATION`

## v5 master renderer
The ticket artwork is generated at claim time from spreadsheet configuration. Chapter skyline, logo, colors, event text, tier, price, admit count, serial, and QR are dynamic. QR codes contain a server-issued validation URL based on a random validation token.


## v5 pricing snapshot update
- `Tickets` stores `Price` and `Currency` at ticket issuance.
- `Vouchers` stores `Price` and `Currency`; fixed-tier vouchers snapshot the price when generated, while open vouchers receive the selected tier price when claimed.
- `CheckIns` stores `Price` and `Currency` copied from the issued ticket, preserving historical pricing even if the event's ticket prices later change.
- Check-in summary responses now include `paidAmount` and `pendingAmount`.
