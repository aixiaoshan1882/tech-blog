#!/usr/bin/env python3
"""
数据库迁移 CLI

用法:
    python cli.py status     # 查看迁移状态
    python cli.py up         # 执行所有待应用迁移
    python cli.py down [N]   # 回滚 N 个迁移 (默认 1)
"""

import sys
import os

# 添加项目根目录到 path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from migrations import MigrationManager, Migration_001_InitialSchema, Migration_002_EnhancedFeatures


def main():
    from database import db
    
    manager = MigrationManager(db)
    
    # 注册所有迁移
    manager.register(Migration_001_InitialSchema())
    manager.register(Migration_002_EnhancedFeatures())
    
    if len(sys.argv) < 2:
        print(__doc__)
        return
    
    command = sys.argv[1].lower()
    
    if command == "status":
        status = manager.status()
        print(f"\n{'='*50}")
        print(f"迁移状态")
        print(f"{'='*50}")
        print(f"总迁移数:    {status['total']}")
        print(f"已应用:      {status['applied']}")
        print(f"待应用:      {status['pending']}")
        print(f"当前版本:    {status['current_version']}")
        print(f"{'='*50}\n")
        
    elif command == "up":
        print("\n开始执行迁移...")
        applied = manager.up()
        if applied:
            print(f"\n✓ 成功应用 {len(applied)} 个迁移")
        else:
            print("\n✓ 没有待应用的迁移")
            
    elif command == "down":
        steps = int(sys.argv[2]) if len(sys.argv) > 2 else 1
        print(f"\n开始回滚 {steps} 个迁移...")
        rolled = manager.down(steps)
        if rolled:
            print(f"\n✓ 成功回滚 {len(rolled)} 个迁移")
        else:
            print("\n✗ 没有可回滚的迁移")
            
    else:
        print(f"未知命令: {command}")
        print(__doc__)


if __name__ == "__main__":
    main()
