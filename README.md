# TaskTracker Pro

Professional task management application with Docker deployment support.

## Quick Start with Docker

```bash
# Clone the repository
git clone <repository-url>
cd task-tracker

# Make deployment script executable
chmod +x docker-deploy.sh

# Deploy with Docker
./docker-deploy.sh
```

The application will be available at http://localhost:3000

## Documentation

- See [README-Docker.md](./README-Docker.md) for detailed Docker deployment guide
- Default credentials:
  - Admin: `admin` / `TaskTracker2025!`
  - User: `user` / `User2025!`

## Database Maintenance

### Docker Environment

```bash
# Make the fix script executable (first time only)
chmod +x docker-fix-db.sh

# Verify database consistency
./docker-fix-db.sh verify

# Fix database issues
./docker-fix-db.sh fix

# Verify and fix (interactive)
./docker-fix-db.sh both
```

Or run directly:
```bash
# Verify
docker exec tasktracker-app npm run verify:status

# Fix
docker exec tasktracker-app npm run fix:completed
```

### Development Environment

```bash
# Verify database
npm run verify:status

# Fix completed tasks status
npm run fix:completed

# Clean orphaned tasks
npm run clean:orphaned
```

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```
