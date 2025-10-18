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

## Development

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build
```
