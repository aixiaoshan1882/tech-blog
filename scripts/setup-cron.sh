#!/bin/bash
# Tech Blog 定时任务设置脚本
# 用法: ./scripts/setup-cron.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# 备份命令
BACKUP_CMD="cd ${PROJECT_DIR} && ./scripts/backup.sh 7"

# 添加定时任务
# 每天凌晨 2点 执行备份
CRON_JOB="0 2 * * * ${BACKUP_CMD}"

echo "=== Tech Blog 定时任务设置 ==="
echo ""
echo "将添加以下定时任务:"
echo "  $CRON_JOB"
echo ""
echo "备份频率: 每天凌晨 2:00"
echo "保留时间: 7 天"
echo ""

# 检查是否已有该任务
if crontab -l 2>/dev/null | grep -q "tech-blog.*backup"; then
    echo "警告: 已存在 Tech Blog 备份任务"
    read -p "是否替换? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo "取消操作"
        exit 0
    fi
    # 移除旧任务
    crontab -l 2>/dev/null | grep -v "tech-blog.*backup" | crontab -
fi

# 添加新任务
echo "$CRON_JOB" | crontab -

echo -e "\033[0;32m定时任务已添加!\033[0m"
echo ""
echo "当前定时任务列表:"
crontab -l 2>/dev/null || echo "无"
