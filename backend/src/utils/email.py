"""
邮件发送服务
"""
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class EmailService:
    """邮件发送服务"""
    
    def __init__(self):
        self.smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
        self.smtp_port = int(os.getenv("SMTP_PORT", "587"))
        self.smtp_user = os.getenv("SMTP_USER")
        self.smtp_password = os.getenv("SMTP_PASSWORD")
        self.from_email = os.getenv("SMTP_FROM", self.smtp_user)
        self.from_name = os.getenv("SMTP_FROM_NAME", "技术博客")
        self.enabled = bool(self.smtp_user and self.smtp_password)
    
    def send(
        self,
        to_email: str,
        subject: str,
        html_content: str,
        text_content: str = None
    ) -> bool:
        """发送邮件"""
        if not self.enabled:
            logger.warning("Email service is disabled - SMTP credentials not configured")
            return False
        
        try:
            # 创建邮件
            msg = MIMEMultipart("alternative")
            msg["Subject"] = subject
            msg["From"] = f"{self.from_name} <{self.from_email}>"
            msg["To"] = to_email
            
            # 添加纯文本版本
            if text_content:
                msg.attach(MIMEText(text_content, "plain"))
            
            # 添加 HTML 版本
            msg.attach(MIMEText(html_content, "html"))
            
            # 发送邮件
            with smtplib.SMTP(self.smtp_host, self.smtp_port) as server:
                server.starttls()
                server.login(self.smtp_user, self.smtp_password)
                server.sendmail(self.from_email, [to_email], msg.as_string())
            
            logger.info(f"Email sent to {to_email}: {subject}")
            return True
            
        except Exception as e:
            logger.error(f"Failed to send email to {to_email}: {e}")
            return False
    
    def send_comment_notification(self, to_email: str, post_title: str, commenter: str, comment: str) -> bool:
        """发送评论通知"""
        subject = f"🔥 您在《{post_title}》的帖子有新评论"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">{post_title}</h2>
            <p style="color: #666;">
                <strong>{commenter}</strong> 在您的文章下发表了评论：
            </p>
            <blockquote style="background: #f5f5f5; padding: 15px; border-left: 4px solid #007bff; margin: 20px 0;">
                {comment}
            </blockquote>
            <a href="#" style="display: inline-block; background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                查看评论
            </a>
        </div>
        """
        return self.send(to_email, subject, html)
    
    def send_reply_notification(self, to_email: str, post_title: str, replier: str, reply: str) -> bool:
        """发送回复通知"""
        subject = f"💬 {replier} 回复了您在《{post_title}》的评论"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">{post_title}</h2>
            <p style="color: #666;">
                <strong>{replier}</strong> 回复了您的评论：
            </p>
            <blockquote style="background: #f5f5f5; padding: 15px; border-left: 4px solid #28a745; margin: 20px 0;">
                {reply}
            </blockquote>
            <a href="#" style="display: inline-block; background: #28a745; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">
                查看回复
            </a>
        </div>
        """
        return self.send(to_email, subject, html)
    
    def send_password_reset(self, to_email: str, reset_link: str) -> bool:
        """发送密码重置邮件"""
        subject = "🔐 重置您的密码"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">密码重置请求</h2>
            <p style="color: #666;">
                您请求重置密码。请点击下面的链接设置新密码：
            </p>
            <p style="margin: 20px 0;">
                <a href="{reset_link}" style="display: inline-block; background: #dc3545; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                    重置密码
                </a>
            </p>
            <p style="color: #999; font-size: 12px;">
                如果您没有请求重置密码，请忽略此邮件。<br>
                此链接将在 1 小时后过期。
            </p>
        </div>
        """
        return self.send(to_email, subject, html)
    
    def send_welcome(self, to_email: str, nickname: str) -> bool:
        """发送欢迎邮件"""
        subject = f"欢迎 {nickname} 加入技术博客！"
        html = f"""
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">欢迎 {nickname}！</h2>
            <p style="color: #666;">
                感谢您注册技术博客。您现在可以：
            </p>
            <ul style="color: #666;">
                <li>发布技术文章</li>
                <li>参与社区讨论</li>
                <li>关注其他作者</li>
                <li>收藏感兴趣的文章</li>
            </ul>
            <a href="#" style="display: inline-block; background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
                开始探索
            </a>
        </div>
        """
        return self.send(to_email, subject, html)


# 全局邮件服务实例
email_service = EmailService()
