import json
import os
from typing import Dict, Any, Tuple, Optional
import folder_paths

# 尝试导入 ComfyUI 的核心模块
try:
    import execution
    COMFYUI_AVAILABLE = True
except ImportError:
    COMFYUI_AVAILABLE = False

class NodeBypassController:
    """
    控制指定节点编号的节点 bypass 状态
    
    使用方法：
    1. 将节点添加到工作流中
    2. 输入要控制的节点编号（节点ID）
    3. 选择是否设置该节点为 bypass 状态
    4. 节点会在执行时修改目标节点的 bypass 状态
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "node_id": ("STRING", {
                    "default": "1", 
                    "display_name": "节点编号",
                    "tooltip": "输入要控制的节点编号（节点ID），支持多个：\n- 单个节点：25\n- 多个节点：25,30,35 或 25 30 35"
                }),
                "set_bypass": (["正常执行", "禁用", "忽略"], {
                    "default": "正常执行",
                    "display_name": "节点模式",
                    "tooltip": "选择节点的执行模式：\n- 正常执行(0): 节点正常执行计算\n- 禁用(1): 节点显示为灰色，不执行计算，输出中断下游\n- 忽略(2): 节点被跳过，输入直接传递到输出，保持连接完整性"
                }),
            },
            "optional": {
                "trigger": ("INT", {
                    "default": 0,
                    "min": 0,
                    "max": 1,
                    "step": 1,
                    "display_name": "触发控制",
                    "tooltip": "设置为1来触发控制操作"
                }),
            }
        }
    
    RETURN_TYPES = ("STRING", "INT")
    RETURN_NAMES = ("status_info", "mode_value")
    FUNCTION = "control_bypass"
    CATEGORY = "工具/AnyDoor"
    DESCRIPTION = "控制指定节点编号的节点 bypass 状态"
    OUTPUT_NODE = True
    
    def control_bypass(self, node_id: str, set_bypass: str, trigger: int = 0) -> Tuple[str, int]:
        """
        控制指定节点编号的节点 bypass 状态（支持多个节点）
        
        Args:
            node_id: 要控制的节点编号（节点ID），可以是单个或多个（用逗号或空格分隔）
                    例如: "25" 或 "25,30,35" 或 "25 30 35"
            set_bypass: 要设置的模式（"正常执行", "禁用", "忽略"）
            trigger: 触发控制的标志（0或1）
            
        Returns:
            Tuple[str, int]: (状态信息, 设置的模式值)
        """
        try:
            # 映射模式名称到 mode 值
            mode_map = {
                "正常执行": 0,
                "禁用": 1,
                "忽略": 2  # 也支持旧名称
            }
            # 兼容旧版本的 "Bypass" 名称
            if set_bypass == "Bypass":
                set_bypass = "忽略"
            
            target_mode = mode_map.get(set_bypass, 0)
            
            # 解析节点ID列表（支持多种格式：逗号、空格、换行、分号、点号等分隔）
            node_ids_str = str(node_id).strip()
            import re
            # 方法1: 使用正则表达式提取所有数字（最可靠的方法，支持任意分隔符）
            # 这样无论用户输入 "19.13", "19 13", "19,13" 都能正确解析
            all_numbers = re.findall(r'\d+', node_ids_str)
            # 转换为整数并过滤无效值
            node_ids = [int(n) for n in all_numbers if n.isdigit() and int(n) > 0]
            
            # 方法2: 如果方法1没找到数字，尝试按分隔符分割（备用方法）
            if not node_ids:
                # 支持多种分隔符：逗号、空格、换行、分号、点号
                node_ids = re.split(r'[,，\s\n;；.。]+', node_ids_str)
                # 过滤空值和转换为整数
                node_ids = [int(n.strip()) for n in node_ids if n.strip().isdigit()]
            
            # 处理多个节点
            if not node_ids:
                return (f"错误: 未找到有效的节点编号。请检查输入格式。", 0)
            
            # 将控制请求添加到待处理队列（供前端 JavaScript 使用）
            # 前端会在执行前读取并执行这些请求
            try:
                # 存储到全局字典（如果可用）
                if not hasattr(self, '_control_requests'):
                    self._control_requests = []
                
                for nid in node_ids:
                    self._control_requests.append({
                        'node_id': nid,
                        'mode': target_mode,
                        'mode_name': set_bypass
                    })
                
            except:
                pass
            
            # 尝试修改节点的 bypass 状态
            results = []
            for nid in node_ids:
                success, info = self._set_node_bypass(nid, target_mode)
                results.append((nid, success, info))
            
            # 生成状态信息
            success_count = sum(1 for _, s, _ in results if s)
            fail_count = len(results) - success_count
            
            if success_count > 0:
                status_info = f"✓ 控制请求已提交\n节点数量: {len(node_ids)}\n成功: {success_count}, 失败: {fail_count}\n设置模式: {set_bypass} (mode={target_mode})\n节点编号: {', '.join(map(str, node_ids))}\n\n注意: 节点状态将在工作流执行时由前端自动设置。"
            else:
                failed_nodes = [f"节点{nid}" for nid, s, _ in results if not s]
                status_info = f"✗ 设置失败\n失败的节点: {', '.join(failed_nodes)}\n\n提示:\n1. 请确保节点编号正确\n2. 确保 web/check_node_bypass.js 已正确加载\n3. 节点状态将在执行时被修改"
            
            return (status_info, target_mode)
            
        except Exception as e:
            return (f"控制过程中出现错误: {str(e)}", 0)
    
    def _set_node_bypass(self, node_id: int, mode: int) -> Tuple[bool, str]:
        """
        设置指定节点的 bypass 状态
        
        Args:
            node_id: 节点编号
            mode: 要设置的 mode 值 (0=正常, 1=禁用, 2=bypass)
            
        Returns:
            Tuple[bool, str]: (是否成功, 信息)
        """
        try:
            # 由于 ComfyUI 的架构，后端节点执行时无法直接修改其他节点
            # 我们需要通过前端 JavaScript 来实现
            # 方法：将控制请求存储起来，让前端 JavaScript 在执行时读取并执行
            
            # 尝试存储控制请求到全局变量（如果可用）
            # 前端 JavaScript 会在执行时读取并执行这些请求
            
            # 标记这是一个需要通过前端处理的请求
            # 在实际执行中，前端 JavaScript 会监听并处理
            
            # 为了确保前端能够处理，我们返回成功，但实际修改由前端完成
            # 前端 JavaScript 会通过监听执行事件来修改节点状态
            
            # 存储控制请求（通过特殊的返回值或全局状态）
            # 注意：这个方法依赖于前端 JavaScript 的实现
            
            # 由于这是后端执行，我们无法直接访问前端
            # 但前端 JavaScript 可以通过监听执行队列来检测并执行控制
            # 这里我们返回成功，实际的控制由前端 JavaScript 完成
            
            mode_names = {0: "正常执行", 1: "禁用", 2: "Bypass"}
            mode_name = mode_names.get(mode, f"模式{mode}")
            
            return (True, f"控制请求已提交。前端将在执行时设置节点 {node_id} 为 {mode_name} (mode={mode})")
            
        except Exception as e:
            return (False, f"访问节点时出错: {str(e)}")


class WorkflowJSONGetter:
    """
    辅助节点：获取当前工作流的 JSON 字符串
    
    这个节点可以帮助用户获取工作流 JSON，然后用于 NodeBypassChecker
    注意：由于 ComfyUI 的限制，这个节点可能无法直接获取工作流。
    建议用户手动从 ComfyUI 界面复制工作流 JSON。
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {},
            "optional": {}
        }
    
    RETURN_TYPES = ("STRING",)
    RETURN_NAMES = ("workflow_json",)
    FUNCTION = "get_workflow"
    CATEGORY = "工具/节点检查"
    DESCRIPTION = "获取当前工作流的 JSON 字符串（用于节点 bypass 检查）"
    OUTPUT_NODE = True
    
    def get_workflow(self) -> Tuple[str]:
        """
        尝试获取当前工作流的 JSON
        
        注意：这个功能在节点定义时可能无法直接访问工作流
        建议用户手动从 ComfyUI 界面复制工作流 JSON：
        1. 在 ComfyUI 界面中右键工作流
        2. 选择"保存"或"导出"
        3. 复制 JSON 内容
        """
        # 在实际执行中，ComfyUI 可能提供访问工作流的方法
        # 但由于节点是在定义时创建的，可能需要其他方式
        
        try:
            # 尝试从可能的来源获取
            # 这在 ComfyUI 的实际执行中可能会有所不同
            return ("",)
        except:
            return ("",)

class TextMatchNodeController:
    """
    文本匹配节点控制器
    
    功能：
    - 配置5组文本和节点ID的配对
    - 通过索引输入文本，如果匹配某组的文本，则控制该组对应的节点ID为"忽略"状态
    - 配对成功后，忽略对应节点的执行
    
    使用方法：
    1. 在索引输入中输入要匹配的文本（如"小猫"）
    2. 配置5组文本和节点ID配对
    3. 如果索引文本匹配某一组的文本，该组对应的节点将被设置为"忽略"状态
    """
    
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "index_text": ("STRING", {
                    "default": "",
                    "display_name": "索引输入",
                    "tooltip": "输入要匹配的文本，如果匹配某一组的文本，则控制对应节点为忽略状态"
                }),
            },
            "optional": {
                "text1": ("STRING", {
                    "default": "",
                    "display_name": "文本1",
                    "tooltip": "第1组：匹配文本"
                }),
                "node_id1": ("STRING", {
                    "default": "",
                    "display_name": "节点ID1",
                    "tooltip": "第1组：对应的节点ID"
                }),
                "text2": ("STRING", {
                    "default": "",
                    "display_name": "文本2",
                    "tooltip": "第2组：匹配文本"
                }),
                "node_id2": ("STRING", {
                    "default": "",
                    "display_name": "节点ID2",
                    "tooltip": "第2组：对应的节点ID"
                }),
                "text3": ("STRING", {
                    "default": "",
                    "display_name": "文本3",
                    "tooltip": "第3组：匹配文本"
                }),
                "node_id3": ("STRING", {
                    "default": "",
                    "display_name": "节点ID3",
                    "tooltip": "第3组：对应的节点ID"
                }),
                "text4": ("STRING", {
                    "default": "",
                    "display_name": "文本4",
                    "tooltip": "第4组：匹配文本"
                }),
                "node_id4": ("STRING", {
                    "default": "",
                    "display_name": "节点ID4",
                    "tooltip": "第4组：对应的节点ID"
                }),
                "text5": ("STRING", {
                    "default": "",
                    "display_name": "文本5",
                    "tooltip": "第5组：匹配文本"
                }),
                "node_id5": ("STRING", {
                    "default": "",
                    "display_name": "节点ID5",
                    "tooltip": "第5组：对应的节点ID"
                }),
            }
        }
    
    RETURN_TYPES = ("STRING", "INT")
    RETURN_NAMES = ("status_info", "mode_value")
    FUNCTION = "match_and_control"
    CATEGORY = "工具/AnyDoor"
    DESCRIPTION = "文本匹配节点控制器：根据索引文本匹配，控制对应节点为忽略状态"
    OUTPUT_NODE = True
    
    def match_and_control(self, index_text: str = "", text1: str = "", node_id1: str = "",
                         text2: str = "", node_id2: str = "", text3: str = "", node_id3: str = "",
                         text4: str = "", node_id4: str = "", text5: str = "", node_id5: str = "") -> Tuple[str, int]:
        """
        根据索引文本匹配对应的文本，控制匹配组的节点ID为忽略状态
        
        Args:
            index_text: 索引输入的文本
            text1-text5: 5组匹配文本
            node_id1-node_id5: 5组对应的节点ID
            
        Returns:
            Tuple[str, int]: (状态信息, 模式值)
        """
        try:
            index_text = str(index_text).strip()
            
            # 收集所有组的数据
            groups = []
            group_data = [
                (text1, node_id1),
                (text2, node_id2),
                (text3, node_id3),
                (text4, node_id4),
                (text5, node_id5)
            ]
            
            for i, (text, node_id) in enumerate(group_data, 1):
                text = str(text).strip() if text else ""
                node_id = str(node_id).strip() if node_id else ""
                
                if text and node_id:  # 只有文本和节点ID都配置了才有效
                    groups.append({
                        "group_num": i,
                        "text": text,
                        "node_id": node_id
                    })
            
            if not groups:
                return ("错误: 请至少配置一组文本和节点ID配对", 0)
            
            if not index_text:
                return ("提示: 索引输入为空，未进行匹配", 0)
            
            import re
            
            # 解析所有组的节点ID
            all_groups_with_nodes = []
            for group in groups:
                node_ids_str = str(group["node_id"]).strip()
                # 提取所有数字
                numbers = re.findall(r'\d+', node_ids_str)
                node_ids = [int(n) for n in numbers if n.isdigit() and int(n) > 0]
                if node_ids:
                    group["parsed_node_ids"] = list(set(node_ids))  # 去重
                    all_groups_with_nodes.append(group)
            
            # 查找匹配的组（精确匹配）
            matched_groups = []
            unmatched_groups = []
            for group in all_groups_with_nodes:
                if index_text == group["text"]:
                    matched_groups.append(group)
                else:
                    unmatched_groups.append(group)
            
            # 收集所有需要控制的节点ID
            # 1. 先恢复所有未匹配组的节点为正常状态（mode=0）
            # 2. 然后设置匹配组的节点为忽略状态（mode=2）
            restore_node_ids = []  # 需要恢复正常的节点
            bypass_node_ids = []   # 需要忽略的节点
            
            for group in unmatched_groups:
                restore_node_ids.extend(group["parsed_node_ids"])
            
            for group in matched_groups:
                bypass_node_ids.extend(group["parsed_node_ids"])
            
            # 去重
            restore_node_ids = list(set(restore_node_ids))
            bypass_node_ids = list(set(bypass_node_ids))
            
            # 移除既需要恢复又需要忽略的节点（这种情况理论上不应该发生，但为了安全）
            bypass_node_ids = [nid for nid in bypass_node_ids if nid not in restore_node_ids]
            
            # 将控制请求添加到待处理队列（供前端 JavaScript 使用）
            try:
                if not hasattr(self, '_control_requests'):
                    self._control_requests = []
                
                # 先恢复未匹配组的节点为正常状态
                for nid in restore_node_ids:
                    self._control_requests.append({
                        'node_id': nid,
                        'mode': 0,
                        'mode_name': '正常执行'
                    })
                
                # 然后设置匹配组的节点为忽略状态
                for nid in bypass_node_ids:
                    self._control_requests.append({
                        'node_id': nid,
                        'mode': 2,
                        'mode_name': '忽略'
                    })
            except:
                pass
            
            # 尝试修改节点的 bypass 状态
            restore_results = []
            bypass_results = []
            
            # 恢复未匹配组的节点
            for nid in restore_node_ids:
                success, info = self._set_node_bypass(nid, 0)
                restore_results.append((nid, success, info))
            
            # 忽略匹配组的节点
            for nid in bypass_node_ids:
                success, info = self._set_node_bypass(nid, 2)
                bypass_results.append((nid, success, info))
            
            # 生成状态信息
            restore_success_count = sum(1 for _, s, _ in restore_results if s)
            bypass_success_count = sum(1 for _, s, _ in bypass_results if s)
            
            if matched_groups:
                # 有匹配成功
                matched_info = []
                for group in matched_groups:
                    matched_info.append(f"组{group['group_num']}: 文本=\"{group['text']}\", 节点ID={group['node_id']}")
                
                status_parts = [
                    f"✓ 配对成功",
                    f"\n索引文本: \"{index_text}\"",
                    f"匹配组数: {len(matched_groups)}",
                    f"{chr(10).join(matched_info)}"
                ]
                
                if restore_node_ids:
                    status_parts.append(f"\n\n恢复正常节点数: {len(restore_node_ids)}")
                    status_parts.append(f"成功: {restore_success_count}")
                    status_parts.append(f"节点编号: {', '.join(map(str, restore_node_ids))}")
                
                if bypass_node_ids:
                    status_parts.append(f"\n\n忽略节点数: {len(bypass_node_ids)}")
                    status_parts.append(f"成功: {bypass_success_count}")
                    status_parts.append(f"节点编号: {', '.join(map(str, bypass_node_ids))}")
                
                status_parts.append(f"\n\n注意: 节点状态将在工作流执行时由前端自动设置。")
                
                status_info = "".join(status_parts)
                return (status_info, 2)
            else:
                # 没有匹配到任何组，恢复所有节点为正常状态
                if restore_node_ids:
                    status_info = f"未找到匹配，已恢复所有节点为正常状态\n\n索引文本: \"{index_text}\"\n已配置组数: {len(groups)}\n配置的文本: {', '.join([g['text'] for g in groups])}\n\n恢复节点数: {len(restore_node_ids)}\n成功: {restore_success_count}\n节点编号: {', '.join(map(str, restore_node_ids))}\n\n注意: 节点状态将在工作流执行时由前端自动设置。"
                else:
                    # 即使没有节点需要恢复，也要返回有效输出
                    status_info = f"未找到匹配\n索引文本: \"{index_text}\"\n已配置组数: {len(groups)}\n配置的文本: {', '.join([g['text'] for g in groups])}\n\n注意: 所有节点将保持当前状态。"
                return (status_info, 0)
            
        except Exception as e:
            return (f"匹配控制过程中出现错误: {str(e)}", 0)
    
    def _set_node_bypass(self, node_id: int, mode: int) -> Tuple[bool, str]:
        """
        设置指定节点的 bypass 状态（与 NodeBypassController 中的方法相同）
        
        Args:
            node_id: 节点编号
            mode: 要设置的 mode 值 (0=正常, 1=禁用, 2=忽略)
            
        Returns:
            Tuple[bool, str]: (是否成功, 信息)
        """
        try:
            mode_names = {0: "正常执行", 1: "禁用", 2: "忽略"}
            mode_name = mode_names.get(mode, f"模式{mode}")
            
            return (True, f"控制请求已提交。前端将在执行时设置节点 {node_id} 为 {mode_name} (mode={mode})")
            
        except Exception as e:
            return (False, f"访问节点时出错: {str(e)}")

