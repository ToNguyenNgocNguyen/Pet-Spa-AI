import { useEffect, useState, useMemo } from 'react'
import {
  Alert, Avatar, Badge, Button, Card, Col, DatePicker, Descriptions,
  Divider, Drawer, Empty, Progress, Radio, Row, Segmented, Skeleton,
  Space, Statistic, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  ArrowDownOutlined, ArrowUpOutlined, BankOutlined, BarChartOutlined,
  CalendarOutlined, CheckCircleFilled, CheckCircleOutlined, CloseCircleFilled,
  CreditCardOutlined, DollarOutlined, FireOutlined, LineChartOutlined,
  MinusCircleOutlined, PieChartOutlined, ReloadOutlined, RobotOutlined,
  SafetyCertificateOutlined, ShopOutlined, TeamOutlined, TrophyOutlined,
  UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, money } from '../api.js'
import RowPerPageSelect from '../components/RowPerPageSelect.jsx'

const { Title, Text, Paragraph } = Typography
const { RangePicker } = DatePicker

// Huy hiệu xếp hạng
const RANK_BADGES = {
  1: { text: '🥇 #1', color: '#faad14' },
  2: { text: '🥈 #2', color: '#8c8c8c' },
  3: { text: '🥉 #3', color: '#d46b08' },
}

export default function Analytics() {
  const [loading, setLoading] = useState(true)
  const [data, setData] = useState(null)

  // Bộ lọc thời gian: preset hoặc custom dates
  const [preset, setPreset] = useState('30days')
  const [dateRange, setDateRange] = useState([dayjs().subtract(29, 'day'), dayjs()])

  // Chế độ xem biểu đồ xu hướng: 'revenue' hoặc 'bookings'
  const [trendMetric, setTrendMetric] = useState('revenue')
  const [hoveredPoint, setHoveredPoint] = useState(null)

  // Phân trang cho các bảng
  const [servicePageSize, setServicePageSize] = useState(10)
  const [servicePage, setServicePage] = useState(1)

  const [packagePageSize, setPackagePageSize] = useState(10)
  const [packagePage, setPackagePage] = useState(1)

  const [staffPageSize, setStaffPageSize] = useState(10)
  const [staffPage, setStaffPage] = useState(1)

  // Drawer xem chi tiết
  const [selectedService, setSelectedService] = useState(null)
  const [selectedStaff, setSelectedStaff] = useState(null)

  // Hàm tải dữ liệu
  const loadAnalytics = async (customPreset, customRange) => {
    setLoading(true)
    try {
      const activePreset = customPreset !== undefined ? customPreset : preset
      const activeRange = customRange !== undefined ? customRange : dateRange

      const params = {}
      if (activePreset === 'custom' && activeRange?.[0] && activeRange?.[1]) {
        params.start_date = activeRange[0].format('YYYY-MM-DD')
        params.end_date = activeRange[1].format('YYYY-MM-DD')
      } else if (activePreset && activePreset !== 'custom') {
        params.preset = activePreset
      }

      const res = await api('/analytics/overview', { params })
      setData(res)

      // Cập nhật lại dateRange hiển thị theo khoảng ngày backend trả về nếu dùng preset
      if (res?.period && activePreset !== 'custom') {
        setDateRange([dayjs(res.period.start_date), dayjs(res.period.end_date)])
      }
    } catch (e) {
      message.error(e.message || 'Không thể tải số liệu thống kê.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAnalytics()
  }, [])

  // Xử lý đổi Preset nhanh
  const handlePresetChange = (e) => {
    const val = e.target.value
    setPreset(val)
    if (val === 'custom') return

    let r = null
    const today = dayjs()
    if (val === 'today') r = [today, today]
    else if (val === '7days') r = [today.subtract(6, 'day'), today]
    else if (val === '30days') r = [today.subtract(29, 'day'), today]
    else if (val === 'this_month') r = [today.startOf('month'), today]
    else if (val === 'last_month') {
      const lastMonth = today.subtract(1, 'month')
      r = [lastMonth.startOf('month'), lastMonth.endOf('month')]
    }
    if (r) setDateRange(r)
    loadAnalytics(val, r)
  }

  // Xử lý chọn khoảng ngày tùy chọn
  const handleRangeChange = (dates) => {
    if (!dates || !dates[0] || !dates[1]) return
    setDateRange(dates)
    setPreset('custom')
    loadAnalytics('custom', dates)
  }

  // Dữ liệu tài chính & booking
  const financial = data?.financial || {}
  const bookings = data?.bookings || {}
  const dailyTrend = data?.daily_trend || []
  const topServices = data?.top_services || []
  const topPackages = data?.top_packages || []
  const staffPerf = data?.staff_performance || []
  const insights = data?.insights || {}
  const aiRebook = data?.ai_rebook || {}

  // Tính toán biểu đồ SVG xu hướng
  const maxTrendVal = useMemo(() => {
    if (!dailyTrend.length) return 1
    const vals = dailyTrend.map((d) => (trendMetric === 'revenue' ? d.revenue : d.total_bookings))
    const max = Math.max(...vals, 1)
    return max
  }, [dailyTrend, trendMetric])

  // Cột bảng dịch vụ
  const serviceColumns = [
    {
      title: 'Hạng',
      key: 'rank',
      width: 75,
      align: 'center',
      render: (_, __, idx) => {
        const rank = (servicePage - 1) * servicePageSize + idx + 1
        const badge = RANK_BADGES[rank]
        return badge ? (
          <Tag color={badge.color} style={{ fontWeight: 700, margin: 0 }}>{badge.text}</Tag>
        ) : (
          <Text type="secondary" strong>#{rank}</Text>
        )
      },
    },
    {
      title: 'Tên Dịch Vụ',
      dataIndex: 'name',
      key: 'name',
      render: (t) => <Text strong style={{ color: '#0f8b8d', cursor: 'pointer' }}>{t}</Text>,
    },
    {
      title: 'Danh Mục',
      dataIndex: 'category',
      key: 'category',
      width: 140,
      render: (cat) => <Tag color="blue">{cat}</Tag>,
    },
    {
      title: 'Số Lượt Đặt',
      dataIndex: 'count',
      key: 'count',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.count - b.count,
      render: (c) => <Text strong>{c} lượt</Text>,
    },
    {
      title: 'Doanh Thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 160,
      align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: (rev) => <Text strong style={{ color: '#108ee9' }}>{money(rev)}</Text>,
    },
    {
      title: 'Tỷ Trọng Doanh Thu',
      key: 'pct',
      width: 180,
      render: (_, r) => {
        const total = financial.total_revenue || 1
        const pct = Math.min(100, Math.round((r.revenue / total) * 100))
        return (
          <Space orientation="vertical" size={2} style={{ width: '100%' }}>
            <Progress percent={pct} strokeColor="#0f8b8d" size="small" showInfo={false} />
            <Text type="secondary" style={{ fontSize: 12 }}>{pct}% tổng doanh thu</Text>
          </Space>
        )
      },
    },
  ]

  // Cột bảng gói combo
  const packageColumns = [
    {
      title: 'Hạng',
      key: 'rank',
      width: 75,
      align: 'center',
      render: (_, __, idx) => {
        const rank = (packagePage - 1) * packagePageSize + idx + 1
        const badge = RANK_BADGES[rank]
        return badge ? (
          <Tag color={badge.color} style={{ fontWeight: 700, margin: 0 }}>{badge.text}</Tag>
        ) : (
          <Text type="secondary" strong>#{rank}</Text>
        )
      },
    },
    {
      title: 'Tên Gói Combo',
      dataIndex: 'name',
      key: 'name',
      render: (t) => <Text strong style={{ color: '#0f8b8d' }}>{t}</Text>,
    },
    {
      title: 'Số Lượt Đăng Ký',
      dataIndex: 'count',
      key: 'count',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.count - b.count,
      render: (c) => <Text strong>{c} lượt</Text>,
    },
    {
      title: 'Doanh Thu Đem Lại',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 180,
      align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: (rev) => <Text strong style={{ color: '#52c41a' }}>{money(rev)}</Text>,
    },
  ]

  // Cột bảng nhân viên / KTV
  const staffColumns = [
    {
      title: 'Kỹ Thuật Viên / Nhân Sự',
      dataIndex: 'name',
      key: 'name',
      render: (t, r) => (
        <Space align="center" size={10} style={{ cursor: 'pointer' }}>
          <Avatar style={{ backgroundColor: '#0f8b8d', fontWeight: 600 }}>{t ? t[0] : 'S'}</Avatar>
          <div>
            <Text strong style={{ color: '#0f8b8d', display: 'block' }}>{t}</Text>
            {r.phone && <Text type="secondary" style={{ fontSize: 12 }}>{r.phone}</Text>}
          </div>
        </Space>
      ),
    },
    {
      title: 'Chuyên Môn',
      dataIndex: 'specialties',
      key: 'specialties',
      render: (specs) => (
        <Space wrap size={[0, 4]}>
          {specs?.length ? (
            specs.map((s) => <Tag key={s} color="cyan">{s}</Tag>)
          ) : (
            <Text type="secondary">Chưa gán</Text>
          )}
        </Space>
      ),
    },
    {
      title: 'Tổng Ca Được Giao',
      dataIndex: 'total_assigned',
      key: 'total_assigned',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.total_assigned - b.total_assigned,
      render: (c) => <Text strong>{c} ca</Text>,
    },
    {
      title: 'Đã Hoàn Tất',
      dataIndex: 'completed_count',
      key: 'completed_count',
      width: 130,
      align: 'right',
      sorter: (a, b) => a.completed_count - b.completed_count,
      render: (c) => <Text strong style={{ color: '#52c41a' }}>{c} ca</Text>,
    },
    {
      title: 'Tỷ Lệ Hoàn Thành',
      dataIndex: 'completion_rate',
      key: 'completion_rate',
      width: 160,
      sorter: (a, b) => a.completion_rate - b.completion_rate,
      render: (rate) => (
        <Space size={8} style={{ width: '100%' }}>
          <Progress
            percent={rate}
            size="small"
            strokeColor={rate >= 80 ? '#52c41a' : rate >= 50 ? '#faad14' : '#f5222d'}
            style={{ width: 80, margin: 0 }}
          />
          <Text strong style={{ fontSize: 12 }}>{rate}%</Text>
        </Space>
      ),
    },
    {
      title: 'Doanh Số Đóng Góp',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 170,
      align: 'right',
      sorter: (a, b) => a.revenue - b.revenue,
      render: (rev) => <Text strong style={{ color: '#0f8b8d' }}>{money(rev)}</Text>,
    },
  ]

  if (loading && !data) {
    return (
      <div style={{ padding: 24, maxWidth: 1400, margin: '0 auto' }}>
        <Skeleton active paragraph={{ rows: 12 }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 1400, margin: '0 auto', paddingBottom: 40 }}>
      {/* 1. Header & Bộ lọc thời gian */}
      <Card
        style={{
          marginBottom: 20,
          borderRadius: 16,
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
          border: '1px solid rgba(15,139,141,0.15)',
          background: 'linear-gradient(135deg, #ffffff 0%, #f7fcfa 100%)',
        }}
        styles={{ body: { padding: '20px 24px' } }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 }}>
          <div>
            <Space align="center" size={10}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: 'linear-gradient(135deg, #0f8b8d 0%, #20b2aa 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontSize: 22,
                  boxShadow: '0 4px 12px rgba(15,139,141,0.3)',
                }}
              >
                <BarChartOutlined />
              </div>
              <div>
                <Title level={3} style={{ margin: 0, color: '#134e4a', fontWeight: 700 }}>
                  Thống Kê & Báo Cáo Hoạt Động Spa
                </Title>
                <Text type="secondary" style={{ fontSize: 13 }}>
                  Theo dõi biến động doanh thu, công suất lịch hẹn, năng suất thợ và hiệu quả AI nhắc tái spa
                </Text>
              </div>
            </Space>
          </div>

          <Space wrap align="center" size={12}>
            <Radio.Group
              value={preset}
              onChange={handlePresetChange}
              buttonStyle="solid"
              size="middle"
            >
              <Radio.Button value="today">Hôm nay</Radio.Button>
              <Radio.Button value="7days">7 ngày</Radio.Button>
              <Radio.Button value="30days">30 ngày</Radio.Button>
              <Radio.Button value="this_month">Tháng này</Radio.Button>
              <Radio.Button value="last_month">Tháng trước</Radio.Button>
              <Radio.Button value="all_time">Toàn bộ</Radio.Button>
            </Radio.Group>

            <RangePicker
              value={dateRange}
              onChange={handleRangeChange}
              format="DD/MM/YYYY"
              allowClear={false}
              size="middle"
              style={{ width: 250 }}
            />

            <Button
              icon={<ReloadOutlined spin={loading} />}
              onClick={() => loadAnalytics()}
              loading={loading}
            >
              Làm mới
            </Button>
          </Space>
        </div>

        {data?.period && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed rgba(15,139,141,0.2)' }}>
            <Space split={<Divider type="vertical" />} size={12}>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Kỳ báo cáo: <Text strong style={{ color: '#0f8b8d' }}>
                  {dayjs(data.period.start_date).format('DD/MM/YYYY')} — {dayjs(data.period.end_date).format('DD/MM/YYYY')}
                </Text> ({data.period.days_count} ngày)
              </Text>
              <Text type="secondary" style={{ fontSize: 13 }}>
                Số hóa đơn đã thu: <Text strong>{financial.paid_invoices_count || 0}</Text>
              </Text>
              {financial.unpaid_count > 0 && (
                <Text type="danger" style={{ fontSize: 13 }}>
                  Có <Text strong type="danger">{financial.unpaid_count}</Text> hóa đơn chưa thanh toán ({money(financial.unpaid_total)})
                </Text>
              )}
            </Space>
          </div>
        )}
      </Card>

      {/* 2. Hàng Thẻ KPI Tổng quan */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* KPI 1: Doanh Thu */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              background: 'linear-gradient(135deg, #f0fdfa 0%, #ffffff 100%)',
              border: '1px solid #ccfbf1',
              height: '100%',
            }}
            styles={{ body: { padding: 20 } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  Tổng Doanh Thu Thực Thu
                </Text>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#0f8b8d', marginTop: 4 }}>
                  {money(financial.total_revenue || 0)}
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#e6fffa',
                  color: '#0f8b8d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                <DollarOutlined />
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #e6fffa' }}>
              <Space split={<Divider type="vertical" />} style={{ fontSize: 12 }}>
                <Text type="secondary">
                  TM: <Text strong>{money(financial.payment_methods?.cash?.total || 0)}</Text>
                </Text>
                <Text type="secondary">
                  CK: <Text strong>{money(financial.payment_methods?.transfer?.total || 0)}</Text>
                </Text>
              </Space>
            </div>
          </Card>
        </Col>

        {/* KPI 2: Lịch Hẹn & Công Suất */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              background: 'linear-gradient(135deg, #eff6ff 0%, #ffffff 100%)',
              border: '1px solid #dbeafe',
              height: '100%',
            }}
            styles={{ body: { padding: 20 } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  Tổng Lịch Hẹn Tiếp Nhận
                </Text>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#1d4ed8', marginTop: 4 }}>
                  {bookings.total || 0} <span style={{ fontSize: 15, fontWeight: 500, color: '#64748b' }}>lượt</span>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                <CalendarOutlined />
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #eff6ff' }}>
              <Space style={{ fontSize: 12, width: '100%', justifyContent: 'space-between' }}>
                <Text style={{ color: '#16a34a' }}>
                  <CheckCircleFilled /> Xong: {bookings.completed || 0} ({bookings.completion_rate}%)
                </Text>
                <Text style={{ color: '#dc2626' }}>
                  <CloseCircleFilled /> Hủy: {bookings.cancelled || 0}
                </Text>
              </Space>
            </div>
          </Card>
        </Col>

        {/* KPI 3: Giá Trị Đơn Trung Bình (AOV) */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              background: 'linear-gradient(135deg, #fffbeb 0%, #ffffff 100%)',
              border: '1px solid #fef3c7',
              height: '100%',
            }}
            styles={{ body: { padding: 20 } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  Giá Trị Trung Bình / Đơn
                </Text>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#d97706', marginTop: 4 }}>
                  {money(financial.average_order_value || 0)}
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#fef3c7',
                  color: '#d97706',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                <CreditCardOutlined />
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #fef3c7' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Dựa trên <Text strong>{financial.paid_invoices_count || 0}</Text> hóa đơn thanh toán
              </Text>
            </div>
          </Card>
        </Col>

        {/* KPI 4: Hiệu Quả AI Nhắc Tái Spa */}
        <Col xs={24} sm={12} lg={6}>
          <Card
            bordered={false}
            style={{
              borderRadius: 16,
              boxShadow: '0 4px 16px rgba(0,0,0,0.04)',
              background: 'linear-gradient(135deg, #faf5ff 0%, #ffffff 100%)',
              border: '1px solid #f3e8ff',
              height: '100%',
            }}
            styles={{ body: { padding: 20 } }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <Text type="secondary" style={{ fontSize: 13, textTransform: 'uppercase', letterSpacing: 0.5, fontWeight: 600 }}>
                  Hiệu Quả AI Nhắc Tái Spa
                </Text>
                <div style={{ fontSize: 24, fontWeight: 800, color: '#9333ea', marginTop: 4 }}>
                  {aiRebook.conversion_rate || 0}%
                  <span style={{ fontSize: 13, fontWeight: 500, color: '#64748b', marginLeft: 6 }}>
                    chuyển đổi
                  </span>
                </div>
              </div>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  backgroundColor: '#f3e8ff',
                  color: '#9333ea',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                }}
              >
                <RobotOutlined />
              </div>
            </div>
            <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px solid #faf5ff' }}>
              <Text type="secondary" style={{ fontSize: 12 }}>
                Đã đặt lại: <Text strong style={{ color: '#9333ea' }}>{aiRebook.total_booked || 0}</Text> / {aiRebook.total_sent || 0} đã gửi
              </Text>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 3. Khu vực Biểu Đồ Xu Hướng & Phân Bổ Kênh */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        {/* Biểu đồ xu hướng SVG */}
        <Col xs={24} lg={16}>
          <Card
            title={
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                <Space align="center">
                  <LineChartOutlined style={{ color: '#0f8b8d', fontSize: 18 }} />
                  <span style={{ fontWeight: 700 }}>Xu Hướng Hoạt Động Theo Ngày</span>
                </Space>
                <Segmented
                  value={trendMetric}
                  onChange={setTrendMetric}
                  options={[
                    { label: 'Doanh thu (VNĐ)', value: 'revenue' },
                    { label: 'Số lịch hẹn (Lượt)', value: 'bookings' },
                  ]}
                />
              </div>
            }
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            {dailyTrend.length === 0 ? (
              <Empty description="Chưa có dữ liệu xu hướng trong khoảng thời gian này" />
            ) : (
              <div>
                {/* Khu vực SVG Chart */}
                <div style={{ height: 240, position: 'relative', width: '100%', overflowX: 'auto', overflowY: 'hidden' }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'flex-end',
                      gap: dailyTrend.length > 20 ? 4 : 8,
                      height: 200,
                      paddingBottom: 24,
                      minWidth: Math.max(dailyTrend.length * (dailyTrend.length > 20 ? 22 : 36), 500),
                    }}
                  >
                    {dailyTrend.map((d, idx) => {
                      const val = trendMetric === 'revenue' ? d.revenue : d.total_bookings
                      const heightPercent = maxTrendVal > 0 ? Math.max((val / maxTrendVal) * 100, 4) : 4
                      const isHovered = hoveredPoint === idx

                      return (
                        <div
                          key={d.date}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            height: '100%',
                            justifyContent: 'flex-end',
                            position: 'relative',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={() => setHoveredPoint(idx)}
                          onMouseLeave={() => setHoveredPoint(null)}
                        >
                          {/* Tooltip khi hover */}
                          {isHovered && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: `${heightPercent + 10}%`,
                                backgroundColor: '#1f2937',
                                color: '#fff',
                                padding: '6px 10px',
                                borderRadius: 8,
                                fontSize: 11,
                                whiteSpace: 'nowrap',
                                zIndex: 10,
                                boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
                                pointerEvents: 'none',
                                transform: 'translateX(-50%)',
                                left: '50%',
                              }}
                            >
                              <div style={{ fontWeight: 700, color: '#38bdf8' }}>{d.date}</div>
                              <div>Doanh thu: {money(d.revenue)}</div>
                              <div>Lịch hẹn: {d.total_bookings} (Xong: {d.completed_bookings})</div>
                            </div>
                          )}

                          {/* Cột Bar */}
                          <div
                            style={{
                              width: '100%',
                              maxWidth: 32,
                              height: `${heightPercent}%`,
                              borderRadius: '6px 6px 0 0',
                              background: isHovered
                                ? 'linear-gradient(180deg, #20b2aa 0%, #0f8b8d 100%)'
                                : val > 0
                                ? 'linear-gradient(180deg, #0f8b8d 0%, #115e59 100%)'
                                : '#e2e8f0',
                              transition: 'all 0.2s ease',
                              boxShadow: isHovered ? '0 0 10px rgba(15,139,141,0.5)' : 'none',
                            }}
                          />

                          {/* Nhãn ngày */}
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 0,
                              fontSize: 10,
                              color: '#64748b',
                              whiteSpace: 'nowrap',
                              transform: 'scale(0.9)',
                            }}
                          >
                            {dailyTrend.length > 20 && idx % 3 !== 0 ? '' : d.display_date}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, paddingTop: 10, borderTop: '1px solid #f1f5f9' }}>
                  <Text type="secondary" style={{ fontSize: 12 }}>
                    💡 Rê chuột vào từng cột để xem chi tiết doanh thu và ca phục vụ của từng ngày
                  </Text>
                  <Space size={16}>
                    <Space size={6}>
                      <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: '#0f8b8d' }} />
                      <Text style={{ fontSize: 12 }}>{trendMetric === 'revenue' ? 'Doanh thu ngày' : 'Số ca đặt ngày'}</Text>
                    </Space>
                  </Space>
                </div>
              </div>
            )}
          </Card>
        </Col>

        {/* Cơ cấu Phương thức & Kênh tiếp nhận */}
        <Col xs={24} lg={8}>
          <Card
            title={
              <Space align="center">
                <PieChartOutlined style={{ color: '#0f8b8d', fontSize: 18 }} />
                <span style={{ fontWeight: 700 }}>Cơ Cấu Vận Hành</span>
              </Space>
            }
            bordered={false}
            style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.04)', height: '100%' }}
            styles={{ body: { padding: '20px 24px' } }}
          >
            {/* Phương thức thanh toán */}
            <div style={{ marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Phương thức thanh toán</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  Tổng: {money(financial.total_revenue || 0)}
                </Text>
              </div>

              {financial.total_revenue > 0 ? (
                <div>
                  <div style={{ display: 'flex', height: 14, borderRadius: 7, overflow: 'hidden', backgroundColor: '#f1f5f9', marginBottom: 8 }}>
                    <div
                      style={{
                        width: `${Math.round(((financial.payment_methods?.cash?.total || 0) / financial.total_revenue) * 100)}%`,
                        backgroundColor: '#0f8b8d',
                      }}
                      title="Tiền mặt"
                    />
                    <div
                      style={{
                        width: `${Math.round(((financial.payment_methods?.transfer?.total || 0) / financial.total_revenue) * 100)}%`,
                        backgroundColor: '#3b82f6',
                      }}
                      title="Chuyển khoản"
                    />
                  </div>
                  <Row gutter={8}>
                    <Col span={12}>
                      <div style={{ borderLeft: '3px solid #0f8b8d', paddingLeft: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Tiền mặt</Text>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#0f8b8d' }}>
                          {money(financial.payment_methods?.cash?.total || 0)}
                        </div>
                      </div>
                    </Col>
                    <Col span={12}>
                      <div style={{ borderLeft: '3px solid #3b82f6', paddingLeft: 8 }}>
                        <Text type="secondary" style={{ fontSize: 12 }}>Chuyển khoản</Text>
                        <div style={{ fontWeight: 700, fontSize: 13, color: '#3b82f6' }}>
                          {money(financial.payment_methods?.transfer?.total || 0)}
                        </div>
                      </div>
                    </Col>
                  </Row>
                </div>
              ) : (
                <Text type="secondary" style={{ fontSize: 12 }}>Chưa có hóa đơn thanh toán</Text>
              )}
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Phân bổ kênh đặt hẹn */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <Text strong style={{ fontSize: 13 }}>Kênh tiếp nhận lịch hẹn</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{bookings.total || 0} lịch</Text>
              </div>

              {bookings.channels?.map((ch) => {
                const total = bookings.total || 1
                const pct = Math.round((ch.count / total) * 100)
                const color = ch.channel === 'online' ? '#10b981' : ch.channel === 'counter' ? '#0f8b8d' : '#f59e0b'
                return (
                  <div key={ch.channel} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <Text>{ch.label}</Text>
                      <Text strong>{ch.count} ca ({pct}%)</Text>
                    </div>
                    <Progress percent={pct} strokeColor={color} size="small" showInfo={false} />
                  </div>
                )
              })}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 4. Tabs Phân Tích Chuyên Sâu */}
      <Card
        bordered={false}
        style={{ borderRadius: 16, boxShadow: '0 4px 16px rgba(0,0,0,0.04)' }}
        styles={{ body: { padding: 24 } }}
      >
        <Tabs
          defaultActiveKey="services"
          items={[
            {
              key: 'services',
              label: (
                <Space>
                  <TrophyOutlined />
                  <span>Top Dịch Vụ & Combo</span>
                  <Badge count={topServices.length} style={{ backgroundColor: '#0f8b8d' }} />
                </Space>
              ),
              children: (
                <div>
                  <Row gutter={[24, 24]}>
                    {/* Bảng Top Dịch Vụ */}
                    <Col xs={24} xl={15}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div>
                          <Text strong style={{ fontSize: 16, color: '#134e4a' }}>
                            Top Dịch Vụ Doanh Thu Cao Nhất
                          </Text>
                          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                            Bấm vào dòng để xem chi tiết
                          </Text>
                        </div>
                        <RowPerPageSelect
                          value={servicePageSize}
                          onChange={(v) => {
                            setServicePageSize(v)
                            setServicePage(1)
                          }}
                        />
                      </div>

                      <Table
                        columns={serviceColumns}
                        dataSource={topServices}
                        rowKey="id"
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        onRow={(record) => ({
                          onClick: () => setSelectedService(record),
                          style: { cursor: 'pointer' },
                        })}
                        pagination={{
                          current: servicePage,
                          pageSize: servicePageSize,
                          total: topServices.length,
                          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} dịch vụ`,
                          onChange: (p, ps) => {
                            setServicePage(p)
                            setServicePageSize(ps)
                          },
                        }}
                      />
                    </Col>

                    {/* Bảng Top Gói Combo */}
                    <Col xs={24} xl={9}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                        <div>
                          <Text strong style={{ fontSize: 16, color: '#134e4a' }}>
                            Gói Combo Được Chuộng Nhất
                          </Text>
                          <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                            Số lượt khách mua theo combo
                          </Text>
                        </div>
                        <RowPerPageSelect
                          value={packagePageSize}
                          onChange={(v) => {
                            setPackagePageSize(v)
                            setPackagePage(1)
                          }}
                        />
                      </div>

                      <Table
                        columns={packageColumns}
                        dataSource={topPackages}
                        rowKey="id"
                        size="middle"
                        scroll={{ x: 'max-content' }}
                        pagination={{
                          current: packagePage,
                          pageSize: packagePageSize,
                          total: topPackages.length,
                          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} gói`,
                          onChange: (p, ps) => {
                            setPackagePage(p)
                            setPackagePageSize(ps)
                          },
                        }}
                      />
                    </Col>
                  </Row>
                </div>
              ),
            },
            {
              key: 'staff',
              label: (
                <Space>
                  <TeamOutlined />
                  <span>Năng Suất Kỹ Thuật Viên</span>
                  <Badge count={staffPerf.length} style={{ backgroundColor: '#108ee9' }} />
                </Space>
              ),
              children: (
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                    <div>
                      <Text strong style={{ fontSize: 16, color: '#134e4a' }}>
                        Hiệu Suất Thực Hiện Ca Làm Việc Của Đội Ngũ KTV
                      </Text>
                      <Text type="secondary" style={{ display: 'block', fontSize: 12 }}>
                        Theo dõi số ca hoàn thành, tỷ lệ thành công và tổng doanh số mang lại theo từng nhân sự
                      </Text>
                    </div>
                    <RowPerPageSelect
                      value={staffPageSize}
                      onChange={(v) => {
                        setStaffPageSize(v)
                        setStaffPage(1)
                      }}
                    />
                  </div>

                  <Table
                    columns={staffColumns}
                    dataSource={staffPerf}
                    rowKey="id"
                    size="middle"
                    scroll={{ x: 'max-content' }}
                    onRow={(record) => ({
                      onClick: () => setSelectedStaff(record),
                      style: { cursor: 'pointer' },
                    })}
                    pagination={{
                      current: staffPage,
                      pageSize: staffPageSize,
                      total: staffPerf.length,
                      showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} nhân viên`,
                      onChange: (p, ps) => {
                        setStaffPage(p)
                        setStaffPageSize(ps)
                      },
                    }}
                  />
                </div>
              ),
            },
            {
              key: 'insights',
              label: (
                <Space>
                  <ShopOutlined />
                  <span>Cơ Cấu Khách Hàng & Bé Cưng</span>
                </Space>
              ),
              children: (
                <Row gutter={[24, 24]}>
                  {/* Khách hàng */}
                  <Col xs={24} md={12}>
                    <Card
                      title={<Text strong>Chỉ Số Khách Hàng</Text>}
                      bordered={false}
                      style={{ background: '#f8fafc', borderRadius: 12 }}
                    >
                      <Row gutter={16}>
                        <Col span={12}>
                          <Statistic
                            title="Khách Hàng Hoạt Động"
                            value={insights.active_clients || 0}
                            suffix="chủ nuôi"
                            valueStyle={{ color: '#0f8b8d', fontWeight: 700 }}
                          />
                        </Col>
                        <Col span={12}>
                          <Statistic
                            title="Khách Mới Trong Kỳ"
                            value={insights.new_clients || 0}
                            suffix="người"
                            valueStyle={{ color: '#10b981', fontWeight: 700 }}
                          />
                        </Col>
                      </Row>
                      <Divider style={{ margin: '16px 0' }} />
                      <Text type="secondary" style={{ fontSize: 13 }}>
                        💡 Tỷ lệ khách hàng quay lại chăm sóc đều đặn giúp tối ưu chi phí vận hành và tăng doanh thu bền vững.
                      </Text>
                    </Card>
                  </Col>

                  {/* Thú cưng */}
                  <Col xs={24} md={12}>
                    <Card
                      title={<Text strong>Cơ Cấu Thú Cưng Đã Chăm Sóc</Text>}
                      bordered={false}
                      style={{ background: '#f8fafc', borderRadius: 12 }}
                    >
                      <div style={{ marginBottom: 16 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <Text strong>Tỷ lệ Loài (Chó vs Mèo):</Text>
                          <Space size={12}>
                            <Text style={{ color: '#0f8b8d' }}>Chó: {insights.pets_by_species?.find((s) => s.species === 'dog')?.count || 0}</Text>
                            <Text style={{ color: '#f59e0b' }}>Mèo: {insights.pets_by_species?.find((s) => s.species === 'cat')?.count || 0}</Text>
                          </Space>
                        </div>
                        <Progress
                          percent={Math.round(
                            ((insights.pets_by_species?.find((s) => s.species === 'dog')?.count || 0) /
                              Math.max(
                                (insights.pets_by_species?.find((s) => s.species === 'dog')?.count || 0) +
                                  (insights.pets_by_species?.find((s) => s.species === 'cat')?.count || 0),
                                1
                              )) *
                              100
                          )}
                          success={{
                            percent: Math.round(
                              ((insights.pets_by_species?.find((s) => s.species === 'cat')?.count || 0) /
                                Math.max(
                                  (insights.pets_by_species?.find((s) => s.species === 'dog')?.count || 0) +
                                    (insights.pets_by_species?.find((s) => s.species === 'cat')?.count || 0),
                                  1
                                )) *
                                100
                            ),
                            strokeColor: '#f59e0b',
                          }}
                          strokeColor="#0f8b8d"
                          showInfo={false}
                        />
                      </div>

                      <Text strong style={{ display: 'block', marginBottom: 8 }}>Phân Bổ Kích Cỡ (Size):</Text>
                      <Row gutter={[8, 8]}>
                        {insights.pets_by_size?.map((sz) => (
                          <Col span={4} key={sz.size} style={{ textAlign: 'center' }}>
                            <div style={{ background: '#fff', padding: '8px 4px', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                              <Text strong style={{ color: '#0f8b8d' }}>{sz.size}</Text>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{sz.count}</div>
                            </div>
                          </Col>
                        ))}
                      </Row>
                    </Card>
                  </Col>
                </Row>
              ),
            },
            {
              key: 'ai_performance',
              label: (
                <Space>
                  <RobotOutlined />
                  <span>Hiệu Quả AI Nhắc Tái Hẹn</span>
                </Space>
              ),
              children: (
                <Card bordered={false} style={{ background: '#faf5ff', borderRadius: 12 }}>
                  <Row gutter={[24, 24]} align="middle">
                    <Col xs={24} md={12}>
                      <Title level={4} style={{ color: '#7e22ce', margin: 0 }}>
                        Trợ Lý Tự Động Phân Tích & Giữ Chân Khách Hàng
                      </Title>
                      <Paragraph type="secondary" style={{ marginTop: 8 }}>
                        Hệ thống tự động quét chu kỳ làm đẹp theo loại lông, giống thú cưng và các khuyến nghị an toàn để gửi lời nhắc đúng lúc cho chủ nuôi.
                      </Paragraph>

                      <Space direction="vertical" size={12} style={{ width: '100%', marginTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Lời nhắc đã tạo tự động:</Text>
                          <Text strong>{aiRebook.total_suggested || 0} lượt</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Lời nhắc đã được duyệt & gửi:</Text>
                          <Text strong>{aiRebook.total_sent || 0} tin nhắn</Text>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <Text>Khách hàng quay lại đặt lịch thành công:</Text>
                          <Text strong style={{ color: '#7e22ce' }}>{aiRebook.total_booked || 0} khách</Text>
                        </div>
                      </Space>
                    </Col>

                    <Col xs={24} md={12} style={{ textAlign: 'center' }}>
                      <div
                        style={{
                          background: '#fff',
                          padding: 24,
                          borderRadius: 16,
                          display: 'inline-block',
                          boxShadow: '0 4px 16px rgba(126,34,206,0.08)',
                        }}
                      >
                        <Progress
                          type="dashboard"
                          percent={aiRebook.conversion_rate || 0}
                          strokeColor={{ '0%': '#9333ea', '100%': '#a855f7' }}
                          format={(percent) => (
                            <div>
                              <div style={{ fontSize: 24, fontWeight: 800, color: '#7e22ce' }}>{percent}%</div>
                              <div style={{ fontSize: 12, color: '#64748b' }}>Chuyển đổi</div>
                            </div>
                          )}
                        />
                        <div style={{ marginTop: 8 }}>
                          <Text strong style={{ color: '#7e22ce' }}>Tỷ lệ tái hẹn thành công</Text>
                        </div>
                      </div>
                    </Col>
                  </Row>
                </Card>
              ),
            },
          ]}
        />
      </Card>

      {/* Drawer Xem Chi Tiết Dịch Vụ */}
      <Drawer
        title="Chi Tiết Thống Kê Dịch Vụ"
        open={Boolean(selectedService)}
        onClose={() => setSelectedService(null)}
        width={420}
      >
        {selectedService && (
          <div>
            <Title level={4} style={{ color: '#0f8b8d', marginTop: 0 }}>
              {selectedService.name}
            </Title>
            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Danh mục">
                <Tag color="blue">{selectedService.category}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Số lượt đặt">
                <Text strong>{selectedService.count} lượt</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng doanh thu tạo ra">
                <Text strong style={{ color: '#0f8b8d', fontSize: 15 }}>
                  {money(selectedService.revenue)}
                </Text>
              </Descriptions.Item>
              <Descriptions.Item label="Đóng góp vào doanh thu">
                <Text strong>
                  {Math.round((selectedService.revenue / Math.max(financial.total_revenue || 1, 1)) * 100)}%
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>

      {/* Drawer Xem Chi Tiết Kỹ Thuật Viên */}
      <Drawer
        title="Chi Tiết Năng Suất Kỹ Thuật Viên"
        open={Boolean(selectedStaff)}
        onClose={() => setSelectedStaff(null)}
        width={420}
      >
        {selectedStaff && (
          <div>
            <Space align="center" size={14} style={{ marginBottom: 16 }}>
              <Avatar size={48} style={{ backgroundColor: '#0f8b8d', fontSize: 20 }}>
                {selectedStaff.name ? selectedStaff.name[0] : 'S'}
              </Avatar>
              <div>
                <Title level={4} style={{ margin: 0, color: '#0f8b8d' }}>{selectedStaff.name}</Title>
                <Text type="secondary">{selectedStaff.phone || 'Chưa cập nhật SĐT'}</Text>
              </div>
            </Space>

            <Descriptions column={1} bordered size="small">
              <Descriptions.Item label="Chuyên môn">
                <Space wrap size={[0, 4]}>
                  {selectedStaff.specialties?.length ? (
                    selectedStaff.specialties.map((s) => <Tag key={s} color="cyan">{s}</Tag>)
                  ) : (
                    'Chưa cập nhật'
                  )}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="Tổng số ca được giao">
                <Text strong>{selectedStaff.total_assigned} ca</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ca hoàn tất thành công">
                <Text strong style={{ color: '#52c41a' }}>{selectedStaff.completed_count} ca</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Ca bị hủy">
                <Text strong style={{ color: '#f5222d' }}>{selectedStaff.cancelled_count} ca</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Tỷ lệ hoàn thành">
                <Text strong>{selectedStaff.completion_rate}%</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Doanh số đóng góp">
                <Text strong style={{ color: '#0f8b8d', fontSize: 16 }}>
                  {money(selectedStaff.revenue)}
                </Text>
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  )
}
