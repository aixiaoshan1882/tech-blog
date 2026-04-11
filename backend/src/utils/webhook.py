"""
Webhook 通知服务
支持文章发布/评论等事件通知
"""
import os
import hmac
import hashlib
import asyncio
import aiohttp
from datetime import datetime
from typing import Optional
import logging

logger = logging.getLogger(__name__)


class WebhookEvent:
    """Webhook 事件类型"""
    POST_CREATED = "post.created"
    POST_UPDATED = "post.updated"
    POST_DELETED = "post.deleted"
    COMMENT_CREATED = "comment.created"
    USER_REGISTERED = "user.registered"


class WebhookService:
    """Webhook 服务"""
    
    def __init__(self):
        self.webhooks: list[dict] = []
        self.secret = os.getenv("WEBHOOK_SECRET", "")
        self.enabled = bool(os.getenv("WEBHOOK_URL"))
        
        # 从环境变量加载 webhook URL
        webhook_url = os.getenv("WEBHOOK_URL")
        if webhook_url:
            self.webhooks.append({
                "url": webhook_url,
                "events": [
                    WebhookEvent.POST_CREATED,
                    WebhookEvent.POST_UPDATED,
                    WebhookEvent.COMMENT_CREATED,
                ],
            })
    
    def _generate_signature(self, payload: str) -> str:
        """生成 HMAC 签名"""
        if not self.secret:
            return ""
        return hmac.new(
            self.secret.encode(),
            payload.encode(),
            hashlib.sha256
        ).hexdigest()
    
    async def send(self, url: str, event: str, data: dict) -> bool:
        """发送 webhook 请求"""
        payload = {
            "event": event,
            "timestamp": datetime.now().isoformat(),
            "data": data,
        }
        
        import json
        payload_str = json.dumps(payload)
        signature = self._generate_signature(payload_str)
        
        headers = {
            "Content-Type": "application/json",
            "X-Webhook-Event": event,
            "X-Webhook-Signature": signature,
        }
        
        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    url,
                    data=payload_str,
                    headers=headers,
                    timeout=aiohttp.ClientTimeout(total=10)
                ) as response:
                    if response.status >= 200 and response.status < 300:
                        logger.info(f"Webhook sent successfully: {event}")
                        return True
                    else:
                        logger.warning(f"Webhook failed: {response.status}")
                        return False
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            return False
    
    async def notify(self, event: str, data: dict) -> dict:
        """发送通知到所有订阅了此事件的 webhook"""
        if not self.enabled:
            return {"sent": 0, "failed": 0}
        
        sent = 0
        failed = 0
        
        for webhook in self.webhooks:
            if event in webhook.get("events", []):
                success = await self.send(webhook["url"], event, data)
                if success:
                    sent += 1
                else:
                    failed += 1
        
        return {"sent": sent, "failed": failed}
    
    def trigger(self, event: str, data: dict) -> None:
        """触发 webhook（异步，不等待）"""
        if self.enabled:
            asyncio.create_task(self.notify(event, data))


# 全局实例
webhook_service = WebhookService()


# 便捷函数
async def webhook_notify(event: str, data: dict) -> dict:
    """发送 webhook 通知"""
    return await webhook_service.notify(event, data)


def webhook_trigger(event: str, data: dict) -> None:
    """触发 webhook（异步）"""
    webhook_service.trigger(event, data)
