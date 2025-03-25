#!/bin/bash

# BibleGraph Mobile Docker Deployment Script
set -e

# Define text colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Display banner
echo -e "${GREEN}"
echo "###################################################"
echo "#                                                 #"
echo "#          BibleGraph Mobile Deployment           #"
echo "#                                                 #"
echo "###################################################"
echo -e "${NC}"

# Function to check if Docker is installed
check_docker() {
  if ! command -v docker &> /dev/null; then
    echo -e "${RED}Docker is not installed. Please install Docker first.${NC}"
    exit 1
  fi

  if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}Docker Compose is not installed. Please install Docker Compose first.${NC}"
    exit 1
  fi

  echo -e "${GREEN}✓ Docker and Docker Compose are installed${NC}"
}

# Function to create .env file if it doesn't exist
setup_env() {
  if [ ! -f .env ]; then
    echo -e "${YELLOW}Creating .env file...${NC}"
    cat > .env << EOF
# Neo4j Configuration
NEO4J_URI=bolt://neo4j:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=password

# App Configuration
NODE_ENV=production
EOF
    echo -e "${GREEN}✓ Created .env file with default values${NC}"
    echo -e "${YELLOW}Please edit the .env file with your own values if needed.${NC}"
  else
    echo -e "${GREEN}✓ .env file already exists${NC}"
  fi
}

# Function to deploy development environment
deploy_dev() {
  echo -e "${YELLOW}Deploying development environment...${NC}"
  docker-compose up -d
  echo -e "${GREEN}✓ Development environment deployed!${NC}"
  
  # Show access information
  echo ""
  echo -e "${GREEN}Access Information:${NC}"
  echo -e "Expo DevTools: http://$(hostname -I | awk '{print $1}'):19002"
  echo -e "Neo4j Browser: http://$(hostname -I | awk '{print $1}'):7474"
  echo -e "Username: neo4j"
  echo -e "Password: password (change this in production!)"
}

# Function to deploy web environment
deploy_web() {
  echo -e "${YELLOW}Deploying web application...${NC}"
  docker-compose -f docker-compose.web.yml up -d
  echo -e "${GREEN}✓ Web application deployed!${NC}"
  
  # Show access information
  echo ""
  echo -e "${GREEN}Access Information:${NC}"
  echo -e "Web Application: http://$(hostname -I | awk '{print $1}'"
  echo -e "API Server: http://$(hostname -I | awk '{print $1}'):3000"
  echo -e "Neo4j Browser: http://$(hostname -I | awk '{print $1}'):7474"
  echo -e "Username: neo4j"
  echo -e "Password: password (change this in production!)"
}

# Main script logic
main() {
  # Check prerequisites
  check_docker
  
  # Setup environment
  setup_env
  
  # Show deployment options
  echo ""
  echo -e "${YELLOW}Select deployment option:${NC}"
  echo "1) Development Environment (Expo + Neo4j)"
  echo "2) Web Application (Web + API + Neo4j)"
  echo "3) Exit"
  
  read -p "Enter choice [1-3]: " choice
  
  case $choice in
    1)
      deploy_dev
      ;;
    2)
      deploy_web
      ;;
    3)
      echo -e "${YELLOW}Exiting...${NC}"
      exit 0
      ;;
    *)
      echo -e "${RED}Invalid option. Exiting.${NC}"
      exit 1
      ;;
  esac
  
  echo ""
  echo -e "${GREEN}Deployment complete!${NC}"
}

# Run the main function
main 