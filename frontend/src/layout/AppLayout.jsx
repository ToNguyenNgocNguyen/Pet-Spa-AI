import { useEffect, useState } from 'react'
import {
  Avatar, Badge, Button, Dropdown, Layout, List, Menu, Popover,
  Space, Tag, Typography, message,
} from 'antd'
import {
  BankOutlined, BarChartOutlined, BellOutlined, CalendarOutlined, CheckOutlined, DashboardOutlined,
  DesktopOutlined, DollarOutlined, GlobalOutlined, HistoryOutlined, IdcardOutlined,
  LogoutOutlined, MenuFoldOutlined, MenuUnfoldOutlined, RobotOutlined, ShopOutlined, TeamOutlined,
  ToolOutlined, UserOutlined,
} from '@ant-design/icons'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api, unwrap } from '../api.js'
import { useAuth, ROLE_LABEL } from '../auth.jsx'
import { APP_ROUTES, labelFor } from '../routes.jsx'
import AiChatDrawer from '../components/AiChatDrawer.jsx'

const { Header, Sider, Content } = Layout
const { Text } = Typography

const ROUTE_ICONS = {
  '/app/tong-quan': <DashboardOutlined />,
  '/app/bang-le-tan': <DesktopOutlined />,
  '/app/thong-ke': <BarChartOutlined />,
  '/app/lich-hen': <CalendarOutlined />,
  '/app/hoa-don': <DollarOutlined />,
  '/app/nhac-tai-spa': <HistoryOutlined />,
  '/app/thu-cung': <IdcardOutlined />,
  '/app/khach-hang': <TeamOutlined />,
  '/app/dich-vu': <ShopOutlined />,
  '/app/nhan-su': <ToolOutlined />,
  '/app/quan-tri-ai': <RobotOutlined />,
  '/app/ho-so-spa': <BankOutlined />,
  '/app/tai-khoan': <UserOutlined />,
}

// Cấu trúc phân nhóm logic các trang điều hướng trong sidebar
const NAV_GROUPS = [
  {
    key: 'operations',
    label: 'Vận hành & Đặt lịch',
    paths: ['/app/tong-quan', '/app/bang-le-tan', '/app/thong-ke', '/app/lich-hen', '/app/hoa-don'],
  },
  {
    key: 'crm',
    label: 'Khách hàng & Bé cưng',
    paths: ['/app/khach-hang', '/app/thu-cung', '/app/nhac-tai-spa'],
  },
  {
    key: 'catalog_staff',
    label: 'Dịch vụ & Cơ sở',
    paths: ['/app/dich-vu', '/app/nhan-su'],
  },
  {
    key: 'system',
    label: 'Hệ thống & AI',
    paths: ['/app/quan-tri-ai', '/app/ho-so-spa', '/app/tai-khoan'],
  },
]

export default function AppLayout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const { pathname } = useLocation()

  // Trạng thái thu gọn sidebar (lưu vào localStorage)
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('sidebar_collapsed') === 'true'
    } catch {
      return false
    }
  })

  const handleToggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      try {
        localStorage.setItem('sidebar_collapsed', String(next))
      } catch {}
      return next
    })
  }

  // Thông báo
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)

  const loadNotifications = async () => {
    if (!user) return
    try {
      const [cnt, list] = await Promise.all([
        api('/notifications/unread-count').catch(() => ({ count: 0 })),
        api('/notifications?unread=1').catch(() => []),
      ])
      setUnreadCount(cnt.count || 0)
      setNotifications(unwrap(list))
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    loadNotifications()
    const timer = setInterval(loadNotifications, 30000)
    return () => clearInterval(timer)
  }, [user])

  const markAllRead = async () => {
    try {
      await api('/notifications/read-all', { method: 'POST' })
      setUnreadCount(0)
      setNotifications([])
      message.success('Đã đánh dấu đã đọc tất cả')
    } catch {
      // ignore
    }
  }

  const markRead = async (id, refType, refId) => {
    try {
      await api(`/notifications/${id}/read`, { method: 'POST' })
      setNotifications((prev) => prev.filter((n) => n.id !== id))
      setUnreadCount((c) => Math.max(0, c - 1))
      if (refType === 'booking') {
        nav('/app/lich-hen')
      }
    } catch {
      // ignore
    }
  }

  // Lọc routes theo vai trò và tổ chức thành nhóm
  const visibleRoutes = APP_ROUTES.filter((r) => (r.roles ? user && r.roles.includes(user.role) : true))
  const routeMap = new Map(visibleRoutes.map((r) => [r.path, r]))

  const menuItems = collapsed
    ? visibleRoutes.map((r) => ({
        key: r.path,
        icon: ROUTE_ICONS[r.path],
        label: labelFor(r, user),
        title: labelFor(r, user),
      }))
    : NAV_GROUPS.map((group) => {
        const children = group.paths
          .filter((p) => routeMap.has(p))
          .map((p) => {
            const r = routeMap.get(p)
            return {
              key: r.path,
              icon: ROUTE_ICONS[r.path],
              label: labelFor(r, user),
            }
          })
        if (children.length === 0) return null
        return {
          type: 'group',
          key: group.key,
          label: group.label,
          children,
        }
      }).filter(Boolean)

  const notifPopoverContent = (
    <div style={{ width: 340 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong>Thông báo mới</Text>
        {unreadCount > 0 && (
          <Button type="link" size="small" icon={<CheckOutlined />} onClick={markAllRead}>
            Đã đọc tất cả
          </Button>
        )}
      </div>

      <List
        size="small"
        dataSource={notifications}
        locale={{ emptyText: 'Không có thông báo mới' }}
        renderItem={(n) => (
          <List.Item
            style={{ cursor: 'pointer', padding: '8px 4px' }}
            onClick={() => markRead(n.id, n.ref_type, n.ref_id)}
          >
            <List.Item.Meta
              title={<Text strong style={{ fontSize: 13 }}>{n.title}</Text>}
              description={
                <div>
                  <div style={{ fontSize: 12, color: '#4b5563' }}>{n.body}</div>
                  <Text type="secondary" style={{ fontSize: 11 }}>{dayjs(n.created_at).fromNow ? dayjs(n.created_at).fromNow() : dayjs(n.created_at).format('HH:mm DD/MM')}</Text>
                </div>
              }
            />
          </List.Item>
        )}
      />
    </div>
  )

  return (
    <Layout style={{ height: '100vh', overflow: 'hidden' }}>
      <Sider
        collapsible
        collapsed={collapsed}
        onCollapse={setCollapsed}
        trigger={null}
        width={240}
        collapsedWidth={76}
        style={{
          height: '100vh',
          background: '#0b3d3f',
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '2px 0 10px rgba(0,0,0,0.12)',
          transition: 'all 0.25s cubic-bezier(0.2, 0, 0, 1)',
          zIndex: 20,
        }}
      >
        {/* Brand header */}
        <div
          className="brand"
          onClick={() => nav('/app/tong-quan')}
          style={{
            flexShrink: 0,
            background: '#0b3d3f',
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            padding: collapsed ? '16px 0' : '16px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: collapsed ? 'center' : 'flex-start',
            gap: 10,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          title="Pet Spa AI - Về trang Tổng quan"
        >
          <div className="brand-mark" style={{ minWidth: 34 }}>🐾</div>
          {!collapsed && (
            <span style={{ fontSize: 17, fontWeight: 700, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden' }}>
              Pet Spa AI
            </span>
          )}
        </div>

        {/* Scrollable menu area (không hiển thị scrollbar, cuộn mượt mà) */}
        <div className="sidebar-menu-scroll">
          <Menu
            theme="dark"
            mode="inline"
            selectedKeys={[pathname]}
            items={menuItems}
            onClick={(e) => nav(e.key)}
            inlineIndent={16}
            style={{ background: 'transparent', borderRight: 0, paddingBottom: 16 }}
          />
        </div>

        {/* Bottom collapse / expand bar (ghim cố định ở đáy, không bị ảnh hưởng khi scroll menu) */}
        <div
          className="sidebar-collapse-btn"
          style={{
            justifyContent: collapsed ? 'center' : 'space-between',
          }}
          onClick={handleToggleCollapse}
          title={collapsed ? 'Mở rộng thanh menu' : 'Thu gọn thanh menu'}
        >
          {!collapsed && (
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.2 }}>
              Thu gọn menu
            </span>
          )}
          {collapsed ? (
            <MenuUnfoldOutlined style={{ fontSize: 16, color: '#5eead4' }} />
          ) : (
            <MenuFoldOutlined style={{ fontSize: 16, color: '#5eead4' }} />
          )}
        </div>
      </Sider>

      <Layout style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <Header
          style={{
            background: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 24px',
            borderBottom: '1px solid #e2e8f0',
            flexShrink: 0,
            zIndex: 9,
            boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Button
              type="text"
              icon={<GlobalOutlined style={{ color: '#0f8b8d', fontSize: 16 }} />}
              onClick={() => nav('/')}
              style={{ fontWeight: 600, color: '#0b3d3f' }}
            >
              Trang Giới Thiệu (Landing Page)
            </Button>
          </div>

          <Space size="large">
            {/* Chuông thông báo */}
            {user && (
              <Popover content={notifPopoverContent} trigger="click" placement="bottomRight">
                <Badge count={unreadCount} overflowCount={99} offset={[-2, 4]}>
                  <Button type="text" shape="circle" icon={<BellOutlined style={{ fontSize: 18, color: '#4b5563' }} />} />
                </Badge>
              </Popover>
            )}

            {user ? (
              <Dropdown
                menu={{
                  items: [
                    {
                      key: 'acc',
                      label: 'Tài khoản',
                      icon: <UserOutlined />,
                      onClick: () => nav('/app/tai-khoan'),
                    },
                    {
                      key: 'out',
                      label: 'Đăng xuất',
                      icon: <LogoutOutlined />,
                      onClick: async () => {
                        await logout()
                        nav('/')
                      },
                    },
                  ],
                }}
              >
                <Space style={{ cursor: 'pointer' }}>
                  <Avatar style={{ background: '#0f8b8d' }} icon={<UserOutlined />} />
                  <Typography.Text strong>{user.full_name || user.username}</Typography.Text>
                  <Tag color="cyan">{ROLE_LABEL[user.role]}</Tag>
                </Space>
              </Dropdown>
            ) : (
              <Button type="primary" onClick={() => nav('/dang-nhap')}>
                Đăng nhập
              </Button>
            )}
          </Space>
        </Header>
        <Content
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 24,
            background: '#f8fafc',
          }}
        >
          <Outlet />
        </Content>
      </Layout>
      <AiChatDrawer />
    </Layout>
  )
}
