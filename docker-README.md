# BibleGraph Web Docker Setup

This directory contains Docker configuration files for running the BibleGraph web application.

## Setup Overview

The Docker setup consists of three services:

1. **Web Frontend** - Nginx serving the Expo web build
2. **API Server** - Node.js API server
3. **Neo4j Database** - Graph database for storing Bible study data

## Quick Start

To run the web application:

```bash
# Start all services
docker-compose -f docker-compose.web.yml up -d

# View logs
docker-compose -f docker-compose.web.yml logs -f
```

The application will be available at:
- Web UI: http://localhost
- API: http://localhost/api
- Neo4j Browser: http://localhost:7474

## Development

To build and run the services for development:

```bash
# Build all services
docker-compose -f docker-compose.web.yml build

# Start services in development mode
docker-compose -f docker-compose.web.yml up
```

## Configuration

Environment variables can be modified in the `docker-compose.web.yml` file:

- `NEO4J_USER` - Neo4j database username
- `NEO4J_PASSWORD` - Neo4j database password
- `NODE_ENV` - Environment mode (production/development)

## Data Persistence

The Neo4j database data is persisted in Docker volumes:
- `neo4j_data` - Database data
- `neo4j_logs` - Database logs
- `neo4j_import` - Import directory
- `neo4j_plugins` - Neo4j plugins

## Rebuilding

If you make changes to the application code:

```bash
# Rebuild and restart services
docker-compose -f docker-compose.web.yml up -d --build
``` 