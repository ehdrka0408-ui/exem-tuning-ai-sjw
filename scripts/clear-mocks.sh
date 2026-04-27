#!/bin/bash
# Mock 데이터 비우기 (실제 운영용)
echo "Clearing mock data..."
cd /home/exemone/exem_tuning_ai_v2
python3 scripts/clear_mock_data.py
echo "Done. Mock data cleared. Vite HMR will auto-reload."
