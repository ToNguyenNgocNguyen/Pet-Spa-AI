import { useEffect, useState } from 'react'
import {
  App, Button, Card, Checkbox, Col, Divider, Form, Input,
  InputNumber, Row, Skeleton, TimePicker, Typography,
} from 'antd'
import { BankOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { api, toFormErrors } from '../api.js'

const { Title, Text } = Typography
const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy', 'Chủ nhật']
const T = 'HH:mm:ss'

export default function SpaProfile() {
  const { message } = App.useApp()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    api('/spa').then((s) => {
      form.setFieldsValue({
        ...s,
        open_time: dayjs(s.open_time, T),
        close_time: dayjs(s.close_time, T),
      })
    }).finally(() => setLoading(false))
  }, [form])

  const save = async (v) => {
    setBusy(true)
    try {
      await api('/spa', {
        method: 'PATCH',
        body: {
          name: v.name, phone: v.phone, email: v.email, address: v.address,
          open_time: v.open_time.format(T), close_time: v.close_time.format(T),
          open_weekdays: v.open_weekdays, slot_minutes: v.slot_minutes,
          cancel_cutoff_hours: v.cancel_cutoff_hours,
        },
      })
      message.success('Đã lưu hồ sơ spa.')
    } catch (e) {
      form.setFields(toFormErrors(e))
      message.error(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (loading) return <Skeleton active />

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <Title level={3} style={{ margin: 0, color: '#0b3d3f' }}>
          <BankOutlined style={{ marginRight: 8, color: '#0f8b8d' }} />
          Hồ Sơ Spa
        </Title>
        <Text type="secondary">Cấu hình thông tin cơ sở, thời gian hoạt động và chính sách đặt lịch</Text>
      </div>

      <Card style={{ width: '100%', borderRadius: 12 }}>
        <Form form={form} layout="vertical" onFinish={save}>
          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="name" label="Tên spa" rules={[{ required: true, message: 'Nhập tên spa' }]}>
                <Input placeholder="ví dụ: Spa Thú Y Lông Mượt" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="phone" label="Số điện thoại liên hệ" rules={[{ required: true, message: 'Nhập số điện thoại' }]}>
                <Input placeholder="ví dụ: 0283000000" />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={24}>
            <Col xs={24} md={12}>
              <Form.Item name="email" label="Email thông báo" rules={[{ type: 'email', message: 'Email không hợp lệ' }]}>
                <Input placeholder="ví dụ: lienhe@longmuot.example" />
              </Form.Item>
            </Col>
            <Col xs={24} md={12}>
              <Form.Item name="address" label="Địa chỉ spa">
                <Input placeholder="ví dụ: 25 Lê Văn Thịnh, TP. Thủ Đức, TP.HCM" />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: '16px 0 20px 0' }}>Khung Giờ Hoạt Động & Lịch Mở Cửa</Divider>

          <Row gutter={24}>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="open_time" label="Giờ mở cửa" rules={[{ required: true, message: 'Chọn giờ mở cửa' }]}>
                <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="close_time" label="Giờ đóng cửa" rules={[{ required: true, message: 'Chọn giờ đóng cửa' }]}>
                <TimePicker format="HH:mm" minuteStep={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="slot_minutes" label="Bước slot đặt lịch (phút)">
                <InputNumber min={5} max={120} step={5} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col xs={24} sm={12} md={6}>
              <Form.Item name="cancel_cutoff_hours" label="Hủy trước giờ hẹn (giờ)">
                <InputNumber min={0} max={72} style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="open_weekdays" label="Các ngày mở cửa trong tuần">
            <Checkbox.Group options={DAYS.map((label, value) => ({ label, value }))} />
          </Form.Item>

          <div style={{ marginTop: 24 }}>
            <Button
              type="primary"
              htmlType="submit"
              loading={busy}
              size="middle"
              style={{ minWidth: 140, background: '#0f8b8d', borderColor: '#0f8b8d' }}
            >
              Lưu hồ sơ spa
            </Button>
          </div>
        </Form>
      </Card>
    </div>
  )
}
