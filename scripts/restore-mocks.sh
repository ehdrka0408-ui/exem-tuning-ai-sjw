#!/bin/bash
# Mock 데이터 복원 (시연용)
echo "Restoring mock data from mocks_backup..."
cp -f /home/exemone/exem_tuning_ai_v2/src/mocks_backup/*.ts /home/exemone/exem_tuning_ai_v2/src/mocks/
echo "Done. Mock data restored. Vite HMR will auto-reload."
