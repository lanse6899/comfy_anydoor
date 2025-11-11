import os

# 注册 web 扩展目录
WEB_DIRECTORY = "./web"

from .nodes import (
    NodeBypassController, 
    TextMatchNodeController, 
    FiveButtonBypassController,
    LazyDiversioner,
    LazyTextIndexer,
    LazySwitch
)

NODE_CLASS_MAPPINGS = {
    "NodeBypassController": NodeBypassController,
    "TextMatchNodeController": TextMatchNodeController,
    "FiveButtonBypassController": FiveButtonBypassController,
    "LazyDiversioner": LazyDiversioner,
    "LazyTextIndexer": LazyTextIndexer,
    "LazySwitch": LazySwitch,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NodeBypassController": "🔵BB控制节点Bypass",
    "TextMatchNodeController": "🔵BB文本匹配节点控制器",
    "FiveButtonBypassController": "🔵BB切换节点控制",
    "LazyDiversioner": "🔵BB 常规分支控制",
    "LazyTextIndexer": "🔵BB 文本匹配分支控制器",
    "LazySwitch": "🔵BB 切换分支控制",
}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

