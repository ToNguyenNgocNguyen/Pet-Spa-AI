import { Navigate, Route, Routes } from 'react-router-dom'
import { Spin } from 'antd'
import { useAuth } from './auth.jsx'
import AppLayout from './layout/AppLayout.jsx'
import Login from './pages/Login.jsx'
import LandingPage from './pages/LandingPage.jsx'
import { APP_ROUTES } from './routes.jsx'

function Guard({ route, children }) {
  const { user, loading } = useAuth()
  if (loading) return <Spin fullscreen />
  if (route.public && !route.roles) return children
  if (!user) return <Navigate to="/dang-nhap" replace />
  if (route.roles && !route.roles.includes(user.role)) return <Navigate to="/app/tong-quan" replace />
  return children
}

export default function App() {
  return (
    <Routes>
      {/* Trang ngoài cùng là Landing Page giới thiệu */}
      <Route path="/" element={<LandingPage />} />

      {/* Trang Đăng nhập & Đăng ký */}
      <Route path="/dang-nhap" element={<Login />} />

      {/* Khu vực ứng dụng nghiệp vụ & quản trị (/app) */}
      <Route path="/app" element={<Navigate to="/app/tong-quan" replace />} />
      <Route element={<AppLayout />}>
        {APP_ROUTES.map((r) => (
          <Route key={r.path} path={r.path} element={<Guard route={r}>{r.element}</Guard>} />
        ))}
      </Route>

      {/* Bất kỳ đường dẫn nào khác redirect về Landing Page */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
