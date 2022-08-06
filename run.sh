#!/bin/bash
. ~/.nvm/nvm.sh
nvm use

help () {
   # Display Help
   echo "Script to run atomic agent"
   echo
   echo "Syntax: ./run.sh [-h|m|t]"
   echo "options:"
   echo "-h     Print this help."
   echo "-m     Run on mainnet."
   echo "-t     Run on testnet"
   echo
}

# Get the options
commands=""
for option in "$@"; do
    case $option in
        '-h')
            help
            exit;;
        '-m')
            echo "Applying mainnet config for atomic agent"
            cp config_mainnet.toml config.toml
            cp src/migrate/data/assets_mainnet.json src/migrate/data/assets.json
            cp src/migrate/data/markets_mainnet.json src/migrate/data/markets.json
            echo "Migrating data ..."
            npm run migrate
            echo "Migrate data completely"
            break
            ;;
        '-t')
            echo "Applying testnet config for atomic agent"
            cp config_testnet.toml config.toml
            cp src/migrate/data/assets_testnet.json src/migrate/data/assets.json
            cp src/migrate/data/markets_testnet.json src/migrate/data/markets.json
            echo "Migrating data ..."
            npm run migrate
            echo "Migrate data completely"
            break
            ;;
        *) # All other options
            help
            exit;;
    esac
done

while true; do
    sleep 5
    echo "Start atomic agent"
    DEBUG=liquality:agent* npm run worker >> output.log 2>&1
    echo "Restart atomic agent !!!" >> output.log
done
