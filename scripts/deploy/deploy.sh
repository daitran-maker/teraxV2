#!/bin/bash
mkdir -p ~/crc_app
tar -xzvf ~/CRC_App_Docker_Ready.tar.gz -C ~/crc_app
cd ~/crc_app
echo 'Lee@122598' | sudo -S docker compose -f docker-compose.standalone.yml up -d --build
echo 'Lee@122598' | sudo -S docker exec crc_db_standalone psql -U crc_user -d crc_db -c "ALTER TABLE request ALTER COLUMN tier_1_update_date TYPE timestamp without time zone; ALTER TABLE request ALTER COLUMN tier_2_update_date TYPE timestamp without time zone; ALTER TABLE request ALTER COLUMN tier_3_update_date TYPE timestamp without time zone;"
