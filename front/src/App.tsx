import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from '@/components/Layout/Layout'
import Home from '@/pages/Home'
import Post from '@/pages/Post'
import Category from '@/pages/Category'
import Tag from '@/pages/Tag'
import Search from '@/pages/Search'
import Login from '@/pages/Login'
import Register from '@/pages/Register'
import AdminLayout from '@/pages/Admin/layout'
import Dashboard from '@/pages/Admin/Dashboard'
import PostList from '@/pages/Admin/PostList'
import PostEdit from '@/pages/Admin/PostEdit'
import CategoryManage from '@/pages/Admin/CategoryManage'
import TagManage from '@/pages/Admin/TagManage'
import CommentManage from '@/pages/Admin/CommentManage'
import ProtectedRoute from '@/pages/Admin/ProtectedRoute'
import UserManage from '@/pages/Admin/UserManage'
import AnnouncementManage from '@/pages/Admin/AnnouncementManage'
import LogManage from '@/pages/Admin/LogManage'
import TrashManage from '@/pages/Admin/TrashManage'
import APIDocs from '@/pages/Admin/APIDocs'
import Analytics from '@/pages/Admin/Analytics'
import Settings from '@/pages/Admin/Settings'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* 前台 */}
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="post/:slug" element={<Post />} />
          <Route path="category/:slug" element={<Category />} />
          <Route path="tag/:slug" element={<Tag />} />
          <Route path="search" element={<Search />} />
          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />
        </Route>

        {/* 后台管理 */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <AdminLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="posts" element={<PostList />} />
          <Route path="posts/new" element={<PostEdit />} />
          <Route path="posts/:id/edit" element={<PostEdit />} />
          <Route path="categories" element={<CategoryManage />} />
          <Route path="tags" element={<TagManage />} />
          <Route path="comments" element={<CommentManage />} />
          <Route path="users" element={<UserManage />} />
          <Route path="announcements" element={<AnnouncementManage />} />
          <Route path="logs" element={<LogManage />} />
          <Route path="trash" element={<TrashManage />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="api-docs" element={<APIDocs />} />
          <Route path="analytics" element={<Analytics />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* 404 */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center">
              <div className="text-center">
                <p className="text-6xl mb-4">404</p>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
                  页面不存在
                </h1>
                <a href="/" className="text-blue-600 hover:text-blue-700">
                  返回首页
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
