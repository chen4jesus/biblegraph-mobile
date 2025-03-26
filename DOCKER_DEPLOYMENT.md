# Docker Deployment Guide for BibleGraph Mobile

This guide provides instructions for deploying the BibleGraph mobile application in various configurations using Docker.

## Prerequisites

- Docker and Docker Compose installed on your server
- Git to clone the repository
- A Linux server or VPS with SSH access

## Deployment Options

There are several deployment options available:

1. **Development Server**: Run the Expo development server
2. **Web Application**: Deploy a web version of the app
3. **API Server**: Deploy only the backend API

## Quick Start

### Clone the repository

```bash
git clone <your-repository-url>
cd biblegraph-mobile
```

### Setup environment

Copy the example environment file and edit it with your settings:

```bash
cp .env.example .env
nano .env
```

### Deploy for development

```bash
docker-compose up -d
```

This will start:
- The Expo development server (accessible on port 19000, 19001, 19002)
- A Neo4j database instance (accessible on ports 7474 and 7687)

### Deploy web version

```bash
docker-compose -f docker-compose.web.yml up -d
```

This will start:
- A web server hosting the application (accessible on port 80)
- An API server for backend operations (accessible on port 3000)
- A Neo4j database instance (accessible on ports 7474 and 7687)

## Configuration

### Neo4j Database

The default Neo4j credentials are:
- Username: `neo4j`
- Password: `password`

**Important**: Change these in production by editing the environment variables in the docker-compose files.

### Persistence

The Neo4j database data is persisted using Docker volumes. These volumes will persist even if you remove the containers, unless you explicitly delete the volumes.

## Accessing the Applications

- **Expo Development Server**: `http://<your-server-ip>:19002`
- **Web Application**: `http://<your-server-ip>`
- **Neo4j Browser**: `http://<your-server-ip>:7474`

## Production Considerations

For production environments:

1. Enable HTTPS by adding a reverse proxy like Nginx or Traefik
2. Set up proper authentication for Neo4j
3. Configure backups for the Neo4j data volume
4. Use environment variables for secrets and configuration
5. Set up monitoring and logging

## Troubleshooting

### Container not starting

Check the logs:

```bash
docker-compose logs -f app
# or
docker-compose -f docker-compose.web.yml logs -f web
```

### Database connection issues

Check if Neo4j is running:

```bash
docker ps | grep neo4j
```

You can also check the Neo4j logs:

```bash
docker-compose logs -f neo4j
``` 