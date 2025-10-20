"""
BGPalerter Management API
Dynamically manage BGPalerter ASN monitoring configuration
"""

import asyncio
import logging
import subprocess
import yaml
from pathlib import Path
from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel

logger = logging.getLogger(__name__)

router = APIRouter()

# Configuration paths
BGPALERTER_DIR = Path("/opt/bgpalerter")
PREFIXES_FILE = BGPALERTER_DIR / "prefixes.yml"
CONFIG_FILE = BGPALERTER_DIR / "config.yml"
BGPALERTER_BINARY = BGPALERTER_DIR / "bgpalerter-linux-x64"


class ASNMonitorRequest(BaseModel):
    asn: int
    description: Optional[str] = None


class ASNMonitorResponse(BaseModel):
    asn: int
    status: str
    prefixes_count: int
    message: str


class MonitoredASNInfo(BaseModel):
    asn: int
    prefixes: List[str]
    upstreams: List[int]
    downstreams: List[int]


async def run_bgpalerter_generate(asn: int) -> tuple[bool, str, Dict]:
    """
    Run BGPalerter generate command for a specific ASN
    Returns: (success, output, parsed_data)
    """
    try:
        # Generate prefixes for the ASN to a temporary file
        temp_file = BGPALERTER_DIR / f"prefixes-{asn}.yml.tmp"
        
        cmd = [
            str(BGPALERTER_BINARY),
            "generate",
            "-a", str(asn),
            "-o", str(temp_file),
            "-m"
        ]
        
        logger.info(f"Generating BGPalerter config for AS{asn}")
        
        process = await asyncio.create_subprocess_exec(
            *cmd,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            cwd=str(BGPALERTER_DIR)
        )
        
        stdout, stderr = await process.communicate()
        output = stdout.decode() + stderr.decode()
        
        if process.returncode != 0:
            logger.error(f"BGPalerter generate failed: {output}")
            return False, output, {}
        
        # Parse the generated file
        if temp_file.exists():
            with open(temp_file, 'r') as f:
                data = yaml.safe_load(f)
            temp_file.unlink()  # Clean up temp file
            return True, output, data
        else:
            return False, "Generated file not found", {}
            
    except Exception as e:
        logger.error(f"Error generating BGPalerter config: {e}")
        return False, str(e), {}


def merge_prefixes_config(existing_data: Dict, new_data: Dict) -> Dict:
    """
    Merge new ASN prefixes into existing configuration
    """
    merged = existing_data.copy()
    
    # Merge prefix entries (top-level prefix definitions)
    for prefix, config in new_data.items():
        if prefix != "options":
            merged[prefix] = config
    
    # Merge options.monitorASns
    if "options" not in merged:
        merged["options"] = {"monitorASns": {}}
    
    if "options" in new_data and "monitorASns" in new_data["options"]:
        if "monitorASns" not in merged["options"]:
            merged["options"]["monitorASns"] = {}
        
        merged["options"]["monitorASns"].update(new_data["options"]["monitorASns"])
    
    return merged


async def reload_bgpalerter():
    """
    Reload BGPalerter to pick up configuration changes
    Options:
    1. Send SIGHUP to the process (if supported)
    2. Restart the systemd service
    3. Restart the container
    """
    try:
        # Try systemd restart first
        process = await asyncio.create_subprocess_exec(
            "systemctl", "restart", "bgpalerter",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        
        if process.returncode == 0:
            logger.info("BGPalerter service restarted successfully")
            return True
    except Exception as e:
        logger.warning(f"Could not restart via systemd: {e}")
    
    try:
        # Try podman/docker restart
        process = await asyncio.create_subprocess_exec(
            "podman", "restart", "irrexplorer-bgpalerter",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        await process.communicate()
        
        if process.returncode == 0:
            logger.info("BGPalerter container restarted successfully")
            return True
    except Exception as e:
        logger.warning(f"Could not restart container: {e}")
    
    return False


@router.post("/bgpalerter/asn/{asn}/monitor", response_model=ASNMonitorResponse)
async def add_asn_monitoring(asn: int, background_tasks: BackgroundTasks):
    """
    Add a new ASN to BGPalerter monitoring
    This will:
    1. Generate prefixes for the ASN using BGPalerter
    2. Merge into existing prefixes.yml
    3. Reload BGPalerter to apply changes
    """
    try:
        # Validate ASN
        if asn < 1 or asn > 4294967295:
            raise HTTPException(status_code=400, detail="Invalid ASN number")
        
        # Check if BGPalerter is available
        if not BGPALERTER_BINARY.exists():
            raise HTTPException(
                status_code=503, 
                detail="BGPalerter binary not found. Please install BGPalerter first."
            )
        
        # Generate configuration for the ASN
        success, output, new_data = await run_bgpalerter_generate(asn)
        
        if not success:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate BGPalerter configuration: {output}"
            )
        
        # Load existing prefixes.yml
        existing_data = {}
        if PREFIXES_FILE.exists():
            with open(PREFIXES_FILE, 'r') as f:
                existing_data = yaml.safe_load(f) or {}
        
        # Merge configurations
        merged_data = merge_prefixes_config(existing_data, new_data)
        
        # Backup existing file
        if PREFIXES_FILE.exists():
            backup_file = BGPALERTER_DIR / "prefixes.yml.backup"
            PREFIXES_FILE.rename(backup_file)
        
        # Write merged configuration
        with open(PREFIXES_FILE, 'w') as f:
            yaml.dump(merged_data, f, default_flow_style=False, sort_keys=False)
        
        # Count prefixes for this ASN
        prefix_count = sum(1 for k, v in merged_data.items() 
                          if k != "options" and asn in (v.get("asn", []) if isinstance(v.get("asn"), list) else [v.get("asn")]))
        
        # Schedule BGPalerter reload in background
        background_tasks.add_task(reload_bgpalerter)
        
        logger.info(f"Successfully added AS{asn} to BGPalerter monitoring ({prefix_count} prefixes)")
        
        return ASNMonitorResponse(
            asn=asn,
            status="success",
            prefixes_count=prefix_count,
            message=f"AS{asn} added to monitoring with {prefix_count} prefixes. BGPalerter is reloading."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding ASN {asn} to monitoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/bgpalerter/asn/{asn}/monitor")
async def remove_asn_monitoring(asn: int, background_tasks: BackgroundTasks):
    """
    Remove an ASN from BGPalerter monitoring
    """
    try:
        if not PREFIXES_FILE.exists():
            raise HTTPException(status_code=404, detail="Prefixes configuration not found")
        
        # Load existing configuration
        with open(PREFIXES_FILE, 'r') as f:
            data = yaml.safe_load(f) or {}
        
        # Remove prefixes associated with this ASN
        prefixes_to_remove = []
        for prefix, config in data.items():
            if prefix != "options":
                asn_list = config.get("asn", [])
                if isinstance(asn_list, list) and asn in asn_list:
                    prefixes_to_remove.append(prefix)
                elif asn_list == asn:
                    prefixes_to_remove.append(prefix)
        
        for prefix in prefixes_to_remove:
            del data[prefix]
        
        # Remove from monitorASns
        if "options" in data and "monitorASns" in data["options"]:
            if str(asn) in data["options"]["monitorASns"]:
                del data["options"]["monitorASns"][str(asn)]
        
        # Write updated configuration
        backup_file = BGPALERTER_DIR / "prefixes.yml.backup"
        PREFIXES_FILE.rename(backup_file)
        
        with open(PREFIXES_FILE, 'w') as f:
            yaml.dump(data, f, default_flow_style=False, sort_keys=False)
        
        # Schedule BGPalerter reload
        background_tasks.add_task(reload_bgpalerter)
        
        logger.info(f"Removed AS{asn} from BGPalerter monitoring ({len(prefixes_to_remove)} prefixes)")
        
        return {
            "asn": asn,
            "status": "success",
            "prefixes_removed": len(prefixes_to_remove),
            "message": f"AS{asn} removed from monitoring. BGPalerter is reloading."
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error removing ASN {asn}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bgpalerter/monitored-asns", response_model=List[MonitoredASNInfo])
async def get_monitored_asns():
    """
    Get list of all monitored ASNs with their prefixes
    """
    try:
        if not PREFIXES_FILE.exists():
            return []
        
        with open(PREFIXES_FILE, 'r') as f:
            data = yaml.safe_load(f) or {}
        
        asn_info = {}
        
        # Parse monitored ASNs from options
        if "options" in data and "monitorASns" in data["options"]:
            for asn_str, config in data["options"]["monitorASns"].items():
                asn = int(asn_str)
                asn_info[asn] = {
                    "asn": asn,
                    "prefixes": [],
                    "upstreams": config.get("upstreams", []) or [],
                    "downstreams": config.get("downstreams", []) or []
                }
        
        # Collect prefixes for each ASN
        for prefix, config in data.items():
            if prefix != "options":
                asn_list = config.get("asn", [])
                if not isinstance(asn_list, list):
                    asn_list = [asn_list]
                
                for asn in asn_list:
                    if asn in asn_info:
                        asn_info[asn]["prefixes"].append(prefix)
        
        return list(asn_info.values())
        
    except Exception as e:
        logger.error(f"Error getting monitored ASNs: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/bgpalerter/status")
async def get_bgpalerter_status():
    """
    Get BGPalerter service status
    """
    try:
        # Try checking systemd status
        process = await asyncio.create_subprocess_exec(
            "systemctl", "is-active", "bgpalerter",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, _ = await process.communicate()
        status = stdout.decode().strip()
        
        if status == "active":
            return {
                "status": "running",
                "service": "systemd",
                "message": "BGPalerter is running"
            }
        else:
            return {
                "status": "stopped",
                "service": "systemd",
                "message": f"BGPalerter status: {status}"
            }
            
    except Exception as e:
        # Try checking container status
        try:
            process = await asyncio.create_subprocess_exec(
                "podman", "inspect", "--format", "{{.State.Status}}", "irrexplorer-bgpalerter",
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE
            )
            stdout, _ = await process.communicate()
            
            if process.returncode == 0:
                status = stdout.decode().strip()
                return {
                    "status": "running" if status == "running" else "stopped",
                    "service": "container",
                    "message": f"Container status: {status}"
                }
        except Exception:
            pass
        
        return {
            "status": "unknown",
            "service": "none",
            "message": "Could not determine BGPalerter status"
        }
