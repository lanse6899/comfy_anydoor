import os

# 注册 web 扩展目录
WEB_DIRECTORY = "./web"

from .nodes import NodeBypassController, TextMatchNodeController, FiveButtonBypassController

NODE_CLASS_MAPPINGS = {
    "NodeBypassController": NodeBypassController,
    "TextMatchNodeController": TextMatchNodeController,
    "FiveButtonBypassController": FiveButtonBypassController
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NodeBypassController": "🔵BB控制节点Bypass",
    "TextMatchNodeController": "🔵BB文本匹配节点控制器",
    "FiveButtonBypassController": "🔵BB切换节点控制"
}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

