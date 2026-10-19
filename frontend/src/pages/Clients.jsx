import { useCallback, useEffect, useState } from 'react'
import {
  Alert, App, Avatar, Badge, Button, Card, Col, Descriptions,
  Divider, Drawer, Empty, Form, Input, InputNumber, Modal,
  Popconfirm, Row, Select, Space, Switch, Table, Tag, Tooltip,
  Typography,
} from 'antd'
import {
  CalendarOutlined, DeleteOutlined, DollarOutlined, EditOutlined,
  EyeOutlined, HistoryOutlined, IdcardOutlined, LockOutlined, MedicineBoxOutlined,
  PlusOutlined, RobotOutlined, ThunderboltOutlined, UserOutlined,
} from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api, money, toFormErrors, unwrap } from '../api.js'
import RowPerPageSelect from '../components/RowPerPageSelect.jsx'
import AiPackageModal from '../components/AiPackageModal.jsx'

const { Title, Text, Paragraph } = Typography

const SOURCE = {
  walk_in: 'Đến quầy',
  online: 'Đăng ký web',
  referral: 'Giới thiệu',
  other: 'Khác',
}

const SPECIES = { dog: 'Chó', cat: 'Mèo' }
const COAT = { short: 'Lông ngắn', long: 'Lông dài', curly: 'Lông xoăn', double: 'Lông kép', hairless: 'Không lông' }
const SEX = { male: 'Đực', female: 'Cái', unknown: 'Chưa rõ' }

export default function Clients() {
  const { message } = App.useApp()
  const nav = useNavigate()
  const [form] = Form.useForm()
  const [petForm] = Form.useForm()

  const [data, setData] = useState({ results: [], count: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)

  // Modal sửa/thêm khách
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)

  // Modal đổi mật khẩu khách
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetClient, setResetClient] = useState(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetForm] = Form.useForm()

  // Drawer chi tiết khách & danh sách thú cưng của khách
  const [detailClient, setDetailClient] = useState(null)
  const [clientPets, setClientPets] = useState([])
  const [loadingPets, setLoadingPets] = useState(false)

  // Modal thêm nhanh thú cưng cho khách
  const [addPetClient, setAddPetClient] = useState(null)
  const [busyPet, setBusyPet] = useState(false)
  const [healthTags, setHealthTags] = useState([])

  // AI Modal
  const [aiPet, setAiPet] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await api('/clients', { params: { page, page_size: pageSize, q } })
      setData(res)
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, q])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    api('/health-tags').then((t) => setHealthTags(unwrap(t))).catch(() => {})
  }, [])

  useEffect(() => {
    if (editing) {
      form.setFieldsValue({
        source: 'walk_in',
        allow_reminders: true,
        ...editing,
      })
    } else {
      form.resetFields()
    }
  }, [editing, form])

  // Tự động sinh mật khẩu ngẫu nhiên an toàn
  const generateRandomPassword = () => {
    const prefixes = ['PetSpa', 'SpaAI', 'HappyPet', 'PawsCare', 'ProGroom', 'SpaVet']
    const symbols = ['@', '#', '$', '!']
    const randPrefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const randSym = symbols[Math.floor(Math.random() * symbols.length)]
    const randNum = Math.floor(1000 + Math.random() * 9000)
    const genPass = `${randPrefix}${randSym}${randNum}`
    resetForm.setFieldsValue({
      new_password: genPass,
      confirm_password: genPass,
    })
    navigator.clipboard?.writeText(genPass)
    message.success(`Đã tạo mật khẩu an toàn: ${genPass} (Đã sao chép vào bộ nhớ tạm)`)
  }

  // Đặt lại mật khẩu cho khách có tài khoản
  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields()
      setResetBusy(true)
      await api(`/auth/users/${resetClient.user_id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: values.new_password }),
      })
      message.success(`Đã đặt lại mật khẩu cho khách hàng ${resetClient.full_name}!`)
      setResetModalOpen(false)
      resetForm.resetFields()
    } catch (e) {
      const fields = toFormErrors(e)
      if (fields.length) resetForm.setFields(fields)
      message.error(e.message || 'Lỗi khi đặt lại mật khẩu')
    } finally {
      setResetBusy(false)
    }
  }

  // Mở Drawer chi tiết khách hàng và nạp thú cưng
  const openDetailDrawer = async (client) => {
    setDetailClient(client)
    setLoadingPets(true)
    try {
      const res = await api('/pets', { params: { client_id: client.id } })
      // Nếu API không filter client_id, ta lọc thủ công hoặc dùng client.pets
      const list = unwrap(res).filter((p) => p.client === client.id)
      setClientPets(list.length > 0 ? list : client.pets || [])
    } catch {
      setClientPets(client.pets || [])
    } finally {
      setLoadingPets(false)
    }
  }

  // Lưu khách hàng
  const save = async () => {
    const values = await form.validateFields()
    setBusy(true)
    try {
      if (editing?.id) {
        await api(`/clients/${editing.id}`, { method: 'PATCH', body: values })
      } else {
        await api('/clients', { method: 'POST', body: values })
      }
      message.success('Đã lưu hồ sơ khách hàng.')
      setEditing(null)
      load()
    } catch (e) {
      form.setFields(toFormErrors(e))
      if (!e.fields || !Object.keys(e.fields).length) message.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  // Ẩn khách
  const hide = async (id) => {
    await api(`/clients/${id}`, { method: 'DELETE' })
    message.success('Đã ẩn khách hàng.')
    load()
  }

  // Thêm nhanh thú cưng cho khách
  const handleOpenAddPet = (client) => {
    setAddPetClient(client)
    petForm.resetFields()
    petForm.setFieldsValue({
      species: 'dog',
      coat_type: 'short',
      sex: 'male',
      allergy_note: 'Không',
      weight_kg: 5.0,
    })
  }

  const handleSavePet = async () => {
    try {
      const values = await petForm.validateFields()
      setBusyPet(true)
      await api('/pets', {
        method: 'POST',
        body: {
          ...values,
          client: addPetClient.id,
          birth_date: values.birth_date ? dayjs(values.birth_date).format('YYYY-MM-DD') : null,
        },
      })
      message.success(`Đã thêm bé ${values.name} cho khách ${addPetClient.full_name}!`)
      setAddPetClient(null)
      load()
      if (detailClient && detailClient.id === addPetClient.id) {
        openDetailDrawer(detailClient)
      }
    } catch (e) {
      petForm.setFields(toFormErrors(e))
      message.error(e.message || 'Lỗi khi tạo hồ sơ thú cưng')
    } finally {
      setBusyPet(false)
    }
  }

  const columns = [
    {
      title: 'Khách hàng',
      key: 'name',
      render: (_, r) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Avatar style={{ background: '#0f8b8d' }} icon={<UserOutlined />} />
            <div>
              <Text strong style={{ fontSize: 15, color: '#0b3d3f' }}>{r.full_name}</Text>
              <div style={{ fontSize: 13, color: '#475569' }}>📞 {r.phone}</div>
            </div>
          </div>
          {r.address && <div style={{ fontSize: 12, color: '#64748b', marginTop: 4 }}>📍 {r.address}</div>}
        </div>
      ),
    },
    {
      title: 'Nguồn & Tùy chọn',
      key: 'opt',
      width: 140,
      render: (_, r) => (
        <Space direction="vertical" size={2}>
          <Tag color="cyan">{SOURCE[r.source] || r.source}</Tag>
          {r.allow_reminders ? (
            <Tag color="green">Nhận nhắc spa</Tag>
          ) : (
            <Tag color="default">Từ chối nhắc</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Thú cưng sở hữu (Bấm để xem/đặt lịch)',
      key: 'pets',
      render: (_, r) => {
        const pets = r.pets || []
        return (
          <div>
            {pets.length > 0 ? (
              <Space wrap size={[6, 6]}>
                {pets.map((p) => (
                  <Tooltip key={p.id} title={`${p.species === 'dog' ? 'Chó' : 'Mèo'} · ${p.breed || 'Chưa rõ giống'} · ${p.weight_kg}kg. Bấm để xem chi tiết`}>
                    <Tag
                      color="geekblue"
                      style={{ cursor: 'pointer', padding: '3px 8px', fontSize: 13, borderRadius: 4 }}
                      onClick={() => openDetailDrawer(r)}
                    >
                      🐾 <strong>{p.name}</strong> ({p.species === 'dog' ? 'Chó' : 'Mèo'}{p.size_class ? ` · Size ${p.size_class}` : ''})
                    </Tag>
                  </Tooltip>
                ))}
              </Space>
            ) : (
              <Text type="secondary" style={{ fontSize: 12, fontStyle: 'italic' }}>Chưa đăng ký bé nào</Text>
            )}

            <div style={{ marginTop: 6 }}>
              <Button
                type="link"
                size="small"
                icon={<PlusOutlined />}
                onClick={() => handleOpenAddPet(r)}
                style={{ padding: 0, height: 'auto', fontSize: 12, color: '#0f8b8d' }}
              >
                + Thêm thú cưng
              </Button>
            </div>
          </div>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'a',
      width: 260,
      render: (_, r) => (
        <Space wrap onClick={(e) => e.stopPropagation()}>
          <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); openDetailDrawer(r) }}>
            Xem thú ({r.pets?.length || r.pet_count || 0})
          </Button>
          <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setEditing(r) }}>
            Sửa
          </Button>
          {r.user_id ? (
            <Button
              size="small"
              icon={<LockOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                setResetClient(r)
                resetForm.resetFields()
                setResetModalOpen(true)
              }}
              title="Đặt lại mật khẩu cho khách này"
            >
              Đổi MK
            </Button>
          ) : (
            <Tooltip title="Khách chỉ tạo hồ sơ tại quầy, chưa đăng ký tài khoản web">
              <Tag color="default" style={{ margin: 0 }}>Tại quầy</Tag>
            </Tooltip>
          )}
          <Button
            size="small"
            icon={<CalendarOutlined />}
            onClick={(e) => { e.stopPropagation(); nav(`/app/lich-hen?q=${r.phone || r.full_name}`) }}
            title="Xem các lịch hẹn của khách này"
          >
            Lịch
          </Button>
          <Button
            size="small"
            icon={<DollarOutlined />}
            onClick={(e) => { e.stopPropagation(); nav(`/app/hoa-don?q=${r.phone || r.full_name}`) }}
            title="Xem các hóa đơn của khách này"
          >
            Hóa đơn
          </Button>
          <Popconfirm title="Ẩn khách hàng này?" okText="Ẩn" cancelText="Hủy" onConfirm={() => hide(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <Title level={3} style={{ margin: 0, color: '#0b3d3f' }}>Hồ Sơ Khách Hàng</Title>
          <Text type="secondary">Quản lý danh sách chủ nuôi và liên kết chặt chẽ với từng bé thú cưng sở hữu (Bấm vào dòng để xem chi tiết)</Text>
        </div>
        <Space>
          <Input.Search
            placeholder="Tìm theo tên hoặc số điện thoại..."
            allowClear
            style={{ width: 300 }}
            onSearch={(v) => { setPage(1); setQ(v) }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => setEditing({})}
            style={{ background: '#0f8b8d', borderColor: '#0f8b8d', fontWeight: 600 }}
          >
            Thêm khách hàng
          </Button>
        </Space>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>💡 Bấm vào bất kỳ dòng nào để xem hồ sơ chi tiết</Typography.Text>
        <RowPerPageSelect value={pageSize} onChange={(ps) => { setPageSize(ps); setPage(1); }} />
      </div>

      <Table
        rowKey="id"
        loading={loading}
        dataSource={data.results}
        columns={columns}
        scroll={{ x: 'max-content' }}
        rowClassName={() => 'clickable-row'}
        onRow={(record) => ({
          onClick: () => openDetailDrawer(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          position: ['bottomRight'],
          current: page,
          total: data.count,
          pageSize: pageSize,
          showSizeChanger: false,
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} khách hàng`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* ===== DRAWER XEM CHI TIẾT KHÁCH HÀNG & THÚ CƯNG ===== */}
      <Drawer
        title={
          <Space>
            <UserOutlined style={{ color: '#0f8b8d' }} />
            <span>Hồ sơ khách: {detailClient?.full_name}</span>
          </Space>
        }
        open={!!detailClient}
        onClose={() => setDetailClient(null)}
        width={680}
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenAddPet(detailClient)}
            style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
          >
            Thêm bé cưng cho khách
          </Button>
        }
      >
        {detailClient && (
          <div>
            {/* Thông tin liên hệ */}
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Họ tên" span={2}>
                <Text strong style={{ fontSize: 16, color: '#0b3d3f' }}>{detailClient.full_name}</Text>
              </Descriptions.Item>
              <Descriptions.Item label="Số điện thoại">📞 {detailClient.phone}</Descriptions.Item>
              <Descriptions.Item label="Email">{detailClient.email || '—'}</Descriptions.Item>
              <Descriptions.Item label="Địa chỉ" span={2}>{detailClient.address || '—'}</Descriptions.Item>
              <Descriptions.Item label="Nguồn đến">{SOURCE[detailClient.source] || detailClient.source}</Descriptions.Item>
              <Descriptions.Item label="Nhận nhắc spa">
                {detailClient.allow_reminders ? <Tag color="green">Có</Tag> : <Tag color="default">Không</Tag>}
              </Descriptions.Item>
              {detailClient.note && (
                <Descriptions.Item label="Ghi chú nội bộ" span={2}>{detailClient.note}</Descriptions.Item>
              )}
            </Descriptions>

            {/* Các liên kết nhanh */}
            <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => {
                  setDetailClient(null)
                  nav(`/app/lich-hen?q=${detailClient.phone || detailClient.full_name}`)
                }}
              >
                Xem tất cả lịch hẹn của khách
              </Button>
              <Button
                icon={<DollarOutlined />}
                onClick={() => {
                  setDetailClient(null)
                  nav(`/app/hoa-don?q=${detailClient.phone || detailClient.full_name}`)
                }}
              >
                Xem tất cả hóa đơn của khách
              </Button>
            </div>

            <Divider orientation="left" style={{ margin: '16px 0' }}>
              <Space>
                <IdcardOutlined style={{ color: '#0f8b8d' }} />
                <span style={{ fontWeight: 600 }}>Danh sách thú cưng của khách ({clientPets.length})</span>
              </Space>
            </Divider>

            {clientPets.length === 0 ? (
              <Empty description="Khách hàng này chưa có thú cưng nào trong hệ thống.">
                <Button type="primary" onClick={() => handleOpenAddPet(detailClient)}>
                  Đăng ký thú cưng ngay
                </Button>
              </Empty>
            ) : (
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {clientPets.map((p) => (
                  <Card
                    key={p.id}
                    size="small"
                    style={{
                      borderRadius: 8,
                      border: '1px solid #cbd5e1',
                      background: '#fff',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.04)',
                    }}
                  >
                    <Row gutter={[16, 8]} align="middle">
                      <Col span={24} sm={15}>
                        <Space align="center" wrap>
                          <Text strong style={{ fontSize: 16, color: '#0f766e' }}>🐾 {p.name}</Text>
                          <Tag color="cyan">{p.species === 'dog' ? 'Chó' : 'Mèo'}{p.breed ? ` · ${p.breed}` : ''}</Tag>
                          <Tag color="blue">{p.weight_kg} kg (Size {p.size_class || '—'})</Tag>
                          {p.coat_type && <Tag color="geekblue">Lông: {COAT[p.coat_type] || p.coat_type}</Tag>}
                        </Space>
                        {p.allergy_note && (
                          <div style={{ marginTop: 6, fontSize: 12 }}>
                            <Text type="secondary">Dị ứng: </Text>
                            <Text type="danger" strong>{p.allergy_note}</Text>
                          </div>
                        )}
                      </Col>

                      <Col span={24} sm={9} style={{ textAlign: 'right' }}>
                        <Space wrap>
                          <Button
                            type="primary"
                            size="small"
                            icon={<CalendarOutlined />}
                            onClick={() => {
                              setDetailClient(null)
                              nav(`/app/lich-hen?pet=${p.id}`)
                            }}
                            style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
                          >
                            Đặt lịch
                          </Button>
                          <Button
                            size="small"
                            icon={<RobotOutlined />}
                            onClick={() => setAiPet(p)}
                            style={{ borderColor: '#0f8b8d', color: '#0f8b8d' }}
                          >
                            AI Gợi ý gói
                          </Button>
                        </Space>
                      </Col>
                    </Row>
                  </Card>
                ))}
              </Space>
            )}
          </div>
        )}
      </Drawer>

      {/* ===== MODAL SỬA/THÊM KHÁCH HÀNG ===== */}
      <Modal
        centered
        open={!!editing}
        title={editing?.id ? 'Sửa thông tin khách hàng' : 'Thêm khách hàng mới'}
        onCancel={() => setEditing(null)}
        onOk={save}
        okText="Lưu"
        cancelText="Hủy"
        confirmLoading={busy}
        destroyOnHidden
      >
        <Form form={form} layout="vertical">
          <Form.Item name="full_name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
            <Input placeholder="ví dụ: Nguyễn Văn A" />
          </Form.Item>
          <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
            <Input placeholder="ví dụ: 0901234567" />
          </Form.Item>
          <Form.Item name="email" label="Email" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
            <Input placeholder="ví dụ: a@gmail.com" />
          </Form.Item>
          <Form.Item name="address" label="Địa chỉ">
            <Input placeholder="ví dụ: 123 Đường ABC, Quận 1" />
          </Form.Item>
          <Form.Item name="source" label="Nguồn đến">
            <Select options={Object.entries(SOURCE).map(([value, label]) => ({ value, label }))} />
          </Form.Item>
          <Form.Item name="allow_reminders" label="Nhận nhắc tái spa định kỳ" valuePropName="checked">
            <Switch defaultChecked />
          </Form.Item>
          <Form.Item name="note" label="Ghi chú nội bộ">
            <Input.TextArea rows={3} placeholder="Ghi chú tính cách, yêu cầu đặc biệt của khách..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== MODAL THÊM NHANH THÚ CƯNG CHO KHÁCH ===== */}
      <Modal
        centered
        open={!!addPetClient}
        title={`Thêm thú cưng cho khách: ${addPetClient?.full_name}`}
        onCancel={() => setAddPetClient(null)}
        onOk={handleSavePet}
        okText="Thêm bé cưng"
        cancelText="Hủy"
        confirmLoading={busyPet}
        width={600}
        destroyOnHidden
      >
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
          message="Nhập chính xác cân nặng và dị ứng để hệ thống xác định đúng Size và ma trận chống chỉ định."
        />
        <Form form={petForm} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="name" label="Tên thú cưng" rules={[{ required: true, message: 'Nhập tên thú' }]}>
                <Input placeholder="ví dụ: Lu, Bơ, Milo..." />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="species" label="Loài" rules={[{ required: true }]}>
                <Select options={[{ value: 'dog', label: 'Chó' }, { value: 'cat', label: 'Mèo' }]} />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="sex" label="Giới tính">
                <Select options={[{ value: 'male', label: 'Đực' }, { value: 'female', label: 'Cái' }]} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="breed" label="Giống thú">
                <Input placeholder="ví dụ: Poodle, Corgi, Mèo Anh..." />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="coat_type" label="Loại lông">
                <Select options={Object.entries(COAT).map(([value, label]) => ({ value, label }))} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="weight_kg" label="Cân nặng (kg)" rules={[{ required: true, message: 'Nhập cân nặng' }]}>
                <InputNumber min={0.1} step={0.1} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="allergy_note" label='Dị ứng (ghi "Không" nếu không có)' rules={[{ required: true, message: 'Bắt buộc ghi dị ứng' }]}>
                <Input placeholder="ví dụ: Dị ứng hương liệu nồng, không" />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Modal>

      {/* AI Modal */}
      <AiPackageModal
        open={!!aiPet}
        pet={aiPet}
        onClose={() => setAiPet(null)}
        onSelectPackage={(pkg, pet) => {
          setDetailClient(null)
          nav(`/app/lich-hen?pet=${pet.id}&package=${pkg.id}`)
        }}
      />

      {/* Modal Đặt lại mật khẩu khách hàng */}
      <Modal
        centered
        title={`Đặt lại mật khẩu cho khách: ${resetClient?.full_name || ''} (${resetClient?.phone || ''})`}
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        onOk={handleResetPassword}
        okText="Cập nhật mật khẩu"
        confirmLoading={resetBusy}
      >
        <Form form={resetForm} layout="vertical">
          <Paragraph type="secondary" style={{ marginBottom: 14 }}>
            Nhập mật khẩu mới hỗ trợ cho khách hàng tại quầy. Mật khẩu mới tối thiểu 8 ký tự.
          </Paragraph>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>
              <span style={{ color: '#ff4d4f' }}>* </span>Mật khẩu mới
            </span>
            <Button
              type="dashed"
              size="small"
              icon={<ThunderboltOutlined style={{ color: '#0f8b8d' }} />}
              onClick={generateRandomPassword}
              style={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
            >
              Tạo mật khẩu nhanh
            </Button>
          </div>

          <Form.Item
            name="new_password"
            rules={[
              { required: true, message: 'Nhập mật khẩu mới' },
              { min: 8, message: 'Mật khẩu phải có tối thiểu 8 ký tự' },
              {
                validator(_, value) {
                  if (value && /^\d+$/.test(value)) {
                    return Promise.reject(new Error('Mật khẩu không được hoàn toàn là chữ số. Vui lòng kết hợp thêm chữ cái.'))
                  }
                  return Promise.resolve()
                },
              },
            ]}
            extra={<span style={{ fontSize: 12, color: '#64748b' }}>Gợi ý: Tối thiểu 8 ký tự, có thể bấm nút "Tạo mật khẩu nhanh" để tự sinh mật khẩu an toàn.</span>}
            style={{ marginBottom: 14 }}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#0f8b8d' }} />} placeholder="Tối thiểu 8 ký tự" />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="Xác nhận lại mật khẩu mới"
            dependencies={['new_password']}
            rules={[
              { required: true, message: 'Vui lòng xác nhận lại mật khẩu' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('new_password') === value) {
                    return Promise.resolve()
                  }
                  return Promise.reject(new Error('Mật khẩu xác nhận không khớp!'))
                },
              }),
            ]}
          >
            <Input.Password prefix={<LockOutlined style={{ color: '#0f8b8d' }} />} placeholder="Nhập lại chính xác mật khẩu mới" />
          </Form.Item>
        </Form>
      </Modal>
    </>
  )
}
