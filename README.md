# AnyDoor - ComfyUI 节点控制与惰性值机制插件

AnyDoor 是一个功能强大的 ComfyUI 插件，提供节点 Bypass 控制和执行分支功能。

<img width="1168" height="726" alt="33" src="https://github.com/user-attachments/assets/0cd6447d-aa61-4f5b-991b-803e79c265b0" />


PS：商用平台方使用请知会一声哈！

使用说明视频：
https://www.bilibili.com/video/BV11k1wBhErF/

## 功能特性

### 节点控制功能
- ✅ 根据节点编号控制节点的 bypass 状态
- ✅ 支持输入任意节点编号（1-999999）
- ✅ 实时控制：修改节点编号或模式时立即生效
- ✅ 三种模式：正常执行、禁用、忽略
- ✅ 文本匹配控制：根据文本索引匹配控制节点
- ✅ 五键切换控制：快速切换多组节点状态

### 分支机制功能
- ✅ 惰性值机制：只计算实际需要的输入，提升性能
- ✅ 常规分支控制：基于布尔值的条件分支
- ✅ 文本匹配分支：基于文本索引匹配命名输入
- ✅ 数字切换分支：基于数字切换(1-5)直接匹配输入

## 安装方法

1. 将整个插件文件夹复制到 ComfyUI 的 `custom_nodes` 目录：
   ```
   ComfyUI/custom_nodes/comfy_anydoor/
   ```

2. 重启 ComfyUI

## 节点说明

所有节点都在 `🔵BB anydoor` 分类下。


**优势：**
- 减少不必要的计算，提升性能
- 节省 GPU/CPU 资源
- 加快工作流执行速度

```


## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License


