#!/bin/bash
. ~/.nvm/nvm.sh
nvm use
while true; do
    sleep 5
    DEBUG=liquality:agent* npm run worker >> output.log 2>&1
    echo "Restart atomic agent !!!" >> output.log
done
