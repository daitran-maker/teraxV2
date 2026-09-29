$action = New-ScheduledTaskAction -Execute "C:\Users\A Luis\OneDrive\Máy tính\ggantigravity\CRC_app\backup_crc.bat"
$trigger = New-ScheduledTaskTrigger -Daily -At 1:00AM
Register-ScheduledTask -Action $action -Trigger $trigger -TaskName "CRC_App_Auto_Backup" -Description "Daily PostgreSQL backup for CRC App" -Force
