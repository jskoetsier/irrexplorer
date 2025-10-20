# BGPalerter Configuration Issue

## Problem
BGPalerter 2.0.1 has a known issue when running in containerized environments. It prompts for interactive configuration when it cannot validate the prefixes.yml file against the live RIS BGP feed at startup.

## Root Cause
When BGPalerter starts, it:
1. Loads config.yml
2. Attempts to load and validate prefixes.yml
3. If validation fails (e.g., prefixes not yet visible in BGP feed), it prompts for interactive auto-configuration
4. In a container without stdin, this causes the container to hang indefinitely

## Current Status
- Configuration files are correctly formatted (config.yml and prefixes.yml)
- The container mounts are working correctly
- ruff and isort checks have passed
- Code has been pushed to git

## Workaround Options

### Option 1: Use a Well-Known Prefix (Current Configuration)
The prefixes.yml currently includes Cloudflare's 1.1.1.0/24 which should be visible in the BGP feed. However, BGPalerter may still require time to connect to the RIS feed before validation succeeds.

### Option 2: Allow Interactive Configuration
To allow BGPalerter to auto-configure:
1. Stop the container: `podman stop irrexplorer-bgpalerter`
2. Run interactively: 
   ```bash
   podman run -it --rm \
     -v ./bgpalerter/config.yml:/opt/bgpalerter/config.yml:ro \
     -v ./bgpalerter:/mnt/output \
     docker.io/nttgin/bgpalerter:latest run serve
   ```
3. Answer the prompts to generate a new prefixes.yml
4. Copy the generated file to ./bgpalerter/prefixes.yml
5. Restart the container normally

### Option 3: Disable BGPalerter Temporarily
If BGPalerter is not immediately required:
1. Comment out the bgpalerter service in docker-compose.yml
2. The rest of the irrexplorer stack will function normally
3. Re-enable when BGPalerter configuration is resolved

## Files Modified
- `/opt/irrexplorer/bgpalerter/config.yml` - Added processMonitors: false and checkForUpdatesAtBoot: false
- `/opt/irrexplorer/bgpalerter/prefixes.yml` - Reformatted to match BGPalerter 2.0.1 example format
- `/opt/irrexplorer/docker-compose.yml` - Added stdin_open: false, tty: false, and BGPALERTER_SKIP_PROMPT env

## Next Steps
1. Consider downgrading to BGPalerter 1.x which may not have this interactive prompt issue
2. Or wait for BGPalerter 2.x to add a non-interactive mode flag
3. Or reach out to BGPalerter project to report this containerization issue

## Monitoring AS8315
Once BGPalerter starts successfully, it will monitor:
- AS8315 (primary target)
- AS13335 (Cloudflare - used for validation)

The monitored prefixes can be updated in prefixes.yml once the service is running.
