#!/bin/sh
# BGPalerter entrypoint wrapper
# Automatically handles the interactive prompt by answering 'no'

# Start bgpalerter in background
echo "n" | npm run serve
