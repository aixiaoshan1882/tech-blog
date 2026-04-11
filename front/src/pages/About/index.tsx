/**
 * 关于页面
 */

import { Link } from 'react-router-dom'

const techStack = [
  { name: 'Python', icon: '🐍', desc: 'FastAPI', color: 'from-blue-400 to-yellow-400' },
  { name: 'React', icon: '⚛️', desc: 'Vite', color: 'from-cyan-400 to-blue-500' },
  { name: 'TypeScript', icon: '🔷', desc: '类型安全', color: 'from-blue-500 to-indigo-500' },
  { name: 'SQLite', icon: '🗄️', desc: 'PostgreSQL', color: 'from-blue-600 to-purple-600' },
  { name: 'Docker', icon: '🐳', desc: '容器化', color: 'from-blue-400 to-cyan-400' },
  { name: 'Nginx', icon: '🌐', desc: '反向代理', color: 'from-green-500 to-emerald-500' },
]

const features = [
  { icon: '📝', title: 'Markdown 写作', desc: '支持完整 Markdown 语法，轻松排版' },
  { icon: '💬', title: '互动评论', desc: '支持嵌套评论，友好交流' },
  { icon: '🏷️', title: '分类标签', desc: '灵活分类，易于查找' },
  { icon: '🔔', title: '即时通知', desc: '评论回复，第一时间知晓' },
  { icon: '📡', title: 'RSS 订阅', desc: '支持 RSS/Atom 订阅' },
  { icon: '🌙', title: '深色模式', desc: '保护眼睛，舒适阅读' },
  { icon: '🔐', title: '安全防护', desc: 'XSS/SQL 注入防护' },
  { icon: '📊', title: '数据分析', desc: '访问统计，数据分析' },
]

const stats = [
  { value: '50+', label: '技术文章', icon: '📝' },
  { value: '1000+', label: '阅读量', icon: '👁' },
  { value: '100+', label: '用户', icon: '👥' },
  { value: '24/7', label: '在线', icon: '🕐' },
]

export default function About() {
  return (
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="bg-gradient-to-br from-blue-600 via-purple-600 to-indigo-700 text-white py-20 relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-64 h-64 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-pink-300 rounded-full blur-3xl" />
        </div>
        
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative">
          <div className="inline-flex items-center justify-center w-24 h-24 bg-white/20 backdrop-blur-sm rounded-3xl mb-8 text-6xl">
            💻
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            关于技术笔记博客
          </h1>
          <p className="text-xl text-blue-100 mb-8 max-w-2xl mx-auto">
            分享技术心得，记录成长之路，与志同道合的开发者一起进步
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/search"
              className="px-8 py-3 bg-white text-blue-600 rounded-xl font-semibold hover:bg-blue-50 transition-all shadow-lg"
            >
              🔍 浏览文章
            </Link>
            <Link
              to="/register"
              className="px-8 py-3 bg-blue-500 text-white rounded-xl font-semibold hover:bg-blue-400 transition-all border border-white/20"
            >
              ✨ 加入我们
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="max-w-6xl mx-auto px-4 -mt-10 relative z-10">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div key={i} className="text-center p-4">
              <div className="text-3xl mb-2">{stat.icon}</div>
              <div className="text-2xl md:text-3xl font-bold text-blue-600">{stat.value}</div>
              <div className="text-sm text-gray-500 dark:text-gray-400">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Mission Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-br from-blue-50 to-purple-50 dark:from-gray-800/50 dark:to-indigo-900/50 rounded-3xl p-8 md:p-12">
          <div className="flex items-center gap-3 mb-6">
            <span className="text-4xl">🎯</span>
            <h2 className="text-2xl font-bold">我们的使命</h2>
          </div>
          <p className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed mb-6">
            技术笔记博客致力于为开发者提供一个高质量的技术文章分享平台。我们相信技术的力量源于分享，每一个小小的知识点都值得被记录和传播。
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[
              '分享知识可以加深理解',
              '记录过程可以帮助他人',
              '技术社区需要持续积累',
              '开放交流能够促进创新',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3 bg-white/80 dark:bg-gray-800/80 rounded-xl">
                <span className="w-6 h-6 bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 rounded-full flex items-center justify-center text-sm">✓</span>
                <span className="text-gray-700 dark:text-gray-300">{item}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold mb-4">✨ 功能特点</h2>
          <p className="text-gray-500 dark:text-gray-400">强大功能，简单体验</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {features.map((feature, i) => (
            <div
              key={i}
              className="group bg-white dark:bg-gray-800 rounded-2xl p-6 hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">{feature.icon}</div>
              <h3 className="font-semibold text-lg mb-2 group-hover:text-blue-600 transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {feature.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Tech Stack Section */}
      <section className="bg-gray-50 dark:bg-gray-900/50 py-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">🛠️ 技术栈</h2>
            <p className="text-gray-500 dark:text-gray-400">现代化的技术选型，高效可靠</p>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
            {techStack.map((tech, i) => (
              <div
                key={i}
                className="group text-center p-6 bg-white dark:bg-gray-800 rounded-2xl hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br ${tech.color} rounded-xl text-3xl mb-3 group-hover:scale-110 transition-transform`}>
                  {tech.icon}
                </div>
                <h3 className="font-medium mb-1">{tech.name}</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{tech.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="bg-gradient-to-br from-purple-600 to-blue-600 rounded-3xl p-8 md:p-12 text-white text-center">
          <div className="text-5xl mb-6">📬</div>
          <h2 className="text-3xl font-bold mb-4">联系我们</h2>
          <p className="text-purple-100 mb-8 max-w-lg mx-auto">
            如果您有任何问题或建议，欢迎通过以下方式联系我们
          </p>
          
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
              <span>📧</span>
              <span>admin@example.com</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 bg-white/20 backdrop-blur-sm rounded-full">
              <span>💬</span>
              <span>微信公众号</span>
            </div>
          </div>
          
          <div className="p-6 bg-white/10 backdrop-blur-sm rounded-2xl max-w-md mx-auto">
            <p className="text-purple-100 mb-4">或者通过评论功能给我们留言</p>
            <Link
              to="/post/python-async-programming"
              className="inline-flex items-center gap-2 px-6 py-3 bg-white text-purple-600 rounded-xl font-semibold hover:bg-purple-50 transition-all"
            >
              💬 去留言
            </Link>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gray-900 text-white py-16">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl font-bold mb-4">准备好开始了吗？ 🚀</h2>
          <p className="text-gray-400 mb-8 text-lg">
            加入我们的社区，发表你的第一篇文章
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/register"
              className="px-10 py-4 bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-blue-500/30 transition-all transform hover:-translate-y-1"
            >
              ✨ 立即注册
            </Link>
            <Link
              to="/search"
              className="px-10 py-4 bg-white/10 backdrop-blur-sm text-white rounded-xl font-semibold border border-white/20 hover:bg-white/20 transition-all"
            >
              🔍 浏览文章
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
