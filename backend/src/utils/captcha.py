"""
验证码模块 - 防爬虫注册
"""
import random
import string
import hashlib
import time
from io import BytesIO
from PIL import Image, ImageDraw, ImageFont
import base64
import secrets

# 存储验证码（生产环境应使用 Redis）
_captcha_store = {}

# 简单数学验证码字符集
_MATH_CHARS = string.digits
_TOKEN_SIZE = 32


class CaptchaGenerator:
    """验证码生成器"""
    
    @staticmethod
    def generate_math_captcha(length: int = 4) -> tuple[str, str, Image.Image]:
        """
        生成数学验证码
        返回: (问题字符串, 答案字符串, 图片)
        """
        # 生成两个数字和运算符
        num1 = random.randint(1, 9)
        num2 = random.randint(1, 9)
        operator = random.choice(['+', '-'])
        
        if operator == '+':
            answer = str(num1 + num2)
            question = f"{num1} + {num2} = ?"
        else:
            # 确保结果为正数
            if num1 < num2:
                num1, num2 = num2, num1
            answer = str(num1 - num2)
            question = f"{num1} - {num2} = ?"
        
        # 生成干扰数字
        digits = string.digits
        
        # 创建图片
        width, height = 120, 40
        image = Image.new('RGB', (width, height), color=(240, 244, 248))
        draw = ImageDraw.Draw(image)
        
        # 绘制干扰点
        for _ in range(30):
            x = random.randint(0, width)
            y = random.randint(0, height)
            color = (random.randint(180, 220), random.randint(180, 220), random.randint(180, 220))
            draw.point((x, y), fill=color)
        
        # 绘制干扰线
        for _ in range(3):
            x1 = random.randint(0, width)
            y1 = random.randint(0, height)
            x2 = random.randint(0, width)
            y2 = random.randint(0, height)
            color = (random.randint(180, 220), random.randint(180, 220), random.randint(180, 220))
            draw.line([(x1, y1), (x2, y2)], fill=color, width=1)
        
        # 绘制验证码文字
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 24)
        except:
            font = ImageFont.load_default()
        
        # 白色背景文字
        text_color = (random.randint(30, 80), random.randint(30, 80), random.randint(30, 80))
        # 阴影效果
        draw.text((22, 7), question[:-4], font=font, fill=(200, 200, 200))
        draw.text((20, 5), question[:-4], font=font, fill=text_color)
        
        return question, answer, image
    
    @staticmethod
    def generate_token_captcha(length: int = 4) -> tuple[str, str, Image.Image]:
        """
        生成字符验证码
        返回: (token, code, 图片)
        """
        code = ''.join(random.choices(string.ascii_uppercase + string.digits, k=length))
        
        width, height = 100, 40
        image = Image.new('RGB', (width, height), color=(255, 255, 255))
        draw = ImageDraw.Draw(image)
        
        # 干扰线
        for _ in range(4):
            x1 = random.randint(0, width)
            y1 = random.randint(0, height)
            x2 = random.randint(0, width)
            y2 = random.randint(0, height)
            color = (random.randint(150, 200), random.randint(150, 200), random.randint(150, 200))
            draw.line([(x1, y1), (x2, y2)], fill=color, width=2)
        
        # 字符
        try:
            font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", 26)
        except:
            font = ImageFont.load_default()
        
        # 每个字符稍微旋转
        for i, char in enumerate(code):
            x = 15 + i * 20
            y = random.randint(2, 8)
            color = (random.randint(0, 100), random.randint(0, 100), random.randint(150, 255))
            draw.text((x, y), char, font=font, fill=color)
        
        return code, code, image
    
    @staticmethod
    def image_to_base64(image: Image.Image) -> str:
        """将图片转为 base64 字符串"""
        buffer = BytesIO()
        image.save(buffer, format='PNG')
        img_bytes = buffer.getvalue()
        return base64.b64encode(img_bytes).decode()


def create_captcha(token: str = None) -> dict:
    """
    创建验证码
    返回: {token, question, image}
    """
    if token is None:
        token = secrets.token_urlsafe(_TOKEN_SIZE)
    
    question, answer, image = CaptchaGenerator.generate_math_captcha()
    
    # 存储验证码（带过期时间）
    _captcha_store[token] = {
        'answer': answer.lower(),
        'expires_at': time.time() + 300,  # 5分钟过期
        'used': False
    }
    
    return {
        'token': token,
        'question': question,
        'image': CaptchaGenerator.image_to_base64(image)
    }


def verify_captcha(token: str, user_answer: str) -> bool:
    """
    验证验证码
    """
    if not token or not user_answer:
        return False
    
    captcha = _captcha_store.get(token)
    if not captcha:
        return False
    
    # 检查是否过期
    if time.time() > captcha['expires_at']:
        del _captcha_store[token]
        return False
    
    # 检查是否已使用
    if captcha['used']:
        return False
    
    # 验证答案
    if user_answer.lower().strip() == captcha['answer']:
        captcha['used'] = True
        return True
    
    return False


def cleanup_expired_captchas():
    """清理过期验证码"""
    current_time = time.time()
    expired = [k for k, v in _captcha_store.items() if current_time > v['expires_at']]
    for k in expired:
        del _captcha_store[k]


# IP 注册限制
_ip_register_cache = {}


def check_ip_register_limit(ip: str, max_registers: int = 3, window_seconds: int = 3600) -> tuple[bool, int]:
    """
    检查 IP 注册频率限制
    返回: (是否允许, 剩余可注册数)
    """
    current_time = time.time()
    
    if ip not in _ip_register_cache:
        _ip_register_cache[ip] = []
    
    # 清理过期记录
    _ip_register_cache[ip] = [
        t for t in _ip_register_cache[ip]
        if current_time - t < window_seconds
    ]
    
    if len(_ip_register_cache[ip]) >= max_registers:
        return False, 0
    
    return True, max_registers - len(_ip_register_cache[ip])


def record_ip_register(ip: str, window_seconds: int = 3600):
    """记录 IP 注册"""
    if ip not in _ip_register_cache:
        _ip_register_cache[ip] = []
    
    _ip_register_cache[ip].append(time.time())


def get_ip_register_count(ip: str, window_seconds: int = 3600) -> int:
    """获取 IP 注册次数"""
    if ip not in _ip_register_cache:
        return 0
    
    current_time = time.time()
    recent = [
        t for t in _ip_register_cache[ip]
        if current_time - t < window_seconds
    ]
    return len(recent)


# 邮箱域名黑名单
DISPOSABLE_EMAIL_DOMAINS = {
    'tempmail.com', '10minutemail.com', 'guerrillamail.com',
    'mailinator.com', 'throwaway.email', 'fakeinbox.com',
    'temp-mail.org', 'getnada.com', 'yopmail.com', 'trashmail.com',
    'sharklasers.com', 'guerrillamailblock.com', 'pokemail.net',
    'spam4.me', 'grr.la', 'dispostable.com', 'mailnesia.com',
}


def is_disposable_email(email: str) -> bool:
    """检查是否为临时邮箱"""
    if '@' not in email:
        return True
    
    domain = email.lower().split('@')[1].split('.')[0]
    return domain in DISPOSABLE_EMAIL_DOMAINS


def is_suspicious_email(email: str) -> tuple[bool, str]:
    """
    检查可疑邮箱
    返回: (是否可疑, 原因)
    """
    if not email or '@' not in email:
        return True, "邮箱格式无效"
    
    # 检查临时邮箱
    if is_disposable_email(email):
        return True, "暂不支持该邮箱域名"
    
    # 检查邮箱长度
    local, domain = email.split('@', 1)
    if len(local) > 64:
        return True, "邮箱用户名过长"
    
    if len(domain) > 255:
        return True, "邮箱域名过长"
    
    # 检查可疑模式
    suspicious_patterns = [
        'test', 'fake', 'spam', 'trash', 'temp', ' disposable',
        '垃圾', '测试', '马甲', '小号'
    ]
    
    email_lower = email.lower()
    for pattern in suspicious_patterns:
        if pattern in email_lower:
            return True, f"检测到可疑模式: {pattern}"
    
    return False, ""


def generate_register_token() -> str:
    """生成注册令牌（用于验证链接）"""
    return secrets.token_urlsafe(32)


def hash_register_token(token: str) -> str:
    """哈希注册令牌（用于存储）"""
    return hashlib.sha256(token.encode()).hexdigest()
