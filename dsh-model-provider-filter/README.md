# dsh-model-provider-filter

恢复 DSH 的三级模型筛选：**Provider → Model → Effort**

## 功能

将 DSH 默认的二级模型选择器（Model → Effort）替换为三级筛选：

1. **Provider** - 选择供应商（如 DeepSeek、OpenAI、Claude 等）
2. **Model** - 选择模型（如 DeepSeek V4 Flash、GPT-5.6 等）
3. **Effort** - 选择推理强度（如 High、Medium、Low 等）

## 安装

在 `cordis.patch.yml` 中添加：

```yaml
- insert:
    - id: dsh-model-provider-filter
      name: 'dsh-model-provider-filter'
```

## 使用

点击输入框旁边的模型选择器，即可看到三级菜单：

```
┌─────────────────┐
│  选择供应商      │
├─────────────────┤
│  DeepSeek     › │
│  OpenAI       › │
│  Claude       › │
└─────────────────┘
        ↓
┌─────────────────┐
│ ‹ 选择模型       │
├─────────────────┤
│  V4 Flash     › │
│  V4 Pro       › │
│  V4 Vision    › │
└─────────────────┘
        ↓
┌─────────────────┐
│ ‹ 选择推理强度   │
├─────────────────┤
│  默认           │
│  High          │
│  Medium        │
│  Low           │
└─────────────────┘
```

## 技术说明

- 使用 `conversation.input.model` 插槽替换默认的 ModelSelect 组件
- 数据来自 `modelDirectories` 服务（与 `/model` 命令共享）
- 支持暗色主题
- 支持国际化（中英文）