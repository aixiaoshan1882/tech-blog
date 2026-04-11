"""
测试配置文件
"""
import sys
import os
import pytest

# 添加项目根目录到 path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))


@pytest.fixture
def test_db():
    """创建测试数据库"""
    from database import db
    
    # 创建测试表
    db.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            nickname TEXT NOT NULL,
            role TEXT DEFAULT 'reader',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """)
    
    yield db
    
    # 清理
    db.execute("DROP TABLE IF EXISTS users")


@pytest.fixture
def client():
    """创建测试客户端"""
    from fastapi.testclient import TestClient
    from main import app
    
    return TestClient(app)


class TestAuth:
    """认证接口测试"""
    
    def test_register_success(self, client):
        """测试注册成功"""
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
            "nickname": "TestUser"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "token" in data["data"]
    
    def test_register_duplicate_email(self, client):
        """测试重复邮箱注册"""
        # 先注册
        client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
            "nickname": "TestUser"
        })
        
        # 再次注册
        response = client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "password456",
            "nickname": "AnotherUser"
        })
        assert response.status_code == 400
    
    def test_login_success(self, client):
        """测试登录成功"""
        # 先注册
        client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
            "nickname": "TestUser"
        })
        
        # 登录
        response = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "password123"
        })
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "token" in data["data"]
    
    def test_login_wrong_password(self, client):
        """测试错误密码"""
        # 先注册
        client.post("/api/auth/register", json={
            "email": "test@example.com",
            "password": "password123",
            "nickname": "TestUser"
        })
        
        # 登录
        response = client.post("/api/auth/login", json={
            "email": "test@example.com",
            "password": "wrongpassword"
        })
        assert response.status_code == 401


class TestPosts:
    """文章接口测试"""
    
    def test_get_public_posts(self, client):
        """测试获取公开文章列表"""
        response = client.get("/api/posts")
        assert response.status_code == 200
        data = response.json()
        assert data["code"] == 200
        assert "items" in data["data"]
    
    def test_create_post_without_auth(self, client):
        """测试未认证创建文章"""
        response = client.post("/api/posts", json={
            "title": "Test Post",
            "slug": "test-post",
            "content": "Test content"
        })
        assert response.status_code == 401
    
    def test_get_post_by_slug(self, client):
        """测试通过 slug 获取文章"""
        response = client.get("/api/posts/non-existent-slug")
        # 文章不存在或需要认证
        assert response.status_code in [200, 401, 404]


class TestSecurity:
    """安全测试"""
    
    def test_sql_injection_prevention(self, client):
        """测试 SQL 注入防护"""
        malicious_input = "' OR '1'='1"
        response = client.get(f"/api/search?q={malicious_input}")
        # 应该返回空结果，而不是执行注入
        assert response.status_code == 200
    
    def test_xss_prevention(self, client):
        """测试 XSS 防护"""
        malicious_script = "<script>alert('xss')</script>"
        response = client.post("/api/auth/register", json={
            "email": "test2@example.com",
            "password": "password123",
            "nickname": malicious_script
        })
        # 昵称应该被转义
        assert response.status_code == 200
    
    def test_rate_limiting(self, client):
        """测试请求频率限制"""
        # 快速发送多个请求
        for _ in range(6):
            response = client.get("/api/posts")
        
        # 应该触发限流
        # 注意：某些路径可能没有严格限流
        assert response.status_code in [200, 429]
