import { useState } from 'react'
import { Alert, Button, Card, Form, Input, Tabs, Typography } from 'antd'
import { ArrowLeftOutlined, LockOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth.jsx'
import { toFormErrors } from '../api.js'

export default function Login() {
  const { user, login, register } = useAuth()
  const nav = useNavigate()
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [regForm] = Form.useForm()

  if (user) return <Navigate to="/app/tong-quan" replace />

  const run = (fn, form) => async (values) => {
    setBusy(true)
    setError('')
    try {
      await fn(values)
      nav('/app/tong-quan')
    } catch (e) {
      const fields = toFormErrors(e)
      if (form && fields.length) form.setFields(fields)
      setError(fields.length ? '' : e.message)
      if (!form && e.fields?.non_field_errors) setError(e.fields.non_field_errors.join(' '))
    } finally {
      setBusy(false)
    }
  }

  const loginTab = (
    <Form layout="vertical" onFinish={run((v) => login(v.username, v.password))}>
      <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
        <Input prefix={<UserOutlined />} autoFocus placeholder="quanly / letan / ktv1 / khach1" />
      </Form.Item>
      <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
        <Input.Password prefix={<LockOutlined />} placeholder="Mật khẩu (Demo: Demo@12345)" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={busy} size="large" style={{ marginTop: 8 }}>
        Đăng nhập
      </Button>
    </Form>
  )

  const registerTab = (
    <Form form={regForm} layout="vertical" onFinish={run(register, regForm)}>
      <Form.Item name="full_name" label="Họ tên" rules={[{ required: true, message: 'Nhập họ tên' }]}>
        <Input placeholder="Ví dụ: Nguyễn Văn A" />
      </Form.Item>
      <Form.Item name="phone" label="Số điện thoại" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
        <Input prefix={<PhoneOutlined />} placeholder="0901xxxxxx" />
      </Form.Item>
      <Form.Item name="username" label="Tên đăng nhập" rules={[{ required: true, message: 'Nhập tên đăng nhập' }]}>
        <Input placeholder="Tên đăng nhập viết liền" />
      </Form.Item>
      <Form.Item name="password" label="Mật khẩu" rules={[{ required: true, message: 'Nhập mật khẩu' }]}>
        <Input.Password placeholder="Tối thiểu 8 ký tự" />
      </Form.Item>
      <Button type="primary" htmlType="submit" block loading={busy} size="large" style={{ marginTop: 8 }}>
        Tạo tài khoản khách hàng
      </Button>
    </Form>
  )

  return (
    <div className="auth-wrap">
      <Card className="auth-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <Button type="link" icon={<ArrowLeftOutlined />} onClick={() => nav('/')} style={{ padding: 0 }}>
            Về trang chủ
          </Button>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>Bảo mật & an toàn</Typography.Text>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <div className="brand-mark" style={{ width: 32, height: 32, fontSize: 16 }}>🐾</div>
          <Typography.Title level={3} style={{ margin: 0, color: '#0b3d3f' }}>Pet Spa AI</Typography.Title>
        </div>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 20 }}>
          Hệ thống quản lý spa thú y thông minh
        </Typography.Paragraph>

        {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 16 }} />}

        <Tabs
          onChange={() => setError('')}
          items={[
            { key: 'login', label: 'Đăng nhập', children: loginTab },
            { key: 'register', label: 'Đăng ký khách hàng', children: registerTab },
          ]}
        />
      </Card>
    </div>
  )
}
