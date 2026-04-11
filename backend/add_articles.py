import sys
sys.path.insert(0, 'src')

import requests

# 获取 token
resp = requests.post('http://localhost:8787/api/auth/login', json={'email': 'admin@example.com', 'password': 'admin123'})
token = resp.json()['data']['token']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

articles = [
    {
        'title': 'TypeScript 5.0 高级特性详解',
        'slug': 'typescript-50-advanced',
        'content': '''# TypeScript 5.0 高级特性

TypeScript 5.0 带来了许多新特性，让开发体验更上一层楼。

## 装饰器

装饰器现在已经稳定，可以直接使用：

```typescript
function log(target: any, key: string) {
  console.log(`${key} 被调用`);
}

class Calculator {
  @log
  add(a: number, b: number) {
    return a + b;
  }
}
```

## const 类型参数

这个新特性允许你在泛型中使用 const：

```typescript
function getValue<T extends const>(obj: T) {
  return obj;
}

const result = getValue({ x: 1, y: 2 });
// result 的类型是 { x: 1, y: 2 }
```''',
        'excerpt': 'TypeScript 5.0 带来了装饰器、const 类型参数等新特性',
        'categoryId': 4,
        'is_public': 1
    },
    {
        'title': 'Python 异步编程实战',
        'slug': 'python-async-programming',
        'content': '''# Python 异步编程

Python 的 asyncio 模块提供了强大的异步编程支持。

## async/await 基础

```python
import asyncio

async def fetch_data():
    await asyncio.sleep(1)
    return {'data': 'hello'}

async def main():
    result = await fetch_data()
    print(result)

asyncio.run(main())
```''',
        'excerpt': 'Python asyncio 异步编程详解',
        'categoryId': 6,
        'is_public': 1
    },
    {
        'title': 'React 18 新特性探索',
        'slug': 'react-18-new-features',
        'content': '''# React 18 新特性

React 18 引入了许多激动人心的新特性。

## Concurrent Rendering

并发渲染让 React 可以同时准备多个 UI 版本。

## 自动批处理

自动批处理减少了不必要的重新渲染。''',
        'excerpt': 'React 18 新特性详解',
        'categoryId': 4,
        'is_public': 1
    }
]

for article in articles:
    resp = requests.post('http://localhost:8787/api/posts', headers=headers, json=article)
    if resp.status_code == 200:
        print(f'Created: {article["title"]}')
    else:
        print(f'Failed: {article["title"]} - {resp.text}')

print('Done')
