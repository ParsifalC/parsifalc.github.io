# API 是 AI 能力最真实的镜子

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782464051394-7201c990-b27d-4dd2-828e-ca3298d1f7af.png" width="768" title="" crop="0,0,1,1" id="ue3e2edf8" class="ne-image">

## 前言

> **过去五年，大模型真正发生变化的，不只是参数规模和打榜跑分，更重要的是它在软件系统中的角色发生了根本性转变：它从一个单纯的文本生成函数（Text Generator），逐步演化为一个能够理解上下文、调用外部工具、执行复杂任务的运行时（Runtime）。而 API，正是这一演化过程最真实、最直观的镜子。**

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466145244-3a633f45-1188-4bdb-8d8c-fe61f58c18db.png" width="512" title="" crop="0,0,1,1" id="u8ac4d9dd" class="ne-image">

如果把过去五年的 AI API 摆在一起看，你会发现一个很有意思的现象。

2020 年的 GPT-3 API，结构极其简单，大概只有零星几个参数：

```json
{
  "prompt": "...",
  "temperature": 0.7
}
```

而今天，无论是 OpenAI 的 Responses API、Claude 的 Messages API，还是 Gemini API，一个完整的请求 Payload 里面已经塞满了各种对象：`messages`, `tools`, `reasoning`, `modalities`, `response_format`, `computer`, `search`, `memory`...

API 似乎变得越来越臃肿复杂了。很多开发者可能会抱怨：**API 的设计越来越“重”了。**

但如果换一个软件工程的视角来看，结论恰恰相反：**API 并不是越来越复杂，而是在不断暴露模型新解锁的能力。** 换句话说：**每增加一层 API 抽象，背后都意味着模型学会了一件新的事情。**

与其盯着模型排行榜上那零点几个百分点的指标提升，不如沿着 API 的演进路线，重新理解过去五年 AI 究竟发生了怎样的蜕变。

---

## 第一阶段：Completion API —— AI 只是一个文本生成器

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466195419-cc70b9c8-e2b0-49bf-b145-772a4166f05d.png" width="512" title="" crop="0,0,1,1" id="u540b66c1" class="ne-image">

这一代的模型，本质上只会做一件事：**续写（Next Token Prediction）**。

因此，它的 API 签名极其纯粹：`String -> String`。

此时的模型是没有“世界观”的。它不知道谁在说话，谁是系统，更不懂什么叫“历史上下文”。模型在架构层面没有区分角色的概念，一切逻辑都依赖开发者用纯文本的 Prompt 去硬拼凑。

于是，业界诞生了一门玄学——Prompt Engineering（提示词工程）。

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466233480-73f994c5-20a0-41bb-92e6-63b070b859fa.png" width="512" title="" crop="0,0,1,1" id="u01ef1851" class="ne-image">

事实上，今天我们在用的很多复杂的 System Prompt，本质上都是那个时代“硬编码”留下的遗产。**这一代 API 的设计，完美对应了 Transformer 最原始的能力底色。**

---

## 第二阶段：Chat API —— 模型开始理解“对话与角色”

Completion API 最大的痛点在于：把所有上下文揉成一坨字符串，模型根本分不清“这是系统指令”、“这是用户提问”还是“这是历史回答”。随着对话拉长，Prompt 变得臃肿且极易失控。

直到 Chat API 的出现。很多人误以为 Chat API 只是把 `prompt` 字段改成了 `messages` 数组，其实不然。

真正发生质变的是：**Prompt 被类型化（Typed）和结构化了。**

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466332577-a7c16943-bed2-4fd5-9391-3e50729c7473.png" width="512" title="" crop="0,0,1,1" id="zs05M" class="ne-image">

从 `Everything is String`，变成了严格区分角色的 `System`, `User`, `Assistant`。模型第一次在底层架构上拥有了“角色”的概念。

从软件工程的角度来看，这是一次典型的数据结构升级：
`String -> AST（Abstract Syntax Tree） -> Message Tree`

API 的变化，意味着模型开始有能力解析结构化的意图，而非单纯的文字接龙。

---

## 第三阶段：Tool Calling —— 模型第一次拥有行动能力

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466368724-8e4a0f93-29b8-4859-8ba9-ae5552ca8bf3.png" width="512" title="" crop="0,0,1,1" id="ue1a5f4a8" class="ne-image">

在 Tool Calling 出现之前，LLM 的职责是线性的：`Think -> Answer`。
而在 Tool Calling 之后，执行流变成了循环：`Think -> Decide -> Call Tool -> Observe -> Continue`。

注意，这里第一次在 API 层面闭环了智能体（Agent）的经典理论：**Reason（推理） -> Act（行动） -> Observe（观察）**。

Tool Calling 的最大意义，绝不仅仅是“让 AI 能调用天气 API 查温度”。它真正的破局点在于：**模型第一次拥有了“承认自己不知道”并主动借助外部世界来完成任务的能力。** 智能从静态的知识库，走向了动态的执行者。

---

## 第四阶段：Multimodal —— 统一世界模型（Unified Representation）

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466424604-f557c272-0203-4066-9b32-000a35cd6bfb.png" width="512" title="" crop="0,0,1,1" id="u34349f49" class="ne-image">

以前的输入是单纯的 `Text`，后来变成了 `Content[]` 数组，可以包含 `Text`, `Image`, `Audio`, `Video`, `PDF`。

为什么 API 会这样演进？因为在最前沿的模型眼中，图片、声音已经不再是需要 OCR 或 ASR 预处理的“特殊输入”，它们与文字一样，都只是 Token。

API 中 `modalities` 的增加，本质上映射的是：**模型开始拥有统一的信息表示能力（Unified Representation）。** 这是多模态真正可怕的地方——它不是在“支持图片”，而是在底层“统一世界”。

---

## 第五阶段：Agent Runtime —— API 开始描述执行过程与环境

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466496833-18005461-eeff-42ef-91a0-157f1ad33fcc.png" width="512" title="" crop="0,0,1,1" id="ufdae500d" class="ne-image">

这是当下正在发生的、最大的软件范式变革。

回顾前几个阶段，API 无论怎么变，返回的终究是一个“结果（Answer）”。
但今天，比如你看 OpenAI 的 Assistants API 或者最新的实时流式 API，它们返回的是 `Tool Call`, `Reasoning`, `Events`, `State`, `Output`。

API 不再只返回结果，而是开始**输出整个工作流（Workflow）**。

为什么很多开发者觉得现在的 Agent SDK 越来越庞大难懂？其实不是 SDK 复杂了，而是**模型承担的软件职责越来越多了。模型越来越不像一个函数，而越来越像一个操作系统级的 Runtime。** 

这就不得不提到当下极速爆发的 **MCP (Model Context Protocol)**。MCP 的出现，正是 API 演进到“Runtime 阶段”的必然产物。当模型成为运行时，它不仅需要工具，还需要一个标准协议来挂载和感知本地环境（文件、数据库、终端）。API 不得不去描述整个执行过程和上下文状态，因为模型正在接管原属于代码的控制流。

---

## 一个软件工程视角的总结

如果把这五年的演进画一条线，你会发现一个清晰的轨迹：
`String (2020) -> Conversation (2023) -> Tool (2024) -> Execution & Environment (2025)`

API 每升级一次，模型就向“真正的程序”迈进一步。

* **以前**：程序负责控制流程，模型只负责生成文本。
* **今天**：模型负责控制流程，程序退化为只负责执行具体的原子动作。

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466555216-ad095e6c-9382-4a57-a18c-7d3c1d31ab34.png" width="512" title="" crop="0,0,1,1" id="u6ca3755c" class="ne-image">

过去五年，API 其实一直在暗中做一件事：**不断把原来属于程序的职责，无缝迁移到模型中。** 我们可以看看这张对照表：

| 原来属于传统程序的职责 | 今天属于大模型的职责 |
| :--- | :--- |
| Prompt 纯文本拼接 | Context 窗口与状态管理 |
| 历史记录状态维护 | Conversation / Message Tree |
| 业务分支 (If-Else) 判断 | Tool Choice 动态路由 |
| RPC 接口调用封装 | Function Calling 原生支持 |
| 复杂工作流编排 | Agent Planning (Reasoning) |
| 正则提取 / JSON 转换 | Structured Output 结构化输出 |
| 独立的多媒体解析模块 | Multimodal Understanding 统一模态 |

这就是过去几年 AI API 演进真正的主线。这也是为什么我们今天能畅快地进行 **Vibe Coding** 的根本原因。由于模型接管了繁琐的逻辑控制流，开发者才得以从无穷尽的 If-else 中解脱出来，专注于定义目标 (Goal) 和提供上下文 (Context)，剩下的事情，交由模型这个 Runtime 自动执行。

---

## 未来还会怎样？预测 API 的下一步

因为 API 的设计永远滞后于模型能力的突破一点点，所以通过现在的瓶颈，我们大概能猜到 API 的下一步。

<img src="https://cdn.nlark.com/yuque/0/2026/png/229022/1782466595797-cdfad2b5-9df8-48f0-954f-c5c98d647f96.png" width="512" title="" crop="0,0,1,1" id="u656081c7" class="ne-image">

我认为未来三年，最核心的变化将是从 **命令式 (Imperative)** 走向 **声明式 (Declarative)**。

API 的核心负载将不再是微观的 `messages`，而会变成宏观的声明：
```yaml
Task: "帮我重构这段遗留代码"
Goal: "提升性能并补充单元测试"
Capability: [Code_Execution, Web_Search]
Memory: [Project_History]
Environment: [Local_Workspace]
```

未来我们调用的入口，可能不再是带着对话历史的 `chat()`，而是一个更具宏观执行力的 `execute(task)`。

因为，大模型的职责，已经无可挽回地从“回答问题”，变成了“完成任务”。
