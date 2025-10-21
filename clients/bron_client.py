#!/usr/bin/env python3
"""
Bron Vault Upload Client (Python)

Upload stealer logs to Bron Vault using API key authentication

Usage:
    python bron_client.py upload <file_path> [--password PASSWORD]
    python bron_client.py monitor <job_id>
    python bron_client.py list-keys

Requirements:
    pip install requests

Environment variables:
    BRON_API_KEY   - Your Bron Vault API key (required)
    BRON_API_URL   - Bron Vault API URL (default: http://localhost:3000)
"""

import os
import sys
import time
import argparse
import requests
from pathlib import Path
from typing import Optional, Dict, Any


class BronVaultClient:
    """Bron Vault API Client"""

    def __init__(self, api_url: Optional[str] = None, api_key: Optional[str] = None):
        self.api_url = api_url or os.getenv("BRON_API_URL", "http://localhost:3000")
        self.api_key = api_key or os.getenv("BRON_API_KEY")

        if not self.api_key:
            raise ValueError(
                "API key is required. Set BRON_API_KEY environment variable or pass api_key parameter"
            )

        self.session = requests.Session()
        self.session.headers.update({"X-API-Key": self.api_key})

    def upload(self, file_path: str, password: Optional[str] = None) -> Dict[str, Any]:
        """
        Upload an archive file to Bron Vault

        Args:
            file_path: Path to archive file
            password: Optional password for encrypted archives

        Returns:
            Response dictionary with job_id and status_url
        """
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"File not found: {file_path}")

        filename = file_path.name
        file_size = file_path.stat().st_size

        print(f"📦 Uploading: {filename}")
        print(f"📊 Size: {file_size:,} bytes ({file_size / 1024 / 1024:.2f} MB)")

        headers = {
            "X-Filename": filename,
            "Content-Type": "application/octet-stream",
        }

        if password:
            headers["X-Archive-Password"] = password
            print("🔐 Password: ***")

        print(f"🌐 API URL: {self.api_url}/api/v1/external/upload")

        with open(file_path, "rb") as f:
            response = self.session.post(
                f"{self.api_url}/api/v1/external/upload", headers=headers, data=f
            )

        response.raise_for_status()
        result = response.json()

        print("\n✅ Upload successful!")
        print(f"Job ID: {result['job_id']}")
        print(f"Status URL: {self.api_url}{result['status_url']}")

        return result

    def get_job_status(self, job_id: str) -> Dict[str, Any]:
        """
        Get job status

        Args:
            job_id: Job ID

        Returns:
            Job status dictionary
        """
        response = self.session.get(f"{self.api_url}/api/v1/jobs/{job_id}")
        response.raise_for_status()
        return response.json()

    def monitor_job(self, job_id: str, poll_interval: int = 2) -> Dict[str, Any]:
        """
        Monitor job until completion

        Args:
            job_id: Job ID
            poll_interval: Polling interval in seconds

        Returns:
            Final job result
        """
        print(f"\n⏳ Monitoring job: {job_id}")
        print("Press Ctrl+C to stop\n")

        try:
            while True:
                status = self.get_job_status(job_id)
                job = status.get("job", {})
                state = job.get("state", "unknown")
                progress = job.get("progress", 0)

                print(f"\rStatus: {state} | Progress: {progress}%", end="", flush=True)

                if state == "completed":
                    print("\n\n✅ Job completed!")
                    result = job.get("result", {})
                    print(f"Devices processed: {result.get('devicesProcessed', 0)}")
                    print(f"Total files: {result.get('totalFiles', 0)}")
                    print(f"Total credentials: {result.get('totalCredentials', 0)}")
                    print(f"Total domains: {result.get('totalDomains', 0)}")
                    print(f"Total URLs: {result.get('totalUrls', 0)}")
                    return status
                elif state == "failed":
                    print("\n\n❌ Job failed!")
                    error = job.get("failedReason", "Unknown error")
                    print(f"Error: {error}")
                    sys.exit(1)

                time.sleep(poll_interval)
        except KeyboardInterrupt:
            print("\n\n⚠️  Monitoring stopped (job is still processing)")
            return status

    def upload_and_wait(
        self, file_path: str, password: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Upload file and wait for completion

        Args:
            file_path: Path to archive file
            password: Optional password for encrypted archives

        Returns:
            Final job result
        """
        result = self.upload(file_path, password)
        job_id = result["job_id"]
        return self.monitor_job(job_id)


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description="Bron Vault Upload Client",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
    # Upload file
    python bron_client.py upload logs.zip

    # Upload encrypted archive
    python bron_client.py upload logs.zip --password infected

    # Upload and monitor
    python bron_client.py upload logs.zip --wait

    # Monitor existing job
    python bron_client.py monitor upload_1234567890_abc123

Environment Variables:
    BRON_API_KEY   Your Bron Vault API key (required)
    BRON_API_URL   Bron Vault API URL (default: http://localhost:3000)
        """,
    )

    subparsers = parser.add_subparsers(dest="command", help="Command to execute")

    # Upload command
    upload_parser = subparsers.add_parser("upload", help="Upload archive file")
    upload_parser.add_argument("file", help="Path to archive file")
    upload_parser.add_argument(
        "-p", "--password", help="Password for encrypted archive"
    )
    upload_parser.add_argument(
        "-w", "--wait", action="store_true", help="Wait for job completion"
    )

    # Monitor command
    monitor_parser = subparsers.add_parser("monitor", help="Monitor job status")
    monitor_parser.add_argument("job_id", help="Job ID to monitor")

    # Parse arguments
    args = parser.parse_args()

    if not args.command:
        parser.print_help()
        sys.exit(1)

    try:
        client = BronVaultClient()

        if args.command == "upload":
            if args.wait:
                client.upload_and_wait(args.file, args.password)
            else:
                result = client.upload(args.file, args.password)
                print(
                    f"\nRun to monitor: python {sys.argv[0]} monitor {result['job_id']}"
                )

        elif args.command == "monitor":
            client.monitor_job(args.job_id)

    except ValueError as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        print(
            "\nSet your API key: export BRON_API_KEY='bv_your_key_here'",
            file=sys.stderr,
        )
        sys.exit(1)
    except FileNotFoundError as e:
        print(f"❌ Error: {e}", file=sys.stderr)
        sys.exit(1)
    except requests.exceptions.HTTPError as e:
        print(f"❌ HTTP Error: {e}", file=sys.stderr)
        if e.response is not None:
            try:
                error_data = e.response.json()
                print(f"Details: {error_data.get('error', 'Unknown error')}")
            except:
                print(e.response.text)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\n\n⚠️  Interrupted by user")
        sys.exit(130)
    except Exception as e:
        print(f"❌ Unexpected error: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
