SLPP Airport Pickup v12 - Coordinator Access Management

CHANGED FILES
1. coordinator.html
2. coordinator.js
3. Code.gs

WHAT THIS VERSION ADDS
- Private Coordinator Access Google Sheet tab
- Default Admin: NYC Sec Gen
- Default password: nyc sec gen
- Admin-only Coordinator Access Management form on coordinator.html
- Add, edit, activate/deactivate, remove coordinator accounts
- Coordinator fields: Name, Access Code, Chapter / Region, Role, Active
- Roles: Admin and Coordinator
- Access codes stored as SHA-256 hashes, not plain text
- 6-hour coordinator browser sessions
- Admin management section hidden from regular Coordinator users

DEPLOYMENT
1. Upload coordinator.html and coordinator.js to airport-pickup/ on GitHub.
2. Replace Code.gs in the bound Google Apps Script project.
3. Save the script.
4. Run setupAirportPickup() once. This creates the Coordinator Access tab and seeds the default admin if no accounts exist.
5. Deploy -> Manage deployments -> Edit -> New version -> Deploy.
6. The existing /exec URL should remain unchanged.
7. Open https://greenprofessionals.github.io/airport-pickup/coordinator.html
8. Sign in with: nyc sec gen

OLD SCRIPT PROPERTIES
COORDINATOR_ACCESS_CODE Script Properties are no longer used by this version and may be deleted.
