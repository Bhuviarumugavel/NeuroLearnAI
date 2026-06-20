"""
UiPath Orchestrator API Service
================================
Handles authentication and communication with UiPath Cloud Orchestrator.
Provides methods to:
  - Authenticate via OAuth2 (Client Credentials)
  - List available processes (releases)
  - Start / stop jobs
  - Check job status
"""
import httpx
import time
from typing import Optional
from app.config import (
    UIPATH_CLIENT_ID,
    UIPATH_CLIENT_SECRET,
    UIPATH_ORG_NAME,
    UIPATH_TENANT_NAME,
    UIPATH_FOLDER_ID,
    UIPATH_BASE_URL,
)


class UiPathService:
    """Async client for UiPath Cloud Orchestrator REST API."""

    # OAuth2 token endpoint
    TOKEN_URL = "https://cloud.uipath.com/identity_/connect/token"

    def __init__(self):
        self.client_id = UIPATH_CLIENT_ID
        self.client_secret = UIPATH_CLIENT_SECRET
        self.org_name = UIPATH_ORG_NAME
        self.tenant_name = UIPATH_TENANT_NAME
        self.folder_id = UIPATH_FOLDER_ID
        self.base_url = UIPATH_BASE_URL

        # Orchestrator API base
        self.api_base = (
            f"{self.base_url}/{self.org_name}/{self.tenant_name}"
            f"/orchestrator_/odata"
        )

        # Token cache
        self._access_token: Optional[str] = None
        self._token_expires_at: float = 0.0

    # ── Authentication ────────────────────────────────────────

    async def _get_access_token(self) -> str:
        """Get a valid OAuth2 access token, refreshing if expired."""
        # Return cached token if still valid (with 60s buffer)
        if self._access_token and time.time() < (self._token_expires_at - 60):
            return self._access_token

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.TOKEN_URL,
                data={
                    "grant_type": "client_credentials",
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "scope": (
                        "OR.Jobs OR.Jobs.Read OR.Jobs.Write "
                        "OR.Execution OR.Execution.Read OR.Execution.Write "
                        "OR.Folders OR.Folders.Read "
                        "OR.Robots OR.Robots.Read"
                    ),
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )
            response.raise_for_status()
            data = response.json()

        self._access_token = data["access_token"]
        # Token usually expires in 3600 seconds
        self._token_expires_at = time.time() + data.get("expires_in", 3600)
        return self._access_token

    async def _get_headers(self) -> dict:
        """Build authenticated request headers."""
        token = await self._get_access_token()
        return {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "X-UIPATH-OrganizationUnitId": str(self.folder_id),
        }

    # ── Processes (Releases) ──────────────────────────────────

    async def list_processes(self) -> dict:
        """List all published processes (releases) in the folder."""
        headers = await self._get_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base}/Releases",
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    async def get_process_by_name(self, process_name: str) -> Optional[dict]:
        """Find a specific process (release) by name."""
        headers = await self._get_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base}/Releases",
                headers=headers,
                params={"$filter": f"Name eq '{process_name}'"},
            )
            response.raise_for_status()
            data = response.json()
            releases = data.get("value", [])
            return releases[0] if releases else None

    # ── Jobs ──────────────────────────────────────────────────

    async def start_job(
        self,
        process_name: str,
        input_arguments: Optional[dict] = None,
    ) -> dict:
        """
        Start a UiPath job by process name.

        Args:
            process_name: Name of the published process/release.
            input_arguments: Optional dict of input arguments for the process.

        Returns:
            Job creation response from Orchestrator.
        """
        # First, find the release key for this process
        release = await self.get_process_by_name(process_name)
        if not release:
            return {
                "status": "error",
                "detail": f"Process '{process_name}' not found in Orchestrator",
            }

        release_key = release["Key"]

        # Build the job start payload
        job_payload = {
            "startInfo": {
                "ReleaseKey": release_key,
                "Strategy": "ModernJobsCount",
                "JobsCount": 1,
                "RuntimeType": "Unattended",
            }
        }

        # Add input arguments if provided
        if input_arguments:
            import json
            job_payload["startInfo"]["InputArguments"] = json.dumps(input_arguments)

        headers = await self._get_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.api_base}/Jobs/UiPath.Server.Configuration.OData.StartJobs",
                headers=headers,
                json=job_payload,
            )
            response.raise_for_status()
            return response.json()

    async def get_job_status(self, job_id: int) -> dict:
        """Get the status of a specific job by its ID."""
        headers = await self._get_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base}/Jobs({job_id})",
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    async def list_jobs(
        self,
        top: int = 20,
        filter_str: Optional[str] = None,
    ) -> dict:
        """
        List jobs from Orchestrator.

        Args:
            top: Number of jobs to return (default 20).
            filter_str: OData filter string (e.g. "State eq 'Running'").
        """
        headers = await self._get_headers()
        params = {
            "$top": top,
            "$orderby": "CreationTime desc",
        }
        if filter_str:
            params["$filter"] = filter_str

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base}/Jobs",
                headers=headers,
                params=params,
            )
            response.raise_for_status()
            return response.json()

    async def stop_job(self, job_id: int, strategy: str = "SoftStop") -> dict:
        """
        Stop a running job.

        Args:
            job_id: The ID of the job to stop.
            strategy: 'SoftStop' (graceful) or 'Kill' (immediate).
        """
        headers = await self._get_headers()
        payload = {
            "jobIds": [job_id],
            "strategy": strategy,
        }
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.api_base}/Jobs/UiPath.Server.Configuration.OData.StopJobs",
                headers=headers,
                json=payload,
            )
            response.raise_for_status()
            return {"status": "success", "message": f"Job {job_id} stop requested"}

    # ── Robots ────────────────────────────────────────────────

    async def list_robots(self) -> dict:
        """List available robots in the folder."""
        headers = await self._get_headers()
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.get(
                f"{self.api_base}/Robots",
                headers=headers,
            )
            response.raise_for_status()
            return response.json()

    # ── Health Check ──────────────────────────────────────────

    async def check_connection(self) -> dict:
        """Test the connection to UiPath Orchestrator."""
        try:
            token = await self._get_access_token()
            return {
                "status": "connected",
                "org": self.org_name,
                "tenant": self.tenant_name,
                "folder_id": self.folder_id,
                "token_preview": f"{token[:20]}...",
            }
        except httpx.HTTPStatusError as e:
            return {
                "status": "error",
                "detail": f"HTTP {e.response.status_code}: {e.response.text}",
            }
        except Exception as e:
            return {
                "status": "error",
                "detail": str(e),
            }


# ── Singleton instance ───────────────────────────────────────
uipath_service = UiPathService()
