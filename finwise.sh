#!/bin/bash

# FinWise Application Management Script
# Usage: ./finwise.sh [command]

# Configuration
CLIENT_DIR="$(pwd)/client-react"
SERVER_DIR="$(pwd)/server-python"
LOG_DIR="$(pwd)/logs"
PID_DIR="$(pwd)/var/run"
SERVER_PORT=9000
CLIENT_PORT=3000
NGINX_CONF="/opt/homebrew/etc/nginx/servers/finwise.conf"

# Create necessary directories
mkdir -p "$LOG_DIR" "$PID_DIR"

# Check if required directories exist
if [[ ! -d "$CLIENT_DIR" ]]; then
    echo "Error: Client directory not found at $CLIENT_DIR"
    exit 1
fi

if [[ ! -d "$SERVER_DIR" ]]; then
    echo "Error: Server directory not found at $SERVER_DIR"
    exit 1
fi

# Colors for better formatting
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to show usage
show_usage() {
    echo -e "${BLUE}FinWise Application Management Script${NC}"
    echo ""
    echo "Usage: ./finwise.sh [command]"
    echo ""
    echo "Commands:"
    echo "  start        - Start both client and server"
    echo "  stop         - Stop both client and server"
    echo "  restart      - Restart both client and server"
    echo "  status       - Show status of all components"
    echo "  client       - Start only the client"
    echo "  server       - Start only the server"
    echo "  logs         - Show recent logs"
    echo "  logs client  - Show client logs"
    echo "  logs server  - Show server logs"
    echo "  nginx check  - Check Nginx status and provide instructions"
    echo "  nginx check-config - Verify Nginx has loaded FinWise configuration"
    echo "  nginx reload - Reload Nginx configuration"
    echo "  nginx status - Check detailed Nginx status"
    echo "  analyze      - Run basic system checks"
    echo "  help         - Show this help message"
    echo ""
}

# Function to start the server
start_server() {
    echo -e "${BLUE}Starting FinWise server...${NC}"
    cd "$SERVER_DIR" || exit 1
    
    # Check if server is already running
    if [[ -f "$PID_DIR/server.pid" ]]; then
        SERVER_PID=$(cat "$PID_DIR/server.pid")
        if ps -p "$SERVER_PID" > /dev/null; then
            echo -e "${YELLOW}Server is already running with PID $SERVER_PID${NC}"
            return 0
        else
            echo "Removing stale PID file"
            rm "$PID_DIR/server.pid"
        fi
    fi
    
    # Activate virtual environment if it exists
    if [[ -d "venv" ]]; then
        source venv/bin/activate
    fi
    
    # Start the server
    nohup python app.py > "$LOG_DIR/server.log" 2>&1 &
    SERVER_PID=$!
    echo $SERVER_PID > "$PID_DIR/server.pid"
    echo -e "${GREEN}Server started with PID $SERVER_PID${NC}"
    
    # Deactivate virtual environment if it was activated
    if [[ -n "$VIRTUAL_ENV" ]]; then
        deactivate
    fi
    
    cd - > /dev/null || exit 1
}

# Function to start the client
start_client() {
    echo -e "${BLUE}Starting FinWise client...${NC}"
    cd "$CLIENT_DIR" || exit 1
    
    # Check if client is already running
    if [[ -f "$PID_DIR/client.pid" ]]; then
        CLIENT_PID=$(cat "$PID_DIR/client.pid")
        if ps -p "$CLIENT_PID" > /dev/null; then
            echo -e "${YELLOW}Client is already running with PID $CLIENT_PID${NC}"
            return 0
        else
            echo "Removing stale PID file"
            rm "$PID_DIR/client.pid"
        fi
    fi
    
    # Start the client
    nohup npm start > "$LOG_DIR/client.log" 2>&1 &
    CLIENT_PID=$!
    echo $CLIENT_PID > "$PID_DIR/client.pid"
    echo -e "${GREEN}Client started with PID $CLIENT_PID${NC}"
    cd - > /dev/null || exit 1
}

# Function to stop the server
stop_server() {
    echo -e "${BLUE}Stopping FinWise server...${NC}"
    if [[ -f "$PID_DIR/server.pid" ]]; then
        SERVER_PID=$(cat "$PID_DIR/server.pid")
        if ps -p "$SERVER_PID" > /dev/null; then
            kill "$SERVER_PID"
            echo -e "${GREEN}Server stopped (PID $SERVER_PID)${NC}"
        else
            echo -e "${YELLOW}No running server found with PID $SERVER_PID${NC}"
        fi
        rm "$PID_DIR/server.pid"
    else
        echo -e "${YELLOW}No server PID file found${NC}"
        # Try to find and kill any running server processes
        for SERVER_PID in $(ps aux | grep "[p]ython app.py" | awk '{print $2}'); do
            if [[ -n "$SERVER_PID" ]]; then
                kill "$SERVER_PID"
                echo -e "${GREEN}Found and stopped server with PID $SERVER_PID${NC}"
            fi
        done
        
        if [[ -z "$SERVER_PID" ]]; then
            echo -e "${RED}No running server process found${NC}"
        fi
    fi
}

# Function to stop the client
stop_client() {
    echo -e "${BLUE}Stopping FinWise client...${NC}"
    if [[ -f "$PID_DIR/client.pid" ]]; then
        CLIENT_PID=$(cat "$PID_DIR/client.pid")
        if ps -p "$CLIENT_PID" > /dev/null; then
            kill "$CLIENT_PID"
            echo -e "${GREEN}Client stopped (PID $CLIENT_PID)${NC}"
        else
            echo -e "${YELLOW}No running client found with PID $CLIENT_PID${NC}"
        fi
        rm "$PID_DIR/client.pid"
    else
        echo -e "${YELLOW}No client PID file found${NC}"
        # Try to find and kill any running client processes
        for CLIENT_PID in $(ps aux | grep "node.*vite" | grep -v grep | awk '{print $2}'); do
            if [[ -n "$CLIENT_PID" ]]; then
                kill "$CLIENT_PID"
                echo -e "${GREEN}Found and stopped client with PID $CLIENT_PID${NC}"
            fi
        done
        
        if [[ -z "$CLIENT_PID" ]]; then
            echo -e "${RED}No running client process found${NC}"
        fi
    fi
}

# Function to check if a port is in use
check_port() {
    local port=$1
    if lsof -i ":$port" > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is not in use
    fi
}

# Function to check status
check_status() {
    echo -e "${BLUE}Checking FinWise status...${NC}"
    
    # Wait a moment for processes to fully start
    sleep 1
    
    # Check server
    echo -e "${YELLOW}Server:${NC}"
    if [[ -f "$PID_DIR/server.pid" ]]; then
        SERVER_PID=$(cat "$PID_DIR/server.pid")
        if ps -p "$SERVER_PID" > /dev/null; then
            echo -e "  ${GREEN}Running (PID $SERVER_PID)${NC}"
            # Check if port is actually being listened on
            if check_port $SERVER_PORT; then
                echo -e "  ${GREEN}Listening on port $SERVER_PORT${NC}"
            else
                echo -e "  ${RED}Not listening on port $SERVER_PORT${NC}"
            fi
        else
            echo -e "  ${RED}Not running (stale PID file)${NC}"
            rm "$PID_DIR/server.pid"
        fi
    else
        # Try to find a running server
        SERVER_PID=$(ps aux | grep "[p]ython app.py" | awk '{print $2}' | head -1)
        if [[ -n "$SERVER_PID" ]]; then
            echo -e "  ${GREEN}Running (PID $SERVER_PID) but no PID file${NC}"
            # Create the PID file
            echo "$SERVER_PID" > "$PID_DIR/server.pid"
            echo -e "  ${GREEN}Created PID file${NC}"
        else
            echo -e "  ${RED}Not running${NC}"
        fi
    fi
    
    # Check client
    echo -e "${YELLOW}Client:${NC}"
    if [[ -f "$PID_DIR/client.pid" ]]; then
        CLIENT_PID=$(cat "$PID_DIR/client.pid")
        if ps -p "$CLIENT_PID" > /dev/null; then
            echo -e "  ${GREEN}Running (PID $CLIENT_PID)${NC}"
            # Check if port is actually being listened on
            if check_port $CLIENT_PORT; then
                echo -e "  ${GREEN}Listening on port $CLIENT_PORT${NC}"
            else
                echo -e "  ${RED}Not listening on port $CLIENT_PORT${NC}"
            fi
        else
            echo -e "  ${RED}Not running (stale PID file)${NC}"
            rm "$PID_DIR/client.pid"
        fi
    else
        # Try to find a running client
        CLIENT_PID=$(ps aux | grep "node.*vite" | grep -v grep | awk '{print $2}' | head -1)
        if [[ -n "$CLIENT_PID" ]]; then
            echo -e "  ${GREEN}Running (PID $CLIENT_PID) but no PID file${NC}"
            # Create the PID file
            echo "$CLIENT_PID" > "$PID_DIR/client.pid"
            echo -e "  ${GREEN}Created PID file${NC}"
        else
            echo -e "  ${RED}Not running${NC}"
        fi
    fi
    
    # Check Nginx
    echo -e "${YELLOW}Nginx:${NC}"
    # Check for HTTP or HTTPS
    if check_port 80 || check_port 443; then
        if check_port 80; then
            echo -e "  ${GREEN}Web server active on port 80 (HTTP)${NC}"
        fi
        
        if check_port 443; then
            echo -e "  ${GREEN}Web server active on port 443 (HTTPS)${NC}"
        fi
        
        # Try to determine if it's Nginx
        if pgrep -x "nginx" > /dev/null || ps aux | grep -v grep | grep -q "nginx"; then
            echo -e "  ${GREEN}Nginx process detected${NC}"
        else
            echo -e "  ${YELLOW}Web server active but Nginx process not detected (might be running differently)${NC}"
        fi
        
        # Check nginx configuration
        if [[ -f "$NGINX_CONF" ]]; then
            echo -e "  ${GREEN}Configuration exists at $NGINX_CONF${NC}"
        else
            echo -e "  ${YELLOW}Configuration not found at $NGINX_CONF${NC}"
        fi
    else
        echo -e "  ${RED}No web server detected on ports 80 or 443${NC}"
    fi
    
    echo ""
    echo -e "${BLUE}Access URLs:${NC}"
    echo -e "  ${GREEN}Local:${NC} http://localhost:$CLIENT_PORT"
    echo -e "  ${GREEN}Public:${NC} http://finwise.rerecreation.us"
}

# Function to show logs
show_logs() {
    if [[ "$1" == "client" ]]; then
        if [[ -f "$LOG_DIR/client.log" ]]; then
            echo -e "${BLUE}Showing client logs:${NC}"
            tail -n 100 "$LOG_DIR/client.log"
        else
            echo -e "${RED}No client logs found${NC}"
        fi
    elif [[ "$1" == "server" ]]; then
        if [[ -f "$LOG_DIR/server.log" ]]; then
            echo -e "${BLUE}Showing server logs:${NC}"
            tail -n 100 "$LOG_DIR/server.log"
        else
            echo -e "${RED}No server logs found${NC}"
        fi
    else
        # Show both logs
        echo -e "${BLUE}Recent logs:${NC}"
        
        echo -e "${YELLOW}Client logs:${NC}"
        if [[ -f "$LOG_DIR/client.log" ]]; then
            tail -n 50 "$LOG_DIR/client.log"
        else
            echo -e "${RED}No client logs found${NC}"
        fi
        
        echo ""
        echo -e "${YELLOW}Server logs:${NC}"
        if [[ -f "$LOG_DIR/server.log" ]]; then
            tail -n 50 "$LOG_DIR/server.log"
        else
            echo -e "${RED}No server logs found${NC}"
        fi
    fi
}

# Function to reload nginx
nginx_reload() {
    echo -e "${BLUE}Reloading Nginx configuration...${NC}"
    sudo nginx -t && sudo nginx -s reload
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}Nginx configuration reloaded successfully${NC}"
    else
        echo -e "${RED}Failed to reload Nginx configuration${NC}"
    fi
}

# Function to check nginx status
nginx_status() {
    echo -e "${BLUE}Checking Nginx status...${NC}"
    if pgrep -x "nginx" > /dev/null; then
        echo -e "${GREEN}Nginx is running${NC}"
        echo ""
        echo -e "${YELLOW}Active connections:${NC}"
        sudo nginx -s status 2>/dev/null || echo "Status not available"
        echo ""
        echo -e "${YELLOW}Configuration:${NC}"
        sudo nginx -T | grep -A 10 "server_name finwise.rerecreation.us"
    else
        echo -e "${RED}Nginx is not running${NC}"
    fi
}

# Function to analyze the system
analyze_system() {
    echo -e "${BLUE}Analyzing FinWise system...${NC}"
    
    # Check disk space
    echo -e "${YELLOW}Disk space:${NC}"
    df -h | grep -E "Filesystem|/$"
    
    # Check memory usage
    echo -e "\n${YELLOW}Memory usage:${NC}"
    free -h
    
    # Check CPU usage
    echo -e "\n${YELLOW}CPU usage:${NC}"
    top -l 1 | grep -E "^CPU"
    
    # Check network connections
    echo -e "\n${YELLOW}Network connections:${NC}"
    echo "Local connections to ports $SERVER_PORT and $CLIENT_PORT:"
    netstat -an | grep -E "$SERVER_PORT|$CLIENT_PORT" | head -n 10
    
    # Check application files
    echo -e "\n${YELLOW}Application files:${NC}"
    
    echo "Client files:"
    ls -la "$CLIENT_DIR/src" | head -n 10
    
    echo "Server files:"
    ls -la "$SERVER_DIR" | head -n 10
    
    # Check package.json for outdated dependencies
    echo -e "\n${YELLOW}Client dependencies:${NC}"
    if [[ -f "$CLIENT_DIR/package.json" ]]; then
        node -e "const pkg = require('$CLIENT_DIR/package.json'); console.log('Total dependencies:', Object.keys(pkg.dependencies || {}).length + Object.keys(pkg.devDependencies || {}).length);" 2>/dev/null || echo "Unable to parse package.json"
    else
        echo "No package.json found"
    fi
    
    # Check python requirements
    echo -e "\n${YELLOW}Server dependencies:${NC}"
    if [[ -f "$SERVER_DIR/requirements.txt" ]]; then
        echo "Requirements file exists with $(wc -l < "$SERVER_DIR/requirements.txt") packages"
    else
        echo "No requirements.txt found"
    fi
    
    # Summary
    echo -e "\n${BLUE}System summary:${NC}"
    echo -e "  FinWise application seems to be $(check_status | grep -q "Running" && echo "${GREEN}healthy${NC}" || echo "${RED}unhealthy${NC}")"
    echo -e "  Web server is $(pgrep -x "nginx" > /dev/null && echo "${GREEN}running${NC}" || echo "${RED}not running${NC}")"
    echo "  Application can be accessed at http://finwise.rerecreation.us"
}

# Function to start nginx
start_nginx() {
    echo -e "${BLUE}Checking Nginx status...${NC}"
    
    # First check if port 80 is being used (most reliable indicator)
    if netstat -an | grep -q "LISTEN.*:80"; then
        echo -e "${GREEN}Port 80 is active (Nginx or another web server is running)${NC}"
        
        # Now try to determine if it's actually Nginx
        if pgrep -x "nginx" > /dev/null || ps aux | grep -v grep | grep -q "nginx"; then
            echo -e "${GREEN}Nginx is confirmed to be running${NC}"
        else
            echo -e "${YELLOW}Note: Port 80 is in use, but the Nginx process wasn't detected${NC}"
            echo -e "This might be because Nginx is:"
            echo -e "  - Running under a different user"
            echo -e "  - Started via a service manager"
            echo -e "  - Named differently in the process list"
        fi
        
        # Check config
        if [[ -f "$NGINX_CONF" ]]; then
            echo -e "${GREEN}FinWise Nginx configuration exists at $NGINX_CONF${NC}"
            if grep -q "finwise.rerecreation.us" "$NGINX_CONF"; then
                echo -e "${GREEN}Configuration contains the correct domain${NC}"
            else
                echo -e "${YELLOW}Configuration might not have the correct domain settings${NC}"
            fi
        else
            echo -e "${YELLOW}FinWise Nginx configuration not found at expected location${NC}"
            echo -e "You might need to create it with:"
            echo -e "  sudo nano $NGINX_CONF"
        fi
    else
        echo -e "${YELLOW}Port 80 is not active (no web server detected)${NC}"
        echo -e "If your other sites are working, they might be:"
        echo -e "  - Using a different port (e.g., 8080)"
        echo -e "  - Running on HTTPS (port 443) only"
        echo -e "  - Running through a proxy service"
        echo -e ""
        echo -e "To start Nginx, run:"
        echo -e "  sudo nginx"
        echo -e ""
        echo -e "To check what's using port 80 (if anything):"
        echo -e "  sudo lsof -i :80"
    fi
}

# Function to check if Nginx has loaded our configuration
check_nginx_config() {
    echo -e "${BLUE}Checking if Nginx has loaded FinWise configuration...${NC}"
    
    # Check for running Nginx
    if ! pgrep -x "nginx" > /dev/null && ! ps aux | grep -v grep | grep -q "nginx"; then
        echo -e "${RED}Nginx is not running!${NC}"
        echo -e "Start Nginx first with: sudo nginx"
        return 1
    fi
    
    # Check if our configuration file exists
    if [[ ! -f "$NGINX_CONF" ]]; then
        echo -e "${RED}FinWise configuration file not found at $NGINX_CONF${NC}"
        echo -e "Create it with: sudo nano $NGINX_CONF"
        return 1
    fi
    
    # Check if Nginx has loaded our domain
    if sudo nginx -T 2>/dev/null | grep -q "server_name finwise.rerecreation.us"; then
        echo -e "${GREEN}✓ Nginx has loaded the FinWise configuration!${NC}"
        echo -e "${GREEN}✓ finwise.rerecreation.us is configured in Nginx${NC}"
        
        # Check if port 3000 is mentioned in the proxy_pass
        if sudo nginx -T 2>/dev/null | grep -q "proxy_pass.*3000"; then
            echo -e "${GREEN}✓ Proxy to port 3000 is configured${NC}"
        else
            echo -e "${RED}✗ No proxy to port 3000 found in Nginx config${NC}"
            echo -e "Check the proxy_pass directive in your configuration"
        fi
    else
        echo -e "${RED}✗ Nginx has not loaded the FinWise configuration!${NC}"
        echo "Possible issues:"
        echo "1. You need to reload Nginx after editing the config"
        echo "2. There might be syntax errors in your config file"
        echo "3. The include directive for your config might be missing"
        echo ""
        echo "Try running: sudo nginx -t && sudo nginx -s reload"
        return 1
    fi
    
    # Test domain resolution
    echo -e "\n${BLUE}Testing domain resolution...${NC}"
    if host finwise.rerecreation.us > /dev/null 2>&1; then
        echo -e "${GREEN}✓ Domain resolves correctly${NC}"
        echo -e "DNS is properly configured for finwise.rerecreation.us"
    else
        echo -e "${YELLOW}⚠ Domain resolution failed${NC}"
        echo -e "Make sure DNS records are properly set up for finwise.rerecreation.us"
        echo -e "If testing locally, add an entry to /etc/hosts"
    fi
    
    return 0
}

# Process commands
case "$1" in
    start)
        start_server
        start_client
        sleep 2
        check_status
        ;;
    stop)
        stop_client
        stop_server
        ;;
    restart)
        stop_client
        stop_server
        sleep 2
        start_server
        start_client
        sleep 2
        check_status
        ;;
    server)
        start_server
        ;;
    client)
        start_client
        ;;
    status)
        check_status
        ;;
    logs)
        if [[ "$2" == "client" || "$2" == "server" ]]; then
            show_logs "$2"
        else
            show_logs
        fi
        ;;
    nginx)
        case "$2" in
            reload)
                nginx_reload
                ;;
            status)
                nginx_status
                ;;
            check)
                start_nginx
                ;;
            check-config)
                check_nginx_config
                ;;
            *)
                echo -e "${RED}Error: Unknown nginx command '$2'${NC}"
                show_usage
                exit 1
                ;;
        esac
        ;;
    analyze)
        analyze_system
        ;;
    help|--help|-h)
        show_usage
        ;;
    *)
        echo -e "${RED}Error: Unknown command '$1'${NC}"
        show_usage
        exit 1
        ;;
esac

exit 0 