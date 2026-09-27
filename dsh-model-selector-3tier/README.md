# DSH Model Selector 3-Tier

一个自定义插件，将 DSH 的模型选择器从两级（Model → Effort）改为三级（Provider → Model → Effort）。

## 功能

- 第一级：选择供应商（Provider）
- 第二级：选择模型（Model）
- 第三级：选择推理强度（Effort）

## 安装

1. 将本目录链接到 DSH 的插件目录
2. 在 `cordis.patch.yml` 中注册插件
3. 重启 DSH

## 配置

无需额外配置，插件会自动读取 DSH 的模型目录。
