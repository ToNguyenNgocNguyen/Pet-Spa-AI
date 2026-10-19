import { useEffect, useState, useCallback } from 'react'
import {
  Alert, Button, Card, Col, DatePicker, Divider, Empty, Form, Input, Modal, Popconfirm, Row,
  Select, Space, Switch, Table, Tabs, Tag, Tooltip, Typography, message,
} from 'antd'
import {
  ClockCircleOutlined, DeleteOutlined, EditOutlined, ExclamationCircleOutlined,
  IdcardOutlined, LockOutlined, MailOutlined, PhoneOutlined, PlusOutlined, ReloadOutlined,
  SafetyCertificateOutlined, TagOutlined, ThunderboltOutlined, ToolOutlined, UserAddOutlined, UserOutlined,
} from '@ant-design/icons'
import { api, toFormErrors, unwrap } from '../api.js'
import { useAuth, ROLE_LABEL } from '../auth.jsx'
import RowPerPageSelect from '../components/RowPerPageSelect.jsx'

const { Title, Text, Paragraph } = Typography

const WEEKDAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']

const RESOURCE_TYPE_MAP = {
  bath_tub: { label: 'Bồn tắm', color: 'blue' },
  grooming_table: { label: 'Bàn cắt tỉa', color: 'orange' },
  drying_cage: { label: 'Chuồng sấy', color: 'cyan' },
  spa_room: { label: 'Phòng spa', color: 'purple' },
}

// Chuyển tiếng Việt có dấu sang slug mã code (vd: "Bác sĩ thú y" -> "bac_si_thu_y")
const toSlug = (str) => {
  if (!str) return ''
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s_]/g, '')
    .trim()
    .replace(/\s+/g, '_')
}

// 3 Vai trò hệ thống mặc định - Không thể xóa
const DEFAULT_ROLES = [
  {
    code: 'manager',
    name: 'Quản lý',
    base_role: 'manager',
    description: 'Toàn quyền quản trị vận hành spa, nhân sự, tài chính và cấu hình hệ thống.',
    color: 'blue',
    is_system: true,
  },
  {
    code: 'technician',
    name: 'Kỹ thuật viên',
    base_role: 'technician',
    description: 'Thực hiện các dịch vụ spa, cắt tỉa lông, chăm sóc và được phân công ca làm việc.',
    color: 'cyan',
    is_system: true,
  },
  {
    code: 'receptionist',
    name: 'Lễ tân',
    base_role: 'receptionist',
    description: 'Tiếp đón khách hàng tại quầy, tiếp nhận lịch hẹn, tư vấn dịch vụ và thu ngân.',
    color: 'purple',
    is_system: true,
  },
]

const ROLE_COLOR_OPTIONS = [
  { label: 'Cyan (Xanh ngọc)', value: 'cyan' },
  { label: 'Blue (Xanh dương)', value: 'blue' },
  { label: 'Purple (Tím quý phái)', value: 'purple' },
  { label: 'Green (Xanh lá)', value: 'green' },
  { label: 'Orange (Cam nổi bật)', value: 'orange' },
  { label: 'Magenta (Hồng tím)', value: 'magenta' },
  { label: 'Geekblue (Xanh sapphire)', value: 'geekblue' },
  { label: 'Gold (Vàng ánh kim)', value: 'gold' },
]

export default function StaffManagement() {
  const { user } = useAuth()
  const isManager = user?.role === 'manager'

  // Tab hiện tại
  const [activeTab, setActiveTab] = useState('staff')

  // Nhân sự
  const [staffList, setStaffList] = useState([])
  const [specialties, setSpecialties] = useState([])
  const [staffLoading, setStaffLoading] = useState(false)
  const [staffPage, setStaffPage] = useState(1)
  const [staffPageSize, setStaffPageSize] = useState(10)
  const [staffModalOpen, setStaffModalOpen] = useState(false)
  const [editingStaff, setEditingStaff] = useState(null)
  const [staffForm] = Form.useForm()
  const [staffDetailModalOpen, setStaffDetailModalOpen] = useState(false)
  const [viewingStaff, setViewingStaff] = useState(null)

  // Mapping custom role cho từng nhân sự (lưu localStorage)
  const [staffRoleMap, setStaffRoleMap] = useState(() => {
    try {
      const raw = localStorage.getItem('petspa_staff_role_map')
      return raw ? JSON.parse(raw) : {}
    } catch {
      return {}
    }
  })

  // Danh sách Vai trò (Hệ thống + Custom từ localStorage)
  const [roles, setRoles] = useState(() => {
    try {
      const raw = localStorage.getItem('petspa_custom_roles')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (Array.isArray(parsed)) {
          const customOnly = parsed.filter((r) => !DEFAULT_ROLES.some((dr) => dr.code === r.code))
          return [...DEFAULT_ROLES, ...customOnly]
        }
      }
    } catch (e) {
      console.error('Error loading custom roles:', e)
    }
    return DEFAULT_ROLES
  })
  const [roleModalOpen, setRoleModalOpen] = useState(false)
  const [editingRole, setEditingRole] = useState(null)
  const [roleForm] = Form.useForm()
  const [rolePage, setRolePage] = useState(1)
  const [rolePageSize, setRolePageSize] = useState(10)
  const [roleDetailModalOpen, setRoleDetailModalOpen] = useState(false)
  const [viewingRole, setViewingRole] = useState(null)

  // Chuyên môn tay nghề
  const [specModalOpen, setSpecModalOpen] = useState(false)
  const [editingSpec, setEditingSpec] = useState(null)
  const [specForm] = Form.useForm()
  const [specPage, setSpecPage] = useState(1)
  const [specPageSize, setSpecPageSize] = useState(10)

  // Ca làm việc & Ngày nghỉ
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftStaff, setShiftStaff] = useState(null)
  const [shifts, setShifts] = useState([])
  const [timeOffList, setTimeOffList] = useState([])
  const [timeOffForm] = Form.useForm()

  // Đặt lại mật khẩu nhân viên
  const [resetModalOpen, setResetModalOpen] = useState(false)
  const [resetTargetUser, setResetTargetUser] = useState(null)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetForm] = Form.useForm()

  // Tài nguyên cơ sở vật chất
  const [resources, setResources] = useState([])
  const [resLoading, setResLoading] = useState(false)
  const [resPage, setResPage] = useState(1)
  const [resPageSize, setResPageSize] = useState(10)
  const [resModalOpen, setResModalOpen] = useState(false)
  const [resForm] = Form.useForm()

  const loadStaff = useCallback(async () => {
    setStaffLoading(true)
    try {
      const [stf, specs] = await Promise.all([
        api('/staff?include_inactive=1'),
        api('/specialties'),
      ])
      setStaffList(unwrap(stf))
      setSpecialties(unwrap(specs))
    } catch (e) {
      message.error(e.message || 'Không thể tải danh sách nhân viên')
    } finally {
      setStaffLoading(false)
    }
  }, [])

  const loadResources = useCallback(async () => {
    setResLoading(true)
    try {
      const res = await api('/resources?include_inactive=1')
      setResources(unwrap(res))
    } catch (e) {
      message.error(e.message || 'Không thể tải danh sách tài nguyên')
    } finally {
      setResLoading(false)
    }
  }, [])

  useEffect(() => {
    loadStaff()
    loadResources()
  }, [loadStaff, loadResources])

  // Lưu custom roles vào localStorage
  const persistRoles = (newRoles) => {
    setRoles(newRoles)
    const customOnly = newRoles.filter((r) => !r.is_system)
    localStorage.setItem('petspa_custom_roles', JSON.stringify(customOnly))
  }

  // Lưu staff role map vào localStorage
  const persistStaffRoleMap = (newMap) => {
    setStaffRoleMap(newMap)
    localStorage.setItem('petspa_staff_role_map', JSON.stringify(newMap))
  }

  // Tự động sinh mật khẩu ngẫu nhiên an toàn cho modal Thêm nhân viên
  const generateRandomPasswordForNewStaff = () => {
    const prefixes = ['PetSpa', 'SpaAI', 'HappyPet', 'PawsCare', 'ProGroom', 'SpaVet']
    const symbols = ['@', '#', '$', '!']
    const randPrefix = prefixes[Math.floor(Math.random() * prefixes.length)]
    const randSym = symbols[Math.floor(Math.random() * symbols.length)]
    const randNum = Math.floor(1000 + Math.random() * 9000)
    const genPass = `${randPrefix}${randSym}${randNum}`
    staffForm.setFieldsValue({ password: genPass })
    navigator.clipboard?.writeText(genPass)
    message.success(`Đã tạo mật khẩu khởi tạo an toàn: ${genPass} (Đã sao chép vào bộ nhớ tạm)`)
  }

  // Xem chi tiết nhân viên
  const openStaffDetails = (st) => {
    setViewingStaff(st)
    setStaffDetailModalOpen(true)
  }

  // Thêm / Sửa nhân viên
  const openStaffModal = (st = null) => {
    setEditingStaff(st)
    staffForm.resetFields()
    if (st) {
      const mappedRole = staffRoleMap[st.id] || st.role
      staffForm.setFieldsValue({
        username: st.username,
        full_name: st.full_name,
        phone: st.phone,
        email: st.email,
        role: mappedRole,
        specialties: st.specialties,
        is_active: st.is_active,
      })
    } else {
      staffForm.setFieldsValue({ role: 'technician', is_active: true })
    }
    setStaffModalOpen(true)
  }

  const saveStaff = async () => {
    try {
      const values = await staffForm.validateFields()
      // Tìm vai trò được chọn
      const selectedRoleObj = roles.find((r) => r.code === values.role)
      const baseRole = selectedRoleObj?.base_role || (['manager', 'technician', 'receptionist'].includes(values.role) ? values.role : 'technician')

      const payload = {
        ...values,
        role: baseRole,
      }

      if (editingStaff) {
        await api(`/staff/${editingStaff.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        persistStaffRoleMap({ ...staffRoleMap, [editingStaff.id]: values.role })
        message.success('Cập nhật nhân viên thành công!')
      } else {
        const createdStaff = await api('/staff', { method: 'POST', body: JSON.stringify(payload) })
        if (createdStaff?.id) {
          persistStaffRoleMap({ ...staffRoleMap, [createdStaff.id]: values.role })
        }
        if (baseRole === 'technician') {
          message.success('Thêm nhân viên thành công! Hệ thống đã tự động tạo ca làm việc mặc định (T2-CN, 08:00 - 19:00).')
        } else {
          message.success('Thêm nhân viên mới thành công!')
        }
      }
      setStaffModalOpen(false)
      loadStaff()
    } catch (e) {
      const fields = toFormErrors(e)
      if (fields.length) staffForm.setFields(fields)
      message.error(e.message || 'Lỗi khi lưu nhân sự')
    }
  }

  // Tự động sinh mật khẩu ngẫu nhiên cho modal Đổi MK nhân viên
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

  // Đặt lại mật khẩu nhân viên
  const handleResetPassword = async () => {
    try {
      const values = await resetForm.validateFields()
      setResetBusy(true)
      await api(`/auth/users/${resetTargetUser.user_id}/reset-password`, {
        method: 'POST',
        body: JSON.stringify({ new_password: values.new_password }),
      })
      message.success(`Đã đặt lại mật khẩu cho tài khoản ${resetTargetUser.username}!`)
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

  // Khóa nhân viên
  const toggleStaffActive = async (st) => {
    try {
      if (st.is_active) {
        await api(`/staff/${st.id}`, { method: 'DELETE' })
      } else {
        await api(`/staff/${st.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) })
      }
      message.success('Đã cập nhật trạng thái nhân viên')
      loadStaff()
    } catch (e) {
      message.error(e.message || 'Thao tác không thành công')
    }
  }

  // Quản lý ca làm & ngày nghỉ
  const openShifts = async (st) => {
    setShiftStaff(st)
    setShiftModalOpen(true)
    try {
      const [shs, tos] = await Promise.all([
        api(`/staff/${st.id}/shifts`),
        api(`/staff/${st.id}/time-off`),
      ])
      setShifts(shs)
      setTimeOffList(tos)
    } catch {
      // ignore
    }
  }

  const addTimeOff = async () => {
    try {
      const v = await timeOffForm.validateFields()
      await api(`/staff/${shiftStaff.id}/time-off`, {
        method: 'POST',
        body: JSON.stringify({
          date_from: v.range[0].format('YYYY-MM-DD'),
          date_to: v.range[1].format('YYYY-MM-DD'),
          reason: v.reason || '',
        }),
      })
      message.success('Đã đăng ký ngày nghỉ')
      timeOffForm.resetFields()
      const tos = await api(`/staff/${shiftStaff.id}/time-off`)
      setTimeOffList(tos)
    } catch (e) {
      message.error(e.message || 'Lỗi khi đăng ký ngày nghỉ')
    }
  }

  const deleteTimeOff = async (tid) => {
    try {
      await api(`/staff/${shiftStaff.id}/time-off/${tid}`, { method: 'DELETE' })
      message.success('Đã xóa ngày nghỉ')
      setTimeOffList((prev) => prev.filter((x) => x.id !== tid))
    } catch (e) {
      message.error(e.message || 'Lỗi khi xóa')
    }
  }

  // ===== QUẢN LÝ VAI TRÒ =====
  const openRoleDetails = (role) => {
    setViewingRole(role)
    setRoleDetailModalOpen(true)
  }

  const openRoleModal = (role = null) => {
    setEditingRole(role)
    roleForm.resetFields()
    if (role) {
      roleForm.setFieldsValue({
        name: role.name,
        code: role.code,
        description: role.description,
        color: role.color || 'blue',
      })
    } else {
      roleForm.setFieldsValue({
        color: 'cyan',
      })
    }
    setRoleModalOpen(true)
  }

  const saveRole = async () => {
    try {
      const values = await roleForm.validateFields()
      const codeClean = (values.code || toSlug(values.name)).trim().toLowerCase().replace(/\s+/g, '_')

      if (editingRole) {
        // Cập nhật vai trò (Vai trò hệ thống giữ nguyên tên, mã)
        const roleName = editingRole.is_system ? editingRole.name : values.name.trim()
        const updated = roles.map((r) => {
          if (r.code === editingRole.code) {
            return {
              ...r,
              name: roleName,
              description: values.description || '',
              color: values.color,
            }
          }
          return r
        })
        persistRoles(updated)
        // Cập nhật viewingRole nếu đang mở modal chi tiết
        if (viewingRole?.code === editingRole.code) {
          setViewingRole(updated.find((r) => r.code === editingRole.code))
        }
        message.success(`Đã cập nhật vai trò "${roleName}"!`)
      } else {
        // Kiểm tra mã trùng
        if (roles.some((r) => r.code === codeClean)) {
          roleForm.setFields([{ name: 'code', errors: ['Mã vai trò này đã tồn tại trong hệ thống!'] }])
          return
        }
        const newRole = {
          code: codeClean,
          name: values.name.trim(),
          base_role: 'technician',
          description: values.description || '',
          color: values.color,
          is_system: false,
        }
        persistRoles([...roles, newRole])
        message.success(`Đã thêm vai trò mới "${values.name}"!`)
      }
      setRoleModalOpen(false)
    } catch (e) {
      console.error(e)
    }
  }

  // Modal xác nhận an toàn trước khi xóa vai trò
  const confirmDeleteRole = (role) => {
    if (role.is_system) {
      message.warning('Đây là vai trò hệ thống mặc định, không thể xóa!')
      return
    }

    Modal.confirm({
      title: 'Xác nhận xóa vai trò',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Bạn có chắc chắn muốn xóa vai trò <b>"{role.name}"</b> (Mã: <code>{role.code}</code>) không?
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
            Sau khi xóa, các nhân sự đang giữ vai trò này sẽ tự động chuyển về vai trò Kỹ thuật viên mặc định. Hành động này không thể hoàn tác!
          </Paragraph>
        </div>
      ),
      okText: 'Xác nhận xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      onOk() {
        const nextRoles = roles.filter((r) => r.code !== role.code)
        persistRoles(nextRoles)

        // Dọn dẹp mapping staff
        const nextMap = { ...staffRoleMap }
        Object.keys(nextMap).forEach((id) => {
          if (nextMap[id] === role.code) {
            delete nextMap[id]
          }
        })
        persistStaffRoleMap(nextMap)

        message.success(`Đã xóa vai trò "${role.name}" thành công!`)
      },
    })
  }

  // ===== QUẢN LÝ CHUYÊN MÔN TAY NGHỀ =====
  const openSpecModal = (spec = null) => {
    setEditingSpec(spec)
    specForm.resetFields()
    if (spec) {
      specForm.setFieldsValue({
        name_vi: spec.name_vi,
        code: spec.code,
      })
    }
    setSpecModalOpen(true)
  }

  const saveSpecialty = async () => {
    try {
      const values = await specForm.validateFields()
      const payload = {
        name_vi: values.name_vi.trim(),
        code: (values.code || '').trim().toLowerCase().replace(/\s+/g, '_'),
      }

      if (editingSpec) {
        await api(`/specialties/${editingSpec.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        message.success(`Cập nhật chuyên môn "${payload.name_vi}" thành công!`)
      } else {
        await api('/specialties', { method: 'POST', body: JSON.stringify(payload) })
        message.success(`Thêm chuyên môn mới "${payload.name_vi}" thành công!`)
      }
      setSpecModalOpen(false)
      loadStaff()
    } catch (e) {
      const fields = toFormErrors(e)
      if (fields.length) specForm.setFields(fields)
      message.error(e.message || 'Lỗi khi lưu chuyên môn tay nghề')
    }
  }

  // Modal xác nhận an toàn trước khi xóa chuyên môn
  const confirmDeleteSpecialty = (spec) => {
    Modal.confirm({
      title: 'Xác nhận xóa chuyên môn tay nghề',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Bạn có chắc chắn muốn xóa chuyên môn <b>"{spec.name_vi}"</b> (Mã: <code>{spec.code}</code>) không?
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
            Chuyên môn này sẽ bị gỡ bỏ khỏi danh mục kỹ năng của tất cả kỹ thuật viên đang sở hữu. Hành động này không thể hoàn tác!
          </Paragraph>
        </div>
      ),
      okText: 'Xác nhận xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      async onOk() {
        try {
          await api(`/specialties/${spec.id}`, { method: 'DELETE' })
          message.success(`Đã xóa chuyên môn "${spec.name_vi}" thành công!`)
          loadStaff()
        } catch (e) {
          message.error(e.message || 'Không thể xóa chuyên môn này')
        }
      },
    })
  }

  // ===== QUẢN LÝ TÀI NGUYÊN =====
  const saveResource = async () => {
    try {
      const v = await resForm.validateFields()
      await api('/resources', { method: 'POST', body: JSON.stringify(v) })
      message.success('Đã thêm tài nguyên mới')
      setResModalOpen(false)
      resForm.resetFields()
      loadResources()
    } catch (e) {
      message.error(e.message || 'Lỗi khi thêm tài nguyên')
    }
  }

  const toggleResourceActive = async (r) => {
    try {
      if (r.is_active) {
        await api(`/resources/${r.id}`, { method: 'DELETE' })
      } else {
        await api(`/resources/${r.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) })
      }
      message.success('Đã cập nhật trạng thái tài nguyên')
      loadResources()
    } catch (e) {
      message.error(e.message || 'Lỗi thao tác')
    }
  }

  // Bảng nhân sự
  const staffColumns = [
    {
      title: 'Họ tên',
      key: 'name',
      render: (_, st) => (
        <div>
          <Text strong style={{ fontSize: 14 }}>{st.full_name || st.username}</Text>
          <div><Text type="secondary" style={{ fontSize: 12 }}>@{st.username}</Text></div>
        </div>
      ),
    },
    {
      title: 'Vai trò',
      key: 'role',
      render: (_, st) => {
        const customCode = staffRoleMap[st.id] || st.role
        const roleObj = roles.find((r) => r.code === customCode) || roles.find((r) => r.code === st.role)
        return (
          <Tag color={roleObj?.color || (st.role === 'technician' ? 'cyan' : 'blue')}>
            {roleObj?.name || ROLE_LABEL[st.role] || st.role}
          </Tag>
        )
      },
    },
    {
      title: 'Liên hệ',
      key: 'contact',
      render: (_, st) => (
        <div>
          <div><Text strong style={{ color: '#0f8b8d' }}>{st.phone || '—'}</Text></div>
          <Text type="secondary" style={{ fontSize: 12 }}>{st.email || ''}</Text>
        </div>
      ),
    },
    {
      title: 'Chuyên môn',
      dataIndex: 'specialties',
      render: (specIds) => {
        const specNames = (specIds || []).map((id) => specialties.find((s) => s.id === id)?.name_vi).filter(Boolean)
        return specNames.length > 0 ? (
          <Space wrap size={[0, 4]}>
            {specNames.map((n, i) => <Tag key={i} color="geekblue">{n}</Tag>)}
          </Space>
        ) : <Text type="secondary">Chưa gán</Text>
      },
    },
    {
      title: 'Trạng thái',
      dataIndex: 'is_active',
      render: (active, st) => (
        <Switch
          checked={active}
          disabled={!isManager}
          onChange={() => toggleStaffActive(st)}
          checkedChildren="Hoạt động"
          unCheckedChildren="Đã khóa"
        />
      ),
    },
    {
      title: 'Thao tác',
      key: 'act',
      render: (_, st) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button size="small" icon={<ClockCircleOutlined />} onClick={(e) => { e.stopPropagation(); openShifts(st) }}>
            Ca & Nghỉ
          </Button>
          {isManager && (
            <>
              <Button size="small" icon={<EditOutlined />} onClick={(e) => { e.stopPropagation(); openStaffModal(st) }}>
                Sửa
              </Button>
              <Button
                size="small"
                icon={<LockOutlined />}
                onClick={(e) => {
                  e.stopPropagation()
                  setResetTargetUser(st)
                  resetForm.resetFields()
                  setResetModalOpen(true)
                }}
                title="Đặt lại mật khẩu cho nhân viên"
              >
                Đổi MK
              </Button>
            </>
          )}
        </Space>
      ),
    },
  ]

  // Bảng vai trò
  const roleColumns = [
    {
      title: 'Tên vai trò',
      dataIndex: 'name',
      key: 'name',
      render: (name, r) => (
        <Space>
          <Tag color={r.color || 'blue'} style={{ fontSize: 13, padding: '2px 8px' }}>{name}</Tag>
          {r.is_system && (
            <Tag color="default" style={{ fontSize: 11, borderRadius: 10 }}>Hệ thống</Tag>
          )}
        </Space>
      ),
    },
    {
      title: 'Mã định danh (Code)',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text code>{code}</Text>,
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 140,
      render: (_, r) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              openRoleModal(r)
            }}
            disabled={!isManager}
          >
            Sửa
          </Button>
          {r.is_system ? (
            <Tooltip title="Vai trò hệ thống mặc định, không thể xóa">
              <Button size="small" danger disabled icon={<DeleteOutlined />} />
            </Tooltip>
          ) : (
            <Tooltip title="Xóa vai trò tùy chỉnh này">
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                disabled={!isManager}
                onClick={(e) => {
                  e.stopPropagation()
                  confirmDeleteRole(r)
                }}
              />
            </Tooltip>
          )}
        </Space>
      ),
    },
  ]

  // Bảng chuyên môn
  const specialtyColumns = [
    {
      title: 'Tên chuyên môn tay nghề',
      dataIndex: 'name_vi',
      key: 'name_vi',
      render: (name) => <Text strong style={{ color: '#0f8b8d', fontSize: 14 }}>{name}</Text>,
    },
    {
      title: 'Mã chuyên môn (Code)',
      dataIndex: 'code',
      key: 'code',
      render: (code) => <Text code>{code}</Text>,
    },
    {
      title: 'Số nhân sự sở hữu',
      key: 'staff_count',
      render: (_, spec) => {
        const count = staffList.filter((st) => (st.specialties || []).includes(spec.id)).length
        return (
          <Tag color={count > 0 ? 'geekblue' : 'default'}>
            {count} kỹ thuật viên
          </Tag>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 140,
      render: (_, spec) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={() => openSpecModal(spec)}
            disabled={!isManager}
          >
            Sửa
          </Button>
          <Tooltip title="Xóa chuyên môn này">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!isManager}
              onClick={() => confirmDeleteSpecialty(spec)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // Bảng tài nguyên
  const resColumns = [
    { title: 'Tên tài nguyên', dataIndex: 'name', render: (n) => <Text strong>{n}</Text> },
    {
      title: 'Phân loại',
      dataIndex: 'resource_type',
      render: (t) => {
        const item = RESOURCE_TYPE_MAP[t] || { label: t, color: 'default' }
        return <Tag color={item.color}>{item.label}</Tag>
      },
    },
    {
      title: 'Trạng thái hoạt động',
      dataIndex: 'is_active',
      render: (active, r) => (
        <Switch
          checked={active}
          disabled={!isManager}
          onChange={() => toggleResourceActive(r)}
          checkedChildren="Sẵn sàng"
          unCheckedChildren="Tạm ngưng"
        />
      ),
    },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <Title level={3} style={{ margin: 0 }}>Nhân Sự & Cơ Sở Vật Chất</Title>
          <Paragraph type="secondary" style={{ margin: 0 }}>
            Quản lý đội ngũ nhân viên, phân quyền vai trò, chứng chỉ chuyên môn và giám sát cơ sở vật chất spa
          </Paragraph>
        </div>

        <Space wrap>
          <Button icon={<ReloadOutlined />} onClick={() => { loadStaff(); loadResources() }}>Làm mới</Button>
          {isManager && (
            <>
              <Button type="primary" icon={<UserAddOutlined />} onClick={() => openStaffModal(null)}>
                Thêm nhân viên
              </Button>
              {activeTab === 'roles' && (
                <Button icon={<SafetyCertificateOutlined />} onClick={() => openRoleModal(null)}>
                  Thêm vai trò
                </Button>
              )}
              {activeTab === 'specialties' && (
                <Button icon={<TagOutlined />} onClick={() => openSpecModal(null)}>
                  Thêm chuyên môn
                </Button>
              )}
              {activeTab === 'resources' && (
                <Button icon={<ToolOutlined />} onClick={() => setResModalOpen(true)}>
                  Thêm tài nguyên
                </Button>
              )}
            </>
          )}
        </Space>
      </div>

      <Tabs
        type="card"
        activeKey={activeTab}
        onChange={setActiveTab}
        items={[
          {
            key: 'staff',
            label: (<span><UserOutlined /> Đội ngũ nhân sự ({staffList.length})</span>),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>💡 Bấm vào bất kỳ nhân viên nào để xem chi tiết thông tin hồ sơ nhân sự</Text>
                  <RowPerPageSelect value={staffPageSize} onChange={(ps) => { setStaffPageSize(ps); setStaffPage(1) }} />
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={staffList}
                    columns={staffColumns}
                    rowKey="id"
                    loading={staffLoading}
                    scroll={{ x: 'max-content' }}
                    rowClassName={() => 'clickable-row'}
                    onRow={(record) => ({
                      onClick: () => openStaffDetails(record),
                      style: { cursor: 'pointer' },
                    })}
                    pagination={{
                      position: ['bottomRight'],
                      current: staffPage,
                      pageSize: staffPageSize,
                      showSizeChanger: false,
                      showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} nhân sự`,
                      onChange: (p) => setStaffPage(p),
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'roles',
            label: (<span><SafetyCertificateOutlined /> Vai trò ({roles.length})</span>),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    💡 Bấm vào bất kỳ vai trò nào để xem chi tiết. 3 vai trò hệ thống mặc định (Quản lý, Kỹ thuật viên, Lễ tân) được bảo vệ tên và quyền hạn.
                  </Text>
                  <Space>
                    {isManager && (
                      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openRoleModal(null)}>
                        Thêm vai trò mới
                      </Button>
                    )}
                    <RowPerPageSelect value={rolePageSize} onChange={(ps) => { setRolePageSize(ps); setRolePage(1) }} />
                  </Space>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={roles}
                    columns={roleColumns}
                    rowKey="code"
                    rowClassName={() => 'clickable-row'}
                    onRow={(record) => ({
                      onClick: () => openRoleDetails(record),
                      style: { cursor: 'pointer' },
                    })}
                    pagination={{
                      position: ['bottomRight'],
                      current: rolePage,
                      pageSize: rolePageSize,
                      showSizeChanger: false,
                      showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} vai trò`,
                      onChange: (p) => setRolePage(p),
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'specialties',
            label: (<span><TagOutlined /> Chuyên môn tay nghề ({specialties.length})</span>),
            children: (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    ✂️ Danh mục chuyên môn kỹ thuật tay nghề gán cho nhân sự spa (tắm, cắt tỉa tạo kiểu, spa mèo...).
                  </Text>
                  <Space>
                    {isManager && (
                      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => openSpecModal(null)}>
                        Thêm chuyên môn mới
                      </Button>
                    )}
                    <RowPerPageSelect value={specPageSize} onChange={(ps) => { setSpecPageSize(ps); setSpecPage(1) }} />
                  </Space>
                </div>
                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={specialties}
                    columns={specialtyColumns}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                    pagination={{
                      position: ['bottomRight'],
                      current: specPage,
                      pageSize: specPageSize,
                      showSizeChanger: false,
                      showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} chuyên môn`,
                      onChange: (p) => setSpecPage(p),
                    }}
                  />
                </Card>
              </div>
            ),
          },
          {
            key: 'resources',
            label: (<span><ToolOutlined /> Cơ sở vật chất ({resources.length})</span>),
            children: (
              <div>
                <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
                  {Object.entries(RESOURCE_TYPE_MAP).map(([key, item]) => {
                    const count = resources.filter((r) => r.resource_type === key && r.is_active).length
                    return (
                      <Col xs={12} sm={6} key={key}>
                        <Card size="small" style={{ borderRadius: 12 }}>
                          <Text type="secondary">{item.label}</Text>
                          <div style={{ fontSize: 24, fontWeight: 800, color: '#0f8b8d' }}>
                            {count} <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>vị trí</span>
                          </div>
                        </Card>
                      </Col>
                    )
                  })}
                </Row>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>💡 Danh sách vị trí cơ sở vật chất spa</Text>
                  <Space>
                    {isManager && (
                      <Button size="small" type="primary" icon={<PlusOutlined />} onClick={() => setResModalOpen(true)}>
                        Thêm tài nguyên mới
                      </Button>
                    )}
                    <RowPerPageSelect value={resPageSize} onChange={(ps) => { setResPageSize(ps); setResPage(1) }} />
                  </Space>
                </div>

                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={resources}
                    columns={resColumns}
                    rowKey="id"
                    loading={resLoading}
                    scroll={{ x: 'max-content' }}
                    pagination={{
                      position: ['bottomRight'],
                      current: resPage,
                      pageSize: resPageSize,
                      showSizeChanger: false,
                      showTotal: (total, range) => `${range[0]}-${range[1]} / ${total} tài nguyên`,
                      onChange: (p) => setResPage(p),
                    }}
                  />
                </Card>
              </div>
            ),
          },
        ]}
      />

      {/* ===== MODAL THÊM / SỬA NHÂN VIÊN ===== */}
      <Modal
        centered
        title={editingStaff ? `Chỉnh sửa nhân viên: ${editingStaff.full_name}` : 'Thêm nhân viên mới'}
        open={staffModalOpen}
        onCancel={() => setStaffModalOpen(false)}
        onOk={saveStaff}
        okText="Lưu thông tin"
        width={580}
      >
        <Form form={staffForm} layout="vertical">
          <Form.Item name="full_name" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ và tên nhân viên' }]}>
            <Input placeholder="Ví dụ: Nguyễn Văn A" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
                <Input disabled={!!editingStaff} placeholder="ktv_ten" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="role" label="Vai trò" rules={[{ required: true, message: 'Chọn vai trò' }]}>
                <Select
                  options={roles.map((r) => ({
                    value: r.code,
                    label: (
                      <Space>
                        <Tag color={r.color || 'blue'}>{r.name}</Tag>
                        {r.is_system && <Text type="secondary" style={{ fontSize: 11 }}>(Hệ thống)</Text>}
                      </Space>
                    ),
                  }))}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="phone"
                label="Số điện thoại"
                rules={[
                  { required: true, message: 'Vui lòng nhập số điện thoại' },
                  { pattern: /^0\d{9}$/, message: 'SĐT gồm 10 chữ số (bắt đầu bằng 0)' },
                ]}
              >
                <Input placeholder="0901xxxxxx" maxLength={10} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="email"
                label="Email"
                rules={[{ type: 'email', message: 'Email không hợp lệ' }]}
              >
                <Input placeholder="nhanvien@example.com" />
              </Form.Item>
            </Col>
          </Row>

          {/* Hàng: Chuyên môn tay nghề (bên trái) + Mật khẩu khởi tạo (bên phải) */}
          <Row gutter={16}>
            <Col span={editingStaff ? 24 : 12}>
              <Form.Item name="specialties" label="Chuyên môn tay nghề">
                <Select
                  mode="multiple"
                  placeholder="Chọn chuyên môn"
                  options={specialties.map((s) => ({ value: s.id, label: s.name_vi }))}
                />
              </Form.Item>
            </Col>

            {!editingStaff && (
              <Col span={12}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontWeight: 600, color: '#334155', fontSize: 13 }}>
                      <span style={{ color: '#ff4d4f' }}>* </span>Mật khẩu khởi tạo
                    </span>
                    <Button
                      type="dashed"
                      size="small"
                      icon={<ThunderboltOutlined style={{ color: '#0f8b8d' }} />}
                      onClick={generateRandomPasswordForNewStaff}
                      style={{ fontSize: 12, borderRadius: 6, borderColor: '#cbd5e1' }}
                    >
                      Tạo mật khẩu nhanh
                    </Button>
                  </div>
                  <Form.Item
                    name="password"
                    noStyle
                    rules={[
                      { required: true, message: 'Vui lòng nhập mật khẩu khởi tạo' },
                      { min: 8, message: 'Tối thiểu 8 ký tự' },
                      {
                        validator(_, value) {
                          if (value && /^\d+$/.test(value)) {
                            return Promise.reject(new Error('MK không được chỉ gồm số.'))
                          }
                          return Promise.resolve()
                        },
                      },
                    ]}
                  >
                    <Input.Password prefix={<LockOutlined style={{ color: '#0f8b8d' }} />} placeholder="Tối thiểu 8 ký tự" />
                  </Form.Item>
                </div>
              </Col>
            )}
          </Row>

          <Form.Item name="is_active" valuePropName="checked" label="Trạng thái tài khoản" style={{ marginTop: 8 }}>
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Khóa" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== MODAL XEM CHI TIẾT NHÂN VIÊN ===== */}
      <Modal
        centered
        title={
          <Space>
            <UserOutlined style={{ color: '#0f8b8d' }} />
            <span>Hồ sơ nhân viên: {viewingStaff?.full_name || viewingStaff?.username}</span>
          </Space>
        }
        open={staffDetailModalOpen}
        onCancel={() => setStaffDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setStaffDetailModalOpen(false)}>
            Đóng
          </Button>,
          <Button
            key="shifts"
            icon={<ClockCircleOutlined />}
            onClick={() => {
              const target = viewingStaff
              setStaffDetailModalOpen(false)
              openShifts(target)
            }}
          >
            Ca & Nghỉ
          </Button>,
          isManager && (
            <Button
              key="reset_pwd"
              icon={<LockOutlined />}
              onClick={() => {
                const target = viewingStaff
                setStaffDetailModalOpen(false)
                setResetTargetUser(target)
                resetForm.resetFields()
                setResetModalOpen(true)
              }}
            >
              Đổi MK
            </Button>
          ),
          isManager && (
            <Button
              key="edit"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                const target = viewingStaff
                setStaffDetailModalOpen(false)
                openStaffModal(target)
              }}
            >
              Chỉnh sửa
            </Button>
          ),
        ]}
        width={580}
      >
        {viewingStaff && (
          <div>
            {/* Banner thông tin chính */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 18,
                padding: '16px',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#e6fffa',
                    color: '#0f8b8d',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: 22,
                    border: '2px solid #b2f5ea',
                  }}
                >
                  <UserOutlined />
                </div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b' }}>
                    {viewingStaff.full_name || viewingStaff.username}
                  </div>
                  <Text type="secondary" style={{ fontSize: 13 }}>
                    @{viewingStaff.username}
                  </Text>
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <div>
                  {(() => {
                    const customCode = staffRoleMap[viewingStaff.id] || viewingStaff.role
                    const roleObj = roles.find((r) => r.code === customCode) || roles.find((r) => r.code === viewingStaff.role)
                    return (
                      <Tag color={roleObj?.color || (viewingStaff.role === 'technician' ? 'cyan' : 'blue')} style={{ fontSize: 13, padding: '2px 10px' }}>
                        {roleObj?.name || ROLE_LABEL[viewingStaff.role] || viewingStaff.role}
                      </Tag>
                    )
                  })()}
                </div>
                <div style={{ marginTop: 6 }}>
                  {viewingStaff.is_active ? (
                    <Tag color="success">Đang hoạt động</Tag>
                  ) : (
                    <Tag color="error">Tài khoản đã khóa</Tag>
                  )}
                </div>
              </div>
            </div>

            {/* Chi tiết liên hệ */}
            <Row gutter={[16, 16]} style={{ marginBottom: 18 }}>
              <Col span={12}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    <PhoneOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                    Số điện thoại
                  </Text>
                  <Text strong style={{ fontSize: 14, color: '#0f8b8d' }}>
                    {viewingStaff.phone || 'Chưa cập nhật'}
                  </Text>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    <MailOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                    Địa chỉ Email
                  </Text>
                  <Text strong style={{ fontSize: 14, color: '#334155' }}>
                    {viewingStaff.email || 'Chưa cập nhật'}
                  </Text>
                </div>
              </Col>
            </Row>

            <Divider style={{ margin: '14px 0' }} />

            {/* Chuyên môn kỹ thuật */}
            <div style={{ marginBottom: 18 }}>
              <Text strong style={{ fontSize: 13, color: '#334155', display: 'block', marginBottom: 8 }}>
                <TagOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                Chuyên môn kỹ thuật tay nghề:
              </Text>
              {(() => {
                const specNames = (viewingStaff.specialties || [])
                  .map((id) => specialties.find((s) => s.id === id)?.name_vi)
                  .filter(Boolean)
                return specNames.length > 0 ? (
                  <Space wrap size={[6, 8]}>
                    {specNames.map((n, i) => (
                      <Tag key={i} color="geekblue" style={{ fontSize: 13, padding: '3px 10px' }}>
                        {n}
                      </Tag>
                    ))}
                  </Space>
                ) : (
                  <Text type="secondary" style={{ fontSize: 13 }}>Chưa gán chuyên môn kỹ thuật nào cho nhân sự này.</Text>
                )
              })()}
            </div>

            {/* Quản lý ca làm việc shortcut */}
            <div style={{ padding: '12px 14px', background: '#f0fdfa', borderRadius: 8, border: '1px solid #ccfbf1', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <Text strong style={{ color: '#0f8b8d', display: 'block' }}>Lịch làm việc & Ngày nghỉ phép</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>Thiết lập các ca làm cố định trong tuần hoặc duyệt lịch nghỉ phép</Text>
              </div>
              <Button
                size="small"
                type="primary"
                ghost
                icon={<ClockCircleOutlined />}
                onClick={() => {
                  const target = viewingStaff
                  setStaffDetailModalOpen(false)
                  openShifts(target)
                }}
              >
                Cấu hình ca & nghỉ
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ===== MODAL THÊM / SỬA VAI TRÒ ===== */}
      <Modal
        centered
        title={editingRole ? `Chỉnh sửa vai trò: ${editingRole.name}` : 'Thêm vai trò mới'}
        open={roleModalOpen}
        onCancel={() => setRoleModalOpen(false)}
        onOk={saveRole}
        okText="Lưu vai trò"
      >
        <Form form={roleForm} layout="vertical">
          <Form.Item
            name="name"
            label="Tên vai trò"
            rules={[{ required: true, message: 'Vui lòng nhập tên vai trò' }]}
            extra={editingRole?.is_system ? 'Tên vai trò hệ thống mặc định không thể thay đổi' : undefined}
          >
            <Input
              placeholder="Ví dụ: Bác sĩ thú y, Trợ tá spa..."
              disabled={editingRole?.is_system}
              onChange={(e) => {
                if (!editingRole) {
                  roleForm.setFieldsValue({ code: toSlug(e.target.value) })
                }
              }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="code"
                label="Mã vai trò (Code)"
                rules={[
                  { required: true, message: 'Vui lòng nhập mã vai trò' },
                  { pattern: /^[a-z0-9_]+$/, message: 'Mã chỉ gồm chữ thường không dấu và dấu gạch dưới' },
                ]}
                extra={editingRole?.is_system ? 'Mã vai trò hệ thống được cố định' : 'Tự động sinh khi nhập tên vai trò'}
              >
                <Input placeholder="bac_si_thu_y" disabled={editingRole?.is_system} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="color" label="Màu sắc nhãn thẻ" rules={[{ required: true }]}>
                <Select options={ROLE_COLOR_OPTIONS} />
              </Form.Item>
            </Col>
          </Row>

          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 13, color: '#64748b', marginRight: 12 }}>Xem trước nhãn thẻ:</span>
            <Form.Item noStyle shouldUpdate={(prev, curr) => prev.name !== curr.name || prev.color !== curr.color}>
              {({ getFieldValue }) => (
                <Tag color={getFieldValue('color') || 'blue'} style={{ fontSize: 13, padding: '3px 10px' }}>
                  {getFieldValue('name') || 'Tên vai trò'}
                </Tag>
              )}
            </Form.Item>
          </div>

          <Form.Item name="description" label="Mô tả trách nhiệm & công việc">
            <Input.TextArea rows={3} placeholder="Mô tả ngắn gọn phạm vi trách nhiệm của vai trò này..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== MODAL XEM CHI TIẾT VAI TRÒ ===== */}
      <Modal
        centered
        title={
          <Space>
            <SafetyCertificateOutlined style={{ color: '#0f8b8d' }} />
            <span>Chi tiết vai trò: {viewingRole?.name}</span>
          </Space>
        }
        open={roleDetailModalOpen}
        onCancel={() => setRoleDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setRoleDetailModalOpen(false)}>
            Đóng
          </Button>,
          isManager && (
            <Button
              key="edit"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                const target = viewingRole
                setRoleDetailModalOpen(false)
                openRoleModal(target)
              }}
            >
              Chỉnh sửa vai trò
            </Button>
          ),
        ]}
        width={580}
      >
        {viewingRole && (
          <div>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 16,
                padding: '14px 16px',
                background: '#f8fafc',
                borderRadius: 12,
                border: '1px solid #e2e8f0',
              }}
            >
              <div>
                <Space>
                  <Tag color={viewingRole.color || 'blue'} style={{ fontSize: 14, padding: '3px 12px', fontWeight: 600 }}>
                    {viewingRole.name}
                  </Tag>
                  {viewingRole.is_system ? (
                    <Tag color="cyan">Hệ thống mặc định</Tag>
                  ) : (
                    <Tag color="green">Vai trò tùy chỉnh</Tag>
                  )}
                </Space>
                <div style={{ marginTop: 6 }}>
                  <Text type="secondary" style={{ fontSize: 13 }}>Mã vai trò (Code): </Text>
                  <Text code>{viewingRole.code}</Text>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13, color: '#334155' }}>Mô tả trách nhiệm & công việc:</Text>
              <div
                style={{
                  marginTop: 6,
                  padding: '12px 14px',
                  background: '#fcfcfc',
                  border: '1px solid #f1f5f9',
                  borderRadius: 8,
                  color: '#475569',
                  lineHeight: 1.6,
                }}
              >
                {viewingRole.description || <Text type="secondary">Chưa có mô tả chi tiết cho vai trò này.</Text>}
              </div>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text strong style={{ fontSize: 13, color: '#334155' }}>
                  <UserOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                  Nhân sự đang đảm nhận vai trò này ({
                    staffList.filter((st) => (staffRoleMap[st.id] || st.role) === viewingRole.code).length
                  })
                </Text>
              </div>

              {(() => {
                const assigned = staffList.filter((st) => (staffRoleMap[st.id] || st.role) === viewingRole.code)
                if (assigned.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '16px 0', background: '#f8fafc', borderRadius: 8 }}>
                      <Text type="secondary">Hiện chưa có nhân sự nào được gán vai trò này.</Text>
                    </div>
                  )
                }
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {assigned.map((st) => (
                      <div
                        key={st.id}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 12px',
                          background: '#f8fafc',
                          borderRadius: 8,
                          border: '1px solid #e2e8f0',
                        }}
                      >
                        <UserOutlined style={{ color: '#0f8b8d' }} />
                        <div>
                          <Text strong style={{ fontSize: 13 }}>{st.full_name || st.username}</Text>
                          <Text type="secondary" style={{ fontSize: 11, marginLeft: 4 }}>@{st.username}</Text>
                        </div>
                        {st.phone && <Text type="secondary" style={{ fontSize: 11 }}>• {st.phone}</Text>}
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* ===== MODAL THÊM / SỬA CHUYÊN MÔN ===== */}
      <Modal
        centered
        title={editingSpec ? `Chỉnh sửa chuyên môn: ${editingSpec.name_vi}` : 'Thêm chuyên môn tay nghề mới'}
        open={specModalOpen}
        onCancel={() => setSpecModalOpen(false)}
        onOk={saveSpecialty}
        okText="Lưu chuyên môn"
      >
        <Form form={specForm} layout="vertical">
          <Form.Item
            name="name_vi"
            label="Tên chuyên môn tay nghề"
            rules={[{ required: true, message: 'Vui lòng nhập tên chuyên môn' }]}
          >
            <Input placeholder="Ví dụ: Tắm & Vệ sinh toàn diện, Cắt tỉa Poodle tạo kiểu..." />
          </Form.Item>

          <Form.Item
            name="code"
            label="Mã chuyên môn (Code)"
            rules={[
              { required: true, message: 'Vui lòng nhập mã chuyên môn' },
              { pattern: /^[a-z0-9_]+$/, message: 'Mã chỉ gồm chữ thường không dấu và gạch dưới' },
            ]}
            extra="Dùng để liên kết với yêu cầu kỹ thuật của dịch vụ spa (ví dụ: tam_ve_sinh, cat_tia_poodle)"
          >
            <Input placeholder="tam_ve_sinh" />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== MODAL CA LÀM & NGÀY NGHỈ ===== */}
      <Modal
        centered
        title={`Lịch làm việc & Ngày nghỉ: ${shiftStaff?.full_name || shiftStaff?.username}`}
        open={shiftModalOpen}
        onCancel={() => setShiftModalOpen(false)}
        footer={null}
        width={600}
      >
        <Tabs
          items={[
            {
              key: 'shifts',
              label: 'Ca làm việc trong tuần',
              children: (
                <div>
                  <Alert
                    type="info"
                    showIcon
                    message="Quy định ca làm việc"
                    description="Kỹ thuật viên có ca làm hợp lệ mới được phân công vào lịch hẹn của khách."
                    style={{ marginBottom: 16 }}
                  />
                  {shifts.length > 0 ? (
                    shifts.map((s) => (
                      <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}>
                        <Text strong>{WEEKDAYS[s.weekday]}</Text>
                        <Tag color="cyan">{s.start_time?.slice(0, 5)} – {s.end_time?.slice(0, 5)}</Tag>
                      </div>
                    ))
                  ) : <Empty description="Chưa có ca làm việc nào được cấu hình." />}
                </div>
              ),
            },
            {
              key: 'timeoff',
              label: 'Đăng ký ngày nghỉ',
              children: (
                <div>
                  <Form form={timeOffForm} layout="vertical" onFinish={addTimeOff} style={{ marginBottom: 16 }}>
                    <Row gutter={12}>
                      <Col span={14}>
                        <Form.Item name="range" label="Khoảng ngày nghỉ" rules={[{ required: true, message: 'Chọn ngày' }]}>
                          <DatePicker.RangePicker format="YYYY-MM-DD" style={{ width: '100%' }} />
                        </Form.Item>
                      </Col>
                      <Col span={10}>
                        <Form.Item name="reason" label="Lý do nghỉ"><Input placeholder="Việc riêng / Khám bệnh..." /></Form.Item>
                      </Col>
                    </Row>
                    <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>Thêm ngày nghỉ</Button>
                  </Form>

                  <Table
                    dataSource={timeOffList}
                    rowKey="id"
                    size="small"
                    pagination={false}
                    columns={[
                      { title: 'Từ ngày', dataIndex: 'date_from' },
                      { title: 'Đến ngày', dataIndex: 'date_to' },
                      { title: 'Lý do', dataIndex: 'reason', render: (r) => r || '—' },
                      {
                        title: '',
                        key: 'del',
                        width: 50,
                        render: (_, to) => (
                          <Popconfirm title="Xóa ngày nghỉ này?" onConfirm={() => deleteTimeOff(to.id)}>
                            <Button danger type="text" size="small" icon={<DeleteOutlined />} />
                          </Popconfirm>
                        ),
                      },
                    ]}
                  />
                </div>
              ),
            },
          ]}
        />
      </Modal>

      {/* ===== MODAL THÊM TÀI NGUYÊN ===== */}
      <Modal
        centered
        title="Thêm vị trí tài nguyên cơ sở vật chất"
        open={resModalOpen}
        onCancel={() => setResModalOpen(false)}
        onOk={saveResource}
        okText="Thêm mới"
      >
        <Form form={resForm} layout="vertical">
          <Form.Item name="name" label="Tên tài nguyên" rules={[{ required: true, message: 'Nhập tên' }]}>
            <Input placeholder="Ví dụ: Bàn cắt 4, Chuồng sấy 5..." />
          </Form.Item>
          <Form.Item name="resource_type" label="Loại tài nguyên" rules={[{ required: true }]}>
            <Select
              options={[
                { value: 'bath_tub', label: 'Bồn tắm' },
                { value: 'grooming_table', label: 'Bàn cắt tỉa' },
                { value: 'drying_cage', label: 'Chuồng sấy' },
                { value: 'spa_room', label: 'Phòng spa' },
              ]}
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== MODAL ĐẶT LẠI MẬT KHẨU NHÂN SỰ ===== */}
      <Modal
        centered
        title={`Đặt lại mật khẩu cho: ${resetTargetUser?.full_name || ''} (${resetTargetUser?.username || ''})`}
        open={resetModalOpen}
        onCancel={() => setResetModalOpen(false)}
        onOk={handleResetPassword}
        okText="Cập nhật mật khẩu"
        confirmLoading={resetBusy}
      >
        <Form form={resetForm} layout="vertical">
          <Paragraph type="secondary" style={{ marginBottom: 14 }}>
            Nhập mật khẩu mới cho nhân viên. Sau khi đổi, các phiên đăng nhập cũ của nhân viên này sẽ bị hủy và yêu cầu đăng nhập lại.
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
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
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
    </div>
  )
}
