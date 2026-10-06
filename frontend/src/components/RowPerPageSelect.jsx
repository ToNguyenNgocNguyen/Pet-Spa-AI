import React from 'react'
import { Select, Space, Typography } from 'antd'

const { Text } = Typography

export default function RowPerPageSelect({ value = 10, onChange, style }) {
  return (
    <Space align="center" size={6} style={style}>
      <Text type="secondary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>Hiển thị:</Text>
      <Select
        size="middle"
        value={value}
        onChange={onChange}
        style={{ width: 145 }}
        options={[
          { value: 10, label: '10 dòng / trang' },
          { value: 20, label: '20 dòng / trang' },
          { value: 50, label: '50 dòng / trang' },
          { value: 100, label: '100 dòng / trang' },
        ]}
      />
    </Space>
  )
}
