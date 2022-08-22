#!/bin/bash
. /home/yacmine/.nvm/nvm.sh
SCRIPT_DIR=$( cd -- "$( dirname -- "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )
cd $SCRIPT_DIR
nvm use

help () {
   # Display Help
   echo "Script to run atomic agent"
   echo
   echo "Syntax: ./run.sh [-h|-d|-m|-t]"
   echo "options:"
   echo "-h     Print this help"
   echo "-d     Use default config template for config.toml, assets.json, markets.json"
   echo "-m     Run on mainnet (Use along with -d option)"
   echo "-t     Run on testnet (Use along with -d option)"
   echo
}

# Get the options
mainnet="true"
default_config="false"
for option in "$@"; do
    case $option in
        '-h')
            help
            exit;;
        '-m')
            mainnet="true"
            echo "mainnet option"
            shift
            ;;
        '-t')
            mainnet="false"
            echo "testnet option"
            shift
            ;;
        '-d')
            default_config="true"
            echo "default option"
            shift
            ;;
        *) # All other options
            help
            exit;;
    esac
done

if [ "$default_config" == "true" ]; then
    if [ "$mainnet" == "true" ]; then
        echo "Applying default mainnet config for atomic agent"
        cp config_mainnet.toml config.toml
        cp src/migrate/data/assets_mainnet.json src/migrate/data/assets.json
        cp src/migrate/data/markets_mainnet.json src/migrate/data/markets.json
        echo "Migrating data ..."
        npm run migrate
        echo "Migrate data completely"
    else
        echo "Applying default testnet config for atomic agent"
        cp config_testnet.toml config.toml
        cp src/migrate/data/assets_testnet.json src/migrate/data/assets.json
        cp src/migrate/data/markets_testnet.json src/migrate/data/markets.json
        echo "Migrating data ..."
        npm run migrate
        echo "Migrate data completely"
    fi
else
    echo "Use current config for atomic agent"
fi

while true; do
    sleep 5
    echo "Start atomic agent"
    DEBUG=liquality:agent* npm run worker >> output.log 2>&1
    ps -aux | grep "$SCRIPT_DIR/.*master.js" | awk '{print $2}' | xargs kill -9
    echo "Restart atomic agent !!!" >> output.log
done
