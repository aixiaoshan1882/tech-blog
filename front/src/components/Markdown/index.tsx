/**
 * Markdown 渲染组件
 */

import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useEffect } from 'react'
import Prism from 'prismjs'
import 'prismjs/components/prism-javascript'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-css'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-diff'
import 'prismjs/themes/prism-tomorrow.css'

interface MarkdownProps {
  content: string
  className?: string
}

export function Markdown({ content, className = '' }: MarkdownProps) {
  useEffect(() => {
    // 代码高亮
    Prism.highlightAll()
  }, [content])

  return (
    <div className={`prose prose-lg max-w-none dark:prose-invert ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // 自定义代码块
          code({ node, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '')
            const isInline = !match && !className

            if (isInline) {
              return (
                <code className="px-1 py-0.5 bg-gray-100 dark:bg-gray-800 rounded text-sm" {...props}>
                  {children}
                </code>
              )
            }

            return (
              <div className="not-prose">
                <pre className={`language-${match?.[1] || 'text'} rounded-lg overflow-x-auto`}>
                  <code className={`language-${match?.[1] || 'text'}`} {...props}>
                    {String(children).replace(/\n$/, '')}
                  </code>
                </pre>
              </div>
            )
          },
          // 自定义链接
          a({ href, children, ...props }) {
            const isExternal = href?.startsWith('http')
            return (
              <a
                href={href}
                target={isExternal ? '_blank' : undefined}
                rel={isExternal ? 'noopener noreferrer' : undefined}
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline"
                {...props}
              >
                {children}
              </a>
            )
          },
          // 自定义图片
          img({ src, alt, ...props }) {
            return (
              <img
                src={src}
                alt={alt}
                className="rounded-lg max-w-full h-auto"
                loading="lazy"
                {...props}
              />
            )
          },
          // 自定义表格
          table({ children, ...props }) {
            return (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700" {...props}>
                  {children}
                </table>
              </div>
            )
          },
          // 自定义引用
          blockquote({ children, ...props }) {
            return (
              <blockquote
                className="border-l-4 border-blue-500 pl-4 py-2 my-4 italic text-gray-600 dark:text-gray-400"
                {...props}
              >
                {children}
              </blockquote>
            )
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}
