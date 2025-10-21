#!/bin/bash
#
# Bron Vault Upload Client (Bash)
#
# Upload stealer logs to Bron Vault using API key authentication
#
# Usage:
#   ./bron-upload.sh <file_path> [password]
#
# Environment variables:
#   BRON_API_KEY   - Your Bron Vault API key (required)
#   BRON_API_URL   - Bron Vault API URL (default: http://localhost:3000)
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_URL="${BRON_API_URL:-http://localhost:3000}"
API_KEY="${BRON_API_KEY}"

# Functions
print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_usage() {
    cat <<EOF
Bron Vault Upload Client

Usage:
    $0 <file_path> [password]

Arguments:
    file_path    Path to archive file (.zip, .tar, .tar.gz, .7z, etc.)
    password     Optional password for encrypted archives

Environment Variables:
    BRON_API_KEY   Your Bron Vault API key (required)
    BRON_API_URL   Bron Vault API URL (default: http://localhost:3000)

Examples:
    # Upload ZIP file
    export BRON_API_KEY="bv_your_api_key_here"
    $0 logs.zip

    # Upload encrypted ZIP with password
    $0 logs.zip infected

    # Upload TAR.GZ file
    $0 logs.tar.gz

    # Custom API URL
    export BRON_API_URL="https://bron.example.com"
    $0 logs.zip
EOF
}

check_dependencies() {
    if ! command -v curl &> /dev/null; then
        print_error "curl is required but not installed"
        exit 1
    fi

    if ! command -v jq &> /dev/null; then
        print_warning "jq is not installed - JSON output will be raw"
        print_info "Install jq for better output: apt-get install jq / brew install jq"
    fi
}

upload_file() {
    local file_path="$1"
    local password="$2"
    local filename=$(basename "$file_path")

    print_info "Uploading: $filename"
    print_info "Size: $(du -h "$file_path" | cut -f1)"

    # Build headers
    local headers=(
        -H "X-API-Key: $API_KEY"
        -H "X-Filename: $filename"
        -H "Content-Type: application/octet-stream"
    )

    if [ -n "$password" ]; then
        headers+=(-H "X-Archive-Password: $password")
        print_info "Password: ***"
    fi

    # Upload file
    print_info "Uploading to: $API_URL/api/v1/external/upload"

    local response=$(curl -s -w "\n%{http_code}" \
        -X POST "$API_URL/api/v1/external/upload" \
        "${headers[@]}" \
        --data-binary "@$file_path")

    local http_code=$(echo "$response" | tail -n1)
    local body=$(echo "$response" | sed '$d')

    if [ "$http_code" -eq 200 ]; then
        print_success "Upload successful!"
        echo ""

        if command -v jq &> /dev/null; then
            # Pretty print with jq
            echo "$body" | jq .

            local job_id=$(echo "$body" | jq -r '.job_id')
            local status_url=$(echo "$body" | jq -r '.status_url')

            echo ""
            print_info "Job ID: $job_id"
            print_info "Monitor status: $API_URL$status_url"

            # Ask if user wants to monitor
            read -p "Monitor job status? [y/N] " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                monitor_job "$job_id"
            fi
        else
            # Raw output without jq
            echo "$body"
        fi
    else
        print_error "Upload failed (HTTP $http_code)"
        echo "$body"
        exit 1
    fi
}

monitor_job() {
    local job_id="$1"

    print_info "Monitoring job: $job_id"
    print_info "Press Ctrl+C to stop"
    echo ""

    while true; do
        local response=$(curl -s \
            -H "X-API-Key: $API_KEY" \
            "$API_URL/api/v1/jobs/$job_id")

        if command -v jq &> /dev/null; then
            local state=$(echo "$response" | jq -r '.job.state')
            local progress=$(echo "$response" | jq -r '.job.progress // 0')

            echo -ne "\rStatus: $state | Progress: ${progress}%    "

            if [ "$state" = "completed" ]; then
                echo ""
                print_success "Job completed!"
                echo ""
                echo "$response" | jq '.job.result'
                break
            elif [ "$state" = "failed" ]; then
                echo ""
                print_error "Job failed!"
                echo ""
                echo "$response" | jq '.job.error'
                exit 1
            fi
        else
            echo "$response"
        fi

        sleep 2
    done
}

# Main
main() {
    check_dependencies

    # Check arguments
    if [ $# -lt 1 ] || [ "$1" = "-h" ] || [ "$1" = "--help" ]; then
        print_usage
        exit 0
    fi

    # Check API key
    if [ -z "$API_KEY" ]; then
        print_error "BRON_API_KEY environment variable is not set"
        echo ""
        echo "Get your API key from the Bron Vault web interface:"
        echo "1. Login to Bron Vault"
        echo "2. Go to Settings > API Keys"
        echo "3. Create a new API key"
        echo "4. Export it: export BRON_API_KEY=\"bv_your_key_here\""
        echo ""
        exit 1
    fi

    local file_path="$1"
    local password="$2"

    # Check file exists
    if [ ! -f "$file_path" ]; then
        print_error "File not found: $file_path"
        exit 1
    fi

    # Upload file
    upload_file "$file_path" "$password"
}

main "$@"
