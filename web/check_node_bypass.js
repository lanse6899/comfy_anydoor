/**
 * AnyDoor - ComfyUI 节点 Bypass 控制器 - 前端支持脚本
 * 这个脚本实现在浏览器端控制节点 bypass 状态的功能
 */

// 立即输出日志，确认文件被加载
console.log("=== AnyDoor: JavaScript 文件开始加载 ===");

// ComfyUI web 扩展的标准导入方式
import { app } from "../../../scripts/app.js";

console.log("=== AnyDoor: app 导入完成 ===", { app: typeof app !== 'undefined' });

app.registerExtension({
    name: "AnyDoor.NodeBypassController",
    async setup() {
        console.log("=== AnyDoor: setup() 函数开始执行 ===");
        
        // 设置节点 bypass 状态的函数
        const setNodeBypass = (nodeId, mode) => {
            try {
                const graph = app.graph;
                if (!graph) {
                    return { success: false, message: "无法访问工作流图" };
                }
                
                // 查找节点 - 使用多种方式
                let targetNode = null;
                
                // 清理输入的节点ID（去掉可能的 # 号）
                const cleanNodeId = typeof nodeId === 'string' ? nodeId.replace(/^#/, '') : nodeId;
                const nodeIdNum = parseInt(cleanNodeId);
                const nodeIdStr = String(cleanNodeId);
                
                console.log(`AnyDoor: 查找节点，输入ID: ${nodeId}, 清理后: ${cleanNodeId}, 数字: ${nodeIdNum}`);
                
                // 方法1: 通过 _nodes_by_id 查找
                if (graph._nodes_by_id) {
                    targetNode = graph._nodes_by_id[nodeIdNum] || 
                                graph._nodes_by_id[nodeIdStr] ||
                                graph._nodes_by_id[nodeId] ||
                                graph._nodes_by_id[`#${nodeIdNum}`];
                    
                    if (targetNode) {
                        console.log(`AnyDoor: 通过_nodes_by_id找到节点 ${nodeIdNum}`);
                    }
                }
                
                // 方法2: 遍历所有节点查找（最可靠的方法）
                if (!targetNode && graph._nodes) {
                    for (const node of graph._nodes) {
                        // 获取节点的实际ID（可能是数字、字符串、或带#号）
                        const nodeIdActual = node.id;
                        const nodeIdClean = typeof nodeIdActual === 'string' ? 
                                           nodeIdActual.replace(/^#/, '') : 
                                           nodeIdActual;
                        const nodeIdActualNum = parseInt(nodeIdClean);
                        
                        // 检查多种可能的ID匹配方式
                        if (nodeIdActualNum === nodeIdNum ||
                            nodeIdClean === nodeIdStr ||
                            nodeIdActual === nodeIdNum ||
                            nodeIdActual === nodeIdStr ||
                            nodeIdActual === `#${nodeIdNum}` ||
                            String(nodeIdActualNum) === nodeIdStr) {
                            targetNode = node;
                            console.log(`AnyDoor: 通过遍历找到节点 ${nodeId}`, { 
                                inputId: nodeId,
                                cleanInputId: cleanNodeId,
                                foundId: nodeIdActual, 
                                foundIdClean: nodeIdClean,
                                foundIdNum: nodeIdActualNum,
                                nodeType: node.type,
                                nodeTitle: node.title 
                            });
                            break;
                        }
                    }
                }
                
                // 方法3: 使用 getNodeById (如果存在)
                if (!targetNode && graph.getNodeById) {
                    try {
                        targetNode = graph.getNodeById(nodeId);
                        if (targetNode) {
                            console.log(`AnyDoor: 通过getNodeById找到节点 ${nodeId}`);
                        }
                    } catch(e) {
                        console.warn("AnyDoor: getNodeById失败", e);
                    }
                }
                
                if (!targetNode) {
                    // 调试信息：列出所有节点ID和详细信息
                    const allNodeIds = [];
                    if (graph._nodes) {
                        graph._nodes.forEach(node => {
                            const nodeIdInfo = {
                                id: node.id,
                                idType: typeof node.id,
                                idClean: typeof node.id === 'string' ? node.id.replace(/^#/, '') : node.id,
                                type: node.type,
                                title: node.title,
                                mode: node.mode !== undefined ? node.mode : 'undefined'
                            };
                            allNodeIds.push(nodeIdInfo);
                        });
                    }
                    
                    // 也检查 _nodes_by_id 中的键
                    const nodesByIdKeys = graph._nodes_by_id ? Object.keys(graph._nodes_by_id) : [];
                    
                    console.warn(`AnyDoor: 未找到编号为 ${nodeId} (清理后: ${cleanNodeId}) 的节点`, {
                        searchedIds: [nodeId, cleanNodeId, nodeIdNum, nodeIdStr, `#${nodeIdNum}`],
                        availableNodes: allNodeIds,
                        nodesByIdKeys: nodesByIdKeys.slice(0, 20) // 只显示前20个
                    });
                    
                    return { 
                        success: false, 
                        message: `未找到编号为 ${nodeId} 的节点`,
                        searchedIds: [String(nodeId), String(cleanNodeId), String(nodeIdNum)],
                        availableNodeIds: allNodeIds.map(n => n.id)
                    };
                }
                
                // 设置节点的 mode
                // mode: 0=正常执行, 1=禁用, 2=Bypass
                const modeValue = parseInt(mode);
                
                console.log(`AnyDoor: 准备设置节点`, {
                    inputId: nodeId,
                    cleanInputId: cleanNodeId,
                    targetNodeId: targetNode.id,
                    targetNodeIdType: typeof targetNode.id,
                    mode: modeValue,
                    targetNode: targetNode
                });
                
                // 设置 mode - 使用 ComfyUI 的标准方式
                const oldMode = targetNode.mode;
                
                // 方法1: 直接设置 mode 属性（必需）
                targetNode.mode = modeValue;
                
                // 方法2: 使用节点的 setMode 方法（如果存在）
                if (typeof targetNode.setMode === 'function') {
                    try {
                        targetNode.setMode(modeValue);
                        console.log(`AnyDoor: 使用setMode方法设置`);
                    } catch(e) {
                        console.warn("AnyDoor: setMode方法失败", e);
                    }
                }
                
                // 方法3: 通过序列化数据设置（确保保存到工作流）
                if (targetNode.constructor && targetNode.constructor.widgets) {
                    // 确保mode被序列化保存
                    const serialized = targetNode.serialize ? targetNode.serialize() : null;
                    if (serialized && serialized.mode !== modeValue) {
                        serialized.mode = modeValue;
                    }
                }
                
                // 方法4: 触发 ComfyUI 的节点模式变更事件
                if (app.graph) {
                    // 触发 graph 更新（这会触发重绘）
                    app.graph.setDirtyCanvas(true, true);
                    
                    // 如果 graph 有 changeNodeMode 方法，使用它
                    if (typeof app.graph.changeNodeMode === 'function') {
                        try {
                            app.graph.changeNodeMode(targetNode.id, modeValue);
                            console.log(`AnyDoor: 使用graph.changeNodeMode设置`);
                        } catch(e) {
                            console.warn("AnyDoor: changeNodeMode失败", e);
                        }
                    }
                    
                    // 触发节点重绘
                    if (targetNode.onResize && typeof targetNode.onResize === 'function') {
                        try {
                            targetNode.onResize();
                        } catch(e) {}
                    }
                }
                
                // 方法5: 直接操作DOM元素（ComfyUI节点有el属性）
                // 根据mode值设置正确的视觉状态
                if (targetNode.el) {
                    const el = targetNode.el;
                    
                    // 移除所有mode相关的class和样式
                    el.classList.remove('mode-0', 'mode-1', 'mode-2', 'bypass', 'disabled');
                    
                    // 根据mode值设置不同的视觉状态
                    if (modeValue === 0) {
                        // 正常执行 - 恢复默认状态
                        el.classList.add('mode-0');
                        el.style.opacity = '';
                        el.style.filter = '';
                        // 移除黄色遮罩
                        const overlay = el.querySelector('.bypass-yellow-overlay');
                        if (overlay) {
                            overlay.style.display = 'none';
                        }
                        // 移除bypass标记
                        const indicator = el.querySelector('.bypass-indicator');
                        if (indicator) {
                            indicator.remove();
                        }
                    } else if (modeValue === 1) {
                        // 禁用节点 - 显示为灰色
                        el.classList.add('mode-1', 'disabled');
                        el.style.opacity = '0.5';
                        el.style.filter = 'grayscale(100%)';
                        // 移除黄色遮罩
                        const overlay = el.querySelector('.bypass-yellow-overlay');
                        if (overlay) {
                            overlay.style.display = 'none';
                        }
                        // 移除bypass标记
                        const indicator = el.querySelector('.bypass-indicator');
                        if (indicator) {
                            indicator.remove();
                        }
                    } else if (modeValue === 2) {
                        // 忽略节点（Bypass）- 60%透明度，黄色遮罩
                        el.classList.add('mode-2', 'bypass');
                        el.style.opacity = '0.6';
                        el.style.filter = '';
                        
                        // 确保节点是相对定位
                        if (el.style.position !== 'relative') {
                            el.style.position = 'relative';
                        }
                        
                        // 添加黄色遮罩层（如果不存在则创建）
                        let yellowOverlay = el.querySelector('.bypass-yellow-overlay');
                        if (!yellowOverlay) {
                            yellowOverlay = document.createElement('div');
                            yellowOverlay.className = 'bypass-yellow-overlay';
                            el.appendChild(yellowOverlay);
                        }
                        yellowOverlay.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;background-color:rgba(255,235,59,0.4);pointer-events:none;z-index:1;border-radius:inherit;';
                        yellowOverlay.style.display = 'block';
                        
                        // 添加bypass标记（如果不存在则创建）
                        let indicator = el.querySelector('.bypass-indicator');
                        if (!indicator) {
                            indicator = document.createElement('div');
                            indicator.className = 'bypass-indicator';
                            el.appendChild(indicator);
                        }
                        indicator.style.cssText = 'position:absolute;top:5px;right:5px;color:#f57f17;font-size:12px;font-weight:bold;z-index:2;';
                        indicator.textContent = '⏭';
                        indicator.style.display = 'block';
                    }
                    
                    // 强制重绘
                    requestAnimationFrame(() => {
                        el.style.display = 'none';
                        el.offsetHeight; // 触发重排
                        el.style.display = '';
                    });
                }
                
                // 方法6: 触发画布重绘
                if (app.canvas) {
                    app.canvas.setDirty(true);
                    if (app.canvas.dirty !== undefined) {
                        app.canvas.dirty = true;
                    }
                    // 触发绘制更新
                    if (typeof app.canvas.draw === 'function') {
                        try {
                            setTimeout(() => app.canvas.draw(), 10);
                        } catch(e) {}
                    }
                }
                
                // 验证设置是否成功
                const verifyMode = targetNode.mode;
                const modeChanged = verifyMode === modeValue;
                
                console.log(`AnyDoor: 设置节点 ${nodeId} (ID: ${targetNode.id}) 模式`, {
                    oldMode: oldMode,
                    newMode: modeValue,
                    verifiedMode: verifyMode,
                    success: modeChanged,
                    nodeTitle: targetNode.title || targetNode.type || "未知节点",
                    nodeElement: targetNode.el ? "有DOM元素" : "无DOM元素"
                });
                
                if (!modeChanged) {
                    console.error(`AnyDoor: 警告！节点模式设置后验证失败！期望: ${modeValue}, 实际: ${verifyMode}`);
                }
                
                return { 
                    success: modeChanged, 
                    message: modeChanged ? 
                        `成功设置节点 ${nodeId} 的模式为 ${modeValue}` : 
                        `设置节点 ${nodeId} 模式可能失败 (期望: ${modeValue}, 实际: ${verifyMode})`,
                    nodeTitle: targetNode.title || targetNode.type || "未知节点",
                    nodeId: targetNode.id,
                    oldMode: oldMode,
                    newMode: modeValue,
                    verifiedMode: verifyMode
                };
            } catch (error) {
                console.error("AnyDoor: 设置节点 bypass 状态失败:", error);
                return { success: false, message: `设置失败: ${error.message}` };
            }
        };
        
        // 获取节点 bypass 状态的函数
        const getNodeBypass = (nodeId) => {
            try {
                const graph = app.graph;
                if (!graph) {
                    return null;
                }
                
                const node = graph._nodes_by_id[nodeId] || graph._nodes_by_id[String(nodeId)];
                if (!node) {
                    return null;
                }
                
                return {
                    nodeId: nodeId,
                    mode: node.mode !== undefined ? node.mode : 0,
                    title: node.title || node.type || "未知节点",
                    type: node.type || "未知类型"
                };
            } catch (error) {
                console.error("获取节点 bypass 状态失败:", error);
                return null;
            }
        };
        
        // 监听控制节点并实时应用设置
        const setupControlWatcher = () => {
            // 存储控制状态，避免重复设置（使用全局的Map）
            if (!window.AnyDoor) window.AnyDoor = {};
            if (!window.AnyDoor.controlState) window.AnyDoor.controlState = new Map();
            // 存储每个控制节点之前控制的节点ID列表
            if (!window.AnyDoor.controlHistory) window.AnyDoor.controlHistory = new Map();
            const controlState = window.AnyDoor.controlState;
            const controlHistory = window.AnyDoor.controlHistory;
            
            // 定期检查所有控制节点并应用设置
            const applyAllControls = () => {
                try {
                    const graph = app.graph;
                    if (!graph || !graph._nodes) return;
                    
                    graph._nodes.forEach(controlNode => {
                        // 检查是否是我们的控制节点
                        const isControlNode = controlNode.type === "NodeBypassController" || 
                                              controlNode.comfyClass === "NodeBypassController";
                        const isTextMatchNode = controlNode.type === "TextMatchNodeController" || 
                                                 controlNode.comfyClass === "TextMatchNodeController";
                        
                        // 处理TextMatchNodeController节点
                        if (isTextMatchNode) {
                            console.log(`AnyDoor: 处理TextMatchNodeController节点 ${controlNode.id}`);
                            const widgets = controlNode.widgets || [];
                            if (!widgets || widgets.length === 0) return;
                            
                            // 查找索引输入和所有配置组
                            let indexTextWidget = null;
                            const textWidgets = {};
                            const nodeIdWidgets = {};
                            
                            for (const widget of widgets) {
                                const widgetName = widget.name || (widget.options && widget.options.name);
                                if (widgetName === "index_text") {
                                    indexTextWidget = widget;
                                } else if (widgetName && widgetName.startsWith("text") && widgetName.length > 4) {
                                    const groupNum = widgetName.replace("text", "");
                                    if (groupNum && /^\d+$/.test(groupNum)) {
                                        textWidgets[groupNum] = widget;
                                    }
                                } else if (widgetName && widgetName.startsWith("node_id") && widgetName.length > 7) {
                                    const groupNum = widgetName.replace("node_id", "");
                                    if (groupNum && /^\d+$/.test(groupNum)) {
                                        nodeIdWidgets[groupNum] = widget;
                                    }
                                }
                            }
                            
                            if (indexTextWidget) {
                                // 获取索引文本 - 优先从连接的输入获取
                                let indexText = "";
                                let hasIndexConnection = false;
                                
                                // 方法1: 检查输入是否被连接（从输入链路获取值）
                                if (controlNode.inputs) {
                                    for (let i = 0; i < controlNode.inputs.length; i++) {
                                        const input = controlNode.inputs[i];
                                        // 检查这个输入是否对应index_text widget，且是否有连接
                                        if ((input.name === 'index_text' || 
                                             input.widget === indexTextWidget ||
                                             (indexTextWidget && input.widget?.name === 'index_text')) &&
                                            input.link !== null && input.link !== undefined) {
                                            
                                            hasIndexConnection = true;
                                            
                                            // 获取连接的源节点
                                            const link = input.link;
                                            let sourceNodeId = null;
                                            let sourceOutputIndex = 0;
                                            
                                            // 解析连接信息
                                            if (graph.links && (typeof link === 'number' || typeof link === 'string')) {
                                                const linkId = String(link);
                                                const linkInfo = graph.links[linkId];
                                                if (linkInfo && typeof linkInfo === 'object') {
                                                    sourceNodeId = linkInfo.origin_id || linkInfo.origin || linkInfo[0];
                                                    sourceOutputIndex = linkInfo.origin_slot || linkInfo.originSlot || linkInfo[1] || 0;
                                                }
                                            }
                                            
                                            if (!sourceNodeId) {
                                                if (Array.isArray(link)) {
                                                    sourceNodeId = link[0];
                                                    sourceOutputIndex = link[1] || 0;
                                                } else if (link && typeof link === 'object') {
                                                    sourceNodeId = link.id || link.node_id || link.nodeId || link[0];
                                                    sourceOutputIndex = link.output || link.outputIndex || link.slot || link[1] || 0;
                                                } else if (typeof link === 'number' || typeof link === 'string') {
                                                    sourceNodeId = link;
                                                    sourceOutputIndex = 0;
                                                }
                                            }
                                            
                                            if (sourceNodeId !== null && sourceNodeId !== undefined) {
                                                // 查找源节点
                                                let sourceNode = graph._nodes_by_id?.[sourceNodeId] || 
                                                                 graph._nodes?.find(n => n.id === sourceNodeId || String(n.id) === String(sourceNodeId));
                                                
                                                if (sourceNode) {
                                                    console.log(`AnyDoor: TextMatchNodeController 检测到index_text连接输入，源节点${sourceNodeId}`);
                                                    
                                                    // 方法1: 使用getInputValue（最直接的方法）
                                                    if (typeof controlNode.getInputValue === 'function') {
                                                        try {
                                                            const inputValue = controlNode.getInputValue('index_text');
                                                            if (inputValue !== undefined && inputValue !== null && inputValue !== '') {
                                                                indexText = String(inputValue).trim();
                                                                console.log(`AnyDoor: ✓ 通过getInputValue成功获取index_text连接值: "${indexText}"`);
                                                            }
                                                        } catch(e) {
                                                            console.warn('AnyDoor: getInputValue获取index_text失败', e);
                                                        }
                                                    }
                                                    
                                                    // 方法2: 从源节点的输出获取
                                                    if (!indexText && sourceNode.outputs && sourceNode.outputs.length > sourceOutputIndex) {
                                                        const output = sourceNode.outputs[sourceOutputIndex];
                                                        if (output !== undefined && output !== null) {
                                                            if (typeof output === 'string') {
                                                                indexText = output.trim();
                                                            } else if (typeof output === 'object') {
                                                                indexText = (output.value || output.text || output.string || String(output[0] || "")).trim();
                                                            } else {
                                                                indexText = String(output).trim();
                                                            }
                                                            if (indexText) {
                                                                console.log(`AnyDoor: ✓ 从源节点输出获取index_text: "${indexText}"`);
                                                            }
                                                        }
                                                    }
                                                    
                                                    // 方法3: 从源节点的widget获取（多行文本节点）
                                                    if (!indexText && sourceNode.widgets) {
                                                        for (const widget of sourceNode.widgets) {
                                                            const isTextWidget = widget.type === 'STRING' || 
                                                                                widget.type === 'text' || 
                                                                                widget.type === 'multiline' ||
                                                                                widget.name === 'text' ||
                                                                                widget.name === 'STRING';
                                                            
                                                            if (isTextWidget) {
                                                                let widgetValue = null;
                                                                
                                                                // 尝试从textarea获取
                                                                if (widget.textarea && widget.textarea.value) {
                                                                    widgetValue = widget.textarea.value;
                                                                } else if (widget.value !== undefined && widget.value !== null) {
                                                                    widgetValue = widget.value;
                                                                } else if (widget.inputEl && widget.inputEl.value) {
                                                                    widgetValue = widget.inputEl.value;
                                                                }
                                                                
                                                                if (widgetValue) {
                                                                    indexText = String(widgetValue).trim();
                                                                    console.log(`AnyDoor: ✓ 从源节点widget获取index_text: "${indexText}"`);
                                                                    break;
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                                
                                // 方法2: 如果没有连接输入或获取失败，从widget本身获取
                                if (!hasIndexConnection || !indexText) {
                                    if (indexTextWidget.value !== undefined && indexTextWidget.value !== null) {
                                        indexText = String(indexTextWidget.value || "").trim();
                                        if (hasIndexConnection && indexText) {
                                            console.warn(`AnyDoor: ⚠️ 检测到连接输入但未能获取到值，使用widget值: "${indexText}"`);
                                        } else if (!hasIndexConnection) {
                                            console.log(`AnyDoor: 从index_text widget获取值: "${indexText}"`);
                                        }
                                    }
                                }
                                
                                console.log(`AnyDoor: TextMatchNodeController 最终索引文本: "${indexText}"`);
                                
                                // 收集所有配置的组
                                const groups = [];
                                for (let i = 1; i <= 5; i++) {
                                    const textWidget = textWidgets[i];
                                    const nodeIdWidget = nodeIdWidgets[i];
                                    
                                    if (textWidget && nodeIdWidget) {
                                        let text = "";
                                        let nodeId = "";
                                        
                                        if (textWidget.value !== undefined && textWidget.value !== null) {
                                            text = String(textWidget.value || "").trim();
                                        }
                                        
                                        // 处理 node_id：优先从连接输入获取，如果没有连接则从widget获取
                                        const nodeIdInputName = `node_id${i}`;
                                        let hasNodeIdConnection = false;
                                        
                                        // 检查 node_id 是否有连接输入
                                        if (controlNode.inputs) {
                                            for (let j = 0; j < controlNode.inputs.length; j++) {
                                                const input = controlNode.inputs[j];
                                                if ((input.name === nodeIdInputName || 
                                                     input.widget === nodeIdWidget) &&
                                                    input.link !== null && input.link !== undefined) {
                                                    
                                                    hasNodeIdConnection = true;
                                                    
                                                    // 获取连接的源节点
                                                    const link = input.link;
                                                    let sourceNodeId = null;
                                                    let sourceOutputIndex = 0;
                                                    
                                                    // 解析连接信息
                                                    if (graph.links && (typeof link === 'number' || typeof link === 'string')) {
                                                        const linkId = String(link);
                                                        const linkInfo = graph.links[linkId];
                                                        if (linkInfo && typeof linkInfo === 'object') {
                                                            sourceNodeId = linkInfo.origin_id || linkInfo.origin || linkInfo[0];
                                                            sourceOutputIndex = linkInfo.origin_slot || linkInfo.originSlot || linkInfo[1] || 0;
                                                        }
                                                    }
                                                    
                                                    if (!sourceNodeId) {
                                                        if (Array.isArray(link)) {
                                                            sourceNodeId = link[0];
                                                            sourceOutputIndex = link[1] || 0;
                                                        } else if (link && typeof link === 'object') {
                                                            sourceNodeId = link.id || link.node_id || link.nodeId || link[0];
                                                            sourceOutputIndex = link.output || link.outputIndex || link.slot || link[1] || 0;
                                                        } else if (typeof link === 'number' || typeof link === 'string') {
                                                            sourceNodeId = link;
                                                            sourceOutputIndex = 0;
                                                        }
                                                    }
                                                    
                                                    if (sourceNodeId !== null && sourceNodeId !== undefined) {
                                                        // 查找源节点
                                                        let sourceNode = graph._nodes_by_id?.[sourceNodeId] || 
                                                                         graph._nodes?.find(n => n.id === sourceNodeId || String(n.id) === String(sourceNodeId));
                                                        
                                                        if (sourceNode) {
                                                            console.log(`AnyDoor: TextMatchNodeController 检测到node_id${i}连接输入，源节点${sourceNodeId}`);
                                                            
                                                            // 使用标准方法获取值
                                                            // 方法1: 使用getInputValue（最直接的方法）
                                                            if (typeof controlNode.getInputValue === 'function') {
                                                                try {
                                                                    const inputValue = controlNode.getInputValue(nodeIdInputName);
                                                                    if (inputValue !== undefined && inputValue !== null && inputValue !== '') {
                                                                        nodeId = String(inputValue).trim();
                                                                        console.log(`AnyDoor: ✓ 通过getInputValue成功获取node_id${i}连接值: "${nodeId}"`);
                                                                    }
                                                                } catch(e) {
                                                                    console.warn(`AnyDoor: getInputValue获取node_id${i}失败`, e);
                                                                }
                                                            }
                                                            
                                                            // 方法2: 从源节点的输出获取
                                                            if (!nodeId && sourceNode.outputs && sourceNode.outputs.length > sourceOutputIndex) {
                                                                const output = sourceNode.outputs[sourceOutputIndex];
                                                                if (output !== undefined && output !== null) {
                                                                    if (typeof output === 'string') {
                                                                        nodeId = output.trim();
                                                                    } else if (typeof output === 'object') {
                                                                        nodeId = (output.value || output.text || output.string || String(output[0] || "")).trim();
                                                                    } else {
                                                                        nodeId = String(output).trim();
                                                                    }
                                                                    if (nodeId) {
                                                                        console.log(`AnyDoor: ✓ 从源节点输出获取node_id${i}: "${nodeId}"`);
                                                                    }
                                                                }
                                                            }
                                                            
                                                            // 方法3: 从源节点的widget获取（多行文本节点）
                                                            if (!nodeId && sourceNode.widgets) {
                                                                for (const widget of sourceNode.widgets) {
                                                                    const isTextWidget = widget.type === 'STRING' || 
                                                                                        widget.type === 'text' || 
                                                                                        widget.type === 'multiline' ||
                                                                                        widget.name === 'text' ||
                                                                                        widget.name === 'STRING';
                                                                    
                                                                    if (isTextWidget) {
                                                                        let widgetValue = null;
                                                                        
                                                                        // 尝试从textarea获取
                                                                        if (widget.textarea && widget.textarea.value) {
                                                                            widgetValue = widget.textarea.value;
                                                                        } else if (widget.value !== undefined && widget.value !== null) {
                                                                            widgetValue = widget.value;
                                                                        } else if (widget.inputEl && widget.inputEl.value) {
                                                                            widgetValue = widget.inputEl.value;
                                                                        }
                                                                        
                                                                        if (widgetValue) {
                                                                            nodeId = String(widgetValue).trim();
                                                                            console.log(`AnyDoor: ✓ 从源节点widget获取node_id${i}: "${nodeId}"`);
                                                                            break;
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            break;
                                                        }
                                                    }
                                                }
                                            }
                                        }
                                        
                                        // 如果没有连接输入或获取失败，从widget本身获取
                                        if (!hasNodeIdConnection || !nodeId) {
                                            if (nodeIdWidget.value !== undefined && nodeIdWidget.value !== null) {
                                                nodeId = String(nodeIdWidget.value || "").trim();
                                                if (hasNodeIdConnection && nodeId) {
                                                    console.warn(`AnyDoor: ⚠️ 检测到node_id${i}连接输入但未能获取到值，使用widget值: "${nodeId}"`);
                                                } else if (!hasNodeIdConnection) {
                                                    console.log(`AnyDoor: 从node_id${i} widget获取值: "${nodeId}"`);
                                                }
                                            }
                                        }
                                        
                                        if (text && nodeId) {
                                            groups.push({ groupNum: i, text, nodeId });
                                            console.log(`AnyDoor: TextMatchNodeController 组${i}: text="${text}", nodeId="${nodeId}"`);
                                        }
                                    }
                                }
                                
                                if (groups.length > 0 && indexText) {
                                    // 查找匹配的组
                                    const matchedGroups = groups.filter(g => g.text === indexText);
                                    const unmatchedGroups = groups.filter(g => g.text !== indexText);
                                    
                                    console.log(`AnyDoor: TextMatchNodeController 匹配组数: ${matchedGroups.length}, 未匹配组数: ${unmatchedGroups.length}`);
                                    
                                    // 提取节点ID（参考后端逻辑：匹配组优先）
                                    const restoreNodeIds = [];
                                    const bypassNodeIds = [];
                                    const matchedNodeIdsSet = new Set(); // 匹配组中的所有节点ID集合
                                    
                                    // 先收集匹配组的所有节点ID（用于后续判断）
                                    matchedGroups.forEach(g => {
                                        const numbers = String(g.nodeId).match(/\d+/g) || [];
                                        numbers.forEach(n => {
                                            const id = parseInt(n);
                                            if (!isNaN(id) && id > 0) {
                                                matchedNodeIdsSet.add(id);
                                                bypassNodeIds.push(id);
                                            }
                                        });
                                    });
                                    
                                    // 收集未匹配组的节点ID（排除已在匹配组中的节点）
                                    unmatchedGroups.forEach(g => {
                                        const numbers = String(g.nodeId).match(/\d+/g) || [];
                                        numbers.forEach(n => {
                                            const id = parseInt(n);
                                            if (!isNaN(id) && id > 0 && !matchedNodeIdsSet.has(id)) {
                                                restoreNodeIds.push(id);
                                            }
                                        });
                                    });
                                    
                                    // 去重
                                    const uniqueRestore = [...new Set(restoreNodeIds)];
                                    const uniqueBypass = [...new Set(bypassNodeIds)];
                                    
                                    // 获取之前控制的节点ID列表（用于状态跟踪）
                                    const historyKey = `textmatch_${controlNode.id}`;
                                    const previousBypassNodeIds = controlHistory.get(historyKey) || [];
                                    const previousBypassNodeIdsKey = previousBypassNodeIds.sort((a, b) => a - b).join(',');
                                    
                                    // 获取当前需要忽略的所有节点ID（排序以便比较）
                                    const currentBypassNodeIds = [...uniqueBypass].sort((a, b) => a - b);
                                    const currentBypassNodeIdsKey = currentBypassNodeIds.join(',');
                                    
                                    console.log(`AnyDoor: TextMatchNodeController 节点ID列表比较`, {
                                        controlNodeId: controlNode.id,
                                        previousBypassNodeIds: previousBypassNodeIds,
                                        currentBypassNodeIds: currentBypassNodeIds,
                                        previousKey: previousBypassNodeIdsKey,
                                        currentKey: currentBypassNodeIdsKey
                                    });
                                    
                                    // 找出不再被控制的节点（需要恢复为正常执行）
                                    const nodesToRestore = previousBypassNodeIds.filter(id => !currentBypassNodeIds.includes(id));
                                    
                                    if (nodesToRestore.length > 0) {
                                        console.log(`AnyDoor: TextMatchNodeController 检测到需要恢复的节点:`, nodesToRestore, {
                                            原因: `这些节点不在当前列表 ${currentBypassNodeIdsKey} 中，将从之前的状态恢复为正常执行`
                                        });
                                    }
                                    
                                    // 恢复不再被控制的节点为正常执行状态
                                    nodesToRestore.forEach(nodeId => {
                                        console.log(`AnyDoor: 🔄 文本匹配节点 - 恢复节点 ${nodeId} 为正常执行状态（从之前的状态恢复）`);
                                        const restoreResult = setNodeBypass(nodeId, 0); // 0 = 正常执行
                                        if (restoreResult.success) {
                                            // 清除该节点的控制状态
                                            const oldStateKeys = [`${controlNode.id}_${nodeId}_0`, 
                                                               `${controlNode.id}_${nodeId}_1`, 
                                                               `${controlNode.id}_${nodeId}_2`];
                                            oldStateKeys.forEach(key => controlState.delete(key));
                                            console.log(`AnyDoor: ✓ 节点 ${nodeId} 已恢复为正常执行`);
                                        } else {
                                            console.warn(`AnyDoor: ✗ 恢复节点 ${nodeId} 失败:`, restoreResult.message);
                                        }
                                    });
                                    
                                    // 更新控制历史记录（无论是否有节点需要恢复都要更新）
                                    controlHistory.set(historyKey, currentBypassNodeIds);
                                    console.log(`AnyDoor: TextMatchNodeController 已更新控制历史记录`, {
                                        historyKey: historyKey,
                                        newHistory: currentBypassNodeIds
                                    });
                                    
                                    console.log(`AnyDoor: TextMatchNodeController 需要恢复的节点: ${uniqueRestore.join(',')}, 需要忽略的节点: ${uniqueBypass.join(',')}`);
                                    
                                    // 恢复未匹配的节点
                                    uniqueRestore.forEach(nodeId => {
                                        console.log(`AnyDoor: 文本匹配节点 - 恢复节点 ${nodeId} 为正常状态`);
                                        setNodeBypass(nodeId, 0);
                                    });
                                    
                                    // 忽略匹配的节点
                                    uniqueBypass.forEach(nodeId => {
                                        console.log(`AnyDoor: 文本匹配节点 - 忽略节点 ${nodeId}`);
                                        setNodeBypass(nodeId, 2);
                                    });
                                } else if (groups.length > 0) {
                                    // 索引为空，恢复所有节点
                                    const historyKey = `textmatch_${controlNode.id}`;
                                    const previousBypassNodeIds = controlHistory.get(historyKey) || [];
                                    
                                    console.log(`AnyDoor: TextMatchNodeController 索引为空，恢复所有节点`);
                                    console.log(`AnyDoor: TextMatchNodeController 之前控制的节点: ${previousBypassNodeIds.join(',')}`);
                                    
                                    // 恢复所有之前被控制的节点
                                    previousBypassNodeIds.forEach(nodeId => {
                                        console.log(`AnyDoor: 🔄 文本匹配节点 - 索引为空，恢复节点 ${nodeId} 为正常执行状态`);
                                        const restoreResult = setNodeBypass(nodeId, 0);
                                        if (restoreResult.success) {
                                            const oldStateKeys = [`${controlNode.id}_${nodeId}_0`, 
                                                               `${controlNode.id}_${nodeId}_1`, 
                                                               `${controlNode.id}_${nodeId}_2`];
                                            oldStateKeys.forEach(key => controlState.delete(key));
                                            console.log(`AnyDoor: ✓ 节点 ${nodeId} 已恢复为正常执行`);
                                        }
                                    });
                                    
                                    // 恢复所有配置的节点（以防万一）
                                    groups.forEach(g => {
                                        const numbers = String(g.nodeId).match(/\d+/g) || [];
                                        numbers.forEach(n => {
                                            const id = parseInt(n);
                                            if (!isNaN(id) && id > 0) {
                                                console.log(`AnyDoor: 文本匹配节点 - 索引为空，恢复节点 ${id} 为正常状态`);
                                                setNodeBypass(id, 0);
                                            }
                                        });
                                    });
                                    
                                    // 清空历史记录
                                    controlHistory.delete(historyKey);
                                }
                            }
                            return; // 处理完TextMatchNodeController后返回
                        }
                        
                        if (isControlNode) {
                            const widgets = controlNode.widgets || [];
                            if (!widgets || widgets.length === 0) return;
                            
                            // 查找输入控件 - 使用更可靠的方式
                            let nodeIdWidget = null;
                            let modeWidget = null;
                            
                            for (const widget of widgets) {
                                const widgetName = widget.name || (widget.options && widget.options.name);
                                if (widgetName === "node_id") {
                                    nodeIdWidget = widget;
                                } else if (widgetName === "set_bypass") {
                                    modeWidget = widget;
                                }
                            }
                            
                            if (nodeIdWidget && modeWidget) {
                                // 获取值 - 优先从连接的输入获取，否则从widget获取
                                let nodeIdValue = null;
                                
                                // 方法1: 检查输入是否被连接（从输入链路获取值）
                                // 查找node_id输入端口
                                let linkedValue = null;
                                
                                // 查找连接的输入
                                // 首先检查是否有连接输入（优先级最高）
                                let hasConnection = false;
                                if (controlNode.inputs) {
                                    for (let i = 0; i < controlNode.inputs.length; i++) {
                                        const input = controlNode.inputs[i];
                                        // 检查这个输入是否对应node_id widget，且是否有连接
                                        if ((input.name === 'node_id' || 
                                             input.widget === nodeIdWidget ||
                                             (nodeIdWidget && input.widget?.name === 'node_id')) &&
                                            input.link !== null && input.link !== undefined) {
                                            
                                            hasConnection = true; // 标记有连接输入
                                            
                                            // 获取连接的源节点
                                            const link = input.link;
                                            console.log(`AnyDoor: 发现连接输入，link结构:`, {
                                                link: link,
                                                linkType: typeof link,
                                                isArray: Array.isArray(link),
                                                linkLength: Array.isArray(link) ? link.length : 'N/A',
                                                linkKeys: link && typeof link === 'object' ? Object.keys(link) : 'N/A'
                                            });
                                            
                                            // 尝试多种方式获取源节点ID
                                            let sourceNodeId = null;
                                            let sourceOutputIndex = 0;
                                            
                                            // 首先检查 link 是否是 link_id（通过 graph.links 查找）
                                            if (graph.links && (typeof link === 'number' || typeof link === 'string')) {
                                                // link 可能是 link_id，尝试在 graph.links 中查找
                                                const linkId = String(link);
                                                const linkInfo = graph.links[linkId];
                                                if (linkInfo && typeof linkInfo === 'object') {
                                                    // 找到了连接信息
                                                    sourceNodeId = linkInfo.origin_id || linkInfo.origin || linkInfo[0];
                                                    sourceOutputIndex = linkInfo.origin_slot || linkInfo.originSlot || linkInfo[1] || 0;
                                                    console.log(`AnyDoor: ✓ 通过link_id ${linkId}在graph.links中找到连接`, {
                                                        linkId: linkId,
                                                        linkInfo: linkInfo,
                                                        sourceNodeId: sourceNodeId,
                                                        sourceOutputIndex: sourceOutputIndex
                                                    });
                                                }
                                            }
                                            
                                            // 如果还没找到，尝试直接解析 link
                                            if (!sourceNodeId) {
                                                if (Array.isArray(link)) {
                                                    // link是数组格式 [nodeId, outputIndex]
                                                    sourceNodeId = link[0];
                                                    sourceOutputIndex = link[1] || 0;
                                                } else if (link && typeof link === 'object') {
                                                    // link可能是对象格式，尝试常见属性名
                                                    sourceNodeId = link.id || link.node_id || link.nodeId || link[0];
                                                    sourceOutputIndex = link.output || link.outputIndex || link.slot || link[1] || 0;
                                                } else if (typeof link === 'number' || typeof link === 'string') {
                                                    // link可能是直接的节点ID（如果graph.links查找失败）
                                                    sourceNodeId = link;
                                                    sourceOutputIndex = 0;
                                                }
                                            }
                                            
                                            console.log(`AnyDoor: 解析后的连接信息:`, {
                                                sourceNodeId: sourceNodeId,
                                                sourceOutputIndex: sourceOutputIndex,
                                                sourceNodeIdType: typeof sourceNodeId
                                            });
                                            
                                            if (sourceNodeId !== null && sourceNodeId !== undefined) {
                                                // 尝试多种方式查找源节点
                                                let sourceNode = null;
                                                
                                                // 方法1: 通过 _nodes_by_id
                                                if (graph._nodes_by_id) {
                                                    sourceNode = graph._nodes_by_id[sourceNodeId] || 
                                                                 graph._nodes_by_id[String(sourceNodeId)] ||
                                                                 graph._nodes_by_id[`#${sourceNodeId}`];
                                                }
                                                
                                                // 方法2: 遍历所有节点
                                                if (!sourceNode && graph._nodes) {
                                                    for (const n of graph._nodes) {
                                                        if (n.id === sourceNodeId || 
                                                            String(n.id) === String(sourceNodeId) ||
                                                            n.id === `#${sourceNodeId}` ||
                                                            String(n.id) === `#${sourceNodeId}`) {
                                                            sourceNode = n;
                                                            break;
                                                        }
                                                    }
                                                }
                                                
                                                // 方法3: 使用 getNodeById (如果存在)
                                                if (!sourceNode && graph.getNodeById) {
                                                    try {
                                                        sourceNode = graph.getNodeById(sourceNodeId) || 
                                                                    graph.getNodeById(String(sourceNodeId));
                                                    } catch(e) {
                                                        console.warn('AnyDoor: getNodeById失败', e);
                                                    }
                                                }
                                                
                                                // 验证找到的节点对象是否有效（必须有 type 或 widgets 属性）
                                                if (sourceNode && !sourceNode.type && !sourceNode.widgets && !sourceNode.comfyClass) {
                                                    console.warn(`AnyDoor: 找到的对象无效（缺少type/widgets属性），继续查找`, {
                                                        sourceNodeId: sourceNodeId,
                                                        找到的对象: sourceNode,
                                                        对象键: Object.keys(sourceNode || {})
                                                    });
                                                    sourceNode = null; // 标记为无效
                                                }
                                                
                                                console.log(`AnyDoor: 源节点查找结果:`, {
                                                    sourceNodeId: sourceNodeId,
                                                    found: sourceNode !== null,
                                                    isValid: sourceNode && (sourceNode.type || sourceNode.widgets || sourceNode.comfyClass),
                                                    sourceNodeType: sourceNode?.type,
                                                    sourceNodeTitle: sourceNode?.title,
                                                    sourceNodeIdActual: sourceNode?.id,
                                                    hasWidgets: !!sourceNode?.widgets
                                                });
                                                
                                                // 如果没找到有效的源节点，尝试通过 graph.links 查找
                                                if (!sourceNode && graph.links) {
                                                    console.log(`AnyDoor: 尝试通过graph.links查找连接，links数量:`, Object.keys(graph.links).length);
                                                    
                                                    // 方法1: links 是对象，以 link_id 为键
                                                    if (typeof graph.links === 'object' && !Array.isArray(graph.links)) {
                                                        for (const linkId in graph.links) {
                                                            const linkInfo = graph.links[linkId];
                                                            if (!linkInfo || typeof linkInfo !== 'object') continue;
                                                            
                                                            // 检查是否指向控制节点
                                                            const targetId = linkInfo.target_id || linkInfo.target || linkInfo.target_node;
                                                            const targetSlot = linkInfo.target_slot || linkInfo.targetSlot || linkInfo.target_index;
                                                            
                                                            // 查找指向控制节点的node_id输入的连接
                                                            if (targetId === controlNode.id || String(targetId) === String(controlNode.id)) {
                                                                // 可能需要检查target_slot是否对应node_id输入
                                                                const originId = linkInfo.origin_id || linkInfo.origin || linkInfo.origin_node || linkInfo[0];
                                                                if (originId) {
                                                                    // 尝试查找源节点
                                                                    if (graph._nodes_by_id) {
                                                                        sourceNode = graph._nodes_by_id[originId] || 
                                                                                     graph._nodes_by_id[String(originId)];
                                                                    }
                                                                    if (!sourceNode && graph._nodes) {
                                                                        sourceNode = graph._nodes.find(n => 
                                                                            n.id === originId || 
                                                                            String(n.id) === String(originId)
                                                                        );
                                                                    }
                                                                    
                                                                    // 验证找到的节点是否有效
                                                                    if (sourceNode && (sourceNode.type || sourceNode.widgets || sourceNode.comfyClass)) {
                                                                        console.log(`AnyDoor: ✓ 通过graph.links找到有效源节点`, {
                                                                            linkId: linkId,
                                                                            originId: originId,
                                                                            sourceNodeType: sourceNode.type,
                                                                            targetId: targetId,
                                                                            targetSlot: targetSlot
                                                                        });
                                                                        break;
                                                                    } else if (sourceNode) {
                                                                        console.warn(`AnyDoor: 通过graph.links找到的节点无效`, {
                                                                            linkId: linkId,
                                                                            originId: originId,
                                                                            foundObject: sourceNode
                                                                        });
                                                                        sourceNode = null;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                    
                                                    // 方法2: links 可能是数组
                                                    if (!sourceNode && Array.isArray(graph.links)) {
                                                        console.log(`AnyDoor: graph.links是数组，长度:`, graph.links.length);
                                                        for (const linkInfo of graph.links) {
                                                            if (!linkInfo || typeof linkInfo !== 'object') continue;
                                                            const targetId = linkInfo.target_id || linkInfo.target || linkInfo[1];
                                                            if (targetId === controlNode.id || String(targetId) === String(controlNode.id)) {
                                                                const originId = linkInfo.origin_id || linkInfo.origin || linkInfo[0];
                                                                if (originId) {
                                                                    sourceNode = graph._nodes_by_id?.[originId] || 
                                                                                 graph._nodes?.find(n => n.id === originId || String(n.id) === String(originId));
                                                                    if (sourceNode && (sourceNode.type || sourceNode.widgets || sourceNode.comfyClass)) {
                                                                        console.log(`AnyDoor: ✓ 通过graph.links数组找到源节点`, {
                                                                            originId: originId,
                                                                            sourceNodeType: sourceNode.type
                                                                        });
                                                                        break;
                                                                    } else if (sourceNode) {
                                                                        sourceNode = null;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                    
                                                    // 方法3: 直接查找所有指向控制节点的连接（不依赖sourceNodeId）
                                                    if (!sourceNode && graph.links && typeof graph.links === 'object') {
                                                        console.log(`AnyDoor: 尝试查找所有指向控制节点${controlNode.id}的连接`);
                                                        for (const linkId in graph.links) {
                                                            const linkInfo = graph.links[linkId];
                                                            if (!linkInfo || typeof linkInfo !== 'object') continue;
                                                            
                                                            const targetId = linkInfo.target_id || linkInfo.target;
                                                            if (targetId === controlNode.id || String(targetId) === String(controlNode.id)) {
                                                                const originId = linkInfo.origin_id || linkInfo.origin || linkInfo[0];
                                                                if (originId) {
                                                                    // 直接使用这个originId作为源节点
                                                                    sourceNode = graph._nodes_by_id?.[originId] || 
                                                                                 graph._nodes?.find(n => n.id === originId || String(n.id) === String(originId));
                                                                    if (sourceNode && (sourceNode.type || sourceNode.widgets || sourceNode.comfyClass)) {
                                                                        console.log(`AnyDoor: ✓ 通过所有连接查找找到源节点`, {
                                                                            linkId: linkId,
                                                                            originId: originId,
                                                                            sourceNodeType: sourceNode.type,
                                                                            targetId: targetId
                                                                        });
                                                                        break;
                                                                    } else if (sourceNode) {
                                                                        sourceNode = null;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    }
                                                }
                                                
                                                if (sourceNode) {
                                                    console.log(`AnyDoor: 检测到连接输入，源节点${sourceNodeId}, 输出索引${sourceOutputIndex}`, {
                                                        sourceNodeType: sourceNode.type,
                                                        sourceNodeTitle: sourceNode.title,
                                                        widgetsCount: sourceNode.widgets?.length || 0
                                                    });
                                                    
                                                    // 方法0: 先尝试通过ComfyUI的标准方法直接获取连接值（优先级最高）
                                                    if (!linkedValue && typeof controlNode.getInputValue === 'function') {
                                                        try {
                                                            const inputValue = controlNode.getInputValue('node_id');
                                                            if (inputValue !== undefined && inputValue !== null && inputValue !== '') {
                                                                linkedValue = String(inputValue);
                                                                console.log(`AnyDoor: ✓ 通过getInputValue成功获取连接值:`, linkedValue, {
                                                                    valueLength: linkedValue.length,
                                                                    valueType: typeof inputValue
                                                                });
                                                            }
                                                        } catch(e) {
                                                            console.warn('AnyDoor: getInputValue异常', e);
                                                        }
                                                    }
                                                    
                                                    // 如果getInputValue没获取到值，继续尝试其他方法
                                                    // 方法1.1: 从源节点的widget值获取（适用于字符串输出）
                                                    if (sourceNode.widgets) {
                                                        // 首先列出所有widget信息用于调试
                                                        console.log(`AnyDoor: 源节点所有widget信息:`, sourceNode.widgets.map(w => ({
                                                            name: w.name,
                                                            type: w.type,
                                                            hasValue: w.value !== undefined,
                                                            valueLength: typeof w.value === 'string' ? w.value.length : 'N/A',
                                                            valuePreview: typeof w.value === 'string' ? w.value.substring(0, 50) : w.value
                                                        })));
                                                        
                                                        // 收集所有可能的文本值，然后取最长的
                                                        const candidateValues = [];
                                                        
                                                        for (const widget of sourceNode.widgets) {
                                                            // 查找字符串类型的widget（多行文本节点通常有text字段）
                                                            const isTextWidget = widget.type === 'STRING' || 
                                                                                widget.type === 'text' || 
                                                                                widget.name === 'text' || 
                                                                                widget.name === 'STRING' ||
                                                                                widget.name === 'string' ||
                                                                                widget.type === 'multiline';
                                                            
                                                            let widgetValue = null;
                                                            
                                                            // 尝试从widget.value获取
                                                            if (isTextWidget && widget.value !== undefined && widget.value !== null) {
                                                                widgetValue = String(widget.value);
                                                                console.log(`AnyDoor: 从widget.value发现值:`, widgetValue, {
                                                                    widgetName: widget.name,
                                                                    widgetType: widget.type,
                                                                    valueLength: widgetValue.length
                                                                });
                                                            }
                                                            
                                                            // 尝试从widget的textarea元素获取（多行文本节点，优先检查）
                                                            if (isTextWidget && widget.textarea) {
                                                                const textareaValue = widget.textarea.value;
                                                                if (textareaValue && textareaValue.trim()) {
                                                                    if (!widgetValue || textareaValue.length > widgetValue.length) {
                                                                        widgetValue = String(textareaValue);
                                                                        console.log(`AnyDoor: 从textarea发现值:`, widgetValue, {
                                                                            widgetName: widget.name,
                                                                            valueLength: widgetValue.length
                                                                        });
                                                                    }
                                                                }
                                                            }
                                                            
                                                            // 尝试从DOM元素直接读取（对于多行文本，textarea.value可能更完整）
                                                            // 检查多个可能的DOM元素位置
                                                            const possibleInputEls = [
                                                                widget.inputEl,
                                                                widget.options?.inputEl,
                                                                widget.textarea,
                                                                widget.computeNode?.querySelector?.('textarea'),
                                                                widget.computeNode?.querySelector?.('input')
                                                            ].filter(el => el);
                                                            
                                                            for (const inputEl of possibleInputEls) {
                                                                if (inputEl) {
                                                                    const domValue = inputEl.value || inputEl.textContent || inputEl.innerText;
                                                                    if (domValue && domValue.trim()) {
                                                                        if (!widgetValue || domValue.length > widgetValue.length) {
                                                                            widgetValue = String(domValue);
                                                                            console.log(`AnyDoor: 从DOM元素发现值:`, widgetValue, {
                                                                                widgetName: widget.name,
                                                                                elementType: inputEl.tagName,
                                                                                valueLength: widgetValue.length
                                                                            });
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                            
                                                            // 如果找到值，添加到候选列表
                                                            if (widgetValue && widgetValue.trim()) {
                                                                candidateValues.push({
                                                                    value: widgetValue,
                                                                    length: widgetValue.length,
                                                                    widgetName: widget.name,
                                                                    widgetType: widget.type
                                                                });
                                                            }
                                                        }
                                                        
                                                        // 从候选值中选择最长的（通常是最完整的）
                                                        if (candidateValues.length > 0) {
                                                            candidateValues.sort((a, b) => b.length - a.length); // 按长度降序排序
                                                            linkedValue = candidateValues[0].value;
                                                            console.log(`AnyDoor: 从源节点widget获取值（选择最长的）:`, linkedValue, {
                                                                valueLength: linkedValue.length,
                                                                widgetName: candidateValues[0].widgetName,
                                                                totalCandidates: candidateValues.length,
                                                                allCandidates: candidateValues.map(c => ({value: c.value.substring(0, 30), length: c.length}))
                                                            });
                                                        }
                                                        
                                                        // 如果还没找到，尝试查找所有有value的widget（取最长的字符串值）
                                                        if (!linkedValue) {
                                                            let longestValue = null;
                                                            let longestLength = 0;
                                                            for (const widget of sourceNode.widgets) {
                                                                const val = widget.value;
                                                                if (val && typeof val === 'string' && val.trim()) {
                                                                    if (val.length > longestLength) {
                                                                        longestValue = val;
                                                                        longestLength = val.length;
                                                                    }
                                                                }
                                                            }
                                                            if (longestValue) {
                                                                linkedValue = longestValue;
                                                                console.log(`AnyDoor: 从源节点任意widget获取最长值:`, linkedValue, {
                                                                    valueLength: linkedValue.length
                                                                });
                                                            }
                                                        }
                                                    }
                                                    
                                                    // 方法1.2: 从序列化数据获取（取最长的字符串值）
                                                    if (!linkedValue) {
                                                        try {
                                                            const serialized = sourceNode.serialize ? sourceNode.serialize() : null;
                                                            if (serialized) {
                                                                console.log(`AnyDoor: 尝试从序列化数据获取，widgets_values数量:`, serialized.widgets_values?.length || 0);
                                                                
                                                                // 尝试从widgets_values获取（取最长的字符串值）
                                                                if (serialized.widgets_values && serialized.widgets_values.length > 0) {
                                                                    let longestSerializedValue = null;
                                                                    let longestSerializedLength = 0;
                                                                    
                                                                    // 查找所有字符串类型的值，取最长的
                                                                    for (let i = 0; i < serialized.widgets_values.length; i++) {
                                                                        const val = serialized.widgets_values[i];
                                                                        if (typeof val === 'string' && val.trim()) {
                                                                            if (val.length > longestSerializedLength) {
                                                                                longestSerializedValue = val;
                                                                                longestSerializedLength = val.length;
                                                                            }
                                                                        }
                                                                    }
                                                                    
                                                                    if (longestSerializedValue) {
                                                                        linkedValue = longestSerializedValue;
                                                                        console.log(`AnyDoor: 从序列化数据获取最长值:`, linkedValue, {
                                                                            valueLength: linkedValue.length
                                                                        });
                                                                    }
                                                                }
                                                            }
                                                        } catch(e) {
                                                            console.warn('AnyDoor: 序列化失败', e);
                                                        }
                                                    }
                                                    
                                                    // 方法1.3: 尝试从节点的输出获取（某些节点可能缓存输出值）
                                                    if (!linkedValue && sourceNode.outputs && sourceOutputIndex < sourceNode.outputs.length) {
                                                        const output = sourceNode.outputs[sourceOutputIndex];
                                                        if (output && typeof output === 'string') {
                                                            linkedValue = output;
                                                            console.log(`AnyDoor: 从输出获取值:`, linkedValue);
                                                        }
                                                    }
                                                    
                                                    // 方法1.4: 尝试使用ComfyUI的标准方法获取输入值
                                                    if (!linkedValue && typeof controlNode.getInputValue === 'function') {
                                                        try {
                                                            linkedValue = controlNode.getInputValue('node_id');
                                                            if (linkedValue) {
                                                                console.log(`AnyDoor: 使用getInputValue获取:`, linkedValue);
                                                            }
                                                        } catch(e) {
                                                            console.warn('AnyDoor: getInputValue失败', e);
                                                        }
                                                    }
                                                    
                                                    if (linkedValue) {
                                                        nodeIdValue = String(linkedValue);
                                                        console.log(`AnyDoor: ✓ 最终从连接输入获取到的完整值:`, {
                                                            value: nodeIdValue,
                                                            length: nodeIdValue.length,
                                                            charCount: nodeIdValue.split(/\s+/).length,
                                                            preview: nodeIdValue.substring(0, 100) + (nodeIdValue.length > 100 ? '...' : '')
                                                        });
                                                    } else {
                                                        console.warn(`AnyDoor: ✗ 无法从连接输入获取值，源节点${sourceNodeId}`, {
                                                            源节点已找到: true,
                                                            源节点类型: sourceNode.type,
                                                            源节点标题: sourceNode.title,
                                                            widgets数量: sourceNode.widgets?.length || 0,
                                                            建议: '检查源节点的widget是否有值，或尝试在源节点中输入内容'
                                                        });
                                                    }
                                                } else {
                                                    // 源节点未找到 - 输出详细的调试信息
                                                    console.error(`AnyDoor: ✗ 无法找到有效的源节点，源节点ID: ${sourceNodeId}`, {
                                                        源节点ID: sourceNodeId,
                                                        源节点ID类型: typeof sourceNodeId,
                                                        所有节点ID: graph._nodes?.map(n => ({id: n.id, type: n.type})).slice(0, 10) || [],
                                                        节点数量: graph._nodes?.length || 0,
                                                        _nodes_by_id键: graph._nodes_by_id ? Object.keys(graph._nodes_by_id).map(k => ({
                                                            key: k,
                                                            nodeType: graph._nodes_by_id[k]?.type || '未知'
                                                        })).slice(0, 10) : [],
                                                        graphLinks类型: typeof graph.links,
                                                        graphLinks是数组: Array.isArray(graph.links),
                                                        graphLinks键数量: graph.links && typeof graph.links === 'object' ? Object.keys(graph.links).length : 0,
                                                        graphLinks前3个: graph.links && typeof graph.links === 'object' ? 
                                                            Object.keys(graph.links).slice(0, 3).map(k => ({
                                                                linkId: k,
                                                                linkInfo: graph.links[k]
                                                            })) : [],
                                                        控制节点ID: controlNode.id,
                                                        控制节点输入: controlNode.inputs?.map((inp, idx) => ({
                                                            index: idx,
                                                            name: inp.name,
                                                            link: inp.link,
                                                            linkType: typeof inp.link
                                                        })) || [],
                                                        建议: '检查连接是否正确，或刷新页面重试'
                                                    });
                                                }
                                            } else {
                                                console.error(`AnyDoor: ✗ 源节点ID无效:`, sourceNodeId);
                                            }
                                            break; // 找到连接的输入后退出循环
                                        }
                                    }
                                }
                                
                                // 方法2: 只有在没有连接输入时，才从widget本身获取值
                                // 如果有连接输入但没有获取到值，nodeIdValue应该保持为null（不使用widget值）
                                if (!hasConnection && !nodeIdValue) {
                                    if (nodeIdWidget.value !== undefined) {
                                        nodeIdValue = nodeIdWidget.value;
                                        console.log(`AnyDoor: 从控制节点自身widget获取值（无连接输入）:`, nodeIdValue);
                                    } else if (nodeIdWidget.options && nodeIdWidget.options.value !== undefined) {
                                        nodeIdValue = nodeIdWidget.options.value;
                                        console.log(`AnyDoor: 从控制节点自身widget.options获取值（无连接输入）:`, nodeIdValue);
                                    } else if (nodeIdWidget.inputEl && nodeIdWidget.inputEl.value) {
                                        nodeIdValue = nodeIdWidget.inputEl.value;
                                        console.log(`AnyDoor: 从控制节点自身widget.inputEl获取值（无连接输入）:`, nodeIdValue);
                                    } else if (typeof nodeIdWidget.computeValue === 'function') {
                                        nodeIdValue = nodeIdWidget.computeValue();
                                        console.log(`AnyDoor: 从控制节点自身widget.computeValue获取值（无连接输入）:`, nodeIdValue);
                                    }
                                } else if (hasConnection && !nodeIdValue) {
                                    console.warn(`AnyDoor: ⚠️ 检测到连接输入但未能获取到值，将跳过控制（不使用widget值）`);
                                } else if (hasConnection && nodeIdValue) {
                                    console.log(`AnyDoor: ✓ 已使用连接输入的值（忽略控制节点widget值）:`, nodeIdValue);
                                }
                                
                                // 解析多个节点ID（支持多种格式：逗号、空格、换行、分号、点号等分隔）
                                const nodeIdStr = String(nodeIdValue || '').trim();
                                console.log(`AnyDoor: 解析节点ID字符串 "${nodeIdStr}"`, {nodeIdValue, type: typeof nodeIdValue});
                                
                                // 方法1: 使用正则表达式提取所有数字（最可靠的方法，支持任意分隔符）
                                // 这样无论用户输入 "19.13", "19 13", "19,13" 都能正确解析
                                const allNumbers = nodeIdStr.match(/\d+/g) || [];
                                console.log(`AnyDoor: 从字符串提取到的所有数字:`, allNumbers);
                                
                                // 转换为数字并过滤无效值
                                const nodeIdNumbers = allNumbers
                                    .map(id => parseInt(id))
                                    .filter(id => !isNaN(id) && id > 0);
                                
                                // 方法2: 如果方法1没找到数字，尝试按分隔符分割（备用方法）
                                if (nodeIdNumbers.length === 0) {
                                    // 支持多种分隔符：逗号、空格、换行、分号、点号
                                    const nodeIds = nodeIdStr.split(/[,，\s\n;；.。]+/)
                                        .map(s => s.trim())
                                        .filter(s => s && s.length > 0);
                                    
                                    console.log(`AnyDoor: 分割后的节点ID数组:`, nodeIds);
                                    
                                    const parsed = nodeIds.map(id => {
                                        const num = parseInt(id);
                                        if (isNaN(num)) {
                                            console.warn(`AnyDoor: 无法解析节点ID "${id}"`);
                                            return null;
                                        }
                                        return num;
                                    }).filter(id => id !== null && id > 0);
                                    
                                    nodeIdNumbers.push(...parsed);
                                }
                                
                                console.log(`AnyDoor: 解析后的节点ID数字:`, nodeIdNumbers);
                                
                                // 获取模式值
                                let modeValueStr = null;
                                if (modeWidget.value !== undefined) {
                                    modeValueStr = modeWidget.value;
                                } else if (modeWidget.options && modeWidget.options.value !== undefined) {
                                    modeValueStr = modeWidget.options.value;
                                } else if (modeWidget.inputEl && modeWidget.inputEl.value) {
                                    modeValueStr = modeWidget.inputEl.value;
                                } else if (typeof modeWidget.computeValue === 'function') {
                                    modeValueStr = modeWidget.computeValue();
                                }
                                
                                modeValueStr = modeValueStr || "正常执行";
                                
                                const modeMap = {
                                    "正常执行": 0,
                                    "禁用": 1,
                                    "忽略": 2,
                                    "Bypass": 2  // 兼容旧名称
                                };
                                const mode = modeMap[modeValueStr] || 0;
                                const modeValue = mode; // 转换为数字，确保类型一致
                                
                                // 获取当前节点ID列表（排序以便比较）
                                const currentNodeIds = [...nodeIdNumbers].sort((a, b) => a - b);
                                const currentNodeIdsKey = currentNodeIds.join(',');
                                
                                // 获取之前控制的节点ID列表
                                const historyKey = `node_${controlNode.id}`;
                                const previousNodeIds = controlHistory.get(historyKey) || [];
                                
                                console.log(`AnyDoor: 节点ID列表比较`, {
                                    controlNodeId: controlNode.id,
                                    previousNodeIds: previousNodeIds,
                                    currentNodeIds: currentNodeIds,
                                    previousKey: previousNodeIds.join(','),
                                    currentKey: currentNodeIdsKey
                                });
                                
                                // 找出不再被控制的节点（需要恢复为正常执行）
                                const nodesToRestore = previousNodeIds.filter(id => !currentNodeIds.includes(id));
                                
                                if (nodesToRestore.length > 0) {
                                    console.log(`AnyDoor: 检测到需要恢复的节点:`, nodesToRestore, {
                                        原因: `这些节点不在当前列表 ${currentNodeIdsKey} 中，将从之前的状态恢复为正常执行`
                                    });
                                }
                                
                                // 恢复之前控制的节点为正常执行状态
                                nodesToRestore.forEach(nodeId => {
                                    console.log(`AnyDoor: 🔄 开始恢复节点 ${nodeId} 为正常执行状态（从之前的状态恢复）`);
                                    const restoreResult = setNodeBypass(nodeId, 0); // 0 = 正常执行
                                    if (restoreResult.success) {
                                        // 清除该节点的控制状态
                                        const oldStateKeys = [`${controlNode.id}_${nodeId}_0`, 
                                                           `${controlNode.id}_${nodeId}_1`, 
                                                           `${controlNode.id}_${nodeId}_2`];
                                        oldStateKeys.forEach(key => controlState.delete(key));
                                        console.log(`AnyDoor: ✓ 节点 ${nodeId} 已恢复为正常执行`);
                                    } else {
                                        console.warn(`AnyDoor: ✗ 恢复节点 ${nodeId} 失败:`, restoreResult.message);
                                    }
                                });
                                
                                // 更新控制历史记录（无论是否有节点需要恢复都要更新）
                                controlHistory.set(historyKey, currentNodeIds);
                                console.log(`AnyDoor: 已更新控制历史记录`, {
                                    historyKey: historyKey,
                                    newHistory: currentNodeIds
                                });
                                
                                // 处理多个节点ID，设置新的模式
                                if (nodeIdNumbers.length > 0) {
                                    console.log(`AnyDoor: 准备设置 ${nodeIdNumbers.length} 个节点为模式 ${mode}`);
                                    nodeIdNumbers.forEach((nodeId, index) => {
                                        console.log(`AnyDoor: 处理节点 ${index + 1}/${nodeIdNumbers.length}: 节点${nodeId}`);
                                        
                                        // 生成状态键，避免重复设置
                                        const stateKey = `${controlNode.id}_${nodeId}_${mode}`;
                                        
                                        // 检查节点的实际状态
                                        let actualMode = null;
                                        try {
                                            const graph = app.graph;
                                            if (graph) {
                                                const nodeIdNum = parseInt(nodeId);
                                                let targetNode = graph._nodes_by_id?.[nodeIdNum] || 
                                                               graph._nodes?.find(n => {
                                                                   const nId = parseInt(n.id);
                                                                   return nId === nodeIdNum || String(n.id) === String(nodeId);
                                                               });
                                                if (targetNode && targetNode.mode !== undefined) {
                                                    actualMode = targetNode.mode;
                                                }
                                            }
                                        } catch(e) {
                                            console.warn(`AnyDoor: 检查节点${nodeId}实际状态失败`, e);
                                        }
                                        
                                        // 决定是否需要更新：如果状态不一致、状态未知、缓存未记录，或者为了确保视觉同步
                                        const stateMatches = actualMode === modeValue;
                                        const hasCache = controlState.get(stateKey) === true;
                                        // 如果状态匹配且有缓存，通常不需要更新，但bypass模式(2)需要确保视觉样式，所以总是更新
                                        // 这样可以确保黄色遮罩和透明度正确显示，即使节点的mode属性已经是2
                                        const needsUpdate = actualMode === null || !stateMatches || !hasCache || modeValue === 2;
                                        
                                        if (needsUpdate) {
                                            if (actualMode !== null) {
                                                if (actualMode !== modeValue) {
                                                    console.log(`AnyDoor: 节点${nodeId}实际状态(${actualMode})与目标状态(${modeValue})不一致，需要更新`);
                                                } else if (modeValue === 2) {
                                                    console.log(`AnyDoor: 节点${nodeId}状态已匹配(${actualMode})，但强制更新以确保bypass视觉样式`);
                                                } else {
                                                    console.log(`AnyDoor: 节点${nodeId}状态已匹配(${actualMode})，但需要同步视觉`);
                                                }
                                            }
                                            console.log(`AnyDoor: 应用控制 - 节点${nodeId}, 模式${mode} (${modeValueStr})`);
                                            const result = setNodeBypass(nodeId, mode);
                                            console.log(`AnyDoor: 节点${nodeId} 设置结果:`, result);
                                            if (result.success) {
                                                controlState.set(stateKey, true);
                                                // 清除其他模式的状态键
                                                [0, 1, 2].filter(m => m !== mode).forEach(otherMode => {
                                                    controlState.delete(`${controlNode.id}_${nodeId}_${otherMode}`);
                                                });
                                                console.log(`AnyDoor: ✓ 节点${nodeId} 设置成功`);
                                            } else {
                                                console.warn(`AnyDoor: ✗ 设置节点 ${nodeId} 失败:`, result.message);
                                                controlState.delete(stateKey);
                                            }
                                        } else {
                                            console.log(`AnyDoor: 节点${nodeId} 已是最新状态(实际状态: ${actualMode}, 目标状态: ${modeValue})，跳过`);
                                        }
                                    });
                                    console.log(`AnyDoor: 完成处理 ${nodeIdNumbers.length} 个节点`);
                                } else if (previousNodeIds.length > 0) {
                                    // 如果当前没有节点ID，但之前有，恢复所有之前的节点
                                    console.warn(`AnyDoor: 未找到有效的节点ID数字，原始字符串: "${nodeIdStr}"`);
                                    previousNodeIds.forEach(nodeId => {
                                        console.log(`AnyDoor: 恢复节点 ${nodeId} 为正常执行状态（节点ID已清空）`);
                                        setNodeBypass(nodeId, 0);
                                        const oldStateKeys = [`${controlNode.id}_${nodeId}_0`, 
                                                           `${controlNode.id}_${nodeId}_1`, 
                                                           `${controlNode.id}_${nodeId}_2`];
                                        oldStateKeys.forEach(key => controlState.delete(key));
                                    });
                                    controlHistory.delete(historyKey);
                                }
                            }
                        }
                    });
                } catch (e) {
                    console.error("AnyDoor: 应用控制失败", e);
                }
            };
            
            // 监听节点创建
            const originalAddNode = app.graph?.addNode;
            if (app.graph && originalAddNode) {
                app.graph.addNode = function(...args) {
                    const result = originalAddNode.apply(this, args);
                    setTimeout(applyAllControls, 100);
                    return result;
                };
            }
            
            // 监听节点创建和widget变化
            const originalNodeCreated = app.registerExtension;
            app.registerExtension({
                name: "AnyDoor.WidgetWatcher",
                async nodeCreated(node) {
                    // 监听控制节点的widget变化
                    if (node.type === "NodeBypassController" || node.comfyClass === "NodeBypassController" ||
                        node.type === "TextMatchNodeController" || node.comfyClass === "TextMatchNodeController") {
                        console.log("AnyDoor: 检测到控制节点创建", node.id, node.type || node.comfyClass);
                        
                        // 等待widget创建完成
                        setTimeout(() => {
                            if (node.widgets) {
                                node.widgets.forEach(widget => {
                                    const widgetName = widget.name || (widget.options && widget.options.name);
                                    
                                    // 对于TextMatchNodeController，需要监听index_text和所有text/node_id对
                                    const isTextMatchNode = node.type === "TextMatchNodeController" || node.comfyClass === "TextMatchNodeController";
                                    const isMatchWidget = isTextMatchNode && (widgetName === "index_text" || 
                                        widgetName.startsWith("text") || widgetName.startsWith("node_id"));
                                    
                                    if (widgetName === "node_id" || widgetName === "set_bypass" || isMatchWidget) {
                                        // 重写widget的callback
                                        const originalCallback = widget.callback;
                                        widget.callback = function(...args) {
                                            if (originalCallback) {
                                                originalCallback.apply(this, args);
                                            }
                                            // 立即应用控制（让applyAllControls处理恢复逻辑）
                                            setTimeout(() => {
                                                console.log("AnyDoor: 检测到控制节点widget变化，触发重新检查");
                                                applyAllControls();
                                            }, 10);
                                        };
                                        
                                        // 监听DOM事件（对于输入框和下拉框）
                                        if (widget.inputEl) {
                                            const handler = () => {
                                                setTimeout(() => {
                                                    console.log("AnyDoor: 检测到控制节点输入变化，触发重新检查");
                                                    applyAllControls();
                                                }, 10);
                                            };
                                            
                                            widget.inputEl.addEventListener("change", handler, true);
                                            widget.inputEl.addEventListener("input", handler, true);
                                            widget.inputEl.addEventListener("blur", handler, true);
                                        }
                                        
                                        // 如果是选择框，也监听点击
                                        if (widget.options && widget.options.values) {
                                            const originalValueChanged = widget.onValueChanged;
                                            if (widget.onValueChanged) {
                                                widget.onValueChanged = function(...args) {
                                                    if (originalValueChanged) {
                                                        originalValueChanged.apply(this, args);
                                                    }
                                                    setTimeout(() => {
                                                        console.log("AnyDoor: 检测到控制节点值变化，触发重新检查");
                                                        applyAllControls();
                                                    }, 10);
                                                };
                                            }
                                        }
                                    }
                                });
                                
                                // 立即应用一次
                                setTimeout(() => applyAllControls(), 100);
                            }
                        }, 200);
                    }
                    
                    // 监听所有节点的字符串类型widget变化（可能是连接源节点）
                    // 等待widget创建完成
                    setTimeout(() => {
                        if (node.widgets && node.widgets.length > 0) {
                            node.widgets.forEach(widget => {
                                // 检查是否是字符串类型的widget（可能是多行文本节点等）
                                const isTextWidget = widget.type === 'STRING' || 
                                                    widget.type === 'text' || 
                                                    widget.type === 'multiline' ||
                                                    widget.name === 'text' ||
                                                    widget.name === 'STRING' ||
                                                    widget.name === 'string';
                                
                                if (isTextWidget) {
                                    // 监听textarea或input的值变化
                                    const setupTextWidgetListener = () => {
                                        // 检查多个可能的DOM元素位置
                                        const possibleInputEls = [
                                            widget.inputEl,
                                            widget.options?.inputEl,
                                            widget.textarea,
                                            widget.computeNode?.querySelector?.('textarea'),
                                            widget.computeNode?.querySelector?.('input')
                                        ].filter(el => el);
                                        
                                        const handler = () => {
                                            // 获取当前值用于比较
                                            let currentValue = null;
                                            for (const inputEl of possibleInputEls) {
                                                if (inputEl) {
                                                    const val = inputEl.value || inputEl.textContent || inputEl.innerText;
                                                    if (val && val.trim()) {
                                                        currentValue = String(val);
                                                        break;
                                                    }
                                                }
                                            }
                                            
                                            console.log(`AnyDoor: 检测到源节点${node.id}的widget值可能发生变化`, {
                                                nodeType: node.type,
                                                nodeTitle: node.title,
                                                widgetName: widget.name,
                                                widgetType: widget.type,
                                                currentValue: currentValue ? currentValue.substring(0, 50) : 'null',
                                                valueLength: currentValue ? currentValue.length : 0
                                            });
                                            
                                            // 检查是否有控制节点连接到这个节点
                                            setTimeout(() => {
                                                const graph = app.graph;
                                                if (graph && graph._nodes) {
                                                    let needsUpdate = false;
                                                    const connectedControlNodes = [];
                                                    
                                                    // 检查所有控制节点，看是否有连接到这个源节点的
                                                    graph._nodes.forEach(controlNode => {
                                                        const isControlNode = controlNode.type === "NodeBypassController" || 
                                                                              controlNode.comfyClass === "NodeBypassController";
                                                        
                                                        if (isControlNode && controlNode.inputs) {
                                                            // 检查控制节点的node_id输入是否连接到这个节点
                                                            for (let i = 0; i < controlNode.inputs.length; i++) {
                                                                const input = controlNode.inputs[i];
                                                                if (input.link) {
                                                                    const link = input.link;
                                                                    const sourceNodeId = link[0];
                                                                    if (sourceNodeId === node.id) {
                                                                        connectedControlNodes.push(controlNode.id);
                                                                        console.log(`AnyDoor: 🔗 检测到源节点${node.id}的值变化，触发控制节点${controlNode.id}的重新检查`, {
                                                                            源节点: {id: node.id, type: node.type, title: node.title},
                                                                            控制节点: {id: controlNode.id, type: controlNode.type},
                                                                            检测到的值: currentValue
                                                                        });
                                                                        needsUpdate = true;
                                                                        break;
                                                                    }
                                                                }
                                                            }
                                                        }
                                                    });
                                                    
                                                    if (needsUpdate) {
                                                        console.log(`AnyDoor: ✅ 将触发重新检查，影响的控制节点:`, connectedControlNodes);
                                                        applyAllControls();
                                                    } else {
                                                        console.log(`AnyDoor: ℹ️ 源节点${node.id}的值变化，但未找到连接的控制节点`);
                                                    }
                                                }
                                            }, 50);
                                        };
                                        
                                        // 为所有找到的DOM元素添加监听器
                                        possibleInputEls.forEach(inputEl => {
                                            if (inputEl) {
                                                inputEl.addEventListener("input", handler, true);
                                                inputEl.addEventListener("change", handler, true);
                                                inputEl.addEventListener("blur", handler, true);
                                                
                                                // 使用MutationObserver监听内容变化（对于某些动态更新的情况）
                                                try {
                                                    const observer = new MutationObserver(handler);
                                                    observer.observe(inputEl, {
                                                        childList: true,
                                                        subtree: true,
                                                        characterData: true
                                                    });
                                                    // 存储observer以便后续清理（如果需要）
                                                    if (!node._anydoorObservers) {
                                                        node._anydoorObservers = [];
                                                    }
                                                    node._anydoorObservers.push(observer);
                                                } catch(e) {
                                                    // MutationObserver可能不支持，忽略
                                                }
                                            }
                                        });
                                    };
                                    
                                    // 立即设置监听器
                                    setupTextWidgetListener();
                                    
                                    // 如果widget的DOM元素稍后才创建，稍后重试
                                    setTimeout(setupTextWidgetListener, 200);
                                    setTimeout(setupTextWidgetListener, 500);
                                }
                            });
                        }
                    }, 300);
                }
            });
            
            // 定期检查（作为备用）- 更频繁的检查
            setInterval(applyAllControls, 500);
            
            // 立即执行一次
            setTimeout(applyAllControls, 500);
            
            // 也监听graph的变化
            if (app.graph) {
                const originalSerialize = app.graph.serialize;
                if (originalSerialize) {
                    app.graph.serialize = function(...args) {
                        const result = originalSerialize.apply(this, args);
                        // 序列化时也应用控制（确保状态正确）
                        setTimeout(() => applyAllControls(), 50);
                        return result;
                    };
                }
            }
        };
        
        setupControlWatcher();
        
        // 监听节点执行，检查是否有控制请求
        const originalQueuePrompt = app.queuePrompt;
        app.queuePrompt = function(prompt, outputs) {
            // 在执行前再次检查并应用所有控制节点的设置
            try {
                const graph = app.graph;
                if (graph && graph._nodes_by_id) {
                    Object.values(graph._nodes_by_id).forEach(node => {
                        if (node.comfyClass === "NodeBypassController" || node.comfyClass === "TextMatchNodeController") {
                            const nodeIdWidget = node.widgets?.find(w => w.name === "node_id");
                            const modeWidget = node.widgets?.find(w => w.name === "set_bypass");
                            
                            if (nodeIdWidget && modeWidget) {
                                // 获取节点ID值 - 优先从连接输入获取
                                let nodeIdValue = null;
                                
                                // 检查输入是否被连接
                                if (node.inputs) {
                                    for (const input of node.inputs) {
                                        if ((input.name === 'node_id' || input.widget === nodeIdWidget) &&
                                            input.link !== null && input.link !== undefined) {
                                            const link = input.link;
                                            const sourceNodeId = link[0];
                                            if (sourceNodeId !== null) {
                                                const sourceNode = graph._nodes_by_id?.[sourceNodeId] || 
                                                                 graph._nodes?.find(n => n.id === sourceNodeId);
                                                if (sourceNode) {
                                                    // 从源节点获取值
                                                    if (sourceNode.widgets) {
                                                        for (const widget of sourceNode.widgets) {
                                                            if ((widget.type === 'STRING' || widget.type === 'text' || 
                                                                 widget.name === 'text') && widget.value) {
                                                                nodeIdValue = widget.value;
                                                                break;
                                                            }
                                                        }
                                                    }
                                                }
                                                break;
                                            }
                                        }
                                    }
                                }
                                
                                // 如果连接方式获取失败，从widget获取
                                if (!nodeIdValue) {
                                    nodeIdValue = nodeIdWidget.value || '';
                                }
                                
                                // 解析多个节点ID
                                const nodeIdStr = String(nodeIdValue).trim();
                                const nodeIds = nodeIdStr.split(/[,，\s\n;；]+/).map(s => {
                                    const num = parseInt(s.trim());
                                    return isNaN(num) ? null : num;
                                }).filter(id => id !== null && id > 0);
                                
                                const modeMap = {
                                    "正常执行": 0,
                                    "禁用": 1,
                                    "忽略": 2,
                                    "Bypass": 2  // 兼容旧名称
                                };
                                const mode = modeMap[modeWidget.value] || 0;
                                
                                // 处理多个节点
                                nodeIds.forEach(nodeId => {
                                    setNodeBypass(nodeId, mode);
                                });
                            }
                        }
                    });
                }
            } catch (e) {
                console.error("AnyDoor: 执行前控制检查失败", e);
            }
            
            return originalQueuePrompt.call(this, prompt, outputs);
        };
        
        // 将方法添加到全局，供后端节点使用（保留已有的controlState）
        window.AnyDoor = window.AnyDoor || {};
        window.AnyDoor.setNodeBypass = setNodeBypass;
        window.AnyDoor.getNodeBypass = getNodeBypass;
        window.AnyDoor.pendingControls = window.AnyDoor.pendingControls || [];
        
        // 监听来自节点的控制请求
        // 通过自定义事件或全局变量传递控制信息
        if (typeof window.addEventListener !== 'undefined') {
            window.addEventListener('anydoor-control-node', (event) => {
                const { nodeId, mode } = event.detail;
                const result = setNodeBypass(nodeId, mode);
                if (event.detail.callback) {
                    event.detail.callback(result);
                }
            });
        }
        
            console.log("=== AnyDoor: setup() 函数执行完成 ===");
            console.log("=== AnyDoor 节点 Bypass 控制器已加载 ===");
            console.log("AnyDoor: 全局对象已创建", {
                setNodeBypass: typeof setNodeBypass === 'function',
                getNodeBypass: typeof getNodeBypass === 'function',
                controlState: window.AnyDoor.controlState instanceof Map
            });
            
            // 添加测试函数到全局
            window.AnyDoor.test = function(nodeId, mode) {
                console.log(`AnyDoor: 测试设置节点 ${nodeId} 为模式 ${mode}`);
                return setNodeBypass(nodeId, mode);
            };
            
            // 输出帮助信息
            console.log("=== AnyDoor: 可以使用以下命令测试 ===");
            console.log("  window.AnyDoor.test(25, 2)  - 设置节点25为Bypass");
            console.log("  window.AnyDoor.setNodeBypass(25, 2)  - 设置节点25为Bypass");
            console.log("  window.AnyDoor.getNodeBypass(25)  - 查看节点25的状态");
        }
    });
    
console.log("=== AnyDoor: JavaScript 文件加载完成 ===");

