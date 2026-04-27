"""Mock 데이터 배열을 비우되, 타입/함수/인터페이스는 유지"""
import os, re

MOCKS_DIR = os.path.join(os.path.dirname(__file__), '..', 'src', 'mocks')

# 각 파일별로 비울 export 변수 정의
CLEAR_RULES = {
    'candidates.ts': {
        'arrays': ['candidates', 'awrSnapshots'],
    },
    'workItems.ts': {
        'arrays': ['workItems'],
    },
    'v2WorkItems.ts': {
        'arrays': ['v2WorkItems'],
    },
    'dashboard.ts': {
        'arrays': ['weeklyTrend', 'recentActivities', 'topImprovedSql'],
    },
    'v2Dashboard.ts': {
        'arrays': ['v2WeeklyTrend', 'v2RecentActivities', 'v2TopImprovedSql', 'v2Notifications'],
    },
    'recommendations.ts': {
        'objects': ['workRecommendations'],
    },
    'executionValidation.ts': {
        'objects': ['executionValidations', 'workBinds', 'workBindSets'],
    },
    'actionItems.ts': {
        'objects': ['workActionItems'],
    },
    'anomalyData.ts': {
        'arrays': ['anomalyPoints'],
    },
    'planChanges.ts': {
        'arrays': ['planChangeItems'],
    },
    'planHistory.ts': {
        'arrays': ['planHistoryItems'],
    },
    'sqlTuningHistory.ts': {
        'objects': ['sqlTuningHistory'],
    },
    'workHistory.ts': {
        'objects': ['workHistory'],
    },
    'explainPlan.ts': {
        'arrays': ['mockExplainPlans'],
    },
    'trendData.ts': {
        'arrays': ['trendData'],
    },
}

def clear_array(content, var_name):
    """export const varName: Type[] = [...] → export const varName: Type[] = []"""
    # Pattern: export const NAME followed by type annotation and = [
    pattern = rf'(export\s+const\s+{re.escape(var_name)}\s*(?::\s*[^=]+?)?\s*=\s*)\[[\s\S]*?\n\]'
    replacement = rf'\1[]'
    result = re.sub(pattern, replacement, content)
    if result != content:
        print(f'    cleared array: {var_name}')
    return result

def clear_object(content, var_name):
    """export const varName: Type = {...} → export const varName: Type = {}"""
    pattern = rf'(export\s+const\s+{re.escape(var_name)}\s*(?::\s*[^=]+?)?\s*=\s*)\{{[\s\S]*?\n\}}'
    replacement = rf'\1{{}}'
    result = re.sub(pattern, replacement, content)
    if result != content:
        print(f'    cleared object: {var_name}')
    return result

for filename, rules in CLEAR_RULES.items():
    filepath = os.path.join(MOCKS_DIR, filename)
    if not os.path.exists(filepath):
        print(f'  SKIP (not found): {filename}')
        continue
    
    print(f'  Processing: {filename}')
    with open(filepath, 'r') as f:
        content = f.read()
    
    original = content
    for arr in rules.get('arrays', []):
        content = clear_array(content, arr)
    for obj in rules.get('objects', []):
        content = clear_object(content, obj)
    
    if content != original:
        with open(filepath, 'w') as f:
            f.write(content)
    else:
        print(f'    (no changes)')

print('\nDone.')
