import { useEffect, useState, useCallback } from 'react'
import {
  Alert, Badge, Button, Card, Col, Descriptions, Divider, Drawer, Empty, Input,
  Modal, Popconfirm, Row, Select, Space, Statistic, Table, Tag,
  Tooltip, Typography, message,
} from 'antd'
import {
  BellOutlined, CalendarOutlined, CheckCircleOutlined,
  ClockCircleOutlined, CloseCircleOutlined, CustomerServiceOutlined,
  EyeOutlined, FilterOutlined, HistoryOutlined, ReloadOutlined, RobotOutlined,
  SearchOutlined, SendOutlined, SyncOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api, money, unwrap } from '../api.js'
import { useAuth } from '../auth.jsx'
import RowPerPageSelect from '../components/RowPerPageSelect.jsx'

const { Title, Text, Paragraph } = Typography

const STATUS_TAGS = {
  suggested: { label: 'Chờ duyệt', color: 'gold' },
  approved: { label: 'Đã duyệt', color: 'blue' },
  sent: { label: 'Đã gửi thông báo', color: 'cyan' },
  booked: { label: 'Đã đặt lại lịch', color: 'green' },
  dismissed: { label: 'Đã bỏ qua', color: 'default' },
}

export default function RebookReminders() {
  const { user } = useAuth()
  const nav = useNavigate()
  const isCustomer = user?.role === 'customer'
  const isStaff = ['receptionist', 'manager'].includes(user?.role)

  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [reminders, setReminders] = useState([])
  const [statusFilter, setStatusFilter] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [scanning, setScanning] = useState(false)
  const [actionLoadingId, setActionLoadingId] = useState(null)
  const [detailReminder, setDetailReminder] = useState(null)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.append('status', statusFilter)
      const res = await api(`/rebook-reminders?${params.toString()}`)
      setReminders(unwrap(res))
    } catch (e) {
      message.error(e.message || 'Không thể tải danh sách nhắc tái spa')
    } finally {
      setLoading(false)
    }
  }, [statusFilter])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Quét và sinh nhắc mới
  const handleGenerate = async () => {
    setScanning(true)
    try {
      const res = await api('/rebook-reminders/generate', { method: 'POST' })
      message.success(
        res.created_count > 0
          ? `Đã phân tích xong: Tạo mới ${res.created_count} lời nhắc tái spa!`
          : 'Đã quét xong: Chưa có thú cưng nào đến chu kỳ tái spa mới.'
      )
      loadData()
    } catch (e) {
      message.error(e.message || 'Không thể quét nhắc tái spa')
    } finally {
      setScanning(false)
    }
  }

  // Duyệt và gửi thông báo
  const handleApprove = async (id) => {
    setActionLoadingId(id)
    try {
      await api(`/rebook-reminders/${id}/approve`, { method: 'POST' })
      message.success('Đã duyệt và gửi thông báo nhắc lịch cho khách hàng!')
      loadData()
    } catch (e) {
      message.error(e.message || 'Không thể duyệt nhắc nhở')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Bỏ qua
  const handleDismiss = async (id) => {
    setActionLoadingId(id)
    try {
      await api(`/rebook-reminders/${id}/dismiss`, { method: 'POST' })
      message.info('Đã bỏ qua lời nhắc này.')
      loadData()
    } catch (e) {
      message.error(e.message || 'Không thể bỏ qua nhắc nhở')
    } finally {
      setActionLoadingId(null)
    }
  }

  // Thống kê nhanh
  const counts = {
    all: reminders.length,
    suggested: reminders.filter((r) => r.status === 'suggested').length,
    sent: reminders.filter((r) => ['approved', 'sent'].includes(r.status)).length,
    booked: reminders.filter((r) => r.status === 'booked').length,
  }

  // Lọc tìm kiếm
  const filteredReminders = reminders.filter((r) => {
    if (!searchQuery) return true
    const q = searchQuery.toLowerCase()
    return (
      (r.pet_name && r.pet_name.toLowerCase().includes(q)) ||
      (r.client_name && r.client_name.toLowerCase().includes(q)) ||
      (r.client_phone && r.client_phone.includes(q)) ||
      (r.suggested_package_name && r.suggested_package_name.toLowerCase().includes(q))
    )
  })

  const columns = [
    {
      title: 'Thú cưng',
      key: 'pet',
      render: (_, r) => (
        <div>
          <Text strong style={{ fontSize: 15, color: '#0b3d3f' }}>
            🐾 {r.pet_name || `Bé #${r.pet}`}
          </Text>
          {r.pet_info && (
            <div style={{ fontSize: 12, color: '#64748b' }}>
              {r.pet_info.species === 'dog' ? 'Chó' : 'Mèo'} · {r.pet_info.breed || '—'} ({r.pet_info.weight_kg}kg)
            </div>
          )}
        </div>
      ),
    },
    ...(!isCustomer
      ? [
          {
            title: 'Khách hàng',
            key: 'client',
            render: (_, r) => (
              <div>
                <Text strong>{r.client_name || 'Khách vãng lai'}</Text>
                {r.client_phone && (
                  <div style={{ fontSize: 12, color: '#64748b' }}>
                    📞 {r.client_phone}
                  </div>
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      title: 'Lần spa gần nhất',
      dataIndex: 'last_booking_date',
      render: (d) => (
        <div>
          <div>{d ? dayjs(d).format('DD/MM/YYYY') : 'Chưa có'}</div>
          {d && (
            <Text type="secondary" style={{ fontSize: 11 }}>
              ({dayjs().diff(dayjs(d), 'day')} ngày trước)
            </Text>
          )}
        </div>
      ),
    },
    {
      title: 'Gói chăm sóc đề xuất (AI)',
      key: 'pkg',
      render: (_, r) => (
        <div>
          <Tag color="cyan" style={{ fontWeight: 600, fontSize: 13, padding: '2px 8px' }}>
            {r.suggested_package_name || 'Gói Chăm Sóc Định Kỳ'}
          </Tag>
          {r.suggested_package_price && (
            <div style={{ fontSize: 12, color: '#d97706', fontWeight: 600, marginTop: 4 }}>
              {money(r.suggested_package_price)}
            </div>
          )}
          <div style={{ fontSize: 12, color: '#475569', marginTop: 4, maxWidth: 280 }}>
            💡 {r.reason || 'Đến hạn chu kỳ chăm sóc lông da định kỳ'}
          </div>
        </div>
      ),
    },
    {
      title: 'Hạn chu kỳ',
      key: 'due',
      render: (_, r) => {
        const isOverdue = r.days_overdue > 0
        return (
          <div>
            <Tag color={isOverdue ? 'red' : 'orange'}>
              Chu kỳ {r.cycle_days || 14} ngày
            </Tag>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              {isOverdue ? (
                <Text type="danger" strong>
                  Quá hạn {r.days_overdue} ngày
                </Text>
              ) : (
                <Text type="secondary">
                  Đến hạn: {r.due_date ? dayjs(r.due_date).format('DD/MM/YYYY') : 'Hôm nay'}
                </Text>
              )}
            </div>
          </div>
        )
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      render: (st) => {
        const item = STATUS_TAGS[st] || { label: st, color: 'default' }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, r) => (
        <Space wrap onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={(e) => { e.stopPropagation(); setDetailReminder(r) }}
          >
            Chi tiết
          </Button>

          {isStaff && r.status === 'suggested' && (
            <>
              <Button
                type="primary"
                size="small"
                icon={<SendOutlined />}
                loading={actionLoadingId === r.id}
                onClick={(e) => { e.stopPropagation(); handleApprove(r.id) }}
                style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
              >
                Duyệt & Gửi
              </Button>
              <Popconfirm
                title="Bỏ qua nhắc nhở này?"
                onConfirm={() => handleDismiss(r.id)}
                okText="Bỏ qua"
                cancelText="Hủy"
              >
                <Button size="small" danger icon={<CloseCircleOutlined />} onClick={(e) => e.stopPropagation()} />
              </Popconfirm>
            </>
          )}

          {isCustomer && ['suggested', 'approved', 'sent'].includes(r.status) && (
            <Button
              type="primary"
              size="small"
              icon={<CalendarOutlined />}
              onClick={(e) => { e.stopPropagation(); nav('/app/lich-hen') }}
              style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
            >
              Đặt lịch ngay
            </Button>
          )}

          {r.status === 'booked' && (
            <Tag color="green" icon={<CheckCircleOutlined />}>
              Khách đã đặt lại
            </Tag>
          )}
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0b3d3f' }}>
            <RobotOutlined style={{ marginRight: 8, color: '#0f8b8d' }} />
            {isCustomer ? 'Nhắc Tái Spa Cho Thú Cưng' : 'Quản Lý Nhắc Tái Spa Định Kỳ (AI)'}
          </Title>
          <Text type="secondary">
            {isCustomer
              ? 'Lịch sử và khuyến nghị chu kỳ chăm sóc tối ưu để các bé luôn sạch sẽ, thơm tho và khỏe mạnh.'
              : 'AI tự động tính toán chu kỳ theo giống, lông và lần làm trước để nhắc khách đặt lại, tăng tỷ lệ quay lại.'}
          </Text>
        </div>

        {isStaff && (
          <Space>
            <Button
              type="primary"
              icon={<SyncOutlined spin={scanning} />}
              loading={scanning}
              onClick={handleGenerate}
              style={{ background: '#0f8b8d', borderColor: '#0f8b8d', fontWeight: 600 }}
            >
              Quét & Sinh Nhắc Mới
            </Button>
            <Button icon={<ReloadOutlined />} onClick={loadData}>
              Làm mới
            </Button>
          </Space>
        )}
      </div>

      {/* Thống kê cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 20 }}>
        <Col span={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Tổng lượt nhắc"
              value={counts.all}
              prefix={<BellOutlined style={{ color: '#0f8b8d' }} />}
            />
          </Card>
        </Col>
        <Col span={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Chờ duyệt gửi"
              value={counts.suggested}
              valueStyle={{ color: '#d97706' }}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Đã gửi thông báo"
              value={counts.sent}
              valueStyle={{ color: '#0284c7' }}
              prefix={<SendOutlined />}
            />
          </Card>
        </Col>
        <Col span={12} sm={6}>
          <Card size="small" style={{ borderRadius: 8 }}>
            <Statistic
              title="Khách đã đặt lại"
              value={counts.booked}
              valueStyle={{ color: '#16a34a' }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>

      {/* Bộ lọc & Tìm kiếm */}
      <Card size="small" style={{ marginBottom: 16, borderRadius: 8 }}>
        <Row gutter={[16, 12]} align="middle">
          <Col span={24} md={10}>
            <Input
              prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
              placeholder="Tìm theo tên bé, chủ nuôi hoặc số điện thoại..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              allowClear
            />
          </Col>
          <Col span={24} md={8}>
            <Select
              style={{ width: '100%' }}
              placeholder="Lọc theo trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: '', label: 'Tất cả trạng thái' },
                { value: 'suggested', label: 'Chờ duyệt (Suggested)' },
                { value: 'approved', label: 'Đã duyệt (Approved)' },
                { value: 'sent', label: 'Đã gửi thông báo (Sent)' },
                { value: 'booked', label: 'Đã đặt lại lịch (Booked)' },
                { value: 'dismissed', label: 'Đã bỏ qua (Dismissed)' },
              ]}
            />
          </Col>
          <Col span={24} md={6} style={{ textAlign: 'right' }}>
            <Text type="secondary">
              Hiển thị: <strong>{filteredReminders.length}</strong> kết quả
            </Text>
          </Col>
        </Row>
      </Card>

      {/* Thanh tùy chọn & số dòng hiển thị */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, marginTop: 16, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>💡 Bấm vào bất kỳ dòng nào để xem chi tiết phân tích AI & gửi tin</Text>
        <RowPerPageSelect value={pageSize} onChange={(ps) => { setPageSize(ps); setPage(1); }} />
      </div>

      {/* Bảng danh sách */}
      <Table
        rowKey="id"
        loading={loading}
        dataSource={filteredReminders}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowClassName={() => 'clickable-row'}
        onRow={(record) => ({
          onClick: () => setDetailReminder(record),
          style: { cursor: 'pointer' },
        })}
        locale={{
          emptyText: (
            <Empty
              description="Chưa có lời nhắc tái spa nào."
              image={Empty.PRESENTED_IMAGE_SIMPLE}
            >
              {isStaff && (
                <Button type="primary" onClick={handleGenerate}>
                  Quét tự động ngay
                </Button>
              )}
            </Empty>
          ),
        }}
        pagination={{
          position: ['bottomRight'],
          current: page,
          pageSize: pageSize,
          showSizeChanger: false,
          showTotal: (t, range) => `${range[0]}-${range[1]} / ${t} lời nhắc`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* ===== DRAWER XEM CHI TIẾT NHẮC TÁI SPA ===== */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <HistoryOutlined style={{ color: '#0f8b8d', fontSize: 20 }} />
            <div>
              <Typography.Text strong style={{ fontSize: 16 }}>
                Chi tiết nhắc tái spa: {detailReminder?.pet_name}
              </Typography.Text>
              <div>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                  Mã nhắc nhở: #{detailReminder?.id}
                </Typography.Text>
              </div>
            </div>
          </div>
        }
        open={!!detailReminder}
        onClose={() => setDetailReminder(null)}
        width={540}
        extra={
          <Space>
            {isStaff && detailReminder?.status === 'suggested' && (
              <Button
                type="primary"
                icon={<SendOutlined />}
                loading={actionLoadingId === detailReminder?.id}
                onClick={() => {
                  const id = detailReminder?.id
                  handleApprove(id)
                  setDetailReminder(null)
                }}
                style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
              >
                Duyệt & Gửi
              </Button>
            )}
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => {
                const petId = detailReminder?.pet
                setDetailReminder(null)
                nav(`/app/lich-hen?pet=${petId}`)
              }}
              style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
            >
              Đặt lịch hẹn
            </Button>
          </Space>
        }
      >
        {detailReminder && (
          <div>
            <Descriptions bordered column={1} size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Thú cưng">
                <Typography.Link onClick={() => { setDetailReminder(null); nav(`/app/thu-cung?q=${detailReminder.pet_name}`) }}>
                  🐾 <strong>{detailReminder.pet_name}</strong> ({detailReminder.pet_breed || 'Chưa rõ giống'} · Size {detailReminder.pet_size || '—'})
                </Typography.Link>
              </Descriptions.Item>
              <Descriptions.Item label="Chủ nuôi">
                <Typography.Link onClick={() => { setDetailReminder(null); nav(`/app/khach-hang?q=${detailReminder.client_name}`) }}>
                  👤 <strong>{detailReminder.client_name}</strong> {detailReminder.client_phone ? `(${detailReminder.client_phone})` : ''}
                </Typography.Link>
              </Descriptions.Item>
              <Descriptions.Item label="Trạng thái">
                <Tag color={STATUS_TAGS[detailReminder.status]?.color}>
                  {STATUS_TAGS[detailReminder.status]?.label}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Gói dịch vụ AI đề xuất">
                <strong style={{ color: '#0f8b8d', fontSize: 15 }}>
                  {detailReminder.suggested_package_name || 'Gói Chăm Sóc Định Kỳ'}
                </strong>
                {detailReminder.suggested_package_price && (
                  <div style={{ color: '#d97706', fontWeight: 600, marginTop: 2 }}>
                    Giá niêm yết: {money(detailReminder.suggested_package_price)}
                  </div>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Lý do AI phân tích">
                <div style={{ whiteSpace: 'pre-wrap' }}>
                  💡 {detailReminder.reason || 'Đến hạn chu kỳ chăm sóc lông da định kỳ theo khuyến nghị chuyên gia.'}
                </div>
              </Descriptions.Item>
              <Descriptions.Item label="Chu kỳ chăm sóc chuẩn">
                <Tag color="cyan">Mỗi {detailReminder.cycle_days || 14} ngày</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Tình trạng quá hạn">
                {detailReminder.days_overdue > 0 ? (
                  <Text type="danger" strong>
                    Quá hạn {detailReminder.days_overdue} ngày (Hạn tái spa: {dayjs(detailReminder.due_date).format('DD/MM/YYYY')})
                  </Text>
                ) : (
                  <Text type="success">
                    Đến hạn hôm nay ({dayjs(detailReminder.due_date).format('DD/MM/YYYY')})
                  </Text>
                )}
              </Descriptions.Item>
              <Descriptions.Item label="Lịch hẹn gần nhất">
                {detailReminder.last_booking_date ? (
                  <span>Lịch #{detailReminder.last_booking} vào ngày {dayjs(detailReminder.last_booking_date).format('DD/MM/YYYY')}</span>
                ) : (
                  <Text type="secondary">Chưa có thông tin lịch hẹn cũ</Text>
                )}
              </Descriptions.Item>
            </Descriptions>
          </div>
        )}
      </Drawer>
    </div>
  )
}
