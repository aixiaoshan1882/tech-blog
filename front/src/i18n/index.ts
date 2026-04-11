/**
 * 国际化支持
 */

export type Locale = 'zh-CN' | 'en-US'

export interface LocaleConfig {
  name: string
  nativeName: string
}

export const locales: Record<Locale, LocaleConfig> = {
  'zh-CN': { name: '简体中文', nativeName: '简体中文' },
  'en-US': { name: 'English', nativeName: 'English' },
}

export function getStoredLocale(): Locale {
  const stored = localStorage.getItem('locale')
  if (stored && stored in locales) {
    return stored as Locale
  }
  return 'zh-CN'
}

export function setStoredLocale(locale: Locale) {
  localStorage.setItem('locale', locale)
}

// 翻译数据
const translations: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    // Header
    'nav.home': '首页',
    'nav.categories': '分类',
    'nav.tags': '标签',
    'nav.search': '搜索',
    'nav.login': '登录',
    'nav.register': '注册',
    'nav.logout': '退出登录',
    'nav.admin': '管理后台',
    'nav.profile': '个人资料',
    
    // Actions
    'action.submit': '提交',
    'action.cancel': '取消',
    'action.save': '保存',
    'action.delete': '删除',
    'action.edit': '编辑',
    'action.create': '创建',
    'action.search': '搜索',
    'action.loading': '加载中...',
    'action.noData': '暂无数据',
    
    // Post
    'post.title': '标题',
    'post.content': '内容',
    'post.excerpt': '摘要',
    'post.category': '分类',
    'post.tags': '标签',
    'post.author': '作者',
    'post.createdAt': '发布时间',
    'post.updatedAt': '更新时间',
    'post.views': '阅读',
    'post.likes': '点赞',
    'post.comments': '评论',
    'post.favorites': '收藏',
    
    // User
    'user.email': '邮箱',
    'user.password': '密码',
    'user.nickname': '昵称',
    'user.bio': '个人简介',
    'user.avatar': '头像',
    'user.role': '角色',
    
    // Admin
    'admin.dashboard': '仪表盘',
    'admin.analytics': '数据分析',
    'admin.posts': '文章管理',
    'admin.trash': '回收站',
    'admin.categories': '分类管理',
    'admin.tags': '标签管理',
    'admin.comments': '评论管理',
    'admin.users': '用户管理',
    'admin.announcements': '公告管理',
    'admin.logs': '操作日志',
    'admin.apiDocs': 'API 文档',
    'admin.settings': '网站设置',
    
    // Messages
    'msg.success': '操作成功',
    'msg.error': '操作失败',
    'msg.confirm': '确认操作',
    'msg.deleteConfirm': '确定要删除吗？',
  },
  'en-US': {
    // Header
    'nav.home': 'Home',
    'nav.categories': 'Categories',
    'nav.tags': 'Tags',
    'nav.search': 'Search',
    'nav.login': 'Login',
    'nav.register': 'Register',
    'nav.logout': 'Logout',
    'nav.admin': 'Admin',
    'nav.profile': 'Profile',
    
    // Actions
    'action.submit': 'Submit',
    'action.cancel': 'Cancel',
    'action.save': 'Save',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'action.create': 'Create',
    'action.search': 'Search',
    'action.loading': 'Loading...',
    'action.noData': 'No data',
    
    // Post
    'post.title': 'Title',
    'post.content': 'Content',
    'post.excerpt': 'Excerpt',
    'post.category': 'Category',
    'post.tags': 'Tags',
    'post.author': 'Author',
    'post.createdAt': 'Published',
    'post.updatedAt': 'Updated',
    'post.views': 'Views',
    'post.likes': 'Likes',
    'post.comments': 'Comments',
    'post.favorites': 'Favorites',
    
    // User
    'user.email': 'Email',
    'user.password': 'Password',
    'user.nickname': 'Nickname',
    'user.bio': 'Bio',
    'user.avatar': 'Avatar',
    'user.role': 'Role',
    
    // Admin
    'admin.dashboard': 'Dashboard',
    'admin.analytics': 'Analytics',
    'admin.posts': 'Posts',
    'admin.trash': 'Trash',
    'admin.categories': 'Categories',
    'admin.tags': 'Tags',
    'admin.comments': 'Comments',
    'admin.users': 'Users',
    'admin.announcements': 'Announcements',
    'admin.logs': 'Logs',
    'admin.apiDocs': 'API Docs',
    'admin.settings': 'Settings',
    
    // Messages
    'msg.success': 'Success',
    'msg.error': 'Error',
    'msg.confirm': 'Confirm',
    'msg.deleteConfirm': 'Are you sure to delete?',
  },
}

export function t(key: string, locale: Locale = 'zh-CN'): string {
  return translations[locale]?.[key] || translations['zh-CN'][key] || key
}

export function useLocale() {
  const locale = getStoredLocale()
  return { locale, setLocale: setStoredLocale, t }
}
