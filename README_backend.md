# PHP Backend for Bus Transport Automation

## Overview
This backend provides REST-style JSON endpoints for the admin panel using PHP (PDO) and MySQL.

## Directory Structure
backend/
  config.php        # DB and CORS config
  db.php            # PDO connection helper
  response.php      # JSON/CORS response utilities
  util.php          # Validation & input helpers
  schema.sql        # Database schema
  api/
    auth.php        # Admin login (returns simple token)
    buses.php       # CRUD for buses
    drivers.php     # CRUD for drivers
    routes.php      # CRUD for routes (stops stored as JSON)
    counters.php    # List/Create/Update/Delete bus counters

## Database Setup
1. Install MySQL (or use XAMPP which bundles MySQL + Apache + PHP).
2. Run the schema:
   ```bash
   mysql -u root -p < backend/schema.sql
   ```
  This includes the new `bus_counters` table for the counters directory.
3. Create an admin user (generate a bcrypt hash with PHP):
   ```php
   php -r "echo password_hash('admin123', PASSWORD_BCRYPT);"
   ```
   Copy the hash and insert:
   ```sql
   INSERT INTO bus_transport.admins (username,password_hash) VALUES ('admin','<PASTE_HASH_HERE>');
   ```

## Running Locally (XAMPP)
1. Move project into `htdocs` (or create a virtual host). Example path: `C:\xampp\htdocs\busapp`.
2. Ensure `backend/` stays inside the project root.
3. Access endpoints via: `http://localhost/busapp/backend/api/buses.php`

## Endpoints
Base path: `/backend/api/`

| Endpoint              | Method | Purpose                  | Body (JSON) Required Fields |
|-----------------------|--------|--------------------------|-----------------------------|
| auth.php              | POST   | Admin login              | username, password          |
| buses.php             | GET    | List buses / single ?id  | —                           |
| buses.php             | POST   | Create bus               | number,type,capacity,status_condition |
| buses.php?id=ID       | PUT    | Update bus               | number,type,capacity,status_condition |
| buses.php?id=ID       | DELETE | Delete bus               | —                           |
| drivers.php           | GET    | List drivers / single    | —                           |
| drivers.php           | POST   | Create driver            | name,license_number,phone   |
| drivers.php?id=ID     | PUT    | Update driver            | name,license_number,phone   |
| drivers.php?id=ID     | DELETE | Delete driver            | —                           |
| routes.php            | GET    | List routes / single     | —                           |
| routes.php            | POST   | Create route             | name,start_point,end_point,stops (array) |
| routes.php?id=ID      | PUT    | Update route             | name,start_point,end_point,stops (array) |
| routes.php?id=ID      | DELETE | Delete route             | —                           |
| counters.php          | GET    | List counters (optional filters: district,status) | — |
| counters.php          | POST   | Create counter           | counter_name,location_address,district,contact_number |
| counters.php?id=ID    | PUT    | Update counter           | any counter fields          |
| counters.php?id=ID    | DELETE | Delete counter           | —                           |

## Example cURL Calls
```bash
# Login
curl -X POST -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  http://localhost/busapp/backend/api/auth.php

# Create a bus
curl -X POST -H "Content-Type: application/json" \
  -d '{"number":"BL100","type":"AC","capacity":40,"status_condition":"Good"}' \
  http://localhost/busapp/backend/api/buses.php

# List buses
curl http://localhost/busapp/backend/api/buses.php

# Create route
curl -X POST -H "Content-Type: application/json" \
  -d '{"name":"Dhaka-Chittagong","start_point":"Dhaka","end_point":"Chittagong","stops":["Dhaka","Cumilla","Feni","Chittagong"],"distance_km":250,"duration_minutes":255}' \
  http://localhost/busapp/backend/api/routes.php

# List counters
curl http://localhost/busapp/backend/api/counters.php

# Create a counter
curl -X POST -H "Content-Type: application/json" \
  -d '{"counter_name":"Gabtoli Counter","location_address":"Gabtoli Bus Terminal, Dhaka","district":"Dhaka","contact_number":"01234567890","opening_time":"08:00:00","closing_time":"20:00:00"}' \
  http://localhost/busapp/backend/api/counters.php
```

## Frontend Integration Notes
`admin.js` now integrates live CRUD for buses:
1. Switching to the "Manage Buses" tab triggers `loadBuses()` (GET /buses.php) and renders a table.
2. Selecting a row's Edit button fills the form (hidden `busId` field) for update (PUT /buses.php?id=ID).
3. The Save Bus button performs POST (create) when `busId` is empty, or PUT (update) when set.
4. Delete button issues DELETE /buses.php?id=ID then refreshes list.
5. Bus search uses the fetched `busesData` array from backend, matching number or type.

Note: A previous fall-through bug in `api/buses.php` switch (missing `break;`) was fixed to ensure correct HTTP method handling.

### Seeding Sample Buses (UI)
If the database has no buses the Admin UI shows an empty state with a prompt. Click "Seed Sample Buses" to automatically POST three demo entries (BL100, CL200, EX300). This is for development only—remove or disable seeding in production.

### Manual SQL Seeding
Alternatively insert sample rows directly:
```sql
INSERT INTO buses (number,type,capacity,status_condition) VALUES
 ('BL100','AC',40,'Good'),
 ('CL200','Non-AC',36,'Fair'),
 ('EX300','AC',44,'Excellent');
```

## Security Next Steps (Recommended)
- Replace simple token with JWT (firebase/php-jwt library) or session cookies.
- Add authentication middleware checking `Authorization: Bearer <token>`.
- Implement rate limiting & input length checks.
- Escape output in frontend; backend already sends JSON.

## License
Internal/demo use only. Add proper licensing if distributing.
