#!/bin/bash
# Tech Blog 部署脚本

set -e

echo "=== Tech Blog 部署脚本 ==="

# 颜色输出
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}错误: Docker 未安装${NC}"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo -e "${RED}错误: Docker Compose 未安装${NC}"
    exit 1
fi

# 解析参数
COMMAND=${1:-start}

case $COMMAND in
    start)
        echo -e "${GREEN}启动服务...${NC}"
        
        # 创建必要目录
        mkdir -p data
        
        # 构建并启动
        docker-compose up -d --build
        
        echo -e "${GREEN}服务已启动!${NC}"
        echo "  - 后端 API: http://localhost:8787"
        echo "  - 前端: http://localhost:5173"
        ;;
        
    stop)
        echo -e "${YELLOW}停止服务...${NC}"
        docker-compose down
        echo -e "${GREEN}服务已停止${NC}"
        ;;
        
    restart)
        echo -e "${YELLOW}重启服务...${NC}"
        docker-compose down
        docker-compose up -d --build
        echo -e "${GREEN}服务已重启${NC}"
        ;;
        
    logs)
        echo -e "${YELLOW}查看日志...${NC}"
        docker-compose logs -f
        ;;
        
    status)
        echo -e "${YELLOW}服务状态:${NC}"
        docker-compose ps
        ;;
        
    clean)
        echo -e "${RED}清理所有数据...(不可恢复)${NC}"
        read -p "确定要继续吗? (yes/no): " confirm
        if [ "$confirm" = "yes" ]; then
            docker-compose down -v
            rm -rf data/*
            echo -e "${GREEN}清理完成${NC}"
        else
            echo "取消清理"
        fi
        ;;
        
    *)
        echo "用法: ./deploy.sh [start|stop|restart|logs|status|clean]"
        ;;
esac
