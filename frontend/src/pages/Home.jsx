import { useEffect, useState } from 'react'
import {
  Alert, Badge, Button, Card, Col, Descriptions, Empty, Image, List,
  Progress, Row, Skeleton, Space, Statistic, Tag, Typography, message,
} from 'antd'
import {
  CalendarOutlined, CheckCircleFilled, ClockCircleOutlined, DesktopOutlined, DollarOutlined,
  ExclamationCircleFilled, PlusOutlined, ReloadOutlined, RightOutlined,
  ThunderboltFilled, UserOutlined, WarningFilled,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api, money, unwrap } from '../api.js'
import { useAuth } from '../auth.jsx'

const { Title, Text, Paragraph } = Typography

const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']

export default function Home() {
  const { user } = useAuth()
  const nav = useNavigate()
  const isCustomer = user?.role === 'customer'
  const isFrontDesk = ['receptionist', 'manager'].includes(user?.role)

  const [spa, setSpa] = useState(null)
  const [packages, setPackages] = useState([])
  const [dashboardData, setDashboardData] = useState(null)
  const [myUpcomingBookings, setMyUpcomingBookings] = useState([])
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    try {
      const [s, p] = await Promise.all([
        api('/spa').catch(() => null),
        api('/packages').catch(() => []),
      ])
      setSpa(s)
      setPackages(unwrap(p))

      if (isFrontDesk) {
        const d = await api('/dashboard/today').catch(() => null)
        setDashboardData(d)
      } else if (isCustomer) {
        const b = await api('/bookings?status=pending,confirmed,checked_in,in_progress').catch(() => [])
        setMyUpcomingBookings(unwrap(b))
      }
    } catch (e) {
      message.error(e.message || 'Lỗi khi tải dữ liệu tổng quan')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [user])

  if (loading) return <Skeleton active paragraph={{ rows: 8 }} />
  if (!spa) return <Empty description="Spa chưa khai báo hồ sơ cơ sở." />

  const openDays = (spa.open_weekdays || []).map((d) => DAYS[d]).join(', ')

  return (
    <div>
      {/* Banner chào mừng */}
      <div className="hero" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h2>Xin chào, {user?.full_name || user?.username}! 👋</h2>
          <p>{spa.name} — {spa.address}</p>
        </div>
        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={loadData}>Cập nhật số liệu</Button>
          {isFrontDesk && (
            <Button
              type="primary"
              icon={<DesktopOutlined />}
              onClick={() => nav('/app/bang-le-tan')}
              style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
            >
              Bảng Lễ Tân Điều Phối
            </Button>
          )}
          <Button type="default" icon={<CalendarOutlined />} onClick={() => nav('/app/lich-hen')}>
            {isCustomer ? 'Đặt lịch chăm sóc' : 'Quản lý lịch hẹn'}
          </Button>
        </Space>
      </div>

      {/* ===== GIAO DIỆN DASHBOARD CHO LỄ TÂN & QUẢN LÝ ===== */}
      {isFrontDesk && dashboardData && (
        <div style={{ marginBottom: 24 }}>
          <Title level={4} style={{ marginBottom: 16 }}>
            Bảng Điều Khiển Hôm Nay ({dayjs(dashboardData.date).format('DD/MM/YYYY')})
          </Title>

          <Row gutter={[16, 16]}>
            <Col xs={12} sm={6} lg={6}>
              <Card
                size="small"
                hoverable
                onClick={() => nav('/app/hoa-don?status=paid')}
                style={{ borderRadius: 14, cursor: 'pointer' }}
              >
                <Statistic
                  title="Doanh thu thực thu"
                  value={money(dashboardData.revenue)}
                  prefix={<DollarOutlined />}
                  valueStyle={{ color: '#0f8b8d', fontWeight: 800 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Từ {dashboardData.paid_invoices} hóa đơn đã thu (Xem)
                </Text>
              </Card>
            </Col>

            <Col xs={12} sm={6} lg={6}>
              <Card
                size="small"
                hoverable
                onClick={() => nav('/app/lich-hen')}
                style={{ borderRadius: 14, cursor: 'pointer' }}
              >
                <Statistic
                  title="Tổng số lịch hôm nay"
                  value={dashboardData.total_bookings}
                  prefix={<CalendarOutlined />}
                  valueStyle={{ fontWeight: 800 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dashboardData.counts?.completed || 0} đã xong · {dashboardData.counts?.in_progress || 0} đang làm (Xem)
                </Text>
              </Card>
            </Col>

            <Col xs={12} sm={6} lg={6}>
              <Card
                size="small"
                hoverable
                onClick={() => nav('/app/lich-hen?status=pending')}
                style={{ borderRadius: 14, cursor: 'pointer' }}
              >
                <Statistic
                  title="Chờ tiếp nhận / Duyệt"
                  value={dashboardData.counts?.pending || 0}
                  valueStyle={{ color: (dashboardData.counts?.pending || 0) > 0 ? '#f59e0b' : '#10b981', fontWeight: 800 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Cần xử lý sớm (Xem chi tiết)
                </Text>
              </Card>
            </Col>

            <Col xs={12} sm={6} lg={6}>
              <Card
                size="small"
                hoverable
                onClick={() => nav('/app/hoa-don?status=unpaid')}
                style={{ borderRadius: 14, cursor: 'pointer' }}
              >
                <Statistic
                  title="Hóa đơn chưa thu"
                  value={dashboardData.unpaid_count}
                  valueStyle={{ color: dashboardData.unpaid_count > 0 ? '#ef4444' : '#10b981', fontWeight: 800 }}
                />
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tổng nợ: {money(dashboardData.unpaid_total)} (Xem thu)
                </Text>
              </Card>
            </Col>
          </Row>

          {/* Cảnh báo các lịch cần chú ý */}
          {dashboardData.needs_attention?.length > 0 && (
            <Alert
              type="warning"
              showIcon
              icon={<WarningFilled />}
              style={{ marginTop: 16, borderRadius: 12 }}
              message={<Text strong>Có {dashboardData.needs_attention.length} lịch hẹn đang chờ duyệt lâu hoặc đã quá giờ hẹn</Text>}
              description={
                <Space wrap style={{ marginTop: 6 }}>
                  {dashboardData.needs_attention.map((item) => (
                    <Button
                      key={item.id}
                      size="small"
                      type="link"
                      onClick={() => nav('/app/lich-hen')}
                      style={{ padding: 0, marginRight: 12 }}
                    >
                      🐾 {item.pet} (#{item.id}) - {dayjs(item.start_at).format('HH:mm DD/MM')}
                    </Button>
                  ))}
                </Space>
              }
            />
          )}

          {/* Phân bổ công việc KTV */}
          {dashboardData.by_staff?.length > 0 && (
            <Card title="Phân bổ việc cho Kỹ thuật viên hôm nay" size="small" style={{ marginTop: 16, borderRadius: 14 }}>
              <Row gutter={[16, 12]}>
                {dashboardData.by_staff.map((st, i) => (
                  <Col xs={24} sm={12} md={8} key={i}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text strong>{st.staff}</Text>
                      <Tag color="cyan">{st.count} lượt chăm sóc</Tag>
                    </div>
                    <Progress percent={Math.min(100, Math.round((st.count / Math.max(1, dashboardData.total_bookings)) * 100))} strokeColor="#0f8b8d" />
                  </Col>
                ))}
              </Row>
            </Card>
          )}
        </div>
      )}

      {/* ===== GIAO DIỆN DÀNH CHO KHÁCH HÀNG ===== */}
      {isCustomer && (
        <div style={{ marginBottom: 24 }}>
          {myUpcomingBookings.length > 0 ? (
            <Card
              title={<span><CalendarOutlined style={{ color: '#0f8b8d', marginRight: 8 }} /> Lịch hẹn sắp tới của bé</span>}
              style={{ borderRadius: 16, marginBottom: 20 }}
            >
              <List
                dataSource={myUpcomingBookings}
                renderItem={(b) => (
                  <List.Item
                    actions={[
                      <Button type="primary" size="small" onClick={() => nav('/app/lich-hen')}>
                        Xem chi tiết
                      </Button>,
                    ]}
                  >
                    <List.Item.Meta
                      title={<Text strong style={{ fontSize: 15 }}>🐾 {b.pet_info?.name} — {b.package_name ? `Gói ${b.package_name}` : 'Dịch vụ lẻ'}</Text>}
                      description={
                        <Space wrap>
                          <Tag color="blue">{dayjs(b.start_at).format('HH:mm DD/MM/YYYY')}</Tag>
                          <Tag color="gold">{b.status}</Tag>
                          <Text type="secondary">KTV: {b.staff_name || 'Đang sắp xếp'}</Text>
                        </Space>
                      }
                    />
                  </List.Item>
                )}
              />
            </Card>
          ) : (
            <Card style={{ borderRadius: 16, marginBottom: 20, textAlign: 'center', padding: '16px 0' }}>
              <Paragraph style={{ fontSize: 16, margin: 0 }}>
                Bé cưng của bạn chưa có lịch hẹn nào sắp tới.
              </Paragraph>
              <Button type="primary" shape="round" icon={<PlusOutlined />} onClick={() => nav('/app/lich-hen')} style={{ marginTop: 12 }}>
                Đặt lịch spa cho bé ngay
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Thông tin cơ sở & Gói nổi bật */}
      <Row gutter={[16, 16]}>
        <Col xs={24} lg={10}>
          <Card title="Thông tin cơ sở & Giờ mở cửa" style={{ borderRadius: 16 }}>
            {spa.logo && <Image src={spa.logo} width={96} style={{ marginBottom: 12 }} />}
            <Descriptions column={1} size="small">
              <Descriptions.Item label="Điện thoại">{spa.phone || '0283000000'}</Descriptions.Item>
              <Descriptions.Item label="Email">{spa.email || 'lienhe@longmuot.example'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ">{spa.address}</Descriptions.Item>
              <Descriptions.Item label="Giờ mở cửa">
                {spa.open_time?.slice(0, 5)} – {spa.close_time?.slice(0, 5)}
              </Descriptions.Item>
              <Descriptions.Item label="Ngày mở cửa">{openDays}</Descriptions.Item>
              <Descriptions.Item label="Hạn hủy lịch">{spa.cancel_cutoff_hours} giờ trước giờ hẹn</Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        <Col xs={24} lg={14}>
          <Card
            title="Gói chăm sóc nổi bật"
            extra={<Button type="link" onClick={() => nav('/app/dich-vu')}>Xem tất cả dịch vụ</Button>}
            style={{ borderRadius: 16 }}
          >
            {packages.length === 0 ? (
              <Empty description="Chưa có gói nào." />
            ) : (
              <Row gutter={[12, 12]}>
                {packages.map((p) => (
                  <Col xs={24} md={12} key={p.id}>
                    <Card size="small" type="inner" title={p.name} style={{ borderRadius: 12 }}>
                      <Paragraph type="secondary" ellipsis={{ rows: 2 }} style={{ marginBottom: 8, minHeight: 40 }}>
                        {p.items?.map((i) => i.service_name).join(' · ')}
                      </Paragraph>
                      <Tag color="cyan">Từ {money(Math.min(...Object.values(p.prices || {})))}</Tag>
                    </Card>
                  </Col>
                ))}
              </Row>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}
