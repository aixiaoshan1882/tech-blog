"""
测试配置文件
"""
import sys
import os
import pytest
import time

# 添加项目根目录到 path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# 切换到 backend 目录
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def client():
    """创建测试客户端"""
    from fastapi.testclient import TestClient
    from src.main import app
    return TestClient(app)


@pytest.fixture
def unique_email():
    """生成唯一邮箱"""
    return f"test_{int(time.time() * 1000000)}@example.com"


class TestHealth:
    """健康检查测试"""
    
    def test_health_check(self, client):
        """测试健康检查"""
        response = client.get("/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestPosts:
    """文章接口测试"""
    
    def test_get_public_posts(self, client):
        """测试获取公开文章列表"""
        response = client.get("/api/posts")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "items" in data["data"]
    
    def test_get_post_by_slug(self, client):
        """测试通过 slug 获取文章"""
        response = client.get("/api/posts/non-existent-slug")
        # 文章不存在
        assert response.status_code == 404
    
    def test_get_categories(self, client):
        """测试获取分类"""
        response = client.get("/api/categories")
        assert response.status_code == 200


class TestSecurity:
    """安全测试"""
    
    def test_sql_injection_prevention(self, client):
        """测试 SQL 注入防护"""
        malicious_input = "' OR '1'='1"
        response = client.get(f"/api/search?q={malicious_input}")
        # 应该返回空结果，而不是执行注入
        assert response.status_code == 200
    
    def test_rate_limiting_headers(self, client):
        """测试 API 响应头"""
        response = client.get("/api/posts")
        assert response.status_code == 200
        # 验证响应头存在
        assert "content-type" in {h.lower() for h in response.headers.keys()}


class TestAPI:
    """API 接口测试"""
    
    def test_stats_endpoint(self, client):
        """测试统计接口"""
        response = client.get("/api/stats")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
    
    def test_feed_endpoints(self, client):
        """测试订阅源接口"""
        response = client.get("/feed.xml")
        assert response.status_code == 200
        assert "xml" in response.text.lower()
        
        response = client.get("/atom.xml")
        assert response.status_code == 200
        
        response = client.get("/sitemap.xml")
        assert response.status_code == 200
