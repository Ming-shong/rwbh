# -*- mode: python ; coding: utf-8 -*-
import os
from pathlib import Path

block_cipher = None

# 所有需要隨 exe 一起打包的資料夾/檔案
datas = [
    ('ui',          'ui'),
    ('data',        'data'),
    ('dev_editor',  'dev_editor'),
    ('battle',      'battle'),
    ('map_system',  'map_system'),
]
# 若有 templates / static 資料夾也加進去
for folder in ('templates', 'static', 'tools'):
    if Path(folder).exists():
        datas.append((folder, folder))

a = Analysis(
    ['main.py'],
    pathex=['.'],
    binaries=[],
    datas=datas,
    hiddenimports=[
        'flask',
        'flask_cors',
        'jinja2',
        'werkzeug',
        'requests',
        'folium',
        'engineio',
        'socketio',
    ],
    hookspath=[],
    hooksconfig={},
    runtime_hooks=[],
    excludes=[],
    win_no_prefer_redirects=False,
    win_private_assemblies=False,
    cipher=block_cipher,
    noarchive=False,
)

pyz = PYZ(a.pure, a.zipped_data, cipher=block_cipher)

exe = EXE(
    pyz,
    a.scripts,
    [],
    exclude_binaries=True,
    name='RWBH',
    debug=False,
    bootloader_ignore_signals=False,
    strip=False,
    upx=True,
    console=True,   # 保留視窗以便看錯誤訊息；改 False 則完全隱藏
    disable_windowed_traceback=False,
    argv_emulation=False,
    target_arch=None,
    codesign_identity=None,
    entitlements_file=None,
    icon=None,
)

coll = COLLECT(
    exe,
    a.binaries,
    a.zipfiles,
    a.datas,
    strip=False,
    upx=True,
    upx_exclude=[],
    name='RWBH',
)
