# Secure Website v1

A Flask-based web application with user authentication, admin panel, and account request workflow.

## Features

- Complete user authentication system with bcrypt password hashing
- Admin panel with user management (CRUD operations)
- Account request system with approval workflow
- First name and last name fields for users
- Username read-only after creation (reusable after deletion)
- Real-time username availability checking via AJAX
- Password strength validation
- Secure session management with Redis
- Docker containerization with multi-service setup
- Nginx reverse proxy with SSL/TLS support
- PostgreSQL database
- Security best practices (HTTPS, CSRF protection, rate limiting)

## Quick Start

### Prerequisites

- Docker and Docker Compose installed
- Git (optional)

### Installation

1. Clone or download this repository

2. Make scripts executable (Linux/Mac):
   ```bash
   chmod +x generate-ssl.sh start.sh
   ```

   On Windows, the scripts will be executed by bash in Docker.

3. Generate SSL certificates:
   ```bash
   ./generate-ssl.sh
   ```
   Or on Windows with Git Bash:
   ```bash
   bash generate-ssl.sh
   ```

4. Start the application:
   ```bash
   ./start.sh
   ```
   Or on Windows:
   ```bash
   bash start.sh
   ```

5. Access the application at: https://localhost

   **Default Admin Credentials:**
   - Username: `admin`
   - Password: `Admin123!`

   **Note:** You may need to accept the self-signed SSL certificate in your browser.

## Project Structure

```
website-v1/
├── app.py                  # Main Flask application
├── requirements.txt        # Python dependencies
├── Dockerfile             # Docker image definition
├── docker-compose.yml     # Docker Compose configuration
├── init.sql               # Database initialization script
├── nginx.conf             # Nginx configuration
├── generate-ssl.sh        # SSL certificate generation script
├── start.sh               # Application startup script
├── env.example            # Environment variables example
├── .dockerignore          # Docker ignore file
├── .gitignore             # Git ignore file
├── templates/             # Jinja2 HTML templates
│   ├── base.html
│   ├── index.html
│   ├── login.html
│   ├── dashboard.html
│   ├── admin.html
│   └── admin_users.html
├── static/                # Static assets
│   ├── css/
│   │   └── style.css
│   └── js/
│       └── main.js
└── docs/                  # Documentation
```

## Services

- **web** (Flask application) - Port 5000
- **db** (PostgreSQL) - Port 5432
- **redis** (Redis) - Port 6379
- **nginx** (Reverse proxy) - Ports 80 (HTTP) and 443 (HTTPS)

## Common Commands

### View logs
```bash
docker-compose logs -f
```

### View specific service logs
```bash
docker-compose logs -f web
docker-compose logs -f db
docker-compose logs -f redis
```

### Stop application
```bash
docker-compose down
```

### Stop and remove volumes (complete reset)
```bash
docker-compose down -v
```

### Rebuild and restart
```bash
docker-compose up -d --build
```

### Access PostgreSQL
```bash
docker-compose exec db psql -U user -d secure_website
```

### Access Redis CLI
```bash
docker-compose exec redis redis-cli -a redispassword
```

## Environment Variables

Create a `.env` file in the project root with:

```env
POSTGRES_PASSWORD=your-secure-database-password
REDIS_PASSWORD=your-secure-redis-password
DATABASE_URL=postgresql://user:your-secure-database-password@db:5432/secure_website
REDIS_URL=redis://:your-secure-redis-password@redis:6379/0
SECRET_KEY=your-super-secret-key-change-this-in-production
FLASK_ENV=production
RAMP_CLIENT_ID=your-ramp-client-id
RAMP_CLIENT_SECRET=your-ramp-client-secret
RAMP_API_BASE_URL=https://api.ramp.com/developer/v1
```

**Security Note:** Never commit `.env` files to version control. Use strong, unique passwords in production.

## Security Considerations

⚠️ **Important:** This application uses default credentials for development. Before deploying to production:

1. Change all default passwords
2. Use real SSL certificates (not self-signed)
3. Configure proper firewall rules
4. Set up monitoring and logging
5. Enable database backups
6. Rotate secrets regularly
7. Use external secret management

## Troubleshooting

### Port conflicts
Ensure ports 80, 443, 5432, and 6379 are available.

### SSL certificate errors
Regenerate certificates: `./generate-ssl.sh`

### Database connection errors
Check PostgreSQL health: `docker-compose exec db pg_isready -U user -d secure_website`

### Redis connection errors
Check Redis: `docker-compose exec redis redis-cli -a redispassword ping`

### Application not starting
View logs: `docker-compose logs web`

## License

© 2025 Amigos Enterprises LLC. All rights reserved.

