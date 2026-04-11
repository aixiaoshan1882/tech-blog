"""安全工具"""
import re
import html


def escape_html(text: str) -> str:
    """转义 HTML 特殊字符，防止 XSS"""
    return html.escape(text, quote=True)


def sanitize_html(text: str) -> str:
    """清理用户输入中的危险 HTML/JS"""
    if not text:
        return text
    
    # 转义所有 HTML 特殊字符
    text = escape_html(text)
    
    # 移除可能的协议伪协议
    text = re.sub(r'javascript:', '', text, flags=re.IGNORECASE)
    text = re.sub(r'data:', '', text, flags=re.IGNORECASE)
    text = re.sub(r'vbscript:', '', text, flags=re.IGNORECASE)
    
    return text


def validate_slug(slug: str) -> bool:
    """验证 slug 格式"""
    # 只允许字母、数字、中文和连字符
    pattern = r'^[a-zA-Z0-9\u4e00-\u9fa5\-]+$'
    return bool(re.match(pattern, slug)) and len(slug) <= 100


def validate_email(email: str) -> bool:
    """验证邮箱格式"""
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def validate_password(password: str) -> tuple[bool, str]:
    """验证密码强度"""
    if len(password) < 6:
        return False, "密码至少需要 6 个字符"
    if len(password) > 128:
        return False, "密码太长"
    return True, ""
