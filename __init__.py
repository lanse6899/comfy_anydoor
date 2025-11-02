import os

# 注册 web 扩展目录
WEB_DIRECTORY = "./web"

from .nodes import NodeBypassController, WorkflowJSONGetter, TextMatchNodeController

NODE_CLASS_MAPPINGS = {
    "NodeBypassController": NodeBypassController,
    "WorkflowJSONGetter": WorkflowJSONGetter,
    "TextMatchNodeController": TextMatchNodeController
}

NODE_DISPLAY_NAME_MAPPINGS = {
    "NodeBypassController": "控制节点Bypass",
    "WorkflowJSONGetter": "获取工作流JSON",
    "TextMatchNodeController": "文本匹配节点控制器"
}

__all__ = ['NODE_CLASS_MAPPINGS', 'NODE_DISPLAY_NAME_MAPPINGS']

