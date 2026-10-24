import { useEffect, useState, useCallback, useMemo } from 'react'
import {
  Alert, Avatar, Button, Card, Checkbox, Col, DatePicker, Divider, Dropdown, Empty, Form, Input, Modal, Popconfirm, Row,
  Select, Space, Switch, Table, Tabs, Tag, TimePicker, Tooltip, Typography, message,
} from 'antd'
import {
  CalendarOutlined, ClockCircleOutlined, DeleteOutlined, EditOutlined, EnvironmentOutlined, ExclamationCircleOutlined,
  IdcardOutlined, LockOutlined, MailOutlined, MoreOutlined, PhoneOutlined, PlusOutlined, ReloadOutlined,
  SafetyCertificateOutlined, SearchOutlined, TagOutlined, ThunderboltOutlined, ToolOutlined, UserAddOutlined, UserOutlined,
} from '@ant-design/icons'
import dayjs from 'dayjs'
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

const SPECIES_SCOPE_MAP = {
  both: { label: 'Chó & Mèo', color: 'cyan', icon: '🐶🐱' },
  dog: { label: 'Chó', color: 'blue', icon: '🐶' },
  cat: { label: 'Mèo', color: 'orange', icon: '🐱' },
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

// Chuyển tiếng Việt có dấu sang chuỗi không dấu an toàn
const removeVietnameseAccents = (str) => {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
}

// Sinh các biến thể tên đăng nhập thông minh từ Họ và tên
const generateUsernameVariants = (fullName) => {
  const clean = removeVietnameseAccents(fullName).toLowerCase()
  if (!clean) return []

  const words = clean.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  // 1. Viết liền toàn bộ: vd "Nghien Kieu" -> "nghienkieu", "Nguyen Van An" -> "nguyenvanan"
  const fullConcat = words.join('')

  // 2. Tên + viết tắt họ đệm: vd "Nguyen Van An" -> "annv", "Nghien Kieu" -> "kieun"
  let nameInitials = ''
  if (words.length > 1) {
    const lastName = words[words.length - 1]
    const initials = words.slice(0, -1).map((w) => w[0]).join('')
    nameInitials = `${lastName}${initials}`
  }

  // 3. Dạng gạch dưới: vd "Nghien Kieu" -> "nghien_kieu"
  const fullSnake = words.join('_')

  return [fullConcat, nameInitials, fullSnake].filter(
    (v, i, arr) => v && arr.indexOf(v) === i
  )
}

// Lấy username chưa bị trùng trong hệ thống
const getAvailableUsername = (baseUsername, existingUsernames = []) => {
  if (!baseUsername) return ''
  let candidate = baseUsername
  let counter = 1
  const set = new Set((existingUsernames || []).map((u) => (u || '').toLowerCase()))
  while (set.has(candidate.toLowerCase())) {
    candidate = `${baseUsername}${counter}`
    counter++
  }
  return candidate
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
  const [isUsernameCustomized, setIsUsernameCustomized] = useState(false)
  const [staffDetailModalOpen, setStaffDetailModalOpen] = useState(false)
  const [viewingStaff, setViewingStaff] = useState(null)

  // Tìm kiếm & Bộ lọc Nhân sự
  const [staffSearch, setStaffSearch] = useState('')
  const [staffRoleFilter, setStaffRoleFilter] = useState('all')
  const [staffStatusFilter, setStaffStatusFilter] = useState('all')
  const [staffSort, setStaffSort] = useState('name_asc')

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

  // Tìm kiếm & Bộ lọc Vai trò
  const [roleSearch, setRoleSearch] = useState('')
  const [roleTypeFilter, setRoleTypeFilter] = useState('all')

  // Chuyên môn tay nghề
  const [specModalOpen, setSpecModalOpen] = useState(false)
  const [editingSpec, setEditingSpec] = useState(null)
  const [specForm] = Form.useForm()
  const [specPage, setSpecPage] = useState(1)
  const [specPageSize, setSpecPageSize] = useState(10)
  const [specSearch, setSpecSearch] = useState('')
  const [specSpeciesFilter, setSpecSpeciesFilter] = useState('all')
  const [specDetailModalOpen, setSpecDetailModalOpen] = useState(false)
  const [viewingSpec, setViewingSpec] = useState(null)

  // Ca làm việc & Ngày nghỉ
  const [shiftModalOpen, setShiftModalOpen] = useState(false)
  const [shiftStaff, setShiftStaff] = useState(null)
  const [shifts, setShifts] = useState([])
  const [timeOffList, setTimeOffList] = useState([])
  const [timeOffForm] = Form.useForm()
  const [weeklyShifts, setWeeklyShifts] = useState([
    { weekday: 0, enabled: true, start_time: '08:00', end_time: '19:00' },
    { weekday: 1, enabled: true, start_time: '08:00', end_time: '19:00' },
    { weekday: 2, enabled: true, start_time: '08:00', end_time: '19:00' },
    { weekday: 3, enabled: true, start_time: '08:00', end_time: '19:00' },
    { weekday: 4, enabled: true, start_time: '08:00', end_time: '19:00' },
    { weekday: 5, enabled: true, start_time: '08:00', end_time: '19:00' },
    { weekday: 6, enabled: true, start_time: '08:00', end_time: '19:00' },
  ])
  const [shiftSaving, setShiftSaving] = useState(false)

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
  const [editingRes, setEditingRes] = useState(null)
  const [resForm] = Form.useForm()

  // Tìm kiếm & Bộ lọc Tài nguyên
  const [resSearch, setResSearch] = useState('')
  const [resTypeFilter, setResTypeFilter] = useState('all')
  const [resStatusFilter, setResStatusFilter] = useState('all')

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

  // Lọc dữ liệu Nhân sự
  const filteredStaffList = useMemo(() => {
    return staffList
      .filter((st) => {
        const q = staffSearch.trim().toLowerCase()
        const matchSearch =
          !q ||
          (st.full_name || '').toLowerCase().includes(q) ||
          (st.username || '').toLowerCase().includes(q) ||
          (st.phone || '').toLowerCase().includes(q) ||
          (st.email || '').toLowerCase().includes(q)

        const effectiveRole = staffRoleMap[st.id] || st.role
        const matchRole =
          staffRoleFilter === 'all' ||
          effectiveRole === staffRoleFilter ||
          st.role === staffRoleFilter

        const matchStatus =
          staffStatusFilter === 'all' ||
          (staffStatusFilter === 'active' ? st.is_active : !st.is_active)

        return matchSearch && matchRole && matchStatus
      })
      .sort((a, b) => {
        if (staffSort === 'name_asc') {
          return (a.full_name || a.username).localeCompare(b.full_name || b.username, 'vi')
        }
        if (staffSort === 'name_desc') {
          return (b.full_name || b.username).localeCompare(a.full_name || a.username, 'vi')
        }
        if (staffSort === 'newest') {
          return (b.id || 0) - (a.id || 0)
        }
        return 0
      })
  }, [staffList, staffSearch, staffRoleFilter, staffStatusFilter, staffSort, staffRoleMap])

  // Lọc danh sách Vai trò
  const filteredRoles = useMemo(() => {
    return roles.filter((r) => {
      const q = roleSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        (r.name || '').toLowerCase().includes(q) ||
        (r.code || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)

      const matchType =
        roleTypeFilter === 'all' ||
        (roleTypeFilter === 'system' ? r.is_system : !r.is_system)

      return matchSearch && matchType
    })
  }, [roles, roleSearch, roleTypeFilter])

  // Lọc danh sách Chuyên môn
  const filteredSpecialties = useMemo(() => {
    return specialties.filter((s) => {
      const q = specSearch.trim().toLowerCase()
      const matchSearch =
        !q ||
        (s.name_vi || '').toLowerCase().includes(q) ||
        (s.description || '').toLowerCase().includes(q)
      const matchSpecies =
        specSpeciesFilter === 'all' ||
        s.species_scope === specSpeciesFilter ||
        (specSpeciesFilter !== 'both' && s.species_scope === 'both')
      return matchSearch && matchSpecies
    })
  }, [specialties, specSearch, specSpeciesFilter])

  // Lọc danh sách Tài nguyên
  const filteredResources = useMemo(() => {
    return resources.filter((r) => {
      const q = resSearch.trim().toLowerCase()
      const matchSearch = !q || (r.name || '').toLowerCase().includes(q)
      const matchType = resTypeFilter === 'all' || r.resource_type === resTypeFilter
      const matchStatus =
        resStatusFilter === 'all' ||
        (resStatusFilter === 'active' ? r.is_active : !r.is_active)
      return matchSearch && matchType && matchStatus
    })
  }, [resources, resSearch, resTypeFilter, resStatusFilter])

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
    setIsUsernameCustomized(false)
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
        gender: st.gender || 'male',
        birthday: st.birthday ? dayjs(st.birthday) : null,
        address: st.address || '',
      })
    } else {
      staffForm.setFieldsValue({
        role: 'technician',
        is_active: true,
        gender: 'male',
        birthday: null,
        address: '',
      })
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
        birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : null,
        gender: values.gender || 'other',
        address: values.address ? values.address.trim() : '',
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

  // Khóa / Mở khóa nhân viên
  const toggleStaffActive = async (st) => {
    if (st.user_id === user?.id || st.username === user?.username) {
      message.warning('Bạn không thể tự khóa tài khoản của chính mình.')
      return
    }

    const doToggle = async () => {
      try {
        if (st.is_active) {
          await api(`/staff/${st.id}`, { method: 'DELETE' })
        } else {
          await api(`/staff/${st.id}`, { method: 'PATCH', body: JSON.stringify({ is_active: true }) })
        }
        message.success(`Đã ${st.is_active ? 'khóa' : 'kích hoạt'} tài khoản nhân viên ${st.full_name || st.username}`)
        loadStaff()
      } catch (e) {
        message.error(e.message || 'Thao tác không thành công')
      }
    }

    if (st.is_active) {
      Modal.confirm({
        title: `Khóa tài khoản ${st.full_name || st.username}?`,
        icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
        content: 'Nhân viên này sẽ không thể đăng nhập vào hệ thống spa nữa.',
        okText: 'Khóa tài khoản',
        okType: 'danger',
        cancelText: 'Hủy',
        centered: true,
        onOk: doToggle,
      })
    } else {
      doToggle()
    }
  }

  // Quản lý ca làm & ngày nghỉ
  const openShifts = async (st) => {
    setShiftStaff(st)
    setShiftModalOpen(true)
    setShiftSaving(false)
    try {
      const [shs, tos] = await Promise.all([
        api(`/staff/${st.id}/shifts`),
        api(`/staff/${st.id}/time-off`),
      ])
      const shList = unwrap(shs) || []
      const toList = unwrap(tos) || []
      setShifts(shList)
      setTimeOffList(toList)

      const initialWeekly = Array.from({ length: 7 }, (_, i) => {
        const found = shList.find((s) => s.weekday === i)
        return {
          weekday: i,
          enabled: !!found,
          start_time: found?.start_time ? found.start_time.slice(0, 5) : '08:00',
          end_time: found?.end_time ? found.end_time.slice(0, 5) : '19:00',
        }
      })
      setWeeklyShifts(initialWeekly)
    } catch {
      // ignore
    }
  }

  // Áp dụng cấu hình ca nhanh
  const applyShiftPreset = (type) => {
    setWeeklyShifts((prev) =>
      prev.map((d) => {
        if (type === 'all') {
          return { ...d, enabled: true, start_time: '08:00', end_time: '19:00' }
        }
        if (type === 'mon_sat') {
          return { ...d, enabled: d.weekday < 6, start_time: '08:00', end_time: '19:00' }
        }
        if (type === 'mon_fri') {
          return { ...d, enabled: d.weekday < 5, start_time: '08:00', end_time: '18:00' }
        }
        return d
      })
    )
  }

  // Lưu lịch ca làm việc trong tuần
  const saveShifts = async () => {
    if (!shiftStaff) return
    setShiftSaving(true)
    try {
      const payload = weeklyShifts
        .filter((d) => d.enabled)
        .map((d) => ({
          weekday: d.weekday,
          start_time: d.start_time,
          end_time: d.end_time,
        }))
      const updated = await api(`/staff/${shiftStaff.id}/shifts`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      })
      const data = unwrap(updated) || payload
      setShifts(data)
      message.success(`Đã cập nhật ca làm việc cho ${shiftStaff.full_name || shiftStaff.username}!`)
    } catch (e) {
      message.error(e.message || 'Lỗi khi cập nhật ca làm việc')
    } finally {
      setShiftSaving(false)
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
      setTimeOffList(unwrap(tos) || [])
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
      const roleName = values.name.trim()

      if (editingRole) {
        // Cập nhật vai trò (Vai trò hệ thống giữ nguyên tên, mã)
        const updatedName = editingRole.is_system ? editingRole.name : roleName
        const updated = roles.map((r) => {
          if (r.code === editingRole.code) {
            return {
              ...r,
              name: updatedName,
              description: values.description || '',
              color: values.color,
            }
          }
          return r
        })
        persistRoles(updated)
        if (viewingRole?.code === editingRole.code) {
          setViewingRole(updated.find((r) => r.code === editingRole.code))
        }
        message.success(`Đã cập nhật vai trò "${updatedName}"!`)
      } else {
        // Tự động sinh mã vai trò chuẩn hóa ở BE / nền mà không cần người dùng nhập
        let baseCode = toSlug(roleName) || 'vai_tro'
        let codeClean = baseCode
        let counter = 1
        while (roles.some((r) => r.code === codeClean)) {
          codeClean = `${baseCode}_${counter++}`
        }

        const newRole = {
          code: codeClean,
          name: roleName,
          base_role: 'technician',
          description: values.description || '',
          color: values.color,
          is_system: false,
        }
        persistRoles([...roles, newRole])
        message.success(`Đã thêm vai trò mới "${roleName}"!`)
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
            Bạn có chắc chắn muốn xóa vai trò <b>"{role.name}"</b> không?
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
  const openSpecDetails = (spec) => {
    setViewingSpec(spec)
    setSpecDetailModalOpen(true)
  }

  const openSpecModal = (spec = null) => {
    setEditingSpec(spec)
    specForm.resetFields()
    if (spec) {
      specForm.setFieldsValue({
        name_vi: spec.name_vi,
        species_scope: spec.species_scope || 'both',
        description: spec.description || '',
      })
    } else {
      specForm.setFieldsValue({
        species_scope: 'both',
        description: '',
      })
    }
    setSpecModalOpen(true)
  }

  const saveSpecialty = async () => {
    try {
      const values = await specForm.validateFields()
      const nameVi = values.name_vi.trim()

      if (editingSpec) {
        const payload = {
          name_vi: nameVi,
          species_scope: values.species_scope || 'both',
          description: (values.description || '').trim(),
        }
        await api(`/specialties/${editingSpec.id}`, { method: 'PATCH', body: JSON.stringify(payload) })
        if (viewingSpec?.id === editingSpec.id) {
          setViewingSpec({ ...viewingSpec, ...payload })
        }
        message.success(`Cập nhật chuyên môn "${nameVi}" thành công!`)
      } else {
        // Tự động sinh mã chuyên môn chuẩn hóa ngầm ở BE mà không cần người dùng nhập
        let baseCode = toSlug(nameVi) || 'chuyen_mon'
        let codeClean = baseCode
        let counter = 1
        while (specialties.some((s) => s.code === codeClean)) {
          codeClean = `${baseCode}_${counter++}`
        }
        const payload = {
          name_vi: nameVi,
          code: codeClean,
          species_scope: values.species_scope || 'both',
          description: (values.description || '').trim(),
        }
        await api('/specialties', { method: 'POST', body: JSON.stringify(payload) })
        message.success(`Thêm chuyên môn mới "${nameVi}" thành công!`)
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
            Bạn có chắc chắn muốn xóa chuyên môn <b>"{spec.name_vi}"</b> không?
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
  const openResModal = (r = null) => {
    setEditingRes(r)
    resForm.resetFields()
    if (r) {
      resForm.setFieldsValue({
        name: r.name,
        resource_type: r.resource_type,
      })
    } else {
      resForm.setFieldsValue({
        resource_type: 'bath_tub',
      })
    }
    setResModalOpen(true)
  }

  const saveResource = async () => {
    try {
      const v = await resForm.validateFields()
      if (editingRes) {
        await api(`/resources/${editingRes.id}`, {
          method: 'PATCH',
          body: JSON.stringify(v),
        })
        message.success(`Cập nhật tài nguyên "${v.name}" thành công!`)
      } else {
        await api('/resources', {
          method: 'POST',
          body: JSON.stringify(v),
        })
        message.success(`Đã thêm tài nguyên mới "${v.name}"!`)
      }
      setResModalOpen(false)
      resForm.resetFields()
      loadResources()
    } catch (e) {
      message.error(e.message || 'Lỗi khi lưu tài nguyên')
    }
  }

  const confirmDeleteResource = (r) => {
    Modal.confirm({
      title: 'Xác nhận xóa cơ sở vật chất',
      icon: <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />,
      content: (
        <div>
          <Paragraph style={{ marginBottom: 8 }}>
            Bạn có chắc chắn muốn xóa vĩnh viễn cơ sở vật chất <b>"{r.name}"</b> ({RESOURCE_TYPE_MAP[r.resource_type]?.label || r.resource_type}) không?
          </Paragraph>
          <Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 0 }}>
            Hành động này sẽ xóa hoàn toàn cơ sở vật chất khỏi hệ thống. Nếu đang có lịch hẹn sắp tới sử dụng tài nguyên này, hệ thống sẽ ngăn chặn để đảm bảo an toàn.
          </Paragraph>
        </div>
      ),
      okText: 'Xác nhận xóa',
      okType: 'danger',
      cancelText: 'Hủy',
      async onOk() {
        try {
          await api(`/resources/${r.id}`, { method: 'DELETE' })
          message.success(`Đã xóa cơ sở vật chất "${r.name}" thành công!`)
          loadResources()
        } catch (e) {
          message.error(e.message || 'Lỗi khi xóa cơ sở vật chất')
        }
      },
    })
  }

  const toggleResourceActive = async (r) => {
    try {
      await api(`/resources/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !r.is_active }),
      })
      message.success(`Đã ${!r.is_active ? 'kích hoạt' : 'tạm ngưng'} tài nguyên "${r.name}"`)
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar style={{ background: '#0f8b8d', flexShrink: 0 }} icon={<UserOutlined />} />
          <div>
            <Text strong style={{ fontSize: 14, color: '#0b3d3f', display: 'block' }}>{st.full_name || st.username}</Text>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 3, flexWrap: 'wrap' }}>
              {st.gender && st.gender !== 'other' && (
                <Tag
                  color={st.gender === 'male' ? 'blue' : 'magenta'}
                  style={{ fontSize: 11, lineHeight: '18px', padding: '0 6px', margin: 0, borderRadius: 4 }}
                >
                  {st.gender === 'male' ? 'Nam' : 'Nữ'}
                </Tag>
              )}
              {st.birthday && (
                <Text type="secondary" style={{ fontSize: 12 }}>
                  {dayjs(st.birthday).format('DD/MM/YYYY')} ({dayjs().diff(dayjs(st.birthday), 'year')}t)
                </Text>
              )}
            </div>
          </div>
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
          {st.email && <Text type="secondary" style={{ fontSize: 12 }}>{st.email}</Text>}
          {st.address && (
            <div style={{ fontSize: 12, color: '#64748b', marginTop: 2, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={st.address}>
              📍 {st.address}
            </div>
          )}
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
      render: (active, st) => {
        const isSelf = st.user_id === user?.id || st.username === user?.username
        return (
          <span onClick={(e) => e.stopPropagation()}>
            <Tooltip title={isSelf ? 'Không thể tự khóa tài khoản đang đăng nhập' : ''}>
              <Switch
                checked={active}
                disabled={!isManager || isSelf}
                onClick={(_, e) => e?.stopPropagation?.()}
                onChange={() => toggleStaffActive(st)}
                checkedChildren="Hoạt động"
                unCheckedChildren="Đã khóa"
              />
            </Tooltip>
          </span>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 120,
      render: (_, st) => {
        const isSelf = st.user_id === user?.id || st.username === user?.username
        const moreItems = [
          {
            key: 'shifts',
            label: 'Lịch ca & Nghỉ phép',
            icon: <ClockCircleOutlined />,
            onClick: () => openShifts(st),
          },
          {
            key: 'detail',
            label: 'Xem hồ sơ chi tiết',
            icon: <IdcardOutlined />,
            onClick: () => {
              setViewingStaff(st)
              setStaffDetailModalOpen(true)
            },
          },
          ...(isManager
            ? [
                {
                  type: 'divider',
                },
                {
                  key: 'reset-pwd',
                  label: 'Đổi mật khẩu',
                  icon: <LockOutlined />,
                  onClick: () => {
                    setResetTargetUser(st)
                    resetForm.resetFields()
                    setResetModalOpen(true)
                  },
                },
                ...(!isSelf
                  ? [
                      {
                        key: 'toggle-active',
                        label: st.is_active ? 'Khóa tài khoản' : 'Kích hoạt tài khoản',
                        icon: <LockOutlined />,
                        danger: st.is_active,
                        onClick: () => toggleStaffActive(st),
                      },
                    ]
                  : []),
              ]
            : []),
        ]

        return (
          <Space size={6} onClick={(e) => e.stopPropagation()}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation()
                if (isManager) {
                  openStaffModal(st)
                } else {
                  setViewingStaff(st)
                  setStaffDetailModalOpen(true)
                }
              }}
              style={{ borderRadius: 6 }}
            >
              {isManager ? 'Sửa' : 'Xem'}
            </Button>
            <span onClick={(e) => e.stopPropagation()}>
              <Dropdown
                menu={{ items: moreItems }}
                trigger={['click']}
                placement="bottomRight"
              >
                <Button
                  size="small"
                  icon={<MoreOutlined />}
                  style={{ borderRadius: 6, padding: '0 8px' }}
                />
              </Dropdown>
            </span>
          </Space>
        )
      },
    },
  ]

  // Bảng vai trò
  const roleColumns = [
    {
      title: 'Tên vai trò',
      dataIndex: 'name',
      key: 'name',
      width: 220,
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
      title: 'Mô tả vai trò',
      dataIndex: 'description',
      key: 'description',
      render: (desc) => desc || <Text type="secondary">—</Text>,
    },
    {
      title: 'Nhân sự đảm nhận',
      key: 'staff_count',
      width: 180,
      render: (_, r) => {
        const count = staffList.filter((st) => (staffRoleMap[st.id] || st.role) === r.code).length
        return (
          <Tag color={count > 0 ? 'cyan' : 'default'} style={{ fontSize: 12 }}>
            {count} nhân sự
          </Tag>
        )
      },
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
      width: 200,
      render: (name) => <Text strong style={{ color: '#0f8b8d', fontSize: 14 }}>{name}</Text>,
    },
    {
      title: 'Áp dụng loài',
      dataIndex: 'species_scope',
      key: 'species_scope',
      width: 140,
      render: (scope) => {
        const item = SPECIES_SCOPE_MAP[scope] || SPECIES_SCOPE_MAP.both
        return (
          <Tag color={item.color} style={{ fontSize: 12, padding: '2px 8px', borderRadius: 6 }}>
            {item.icon} {item.label}
          </Tag>
        )
      },
    },
    {
      title: 'Mô tả phạm vi kỹ năng & công việc',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (desc) => (
        <Tooltip title={desc || 'Chưa có mô tả chi tiết'}>
          <Text
            ellipsis
            style={{
              color: '#475569',
              fontSize: 13,
              maxWidth: 380,
              display: 'inline-block',
            }}
          >
            {desc || <Text type="secondary" italic>Chưa có mô tả chi tiết</Text>}
          </Text>
        </Tooltip>
      ),
    },
    {
      title: 'Số nhân sự sở hữu',
      key: 'staff_count',
      width: 160,
      render: (_, spec) => {
        const count = staffList.filter((st) => (st.specialties || []).includes(spec.id)).length
        return (
          <Tag color={count > 0 ? 'geekblue' : 'default'} style={{ fontSize: 12 }}>
            {count} kỹ thuật viên
          </Tag>
        )
      },
    },
    {
      title: 'Thao tác',
      key: 'act',
      width: 130,
      render: (_, spec) => (
        <Space onClick={(e) => e.stopPropagation()}>
          <Button
            size="small"
            icon={<EditOutlined />}
            onClick={(e) => {
              e.stopPropagation()
              openSpecModal(spec)
            }}
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
              onClick={(e) => {
                e.stopPropagation()
                confirmDeleteSpecialty(spec)
              }}
            />
          </Tooltip>
        </Space>
      ),
    },
  ]

  // Bảng tài nguyên
  const resColumns = [
    {
      title: 'Tên tài nguyên',
      dataIndex: 'name',
      key: 'name',
      render: (n) => <Text strong style={{ fontSize: 14 }}>{n}</Text>,
    },
    {
      title: 'Phân loại',
      dataIndex: 'resource_type',
      key: 'resource_type',
      render: (t) => {
        const item = RESOURCE_TYPE_MAP[t] || { label: t, color: 'default' }
        return <Tag color={item.color} style={{ fontSize: 13, padding: '2px 8px' }}>{item.label}</Tag>
      },
    },
    {
      title: 'Trạng thái hoạt động',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active, r) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={active}
            disabled={!isManager}
            onClick={(_, e) => e?.stopPropagation?.()}
            onChange={() => toggleResourceActive(r)}
            checkedChildren="Sẵn sàng"
            unCheckedChildren="Tạm ngưng"
          />
        </span>
      ),
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
              openResModal(r)
            }}
            disabled={!isManager}
          >
            Sửa
          </Button>
          <Tooltip title="Xóa vĩnh viễn cơ sở vật chất">
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
              disabled={!isManager}
              onClick={(e) => {
                e.stopPropagation()
                confirmDeleteResource(r)
              }}
            />
          </Tooltip>
        </Space>
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
              {activeTab === 'staff' && (
                <Button type="primary" icon={<UserAddOutlined />} onClick={() => openStaffModal(null)}>
                  Thêm nhân viên
                </Button>
              )}
              {activeTab === 'roles' && (
                <Button type="primary" icon={<SafetyCertificateOutlined />} onClick={() => openRoleModal(null)}>
                  Thêm vai trò mới
                </Button>
              )}
              {activeTab === 'specialties' && (
                <Button type="primary" icon={<TagOutlined />} onClick={() => openSpecModal(null)}>
                  Thêm chuyên môn mới
                </Button>
              )}
              {activeTab === 'resources' && (
                <Button type="primary" icon={<ToolOutlined />} onClick={() => openResModal(null)}>
                  Thêm tài nguyên mới
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
                {/* Thanh tìm kiếm & bộ lọc Nhân sự */}
                <div
                  style={{
                    background: '#fff',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid #e8f0f0',
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <Space wrap size={10} style={{ flex: 1 }}>
                    <Input
                      placeholder="Tìm theo họ tên, @username, SĐT, email..."
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      allowClear
                      value={staffSearch}
                      onChange={(e) => {
                        setStaffSearch(e.target.value)
                        setStaffPage(1)
                      }}
                      style={{ width: 280 }}
                    />

                    <Select
                      placeholder="Vai trò nhân sự"
                      value={staffRoleFilter}
                      onChange={(val) => {
                        setStaffRoleFilter(val)
                        setStaffPage(1)
                      }}
                      style={{ width: 170 }}
                      options={[
                        { value: 'all', label: 'Tất cả vai trò' },
                        ...roles.map((r) => ({
                          value: r.code,
                          label: `${r.name}${r.is_system ? ' (Hệ thống)' : ''}`,
                        })),
                      ]}
                    />

                    <Select
                      placeholder="Trạng thái"
                      value={staffStatusFilter}
                      onChange={(val) => {
                        setStaffStatusFilter(val)
                        setStaffPage(1)
                      }}
                      style={{ width: 160 }}
                      options={[
                        { value: 'all', label: 'Tất cả trạng thái' },
                        { value: 'active', label: '🟢 Đang hoạt động' },
                        { value: 'inactive', label: '🔴 Đã khóa' },
                      ]}
                    />

                    <Select
                      placeholder="Sắp xếp"
                      value={staffSort}
                      onChange={(val) => setStaffSort(val)}
                      style={{ width: 150 }}
                      options={[
                        { value: 'name_asc', label: 'Tên: A → Z' },
                        { value: 'name_desc', label: 'Tên: Z → A' },
                        { value: 'newest', label: 'Mới nhất' },
                      ]}
                    />
                  </Space>

                  <Space size={12}>
                    <Text type="secondary" style={{ fontSize: 13 }}>
                      Tổng số: <b>{filteredStaffList.length}</b> / {staffList.length} nhân sự
                    </Text>
                    <RowPerPageSelect value={staffPageSize} onChange={(ps) => { setStaffPageSize(ps); setStaffPage(1) }} />
                  </Space>
                </div>

                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={filteredStaffList}
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
                {/* Thanh tìm kiếm & bộ lọc Vai trò */}
                <div
                  style={{
                    background: '#fff',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid #e8f0f0',
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <Space wrap size={10} style={{ flex: 1 }}>
                    <Input
                      placeholder="Tìm theo tên vai trò, mô tả..."
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      allowClear
                      value={roleSearch}
                      onChange={(e) => {
                        setRoleSearch(e.target.value)
                        setRolePage(1)
                      }}
                      style={{ width: 280 }}
                    />

                    <Select
                      placeholder="Loại vai trò"
                      value={roleTypeFilter}
                      onChange={(val) => {
                        setRoleTypeFilter(val)
                        setRolePage(1)
                      }}
                      style={{ width: 170 }}
                      options={[
                        { value: 'all', label: 'Tất cả loại vai trò' },
                        { value: 'system', label: '🔒 Hệ thống mặc định' },
                        { value: 'custom', label: '✨ Vai trò tùy chỉnh' },
                      ]}
                    />
                  </Space>

                  <Space size={12}>
                    <RowPerPageSelect value={rolePageSize} onChange={(ps) => { setRolePageSize(ps); setRolePage(1) }} />
                  </Space>
                </div>

                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={filteredRoles}
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
                {/* Thanh tìm kiếm Chuyên môn */}
                <div
                  style={{
                    background: '#fff',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid #e8f0f0',
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <Space wrap size={10} style={{ flex: 1 }}>
                    <Input
                      placeholder="Tìm theo tên kỹ năng, mô tả..."
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      allowClear
                      value={specSearch}
                      onChange={(e) => {
                        setSpecSearch(e.target.value)
                        setSpecPage(1)
                      }}
                      style={{ width: 280 }}
                    />

                    <Select
                      placeholder="Áp dụng loài"
                      value={specSpeciesFilter}
                      onChange={(val) => {
                        setSpecSpeciesFilter(val)
                        setSpecPage(1)
                      }}
                      style={{ width: 170 }}
                      options={[
                        { value: 'all', label: 'Tất cả loài' },
                        { value: 'both', label: '🐶🐱 Chó & Mèo' },
                        { value: 'dog', label: '🐶 Chỉ cho Chó' },
                        { value: 'cat', label: '🐱 Chỉ cho Mèo' },
                      ]}
                    />
                  </Space>

                  <Space size={12}>
                    <RowPerPageSelect value={specPageSize} onChange={(ps) => { setSpecPageSize(ps); setSpecPage(1) }} />
                  </Space>
                </div>

                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={filteredSpecialties}
                    columns={specialtyColumns}
                    rowKey="id"
                    scroll={{ x: 'max-content' }}
                    rowClassName={() => 'clickable-row'}
                    onRow={(record) => ({
                      onClick: () => openSpecDetails(record),
                      style: { cursor: 'pointer' },
                    })}
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
                            {count} <span style={{ fontSize: 13, fontWeight: 400, color: '#6b7280' }}>vị trí sẵn sàng</span>
                          </div>
                        </Card>
                      </Col>
                    )
                  })}
                </Row>

                {/* Thanh tìm kiếm & bộ lọc Tài nguyên */}
                <div
                  style={{
                    background: '#fff',
                    padding: '12px 16px',
                    borderRadius: 10,
                    border: '1px solid #e8f0f0',
                    marginBottom: 12,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 12,
                  }}
                >
                  <Space wrap size={10} style={{ flex: 1 }}>
                    <Input
                      placeholder="Tìm tài nguyên theo tên..."
                      prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
                      allowClear
                      value={resSearch}
                      onChange={(e) => {
                        setResSearch(e.target.value)
                        setResPage(1)
                      }}
                      style={{ width: 260 }}
                    />

                    <Select
                      placeholder="Phân loại"
                      value={resTypeFilter}
                      onChange={(val) => {
                        setResTypeFilter(val)
                        setResPage(1)
                      }}
                      style={{ width: 170 }}
                      options={[
                        { value: 'all', label: 'Tất cả phân loại' },
                        { value: 'bath_tub', label: 'Bồn tắm' },
                        { value: 'grooming_table', label: 'Bàn cắt tỉa' },
                        { value: 'drying_cage', label: 'Chuồng sấy' },
                        { value: 'spa_room', label: 'Phòng spa' },
                      ]}
                    />

                    <Select
                      placeholder="Trạng thái"
                      value={resStatusFilter}
                      onChange={(val) => {
                        setResStatusFilter(val)
                        setResPage(1)
                      }}
                      style={{ width: 160 }}
                      options={[
                        { value: 'all', label: 'Tất cả trạng thái' },
                        { value: 'active', label: '🟢 Sẵn sàng' },
                        { value: 'inactive', label: '⚪ Tạm ngưng' },
                      ]}
                    />
                  </Space>

                  <Space size={12}>
                    <RowPerPageSelect value={resPageSize} onChange={(ps) => { setResPageSize(ps); setResPage(1) }} />
                  </Space>
                </div>

                <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 16, overflow: 'hidden' }}>
                  <Table
                    dataSource={filteredResources}
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
        title={editingStaff ? `Chỉnh sửa nhân viên: ${editingStaff.full_name || editingStaff.username}` : 'Thêm nhân viên mới'}
        open={staffModalOpen}
        onCancel={() => setStaffModalOpen(false)}
        onOk={saveStaff}
        okText="Lưu thông tin"
        width={580}
      >
        <Form form={staffForm} layout="vertical">
          <Form.Item
            name="full_name"
            label="Họ và tên"
            rules={[{ required: true, message: 'Vui lòng nhập họ và tên nhân viên' }]}
          >
            <Input
              placeholder="Ví dụ: Kiều Nghiên, Nguyễn Văn An..."
              onChange={(e) => {
                const nameVal = e.target.value
                if (!editingStaff && !isUsernameCustomized) {
                  const existingUsernames = staffList.map((s) => s.username)
                  const variants = generateUsernameVariants(nameVal)
                  const baseUsername = variants[0] || ''
                  const suggested = getAvailableUsername(baseUsername, existingUsernames)
                  staffForm.setFieldsValue({ username: suggested })
                }
              }}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="username"
                label="Tên đăng nhập"
                rules={[
                  { required: true, message: 'Vui lòng nhập tên đăng nhập' },
                  {
                    pattern: /^[a-zA-Z0-9_.]+$/,
                    message: 'Tên đăng nhập chỉ gồm chữ cái, số, dấu gạch dưới (_) hoặc chấm (.)',
                  },
                ]}
                extra={
                  !editingStaff && (
                    <Form.Item
                      noStyle
                      shouldUpdate={(prev, curr) => prev.full_name !== curr.full_name}
                    >
                      {({ getFieldValue }) => {
                        const nameVal = getFieldValue('full_name')
                        const variants = generateUsernameVariants(nameVal)
                        if (!variants || variants.length === 0) {
                          return (
                            <Text type="secondary" style={{ fontSize: 12 }}>
                              💡 Tự động tạo dựa trên Họ và tên. Bạn có thể sửa hoặc thêm hậu tố tùy ý.
                            </Text>
                          )
                        }
                        return (
                          <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                            <span style={{ fontSize: 12, color: '#64748b' }}>Gợi ý nhanh:</span>
                            {variants.map((v) => (
                              <Tag
                                key={v}
                                color="blue"
                                style={{ cursor: 'pointer', borderRadius: 4, margin: 0, fontSize: 12 }}
                                onClick={() => {
                                  staffForm.setFieldsValue({ username: v })
                                  setIsUsernameCustomized(true)
                                }}
                              >
                                {v}
                              </Tag>
                            ))}
                          </div>
                        )
                      }}
                    </Form.Item>
                  )
                }
              >
                <Input
                  disabled={!!editingStaff}
                  placeholder="Tự động tạo từ họ tên"
                  onChange={(e) => {
                    setIsUsernameCustomized(!!e.target.value.trim())
                  }}
                  suffix={
                    !editingStaff && (
                      <Tooltip title="Tạo lại tên đăng nhập từ Họ và tên">
                        <Button
                          type="text"
                          size="small"
                          icon={<ReloadOutlined style={{ color: '#0f8b8d', fontSize: 12 }} />}
                          onClick={() => {
                            const nameVal = staffForm.getFieldValue('full_name')
                            const existingUsernames = staffList.map((s) => s.username)
                            const variants = generateUsernameVariants(nameVal)
                            const baseUsername = variants[0] || ''
                            const suggested = getAvailableUsername(baseUsername, existingUsernames)
                            staffForm.setFieldsValue({ username: suggested })
                            setIsUsernameCustomized(false)
                            if (suggested) {
                              message.info(`Đã tạo tên đăng nhập từ họ tên: ${suggested}`)
                            }
                          }}
                        />
                      </Tooltip>
                    )
                  }
                />
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
              <Form.Item name="gender" label="Giới tính">
                <Select
                  options={[
                    { value: 'male', label: 'Nam' },
                    { value: 'female', label: 'Nữ' },
                    { value: 'other', label: 'Khác' },
                  ]}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="birthday" label="Ngày sinh">
                <DatePicker
                  style={{ width: '100%' }}
                  placeholder="Chọn ngày sinh"
                  format="DD/MM/YYYY"
                  disabledDate={(curr) => curr && curr > dayjs().endOf('day')}
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

          <Form.Item name="address" label="Địa chỉ">
            <Input placeholder="Số nhà, tên đường, phường/xã, quận/huyện..." prefix={<EnvironmentOutlined style={{ color: '#94a3b8' }} />} />
          </Form.Item>

          {/* Hàng: Chuyên môn tay nghề (bên trái) + Mật khẩu khởi tạo (bên phải khi thêm mới) */}
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
                      <span style={{ color: '#ff4d4f' }}>* </span>Mật khẩu
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

            {/* Chi tiết liên hệ & thông tin cá nhân */}
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
              <Col span={12}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    <UserOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                    Giới tính
                  </Text>
                  <div style={{ marginTop: 2 }}>
                    {viewingStaff.gender === 'male' ? (
                      <Tag color="blue" style={{ fontSize: 13, padding: '1px 8px', margin: 0 }}>Nam</Tag>
                    ) : viewingStaff.gender === 'female' ? (
                      <Tag color="magenta" style={{ fontSize: 13, padding: '1px 8px', margin: 0 }}>Nữ</Tag>
                    ) : (
                      <Text type="secondary" style={{ fontSize: 13 }}>Khác / Chưa rõ</Text>
                    )}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    <CalendarOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                    Ngày sinh
                  </Text>
                  <Text strong style={{ fontSize: 14, color: '#334155' }}>
                    {viewingStaff.birthday
                      ? `${dayjs(viewingStaff.birthday).format('DD/MM/YYYY')} (${dayjs().diff(dayjs(viewingStaff.birthday), 'year')} tuổi)`
                      : 'Chưa cập nhật'}
                  </Text>
                </div>
              </Col>
              <Col span={24}>
                <div style={{ padding: '12px 14px', background: '#f8fafc', borderRadius: 8, border: '1px solid #f1f5f9' }}>
                  <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
                    <EnvironmentOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                    Địa chỉ
                  </Text>
                  <Text strong style={{ fontSize: 14, color: '#334155' }}>
                    {viewingStaff.address || 'Chưa cập nhật'}
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
            />
          </Form.Item>

          <Form.Item name="color" label="Màu sắc nhãn thẻ" rules={[{ required: true, message: 'Vui lòng chọn màu sắc' }]}>
            <Select options={ROLE_COLOR_OPTIONS} />
          </Form.Item>

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
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {assigned.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          setRoleDetailModalOpen(false)
                          setViewingStaff(st)
                          setStaffDetailModalOpen(true)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 14px',
                          background: '#fff',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#0f8b8d'
                          e.currentTarget.style.background = '#f0fdfa'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.background = '#fff'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                        title="Bấm để xem chi tiết hồ sơ nhân sự này"
                      >
                        <Avatar style={{ background: '#0f8b8d', flexShrink: 0 }} size={28} icon={<UserOutlined />} />
                        <Text strong style={{ fontSize: 13, color: '#0b3d3f' }}>
                          {st.full_name || st.username}
                        </Text>
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
        width={560}
      >
        <Form form={specForm} layout="vertical">
          <Form.Item
            name="name_vi"
            label="Tên chuyên môn tay nghề"
            rules={[{ required: true, message: 'Vui lòng nhập tên chuyên môn' }]}
          >
            <Input
              placeholder="Ví dụ: Tắm & Vệ sinh toàn diện, Cắt tỉa Poodle tạo kiểu..."
            />
          </Form.Item>

          <Form.Item
            name="species_scope"
            label="Áp dụng cho loài"
            rules={[{ required: true, message: 'Vui lòng chọn loài áp dụng' }]}
          >
            <Select
              options={[
                { value: 'both', label: '🐶🐱 Cả chó & mèo (Phổ biến)' },
                { value: 'dog', label: '🐶 Chuyên cho Chó' },
                { value: 'cat', label: '🐱 Chuyên cho Mèo (Chăm sóc đặc thù)' },
              ]}
            />
          </Form.Item>

          <Form.Item
            name="description"
            label="Mô tả phạm vi kỹ năng & công việc"
          >
            <Input.TextArea
              rows={3}
              placeholder="Mô tả ngắn gọn quy trình, thao tác và yêu cầu kỹ thuật đối với kỹ thuật viên đảm nhận chuyên môn này..."
            />
          </Form.Item>
        </Form>
      </Modal>

      {/* ===== MODAL XEM CHI TIẾT CHUYÊN MÔN ===== */}
      <Modal
        centered
        title={
          <Space>
            <TagOutlined style={{ color: '#0f8b8d' }} />
            <span>Chi tiết chuyên môn: {viewingSpec?.name_vi}</span>
          </Space>
        }
        open={specDetailModalOpen}
        onCancel={() => setSpecDetailModalOpen(false)}
        footer={[
          <Button key="close" onClick={() => setSpecDetailModalOpen(false)}>
            Đóng
          </Button>,
          isManager && (
            <Button
              key="edit"
              type="primary"
              icon={<EditOutlined />}
              onClick={() => {
                const target = viewingSpec
                setSpecDetailModalOpen(false)
                openSpecModal(target)
              }}
            >
              Chỉnh sửa chuyên môn
            </Button>
          ),
        ]}
        width={580}
      >
        {viewingSpec && (
          <div>
            {/* Banner thông tin chính */}
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
                  <Text strong style={{ fontSize: 16, color: '#0f8b8d' }}>
                    {viewingSpec.name_vi}
                  </Text>
                  {(() => {
                    const item = SPECIES_SCOPE_MAP[viewingSpec.species_scope] || SPECIES_SCOPE_MAP.both
                    return (
                      <Tag color={item.color} style={{ fontSize: 12, padding: '2px 10px', borderRadius: 6 }}>
                        {item.icon} {item.label}
                      </Tag>
                    )
                  })()}
                </Space>
              </div>
            </div>

            {/* Mô tả phạm vi kỹ năng & công việc */}
            <div style={{ marginBottom: 16 }}>
              <Text strong style={{ fontSize: 13, color: '#334155' }}>Mô tả phạm vi kỹ năng & công việc:</Text>
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
                {viewingSpec.description || <Text type="secondary" italic>Chưa có mô tả chi tiết cho chuyên môn này.</Text>}
              </div>
            </div>

            <Divider style={{ margin: '16px 0' }} />

            {/* Danh sách kỹ thuật viên sở hữu chuyên môn này */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text strong style={{ fontSize: 13, color: '#334155' }}>
                  <UserOutlined style={{ marginRight: 6, color: '#0f8b8d' }} />
                  Kỹ thuật viên đang sở hữu chuyên môn này ({
                    staffList.filter((st) => (st.specialties || []).includes(viewingSpec.id)).length
                  })
                </Text>
              </div>

              {(() => {
                const assigned = staffList.filter((st) => (st.specialties || []).includes(viewingSpec.id))
                if (assigned.length === 0) {
                  return (
                    <div style={{ textAlign: 'center', padding: '16px 0', background: '#f8fafc', borderRadius: 8 }}>
                      <Text type="secondary">Hiện chưa có kỹ thuật viên nào được gán chuyên môn này.</Text>
                    </div>
                  )
                }
                return (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                    {assigned.map((st) => (
                      <div
                        key={st.id}
                        onClick={() => {
                          setSpecDetailModalOpen(false)
                          setViewingStaff(st)
                          setStaffDetailModalOpen(true)
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          padding: '8px 14px',
                          background: '#fff',
                          borderRadius: 10,
                          border: '1px solid #e2e8f0',
                          cursor: 'pointer',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#0f8b8d'
                          e.currentTarget.style.background = '#f0fdfa'
                          e.currentTarget.style.transform = 'translateY(-1px)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = '#e2e8f0'
                          e.currentTarget.style.background = '#fff'
                          e.currentTarget.style.transform = 'translateY(0)'
                        }}
                        title="Bấm để xem chi tiết hồ sơ nhân sự này"
                      >
                        <Avatar style={{ background: '#0f8b8d', flexShrink: 0 }} size={28} icon={<UserOutlined />} />
                        <Text strong style={{ fontSize: 13, color: '#0b3d3f' }}>
                          {st.full_name || st.username}
                        </Text>
                      </div>
                    ))}
                  </div>
                )
              })()}
            </div>
          </div>
        )}
      </Modal>

      {/* ===== MODAL CA LÀM & NGÀY NGHỈ ===== */}
      <Modal
        centered
        title={`Lịch làm việc & Ngày nghỉ: ${shiftStaff?.full_name || shiftStaff?.username}`}
        open={shiftModalOpen}
        onCancel={() => setShiftModalOpen(false)}
        footer={null}
        width={650}
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
                    description="Kỹ thuật viên có ca làm hợp lệ mới được phân công vào lịch hẹn của khách hàng. Quản lý có thể cấu hình ngày làm và khung giờ bên dưới."
                    style={{ marginBottom: 14 }}
                  />

                  {/* Cấu hình nhanh theo mẫu */}
                  {isManager && (
                    <div style={{ marginBottom: 14, padding: '10px 12px', background: '#f8fafc', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 6 }}>
                        Mẫu ca làm việc phổ biến:
                      </Text>
                      <Space wrap>
                        <Button size="small" onClick={() => applyShiftPreset('all')}>
                          Tất cả các ngày (T2 - CN: 08:00 - 19:00)
                        </Button>
                        <Button size="small" onClick={() => applyShiftPreset('mon_sat')}>
                          T2 - T7 (08:00 - 19:00, CN nghỉ)
                        </Button>
                        <Button size="small" onClick={() => applyShiftPreset('mon_fri')}>
                          T2 - T6 (08:00 - 18:00, T7-CN nghỉ)
                        </Button>
                      </Space>
                    </div>
                  )}

                  {/* Danh sách 7 ngày trong tuần */}
                  <div style={{ maxHeight: 320, overflowY: 'auto', paddingRight: 4 }}>
                    {weeklyShifts.map((d) => (
                      <div
                        key={d.weekday}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 14px',
                          background: d.enabled ? '#f0fdfa' : '#f8fafc',
                          borderRadius: 8,
                          border: `1px solid ${d.enabled ? '#ccfbf1' : '#e2e8f0'}`,
                          marginBottom: 8,
                        }}
                      >
                        <Space size={12}>
                          <Checkbox
                            checked={d.enabled}
                            disabled={!isManager}
                            onChange={(e) => {
                              const val = e.target.checked
                              setWeeklyShifts((prev) =>
                                prev.map((item) => (item.weekday === d.weekday ? { ...item, enabled: val } : item))
                              )
                            }}
                          >
                            <Text strong style={{ minWidth: 70, display: 'inline-block' }}>{WEEKDAYS[d.weekday]}</Text>
                          </Checkbox>
                          <Tag color={d.enabled ? 'cyan' : 'default'}>
                            {d.enabled ? 'Làm việc' : 'Nghỉ'}
                          </Tag>
                        </Space>

                        {d.enabled ? (
                          <Space size={8}>
                            <TimePicker
                              format="HH:mm"
                              minuteStep={15}
                              value={dayjs(d.start_time, 'HH:mm')}
                              disabled={!isManager}
                              onChange={(_, timeStr) => {
                                if (timeStr) {
                                  setWeeklyShifts((prev) =>
                                    prev.map((item) => (item.weekday === d.weekday ? { ...item, start_time: timeStr } : item))
                                  )
                                }
                              }}
                              style={{ width: 95 }}
                            />
                            <span>đến</span>
                            <TimePicker
                              format="HH:mm"
                              minuteStep={15}
                              value={dayjs(d.end_time, 'HH:mm')}
                              disabled={!isManager}
                              onChange={(_, timeStr) => {
                                if (timeStr) {
                                  setWeeklyShifts((prev) =>
                                    prev.map((item) => (item.weekday === d.weekday ? { ...item, end_time: timeStr } : item))
                                  )
                                }
                              }}
                              style={{ width: 95 }}
                            />
                          </Space>
                        ) : (
                          <Text type="secondary" style={{ fontStyle: 'italic', fontSize: 13 }}>Không xếp ca</Text>
                        )}
                      </div>
                    ))}
                  </div>

                  {isManager && (
                    <div style={{ marginTop: 14, textAlign: 'right' }}>
                      <Button type="primary" loading={shiftSaving} onClick={saveShifts} style={{ background: '#0f8b8d', borderColor: '#0f8b8d' }}>
                        Lưu lịch ca làm việc
                      </Button>
                    </div>
                  )}
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
                        <Form.Item name="range" label="Khoảng ngày nghỉ" rules={[{ required: true, message: 'Chọn ngày nghỉ' }]}>
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

      {/* ===== MODAL THÊM / SỬA TÀI NGUYÊN ===== */}
      <Modal
        centered
        title={editingRes ? `Chỉnh sửa tài nguyên: ${editingRes.name}` : 'Thêm vị trí tài nguyên cơ sở vật chất'}
        open={resModalOpen}
        onCancel={() => setResModalOpen(false)}
        onOk={saveResource}
        okText={editingRes ? 'Lưu thay đổi' : 'Thêm mới'}
      >
        <Form form={resForm} layout="vertical">
          <Form.Item name="name" label="Tên tài nguyên" rules={[{ required: true, message: 'Nhập tên tài nguyên' }]}>
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
