#!/bin/bash
echo 'Lee@122598' | sudo -S docker exec crc_db_standalone psql -U crc_user -d crc_db -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'request' AND column_name LIKE 'tier%';"
