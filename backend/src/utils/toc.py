"""文章目录生成工具"""
import re
from typing import List, Dict

def extract_headings(content: str) -> List[Dict[str, any]]:
    """
    从 Markdown 内容中提取标题，生成目录结构
    
    返回格式:
    [
        {"level": 1, "text": "标题1", "anchor": "toc-1"},
        {"level": 2, "text": "标题1.1", "anchor": "toc-2"},
        ...
    ]
    """
    # Markdown 标题正则: # ## ### 等
    heading_pattern = re.compile(r'^(#{1,6})\s+(.+)$', re.MULTILINE)
    
    headings = []
    counter = 0
    
    for match in heading_pattern.finditer(content):
        level = len(match.group(1))  # # 的数量
        text = match.group(2).strip()
        
        # 生成锚点 ID
        anchor = generate_anchor(text, counter)
        counter += 1
        
        headings.append({
            "level": level,
            "text": text,
            "anchor": anchor
        })
    
    return headings


def generate_anchor(text: str, index: int) -> str:
    """生成锚点 ID"""
    # 转小写，替换特殊字符为空格，然后替换空格为连字符
    anchor = text.lower()
    anchor = re.sub(r'[^\w\s-]', '', anchor)  # 移除特殊字符
    anchor = re.sub(r'[\s]+', '-', anchor)   # 空格替换为连字符
    anchor = re.sub(r'-+', '-', anchor)       # 多个连字符变一个
    anchor = anchor.strip('-')              # 移除首尾连字符
    
    # 如果为空或太长，使用索引
    if not anchor or len(anchor) > 50:
        anchor = f"heading-{index}"
    
    return anchor


def add_anchor_links(content: str) -> str:
    """
    为 Markdown 内容中的所有标题添加锚点 ID
    这样前端可以直接跳转到对应位置
    """
    def replace_heading(match):
        hashes = match.group(1)
        text = match.group(2)
        level = len(hashes)
        anchor = generate_anchor(text.strip(), 0)
        
        # 返回带 id 的标题
        return f'{hashes} <a id="{anchor}" href="#{anchor}">{text.strip()}</a>'
    
    # 匹配标题行
    content = re.sub(
        r'^(#{1,6})\s+(.+)$',
        replace_heading,
        content,
        flags=re.MULTILINE
    )
    
    return content


def generate_toc_html(headings: List[Dict[str, any]]) -> str:
    """生成 HTML 格式的目录"""
    if not headings:
        return ""
    
    html = '<nav class="toc">\n'
    html += '<div class="toc-title">目录</div>\n'
    html += '<ul class="toc-list">\n'
    
    current_level = 0
    
    for heading in headings:
        level = heading["level"]
        indent = (level - 1) * 2
        
        # 关闭之前未关闭的 ul
        while current_level > level:
            html += '</ul></li>\n'
            current_level -= 1
        
        # 如果需要新的嵌套
        if level > current_level:
            while current_level < level - 1:
                html += '<ul class="toc-sub">\n'
                current_level += 1
        
        # 添加标题项
        html += ' ' * indent
        html += f'<li class="toc-item">'
        html += f'<a href="#{heading["anchor"]}" class="toc-link">'
        html += f'{heading["text"]}</a></li>\n'
        
        current_level = level
    
    # 关闭所有未关闭的标签
    while current_level > 0:
        html += '</ul>\n'
        current_level -= 1
    
    html += '</ul>\n'
    html += '</nav>\n'
    
    return html
