import { useCallback, useEffect, useState } from 'react'
import {
  Alert, App, Button, DatePicker, Descriptions, Drawer, Form, Input, InputNumber, Modal, Popconfirm, Select, Space, Table, Tag, Typography,
} from 'antd'
import { CalendarOutlined, DeleteOutlined, EditOutlined, EyeOutlined, MedicineBoxOutlined, PlusOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api, toFormErrors, unwrap } from '../api.js'
import { useAuth } from '../auth.jsx'
import AiPackageModal from '../components/AiPackageModal.jsx'
import RowPerPageSelect from '../components/RowPerPageSelect.jsx'

const SPECIES = { dog: 'Chó', cat: 'Mèo' }
const COAT = { short: 'Lông ngắn', long: 'Lông dài', curly: 'Lông xoăn', double: 'Lông kép', hairless: 'Không lông' }
const SEX = { male: 'Đực', female: 'Cái', unknown: 'Chưa rõ' }
const opts = (m) => Object.entries(m).map(([value, label]) => ({ value, label }))
const fmt = (d) => (d ? dayjs(d).format('YYYY-MM-DD') : null)

function age(months) {
  if (months == null) return '—'
  return months >= 12 ? `${Math.floor(months / 12)} tuổi ${months % 12} tháng` : `${months} tháng`
}

function VaccinationModal({ pet, canEdit, onClose, onChanged }) {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [rows, setRows] = useState([])

  const load = useCallback(async () => {
    if (pet) setRows(await api(`/pets/${pet.id}/vaccinations`))
  }, [pet])
  useEffect(() => { load() }, [load])

  const add = async () => {
    const v = await form.validateFields()
    try {
      await api(`/pets/${pet.id}/vaccinations`, {
        method: 'POST',
        body: { vaccine_name: v.vaccine_name, date_given: fmt(v.date_given), valid_until: fmt(v.valid_until) },
      })
      form.resetFields()
      await load()
      onChanged()
    } catch (e) {
      form.setFields(toFormErrors(e))
      message.error(e.message)
    }
  }

  const remove = async (id) => {
    await api(`/pets/${pet.id}/vaccinations/${id}`, { method: 'DELETE' })
    await load()
    onChanged()
  }

  return (
    <Modal centered open={!!pet} title={pet ? `Tiêm phòng: ${pet.name}` : ''} onCancel={onClose} footer={null} destroyOnHidden width={640}>
      <Table
        size="small" rowKey="id" dataSource={rows} pagination={false}
        locale={{ emptyText: 'Chưa có mũi tiêm nào' }}
        columns={[
          { title: 'Vaccine', dataIndex: 'vaccine_name' },
          { title: 'Ngày tiêm', dataIndex: 'date_given', render: (v) => dayjs(v).format('DD/MM/YYYY') },
          { title: 'Hiệu lực đến', dataIndex: 'valid_until', render: (v) => (v ? dayjs(v).format('DD/MM/YYYY') : '—') },
          ...(canEdit ? [{ title: '', key: 'x', width: 50, render: (_, r) => (
            <Popconfirm title="Xóa mũi tiêm này?" okText="Xóa" cancelText="Hủy" onConfirm={() => remove(r.id)}>
              <Button size="small" danger icon={<DeleteOutlined />} />
            </Popconfirm>) }] : []),
        ]}
      />
      {canEdit && (
        <Form form={form} layout="inline" style={{ marginTop: 16, rowGap: 8 }}>
          <Form.Item name="vaccine_name" rules={[{ required: true, message: 'Nhập loại vaccine' }]}><Input placeholder="Loại vaccine" /></Form.Item>
          <Form.Item name="date_given" rules={[{ required: true, message: 'Chọn ngày tiêm' }]}>
            <DatePicker placeholder="Ngày tiêm" format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs())} />
          </Form.Item>
          <Form.Item name="valid_until"><DatePicker placeholder="Hiệu lực đến" format="DD/MM/YYYY" /></Form.Item>
          <Button type="primary" icon={<PlusOutlined />} onClick={add}>Thêm</Button>
        </Form>
      )}
    </Modal>
  )
}

export default function Pets() {
  const { message } = App.useApp()
  const nav = useNavigate()
  const { user } = useAuth()
  const isCustomer = user.role === 'customer'
  const [form] = Form.useForm()
  const [data, setData] = useState({ results: [], count: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [tags, setTags] = useState([])
  const [clientOpts, setClientOpts] = useState([])
  const [editing, setEditing] = useState(null)
  const [detailPet, setDetailPet] = useState(null)
  const [vaccPet, setVaccPet] = useState(null)
  const [aiPet, setAiPet] = useState(null)
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api('/pets', { params: { page, page_size: pageSize, q } }))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, q])

  useEffect(() => { load() }, [load])
  useEffect(() => { api('/health-tags').then((t) => setTags(unwrap(t))) }, [])

  const searchClients = useCallback(async (text) => {
    if (isCustomer) return
    const res = await api('/clients', { params: { q: text } })
    setClientOpts(res.results.map((c) => ({ value: c.id, label: `${c.full_name} (${c.phone})` })))
  }, [isCustomer])

  useEffect(() => {
    if (!editing) { form.resetFields(); return }
    form.setFieldsValue({
      species: 'dog', coat_type: 'short', sex: 'unknown', health_tags: [], allergy_note: '',
      ...editing,
      birth_date: editing.birth_date ? dayjs(editing.birth_date) : null,
      weight_kg: editing.weight_kg ? Number(editing.weight_kg) : null,
    })
    if (!isCustomer) {
      searchClients('')
      if (editing.client) setClientOpts((o) => o.some((x) => x.value === editing.client) ? o : [...o, { value: editing.client, label: editing.client_name }])
    }
  }, [editing, form, isCustomer, searchClients])

  const save = async () => {
    const v = await form.validateFields()
    const body = { ...v, birth_date: fmt(v.birth_date), weight_kg: String(v.weight_kg) }
    if (isCustomer) delete body.client
    setBusy(true)
    try {
      if (editing?.id) await api(`/pets/${editing.id}`, { method: 'PATCH', body })
      else await api('/pets', { method: 'POST', body })
      message.success('Đã lưu hồ sơ thú.')
      setEditing(null)
      load()
    } catch (e) {
      form.setFields(toFormErrors(e))
      if (!e.fields || !Object.keys(e.fields).length) message.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  const hide = async (id) => {
    await api(`/pets/${id}`, { method: 'DELETE' })
    message.success('Đã ẩn hồ sơ thú.')
    load()
  }

  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]))

  const columns = [
    { title: 'Tên', dataIndex: 'name', render: (v) => <b>🐾 {v}</b> },
    ...(isCustomer
      ? []
      : [
          {
            title: 'Chủ nuôi',
            dataIndex: 'client_name',
            render: (v) => (
              <a
                style={{ color: '#0f8b8d', fontWeight: 600, cursor: 'pointer' }}
                onClick={() => nav(`/app/khach-hang?q=${v}`)}
                title="Bấm để xem hồ sơ chủ nuôi"
              >
                👤 {v || '—'}
              </a>
            ),
          },
        ]),
    { title: 'Loài / giống', key: 's', render: (_, r) => `${SPECIES[r.species]}${r.breed ? ` · ${r.breed}` : ''}` },
    { title: 'Tuổi', dataIndex: 'age_months', render: age },
    { title: 'Cân nặng', key: 'w', render: (_, r) => `${r.weight_kg} kg (${r.size_class || '—'})` },
    {
      title: 'An toàn', key: 'h',
      render: (_, r) => (
        <Space size={[4, 4]} wrap>
          {r.health_tags.map((id) => <Tag color="orange" key={id}>{tagMap[id]?.name_vi || id}</Tag>)}
          {r.vaccinations.length === 0 && <Tag color="red">Chưa có tiêm phòng</Tag>}
        </Space>
      ),
    },
    {
      title: 'Thao tác', key: 'a', width: 380,
      render: (_, r) => (
        <Space wrap onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            type="primary"
            icon={<CalendarOutlined />}
            onClick={(e) => { e.stopPropagation(); nav(`/app/lich-hen?pet=${r.id}`) }}
            style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
          >
            Đặt lịch
          </Button>
          <Button
            size="small"
            type="primary"
            ghost
            icon={<RobotOutlined />}
            onClick={(e) => { e.stopPropagation(); setAiPet(r) }}
            style={{ borderColor: '#0f8b8d', color: '#0f8b8d' }}
          >
            AI Gợi ý gói
          </Button>
          <Button size="small" icon={<EyeOutlined />} onClick={(e) => { e.stopPropagation(); setDetailPet(r) }}>Chi tiết</Button>
          <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); setEditing(r) }}>Sửa</Button>
          <Button size="small" icon={<MedicineBoxOutlined />} onClick={(e) => { e.stopPropagation(); setVaccPet(r) }}>Tiêm phòng</Button>
          <Popconfirm title="Ẩn hồ sơ thú này?" okText="Ẩn" cancelText="Hủy" onConfirm={() => hide(r.id)}>
            <Button size="small" danger icon={<DeleteOutlined />} onClick={(e) => e.stopPropagation()} />
          </Popconfirm>
        </Space>
      ),
    },
  ]

  return (
    <>
      <Typography.Title level={3} className="page-title">{isCustomer ? 'Thú cưng của tôi' : 'Hồ Sơ Thú Cưng'}</Typography.Title>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <Space>
          <Input.Search placeholder="Tìm theo tên thú hoặc chủ..." allowClear style={{ width: 320 }}
            onSearch={(v) => { setPage(1); setQ(v) }} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setEditing({})}>Thêm thú cưng</Button>
        </Space>
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
          onClick: () => setDetailPet(record),
          style: { cursor: 'pointer' },
        })}
        pagination={{
          position: ['bottomRight'],
          current: page,
          total: data.count,
          pageSize: pageSize,
          showSizeChanger: false,
          showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} thú cưng`,
          onChange: (p) => setPage(p),
        }}
      />

      {/* ===== DRAWER XEM CHI TIẾT THÚ CƯNG ===== */}
      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 22 }}>🐾</span>
            <div>
              <Typography.Text strong style={{ fontSize: 16 }}>Hồ sơ bé cưng: {detailPet?.name}</Typography.Text>
              <div><Typography.Text type="secondary" style={{ fontSize: 12 }}>{SPECIES[detailPet?.species]} · {detailPet?.breed || 'Chưa rõ giống'}</Typography.Text></div>
            </div>
          </div>
        }
        open={!!detailPet}
        onClose={() => setDetailPet(null)}
        width={560}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<CalendarOutlined />}
              onClick={() => {
                const id = detailPet?.id
                setDetailPet(null)
                nav(`/app/lich-hen?pet=${id}`)
              }}
              style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}
            >
              Đặt lịch ngay
            </Button>
            <Button
              type="primary"
              ghost
              icon={<RobotOutlined />}
              onClick={() => {
                const p = detailPet
                setDetailPet(null)
                setAiPet(p)
              }}
              style={{ borderColor: '#0f8b8d', color: '#0f8b8d' }}
            >
              AI Gợi ý
            </Button>
          </Space>
        }
      >
        {detailPet && (
          <div>
            <Descriptions bordered column={2} size="small" style={{ marginBottom: 20 }}>
              <Descriptions.Item label="Tên thú cưng" span={2}>
                <strong style={{ fontSize: 16, color: '#0f8b8d' }}>{detailPet.name}</strong>
              </Descriptions.Item>
              <Descriptions.Item label="Chủ nuôi" span={2}>
                <Typography.Link onClick={() => { setDetailPet(null); nav(`/app/khach-hang?q=${detailPet.client_name}`) }}>
                  <UserOutlined style={{ marginRight: 4 }} />{detailPet.client_name || 'Khách vãng lai'}
                </Typography.Link>
              </Descriptions.Item>
              <Descriptions.Item label="Loài">{SPECIES[detailPet.species] || detailPet.species}</Descriptions.Item>
              <Descriptions.Item label="Giống loài">{detailPet.breed || 'Chưa rõ'}</Descriptions.Item>
              <Descriptions.Item label="Loại lông">{COAT[detailPet.coat_type] || detailPet.coat_type}</Descriptions.Item>
              <Descriptions.Item label="Giới tính">{SEX[detailPet.sex] || detailPet.sex}</Descriptions.Item>
              <Descriptions.Item label="Cân nặng">
                <Tag color="cyan">{detailPet.weight_kg} kg</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Kích thước size">
                <Tag color="blue" style={{ fontWeight: 700 }}>Size {detailPet.size_class || '—'}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="Ngày sinh">
                {detailPet.birth_date ? dayjs(detailPet.birth_date).format('DD/MM/YYYY') : '—'}
              </Descriptions.Item>
              <Descriptions.Item label="Độ tuổi">{age(detailPet.age_months)}</Descriptions.Item>
              <Descriptions.Item label="Dị ứng" span={2}>
                {detailPet.allergy_note && detailPet.allergy_note !== 'Không' ? (
                  <Tag color="error">{detailPet.allergy_note}</Tag>
                ) : (
                  <Tag color="green">Không dị ứng</Tag>
                )}
              </Descriptions.Item>
              {detailPet.safety_note && (
                <Descriptions.Item label="Lưu ý an toàn nội bộ" span={2}>
                  <Alert type="warning" message={detailPet.safety_note} style={{ padding: '4px 10px' }} />
                </Descriptions.Item>
              )}
            </Descriptions>

            <div style={{ marginBottom: 16 }}>
              <Typography.Text strong style={{ display: 'block', marginBottom: 6 }}>Thẻ sức khỏe & Đặc điểm:</Typography.Text>
              {detailPet.health_tags && detailPet.health_tags.length > 0 ? (
                <Space wrap>
                  {detailPet.health_tags.map((id) => (
                    <Tag color="orange" key={id}>{tagMap[id]?.name_vi || id}</Tag>
                  ))}
                </Space>
              ) : (
                <Typography.Text type="secondary">Chưa gắn thẻ sức khỏe nào</Typography.Text>
              )}
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <Typography.Text strong>Lịch sử tiêm phòng ({detailPet.vaccinations?.length || 0}):</Typography.Text>
                <Button size="small" icon={<MedicineBoxOutlined />} onClick={() => setVaccPet(detailPet)}>
                  Quản lý tiêm phòng
                </Button>
              </div>
              {detailPet.vaccinations && detailPet.vaccinations.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {detailPet.vaccinations.map((vc) => (
                    <div key={vc.id} style={{ background: '#f8fafc', padding: '8px 12px', borderRadius: 8, border: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between' }}>
                      <span>💉 <strong>{vc.vaccine_name}</strong></span>
                      <span style={{ fontSize: 12, color: '#64748b' }}>Ngày tiêm: {dayjs(vc.date_given).format('DD/MM/YYYY')}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <Alert type="error" showIcon message="Bé chưa cập nhật mũi tiêm phòng nào!" />
              )}
            </div>
          </div>
        )}
      </Drawer>

      <Modal
        centered
        open={!!editing} title={editing?.id ? 'Sửa hồ sơ thú' : 'Thêm thú cưng'} width={640}
        onCancel={() => setEditing(null)} onOk={save} okText="Lưu" cancelText="Hủy"
        confirmLoading={busy} destroyOnHidden
      >
        <Alert type="info" showIcon style={{ marginBottom: 16 }}
          message="Cân nặng, dị ứng và tiêm phòng giúp spa chọn gói và hóa chất an toàn cho thú." />
        <Form form={form} layout="vertical">
          {!isCustomer && (
            <Form.Item name="client" label="Chủ thú" rules={[{ required: true, message: 'Chọn khách hàng' }]}>
              <Select showSearch filterOption={false} options={clientOpts} onSearch={searchClients} placeholder="Gõ tên hoặc số điện thoại" />
            </Form.Item>
          )}
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="name" label="Tên thú" rules={[{ required: true, message: 'Nhập tên thú' }]}><Input /></Form.Item>
            <Form.Item name="species" label="Loài" rules={[{ required: true }]}><Select style={{ width: 100 }} options={opts(SPECIES)} /></Form.Item>
            <Form.Item name="breed" label="Giống"><Input /></Form.Item>
          </Space>
          <Space style={{ display: 'flex' }} align="start">
            <Form.Item name="coat_type" label="Loại lông"><Select style={{ width: 140 }} options={opts(COAT)} /></Form.Item>
            <Form.Item name="sex" label="Giới tính"><Select style={{ width: 110 }} options={opts(SEX)} /></Form.Item>
            <Form.Item name="birth_date" label="Ngày sinh">
              <DatePicker format="DD/MM/YYYY" disabledDate={(d) => d.isAfter(dayjs())} />
            </Form.Item>
            <Form.Item name="weight_kg" label="Cân nặng (kg)" rules={[{ required: true, message: 'Nhập cân nặng' }]}>
              <InputNumber min={0.1} step={0.1} style={{ width: 120 }} />
            </Form.Item>
          </Space>
          <Form.Item name="health_tags" label="Thẻ sức khỏe / an toàn">
            <Select mode="multiple" options={tags.map((t) => ({ value: t.id, label: t.name_vi }))} placeholder="Chọn nếu có" />
          </Form.Item>
          <Form.Item name="allergy_note" label='Dị ứng (ghi "Không" nếu không có)' rules={[{ required: true, whitespace: true, message: 'Bắt buộc ghi dị ứng' }]}>
            <Input.TextArea rows={2} />
          </Form.Item>
          {!isCustomer && <Form.Item name="safety_note" label="Ghi chú an toàn nội bộ"><Input.TextArea rows={2} /></Form.Item>}
        </Form>
      </Modal>

      <VaccinationModal pet={vaccPet} canEdit onClose={() => setVaccPet(null)} onChanged={load} />

      <AiPackageModal
        open={!!aiPet}
        pet={aiPet}
        onClose={() => setAiPet(null)}
        onSelectPackage={(pkg, pet) => {
          nav(`/app/lich-hen?pet=${pet.id}&package=${pkg.id}`)
        }}
      />
    </>
  )
}
