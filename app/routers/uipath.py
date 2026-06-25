"""
UiPath Router — REST API endpoints for UiPath Orchestrator integration.
=========================================================================
Endpoints:
  POST /api/uipath/trigger          → Start a UiPath process
  GET  /api/uipath/jobs             → List all jobs
  GET  /api/uipath/jobs/{job_id}    → Get job status
  POST /api/uipath/jobs/{job_id}/stop → Stop a running job
  GET  /api/uipath/processes        → List available processes
  GET  /api/uipath/robots           → List available robots
  GET  /api/uipath/health           → Test Orchestrator connection
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from app.services.uipath_service import uipath_service

router = APIRouter(prefix="/api/uipath", tags=["UiPath Automation"])


# ── Request/Response Models ──────────────────────────────────

class TriggerProcessRequest(BaseModel):
    """Request body to trigger a UiPath process."""
    process_name: str
    input_arguments: Optional[dict] = None


class StopJobRequest(BaseModel):
    """Request body to stop a running job."""
    strategy: str = "SoftStop"  # 'SoftStop' or 'Kill'


# ── Trigger a Process ────────────────────────────────────────

@router.post("/trigger")
async def trigger_process(request: TriggerProcessRequest):
    """
    Start a UiPath process by name.

    - **process_name**: The name of the published process in Orchestrator
      (e.g., 'NeurolearnAI_Automation')
    - **input_arguments**: Optional dict of input arguments to pass to the process
    """
    try:
        result = await uipath_service.start_job(
            process_name=request.process_name,
            input_arguments=request.input_arguments,
        )

        # Check if the service returned an error (process not found)
        if result.get("status") == "error":
            raise HTTPException(status_code=404, detail=result["detail"])

        # Extract job info from the response
        jobs = result.get("value", [])
        return {
            "status": "success",
            "message": f"Process '{request.process_name}' triggered successfully",
            "jobs": [
                {
                    "id": job.get("Id"),
                    "key": job.get("Key"),
                    "state": job.get("State"),
                    "creation_time": job.get("CreationTime"),
                }
                for job in jobs
            ],
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to trigger process: {str(e)}")


# ── List Jobs ────────────────────────────────────────────────

@router.get("/jobs")
async def list_jobs(top: int = 20, state: Optional[str] = None):
    """
    List jobs from UiPath Orchestrator.

    - **top**: Number of jobs to return (default 20)
    - **state**: Filter by state (e.g., 'Running', 'Successful', 'Faulted')
    """
    try:
        filter_str = f"State eq '{state}'" if state else None
        result = await uipath_service.list_jobs(top=top, filter_str=filter_str)

        jobs = result.get("value", [])
        return {
            "status": "success",
            "count": len(jobs),
            "jobs": [
                {
                    "id": job.get("Id"),
                    "key": job.get("Key"),
                    "state": job.get("State"),
                    "process_name": job.get("ReleaseName"),
                    "creation_time": job.get("CreationTime"),
                    "start_time": job.get("StartTime"),
                    "end_time": job.get("EndTime"),
                    "info": job.get("Info"),
                }
                for job in jobs
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list jobs: {str(e)}")


# ── Get Job Status ───────────────────────────────────────────

@router.get("/jobs/{job_id}")
async def get_job_status(job_id: int):
    """Get the status of a specific job by its ID."""
    try:
        job = await uipath_service.get_job_status(job_id)
        return {
            "status": "success",
            "job": {
                "id": job.get("Id"),
                "key": job.get("Key"),
                "state": job.get("State"),
                "process_name": job.get("ReleaseName"),
                "creation_time": job.get("CreationTime"),
                "start_time": job.get("StartTime"),
                "end_time": job.get("EndTime"),
                "info": job.get("Info"),
                "output_arguments": job.get("OutputArguments"),
            },
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get job status: {str(e)}")


# ── Stop a Job ───────────────────────────────────────────────

@router.post("/jobs/{job_id}/stop")
async def stop_job(job_id: int, request: StopJobRequest):
    """
    Stop a running job.

    - **strategy**: 'SoftStop' (graceful) or 'Kill' (immediate)
    """
    try:
        result = await uipath_service.stop_job(job_id, strategy=request.strategy)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to stop job: {str(e)}")


# ── List Processes ───────────────────────────────────────────

@router.get("/processes")
async def list_processes():
    """List all published processes (releases) available in the Orchestrator folder."""
    try:
        result = await uipath_service.list_processes()
        processes = result.get("value", [])
        return {
            "status": "success",
            "count": len(processes),
            "processes": [
                {
                    "id": proc.get("Id"),
                    "name": proc.get("Name"),
                    "key": proc.get("Key"),
                    "process_key": proc.get("ProcessKey"),
                    "description": proc.get("Description"),
                    "version": proc.get("ProcessVersion"),
                    "is_latest_version": proc.get("IsLatestVersion"),
                }
                for proc in processes
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list processes: {str(e)}")


# ── List Robots ──────────────────────────────────────────────

@router.get("/robots")
async def list_robots():
    """List all available robots in the Orchestrator folder."""
    try:
        result = await uipath_service.list_robots()
        robots = result.get("value", [])
        return {
            "status": "success",
            "count": len(robots),
            "robots": [
                {
                    "id": robot.get("Id"),
                    "name": robot.get("Name"),
                    "machine_name": robot.get("MachineName"),
                    "type": robot.get("Type"),
                    "status": robot.get("RobotEnvironments"),
                }
                for robot in robots
            ],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list robots: {str(e)}")


# ── Health Check ─────────────────────────────────────────────

@router.get("/status")
@router.get("/health")
async def uipath_health():
    """Test the connection to UiPath Orchestrator."""
    result = await uipath_service.check_connection()
    if result["status"] == "error":
        raise HTTPException(status_code=503, detail=result["detail"])
    return result
