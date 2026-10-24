import { useCallback, useEffect, useState } from 'react'
import {
  Alert, App, Button, Descriptions, Drawer, Input, Popconfirm, Space, Table, Tag, Typography,
} from 'antd'
import { CalendarOutlined, DeleteOutlined, EditOutlined, EyeOutlined, MedicineBoxOutlined, PlusOutlined, RobotOutlined, UserOutlined } from '@ant-design/icons'
import { Navigate, useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
import { api, unwrap } from '../api.js'
import { useAuth } from '../auth.jsx'
import AiPackageModal from '../components/AiPackageModal.jsx'
import RowPerPageSelect from '../components/RowPerPageSelect.jsx'
import PetFormModal, { COAT, SEX, SPECIES } from '../components/PetFormModal.jsx'
import VaccinationModal from '../components/VaccinationModal.jsx'
import PetAvatar from '../components/PetAvatar.jsx'

function age(months) {
  if (months == null) return '—'
  return months >= 12 ? `${Math.floor(months / 12)} tuổi ${months % 12} tháng` : `${months} tháng`
}


// Trang thú cưng dành riêng cho khách hàng. Nhân viên quản lý thú cưng ngay trong trang Khách hàng.
export default function Pets() {
  const { message } = App.useApp()
  const nav = useNavigate()
  const { user } = useAuth()
  const isCustomer = user.role === 'customer'
  const [data, setData] = useState({ results: [], count: 0 })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(true)
  const [tags, setTags] = useState([])
  const [editing, setEditing] = useState(null)
  const [detailPet, setDetailPet] = useState(null)
  const [vaccPet, setVaccPet] = useState(null)
  const [aiPet, setAiPet] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      setData(await api('/pets', { params: { page, page_size: pageSize, q } }))
    } finally {
      setLoading(false)
    }
  }, [page, pageSize, q])

  useEffect(() => { if (isCustomer) load() }, [load, isCustomer])
  useEffect(() => { api('/health-tags').then((t) => setTags(unwrap(t))) }, [])

  if (!isCustomer) {
    const params = new URLSearchParams(window.location.search)
    return <Navigate to={`/app/khach-hang${params.get('q') ? `?q=${encodeURIComponent(params.get('q'))}` : ''}`} replace />
  }

  const hide = async (id) => {
    await api(`/pets/${id}`, { method: 'DELETE' })
    message.success('Đã ẩn hồ sơ thú.')
    load()
  }

  const tagMap = Object.fromEntries(tags.map((t) => [t.id, t]))

  const columns = [
    {
      title: 'Tên',
      dataIndex: 'name',
      render: (v, r) => (
        <Space align="center" size={8}>
          <PetAvatar species={r.species} size={32} />
          <b style={{ color: '#0b3d3f', fontSize: 14 }}>{v}</b>
        </Space>
      ),
    },
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

      <Drawer
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <PetAvatar species={detailPet?.species} size={44} />
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
                <Space align="center" size={10}>
                  <PetAvatar species={detailPet.species} size={36} />
                  <strong style={{ fontSize: 16, color: '#0f8b8d' }}>{detailPet.name}</strong>
                </Space>
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

      <PetFormModal pet={editing} isCustomer onClose={() => setEditing(null)} onSaved={load} />

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
