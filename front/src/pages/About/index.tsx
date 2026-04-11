import { Link } from 'react-router-dom'

export default function About() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4">关于技术笔记博客</h1>
          <p className="text-xl text-gray-600 dark:text-gray-400">
            分享技术心得，记录成长之路
          </p>
        </div>

        {/* Mission */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-4">🎯 我们的使命</h2>
          <p className="text-gray-600 dark:text-gray-400 leading-relaxed mb-4">
            技术笔记博客致力于为开发者提供一个高质量的技术文章分享平台。我们相信：
          </p>
          <ul className="list-disc list-inside text-gray-600 dark:text-gray-400 space-y-2">
            <li>分享知识可以加深理解</li>
            <li>记录过程可以帮助他人</li>
            <li>技术社区需要持续积累</li>
            <li>开放交流能够促进创新</li>
          </ul>
        </section>

        {/* Features */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">✨ 功能特点</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="flex items-start">
              <span className="text-3xl mr-4">📝</span>
              <div>
                <h3 className="font-medium mb-1">Markdown 写作</h3>
                <p className="text-sm text-gray-500">支持 Markdown 语法，轻松排版</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-3xl mr-4">💬</span>
              <div>
                <h3 className="font-medium mb-1">互动评论</h3>
                <p className="text-sm text-gray-500">支持嵌套评论，友好交流</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-3xl mr-4">🏷️</span>
              <div>
                <h3 className="font-medium mb-1">分类标签</h3>
                <p className="text-sm text-gray-500">灵活分类，易于查找</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-3xl mr-4">🔔</span>
              <div>
                <h3 className="font-medium mb-1">即时通知</h3>
                <p className="text-sm text-gray-500">评论回复，第一时间知晓</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-3xl mr-4">📡</span>
              <div>
                <h3 className="font-medium mb-1">RSS 订阅</h3>
                <p className="text-sm text-gray-500">支持 RSS 订阅，不错过精彩</p>
              </div>
            </div>
            <div className="flex items-start">
              <span className="text-3xl mr-4">🌙</span>
              <div>
                <h3 className="font-medium mb-1">深色模式</h3>
                <p className="text-sm text-gray-500">保护眼睛，舒适阅读</p>
              </div>
            </div>
          </div>
        </section>

        {/* Tech Stack */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8 mb-8">
          <h2 className="text-2xl font-bold mb-6">🛠️ 技术栈</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl mb-2">🐍</div>
              <div className="font-medium">Python</div>
              <div className="text-xs text-gray-500">FastAPI</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl mb-2">⚛️</div>
              <div className="font-medium">React</div>
              <div className="text-xs text-gray-500">Vite</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl mb-2">🗄️</div>
              <div className="font-medium">SQLite</div>
              <div className="text-xs text-gray-500">PostgreSQL</div>
            </div>
            <div className="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div className="text-2xl mb-2">🐳</div>
              <div className="font-medium">Docker</div>
              <div className="text-xs text-gray-500">容器化部署</div>
            </div>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-white dark:bg-gray-800 rounded-xl p-8">
          <h2 className="text-2xl font-bold mb-4">📬 联系我们</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            如果您有任何问题或建议，欢迎通过以下方式联系我们：
          </p>
          <div className="space-y-2 text-gray-600 dark:text-gray-400">
            <p>📧 邮箱: admin@example.com</p>
            <p>💬 反馈: <Link to="/search" className="text-blue-600 hover:underline">提交建议</Link></p>
          </div>
        </section>

        {/* CTA */}
        <div className="mt-8 text-center">
          <Link
            to="/register"
            className="inline-block px-8 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 transition-colors"
          >
            立即加入
          </Link>
        </div>
      </div>
    </div>
  )
}
