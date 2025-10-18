#!/usr/bin/env bash

# IRRExplorer Installation Script
# Supports both Docker and native installation on Linux and macOS

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script version
VERSION="1.0.0"

# Default values
INSTALL_METHOD=""
SKIP_DATA_IMPORT=false
PRODUCTION_MODE=false
AUTO_START=true

# Helper functions
print_header() {
    echo -e "\n${BLUE}================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}================================${NC}\n"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if [ -f /etc/os-release ]; then
            . /etc/os-release
            DISTRO=$ID
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
        DISTRO="macos"
    else
        OS="unknown"
        DISTRO="unknown"
    fi
}

# Show welcome message
show_welcome() {
    clear
    cat << "EOF"
    _____ _____  _____  ______          _
   |_   _|  __ \|  __ \|  ____|        | |
     | | | |__) | |__) | |__  __  ___ | | ___  _ __ ___ _ __
     | | |  _  /|  _  /|  __| \ \/ / '_ \| |/ _ \| '__/ _ \ '__|
    _| |_| | \ \| | \ \| |____ >  <| |_) | | (_) | | |  __/ |
   |_____|_|  \_\_|  \_\______/_/\_\ .__/|_|\___/|_|  \___|_|
                                    | |
                                    |_|
EOF
    echo -e "\n${BLUE}Internet Routing Registry Explorer${NC}"
    echo -e "Version: $VERSION\n"
    echo -e "This script will guide you through the installation process.\n"
}

# Check system requirements
check_system_requirements() {
    print_header "Checking System Requirements"

    # Check RAM
    if [[ "$OS" == "linux" ]]; then
        TOTAL_RAM=$(free -g | awk '/^Mem:/{print $2}')
    elif [[ "$OS" == "macos" ]]; then
        TOTAL_RAM=$(sysctl -n hw.memsize | awk '{print int($1/1024/1024/1024)}')
    fi

    if [ "$TOTAL_RAM" -lt 4 ]; then
        print_warning "System has ${TOTAL_RAM}GB RAM. Recommended: 4GB+"
    else
        print_success "RAM: ${TOTAL_RAM}GB"
    fi

    # Check disk space
    AVAILABLE_SPACE=$(df -BG . | awk 'NR==2 {print int($4)}')
    if [ "$AVAILABLE_SPACE" -lt 10 ]; then
        print_error "Insufficient disk space. Available: ${AVAILABLE_SPACE}GB, Required: 10GB"
        exit 1
    else
        print_success "Disk Space: ${AVAILABLE_SPACE}GB available"
    fi

    # Check CPU cores
    if [[ "$OS" == "linux" ]]; then
        CPU_CORES=$(nproc)
    elif [[ "$OS" == "macos" ]]; then
        CPU_CORES=$(sysctl -n hw.ncpu)
    fi
    print_success "CPU Cores: $CPU_CORES"
}

# Ask installation method
ask_installation_method() {
    print_header "Select Installation Method"

    echo "1) Docker (Recommended - Easiest setup)"
    echo "2) Native (Manual - More control)"
    echo "3) Exit"
    echo ""
    read -p "Choose installation method [1-3]: " choice

    case $choice in
        1)
            INSTALL_METHOD="docker"
            print_info "Selected: Docker installation"
            ;;
        2)
            INSTALL_METHOD="native"
            print_info "Selected: Native installation"
            ;;
        3)
            echo "Installation cancelled."
            exit 0
            ;;
        *)
            print_error "Invalid choice. Please run the script again."
            exit 1
            ;;
    esac
}

# Ask additional options
ask_options() {
    print_header "Installation Options"

    # Production mode
    read -p "Production mode? (y/N): " prod_choice
    if [[ "$prod_choice" =~ ^[Yy]$ ]]; then
        PRODUCTION_MODE=true
        print_info "Production mode enabled"
    else
        PRODUCTION_MODE=false
        print_info "Development mode enabled"
    fi

    # Auto start
    read -p "Start services automatically after installation? (Y/n): " start_choice
    if [[ "$start_choice" =~ ^[Nn]$ ]]; then
        AUTO_START=false
    else
        AUTO_START=true
    fi

    # Skip data import
    read -p "Skip initial data import? (takes 15-30 minutes) (y/N): " skip_choice
    if [[ "$skip_choice" =~ ^[Yy]$ ]]; then
        SKIP_DATA_IMPORT=true
        print_warning "Data import will be skipped. Run manually later."
    else
        SKIP_DATA_IMPORT=false
    fi
}

# Install Docker
install_docker() {
    print_header "Installing Docker"

    if command_exists docker && command_exists docker-compose; then
        print_success "Docker already installed"
        docker --version
        docker-compose --version
        return
    fi

    if [[ "$OS" == "linux" ]]; then
        print_info "Installing Docker on Linux..."
        curl -fsSL https://get.docker.com -o get-docker.sh
        sudo sh get-docker.sh
        rm get-docker.sh

        # Add current user to docker group
        sudo usermod -aG docker "$USER"
        print_warning "You may need to log out and back in for Docker permissions to take effect"

        # Install docker-compose
        sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
        sudo chmod +x /usr/local/bin/docker-compose

    elif [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            print_info "Installing Docker Desktop via Homebrew..."
            brew install --cask docker
            print_warning "Please start Docker Desktop manually before continuing"
            read -p "Press Enter once Docker Desktop is running..."
        else
            print_error "Homebrew not found. Please install Docker Desktop manually from:"
            print_info "https://www.docker.com/products/docker-desktop"
            exit 1
        fi
    fi

    print_success "Docker installed successfully"
}

# Docker installation
install_with_docker() {
    print_header "Docker Installation"

    # Check/Install Docker
    install_docker

    # Create environment file
    create_env_file

    # Select compose file
    if [ "$PRODUCTION_MODE" = true ]; then
        COMPOSE_FILE="docker-compose.yml"
    else
        COMPOSE_FILE="docker-compose.dev.yml"
    fi

    print_info "Using compose file: $COMPOSE_FILE"

    # Build and start containers
    print_header "Building Docker Images"
    docker-compose -f "$COMPOSE_FILE" build

    if [ "$AUTO_START" = true ]; then
        print_header "Starting Services"
        docker-compose -f "$COMPOSE_FILE" up -d

        # Wait for services to be ready
        print_info "Waiting for services to start..."
        sleep 10

        # Check service health
        print_header "Checking Service Health"
        if docker-compose -f "$COMPOSE_FILE" ps | grep -q "Up"; then
            print_success "Services are running"
        else
            print_error "Some services failed to start. Check logs with: docker-compose logs"
            exit 1
        fi

        # Import data
        if [ "$SKIP_DATA_IMPORT" = false ]; then
            import_data_docker "$COMPOSE_FILE"
        fi
    else
        print_info "Services not started. Run manually with: docker-compose -f $COMPOSE_FILE up -d"
    fi

    show_docker_completion
}

# Import data (Docker)
import_data_docker() {
    local compose_file=$1
    print_header "Importing Initial Data"
    print_warning "This may take 15-30 minutes depending on your connection..."

    if docker-compose -f "$compose_file" exec -T backend python -m irrexplorer.commands.import_data; then
        print_success "Data import completed"
    else
        print_error "Data import failed. You can run it manually later with:"
        print_info "docker-compose exec backend python -m irrexplorer.commands.import_data"
    fi
}

# Native installation
install_native() {
    print_header "Native Installation"

    # Check prerequisites
    check_native_prerequisites

    # Install system dependencies
    install_system_dependencies

    # Install Poetry
    install_poetry

    # Setup PostgreSQL
    setup_postgresql

    # Install Python dependencies
    install_python_dependencies

    # Setup database
    setup_database

    # Install frontend dependencies
    install_frontend_dependencies

    # Build frontend
    build_frontend

    # Create environment file
    create_env_file

    # Run migrations
    run_migrations

    # Import data
    if [ "$SKIP_DATA_IMPORT" = false ]; then
        import_data_native
    fi

    # Setup systemd services (optional)
    if [[ "$OS" == "linux" ]] && [ "$PRODUCTION_MODE" = true ]; then
        setup_systemd_services
    fi

    show_native_completion
}

# Check native prerequisites
check_native_prerequisites() {
    print_header "Checking Prerequisites"

    local missing_deps=()

    if ! command_exists python3; then
        missing_deps+=("python3")
    fi

    if ! command_exists psql; then
        missing_deps+=("postgresql")
    fi

    if ! command_exists node; then
        missing_deps+=("nodejs")
    fi

    if [ ${#missing_deps[@]} -gt 0 ]; then
        print_warning "Missing dependencies will be installed: ${missing_deps[*]}"
    else
        print_success "All prerequisites found"
    fi
}

# Install system dependencies
install_system_dependencies() {
    print_header "Installing System Dependencies"

    if [[ "$OS" == "linux" ]]; then
        if [[ "$DISTRO" == "ubuntu" ]] || [[ "$DISTRO" == "debian" ]]; then
            sudo apt-get update
            sudo apt-get install -y \
                python3.11 \
                python3.11-dev \
                python3-pip \
                postgresql-15 \
                postgresql-contrib \
                postgresql-15-postgis-3 \
                build-essential \
                libpq-dev \
                nodejs \
                npm \
                curl \
                git
        elif [[ "$DISTRO" == "centos" ]] || [[ "$DISTRO" == "rhel" ]] || [[ "$DISTRO" == "fedora" ]]; then
            sudo yum install -y \
                python3.11 \
                python3-devel \
                postgresql15-server \
                postgresql15-contrib \
                gcc \
                postgresql-devel \
                nodejs \
                npm \
                curl \
                git
        fi
    elif [[ "$OS" == "macos" ]]; then
        if command_exists brew; then
            brew install python@3.11 postgresql@15 node
        else
            print_error "Homebrew not found. Please install from: https://brew.sh"
            exit 1
        fi
    fi

    print_success "System dependencies installed"
}

# Install Poetry
install_poetry() {
    print_header "Installing Poetry"

    if command_exists poetry; then
        print_success "Poetry already installed"
        return
    fi

    curl -sSL https://install.python-poetry.org | python3 -
    export PATH="$HOME/.local/bin:$PATH"

    if command_exists poetry; then
        print_success "Poetry installed successfully"
    else
        print_error "Poetry installation failed"
        exit 1
    fi
}

# Setup PostgreSQL
setup_postgresql() {
    print_header "Setting up PostgreSQL"

    # Start PostgreSQL
    if [[ "$OS" == "linux" ]]; then
        sudo systemctl start postgresql
        sudo systemctl enable postgresql
    elif [[ "$OS" == "macos" ]]; then
        brew services start postgresql@15
    fi

    # Wait for PostgreSQL to start
    sleep 3

    print_success "PostgreSQL started"
}

# Setup database
setup_database() {
    print_header "Creating Database"

    # Generate random password
    DB_PASSWORD=$(openssl rand -base64 20 | tr -d "=+/" | cut -c1-20)

    # Create user and database
    if [[ "$OS" == "linux" ]]; then
        sudo -u postgres psql << EOF
CREATE USER irrexplorer WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE irrexplorer OWNER irrexplorer;
GRANT ALL PRIVILEGES ON DATABASE irrexplorer TO irrexplorer;
\c irrexplorer
CREATE EXTENSION IF NOT EXISTS btree_gist;
EOF
    elif [[ "$OS" == "macos" ]]; then
        psql postgres << EOF
CREATE USER irrexplorer WITH PASSWORD '$DB_PASSWORD';
CREATE DATABASE irrexplorer OWNER irrexplorer;
GRANT ALL PRIVILEGES ON DATABASE irrexplorer TO irrexplorer;
\c irrexplorer
CREATE EXTENSION IF NOT EXISTS btree_gist;
EOF
    fi

    # Store password for later use
    echo "DB_PASSWORD=$DB_PASSWORD" > .db_credentials
    chmod 600 .db_credentials

    print_success "Database created"
}

# Install Python dependencies
install_python_dependencies() {
    print_header "Installing Python Dependencies"

    poetry install
    print_success "Python dependencies installed"
}

# Install frontend dependencies
install_frontend_dependencies() {
    print_header "Installing Frontend Dependencies"

    cd frontend
    if command_exists yarn; then
        yarn install
    else
        npm install
    fi
    cd ..

    print_success "Frontend dependencies installed"
}

# Build frontend
build_frontend() {
    print_header "Building Frontend"

    cd frontend
    if command_exists yarn; then
        yarn build
    else
        npm run build
    fi
    cd ..

    print_success "Frontend built successfully"
}

# Create environment file
create_env_file() {
    print_header "Creating Environment Configuration"

    if [ -f .env ]; then
        print_warning ".env file already exists"
        read -p "Overwrite? (y/N): " overwrite
        if [[ ! "$overwrite" =~ ^[Yy]$ ]]; then
            print_info "Keeping existing .env file"
            return
        fi
    fi

    # Copy example file
    cp .env.example .env

    # Get database password if native installation
    if [ "$INSTALL_METHOD" = "native" ] && [ -f .db_credentials ]; then
        source .db_credentials
        sed -i.bak "s|DATABASE_URL=.*|DATABASE_URL=postgresql://irrexplorer:$DB_PASSWORD@localhost:5432/irrexplorer|g" .env
        rm .env.bak
    fi

    # Set debug mode
    if [ "$PRODUCTION_MODE" = true ]; then
        sed -i.bak 's|DEBUG=.*|DEBUG=False|g' .env
        rm .env.bak

        # Ask for production domain
        read -p "Enter your production domain (e.g., example.com): " domain
        if [ -n "$domain" ]; then
            sed -i.bak "s|ALLOWED_ORIGINS=.*|ALLOWED_ORIGINS=https://$domain,https://www.$domain|g" .env
            rm .env.bak
        fi
    else
        sed -i.bak 's|DEBUG=.*|DEBUG=True|g' .env
        rm .env.bak
    fi

    print_success "Environment file created"
}

# Run migrations
run_migrations() {
    print_header "Running Database Migrations"

    poetry run alembic upgrade head
    print_success "Database migrations completed"
}

# Import data (Native)
import_data_native() {
    print_header "Importing Initial Data"
    print_warning "This may take 15-30 minutes depending on your connection..."

    if poetry run python -m irrexplorer.commands.import_data; then
        print_success "Data import completed"
    else
        print_error "Data import failed. You can run it manually later with:"
        print_info "poetry run python -m irrexplorer.commands.import_data"
    fi
}

# Setup systemd services
setup_systemd_services() {
    print_header "Setting up Systemd Services"

    read -p "Setup systemd service for auto-start? (y/N): " setup_systemd
    if [[ ! "$setup_systemd" =~ ^[Yy]$ ]]; then
        return
    fi

    INSTALL_DIR=$(pwd)

    # Create backend service
    sudo tee /etc/systemd/system/irrexplorer-backend.service > /dev/null << EOF
[Unit]
Description=IRRExplorer Backend
After=network.target postgresql.service

[Service]
Type=simple
User=$USER
WorkingDirectory=$INSTALL_DIR
Environment="PATH=$HOME/.local/bin:/usr/local/bin:/usr/bin:/bin"
ExecStart=$HOME/.local/bin/poetry run uvicorn irrexplorer.app:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
EOF

    # Enable and start service
    sudo systemctl daemon-reload
    sudo systemctl enable irrexplorer-backend.service
    sudo systemctl start irrexplorer-backend.service

    print_success "Systemd service created and started"
}

# Show Docker completion message
show_docker_completion() {
    print_header "Installation Complete!"

    print_success "IRRExplorer has been installed successfully!"
    echo ""
    print_info "Access the application:"
    echo "  Frontend: http://localhost"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""
    print_info "Useful commands:"
    echo "  View logs:        docker-compose logs -f"
    echo "  Stop services:    docker-compose down"
    echo "  Start services:   docker-compose up -d"
    echo "  Restart:          docker-compose restart"
    echo "  Import data:      docker-compose exec backend python -m irrexplorer.commands.import_data"
    echo ""

    if [ "$SKIP_DATA_IMPORT" = true ]; then
        print_warning "Remember to import data manually:"
        echo "  docker-compose exec backend python -m irrexplorer.commands.import_data"
        echo ""
    fi

    print_info "Documentation:"
    echo "  Installation: INSTALLATION.md"
    echo "  Docker guide: DOCKER.md"
    echo "  Development: DEVELOPMENT.md"
    echo "  Security: SECURITY_CONFIGURATION.md"
}

# Show native completion message
show_native_completion() {
    print_header "Installation Complete!"

    print_success "IRRExplorer has been installed successfully!"
    echo ""
    print_info "Start the backend server:"
    echo "  poetry run uvicorn irrexplorer.app:app --host 0.0.0.0 --port 8000"
    echo ""
    print_info "Or for production with multiple workers:"
    echo "  poetry run gunicorn irrexplorer.app:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000"
    echo ""
    print_info "Serve the frontend:"
    echo "  cd frontend/build && python3 -m http.server 3000"
    echo ""
    print_info "Access the application:"
    echo "  Frontend: http://localhost:3000"
    echo "  Backend API: http://localhost:8000"
    echo "  API Docs: http://localhost:8000/docs"
    echo ""

    if [ "$SKIP_DATA_IMPORT" = true ]; then
        print_warning "Remember to import data manually:"
        echo "  poetry run python -m irrexplorer.commands.import_data"
        echo ""
    fi

    print_info "Database credentials saved in: .db_credentials"
    print_warning "Keep this file secure and back it up!"
    echo ""
    print_info "Documentation:"
    echo "  Installation: INSTALLATION.md"
    echo "  Development: DEVELOPMENT.md"
    echo "  Security: SECURITY_CONFIGURATION.md"
}

# Main installation flow
main() {
    # Show welcome screen
    show_welcome

    # Detect OS
    detect_os
    print_info "Detected OS: $OS ($DISTRO)"

    # Check system requirements
    check_system_requirements

    # Ask installation method
    ask_installation_method

    # Ask additional options
    ask_options

    # Confirm before proceeding
    echo ""
    read -p "Proceed with installation? (Y/n): " confirm
    if [[ "$confirm" =~ ^[Nn]$ ]]; then
        echo "Installation cancelled."
        exit 0
    fi

    # Install based on method
    if [ "$INSTALL_METHOD" = "docker" ]; then
        install_with_docker
    elif [ "$INSTALL_METHOD" = "native" ]; then
        install_native
    fi

    echo ""
    print_success "Thank you for installing IRRExplorer!"
}

# Run main function
main
