#!/bin/bash
# Tech Blog 数据库备份脚本
# 用法: ./scripts/backup.sh [keep_days]
# keep_days: 保留备份天数 (默认 7)

set -e

# 配置
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"
DB_PATH="${PROJECT_DIR}/backend/tech-blog.db"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/tech-blog-${DATE}.sql.gz"
KEEP_DAYS=${1:-7}

# 颜色
GREEN='\033[0;32m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}=== Tech Blog 数据库备份 ===${NC}"

# 创建备份目录
mkdir -p "$BACKUP_DIR"

# 检查数据库文件
if [ ! -f "$DB_PATH" ]; then
    echo -e "${RED}错误: 数据库文件不存在: $DB_PATH${NC}"
    exit 1
fi

# 执行备份
echo "正在备份数据库到: $BACKUP_FILE"

# SQLite 备份
sqlite3 "$DB_PATH" ".backup" "/tmp/tech-blog-${DATE}.db"
gzip -c "/tmp/tech-blog-${DATE}.db" > "$BACKUP_FILE"
rm -f "/tmp/tech-blog-${DATE}.db"

# 验证备份
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo -e "${GREEN}备份成功!${NC} 大小: $SIZE"
else
    echo -e "${RED}备份失败!${NC}"
    exit 1
fi

# 清理旧备份
echo "清理 ${KEEP_DAYS} 天前的备份..."
find "$BACKUP_DIR" -name "tech-blog-*.sql.gz" -mtime +${KEEP_DAYS} -delete

# 列出当前备份
echo ""
echo "当前备份列表:"
ls -lh "$BACKUP_DIR" | grep "tech-blog-" || echo "无备份文件"

# 输出备份文件列表供恢复使用
echo ""
echo "最新备份: $(ls -t "$BACKUP_DIR"/tech-blog-*.sql.gz 2>/dev/null | head -1)"
