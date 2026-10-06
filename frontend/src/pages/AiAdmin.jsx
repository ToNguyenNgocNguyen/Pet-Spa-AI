import { useEffect, useState, useCallback } from 'react'
import {
  Alert, Button, Card, Col, Descriptions, Divider, Empty, Form, Input,
  InputNumber, Modal, Popconfirm, Row, Select, Space,
  Switch, Table, Tabs, Tag, Typography, message,
} from 'antd'
import {
  AlertOutlined, BookOutlined, CheckCircleOutlined,
  ClockCircleOutlined, DeleteOutlined, EditOutlined,
  FileTextOutlined, HistoryOutlined, PlusOutlined,
  ReloadOutlined, RobotOutlined, SafetyCertificateOutlined,
  ToolOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, unwrap } from '../api.js'
import RowPerPageSelect from '../components/RowPerPageSelect.jsx'

const { Title, Text, Paragraph } = Typography

// ==========================================
// TAB 1: MA TRẬN CHỐNG CHỈ ĐỊNH (CONTRAINDICATIONS)
// ==========================================
function ContraindicationsTab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [services, setServices] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailRule, setDetailRule] = useState(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const [res, svcs] = await Promise.all([
        api('/service-contraindications'),
        api('/services'),
      ])
      setData(unwrap(res))
      setServices(unwrap(svcs))
    } catch (e) {
      message.error(e.message || 'Không thể tải danh sách chống chỉ định')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await api('/service-contraindications', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      message.success('Đã thêm quy tắc chống chỉ định mới')
      setModalOpen(false)
      form.resetFields()
      loadData()
    } catch (e) {
      message.error(e.message || 'Lỗi khi lưu quy tắc')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api(`/service-contraindications/${id}`, { method: 'DELETE' })
      message.success('Đã xóa quy tắc')
      loadData()
    } catch (e) {
      message.error(e.message || 'Không thể xóa')
    }
  }

  const columns = [
    {
      title: 'Dịch vụ / Gói áp dụng',
      dataIndex: 'service_name',
      render: (v, r) => <strong>{v || `Dịch vụ #${r.service}`}</strong>,
    },
    {
      title: 'Điều kiện phát hiện',
      key: 'cond',
      render: (_, r) => (
        <div>
          <Tag color="purple">{r.condition_type}</Tag>
          <Text strong>{r.condition_value}</Text>
        </div>
      ),
    },
    {
      title: 'Mức độ',
      dataIndex: 'severity',
      render: (sev) =>
        sev === 'BLOCK' ? (
          <Tag color="red" icon={<SafetyCertificateOutlined />}>
            CẤM DÙNG (BLOCK)
          </Tag>
        ) : (
          <Tag color="orange" icon={<AlertOutlined />}>
            CẢNH BÁO (WARN)
          </Tag>
        ),
    },
    {
      title: 'Lý do & Hướng dẫn y tế',
      dataIndex: 'reason',
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 80,
      render: (_, r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title="Xóa quy tắc này?"
            onConfirm={() => handleDelete(r.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>
            Ma Trận An Toàn Hóa Chất & Sức Khỏe
          </Text>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Quy định các dịch vụ hoặc hóa chất cấm/cảnh báo đối với các bệnh lý, dị ứng hoặc giống thú đặc thù (Bấm vào dòng để xem chi tiết).
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields()
              setModalOpen(true)
            }}
            style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
          >
            Thêm chống chỉ định
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>💡 Bấm vào bất kỳ dòng nào để xem chi tiết quy tắc</Text>
        <RowPerPageSelect value={pageSize} onChange={(ps) => { setPageSize(ps); setPage(1); }} />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowClassName={() => 'clickable-row'}
        onRow={(record) => ({
          onClick: () => setDetailRule(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          position: ['bottomRight'],
          current: page,
          pageSize: pageSize,
          showSizeChanger: false,
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} quy tắc`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Modal xem chi tiết chống chỉ định */}
      <Modal
        centered
        open={!!detailRule}
        title="Chi Tiết Quy Tắc Chống Chỉ Định"
        footer={<Button onClick={() => setDetailRule(null)}>Đóng</Button>}
        onCancel={() => setDetailRule(null)}
      >
        {detailRule && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Dịch vụ liên quan">
              <strong style={{ color: '#0f8b8d' }}>{detailRule.service_name}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Mức độ an toàn">
              <Tag color={detailRule.severity === 'BLOCK' ? 'red' : 'gold'} style={{ fontWeight: 700 }}>
                {detailRule.severity === 'BLOCK' ? '🚫 CHẶN TUYỆT ĐỐI (BLOCK)' : '⚠️ CẢNH BÁO LƯU Ý (WARN)'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Loại điều kiện">{detailRule.condition_type}</Descriptions.Item>
            <Descriptions.Item label="Từ khóa / Giá trị so khớp">
              <Tag color="cyan">{detailRule.condition_value}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Thông điệp cảnh báo">
              <Alert
                type={detailRule.severity === 'BLOCK' ? 'error' : 'warning'}
                message={detailRule.warning_message}
                showIcon
              />
            </Descriptions.Item>
            <Descriptions.Item label="Lý do & Cơ sở khoa học">{detailRule.reason || '—'}</Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        centered
        open={modalOpen}
        title="Thêm Quy Tắc Chống Chỉ Định"
        onCancel={() => setModalOpen(false)}
        onOk={handleAdd}
        confirmLoading={submitting}
        okText="Lưu quy tắc"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" initialValues={{ severity: 'BLOCK', condition_type: 'allergy_keyword' }}>
          <Form.Item
            name="service"
            label="Dịch vụ áp dụng"
            rules={[{ required: true, message: 'Chọn dịch vụ' }]}
          >
            <Select
              showSearch
              placeholder="Chọn dịch vụ"
              filterOption={(input, opt) => (opt?.label ?? '').toLowerCase().includes(input.toLowerCase())}
              options={services.map((s) => ({ value: s.id, label: s.name }))}
            />
          </Form.Item>

          <Form.Item
            name="condition_type"
            label="Loại điều kiện phát hiện"
            rules={[{ required: true }]}
          >
            <Select
              options={[
                { value: 'allergy_keyword', label: 'Từ khóa dị ứng (allergy_note)' },
                { value: 'tag', label: 'Thẻ sức khỏe thú cưng (health_tags)' },
                { value: 'breed', label: 'Giống thú nhạy cảm' },
                { value: 'min_age_months', label: 'Tuổi tối thiểu (tháng)' },
                { value: 'max_age_months', label: 'Tuổi tối đa (tháng)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="condition_value"
            label="Giá trị phát hiện"
            rules={[{ required: true, message: 'Nhập giá trị phát hiện (ví dụ: hương liệu, mẫn cảm, Poodle...)' }]}
          >
            <Input placeholder="ví dụ: hương liệu, da mẫn cảm, tim mạch..." />
          </Form.Item>

          <Form.Item name="severity" label="Mức độ nghiêm trọng" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'BLOCK', label: 'BLOCK — Cấm tuyệt đối (Loại khỏi danh sách đề xuất)' },
                { value: 'WARN', label: 'WARN — Cảnh báo (Trừ điểm đề xuất & nhắc KTV chú ý)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="reason"
            label="Lý do y khoa / Cảnh báo hiển thị"
            rules={[{ required: true, message: 'Nhập lý do giải thích' }]}
          >
            <Input.TextArea rows={3} placeholder="Mô tả rủi ro y khoa nếu dùng hóa chất này trên thú cưng..." />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ==========================================
// TAB 2: LUẬT CHU KỲ TÁI SPA (REBOOK RULES)
// ==========================================
function RebookRulesTab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [packages, setPackages] = useState([])
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailRule, setDetailRule] = useState(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const [res, pkgs] = await Promise.all([
        api('/rebook-rules'),
        api('/packages'),
      ])
      setData(unwrap(res))
      setPackages(unwrap(pkgs))
    } catch (e) {
      message.error(e.message || 'Không thể tải luật chu kỳ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await api('/rebook-rules', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      message.success('Đã thêm quy tắc chu kỳ mới')
      setModalOpen(false)
      form.resetFields()
      loadData()
    } catch (e) {
      message.error(e.message || 'Lỗi khi lưu quy tắc')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api(`/rebook-rules/${id}`, { method: 'DELETE' })
      message.success('Đã xóa quy tắc')
      loadData()
    } catch (e) {
      message.error(e.message || 'Không thể xóa')
    }
  }

  const columns = [
    {
      title: 'Tên quy tắc',
      dataIndex: 'name',
      render: (v) => <strong>{v}</strong>,
    },
    {
      title: 'Đối tượng áp dụng',
      key: 'target',
      render: (_, r) => (
        <Space wrap>
          <Tag color="blue">{r.species === 'all' ? 'Tất cả loài' : r.species === 'dog' ? 'Chó' : 'Mèo'}</Tag>
          <Tag color="cyan">Lông: {r.coat_type || 'Tất cả'}</Tag>
        </Space>
      ),
    },
    {
      title: 'Chu kỳ',
      dataIndex: 'cycle_days',
      render: (days) => <Tag color="orange" style={{ fontWeight: 600 }}>{days} ngày</Tag>,
    },
    {
      title: 'Gói chăm sóc mặc định',
      dataIndex: 'suggested_package_name',
      render: (v) => v || 'Gói Chăm Sóc Định Kỳ',
    },
    {
      title: 'Lý do SOP',
      dataIndex: 'reason_template',
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      render: (act) => (
        <Tag color={act ? 'green' : 'default'}>
          {act ? 'Đang hoạt động' : 'Tạm tắt'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 80,
      render: (_, r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title="Xóa quy tắc này?"
            onConfirm={() => handleDelete(r.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>
            Bộ Luật Chu Kỳ Tái Spa Định Kỳ
          </Text>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Hệ thống dựa vào các quy tắc này để quét tự động lịch spa cũ và sinh thông báo mời tái spa (Bấm vào dòng để xem chi tiết).
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields()
              setModalOpen(true)
            }}
            style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
          >
            Thêm luật chu kỳ
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>💡 Bấm vào bất kỳ dòng nào để xem chi tiết luật chu kỳ</Text>
        <RowPerPageSelect value={pageSize} onChange={(ps) => { setPageSize(ps); setPage(1); }} />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowClassName={() => 'clickable-row'}
        onRow={(record) => ({
          onClick: () => setDetailRule(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          position: ['bottomRight'],
          current: page,
          pageSize: pageSize,
          showSizeChanger: false,
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} luật chu kỳ`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Modal xem chi tiết luật chu kỳ */}
      <Modal
        centered
        open={!!detailRule}
        title="Chi Tiết Luật Chu Kỳ Tái Spa"
        footer={<Button onClick={() => setDetailRule(null)}>Đóng</Button>}
        onCancel={() => setDetailRule(null)}
      >
        {detailRule && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Tên quy tắc luật">
              <strong style={{ color: '#0f8b8d' }}>{detailRule.name}</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Loài áp dụng">{detailRule.species === 'all' ? 'Tất cả' : detailRule.species}</Descriptions.Item>
            <Descriptions.Item label="Loại lông">{detailRule.coat_type === 'all' ? 'Tất cả' : detailRule.coat_type}</Descriptions.Item>
            <Descriptions.Item label="Chu kỳ đề xuất">
              <Tag color="cyan" style={{ fontWeight: 700 }}>Mỗi {detailRule.cycle_days} ngày</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Gói combo liên kết">{detailRule.suggested_package_name || '—'}</Descriptions.Item>
            <Descriptions.Item label="Lý do AI giải thích">{detailRule.reason_template || '—'}</Descriptions.Item>
            <Descriptions.Item label="Trạng thái">
              <Tag color={detailRule.is_active ? 'green' : 'default'}>
                {detailRule.is_active ? 'Đang kích hoạt' : 'Tạm ngưng'}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>

      <Modal
        centered
        open={modalOpen}
        title="Thêm Luật Chu Kỳ Tái Spa"
        onCancel={() => setModalOpen(false)}
        onOk={handleAdd}
        confirmLoading={submitting}
        okText="Lưu luật"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical" initialValues={{ species: 'all', coat_type: 'all', cycle_days: 14, is_active: true }}>
          <Form.Item name="name" label="Tên quy tắc" rules={[{ required: true, message: 'Nhập tên quy tắc' }]}>
            <Input placeholder="ví dụ: Chó lông dài định kỳ 2 tuần..." />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="species" label="Loài áp dụng" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'all', label: 'Tất cả loài' },
                    { value: 'dog', label: 'Chó' },
                    { value: 'cat', label: 'Mèo' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="coat_type" label="Loại lông" rules={[{ required: true }]}>
                <Select
                  options={[
                    { value: 'all', label: 'Tất cả loại lông' },
                    { value: 'short', label: 'Lông ngắn' },
                    { value: 'long', label: 'Lông dài' },
                    { value: 'curly', label: 'Lông xoăn' },
                    { value: 'double', label: 'Lông kép' },
                    { value: 'hairless', label: 'Không lông' },
                  ]}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="cycle_days" label="Số ngày chu kỳ" rules={[{ required: true }]}>
                <InputNumber min={1} max={365} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="suggested_package" label="Gói đề xuất mặc định">
                <Select
                  placeholder="Chọn gói"
                  allowClear
                  options={packages.map((p) => ({ value: p.id, label: p.name }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="reason_template" label="Lý do SOP hiển thị cho khách" rules={[{ required: true }]}>
            <Input.TextArea rows={2} placeholder="ví dụ: Giống lông dài cần chải và tắm dưỡng để tránh vón cục rối..." />
          </Form.Item>

          <Form.Item name="is_active" valuePropName="checked">
            <Switch checkedChildren="Kích hoạt" unCheckedChildren="Tắt" defaultChecked />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

// ==========================================
// TAB 3: CƠ SỞ TRI THỨC SOP (KNOWLEDGE BASE)
// ==========================================
function KnowledgeBaseTab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [modalOpen, setModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [detailDoc, setDetailDoc] = useState(null)
  const [form] = Form.useForm()

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api('/ai/knowledge-docs')
      setData(unwrap(res))
    } catch (e) {
      message.error(e.message || 'Không thể tải kho tri thức')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleAdd = async () => {
    try {
      const values = await form.validateFields()
      setSubmitting(true)
      await api('/ai/knowledge-docs', {
        method: 'POST',
        body: JSON.stringify(values),
      })
      message.success('Đã tải tài liệu vào kho tri thức AI')
      setModalOpen(false)
      form.resetFields()
      loadData()
    } catch (e) {
      message.error(e.message || 'Lỗi khi lưu tài liệu')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (id) => {
    try {
      await api(`/ai/knowledge-docs/${id}`, { method: 'DELETE' })
      message.success('Đã xóa tài liệu')
      loadData()
    } catch (e) {
      message.error(e.message || 'Không thể xóa tài liệu')
    }
  }

  const columns = [
    {
      title: 'Tiêu đề tài liệu',
      dataIndex: 'title',
      render: (v) => <strong>{v}</strong>,
    },
    {
      title: 'Phân loại',
      dataIndex: 'doc_type',
      render: (dt) => {
        const colors = { sop: 'blue', price: 'green', policy: 'purple', safety: 'red', faq: 'cyan' }
        return <Tag color={colors[dt] || 'default'}>{dt?.toUpperCase()}</Tag>
      },
    },
    {
      title: 'Số đoạn tri thức (Chunks)',
      key: 'chunks',
      render: (_, r) => <Tag color="geekblue">{r.chunks?.length || 0} chunks</Tag>,
    },
    {
      title: 'Cập nhật lần cuối',
      dataIndex: 'updated_at',
      render: (d) => (d ? dayjs(d).format('DD/MM/YYYY HH:mm') : '—'),
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 140,
      render: (_, r) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button size="small" onClick={(e) => { e.stopPropagation(); setDetailDoc(r) }}>
            Xem Chunks
          </Button>
          <Popconfirm
            title="Xóa tài liệu này khỏi kho tri thức?"
            onConfirm={() => handleDelete(r.id)}
            okText="Xóa"
            cancelText="Hủy"
          >
            <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>
            Kho Tài Liệu Tri Thức & Quy Trình SOP Cho Chatbot AI
          </Text>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Nguồn dữ liệu trích xuất chính thức để Trợ lý AI giải đáp thắc mắc và trích dẫn chuẩn xác (Bấm vào dòng để xem chi tiết đoạn tri thức).
          </div>
        </div>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={loadData}>
            Làm mới
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => {
              form.resetFields()
              setModalOpen(true)
            }}
            style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
          >
            Thêm tài liệu mới
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>💡 Bấm vào bất kỳ tài liệu nào để xem các phân đoạn (chunks)</Text>
        <RowPerPageSelect value={pageSize} onChange={(ps) => { setPageSize(ps); setPage(1); }} />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowClassName={() => 'clickable-row'}
        onRow={(record) => ({
          onClick: () => setDetailDoc(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          position: ['bottomRight'],
          current: page,
          pageSize: pageSize,
          showSizeChanger: false,
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} tài liệu`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Modal thêm tài liệu */}
      <Modal
        centered
        open={modalOpen}
        title="Nạp Tài Liệu Tri Thức Mới"
        onCancel={() => setModalOpen(false)}
        onOk={handleAdd}
        confirmLoading={submitting}
        okText="Nạp vào AI"
        cancelText="Hủy"
        width={680}
      >
        <Form form={form} layout="vertical" initialValues={{ doc_type: 'sop' }}>
          <Form.Item name="title" label="Tiêu đề tài liệu" rules={[{ required: true }]}>
            <Input placeholder="ví dụ: Quy trình SOP Tắm trị liệu da mẫn cảm 2026..." />
          </Form.Item>

          <Form.Item name="doc_type" label="Phân loại" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'sop', label: 'SOP — Quy trình vận hành kỹ thuật' },
                { value: 'price', label: 'Bảng giá & Quy định size' },
                { value: 'policy', label: 'Chính sách hoàn hủy & cam kết' },
                { value: 'safety', label: 'An toàn y tế & Sơ cứu cơ bản' },
                { value: 'faq', label: 'Hỏi đáp thường gặp (FAQ)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="content"
            label="Nội dung văn bản (Hệ thống sẽ tự động tách chunks & đánh chỉ mục từ khóa)"
            rules={[{ required: true, message: 'Nhập nội dung tài liệu' }]}
          >
            <Input.TextArea rows={8} placeholder="Dán nội dung tài liệu SOP hoặc chính sách tại đây..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Modal xem chi tiết các chunks */}
      <Modal
        centered
        open={!!detailDoc}
        title={`Tri thức trích xuất: ${detailDoc?.title}`}
        onCancel={() => setDetailDoc(null)}
        footer={[
          <Button key="close" onClick={() => setDetailDoc(null)}>
            Đóng
          </Button>,
        ]}
        width={720}
      >
        {detailDoc?.chunks && detailDoc.chunks.length > 0 ? (
          <Space orientation="vertical" style={{ width: '100%' }} size="middle">
            {detailDoc.chunks.map((chk, i) => (
              <Card size="small" key={chk.id || i} style={{ background: '#f8fafc', borderRadius: 8 }}>
                <Text strong style={{ color: '#0f8b8d' }}>
                  Chunk #{i + 1}
                </Text>
                <div style={{ marginTop: 4, whiteSpace: 'pre-line', fontSize: 13 }}>
                  {chk.chunk_text}
                </div>
                {chk.keywords && chk.keywords.length > 0 && (
                  <div style={{ marginTop: 8 }}>
                    <Text type="secondary" style={{ fontSize: 11 }}>Từ khóa: </Text>
                    {chk.keywords.map((kw, ki) => (
                      <Tag color="cyan" key={ki} style={{ fontSize: 11 }}>
                        {kw}
                      </Tag>
                    ))}
                  </div>
                )}
              </Card>
            ))}
          </Space>
        ) : (
          <Empty description="Tài liệu chưa có chunk nào" />
        )}
      </Modal>
    </div>
  )
}

// ==========================================
// TAB 4: NHẬT KÝ HOẠT ĐỘNG AI (AUDIT LOGS)
// ==========================================
function AiLogsTab() {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [detailLog, setDetailLog] = useState(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await api('/ai/logs')
      setData(unwrap(res))
    } catch (e) {
      message.error(e.message || 'Không thể tải nhật ký AI')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const columns = [
    {
      title: 'Thời gian',
      dataIndex: 'created_at',
      width: 150,
      render: (d) => (d ? dayjs(d).format('DD/MM/YYYY HH:mm:ss') : '—'),
    },
    {
      title: 'Tác vụ AI',
      dataIndex: 'action_type',
      width: 170,
      render: (act) => {
        const map = {
          package_suggestion: { label: 'Gợi ý gói chăm sóc', color: 'blue' },
          staff_suggestion: { label: 'Gợi ý KTV phù hợp', color: 'purple' },
          rebook_reminder: { label: 'Quét nhắc tái spa', color: 'orange' },
          chat_faq: { label: 'Hỏi đáp tri thức SOP', color: 'cyan' },
        }
        const item = map[act] || { label: act, color: 'default' }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'user_name',
      width: 140,
      render: (u) => u || 'Khách vãng lai',
    },
    {
      title: 'Input tóm tắt',
      dataIndex: 'input_summary',
      render: (txt) => <Text style={{ fontSize: 12 }}>{txt || '—'}</Text>,
    },
    {
      title: 'Kết quả / Phản hồi',
      dataIndex: 'output_summary',
      render: (txt) => <Text style={{ fontSize: 12, color: '#334155' }}>{txt || '—'}</Text>,
    },
    {
      title: 'Thời gian xử lý',
      dataIndex: 'latency_ms',
      width: 110,
      render: (ms) => (ms ? <Tag color="geekblue">{ms}ms</Tag> : '—'),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <Text strong style={{ fontSize: 16 }}>
            Nhật Ký Hoạt Động & Kiểm Soát Minh Bạch AI
          </Text>
          <div style={{ fontSize: 13, color: '#64748b' }}>
            Toàn bộ các yêu cầu gợi ý gói, gợi ý kỹ thuật viên, câu hỏi chatbot đều được ghi log để kiểm tra (Bấm vào dòng để xem chi tiết log).
          </div>
        </div>
        <Button icon={<ReloadOutlined />} onClick={loadData}>
          Làm mới
        </Button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <Text type="secondary" style={{ fontSize: 13 }}>💡 Bấm vào bất kỳ dòng nào để xem chi tiết bản ghi nhật ký AI</Text>
        <RowPerPageSelect value={pageSize} onChange={(ps) => { setPageSize(ps); setPage(1); }} />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowClassName={() => 'clickable-row'}
        onRow={(record) => ({
          onClick: () => setDetailLog(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          position: ['bottomRight'],
          current: page,
          pageSize: pageSize,
          showSizeChanger: false,
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} bản ghi`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Modal xem chi tiết nhật ký AI log */}
      <Modal
        centered
        open={!!detailLog}
        title="Chi Tiết Bản Ghi Nhật Ký AI"
        footer={<Button onClick={() => setDetailLog(null)}>Đóng</Button>}
        onCancel={() => setDetailLog(null)}
        width={640}
      >
        {detailLog && (
          <Descriptions bordered column={1} size="small">
            <Descriptions.Item label="Thời gian gọi">
              {detailLog.created_at ? dayjs(detailLog.created_at).format('DD/MM/YYYY HH:mm:ss') : '—'}
            </Descriptions.Item>
            <Descriptions.Item label="Loại chức năng AI">
              <Tag color="cyan">{detailLog.action_type}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Người thực hiện">
              {detailLog.user_name || 'Khách vãng lai'}
            </Descriptions.Item>
            <Descriptions.Item label="Độ trễ xử lý (Latency)">
              <strong>{detailLog.latency_ms || 0} ms</strong>
            </Descriptions.Item>
            <Descriptions.Item label="Dữ liệu đầu vào (Input Context)">
              <div style={{ maxHeight: 160, overflowY: 'auto', background: '#f8fafc', padding: 8, borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap' }}>
                {detailLog.input_summary || detailLog.prompt || '—'}
              </div>
            </Descriptions.Item>
            <Descriptions.Item label="Phản hồi từ AI (Output)">
              <div style={{ maxHeight: 200, overflowY: 'auto', background: '#f0fdfa', padding: 8, borderRadius: 6, fontSize: 12, whiteSpace: 'pre-wrap', color: '#0f766e' }}>
                {detailLog.output_summary || detailLog.response || '—'}
              </div>
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  )
}

// ==========================================
// MÀN HÌNH CHÍNH QUẢN TRỊ AI
// ==========================================
export default function AiAdmin() {
  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0b3d3f' }}>
          <RobotOutlined style={{ marginRight: 8, color: '#0f8b8d' }} />
          Trung Tâm Quản Trị AI & Tri Thức Spa
        </Title>
        <Text type="secondary">
          Kiểm soát toàn diện các luật logic chuyên gia (R1-R7), ma trận an toàn hóa chất và kho tri thức SOP.
        </Text>
      </div>

      <Card style={{ borderRadius: 10 }}>
        <Tabs
          defaultActiveKey="contraindications"
          items={[
            {
              key: 'contraindications',
              label: (
                <span>
                  <SafetyCertificateOutlined /> Ma Trận Chống Chỉ Định
                </span>
              ),
              children: <ContraindicationsTab />,
            },
            {
              key: 'rules',
              label: (
                <span>
                  <ToolOutlined /> Luật Chu Kỳ Tái Spa
                </span>
              ),
              children: <RebookRulesTab />,
            },
            {
              key: 'knowledge',
              label: (
                <span>
                  <BookOutlined /> Kho Tri Thức SOP (Chatbot)
                </span>
              ),
              children: <KnowledgeBaseTab />,
            },
            {
              key: 'logs',
              label: (
                <span>
                  <HistoryOutlined /> Nhật Ký Hoạt Động AI
                </span>
              ),
              children: <AiLogsTab />,
            },
          ]}
        />
      </Card>
    </div>
  )
}
