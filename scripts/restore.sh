#!/bin/bash
# Tech Blog 数据库恢复脚本
# 用法: ./scripts/restore.sh [backup_file]

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
DB_PATH="${PROJECT_DIR}/backend/tech-blog.db"
DATE=$(date +%Y%m%d_%H%M%S)

# 颜色
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

BACKUP_FILE=${1:-""}

echo -e "${YELLOW}=== Tech Blog 数据库恢复 ===${NC}"

# 如果没有指定备份文件，列出可用备份
if [ -z "$BACKUP_FILE" ]; then
    echo "可用备份列表:"
    ls -lh "$BACKUP_DIR"/tech-blog-*.sql.gz 2>/dev/null || {
        echo -e "${RED}没有找到备份文件${NC}"
        exit 1
    }
    echo ""
    read -p "请输入要恢复的备份文件名: " BACKUP_FILE
fi

# 检查备份文件
if [ ! -f "${BACKUP_DIR}/${BACKUP_FILE}" ]; then
    echo -e "${RED}错误: 备份文件不存在: ${BACKUP_DIR}/${BACKUP_FILE}${NC}"
    exit 1
fi

# 确认操作
echo -e "${YELLOW}警告: 此操作将覆盖当前数据库!${NC}"
read -p "确定要继续吗? (yes/no): " confirm

if [ "$confirm" != "yes" ]; then
    echo "取消恢复操作"
    exit 0
fi

# 创建当前数据库的备份
echo "正在备份当前数据库..."
mkdir -p "${BACKUP_DIR}/pre-restore"
cp "$DB_PATH" "${BACKUP_DIR}/pre-restore/tech-blog-pre-restore-${DATE}.db"
echo -e "${GREEN}当前数据库已备份到: ${BACKUP_DIR}/pre-restore/tech-blog-pre-restore-${DATE}.db${NC}"

# 解压并恢复
echo "正在恢复数据库..."
gunzip -c "${BACKUP_DIR}/${BACKUP_FILE}" > "/tmp/tech-blog-restore-${DATE}.db"
sqlite3 "/tmp/tech-blog-restore-${DATE}.db" ".backup" "$DB_PATH"
rm -f "/tmp/tech-blog-restore-${DATE}.db"

echo -e "${GREEN}数据库恢复成功!${NC}"
echo ""
echo "恢复的备份: $BACKUP_FILE"
