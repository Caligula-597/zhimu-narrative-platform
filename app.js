const state = {
  view: "overview",
  chapter: 2,
  progress: 62,
  running: true,
  demoStep: 0,
  voiceRoom: "公共讨论房",
  voiceRoomId: null,
  voiceMessages: [],
  notes: [],
  cloudPlayer: null,
  cloudHost: [],
  cloudExploration: null,
  cloudHostEvents: [],
  cloudStudio: null,
  cloudWorlds: [],
  cloudRules: [],
  cloudCreatorChecks: [],
  studioSelectedNode: null,
  studioAnchorEditing: false,
  studioFilter: "all",
  studioZoom: 1,
  cloudAssets: [],
  storageUsage: null,
  apiError: "",
  wizardStep: 0,
  wizardRoleEditor: null,
  wizardDraft: {
    worldName: "我的长线世界",
    summary: "一个可持续推进的线上调查故事",
    worldMode: "scripted",
    contentSource: "document",
    roleSets: {
      scripted: [
        { name:"记者", goal:"调查真相", publicProfile:"追踪旧港航运记录的记者", privateProfile:"你在寻找父亲失踪前寄出的最后一封信。" },
        { name:"医生", goal:"隐瞒过去", publicProfile:"在雾港经营诊所的医生", privateProfile:"你认得旧档案上被涂去的名字。" },
        { name:"巡警", goal:"保护证人", publicProfile:"负责旧港片区的巡警", privateProfile:"你收到过一份不能公开的证人名单。" }
      ],
      campaign: [
        { name:"调查员", goal:"追查异象", publicProfile:"受邀来到雾港的自由调查员", privateProfile:"你曾在梦中见过这座港口。" },
        { name:"领航员", goal:"绘制路线", publicProfile:"熟悉近海航线的领航员", privateProfile:"你的旧海图上标记着一座不存在的灯塔。" },
        { name:"民俗学者", goal:"解释仪式", publicProfile:"研究沿海传说的民俗学者", privateProfile:"你知道潮落时不能回应谁的呼唤。" }
      ],
      hybrid: [
        { name:"记录者", goal:"整理线索", publicProfile:"负责记录调查进展的编辑", privateProfile:"你收到过来自未来章节的残页。" },
        { name:"守夜人", goal:"维持秩序", publicProfile:"熟悉港区夜路的守夜人", privateProfile:"你保管着一把只能打开一次的钥匙。" },
        { name:"调解人", goal:"连接阵营", publicProfile:"负责协调各方关系的中间人", privateProfile:"你和馆长约定过一个不能公开的交换条件。" }
      ]
    },
    contentSets: {
      scripted: {
        chapterTitle:"序章",
        sectionTitle:"角色序章：抵达现场",
        sectionBody:"夜色落下后，你收到了一封没有署名的来信。信中只有一处地址，以及一句话：请在午夜前抵达。"
      },
      campaign: {
        chapterTitle:"第一次冒险：雾港异象",
        sectionTitle:"开场钩子：失踪的领航员",
        sectionBody:"潮水退去后，码头留下了一艘没有船员的旧艇。你们需要决定先调查航海日志、失踪者住处，还是海图上的异常坐标。"
      },
      hybrid: {
        chapterTitle:"第一阶段：雾中来信",
        sectionTitle:"个人节点：共同调查前夜",
        sectionBody:"公开调查将在午夜开始，但你提前收到了一条只属于自己的消息。它会影响你在第一个开放场景中的选择。"
      }
    },
    automationTemplates: {
      reading: true,
      clue: true,
      chapter: true,
      hint: false
    }
  },
  rules: [true, true, true, false],
  players: [
    { name: "顾言", role: "记者", scene: "旧港档案馆", progress: 76, color: "#b9795c" },
    { name: "林烛", role: "医生", scene: "雾港诊所", progress: 64, color: "#587f79" },
    { name: "周岚", role: "巡警", scene: "码头仓库", progress: 58, color: "#706b91" },
    { name: "闻彻", role: "商人", scene: "钟楼广场", progress: 43, color: "#9a814f" }
  ],
  logs: [
    ["顾言 解读了线索「被撕去一页的航运录」", "2 分钟前", "ok"],
    ["规则触发：档案馆的暗门现已开放", "8 分钟前", "ok"],
    ["周岚在码头仓库停留较久，可能需要提示", "16 分钟前", "warn"],
    ["林烛 与 NPC 沈怀安 完成一次对话", "21 分钟前", "ok"]
  ]
};

const viewMeta = {
  overview: ["世界工作区", "世界总览"],
  writer: ["剧本杀创作", "创作者工作台"],
  studio: ["内容创作", "剧情编排"],
  assets: ["内容创作", "内容资产"],
  rules: ["内容创作", "自动化规则"],
  director: ["实时运行", "主持监控台"],
  player: ["玩家体验", "玩家视角"],
  archive: ["历史记录", "存档与复盘"],
  settings: ["世界管理", "世界设置"]
};

const content = document.querySelector("#content");
const toast = document.querySelector("#toast");
const modalBackdrop = document.querySelector("#modal-backdrop");
const modal = document.querySelector("#modal");

function render() {
  const [eyebrow, title] = viewMeta[state.view];
  const cloudWorld = state.cloudStudio?.world;
  if (cloudWorld) {
    document.querySelector(".world-switcher .world-icon").textContent = cloudWorld.name.slice(0, 1);
    document.querySelector(".world-switcher strong").textContent = cloudWorld.name;
    document.querySelector(".world-switcher small").textContent = `剧本杀创作 · ${state.cloudStudio.chapters.length} 个公共章节`;
  }
  document.querySelector("#page-eyebrow").textContent = eyebrow;
  document.querySelector("#page-title").textContent = title;
  document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === state.view));
  const views = { overview, writer, studio: studioCloud, assets, rules, director, player, archive, settings };
  content.innerHTML = views[state.view]();
  bindDynamic();
}

function overview() {
  const studio = state.cloudStudio, world = studio?.world;
  const roleCount = studio?.roles?.length ?? 0, chapterCount = studio?.chapters?.length ?? 0;
  const assetCount = studio ? studio.scenes.length + studio.clues.length + studio.investigationPoints.length : 0;
  const rooms = studio?.rooms || [], hasRuntime = rooms.length > 0;
  const enabledRules = (state.cloudRules || []).filter(rule => rule.enabled).length;
  const pendingEvents = hasRuntime ? (state.cloudHostEvents || []).length : 0;
  const chapterFlow = studio?.chapters?.map(chapter => flow(`第 ${chapter.sequence} 章`, escapeHtml(chapter.title), hasRuntime ? "等待运行状态" : "尚未开始", "locked")).join("") || `<div class="empty-state">尚未创建公共章节。</div>`;
  const activities = hasRuntime && state.logs.length ? state.logs.map(log => activity(...log)).join("") : `<div class="empty-state">当前世界暂无运行日志。创建测试房并邀请玩家后，阅读、调查和规则触发会记录在这里。</div>`;
  const roleRows = studio?.roles?.map((role,index) => {
    const sections = studio.sections.filter(section => section.role_slot_id === role.id).length;
    return readingRow(role.name[0], escapeHtml(role.name), hasRuntime ? "等待玩家加入或读取运行状态" : "尚未加入运行房", `${sections} 段已编排`, "", ["#b9795c","#587f79","#706b91","#9a814f","#76614d","#657c91"][index%6]);
  }).join("") || `<div class="empty-state">尚未创建角色席位。</div>`;
  return `
    ${cloudStatus()}
    <section class="hero">
      <article class="hero-card">
        <p class="eyebrow">CURRENT WORLD · ONLINE</p>
        <h2>${escapeHtml(world?.name || "正在读取云端世界")}</h2>
        <p>${escapeHtml(world?.summary || "世界基础信息加载完成后会显示在这里。")}</p>
        <div class="hero-stats"><div><strong>${String(roleCount).padStart(2,"0")}</strong><small>角色席位</small></div><div><strong>${String(chapterCount).padStart(2,"0")}</strong><small>公共章节</small></div><div><strong>${String(assetCount).padStart(2,"0")}</strong><small>剧情资产</small></div></div>
      </article>
      <article class="status-card">
        <div class="status-head"><h3>当前进度</h3><span>${hasRuntime ? "● 运行房已建立" : "○ 尚未开始运行"}</span></div>
        <div class="chapter"><p class="section-kicker">${hasRuntime ? "RUNTIME READY" : "CREATOR MODE"}</p><strong>${hasRuntime ? escapeHtml(rooms[0].name) : "尚未创建测试房"}</strong></div>
        <div class="progress"><i style="width:${hasRuntime ? state.progress : 0}%"></i></div>
        <div class="status-meta"><span>${hasRuntime ? "等待读取房间运行节点" : "当前仅有创作内容，没有玩家运行状态"}</span><span>${hasRuntime ? state.progress : 0}%</span></div>
        <div class="pulse-line"><i></i><span>${hasRuntime ? "运行实例已连接" : "完成检查后可建立测试房"}</span></div>
      </article>
    </section>
    <section class="stats-grid">
      ${stat("♙",hasRuntime ? String(state.cloudHost.length) : "0","已入房角色",hasRuntime ? "读取当前测试房玩家" : "尚未建立测试房")}
      ${stat("⌘",String(enabledRules),"已启用规则",enabledRules ? "云端规则已配置" : "尚未为当前世界配置规则")}
      ${stat("◇",String(studio?.clues?.length || 0),"已编排线索","创作态内容，不等于玩家已解锁")}
      ${stat("◷",String(pendingEvents),"待确认事件",pendingEvents ? "需要主持人处理" : "当前没有运行事件")}
    </section>
    <section class="dashboard-grid">
      <article class="card">
        <div class="section-head"><div><h3>剧情脉络</h3><p>主线节点的实时运行状态</p></div><button class="text-btn" data-go="studio">打开编排台 →</button></div>
        <div class="flow-list">
          ${chapterFlow}
        </div>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>实时动态</h3><p>最近发生的状态变化</p></div><button class="text-btn" data-go="director">查看全部 →</button></div>
        <div class="activity-list">${activities}</div>
      </article>
    </section>
    <section class="workspace-grid">
      <article class="card">
        <div class="section-head"><div><h3>角色阅读状态</h3><p>玩家主动读完后，系统才会记录状态并判断后续解锁</p></div><button class="text-btn" data-go="player">进入玩家视角 →</button></div>
        <div class="reading-list">${roleRows}</div>
      </article>
      <article class="card">
        <div class="section-head"><div><h3>现在可以做什么</h3><p>从主页面直接进入当前工作</p></div></div>
        <div class="task-list">
          ${task("◇","复核剧情编排",`${studio?.scenes?.length || 0} 个场景、${studio?.investigationPoints?.length || 0} 个调查点和 ${studio?.edges?.length || 0} 条连线已经写入`,"studio","打开编排")}
          ${task("✎","逐角色检查私人剧本",`${roleCount} 个角色席位，共 ${studio?.sections?.length || 0} 段私人正文`,"writer","检查角色稿")}
          ${task("⌘","配置自动化规则",enabledRules ? `当前已有 ${enabledRules} 条启用规则` : "当前世界还没有运行规则","rules","打开规则")}
          ${taskAction(hasRuntime ? "◉" : "＋",hasRuntime ? "管理平行房" : "建立测试房",hasRuntime ? `${rooms.length} 个互相隔离的运行房可管理` : "当前世界尚未创建运行实例","world-rooms",hasRuntime ? "查看房间" : "创建平行房")}
        </div>
      </article>
    </section>
    <section class="card capability-section">
      <div class="section-head"><div><h3>当前版本支持什么</h3><p>这不是路线图，而是已经放进第一版中的可用能力</p></div><button class="text-btn" data-action="capabilities">查看完整说明 →</button></div>
      <div class="capability-grid">
        ${capability("♙","角色专属阅读","每位玩家只看到自己的章节、秘密、任务与线索。","player")}
        ${capability("⌘","状态规则推进","根据阅读、调查、持有物品和主持确认解锁后续。","rules")}
        ${capability("♬","隔离语音空间","支持公共房、角色私密房与临时受邀密谈。","player")}
        ${capability("▤","随身笔记本","玩家可标记剧情段落，也可将线索记入个人笔记。","player")}
        ${capability("◇","剧情流程编排","用节点连接章节、场景、线索、事件与谜题。","studio")}
        ${capability("◉","主持监控台","查看玩家状态、系统日志、卡关预警与待确认事件。","director")}
        ${capability("◷","存档与复盘","保存关键状态，回看章节推进和重要行为。","archive")}
        ${capability("＋","标准创建教程","通过五步向导建立角色、内容、规则与测试房间。","wizard")}
      </div>
    </section>`;
}
function stat(icon,num,label,sub){return `<article class="stat-card"><div class="stat-icon">${icon}</div><strong>${num}</strong><span>${label} · ${sub}</span></article>`}
function flow(kicker,title,status,cls){return `<div class="flow-node ${cls}"><small>${kicker}</small><strong>${title}</strong><span>${status}</span></div>`}
function activity(text,time,type){return `<div class="activity ${type}"><i class="dot"></i><div><p>${text}</p><small>${time}</small></div></div>`}
function readingRow(initial,name,text,status,cls,color){return `<div class="reading-row"><div class="avatar small" style="background:${color}">${initial}</div><div><strong>${name}</strong><p>${text}</p></div><span class="reading-status ${cls}">${status}</span></div>`}
function task(icon,title,text,view,action){return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-go="${view}">${action} →</button></div>`}
function taskAction(icon,title,text,action,label){return `<div class="task-row"><span class="task-icon">${icon}</span><div><strong>${title}</strong><p>${text}</p></div><button data-action="${action}">${label} →</button></div>`}
function capability(icon,title,text,view){return `<article class="capability-card"><i>${icon}</i><h3>${title}</h3><p>${text}</p><button ${view==="wizard"?'data-action="open-wizard"':`data-go="${view}"`}>打开功能 →</button></article>`}

function studio() {
  return `<section class="studio-layout">
    <aside class="panel"><div class="panel-title">世界结构</div><div class="tree">
      <div class="tree-item">⌄　雾港来信</div><div class="tree-item indent">✓　序章：雾中来信</div><div class="tree-item indent">✓　第一章：未归之船</div><div class="tree-item indent active">◉　第二章：潮声下的名字</div><div class="tree-item indent">◇　第三章：灯塔守夜人</div><div class="tree-item indent">◇　终章：远航者之墓</div>
      <div class="tree-item">⌄　支线剧情</div><div class="tree-item indent">◇　诊所旧事</div><div class="tree-item indent">◇　失踪的摆渡人</div>
    </div></aside>
    <div class="node-board">
      <div class="board-toolbar"><div class="tool-group"><button class="tool" disabled>＋ 添加节点 · 待接入</button><button class="tool" disabled>自动布局 · 待接入</button><button class="tool" disabled>连线模式 · 待接入</button></div><div class="tool-group"><button class="tool" disabled>−</button><button class="tool" disabled>86%</button><button class="tool" disabled>＋</button></div></div>
      ${line(163,172,105,0)}${line(305,172,105,45)}${line(305,172,105,-47)}${line(475,312,68,0)}${line(475,126,68,0)}
      ${node(22,130,"场景","进入档案馆","玩家抵达后可自由调查","")}
      ${node(190,130,"线索","航运录残页","调查旧报架后获得","current")}
      ${node(360,80,"事件","馆长的迟疑","持有旧照片时开放新对话","event")}
      ${node(360,270,"谜题","暗门机关","解读航运录 + 使用黄铜钥匙","lock")}
      ${node(540,270,"场景","档案密室","已满足条件，等待玩家进入","")}
      ${node(540,80,"线索","守夜人手记","对话后由馆长交付","lock")}
    </div>
    <aside class="panel inspector"><div class="panel-title">节点检查器</div><div class="inspector-body">
      <p class="section-kicker">CLUE NODE</p><h3 style="margin-top:7px">航运录残页</h3>
      <label>节点类型</label><select class="field"><option>线索节点</option><option>事件节点</option></select>
      <label>可见范围</label><select class="field"><option>获得后可见</option><option>全员公开</option></select>
      <label>标签</label><div><span class="tag">主线</span><span class="tag">可解读</span><span class="tag">档案馆</span></div>
      <label>解锁条件</label><div class="rule-block">当玩家调查「旧报架」<br>并且 当前章节 = 第二章<br>→ 发放线索并写入日志</div>
      <button class="primary-btn full-btn" data-action="unavailable" data-feature="节点写入 API">保存节点配置 · 待接入</button>
    </div></aside>
  </section>`;
}
function line(x,y,w,r){return `<i class="connector" style="left:${x}px;top:${y}px;width:${w}px;transform:rotate(${r}deg)"></i>`}
function node(x,y,badge,title,desc,cls){return `<article class="node ${cls}" style="left:${x}px;top:${y}px"><span class="badge">${badge}</span><strong>${title}</strong><small>${desc}</small></article>`}

function studioCloud() {
 const data=state.cloudStudio;
 if(!data)return `<section class="card"><h3>正在读取云端剧情编排...</h3><p>章节、角色剧本、场景和线索会从 PostgreSQL 加载。</p></section>`;
 return `<section class="studio-layout">
  <aside class="panel"><div class="panel-title">剧本杀世界结构</div><div class="tree">
   <div class="tree-item">◈　${data.world.name}</div>
   ${data.chapters.map(chapter=>`<div class="tree-item indent">▤　${chapter.title}</div>`).join("")||`<div class="tree-item indent">尚未建立章节</div>`}
   <div class="tree-item">♙　角色私人剧本</div>
   ${data.roles.map(role=>`<div class="tree-item indent">${role.name} · ${data.sections.filter(section=>section.role_slot_id===role.id).length} 段</div>`).join("")}
  </div></aside>
  <div class="story-workspace">
   <div class="story-toolbar"><div class="story-toolbar-row"><div class="tool-group"><button class="tool" data-action="studio-add-scene">＋ 场景</button><button class="tool" data-action="studio-add-clue">＋ 线索</button><button class="tool" data-action="studio-add-point">＋ 调查点</button><button class="tool" data-action="studio-add-chapter">＋ 章节</button></div><div class="tool-group"><button class="tool" data-action="studio-auto-layout">自动布局</button><button class="tool" data-action="studio-zoom-out">−</button><span class="zoom-label">${Math.round(state.studioZoom*100)}%</span><button class="tool" data-action="studio-zoom-in">＋</button></div></div>
   <div class="story-toolbar-row"><div class="filter-tabs">${studioFilterButton("all","全部节点")}${studioFilterButton("scene","场景")}${studioFilterButton("clue","线索")}${studioFilterButton("investigation_point","调查点")}</div><div class="graph-legend"><span><i class="relation-mainline"></i>主线</span><span><i class="relation-parallel"></i>并列</span><span><i class="relation-extension"></i>延伸</span></div></div>${studioCompactSelection(data)}</div>
   <div class="node-board"><button class="canvas-add-btn" data-action="studio-add-node-menu">＋ 在画布中新增节点</button><div class="graph-canvas" style="transform:scale(${state.studioZoom})">
      ${studioEdges(data)}${studioNodes(data)}
   </div></div>
  </div>
  <aside class="panel inspector"><div class="panel-title">云端编排检查器</div><div class="inspector-body">
   <p class="section-kicker">SCRIPTED WORLD</p><h3 style="margin-top:7px">${data.world.name}</h3>
   <label>公共章节</label><div class="rule-block">${data.chapters.map(chapter=>`${chapter.sequence}. ${chapter.title}`).join("<br>")||"尚未创建"}</div>
   <label>角色专属剧本</label><div class="rule-block">${data.roles.map(role=>`${role.name}：${data.sections.filter(section=>section.role_slot_id===role.id).length} 段私人内容`).join("<br>")||"尚未创建"}</div>
   <label>已写入节点</label><div><span class="tag">${data.scenes.length} 场景</span><span class="tag">${data.clues.length} 线索</span><span class="tag">${data.investigationPoints.length} 调查点</span><span class="tag">${data.edges.length} 连线</span></div>
   ${studioSelection(data)}
   <div class="tutorial-tip"><b>剧本杀编排</b><span>公共剧情线负责章节、场景和线索关系；每位玩家的私人文本单独存储，不会混成同一份剧本。</span></div>
  </div></aside>
 </section>`;
}
function studioNodes(data){
 const nodes=[],visible=studioVisibleNodes(data);
 visible.forEach(node=>{const position=studioNodePosition(node,data);nodes.push(studioNode(position.x,position.y,node.type,node.id,node.badge,node.title,node.desc,node.cls,node.metadata))});
 return nodes.join("")||node(30,120,"开始","建立公共剧情线","请添加章节、公共场景和线索","");
}
function studioNode(x,y,type,id,badge,title,desc,cls,metadata={}){const selected=state.studioSelectedNode?.type===type&&state.studioSelectedNode?.id===id,anchors=studioNodeAnchors({metadata});return `<button class="node ${cls} ${selected?"selected":""}" style="left:${x}px;top:${y}px;text-align:left" data-action="studio-select-node" data-node-type="${type}" data-node-id="${id}"><span class="node-drag-handle">⠿ 拖动</span>${anchors.map(anchor=>`<span class="node-link-handle ${state.studioAnchorEditing&&selected?"anchor-editing":""}" style="left:${anchor.x}px;top:${anchor.y}px" data-anchor-id="${anchor.id}" title="${state.studioAnchorEditing&&selected?"拖动调整连接点位置":"拖到其他节点创建连线"}"></span>`).join("")}<span class="badge">${badge}</span><strong>${title}</strong><small>${desc}</small></button>`}
function studioNodeList(data){return [...data.scenes.map(node=>({type:"scene",id:node.id,name:`场景 · ${node.name}`,title:node.name,badge:"公共场景",desc:node.public_text||"等待补充场景说明",cls:"",metadata:node.metadata})),...data.clues.map(node=>({type:"clue",id:node.id,name:`线索 · ${node.name}`,title:node.name,badge:"线索",desc:node.public_text||"等待补充线索说明",cls:"current",metadata:node.metadata})),...data.investigationPoints.map(node=>({type:"investigation_point",id:node.id,name:`调查点 · ${node.name}`,title:node.name,badge:"调查点",desc:node.description||"等待补充调查说明",cls:"event",metadata:node.metadata}))]}
function studioVisibleNodes(data){const all=studioNodeList(data);return state.studioFilter==="all"?all:all.filter(node=>node.type===state.studioFilter)}
function studioFilterButton(value,label){return `<button class="filter-tab ${state.studioFilter===value?"active":""}" data-action="studio-filter" data-filter="${value}">${label}</button>`}
function studioCompactSelection(data){const selected=state.studioSelectedNode;if(!selected)return `<div class="canvas-tip">拖动卡片调整位置；拖动画布空白处平移；选中节点后可以添加连接点，再从圆点拖到另一张卡快速连线。</div>`;return `<div class="compact-selection"><span>当前节点：${studioNodeName(data,selected.type,selected.id)} · ${studioNodeAnchors(studioNodeRecord(data,selected.type,selected.id)).length} 个连接点</span><div class="row"><button class="text-btn" data-action="studio-add-anchor">＋ 连接点</button><button class="text-btn" data-action="studio-toggle-anchor-edit">${state.studioAnchorEditing?"完成调整":"调整连接点"}</button><button class="text-btn" data-action="studio-connect-node">＋ 创建连线</button><button class="text-btn danger-text" data-action="studio-delete-node">删除节点</button></div></div>`}
function studioDefaultPositions(data){const positions=new Map();data.scenes.forEach((scene,index)=>positions.set(`scene:${scene.id}`,{x:48,y:92+index*142}));data.clues.forEach((clue,index)=>positions.set(`clue:${clue.id}`,{x:294,y:92+index*142}));data.investigationPoints.forEach((point,index)=>positions.set(`investigation_point:${point.id}`,{x:540,y:92+index*142}));return positions}
function studioNodePosition(node,data){return node.metadata?.graphPosition||studioDefaultPositions(data).get(`${node.type}:${node.id}`)||{x:40,y:100}}
function studioNodeRecord(data,type,id){return ({scene:data.scenes,clue:data.clues,investigation_point:data.investigationPoints})[type]?.find(node=>node.id===id)}
function studioNodeAnchors(node){const anchors=node.metadata?.graphAnchors;return Array.isArray(anchors)&&anchors.length?anchors:[{id:"default",x:156,y:62}]}
function setStudioNodePosition(type,id,position){const node=studioNodeRecord(state.cloudStudio,type,id);if(node)node.metadata={...(node.metadata||{}),graphPosition:position}}
function setStudioNodeAnchors(type,id,anchors){const node=studioNodeRecord(state.cloudStudio,type,id);if(node)node.metadata={...(node.metadata||{}),graphAnchors:anchors}}
function closestStudioAnchorPair(fromNode,fromPosition,toNode,toPosition){let best=null;studioNodeAnchors(fromNode).forEach(from=>studioNodeAnchors(toNode).forEach(to=>{const start={x:fromPosition.x+from.x,y:fromPosition.y+from.y},end={x:toPosition.x+to.x,y:toPosition.y+to.y},distance=(end.x-start.x)**2+(end.y-start.y)**2;if(!best||distance<best.distance)best={start,end,distance}}));return best}
function studioNodeName(data,type,id){return studioNodeList(data).find(node=>node.type===type&&node.id===id)?.name||`${type} · ${id.slice(0,6)}`}
function studioEdges(data){
 const visible=studioVisibleNodes(data),nodes=new Map(visible.map(node=>[`${node.type}:${node.id}`,node]));
 return data.edges.map(edge=>{const fromNode=nodes.get(`${edge.from_type}:${edge.from_id}`),toNode=nodes.get(`${edge.to_type}:${edge.to_id}`);if(!fromNode||!toNode)return "";const pair=closestStudioAnchorPair(fromNode,studioNodePosition(fromNode,data),toNode,studioNodePosition(toNode,data)),dx=pair.end.x-pair.start.x,dy=pair.end.y-pair.start.y,w=Math.sqrt(dx*dx+dy*dy),r=Math.atan2(dy,dx)*180/Math.PI;return `<i class="connector relation-${edge.relation_type}" data-from="${edge.from_type}:${edge.from_id}" data-to="${edge.to_type}:${edge.to_id}" style="left:${pair.start.x}px;top:${pair.start.y}px;width:${w}px;transform:rotate(${r}deg)"></i>`}).join("");
}
function studioSelection(data){
 const selected=state.studioSelectedNode;
 const edges=data.edges.map(edge=>`<div class="edge-row"><span class="tag">${({mainline:"主线",parallel:"并列",extension:"延伸"})[edge.relation_type]}</span><p>${studioNodeName(data,edge.from_type,edge.from_id)} → ${studioNodeName(data,edge.to_type,edge.to_id)}</p><button class="text-btn" data-action="studio-delete-edge" data-edge-id="${edge.id}">删除</button></div>`).join("");
 if(!selected)return `<label>剧情连线</label>${edges||`<p class="wizard-intro">点击节点后可以建立主线、并列或延伸关系。</p>`}`;
 const anchors=studioNodeAnchors(studioNodeRecord(data,selected.type,selected.id));
 return `<label>当前节点</label><div class="rule-block">${studioNodeName(data,selected.type,selected.id)}</div><div class="anchor-toolbar"><button class="secondary-btn" data-action="studio-add-anchor">＋ 添加连接点</button><button class="secondary-btn" data-action="studio-toggle-anchor-edit">${state.studioAnchorEditing?"完成位置调整":"拖动调整连接点"}</button></div><div class="anchor-list">${anchors.map((anchor,index)=>`<div class="anchor-row"><span><i></i> 连接点 ${index+1}</span>${anchors.length>1?`<button class="text-btn danger-text" data-action="studio-delete-anchor" data-anchor-id="${anchor.id}">删除</button>`:""}</div>`).join("")}</div><button class="secondary-btn full-btn" data-action="studio-connect-node">＋ 创建剧情连线</button><button class="danger-btn full-btn" data-action="studio-delete-node">删除当前节点</button><label>剧情连线</label>${edges||`<p class="wizard-intro">尚未创建连线。</p>`}`;
}

function writer(){
 const data=state.cloudStudio;
 if(!data)return `<section class="card"><h3>正在打开剧本杀创作中心...</h3><p>角色分幕、章节规则与版本记录正在从云端读取。</p></section>`;
 const statusName={draft:"草稿",testing:"测试中",published:"已发布"};
 const checks=state.cloudCreatorChecks||[];
 return `<section class="writer-hero"><div><p class="section-kicker">SCRIPTED MYSTERY CREATOR</p><h2>剧本杀创作中心</h2><p>先写每位玩家真正会读到的私人剧本，再控制公共章节何时进入测试和发布。剧情图谱只负责梳理关系，不会把跑团流程混进来。</p></div><div class="row"><button class="secondary-btn" data-action="deepseek-assistant">AI 剧情策划</button><button class="secondary-btn" data-action="story-manuscript">完整剧情</button><button class="secondary-btn" data-action="story-assistant">规则分类器</button><button class="secondary-btn" data-action="creator-import">导入内容</button><button class="secondary-btn" data-action="creator-export">导出备份</button><button class="secondary-btn" data-action="creator-preview">玩家视角模拟</button><button class="secondary-btn" data-action="creator-check">运行发布检查</button><button class="primary-btn" data-action="creator-snapshot">＋ 保存创作版本</button></div></section>
 <section class="writer-grid">
  <article class="card writer-main"><div class="section-head"><div><h3>角色私人剧本</h3><p>每个角色拥有独立分幕正文，玩家进入房间后只会读取自己的内容。</p></div><button class="secondary-btn" data-action="creator-add-role">＋ 新增角色</button></div>
   ${data.roles.map(role=>`<section class="role-manuscript"><div class="role-manuscript-head"><div><span class="asset-type">角色席位</span><h3>${role.name}</h3><p>${role.public_profile||"尚未补充公开身份"}</p></div><div class="row"><button class="secondary-btn" data-action="creator-edit-role" data-role="${role.id}">编辑席位</button><button class="primary-btn" data-action="creator-add-section" data-role="${role.id}">＋ 新增一幕</button></div></div>
   <div class="manuscript-list">${data.sections.filter(section=>section.role_slot_id===role.id).map(section=>`<div class="manuscript-row"><div><strong>${section.sequence}. ${section.title}</strong><p>${section.body.slice(0,86)}${section.body.length>86?"...":""}</p></div><span class="status-chip ${section.publication_status}">${statusName[section.publication_status]}</span><button class="secondary-btn" data-action="creator-edit-section" data-role="${role.id}" data-section="${section.id}">编辑</button></div>`).join("")||`<div class="empty-state">尚无正文。先新增角色序章或第一幕。</div>`}</div></section>`).join("")}
  </article>
  <aside class="writer-side">
   <article class="card"><div class="section-head"><div><h3>章节发布控制</h3><p>草稿不会进入玩家房间。</p></div></div>${data.chapters.map(chapter=>`<div class="chapter-control"><div><strong>${chapter.sequence}. ${chapter.title}</strong><p>${chapter.summary||"尚未补充章节摘要"}</p></div><span class="status-chip ${chapter.publication_status}">${statusName[chapter.publication_status]}</span><button class="text-btn" data-action="creator-edit-chapter" data-chapter="${chapter.id}">设置</button></div>`).join("")||`<div class="empty-state">请先在剧情编排中新增章节。</div>`}</article>
   <article class="card" style="margin-top:14px"><div class="section-head"><div><h3>玩家视角测试</h3><p>发布前检查缺失内容与孤立节点。</p></div></div>${checks.length?checks.map(check=>`<div class="check-result ${check.level}"><b>${check.title}</b><span>${check.detail}</span></div>`).join(""):`<div class="empty-state">点击“运行发布检查”生成真实云端报告。</div>`}<button class="secondary-btn full-btn" data-go="player">切换玩家视角预览</button></article>
   <article class="card" style="margin-top:14px"><div class="section-head"><div><h3>创作版本历史</h3><p>保存关键节点，需要时恢复正文与发布状态。</p></div></div>${data.versions.map(version=>`<div class="version-row"><div><strong>${version.label}</strong><p>${formatTime(version.created_at)}</p></div><div class="row"><button class="text-btn" data-action="creator-restore" data-version="${version.id}">恢复</button><button class="text-btn" data-action="creator-delete-version" data-version="${version.id}">删除</button></div></div>`).join("")||`<div class="empty-state">尚未保存创作快照。</div>`}</article>
  </aside>
 </section>
 <section class="card placeholder-hub"><div class="section-head"><div><h3>创作者工具箱</h3><p>协作、日志和文档解析已经连接真实云端接口。</p></div></div><div class="placeholder-grid">
 ${creatorTool("协作权限","邀请已注册成员，分配协作者、主持人或只读观察者权限","creator-collaboration","管理成员 →")}
 ${creatorTool("运行日志","筛选阅读、调查、规则触发与主持操作记录","creator-logs","查看日志 →")}
 ${creatorTool("文档解析","解析 TXT、Markdown 或 DOCX，预览后写入母稿或角色私人剧本","creator-document-parser","解析文档 →")}
 ${placeholderModule("实体小卡","二维码或 NFC 绑定线索、道具和限定支线","实体卡激活 API")}
 </div></section>`;
}
function placeholderModule(title,text,feature){return `<article class="placeholder-module"><span>PLANNED</span><h3>${title}</h3><p>${text}</p><button class="text-btn" data-action="unavailable" data-feature="${feature}">查看规划 →</button></article>`}
function creatorTool(title,text,action,label){return `<article class="placeholder-module connected"><span>CONNECTED</span><h3>${title}</h3><p>${text}</p><button class="text-btn" data-action="${action}">${label}</button></article>`}
function formatTime(value){return new Date(value).toLocaleString("zh-CN",{month:"numeric",day:"numeric",hour:"2-digit",minute:"2-digit"})}

const assetsData = [
 ["线索","被撕去一页的航运录","船只抵港记录中，二十年前的最后一页被人撕走。","档案馆","已解锁"],
 ["角色","顾言 · 记者","收到匿名来信后返回雾港，似乎与失踪者关系匪浅。","玩家角色","在线"],
 ["场景","旧港档案馆","海水浸泡过的旧档案堆满木架，空气中残留着盐味。","第一章","开放"],
 ["物品","黄铜钥匙","钥匙柄上刻着已经模糊的灯塔纹样。","码头仓库","周岚持有"],
 ["NPC","沈怀安 · 馆长","看守旧港档案三十年，对当年的沉船事故始终讳莫如深。","档案馆","可对话"],
 ["线索","守夜人手记","泛黄纸页记录着灯塔熄灭前最后一次交接。","馆长对话","未解锁"],
 ["事件","档案馆的暗门","航运录残页与黄铜钥匙将共同开启隐藏空间。","自动规则","待触发"],
 ["场景","潮汐诊所","诊所地下留有一间不在建筑图纸中的观察室。","支线剧情","开放"],
 ["物品","未寄出的信","署名被墨水洇开，只留下半枚红色火漆印。","诊所旧事","林烛持有"]
];
function assets(){
  const usage=state.storageUsage; const pct=usage?Math.min(100,Math.round(usage.usedBytes/usage.maxBytes*100)):0;
  return `<div class="asset-toolbar"><div class="search-box">⌕<input placeholder="搜索线索、角色、场景或标签"></div><div class="row"><button class="secondary-btn" data-action="upload-asset">↑ 上传云端附件</button><button class="primary-btn" data-action="new-asset">＋ 新建内容</button></div></div>
  <article class="card" style="margin-bottom:14px"><div class="section-head"><div><h3>云端附件空间</h3><p>真实连接 Cloudflare R2 私有 Bucket，附件通过短期签名地址上传下载</p></div><span class="cloud-pill">R2 · PRIVATE</span></div><div class="usage-bar"><i style="width:${pct}%"></i></div><div class="status-meta"><span>${usage?formatBytes(usage.usedBytes):"读取中"} / ${usage?formatBytes(usage.maxBytes):"500 MB"}</span><span>${pct}%</span></div>${state.cloudAssets.length?`<div class="cloud-asset-list">${state.cloudAssets.map(a=>`<div class="cloud-asset-row"><div><strong>${a.original_filename}</strong><p>${a.asset_kind} · ${formatBytes(a.byte_size)} · ${a.visibility}</p></div><button class="danger-btn" data-action="delete-asset" data-asset="${a.id}">移入回收站</button></div>`).join("")}</div>`:`<div class="empty-state">尚未上传云端附件。</div>`}</article>
  <div class="tabs"><button class="tab active" disabled>全部 32 · 当前展示</button><button class="tab" disabled>线索 12 · 待筛选 API</button><button class="tab" disabled>角色 8</button><button class="tab" disabled>场景 7</button><button class="tab" disabled>事件 5</button></div>
  <section class="asset-grid">${assetsData.map(asset => `<article class="asset-card"><div class="asset-top"><span class="asset-type">${asset[0]}</span><button class="ghost-btn" disabled title="编辑 API 待接入">•••</button></div><h3>${asset[1]}</h3><p>${asset[2]}</p><div class="asset-meta"><span>${asset[3]}</span><span>${asset[4]}</span></div></article>`).join("")}</section>`;
}
function formatBytes(bytes){if(bytes<1024)return `${bytes} B`;if(bytes<1024*1024)return `${(bytes/1024).toFixed(1)} KB`;return `${(bytes/1024/1024).toFixed(1)} MB`}
function rules() {
 const data=state.cloudRules||[],modeName={automatic:"自动执行",host_confirm:"主持确认",manual:"仅手动"};
 return `<section class="rules-layout"><div><div class="section-head"><div><h3>规则列表</h3><p>规则已经连接云端数据库。条件满足后，系统执行动作或提交主持人确认。</p></div><button class="primary-btn" data-action="rule-new">＋ 新建规则</button></div>
 ${data.map(rule=>`<article class="rule-card"><div class="rule-card-top"><button class="toggle ${rule.enabled?"on":""}" data-action="rule-toggle" data-rule="${rule.id}" title="启用或暂停规则"><i></i></button><h3>${rule.name}</h3><span class="mode ${rule.mode==="host_confirm"?"confirm":""}">${modeName[rule.mode]}</span></div><p class="rule-text"><b>当</b> ${escapeHtml(JSON.stringify(rule.conditions))}<br><b>则</b> ${escapeHtml(JSON.stringify(rule.actions))}</p><div class="rule-stats"><span>● ${rule.enabled?"已启用":"已暂停"}</span><span>优先级 ${rule.priority}</span><span>${rule.room_name||"世界模板"}</span></div><div class="row rule-actions"><button class="text-btn" data-action="rule-edit" data-rule="${rule.id}">编辑</button><button class="text-btn danger-text" data-action="rule-delete" data-rule="${rule.id}">删除</button></div></article>`).join("")||`<div class="empty-state">尚未建立自动化规则。先创建一条阅读完成或调查点完成规则。</div>`}</div>
 <aside class="card"><div class="section-head"><div><h3>自动化概览</h3><p>创作阶段规则检查</p></div></div>
 ${stat("⌘",String(data.length),"条云端规则","支持世界模板与测试房")}${stat("✓",String(data.filter(rule=>rule.enabled).length),"条已启用","暂停规则不会触发")}${stat("◷",String(data.filter(rule=>rule.mode==="host_confirm").length),"项主持确认","关键转折保留人工判断")}
 <button class="secondary-btn full-btn" data-action="rule-validate">运行规则检查</button></aside></section>`;
}
function director(){
 return `${cloudStatus()}${demoStrip()}<div class="director-head"><div><span class="live-label">● LIVE</span><strong>　雾港来信 · 潮声下的名字</strong></div><div class="row"><button class="secondary-btn" data-action="pause">${state.running?"暂停自动推进":"恢复自动推进"}</button><button class="primary-btn" data-action="unavailable" data-feature="存档快照 API">＋ 创建存档点 · 待接入</button></div></div>
 <section class="stats-grid">${stat("♙","4","在线玩家","全部连接正常")}${stat("⌘","3","运行中规则","最近检测：刚刚")}${stat("◷","01:18","本章时长","预计剩余 42 分钟")}${stat("⚑","1","卡关预警","码头仓库")}</section>
 <section class="director-grid" style="margin-top:15px"><article class="card"><div class="section-head"><div><h3>玩家状态</h3><p>系统根据阅读、位置和交互行为实时更新</p></div></div><div class="player-list">
 ${directorPlayers().map((p,i)=>`<div class="player-row"><div class="avatar" style="background:${p.color}">${p.name[0]}</div><div><strong>${p.name} · ${p.role}</strong><p>${p.scene}</p></div><div><div class="progress"><i style="width:${p.progress}%"></i></div><p>${p.caption}</p></div></div>`).join("")}</div></article>
 <aside><article class="card"><div class="section-head"><div><h3>等待确认</h3><p>以下按钮仅演示主持交互，事件写入 API 尚未接入</p></div></div><div class="event-ready"><h3>馆长交付手记</h3><p>顾言已完成馆长的隐藏对话条件。可现在交付，也可以延迟到玩家进入密室后。</p><div class="event-actions"><button class="primary-btn" data-action="approve-event">演示执行</button><button class="secondary-btn" data-action="delay-event">演示延迟</button></div></div></article>
 <article class="card" style="margin-top:15px"><div class="section-head"><div><h3>实时动态</h3><p>最近状态变化</p></div></div><div class="activity-list">${state.logs.map(log=>activity(...log)).join("")}</div></article></aside></section>`;
}
function player(){
 const scene=currentScene();
 return `<section class="player-view">${cloudStatus()}${voiceHub()}<article class="player-hero live-flash"><div class="player-hero-copy"><p class="eyebrow">CHAPTER 02 · 角色剧情</p><h2>${scene.title}</h2><p>${scene.text}</p></div><div class="scene-art">${scene.art}</div></article>
 ${reader()}
 <section class="player-layout"><div><article class="card"><div class="section-head"><div><h3>探索当前场景</h3><p>阅读完成后，可以选择地点继续调查</p></div></div>
 ${locationRow("▥","旧报架","泛黄的报纸按照年份堆叠，其中几册明显有被翻动过的痕迹。","调查")}
 ${locationRow("▤","航运档案柜","柜门已经生锈，锁孔的形状有些特殊。","查看")}
 ${locationRow("♙","馆长办公桌","桌上散落着半杯凉茶和一张没有写完的便签。","调查")}
 </article></div><aside>${notebookCard()}
 <article class="role-story"><p class="section-kicker">仅你可见 · 角色剧本</p><h3>记者的旧日来信</h3><p>你认得馆长办公桌上的火漆印。十年前，父亲失踪前寄给你的最后一封信上，也有相同的印记。</p><button class="text-btn" disabled style="margin-top:9px">完整剧本目录 · 待接入</button></article>
 <article class="card"><div class="section-head"><div><h3>我的线索</h3><p>顾言 · 已获得 5 条</p></div></div>
 ${clue("被撕去一页的航运录","已解读 · 核心线索")}${clue("二十年前的港口合影","未解读 · 个人线索")}${clue("匿名来信","已阅读 · 初始线索")}<button class="secondary-btn full-btn" disabled>完整线索列表 · 待接入</button></article>
 </aside></section></section>`;
}
function demoStrip(){return `<section class="demo-strip"><div><span class="demo-badge">DEMO · 可控演示</span><strong style="margin-top:7px">主持人观察玩家行为后推进世界状态</strong><p>系统不会按时间打断玩家阅读。这里仅用于模拟阅读、调查或解读完成后的规则触发。</p></div><div class="row"><button class="primary-btn" data-action="demo-next">模拟下一项行为</button><button class="ghost-btn" data-action="demo-reset">重置演示</button></div></section>`}
function cloudStatus(){const rooms=state.cloudStudio?.rooms||[];return `<section class="demo-strip"><div><span class="cloud-pill ${state.apiError?"offline":""}">${state.apiError?"部分运行模块尚未连接":"● 云端 Alpha 已连接"}</span><strong style="margin-top:7px">${state.apiError||"当前世界的创作数据已经从 Supabase PostgreSQL 读取"}</strong><p>${state.cloudStudio?(rooms.length?`当前世界已建立 ${rooms.length} 个运行房间。`:"当前世界尚未建立测试房，运行状态为空。"):"正在读取 Supabase PostgreSQL..."}</p></div><button class="secondary-btn" data-action="refresh-cloud">刷新云端数据</button></section>`}
function directorPlayers(){const base=state.players.map(p=>({...p,caption:`${p.progress}% 完成`,scene:`当前位置：${p.scene}`}));const real=state.cloudHost[0];if(real){const pct=real.total_sections?Math.round(real.completed_sections/real.total_sections*100):0;base[0]={...base[0],name:real.name.split(" · ")[0],role:real.name.split(" · ")[1]||"角色",progress:pct,caption:`云端阅读 ${real.completed_sections} / ${real.total_sections}`,scene:"真实云端进度"};}return base}
function voiceHub(){return `<section class="voice-stack"><section class="voice-hub"><div class="voice-hub-left"><div class="voice-hub-icon">♬</div><div><strong>语音空间 · ${state.voiceRoom}</strong><p>${state.voiceRoom==="公共讨论房"?"所有房间成员可见":"私密通话 · 仅受邀玩家可见"}</p></div></div><div class="row"><div class="voice-hub-users">${state.players.slice(0,state.voiceRoom==="公共讨论房"?4:2).map(p=>`<div class="avatar" style="background:${p.color}">${p.name[0]}</div>`).join("")}</div><button class="primary-btn" data-action="voice-room">切换语音房</button></div></section>${voiceChat()}</section>`}
function voiceChat(){const messages=state.voiceMessages||[];return `<article class="voice-chat"><div class="voice-chat-head"><div><strong>房内文字频道</strong><p>消息只会显示给当前语音房成员，用于语音接入前的流程测试。</p></div><button class="text-btn" data-action="voice-chat-refresh">刷新</button></div><div class="voice-chat-log">${messages.length?messages.map(message=>`<div class="voice-message"><b>${escapeHtml(message.sender_name||"玩家")}</b><span>${formatTime(message.created_at)}</span><p>${escapeHtml(message.body)}</p></div>`).join(""):`<div class="empty-state">当前语音房还没有消息。</div>`}</div><div class="voice-chat-compose"><input class="field" data-voice-chat-input placeholder="发送给当前语音房成员"><button class="primary-btn" data-action="voice-chat-send">发送</button></div></article>`}
function currentScene(){
 const scenes=[
  ["旧港档案馆","窗外的雾压在斑驳玻璃上。馆长离开后，木架深处传来极轻的碰撞声，像是有什么东西正随着潮水呼吸。","档"],
  ["航运档案柜","顾言翻开残缺的航运录，盐渍沿着纸页边缘蔓延。被撕走的那一页，似乎与父亲失踪的日期重合。","录"],
  ["潮汐诊所地下室","远处传来同伴的新消息。诊所地下的观察室已经开启，一份从未登记过的病历进入共享线索池。","诊"],
  ["档案馆暗门","黄铜钥匙转动时，书架后方响起沉闷的机关声。墙面裂开一道缝隙，潮湿空气从黑暗中漫出。","钥"],
  ["档案密室入口","隐藏多年的入口已经开放。密室内有微弱灯光，系统提示所有玩家重新确认是否进入下一节点。","密"]
 ];
 const item=scenes[state.demoStep%scenes.length]; return {title:item[0],text:item[1],art:item[2]};
}
function reader(){
 const cloudSections=state.cloudPlayer?.sections||[];
 const cloudSection=cloudSections.find(section=>!section.completed)||cloudSections[cloudSections.length-1];
 if(cloudSection){
  const marked=state.cloudPlayer.notes.some(note=>note.source_id===cloudSection.id);
  return `<article class="reader-card"><div class="reader-head"><div><p class="section-kicker">顾言 · 云端私人章节</p><h3>${cloudSection.title}</h3><p>内容来自 Supabase PostgreSQL。阅读完成后会真实保存并触发规则。</p></div><span class="reader-progress">${cloudSection.sequence} / ${Math.max(cloudSections.length,2)}</span></div><p class="story-paragraph ${marked?"marked":""}">${cloudSection.body}<button class="mark-btn" data-action="add-cloud-note" data-section="${cloudSection.id}" data-label="剧情 · ${cloudSection.title}" data-note="${cloudSection.body}">${marked?"已记入云端":"标记重点"}</button></p><div class="reader-footer"><p>${cloudSection.completed?"本章节已完成，可以继续查看已解锁内容。":"由你主动确认阅读完成，系统不会自动跳转。"}</p><button class="primary-btn" data-action="read-cloud-next" data-section="${cloudSection.id}" ${cloudSection.completed?"disabled":""}>${cloudSection.completed?"已完成":"我已读完，保存并继续"}</button></div></article>`
 }
 const chapters=[
  ["抵达档案馆",["馆长将一串沉重的钥匙留在桌面上，便借口整理旧报纸离开。门轴发出一声轻响，走廊重新沉入雾色。","你在航运录的封皮内侧摸到一行几乎被磨平的铅笔字：潮水退去时，灯塔会替死者说话。"]],
  ["被撕去的一页",["盐渍沿着残缺纸页向内蔓延。你逐行核对船名，终于发现父亲失踪的日期旁边留着一道明显的撕痕。","那不是意外破损。有人刻意取走了一整页记录，而负责签字的人正是如今避而不谈的馆长。"]],
  ["来自诊所的消息",["通讯器轻震了一下。林烛发来一张昏暗照片：诊所地下室里摆着一只锈迹斑斑的药柜。","照片边缘露出半枚红色火漆印。它与你父亲最后一封来信上的印记完全相同。"]],
  ["暗门之后",["黄铜钥匙插入档案柜侧面的锁孔。书架后方传来沉闷的机关声，潮湿空气从缝隙中漫出来。","你忽然意识到，馆长不是忘记取走钥匙。他在等待某个人替他打开这扇门。"]],
  ["进入密室",["密室内只有一盏微弱的灯。墙上贴满早已褪色的航线图，每一条线最终都指向雾港外海的同一处坐标。","桌面中央放着一本守夜人手记。它像是专门留给你，也像是一封迟到了二十年的回信。"]]
 ];
 const data=chapters[state.demoStep%chapters.length];
 return `<article class="reader-card"><div class="reader-head"><div><p class="section-kicker">顾言 · 私人阅读章节</p><h3>${data[0]}</h3><p>这段剧情仅对当前角色可见。阅读时不会自动跳转。</p></div><span class="reader-progress">${state.demoStep+1} / ${chapters.length}</span></div>${data[1].map((text,i)=>storyParagraph(text,`剧情 · ${data[0]} · 第 ${i+1} 段`)).join("")}<div class="reader-footer"><p>读完后由你主动进入下一段，系统会记录阅读状态。</p><button class="primary-btn" data-action="read-next">我已读完，继续剧情</button></div></article>`
}
function storyParagraph(text,label){const marked=state.notes.some(n=>n.text===text);return `<p class="story-paragraph ${marked?"marked":""}">${text}<button class="mark-btn" data-action="add-note" data-label="${label}" data-note="${text}">${marked?"已标记":"标记重点"}</button></p>`}
function notebookCard(){const count=state.cloudPlayer?.notes?.length??state.notes.length;return `<article class="notebook-card"><div class="notebook-head"><strong>▤ 随身笔记本</strong><span>${count} 条云端重点</span></div><p>标记剧情片段和关键线索，笔记会保存到当前角色的云端档案。</p><button class="secondary-btn" data-action="notebook">打开笔记本</button></article>`}
function locationRow(icon,title,text,action){return `<div class="location-row"><div class="location-icon">${icon}</div><div><strong>${title}</strong><p>${text}</p></div><button data-action="unavailable" data-feature="场景探索 API">${action} · 演示</button></div>`}
function clue(title,meta){return `<div class="clue-row"><strong>${title}</strong><p>${meta}</p><button class="text-btn" data-action="add-note" data-label="线索" data-note="${title} · ${meta}">＋ 记入笔记</button></div>`}
function archive(){
 return `<article class="card"><div class="section-head"><div><h3>存档时间线</h3><p>当前仅展示设计结构，存档写入与恢复 API 尚未接入</p></div><button class="primary-btn" data-action="unavailable" data-feature="存档快照 API">＋ 创建存档点 · 待接入</button></div>
 ${archiveRow("今天 21:42","第二章 · 档案馆暗门开放","顾言解读航运录，系统开放档案密室。自动存档。","当前进度")}
 ${archiveRow("今天 20:18","第二章 · 抵达雾港","玩家分别前往诊所、码头和档案馆，支线状态初始化。","自动存档")}
 ${archiveRow("5 月 24 日","第一章 · 未归之船完成","全员确认登船名单异常，进入第二章。","章节存档")}
 ${archiveRow("5 月 17 日","序章 · 雾中来信完成","四名玩家完成角色阅读，世界正式开始运行。","章节存档")}
 </article>`;
}
function archiveRow(date,title,text,status){return `<div class="archive-row"><div class="archive-date">${date}</div><div><h3>${title}</h3><p>${text}</p></div><button class="secondary-btn" disabled>${status} · 展示</button></div>`}
function settings(){
 return `<section class="rules-layout"><article class="card"><div class="section-head"><div><h3>基础信息</h3><p>世界的公开信息和运行参数</p></div></div><div class="form-group"><label>世界名称</label><input class="field" value="雾港来信"><label>世界简介</label><input class="field" value="一场发生在海港旧城的长线悬疑调查"><label>默认运行方式</label><select class="field"><option>自动推进为主，主持人确认关键节点</option></select><label>玩家人数</label><input class="field" value="4"><button class="primary-btn" style="margin-top:14px" data-action="unavailable" data-feature="世界设置写入 API">保存设置 · 待接入</button></div></article>
 <aside class="card"><div class="section-head"><div><h3>数据管理</h3><p>以下接口仍在开发队列中</p></div></div><button class="secondary-btn full-btn" data-action="unavailable" data-feature="世界导出 API">导出世界 JSON · 待接入</button><button class="secondary-btn full-btn" data-action="unavailable" data-feature="内容包导入 API">导入内容包 · 待接入</button><button class="secondary-btn full-btn" data-action="unavailable" data-feature="实体卡绑定 API">实体卡绑定接口 · 待接入</button></aside></section>`;
}

function bindDynamic(){
  enhanceCloudPanels();
  document.querySelectorAll("[data-go]").forEach(btn=>btn.onclick=()=>go(btn.dataset.go));
  document.querySelectorAll("[data-rule]").forEach(btn=>btn.onclick=()=>{const i=+btn.dataset.rule; state.rules[i]=!state.rules[i]; render(); showToast(state.rules[i]?"规则已启用":"规则已暂停")});
  document.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
  if(state.view==="studio") bindStudioDragging();
}
function handle(action,el){
  if(action==="save-node"||action==="save-settings") return showToast("配置已保存");
  if(action==="test-rules") return showToast("规则检查完成：未发现冲突");
  if(action==="pause"){state.running=!state.running; render(); return showToast(state.running?"自动推进已恢复":"自动推进已暂停")}
  if(action==="checkpoint") return showToast("已创建新的手动存档点");
  if(action==="delay-event") return showToast("已延迟，系统将在 15 分钟后提醒");
  if(action==="approve-event"){state.logs.unshift(["主持人执行了事件「馆长交付手记」","刚刚","ok"]); render(); return showToast("事件已执行，线索已发放给顾言")}
  if(action==="explore") return openModal("调查进行中",`你开始调查「${el.dataset.place}」。系统将根据角色状态、持有物品和已解读线索展示可发现的内容。`,`确认调查`);
  if(action==="new-asset") return openModal("内容编辑器尚未接入","角色、线索、场景和事件的写入 API 仍在开发。当前可以使用旁边的“上传云端附件”验证真实 R2 存储。","知道了");
  if(action==="new-rule") return openModal("新建自动化规则","使用“当满足条件，则执行动作”的方式配置规则。每个规则都支持自动执行、主持确认和仅手动三种模式。","开始配置");
  if(action==="export") return showToast("世界数据已准备导出");
  if(action==="import") return openModal("导入内容包","支持后续接入 JSON、Markdown 和表格格式。当前版本已保留完整导入入口。","选择文件");
  if(action==="token") return openModal("实体卡绑定接口","已预留二维码与 NFC Token 数据结构。实体卡可绑定线索、道具、角色身份或限定支线。","查看接口");
  if(action==="voice-room") return openVoiceRooms();
  if(action==="voice-room-create") return openCreateVoiceRoom();
  if(action==="join-room") return joinVoiceRoom(el.dataset.roomId,el.dataset.room);
  if(action==="voice-chat-refresh") return refreshVoiceMessages();
  if(action==="voice-chat-send") return sendVoiceMessage();
  if(action==="demo-next") return advanceDemo();
  if(action==="demo-reset") return resetDemo();
  if(action==="read-next") return completeReading();
  if(action==="add-note") return addNote(el.dataset.label,el.dataset.note);
  if(action==="notebook") return openNotebook();
  if(action==="open-wizard") return openWizard();
  if(action==="capabilities") return openCapabilities();
  if(action==="refresh-cloud") return loadCloudData(true);
  if(action==="read-cloud-next") return completeCloudReading(el.dataset.section);
  if(action==="add-cloud-note") return addCloudNote(el.dataset.section,el.dataset.label,el.dataset.note);
  if(action==="add-cloud-clue-note") return addCloudClueNote(el.dataset.clue,el.dataset.label,el.dataset.note);
  if(action==="investigate-cloud") return investigateCloud(el.dataset.point);
  if(action==="read-cloud-clue") return readCloudClue(el.dataset.clue);
  if(action==="execute-host-event") return executeHostEvent(el.dataset.event);
  if(action==="studio-add-chapter") return openStudioChapter();
  if(action==="studio-add-scene") return openStudioScene();
  if(action==="studio-add-clue") return openStudioClue();
  if(action==="studio-add-point") return openStudioPoint();
  if(action==="studio-add-node-menu") return openStudioNodeMenu();
  if(action==="studio-select-node"){state.studioSelectedNode={type:el.dataset.nodeType,id:el.dataset.nodeId};state.studioAnchorEditing=false;render();return}
  if(action==="studio-add-anchor") return addStudioAnchor();
  if(action==="studio-delete-anchor") return deleteStudioAnchor(el.dataset.anchorId);
  if(action==="studio-toggle-anchor-edit"){state.studioAnchorEditing=!state.studioAnchorEditing;render();return}
  if(action==="studio-connect-node") return openStudioConnection();
  if(action==="studio-delete-node") return deleteSelectedStudioNode();
  if(action==="studio-delete-edge") return deleteStudioEdge(el.dataset.edgeId);
  if(action==="studio-filter"){state.studioFilter=el.dataset.filter;render();return}
  if(action==="studio-auto-layout") return autoLayoutStudio();
  if(action==="studio-zoom-out"){state.studioZoom=Math.max(.7,state.studioZoom-.1);render();return}
  if(action==="studio-zoom-in"){state.studioZoom=Math.min(1.3,state.studioZoom+.1);render();return}
  if(action==="creator-add-section") return openCreatorSection(el.dataset.role);
  if(action==="creator-edit-section") return openCreatorSection(el.dataset.role,el.dataset.section);
  if(action==="creator-edit-chapter") return openCreatorChapter(el.dataset.chapter);
  if(action==="creator-check") return runCreatorChecks();
  if(action==="creator-preview") return openCreatorPreview();
  if(action==="creator-collaboration") return openCollaboration();
  if(action==="creator-logs") return openWorldLogs();
  if(action==="creator-document-parser") return openDocumentParser();
  if(action==="account") return openAuth();
  if(action==="world-library") return openWorldLibrary();
  if(action==="world-rooms") return openWorldRooms();
  if(action==="world-select") return selectWorld(el.dataset.worldId);
  if(action==="room-select") return selectParallelRoom(el.dataset.roomId);
  if(action==="room-create") return createParallelRoom();
  if(action==="deepseek-assistant") return openDeepseekAssistant();
  if(action==="story-manuscript") return openStoryManuscript();
  if(action==="story-assistant") return openStoryAssistant();
  if(action==="creator-add-role") return openCreatorRole();
  if(action==="creator-edit-role") return openCreatorRole(el.dataset.role);
  if(action==="creator-export") return exportCreatorPackage();
  if(action==="creator-import") return openCreatorImport();
  if(action==="rule-new") return openRuleEditor();
  if(action==="rule-edit") return openRuleEditor(el.dataset.rule);
  if(action==="rule-delete") return deleteCloudRule(el.dataset.rule);
  if(action==="rule-toggle") return toggleCloudRule(el.dataset.rule);
  if(action==="rule-validate") return validateCloudRules();
  if(action==="creator-snapshot") return createCreatorSnapshot();
  if(action==="creator-restore") return restoreCreatorSnapshot(el.dataset.version);
  if(action==="creator-delete-version") return deleteCreatorSnapshot(el.dataset.version);
  if(action==="delete-asset") return deleteCloudAsset(el.dataset.asset);
  if(action==="upload-asset") return openAssetUpload();
  if(action==="unavailable") return openModal("功能尚未开放",`${el.dataset.feature||"该功能"} 尚未接入真实后端。界面保留用于确认产品结构，当前不会写入数据。`,"知道了");
}
function bindStudioDragging(){
 const board=document.querySelector(".node-board");
 if(board) board.onpointerdown=event=>{
  if(event.target!==board&&event.target.closest(".node"))return;
  const start={x:event.clientX,y:event.clientY,left:board.scrollLeft,top:board.scrollTop};
  board.classList.add("panning");
  const move=moveEvent=>{board.scrollLeft=start.left-(moveEvent.clientX-start.x);board.scrollTop=start.top-(moveEvent.clientY-start.y)};
  const finish=()=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",finish);board.classList.remove("panning")};
  document.addEventListener("pointermove",move);document.addEventListener("pointerup",finish,{once:true});
 };
 document.querySelectorAll(".node").forEach(target=>target.onpointerdown=event=>{
  if(event.target.closest(".node-link-handle"))return;
  event.preventDefault();event.stopPropagation();
  const canvas=target.closest(".graph-canvas"),scale=state.studioZoom;
  const start={x:event.clientX,y:event.clientY,left:target.offsetLeft,top:target.offsetTop};
  target.classList.add("dragging");target.setPointerCapture?.(event.pointerId);
  const move=moveEvent=>{const x=Math.max(16,Math.min(940,start.left+(moveEvent.clientX-start.x)/scale)),y=Math.max(16,Math.min(850,start.top+(moveEvent.clientY-start.y)/scale));target.style.left=`${x}px`;target.style.top=`${y}px`;refreshStudioConnectors(canvas)};
  const finish=async upEvent=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",finish);target.classList.remove("dragging");const x=Math.round(target.offsetLeft),y=Math.round(target.offsetTop),type=target.dataset.nodeType,id=target.dataset.nodeId;setStudioNodePosition(type,id,{x,y});try{await zhimuApi.updateStudioNodePosition(type,id,{x,y});showToast("节点位置已保存到云端")}catch(error){showToast(error.message)}};
  document.addEventListener("pointermove",move);document.addEventListener("pointerup",finish,{once:true});
 });
 document.querySelectorAll(".node-link-handle").forEach(handle=>handle.onpointerdown=event=>{
  event.preventDefault();event.stopPropagation();
  const source=handle.closest(".node"),canvas=source.closest(".graph-canvas"),scale=state.studioZoom;
  if(state.studioAnchorEditing&&state.studioSelectedNode?.type===source.dataset.nodeType&&state.studioSelectedNode?.id===source.dataset.nodeId){
   const start={x:event.clientX,y:event.clientY,left:handle.offsetLeft,top:handle.offsetTop},move=moveEvent=>{const x=Math.max(0,Math.min(156,start.left+(moveEvent.clientX-start.x)/scale)),y=Math.max(0,Math.min(124,start.top+(moveEvent.clientY-start.y)/scale));handle.style.left=`${x}px`;handle.style.top=`${y}px`;refreshStudioConnectors(canvas)},finish=async()=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",finish);const node=studioNodeRecord(state.cloudStudio,source.dataset.nodeType,source.dataset.nodeId),anchors=studioNodeAnchors(node).map(anchor=>anchor.id===handle.dataset.anchorId?{...anchor,x:Math.round(handle.offsetLeft),y:Math.round(handle.offsetTop)}:anchor);setStudioNodeAnchors(source.dataset.nodeType,source.dataset.nodeId,anchors);try{await zhimuApi.updateStudioNodeAnchors(source.dataset.nodeType,source.dataset.nodeId,anchors);showToast("连接点位置已保存")}catch(error){showToast(error.message)}};
   document.addEventListener("pointermove",move);document.addEventListener("pointerup",finish,{once:true});return;
  }
  const start={x:source.offsetLeft+handle.offsetLeft,y:source.offsetTop+handle.offsetTop};
  const preview=document.createElement("i");preview.className="connector relation-extension connector-preview";preview.style.left=`${start.x}px`;preview.style.top=`${start.y}px`;canvas.append(preview);source.classList.add("linking");
  const move=moveEvent=>{const rect=canvas.getBoundingClientRect(),to={x:(moveEvent.clientX-rect.left)/scale,y:(moveEvent.clientY-rect.top)/scale},dx=to.x-start.x,dy=to.y-start.y;preview.style.width=`${Math.sqrt(dx*dx+dy*dy)}px`;preview.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`;document.querySelectorAll(".node.link-target").forEach(node=>node.classList.remove("link-target"));document.elementFromPoint(moveEvent.clientX,moveEvent.clientY)?.closest(".node")?.classList.add("link-target")};
  const finish=upEvent=>{document.removeEventListener("pointermove",move);document.removeEventListener("pointerup",finish);preview.remove();source.classList.remove("linking");const target=document.elementFromPoint(upEvent.clientX,upEvent.clientY)?.closest(".node");document.querySelectorAll(".node.link-target").forEach(node=>node.classList.remove("link-target"));if(target&&target!==source)openStudioDragConnection({type:source.dataset.nodeType,id:source.dataset.nodeId},{type:target.dataset.nodeType,id:target.dataset.nodeId})};
  document.addEventListener("pointermove",move);document.addEventListener("pointerup",finish,{once:true});
 });
}
async function addStudioAnchor(){
 const selected=state.studioSelectedNode;if(!selected)return;
 const node=studioNodeRecord(state.cloudStudio,selected.type,selected.id),anchors=studioNodeAnchors(node);
 if(anchors.length>=8)return showToast("每个节点最多设置 8 个连接点");
 const presets=[{x:78,y:0},{x:0,y:62},{x:78,y:124},{x:156,y:30},{x:156,y:94},{x:30,y:0},{x:126,y:124}],position=presets[anchors.length-1]||{x:156,y:62},next=[...anchors,{id:`anchor-${Date.now()}`,x:position.x,y:position.y}];
 setStudioNodeAnchors(selected.type,selected.id,next);state.studioAnchorEditing=true;render();
 try{await zhimuApi.updateStudioNodeAnchors(selected.type,selected.id,next);showToast("已添加连接点，可直接拖动圆点调整位置")}catch(error){showToast(error.message)}
}
async function deleteStudioAnchor(anchorId){
 const selected=state.studioSelectedNode;if(!selected)return;
 const node=studioNodeRecord(state.cloudStudio,selected.type,selected.id),anchors=studioNodeAnchors(node);
 if(anchors.length<=1)return showToast("每个节点至少保留一个连接点");
 const next=anchors.filter(anchor=>anchor.id!==anchorId);setStudioNodeAnchors(selected.type,selected.id,next);render();
 try{await zhimuApi.updateStudioNodeAnchors(selected.type,selected.id,next);showToast("连接点已删除")}catch(error){showToast(error.message)}
}
function refreshStudioConnectors(canvas){
 const nodes=new Map();
 canvas.querySelectorAll(".node[data-node-type]").forEach(node=>nodes.set(`${node.dataset.nodeType}:${node.dataset.nodeId}`,{node,anchors:[...node.querySelectorAll(".node-link-handle")].map(anchor=>({x:anchor.offsetLeft,y:anchor.offsetTop}))}));
 canvas.querySelectorAll(".connector[data-from]").forEach(edge=>{const from=nodes.get(edge.dataset.from),to=nodes.get(edge.dataset.to);if(!from||!to)return;let pair=null;from.anchors.forEach(startAnchor=>to.anchors.forEach(endAnchor=>{const start={x:from.node.offsetLeft+startAnchor.x,y:from.node.offsetTop+startAnchor.y},end={x:to.node.offsetLeft+endAnchor.x,y:to.node.offsetTop+endAnchor.y},distance=(end.x-start.x)**2+(end.y-start.y)**2;if(!pair||distance<pair.distance)pair={start,end,distance}}));if(!pair)return;const dx=pair.end.x-pair.start.x,dy=pair.end.y-pair.start.y;edge.style.left=`${pair.start.x}px`;edge.style.top=`${pair.start.y}px`;edge.style.width=`${Math.sqrt(dx*dx+dy*dy)}px`;edge.style.transform=`rotate(${Math.atan2(dy,dx)*180/Math.PI}deg)`});
}
async function autoLayoutStudio(){
 const positions=studioNodeList(state.cloudStudio).map(node=>{const point=studioDefaultPositions(state.cloudStudio).get(`${node.type}:${node.id}`);return {type:node.type,id:node.id,...point}});
 positions.forEach(position=>setStudioNodePosition(position.type,position.id,{x:position.x,y:position.y}));
 render();
 try{await zhimuApi.updateStoryLayout(positions);showToast("已按场景、线索和调查点重新整理画布")}catch(error){showToast(error.message)}
}
function openCreatorSection(roleId,sectionId=""){
 const data=state.cloudStudio,sections=data.sections.filter(section=>section.role_slot_id===roleId),section=sections.find(item=>item.id===sectionId);
 modal.className="modal manuscript-editor-modal";modal.innerHTML=`<div class="editor-head"><div><p class="section-kicker">LONGFORM SCRIPT EDITOR</p><h2>${section?"编辑角色分幕":"新增角色分幕"}</h2></div><span class="editor-save-state" data-editor-state>${section?"已加载云端版本":"新分幕尚未写入"}</span></div><div class="editor-grid"><div class="form-group">${studioSelect("所属公共章节","chapterId",[{id:"",name:"暂不绑定章节"},...data.chapters])}${studioField("分幕标题","title","input",section?.title||"")}<label>角色正文 · 支持 Markdown</label><textarea class="field manuscript-body" data-studio-field="body" rows="18">${escapeHtml(section?.body||"")}</textarea>${studioSelect("发布状态","publicationStatus",[{id:"draft",name:"草稿 · 仅创作者可见"},{id:"testing",name:"测试中 · 测试房可见"},{id:"published",name:"已发布 · 正式房可见"}])}</div><aside class="editor-side"><h3>当前分幕工具</h3><div class="editor-stats"><b data-word-count>0</b><span>字符</span></div><label>搜索</label><input class="field" data-editor-search placeholder="输入关键词"><label>替换为</label><input class="field" data-editor-replace placeholder="新的文本"><button class="secondary-btn full-btn" data-editor-replace-btn>全部替换</button><div class="tutorial-tip"><b>自动保存</b><span>${section?"停止输入约 0.9 秒后写入云端。":"新分幕首次需要点击保存，之后可继续自动保存。"}</span></div></aside></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-studio-submit>${section?"保存并关闭":"写入云端"}</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;
 const body=modal.querySelector('[data-studio-field="body"]'),count=modal.querySelector("[data-word-count]"),status=modal.querySelector("[data-editor-state]");let timer;
 modal.querySelector('[data-studio-field="chapterId"]').value=section?.chapter_id||"";modal.querySelector('[data-studio-field="publicationStatus"]').value=section?.publication_status||"draft";
 const refreshCount=()=>count.textContent=String(body.value.length);refreshCount();body.addEventListener("input",()=>{refreshCount();status.textContent="有未保存修改";if(section){clearTimeout(timer);timer=setTimeout(async()=>{try{const values=studioValues();if(!values.chapterId)values.chapterId=null;await zhimuApi.updateSection(roleId,section.id,values);section.title=values.title;section.body=values.body;section.chapter_id=values.chapterId;section.publication_status=values.publicationStatus;status.textContent=`已自动保存 · ${new Date().toLocaleTimeString("zh-CN",{hour:"2-digit",minute:"2-digit"})}`}catch(error){status.textContent=`保存失败 · ${error.message}`}},900)}});modal.querySelector("[data-editor-replace-btn]").onclick=()=>{const from=modal.querySelector("[data-editor-search]").value,to=modal.querySelector("[data-editor-replace]").value;if(!from)return showToast("请先填写搜索关键词");body.value=body.value.split(from).join(to);body.dispatchEvent(new Event("input"));showToast("当前分幕已完成替换")};
 modal.querySelector("[data-studio-submit]").onclick=async()=>{try{const values=studioValues();if(!values.chapterId)values.chapterId=null;if(section)await zhimuApi.updateSection(roleId,section.id,values);else await zhimuApi.createSection(zhimuApi.context.worldId,roleId,{...values,sequence:sections.length+1});closeModal();await loadCloudData();showToast("角色分幕已保存")}catch(error){showToast(error.message)}};
 if(section)modal.querySelector(".modal-actions").insertAdjacentHTML("afterbegin",`<button class="danger-btn" data-delete-section>删除这一幕</button>`),modal.querySelector("[data-delete-section]").onclick=async()=>{try{await zhimuApi.deleteSection(roleId,section.id);closeModal();await loadCloudData();showToast("角色分幕已删除")}catch(error){showToast(error.message)}};
}
function openCreatorRole(roleId=""){
 const data=state.cloudStudio,role=data.roles.find(item=>item.id===roleId);
 studioModal(role?"编辑角色席位":"新增角色席位",studioField("角色名称","name","input",role?.name||"")+studioField("公开身份","publicProfile","textarea",role?.public_profile||"")+studioField("角色秘密","privateProfile","textarea",role?.private_profile||"")+studioField("席位顺序","sequence","input",String(role?.sequence||data.roles.length+1)),role?"保存角色修改":"写入云端",async()=>{try{const values=studioValues(),payload={name:values.name,publicProfile:values.publicProfile,privateProfile:values.privateProfile,sequence:Number(values.sequence)||data.roles.length+1};if(role)await zhimuApi.updateRole(role.id,payload);else await zhimuApi.createRole(zhimuApi.context.worldId,payload);closeModal();await loadCloudData();showToast("角色席位已保存")}catch(error){showToast(error.message)}});
 if(role)modal.querySelector(".modal-actions").insertAdjacentHTML("afterbegin",`<button class="danger-btn" data-delete-role>删除角色</button>`),modal.querySelector("[data-delete-role]").onclick=async()=>{if(data.roles.length<=1)return showToast("至少需要保留一个角色席位");try{await zhimuApi.deleteRole(role.id);closeModal();await loadCloudData();showToast("角色席位及其私人正文已删除")}catch(error){showToast(error.message)}};
}
function openCreatorChapter(chapterId){
 const chapter=state.cloudStudio.chapters.find(item=>item.id===chapterId);
 studioModal("章节发布控制",studioField("章节名称","title","input",chapter.title)+studioField("章节摘要","summary","textarea",chapter.summary||"")+studioSelect("发布阶段","publicationStatus",[{id:"draft",name:"草稿 · 不对玩家开放"},{id:"testing",name:"测试中 · 用于测试房"},{id:"published",name:"已发布 · 可进入正式房"}])+studioSelect("解锁方式","unlockMode",[{id:"host_confirm",name:"主持人确认后开放"},{id:"automatic",name:"满足规则后自动开放"},{id:"manual",name:"仅手动开放"}]),"保存章节设置",async()=>{try{const values=studioValues();await zhimuApi.updateChapter(chapter.id,{title:values.title,summary:values.summary,publicationStatus:values.publicationStatus,unlockRules:{mode:values.unlockMode}});closeModal();await loadCloudData();showToast("章节发布规则已保存")}catch(error){showToast(error.message)}});
 modal.querySelector('[data-studio-field="publicationStatus"]').value=chapter.publication_status;
 modal.querySelector('[data-studio-field="unlockMode"]').value=chapter.unlock_rules?.mode||"host_confirm";
}
async function runCreatorChecks(){try{state.cloudCreatorChecks=(await zhimuApi.getCreatorChecks()).checks;render();showToast("发布检查已完成")}catch(error){showToast(error.message)}}
function escapeHtml(value=""){return String(value).replace(/[&<>"']/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]))}
async function openStoryManuscript(){
 try{
  const manuscript=await zhimuApi.getStoryManuscript();
  modal.className="modal story-manuscript-modal";modal.innerHTML=`<h2>完整剧情母稿</h2><p class="wizard-intro">这是创作者维护的全局剧情文稿，不会替代每位角色的私人剧本。你可以从剧情编排生成一份规范化母稿，也可以把编辑后的母稿拆分成场景、调查点、线索与连接线。</p><div class="assistant-guide"><b>双向同步边界</b><span>“从编排台生成母稿”会覆盖下方文本；“拆分母稿写回编排台”会重建此前由母稿生成的节点，不会删除你手工建立的节点。</span></div><textarea class="field manuscript-draft" rows="20" data-story-manuscript>${escapeHtml(manuscript.body)}</textarea><div class="manuscript-meta" data-manuscript-meta>${storyManuscriptStatus(manuscript)}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="secondary-btn" data-manuscript-save>仅保存母稿</button><button class="secondary-btn" data-manuscript-from-graph>从编排台生成母稿</button><button class="primary-btn" data-manuscript-to-graph>拆分母稿写回编排台</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const body=()=>modal.querySelector("[data-story-manuscript]").value.trim(),meta=modal.querySelector("[data-manuscript-meta]");
  modal.querySelector("[data-manuscript-save]").onclick=async()=>{try{const result=await zhimuApi.saveStoryManuscript(body());meta.innerHTML=storyManuscriptStatus(result);showToast("完整剧情母稿已保存")}catch(error){showToast(error.message)}};
  modal.querySelector("[data-manuscript-from-graph]").onclick=async()=>{try{const result=await zhimuApi.syncStoryManuscriptFromGraph();modal.querySelector("[data-story-manuscript]").value=result.body;meta.innerHTML=storyManuscriptStatus(result);showToast("已经从剧情编排生成完整母稿")}catch(error){showToast(error.message)}};
  modal.querySelector("[data-manuscript-to-graph]").onclick=async()=>{try{const result=await zhimuApi.syncStoryManuscriptToGraph(body());closeModal();await loadCloudData();go("studio");showToast(`母稿已拆分为 ${result.nodes} 个节点和 ${result.edges} 条连线`)}catch(error){showToast(error.message)}};
 }catch(error){showToast(error.message)}
}
function storyManuscriptStatus(manuscript){const label={manual:"手动保存",graph_to_manuscript:"剧情编排 → 完整母稿",manuscript_to_graph:"完整母稿 → 剧情编排"}[manuscript.lastSyncDirection||manuscript.last_sync_direction]||"尚未同步";return `<span>最近同步：${label}</span>${manuscript.updatedAt||manuscript.updated_at?`<span>${formatTime(manuscript.updatedAt||manuscript.updated_at)}</span>`:""}`}
async function openCollaboration(){
 try{
  const members=await zhimuApi.getWorldMembers(),roleName={owner:"主创作者",editor:"协作者",host:"主持人",viewer:"只读观察者"};
  modal.className="modal creator-tool-modal";modal.innerHTML=`<h2>协作权限</h2><p class="wizard-intro">邀请已注册账号加入当前世界。主创可以调整成员权限；主创本人不会被误删或降权。</p><div class="collab-list">${members.map(member=>`<div class="collab-row"><div><b>${escapeHtml(member.display_name)}</b><p>${escapeHtml(member.email||"开发期账号")} · ${roleName[member.role]}</p></div>${member.role==="owner"?`<span class="cloud-pill">OWNER</span>`:`<div class="row"><select class="field compact-field" data-member-role="${member.user_id}">${["editor","host","viewer"].map(role=>`<option value="${role}" ${role===member.role?"selected":""}>${roleName[role]}</option>`).join("")}</select><button class="text-btn danger-text" data-remove-member="${member.user_id}">移除</button></div>`}</div>`).join("")}</div><div class="collab-invite"><h3>邀请协作者</h3><div class="row"><input class="field" data-member-email placeholder="已注册成员邮箱"><select class="field compact-field" data-member-new-role><option value="editor">协作者</option><option value="host">主持人</option><option value="viewer">只读观察者</option></select><button class="primary-btn" data-add-member>加入世界</button></div></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-add-member]").onclick=async()=>{try{await zhimuApi.addWorldMember({email:modal.querySelector("[data-member-email]").value,role:modal.querySelector("[data-member-new-role]").value});closeModal();showToast("协作成员已加入");openCollaboration()}catch(error){showToast(error.message)}};modal.querySelectorAll("[data-member-role]").forEach(select=>select.onchange=async()=>{try{await zhimuApi.updateWorldMember(select.dataset.memberRole,select.value);showToast("成员权限已更新")}catch(error){showToast(error.message)}});modal.querySelectorAll("[data-remove-member]").forEach(button=>button.onclick=async()=>{try{await zhimuApi.deleteWorldMember(button.dataset.removeMember);closeModal();showToast("协作成员已移除");openCollaboration()}catch(error){showToast(error.message)}});
 }catch(error){showToast(error.message)}
}
async function openWorldLogs(){
 try{
  const draw=async()=>{const params={limit:"100"},eventType=modal.querySelector("[data-log-event]")?.value,keyword=modal.querySelector("[data-log-keyword]")?.value;if(eventType)params.eventType=eventType;if(keyword)params.keyword=keyword;const logs=await zhimuApi.getWorldLogs(params);modal.querySelector("[data-log-list]").innerHTML=logs.map(log=>`<div class="log-row"><div><b>${escapeHtml(log.event_type)}</b><span>${escapeHtml(log.room_name)}</span></div><p>${escapeHtml(log.message)}</p><small>${escapeHtml(log.actor_name||"系统")} · ${formatTime(log.created_at)}</small></div>`).join("")||`<div class="empty-state">没有匹配的运行日志。</div>`};
  modal.className="modal creator-tool-modal";modal.innerHTML=`<h2>世界运行日志</h2><p class="wizard-intro">查看玩家阅读、调查、规则触发与主持操作。筛选只影响当前查看，不会修改历史记录。</p><div class="log-toolbar"><select class="field compact-field" data-log-event><option value="">全部事件</option><option value="reading_completed">阅读完成</option><option value="investigation_completed">调查完成</option><option value="scene_unlocked">场景解锁</option></select><input class="field" data-log-keyword placeholder="搜索日志内容"><button class="secondary-btn" data-log-refresh>筛选</button></div><div class="log-list" data-log-list></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-log-refresh]").onclick=draw;await draw();
 }catch(error){showToast(error.message)}
}
async function openDocumentParser(){
 const roles=state.cloudStudio?.roles||[];let parsed=null;
 modal.className="modal creator-tool-modal";modal.innerHTML=`<h2>文档解析与导入</h2><p class="wizard-intro">支持 TXT、Markdown 和 DOCX。系统会先提取正文并按标题拆分，确认后才写入完整剧情母稿或指定角色私人剧本。</p><div class="form-group"><label>选择文档</label><input class="field" type="file" accept=".txt,.md,.markdown,.docx" data-document-file><label>写入目标</label><select class="field" data-document-target><option value="manuscript">完整剧情母稿</option>${roles.map(role=>`<option value="${role.id}">角色私人剧本 · ${escapeHtml(role.name)}</option>`).join("")}</select></div><div data-document-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-document-parse>解析预览</button><button class="primary-btn" data-document-import disabled>确认导入</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const commit=modal.querySelector("[data-document-import]");modal.querySelector("[data-document-parse]").onclick=async()=>{const file=modal.querySelector("[data-document-file]").files[0];if(!file)return showToast("请先选择文档");try{parsed=await zhimuApi.parseDocument({filename:file.name,contentBase64:await fileToBase64(file)});modal.querySelector("[data-document-preview]").innerHTML=`<section class="document-preview"><b>${escapeHtml(parsed.filename)}</b><p>${parsed.characterCount} 字符 · ${parsed.sectionCount} 个分段</p>${parsed.sections.slice(0,8).map(section=>`<article><strong>${escapeHtml(section.title)}</strong><span>${escapeHtml(section.body.slice(0,120))}${section.body.length>120?"...":""}</span></article>`).join("")}</section>`;commit.disabled=false;showToast("文档解析完成，请复核分段")}catch(error){showToast(error.message)}};commit.onclick=async()=>{if(!parsed)return;try{const target=modal.querySelector("[data-document-target]").value;await zhimuApi.importParsedDocument({target:target==="manuscript"?"manuscript":"role_script",roleSlotId:target==="manuscript"?null:target,document:parsed});closeModal();await loadCloudData();showToast("文档内容已写入云端")}catch(error){showToast(error.message)}};
}
function fileToBase64(file){return new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result).split(",")[1]);reader.onerror=reject;reader.readAsDataURL(file)})}
function openAuth(){
 const loggedIn=Boolean(localStorage.getItem("zhimuSessionToken"));modal.className="modal auth-modal";modal.innerHTML=loggedIn?`<h2>账号与会话</h2><p class="wizard-intro">当前浏览器已经保存正式登录会话。退出后仍可继续查看演示世界，但账号专属世界需要重新登录。</p><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="danger-btn" data-auth-logout>退出登录</button></div>`:`<h2>注册或登录</h2><p class="wizard-intro">建立创作者账号后，可以被邀请为协作者、保存自己的世界，并逐步接入正式多人协作。</p><div class="auth-grid"><div class="form-group"><h3>注册</h3>${studioField("昵称","registerName","input","")}${studioField("邮箱","registerEmail","input","")}${studioField("密码 · 至少 8 位","registerPassword","input","")}<button class="primary-btn" data-auth-register>创建账号</button></div><div class="form-group"><h3>登录</h3>${studioField("邮箱","loginEmail","input","")}${studioField("密码","loginPassword","input","")}<button class="secondary-btn" data-auth-login>登录</button></div></div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;if(!loggedIn)modal.querySelectorAll('[data-studio-field$="Password"]').forEach(input=>input.type="password");if(loggedIn)modal.querySelector("[data-auth-logout]").onclick=async()=>{await zhimuApi.logout();localStorage.removeItem("zhimuSessionToken");closeModal();showToast("已退出登录")};else{modal.querySelector("[data-auth-register]").onclick=async()=>{try{const result=await zhimuApi.register({displayName:modal.querySelector('[data-studio-field="registerName"]').value,email:modal.querySelector('[data-studio-field="registerEmail"]').value,password:modal.querySelector('[data-studio-field="registerPassword"]').value});localStorage.setItem("zhimuSessionToken",result.token);closeModal();showToast("注册成功，已经登录")}catch(error){showToast(error.message)}};modal.querySelector("[data-auth-login]").onclick=async()=>{try{const result=await zhimuApi.login({email:modal.querySelector('[data-studio-field="loginEmail"]').value,password:modal.querySelector('[data-studio-field="loginPassword"]').value});localStorage.setItem("zhimuSessionToken",result.token);closeModal();showToast("登录成功")}catch(error){showToast(error.message)}}}
}
async function openWorldLibrary(){
 try{
  const worlds=await zhimuApi.getWorlds(),roomSets=await Promise.all(worlds.map(world=>zhimuApi.getWorldRooms(world.id).catch(()=>[])));state.cloudWorlds=worlds;
  modal.className="modal world-library-modal";modal.innerHTML=`<h2>选择已有剧本</h2><p class="wizard-intro">剧本是可复用的创作模板。同一个剧本可以开放多个互不共享进度、日志和玩家的平行房。</p><div class="world-library-list">${worlds.map((world,index)=>`<article class="world-library-card ${world.id===zhimuApi.context.worldId?"active":""}"><div><span class="cloud-pill">${world.membership_role}</span><h3>${escapeHtml(world.name)}</h3><p>${escapeHtml(world.summary||"尚未补充世界简介")}</p><small>${roomSets[index].length} 个平行房</small></div><button class="${world.id===zhimuApi.context.worldId?"secondary-btn":"primary-btn"}" data-action="world-select" data-world-id="${world.id}">${world.id===zhimuApi.context.worldId?"当前剧本":"切换剧本"}</button></article>`).join("")||`<div class="empty-state">当前账号还没有可访问的剧本。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-open-create-world>＋ 创建新世界</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));modal.querySelector("[data-open-create-world]").onclick=()=>{closeModal();openWizard()};
 }catch(error){showToast(error.message)}
}
async function selectWorld(worldId){
 zhimuApi.selectWorld(worldId);state.cloudStudio=null;state.cloudRules=[];state.cloudCreatorChecks=[];state.cloudHost=[];state.cloudHostEvents=[];state.cloudPlayer=null;state.cloudExploration=null;closeModal();await loadCloudData();showToast("已切换剧本工作区");
}
async function openWorldRooms(){
 try{
  const rooms=await zhimuApi.getWorldRooms(),world=state.cloudStudio?.world;
  modal.className="modal world-library-modal";modal.innerHTML=`<h2>${escapeHtml(world?.name||"当前剧本")} · 平行房</h2><p class="wizard-intro">每个平行房拥有自己的邀请码、玩家成员、阅读进度、日志、规则执行记录和语音空间。房间之间不会互相推进。</p><div class="parallel-room-create"><input class="field" data-room-name placeholder="例如：周末测试组 A"><button class="primary-btn" data-action="room-create">＋ 开放新平行房</button></div><div class="parallel-room-list">${rooms.map(room=>`<article class="parallel-room-row ${room.id===zhimuApi.context.roomId?"active":""}"><div><h3>${escapeHtml(room.name)}</h3><p>邀请码：${escapeHtml(room.invite_code)} · ${room.member_count} 名成员 · ${escapeHtml(room.status)}</p></div><button class="${room.id===zhimuApi.context.roomId?"secondary-btn":"primary-btn"}" data-action="room-select" data-room-id="${room.id}">${room.id===zhimuApi.context.roomId?"当前房间":"进入房间"}</button></article>`).join("")||`<div class="empty-state">尚未开放平行房。创建后会生成独立邀请码和公共讨论房。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
 }catch(error){showToast(error.message)}
}
async function createParallelRoom(){
 const input=modal.querySelector("[data-room-name]"),name=input.value.trim();if(!name)return showToast("请填写平行房名称");
 try{const room=await zhimuApi.createRoom(zhimuApi.context.worldId,{name,inviteCode:`ROOM-${Date.now().toString(36).toUpperCase()}`});zhimuApi.selectRoom(room.id);closeModal();await loadCloudData();showToast(`平行房已开放：${room.invite_code}`);openWorldRooms()}catch(error){showToast(error.message)}
}
async function selectParallelRoom(roomId){
 zhimuApi.selectRoom(roomId);closeModal();await loadCloudData();showToast("已切换到独立平行房");
}
async function openDeepseekAssistant(){
 try{
  const [status,manuscript]=await Promise.all([zhimuApi.getDeepseekStatus(),zhimuApi.getStoryManuscript()]);
  modal.className="modal deepseek-modal";modal.innerHTML=`<h2>AI 剧情策划 · DeepSeek</h2><p class="wizard-intro">让 AI 先提出章节、场景、调查点、线索和连接线框架。提案不会自动修改正式剧情，只有你确认后才会追加到剧情编排台。</p><div class="deepseek-status ${status.configured?"ready":"missing"}"><b>${status.configured?"DeepSeek 已连接":"DeepSeek 尚未配置"}</b><span>${status.configured?`当前模型：${escapeHtml(status.model)}`:"请在 backend/.env 中填写 DEEPSEEK_API_KEY，保存后重启后端。"}</span></div><div class="deepseek-grid"><div class="form-group">${studioField("剧本名称","aiTitle","input",state.cloudStudio?.world?.name||"")} ${studioField("一句话构想","aiPremise","textarea",state.cloudStudio?.world?.summary||"")} ${studioField("风格与氛围","aiStyle","input","悬疑调查，信息逐层揭示，适合线上长线剧本杀")} ${studioField("额外限制与灵感方向","aiRequirements","textarea","不要使用跑团数值。线索应能通过调查点获得，并形成可调整的主线与支线。")}</div><aside class="deepseek-controls"><h3>结构与字数要求</h3>${studioField("建议完整剧情总字数","aiTargetWordCount","input","5000")}${studioField("章节数量","aiChapterCount","input","4")}${studioField("场景数量","aiSceneCount","input","8")}${studioField("调查点数量","aiPointCount","input","10")}${studioField("线索数量","aiClueCount","input","10")}<label class="check-label"><input type="checkbox" data-ai-reference checked> 参考当前完整剧情母稿</label></aside></div><div data-deepseek-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-ai-generate ${status.configured?"":"disabled"}>生成结构提案</button><button class="primary-btn" data-ai-import disabled>确认追加到剧情编排</button></div>`;
  modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;let proposal=null;const preview=modal.querySelector("[data-deepseek-preview]"),generate=modal.querySelector("[data-ai-generate]"),commit=modal.querySelector("[data-ai-import]");
  generate.onclick=async()=>{try{generate.disabled=true;generate.textContent="正在生成提案...";const values=studioValues();const result=await zhimuApi.proposeWithDeepseek({title:values.aiTitle,premise:values.aiPremise,style:values.aiStyle,requirements:values.aiRequirements,targetWordCount:Number(values.aiTargetWordCount),chapterCount:Number(values.aiChapterCount),sceneCount:Number(values.aiSceneCount),investigationPointCount:Number(values.aiPointCount),clueCount:Number(values.aiClueCount),existingManuscript:modal.querySelector("[data-ai-reference]").checked?manuscript.body:""});proposal=result.proposal;preview.innerHTML=deepseekProposalPreview(result);commit.disabled=false;showToast("DeepSeek 结构提案已生成，请先复核")}catch(error){showToast(error.message)}finally{generate.disabled=!status.configured;generate.textContent="重新生成提案"}};
  commit.onclick=async()=>{if(!proposal)return;try{commit.disabled=true;const result=await zhimuApi.importDeepseekProposal(proposal);closeModal();await loadCloudData();go("studio");showToast(`AI 提案已追加：${result.chapters} 章、${result.scenes} 个场景、${result.edges} 条连线`)}catch(error){commit.disabled=false;showToast(error.message)}};
 }catch(error){showToast(error.message)}
}
function deepseekProposalPreview(result){const proposal=result.proposal,plan=proposal.writingPlan||{};return `<section class="assistant-preview deepseek-preview"><div class="section-head"><div><p class="section-kicker">${escapeHtml(result.model)}</p><h3>${escapeHtml(proposal.title||"未命名提案")}</h3><p>${escapeHtml(proposal.logline||"")}</p></div><span class="cloud-pill">仅预览 · 尚未写入</span></div><div class="proposal-stats"><span>${proposal.chapters.length} 章</span><span>${proposal.scenes.length} 场景</span><span>${proposal.investigationPoints.length} 调查点</span><span>${proposal.clues.length} 线索</span><span>${proposal.edges.length} 连线</span><span>${Number(plan.targetWordCount||result.brief.targetWordCount)} 字建议</span></div><div class="proposal-chapters">${proposal.chapters.map(chapter=>`<article><b>${chapter.sequence}. ${escapeHtml(chapter.title)}</b><p>${escapeHtml(chapter.summary||"")}</p><small>建议字数：${Number((plan.chapterWordBudgets||[]).find(item=>item.chapterKey===chapter.key)?.targetWordCount||0)} 字</small></article>`).join("")}</div><div class="assistant-suggestions"><b>AI 写作建议</b>${proposal.suggestions.map(item=>`<p>· ${escapeHtml(item)}</p>`).join("")}</div></section>`}
function openStoryAssistant(){
 modal.className="modal story-assistant-modal";modal.innerHTML=`<h2>剧情助手</h2><p class="wizard-intro">粘贴剧情梗概或逐段素材。系统会先识别场景、线索和调查点，再生成建议连线。确认后才会写入剧情编排。</p><div class="assistant-guide"><b>推荐格式</b><span>每段用空行分隔。也可以使用“场景：”“线索：”“调查点：”开头提高识别准确度。</span></div><textarea class="field assistant-draft" rows="14" data-story-draft placeholder="场景：旧灯塔。潮水退去后，塔门露出一枚生锈的锁。&#10;&#10;调查点：检查塔门锁孔，发现内部残留蓝色蜡屑。&#10;&#10;线索：蓝色火漆碎片。它与匿名信上的封蜡一致。"></textarea><div data-assistant-preview></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="secondary-btn" data-assistant-analyze>分析分类</button><button class="primary-btn" data-assistant-import disabled>确认写入剧情编排</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const text=()=>modal.querySelector("[data-story-draft]").value.trim(),preview=modal.querySelector("[data-assistant-preview]"),commit=modal.querySelector("[data-assistant-import]");
 modal.querySelector("[data-assistant-analyze]").onclick=async()=>{try{const result=await zhimuApi.analyzeStoryDraft(text());preview.innerHTML=storyAssistantPreview(result);commit.disabled=!result.nodes.length;showToast(`已识别 ${result.nodes.length} 个剧情节点`)}catch(error){showToast(error.message)}};
 commit.onclick=async()=>{try{commit.disabled=true;const result=await zhimuApi.importStoryDraft(text());closeModal();await loadCloudData();go("studio");showToast(`已生成 ${result.nodes.length} 个节点和 ${result.edges.length} 条连线`)}catch(error){commit.disabled=false;showToast(error.message)}};
}
function storyAssistantPreview(result){const typeName={scene:"场景",clue:"线索",investigation_point:"调查点"};return `<section class="assistant-preview"><div class="section-head"><div><h3>分类预览</h3><p>${result.nodes.length} 个节点 · ${result.edges.length} 条建议连线</p></div></div><div class="assistant-node-grid">${result.nodes.map(node=>`<article><span>${typeName[node.type]}</span><b>${escapeHtml(node.name)}</b><p>${escapeHtml(node.text)}</p></article>`).join("")}</div><div class="assistant-suggestions"><b>写作建议</b>${result.suggestions.map(item=>`<p>· ${escapeHtml(item)}</p>`).join("")}</div></section>`}
function rulePayload(rule={}){return {roomId:rule.room_id||"",name:rule.name||"",mode:rule.mode||"automatic",priority:String(rule.priority??100),enabled:rule.enabled!==false,conditions:JSON.stringify(rule.conditions||{all:[{type:"investigation_completed",investigationPointId:""}]},null,2),actions:JSON.stringify(rule.actions||[{type:"timeline_log",message:"记录新的剧情推进"}],null,2)}}
function openRuleEditor(ruleId=""){
 const rule=state.cloudRules.find(item=>item.id===ruleId),value=rulePayload(rule),rooms=state.cloudStudio?.rooms||[];
 modal.className="modal rule-editor-modal";modal.innerHTML=`<h2>${rule?"编辑自动化规则":"新建自动化规则"}</h2><p class="wizard-intro">规则使用结构化 JSON。条件放在 all 数组中，动作按顺序执行。可先使用默认模板，再替换节点 ID。</p><div class="form-group">${studioField("规则名称","name","input",value.name)}${studioSelect("绑定范围","roomId",[{id:"",name:"世界模板 · 可复用于新房间"},...rooms])}${studioSelect("执行方式","mode",[{id:"automatic",name:"自动执行"},{id:"host_confirm",name:"主持人确认"},{id:"manual",name:"仅手动"}])}${studioField("优先级","priority","input",value.priority)}<label class="check-label"><input type="checkbox" data-rule-enabled ${value.enabled?"checked":""}> 启用规则</label>${studioField("检测条件 JSON","conditions","textarea",value.conditions)}${studioField("执行动作 JSON","actions","textarea",value.actions)}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-rule-submit>写入云端</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector('[data-studio-field="roomId"]').value=value.roomId;modal.querySelector('[data-studio-field="mode"]').value=value.mode;
 modal.querySelector("[data-rule-submit]").onclick=async()=>{try{const values=studioValues(),payload={roomId:values.roomId||null,name:values.name,mode:values.mode,priority:Number(values.priority)||100,enabled:modal.querySelector("[data-rule-enabled]").checked,conditions:JSON.parse(values.conditions),actions:JSON.parse(values.actions)};if(rule)await zhimuApi.updateRule(rule.id,payload);else await zhimuApi.createRule(payload);closeModal();await loadCloudData();showToast("自动化规则已写入云端")}catch(error){showToast(`规则保存失败：${error.message}`)}};
}
async function toggleCloudRule(ruleId){const rule=state.cloudRules.find(item=>item.id===ruleId);if(!rule)return;try{await zhimuApi.updateRule(rule.id,{roomId:rule.room_id,name:rule.name,mode:rule.mode,priority:rule.priority,enabled:!rule.enabled,conditions:rule.conditions,actions:rule.actions});await loadCloudData();showToast(rule.enabled?"规则已暂停":"规则已启用")}catch(error){showToast(error.message)}}
async function deleteCloudRule(ruleId){try{await zhimuApi.deleteRule(ruleId);await loadCloudData();showToast("规则已删除")}catch(error){showToast(error.message)}}
async function validateCloudRules(){try{const result=await zhimuApi.validateRules();openModal("规则检查完成",result.checks.length?result.checks.map(check=>`<b>${escapeHtml(check.title)}</b><br><span>${escapeHtml(check.detail)}</span>`).join("<br><br>"):`已检查 ${result.totalRules} 条规则，没有发现结构问题。`,"知道了")}catch(error){showToast(error.message)}}
function openCreatorPreview(){
 const data=state.cloudStudio,roles=data.roles;if(!roles.length)return showToast("请先创建角色");
 modal.className="modal preview-modal";modal.innerHTML=`<h2>玩家视角模拟器</h2><p class="wizard-intro">切换角色和章节，核对玩家能读到的私人文本。草稿、测试中和已发布状态会明确标记。</p><div class="preview-controls">${studioSelect("模拟角色","previewRole",roles)}${studioSelect("公共章节","previewChapter",[{id:"",name:"全部章节"},...data.chapters])}</div><div data-preview-body></div><div class="modal-actions"><button class="primary-btn" data-close>结束模拟</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;const draw=()=>{const roleId=modal.querySelector('[data-studio-field="previewRole"]').value,chapterId=modal.querySelector('[data-studio-field="previewChapter"]').value,role=roles.find(item=>item.id===roleId),sections=data.sections.filter(section=>section.role_slot_id===roleId&&(!chapterId||section.chapter_id===chapterId));modal.querySelector("[data-preview-body]").innerHTML=`<article class="preview-role-card"><p class="section-kicker">仅此角色可见</p><h3>${escapeHtml(role.name)}</h3><p>${escapeHtml(role.private_profile||"尚未补充角色秘密")}</p></article>${sections.map(section=>`<article class="preview-section"><span class="status-chip ${section.publication_status}">${section.publication_status}</span><h3>${escapeHtml(section.title)}</h3><div>${escapeHtml(section.body).replace(/\n/g,"<br>")}</div></article>`).join("")||`<div class="empty-state">该筛选条件下没有私人剧情。</div>`}`};modal.querySelectorAll("select").forEach(select=>select.onchange=draw);draw();
}
async function exportCreatorPackage(){try{const payload=await zhimuApi.exportContentPackage(),url=URL.createObjectURL(new Blob([JSON.stringify(payload,null,2)],{type:"application/json"})),link=document.createElement("a");link.href=url;link.download=`${state.cloudStudio.world.name}-zhimu-backup.json`;link.click();URL.revokeObjectURL(url);showToast("内容包已导出")}catch(error){showToast(error.message)}}
function openCreatorImport(){
 const roles=state.cloudStudio?.roles||[];modal.className="modal";modal.innerHTML=`<h2>导入创作内容</h2><p class="wizard-intro">JSON 内容包会追加到当前世界；Markdown 或 TXT 会写入指定角色的新分幕。现有内容不会被覆盖。</p><div class="form-group">${roles.length?studioSelect("文档写入角色","importRole",roles):""}<label>选择文件</label><input class="field" type="file" accept=".json,.md,.txt" data-creator-import-file></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-import-submit>开始导入</button></div>`;modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-import-submit]").onclick=importCreatorPackage;
}
async function importCreatorPackage(){const file=modal.querySelector("[data-creator-import-file]").files[0];if(!file)return showToast("请选择导入文件");try{if(/\.json$/i.test(file.name)){await zhimuApi.importContentPackage(JSON.parse(await file.text()))}else{const roleId=modal.querySelector('[data-studio-field="importRole"]')?.value;if(!roleId)throw new Error("请先创建角色席位");const sections=state.cloudStudio.sections.filter(section=>section.role_slot_id===roleId);await zhimuApi.createSection(zhimuApi.context.worldId,roleId,{title:file.name.replace(/\.(md|txt)$/i,""),body:await file.text(),sequence:sections.length+1,publicationStatus:"draft"})}closeModal();await loadCloudData();showToast("内容导入完成")}catch(error){showToast(`导入失败：${error.message}`)}}
function createCreatorSnapshot(){studioModal("保存创作版本",studioField("版本名称","label","input",`创作快照 ${new Date().toLocaleString("zh-CN")}`),"保存快照",async()=>{try{await zhimuApi.createContentVersion(studioValues());closeModal();await loadCloudData();showToast("创作版本已保存")}catch(error){showToast(error.message)}})}
async function restoreCreatorSnapshot(versionId){try{await zhimuApi.restoreContentVersion(versionId);await loadCloudData();showToast("已恢复该版本的正文与发布状态")}catch(error){showToast(error.message)}}
async function deleteCreatorSnapshot(versionId){try{await zhimuApi.deleteContentVersion(versionId);await loadCloudData();showToast("创作版本记录已删除")}catch(error){showToast(error.message)}}
async function deleteCloudAsset(assetId){try{await zhimuApi.deleteAsset(assetId);await loadCloudData();showToast("附件已移入 14 天回收站")}catch(error){showToast(error.message)}}
function studioModal(title,fields,confirm,submit){
 modal.className="modal";modal.innerHTML=`<h2>${title}</h2><div class="form-group">${fields}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-studio-submit>${confirm}</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-studio-submit]").onclick=submit;
}
function studioField(label,key,type="input",value=""){return `<label>${label}</label>${type==="textarea"?`<textarea class="field" data-studio-field="${key}" rows="4">${value}</textarea>`:`<input class="field" data-studio-field="${key}" value="${value}">`}`}
function studioValues(){return Object.fromEntries(Array.from(modal.querySelectorAll("[data-studio-field]")).map(input=>[input.dataset.studioField,input.value.trim()]))}
function studioSelect(label,key,options){return `<label>${label}</label><select class="field" data-studio-field="${key}">${options.map(option=>`<option value="${option.id}">${option.name||option.title}</option>`).join("")}</select>`}
function openStudioChapter(){
 studioModal("新增公共章节",studioField("章节名称","title")+studioField("章节摘要","summary","textarea"),"写入云端",async()=>{try{const values=studioValues();await zhimuApi.createStudioChapter({...values,sequence:(state.cloudStudio?.chapters.length||0)+1});closeModal();await loadCloudData();showToast("公共章节已写入剧情线")}catch(error){showToast(error.message)}});
}
function openStudioNodeMenu(){
 modal.className="modal";modal.innerHTML=`<h2>在画布中新增节点</h2><p>先选择节点类型，再填写内容。新增后节点会直接进入当前剧情画布。</p><div class="node-type-grid"><button data-node-create="scene"><b>场景节点</b><span>公开地点、房间或可进入区域</span></button><button data-node-create="clue"><b>线索节点</b><span>玩家获得后可阅读的证据</span></button><button data-node-create="point"><b>调查点节点</b><span>场景内可点击搜证的位置</span></button><button data-node-create="chapter"><b>章节</b><span>公共剧情阶段与发布单位</span></button></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll("[data-node-create]").forEach(button=>button.onclick=()=>{closeModal();({scene:openStudioScene,clue:openStudioClue,point:openStudioPoint,chapter:openStudioChapter})[button.dataset.nodeCreate]()});
}
function openStudioScene(){
 const chapters=state.cloudStudio?.chapters||[];
 studioModal("新增公共场景",(chapters.length?studioSelect("所属章节","chapterId",chapters):"")+studioField("场景名称","name")+studioField("玩家可见说明","publicText","textarea")+studioField("主持人备注","hostText","textarea"),"写入云端",async()=>{try{await zhimuApi.createScene(studioValues());closeModal();await loadCloudData();showToast("公共场景已加入剧情线")}catch(error){showToast(error.message)}});
}
function openStudioClue(){
 studioModal("新增剧本杀线索",studioField("线索名称","name")+studioField("获得后可见内容","publicText","textarea")+studioField("主持人解释","hostText","textarea"),"写入云端",async()=>{try{await zhimuApi.createClue({...studioValues(),visibility:"role"});closeModal();await loadCloudData();showToast("线索已加入剧情线")}catch(error){showToast(error.message)}});
}
function openStudioPoint(){
 const scenes=state.cloudStudio?.scenes||[], clues=state.cloudStudio?.clues||[];
 if(!scenes.length)return showToast("请先创建一个公共场景");
 studioModal("新增场景调查点",studioSelect("所属场景","sceneId",scenes)+studioField("调查点名称","name")+studioField("玩家看到的描述","description","textarea")+studioField("调查结果","resultText","textarea")+(clues.length?studioSelect("发现线索","clueId",[{id:"",name:"不发放线索"},...clues]):""),"写入云端",async()=>{try{const values=studioValues();const sceneId=values.sceneId;delete values.sceneId;if(!values.clueId)delete values.clueId;await zhimuApi.createInvestigationPoint(sceneId,values);closeModal();await loadCloudData();showToast("调查点已加入公共场景")}catch(error){showToast(error.message)}});
}
function openStudioConnection(){
 const selected=state.studioSelectedNode,nodes=studioNodeList(state.cloudStudio).filter(node=>!(node.type===selected.type&&node.id===selected.id));
 if(!nodes.length)return showToast("请先创建另一个场景、线索或调查点");
 studioModal("创建剧情连线",studioSelect("目标节点","target",nodes.map(node=>({id:`${node.type}:${node.id}`,name:node.name})))+studioSelect("关系类型","relationType",[{id:"mainline",name:"主线 · 核心推进路径"},{id:"parallel",name:"并列 · 同阶段可同时发生"},{id:"extension",name:"延伸 · 支线或后续补充"}])+studioField("连线备注","label"),"写入云端",async()=>{try{const values=studioValues(),[toType,toId]=values.target.split(":");await zhimuApi.createStoryEdge({fromType:selected.type,fromId:selected.id,toType,toId,relationType:values.relationType,label:values.label});closeModal();await loadCloudData();showToast("剧情连线已写入云端")}catch(error){showToast(error.message)}});
}
function openStudioDragConnection(from,to){
 studioModal("确认拖拽连线",`<div class="rule-block">${studioNodeName(state.cloudStudio,from.type,from.id)} → ${studioNodeName(state.cloudStudio,to.type,to.id)}</div>`+studioSelect("关系类型","relationType",[{id:"mainline",name:"主线 · 核心推进路径"},{id:"parallel",name:"并列 · 同阶段可同时发生"},{id:"extension",name:"延伸 · 支线或后续补充"}])+studioField("连线备注","label"),"写入云端",async()=>{try{const values=studioValues();await zhimuApi.createStoryEdge({fromType:from.type,fromId:from.id,toType:to.type,toId:to.id,relationType:values.relationType,label:values.label});closeModal();await loadCloudData();showToast("拖拽连线已写入云端")}catch(error){showToast(error.message)}});
}
async function deleteSelectedStudioNode(){
 const selected=state.studioSelectedNode;if(!selected)return;
 try{await zhimuApi.deleteStudioNode(selected.type,selected.id);state.studioSelectedNode=null;await loadCloudData();showToast("节点及相关连线已删除")}catch(error){showToast(error.message)}
}
async function deleteStudioEdge(edgeId){
 try{await zhimuApi.deleteStoryEdge(edgeId);await loadCloudData();showToast("剧情连线已删除")}catch(error){showToast(error.message)}
}
function enhanceCloudPanels(){
  if(state.view==="player"&&state.cloudExploration){
    const explorationCard=document.querySelector(".player-layout > div > .card");
    if(explorationCard){
      explorationCard.querySelectorAll(".location-row").forEach(row=>row.remove());
      explorationCard.insertAdjacentHTML("beforeend",explorationRows());
    }
    const clueCard=document.querySelector(".player-layout aside .card:last-child");
    if(clueCard) clueCard.innerHTML=`<div class="section-head"><div><h3>我的云端线索</h3><p>调查结果只对当前角色可见</p></div></div>${cloudClueRows()}`;
  }
  if(state.view==="director"){
    const eventCard=document.querySelector(".director-grid aside .card:first-child");
    if(eventCard) eventCard.innerHTML=`<div class="section-head"><div><h3>等待确认</h3><p>由真实规则引擎生成，确认后立即写入房间状态</p></div></div>${hostEventRows()}`;
  }
}
function explorationRows(){
 const scenes=state.cloudExploration?.scenes||[];
 if(!scenes.length)return `<div class="tutorial-tip"><b>暂无开放场景</b><span>请由主持人在运行台开放一个探索场景。</span></div>`;
 return scenes.map(scene=>`<div class="tutorial-tip"><b>${scene.name}</b><span>${scene.public_text}</span></div>${(scene.investigation_points||[]).map(point=>`<div class="location-row"><div class="location-icon">⌕</div><div><strong>${point.name}</strong><p>${point.description}</p></div><button class="${point.investigated?"secondary-btn":"primary-btn"}" data-action="investigate-cloud" data-point="${point.id}" ${point.investigated?"disabled":""}>${point.investigated?"已调查":"调查"}</button></div>`).join("")}`).join("");
}
function cloudClueRows(){
 const clues=state.cloudPlayer?.clues||[];
 if(!clues.length)return `<div class="tutorial-tip"><b>尚无线索</b><span>调查场景中的可交互位置，发现内容后会自动进入个人线索库。</span></div>`;
 return clues.map(item=>`<div class="clue-row"><strong>${item.name}</strong><p>${item.public_text}</p><div class="row"><button class="text-btn" data-action="read-cloud-clue" data-clue="${item.id}" ${item.read_at?"disabled":""}>${item.read_at?"已阅读":"标记为已阅读"}</button><button class="text-btn" data-action="add-cloud-clue-note" data-clue="${item.id}" data-label="线索 · ${item.name}" data-note="${item.public_text}">＋ 记入云端笔记</button></div></div>`).join("");
}
function hostEventRows(){
 const events=state.cloudHostEvents||[];
 if(!events.length)return `<div class="tutorial-tip"><b>当前无需人工介入</b><span>普通动作由系统自动执行，关键转折会进入这里等待主持人判断。</span></div>`;
 return events.map(event=>`<div class="event-ready"><h3>${event.title}</h3><p>${event.description}</p><div class="event-actions"><button class="primary-btn" data-action="execute-host-event" data-event="${event.id}">确认并执行</button></div></div>`).join("");
}
function openModal(title,text,confirm){
 modal.className="modal";
 modal.innerHTML=`<h2>${title}</h2><p>${text}</p><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-close>${confirm}</button></div>`;
 modalBackdrop.classList.add("show"); modal.querySelectorAll("[data-close]").forEach(b=>b.onclick=closeModal);
}
function openVoiceRooms(){
 const rooms=state.cloudPlayer?.voiceRooms||[];
 modal.className="modal"; modal.innerHTML=`<h2>选择语音空间</h2><p>公共讨论与私密房相互隔离。房内文字消息也只对有权限的成员开放。</p><div class="voice-modal-list">
 ${rooms.map(room=>voiceOption(room.room_type==="public"?"♬":"♙",room.name,room.room_type==="public"?"全体房间成员均可加入":"仅受邀玩家可见",room.id,room.room_type)).join("")||`<div class="empty-state">当前没有可加入的语音房。</div>`}
 </div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button><button class="primary-btn" data-action="voice-room-create">＋ 创建临时密谈</button></div>`;
 modalBackdrop.classList.add("show"); modal.querySelector("[data-close]").onclick=closeModal; modal.querySelectorAll("[data-action]").forEach(btn=>btn.onclick=()=>handle(btn.dataset.action,btn));
}
function openCreateVoiceRoom(){
 const seats=state.cloudPlayer?.roomMembers||[],currentUserId=zhimuApi.context.playerUserId;
 modal.className="modal";modal.innerHTML=`<h2>创建临时密谈</h2><p class="wizard-intro">从全部玩家角色中选择受邀者，可以一次邀请多人。你自己会自动进入密谈，无需重复勾选；尚未进入房间的角色会保留席位提示。</p><div class="form-group">${studioField("房间名称","voiceName","input","临时密谈")}<label>邀请其他玩家角色</label><div class="member-picker">${seats.map(member=>{const self=member.user_id===currentUserId,disabled=self||!member.online;return `<label class="${disabled?"member-disabled":""}"><input type="checkbox" data-voice-invite value="${member.user_id||""}" ${disabled?"disabled":""}> <span><b>${escapeHtml(member.role_name||"未命名角色")}</b>${member.display_name?` · ${escapeHtml(member.display_name)}`:""}${self?" · 当前角色，已自动加入":member.online?" · 可邀请":" · 尚未进入房间"}</span></label>`}).join("")||`<div class="empty-state">当前世界尚未建立玩家角色席位。</div>`}</div></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-create-voice-room>创建并进入</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-create-voice-room]").onclick=async()=>{try{const name=modal.querySelector('[data-studio-field="voiceName"]').value.trim(),inviteUserIds=[...modal.querySelectorAll("[data-voice-invite]:checked")].map(input=>input.value),room=await zhimuApi.createVoiceRoom({name,roomType:"invite_private",inviteUserIds});await loadCloudData();await joinVoiceRoom(room.id,room.name);showToast("临时密谈已创建")}catch(error){showToast(error.message)}};
}
async function joinVoiceRoom(roomId,roomName){state.voiceRoomId=roomId;state.voiceRoom=roomName;closeModal();await refreshVoiceMessages();render();showToast(`已进入${state.voiceRoom}`)}
async function refreshVoiceMessages(){if(!state.voiceRoomId)return;try{state.voiceMessages=await zhimuApi.getVoiceMessages(state.voiceRoomId);render()}catch(error){showToast(error.message)}}
async function sendVoiceMessage(){const input=document.querySelector("[data-voice-chat-input]"),body=input?.value.trim();if(!body)return showToast("请输入聊天内容");try{await zhimuApi.sendVoiceMessage(state.voiceRoomId,body);await refreshVoiceMessages();showToast("消息已发送到当前语音房")}catch(error){showToast(error.message)}}
function addNote(label,text){
 const exists=state.notes.some(note=>note.text===text);
 if(exists){state.notes=state.notes.filter(note=>note.text!==text);render();return showToast("已从随身笔记本移除")}
 state.notes.unshift({label,text});render();showToast("已标记重点，记入随身笔记本");
}
function openNotebook(){
 const notes=state.cloudPlayer?.notes?.map(note=>({label:note.title,text:note.body}))||state.notes;
 modal.className="modal";modal.innerHTML=`<h2>▤ 顾言的随身笔记本</h2><p>这里汇总你主动标记的剧情片段与关键线索。内容已保存到云端，仅当前角色可以查看。</p><div class="note-list">${notes.length?notes.map(note=>`<div class="note-item"><strong>${note.label}</strong><p>${note.text}</p></div>`).join(""):`<div class="tutorial-tip"><b>暂无笔记</b><span>阅读剧情时点击“标记重点”，或在线索下点击“记入笔记”。</span></div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>关闭</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;
}
async function completeCloudReading(sectionId){
 try{await zhimuApi.completeSection(sectionId);await loadCloudData();showToast("云端阅读状态已保存，规则引擎已完成检测")}catch(error){showToast(error.message)}
}
async function addCloudNote(sectionId,label,text){
 try{await zhimuApi.addNotebookEntry({sourceType:"script_section",sourceId:sectionId,title:label,body:text});await loadCloudData();showToast("重点已写入云端随身笔记本")}catch(error){showToast(error.message)}
}
async function addCloudClueNote(clueId,label,text){
 try{await zhimuApi.addNotebookEntry({sourceType:"clue",sourceId:clueId,title:label,body:text});await loadCloudData();showToast("线索已写入云端随身笔记本")}catch(error){showToast(error.message)}
}
async function investigateCloud(pointId){
 try{
  const result=await zhimuApi.investigate(pointId);
  await loadCloudData();
  openModal("调查完成",`${result.resultText}${result.clue?`<br><br><strong>获得线索：${result.clue.name}</strong><br>${result.clue.public_text}`:""}`,"继续探索");
 }catch(error){showToast(error.message)}
}
async function readCloudClue(clueId){
 try{await zhimuApi.readClue(clueId);await loadCloudData();showToast("线索阅读状态已保存到云端")}catch(error){showToast(error.message)}
}
async function executeHostEvent(eventId){
 try{await zhimuApi.executeHostEvent(eventId);await loadCloudData();showToast("关键节点已确认，下一探索场景已经开放")}catch(error){showToast(error.message)}
}
function openAssetUpload(){
 modal.className="modal";modal.innerHTML=`<h2>上传云端附件</h2><p>文件将直接上传至 Cloudflare R2 私有 Bucket。浏览器只会获得短期上传地址，不会接触永久密钥。</p><div class="upload-zone"><strong>选择线索图片、音频、PDF 或 Word 文档</strong><p>图片 ≤ 10 MB，音频 ≤ 30 MB，文档 ≤ 20 MB</p><input type="file" id="cloud-file-input" accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/ogg,audio/wav,application/pdf,.docx"></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" id="cloud-upload-confirm">开始上传</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("#cloud-upload-confirm").onclick=uploadSelectedAsset;
}
async function uploadSelectedAsset(){
 const input=modal.querySelector("#cloud-file-input");const file=input.files[0];if(!file)return showToast("请先选择文件");
 const button=modal.querySelector("#cloud-upload-confirm");button.disabled=true;button.textContent="上传中...";
 try{await zhimuApi.uploadAsset(file);closeModal();await loadCloudData();showToast("附件已安全上传到 R2 云端")}catch(error){button.disabled=false;button.textContent="重新上传";showToast(error.message)}
}
function openCapabilities(){
 modal.className="modal";modal.innerHTML=`<h2>当前版本能力说明</h2><p>第一版已经形成从创作、测试到线上运行的完整产品骨架。以下能力可以在左侧导航或首页直接进入。</p><div class="checklist">
 ${check("创作与 DIY","章节流程图、内容资产、角色席位、权限和五步创建教程")}
 ${check("玩家体验","小说式私人章节、主动阅读推进、场景探索、个人线索和随身笔记本")}
 ${check("线上协作","公共讨论房、角色私密房、临时受邀密谈的交互入口")}
 ${check("自动化","阅读、调查、线索、物品和主持确认共同构成状态规则")}
 ${check("主持运行","玩家状态、阅读进度、实时日志、卡关预警、待确认事件和存档")}
 ${check("后续接口","实体卡二维码、NFC Token 与 LiveKit 实时语音入口")}
 </div><div class="tutorial-tip"><b>当前边界</b><span>账号注册、云数据库、协作权限、运行日志、文档解析和 R2 文件上传已经接入后端。后续仍需补充邮箱验证、多人 WebSocket 同步、LiveKit 语音流和上传安全扫描。</span></div><div class="modal-actions"><button class="primary-btn" data-close>知道了</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;
}
function completeReading(){
 const current=state.demoStep;advanceDemo();state.logs.unshift([`顾言已读完私人剧情第 ${current+1} 段，系统完成阅读状态记录`,"刚刚","ok"]);state.logs=state.logs.slice(0,5);render();showToast("阅读状态已记录，下一段剧情已解锁");
}
function voiceOption(icon,title,text,roomId,cls){return `<div class="voice-option ${cls}"><i>${icon}</i><div><strong>${title}</strong><p>${text}</p></div><button data-action="join-room" data-room-id="${roomId}" data-room="${title}">${state.voiceRoomId===roomId?"当前房间":"加入"}</button></div>`}
const demoEvents=[
  ["顾言翻开航运录，系统记录阅读完成","旧港档案馆",79,65],
  ["林烛进入诊所地下观察室，支线状态更新","潮汐诊所地下室",71,69],
  ["周岚使用黄铜钥匙，规则检测到暗门条件满足","旧港档案馆",67,73],
  ["自动推进：档案密室开放，所有玩家收到场景更新","档案密室入口",72,78],
  ["闻彻加入公共讨论房，开始共享新线索","旧港档案馆",52,82]
];
function advanceDemo(){
 const event=demoEvents[state.demoStep%demoEvents.length]; state.demoStep++; state.progress=event[3];
 const target=state.players[(state.demoStep-1)%state.players.length]; target.scene=event[1]; target.progress=event[2];
 state.logs.unshift([event[0],"刚刚",state.demoStep===3?"warn":"ok"]); state.logs=state.logs.slice(0,5); render(); showToast(event[0]);
}
function resetDemo(){
 state.demoStep=0;state.progress=62;state.players[0].scene="旧港档案馆";state.players[0].progress=76;state.players[1].scene="雾港诊所";state.players[1].progress=64;state.players[2].scene="码头仓库";state.players[2].progress=58;state.players[3].scene="钟楼广场";state.players[3].progress=43;render();showToast("演示内容已重置");
}
const wizardSteps = ["创建方式","角色与席位","章节与内容","自动化规则","测试并发布"];
function openWizard(step=0){
  state.wizardStep=Math.max(0,Math.min(step,wizardSteps.length-1));
  modal.className="modal wizard-modal";
  modal.innerHTML=`<div class="wizard-shell"><aside class="wizard-side"><p class="eyebrow">CREATOR GUIDE</p><h2>创建你的世界</h2><p>用一套标准流程，把已有剧本整理成可以自动运行的线上房间。</p><div class="wizard-steps">${wizardSteps.map((s,i)=>`<div class="wizard-step ${i===state.wizardStep?"active":i<state.wizardStep?"done":""}"><i>${i<state.wizardStep?"✓":i+1}</i><span>${s}</span></div>`).join("")}</div></aside><main class="wizard-main">${wizardContent(state.wizardStep)}${state.wizardRoleEditor?"":`<footer class="wizard-footer"><span>第 ${state.wizardStep+1} 步，共 ${wizardSteps.length} 步</span><div class="wizard-actions">${state.wizardStep?`<button class="secondary-btn" data-wizard-back>上一步</button>`:`<button class="secondary-btn" data-wizard-close>暂时退出</button>`}<button class="primary-btn" data-wizard-next>${state.wizardStep===wizardSteps.length-1?"创建测试房间":"保存并继续"}</button></div></footer>`}</main></div>`;
  modalBackdrop.classList.add("show");
  modal.querySelector("[data-wizard-next]")?.addEventListener("click",()=>{collectWizardDraft();return state.wizardStep===wizardSteps.length-1?finishWizard():openWizard(state.wizardStep+1)});
  modal.querySelector("[data-wizard-back]")?.addEventListener("click",()=>{collectWizardDraft();openWizard(state.wizardStep-1)});
  modal.querySelector("[data-wizard-close]")?.addEventListener("click",closeModal);
  modal.querySelectorAll("[data-wizard-choice]").forEach(button=>button.addEventListener("click",()=>{
    collectWizardDraft();
    state.wizardDraft[button.dataset.wizardChoice]=button.dataset.choiceValue;
    state.wizardRoleEditor=null;
    openWizard(state.wizardStep);
  }));
  modal.querySelectorAll("[data-automation-template]").forEach(button=>button.addEventListener("click",()=>{
    const key=button.dataset.automationTemplate;
    state.wizardDraft.automationTemplates[key]=!state.wizardDraft.automationTemplates[key];
    openWizard(3);
  }));
  modal.querySelectorAll("[data-role-edit]").forEach(button=>button.addEventListener("click",()=>openRoleEditor(Number(button.dataset.roleEdit))));
  modal.querySelector("[data-role-add]")?.addEventListener("click",()=>openRoleEditor(-1));
  modal.querySelector("[data-role-save]")?.addEventListener("click",saveRoleEditor);
  modal.querySelector("[data-role-cancel]")?.addEventListener("click",()=>{state.wizardRoleEditor=null;openWizard(1)});
  modal.querySelector("[data-role-delete]")?.addEventListener("click",deleteRoleEditor);
  modal.querySelector("[data-role-document]")?.addEventListener("change",importRoleDocument);
}
function wizardContent(step){
 const pages=[
 `<p class="section-kicker">STEP 01 · START</p><h2>先决定这个世界如何运行</h2><p class="wizard-intro">不需要一次填完所有内容。向导会先搭起房间骨架，你可以随时回到创作台继续完善。</p><div class="choice-grid">${choice("◇","剧本杀房间","角色剧本、搜证轮次和集中复盘","worldMode","scripted")}${choice("⌘","跑团房间","开放探索、状态变化和骰点流程","worldMode","campaign")}${choice("∞","混合长线房间","用自动化连接章节与开放探索","worldMode","hybrid")}</div><div class="tutorial-tip"><b>建议</b><span>第一次创建时选择混合长线房间也没问题。每个事件都可以单独设置自动、主持确认或手动推进。</span></div>`,
 roleStepContent(),
 contentStepContent(),
 automationStepContent(),
 `<p class="section-kicker">STEP 05 · TEST ROOM</p><h2>创建测试房间，先自己跑一遍</h2><p class="wizard-intro">发布前使用不同玩家视角检查专属剧情、线索权限和自动规则。测试房间中的操作不会影响正式存档。</p><div class="checklist">${check("角色席位与私人序章",`将写入 ${currentRoles().length} 个席位与 ${currentRoles().length} 段私人剧情`)}${check("起始章节","将写入 1 个序章")}${check("自动化规则","创建后在创作台按需配置")}${check("语音空间","将自动建立公共讨论房")}</div><div class="tutorial-tip"><b>下一步</b><span>创建测试房间后，你会进入创作台。可以继续补充角色、场景、调查点和关键规则，再邀请协作主持人或切换玩家视角检查体验。</span></div>`
 ];
 return `${wizardForm(step)}${pages[step]}`;
}
function wizardForm(step){
 const d=state.wizardDraft;
 if(step===0)return `<div class="form-group"><label>世界名称</label><input class="field" data-draft="worldName" value="${d.worldName}"><label>一句话简介</label><input class="field" data-draft="summary" value="${d.summary}"></div>`;
 if(step===2){
  const content=currentContent(), labels=contentModeMeta();
  return `<div class="form-group"><label>${labels[0]}</label><input class="field" data-content-field="chapterTitle" value="${content.chapterTitle}"><label>${labels[1]}</label><input class="field" data-content-field="sectionTitle" value="${content.sectionTitle}"><label>${labels[2]}</label><textarea class="field" rows="5" data-content-field="sectionBody">${content.sectionBody}</textarea></div>`;
 }
 if(step===4)return `<div class="tutorial-tip"><b>即将写入云端</b><span>系统将创建 1 个世界、${currentRoles().length} 个角色席位、1 个章节、${currentRoles().length} 段私人剧情和 1 个带公共语音空间的测试房间。之后可在创作台继续扩充。</span></div>`;
 return "";
}
function automationStepContent(){
 const templates=[
  ["reading","阅读完成后解锁下一幕","当玩家主动点击“我已读完”时","开放该角色下一段私人剧情","自动执行"],
  ["clue","核心线索满足后开放新场景","当指定线索已被获得或解读时","开放对应公共场景并记录日志","自动执行"],
  ["chapter","章节结束与终幕开启","当本章关键节点全部完成时","提交给主持人确认，再进入下一章","主持确认"],
  ["hint","卡关时发送弱提示","当玩家长时间没有获得新信息时","发送与当前位置有关的轻量提示","自动执行"]
 ];
 return `<p class="section-kicker">STEP 04 · AUTOMATION</p><h2>选择这个房间需要的自动推进模板</h2><p class="wizard-intro">自动化不是替主持人做决定，而是持续检测玩家状态。普通解锁交给系统，重要转折仍由主持人确认。点击卡片即可启用或关闭，创建后还能继续细化条件。</p><div class="automation-guide"><b>推荐做法</b><span>第一次创建剧本杀房间时，保留前三项即可。弱提示适合长线测试阶段，正式发布前再决定是否开启。</span></div><div class="automation-template-grid">${templates.map(([key,title,when,action,mode])=>automationTemplate(key,title,when,action,mode)).join("")}</div>`;
}
function automationTemplate(key,title,when,action,mode){
 const enabled=state.wizardDraft.automationTemplates[key];
 return `<button type="button" class="automation-template ${enabled?"enabled":""}" data-automation-template="${key}"><span class="template-switch">${enabled?"✓ 已启用":"＋ 点击启用"}</span><h3>${title}</h3><p><b>检测：</b>${when}</p><p><b>执行：</b>${action}</p><small>${mode}</small></button>`;
}
function collectWizardDraft(){
 modal.querySelectorAll("[data-draft]").forEach(input=>state.wizardDraft[input.dataset.draft]=input.value.trim());
 modal.querySelectorAll("[data-content-field]").forEach(input=>currentContent()[input.dataset.contentField]=input.value.trim());
}
function choice(icon,title,text,draftKey,value){return `<button type="button" class="choice ${state.wizardDraft[draftKey]===value?"selected":""}" data-wizard-choice="${draftKey}" data-choice-value="${value}"><span class="choice-icon">${icon}</span><strong>${title}</strong><p>${text}</p></button>`}
function currentRoles(){return state.wizardDraft.roleSets[state.wizardDraft.worldMode]}
function currentContent(){return state.wizardDraft.contentSets[state.wizardDraft.worldMode]}
function roleModeMeta(){
 const modes={
  scripted:["剧本杀席位模板","角色身份、秘密与个人任务会进入专属剧本。","个人任务","角色秘密"],
  campaign:["跑团角色模板","角色更偏向自由探索，席位用于区分能力方向与个人背景。","探索方向","背景钩子"],
  hybrid:["混合长线模板","角色既有私人剧本，也保留开放探索中的长期身份。","长期目标","隐藏支线"]
 };
 return modes[state.wizardDraft.worldMode];
}
function roleStepContent(){
 if(state.wizardRoleEditor)return roleEditorContent();
 const [title,intro]=roleModeMeta();
 return `<p class="section-kicker">STEP 02 · CAST</p><h2>${title}</h2><p class="wizard-intro">${intro}</p><div class="seat-grid">${currentRoles().map((role,index)=>seat(role,index)).join("")}<div class="seat"><div class="avatar">＋</div><div><strong>新增角色席位</strong><p>自定义身份 · 添加新角色</p></div><button type="button" data-role-add>添加</button></div></div><div class="tutorial-tip"><b>权限提示</b><span>公共剧情、角色私密剧情和主持人秘密会严格分开。发布前可以用玩家视角逐一检查。</span></div>`;
}
function contentModeMeta(){
 const modes={
  scripted:["首章名称","角色序章标题","角色序章正文"],
  campaign:["首场冒险名称","开场钩子名称","开放探索引导"],
  hybrid:["首个阶段名称","个人节点标题","阶段私人剧情"]
 };
 return modes[state.wizardDraft.worldMode];
}
function contentStepContent(){
 const modeCopy={
  scripted:["整理已有剧本，再拆分成章节","先导入剧本内容，再把公开剧情、角色私密段落和搜证轮次分开。"],
  campaign:["建立第一场冒险与开放探索钩子","先明确冒险开场，再补充可探索场景、状态变化、道具与骰点节点。"],
  hybrid:["连接私人剧情与开放探索阶段","先建立阶段节点，再把角色专属内容与公共探索场景连接起来。"]
 }[state.wizardDraft.worldMode];
 const sourceCopy={
  document:"从已有文档开始，后续可继续拆分内容。",
  template:"使用当前模式的标准骨架，适合第一次建立世界。",
  blank:"只保留必要字段，后续完全自由扩展。"
 }[state.wizardDraft.contentSource];
 const scriptDocuments=state.wizardDraft.worldMode==="scripted"?`<div class="checklist">${currentRoles().map(role=>check(`${role.name} · 专属剧本`,role.scriptFilename?`已导入 ${role.scriptFilename}`:"尚未导入，可返回角色席位逐一上传")).join("")}</div>`:"";
 return `<p class="section-kicker">STEP 03 · CONTENT</p><h2>${modeCopy[0]}</h2><p class="wizard-intro">${modeCopy[1]}</p><div class="choice-grid">${choice("▤","导入剧情文档","从 Markdown 或 TXT 文档开始","contentSource","document")}${choice("◇","使用标准模板","从当前模式的标准骨架开始","contentSource","template")}${choice("＋","从空白世界开始","完全自由地创建内容","contentSource","blank")}</div><div class="tutorial-tip"><b>当前方案</b><span>${sourceCopy}</span></div>${scriptDocuments}`;
}
function seat(role,index){return `<div class="seat"><div class="avatar">${role.name[0]||"角"}</div><div><strong>${role.name}</strong><p>${role.goal} · 已配置私人序章</p></div><button type="button" data-role-edit="${index}">编辑</button></div>`}
function openRoleEditor(index){
 const source=index<0?{name:"新角色",goal:"待补充",publicProfile:"",privateProfile:""}:currentRoles()[index];
 state.wizardRoleEditor={index,role:{...source}};openWizard(1);
}
function roleEditorContent(){
 const editor=state.wizardRoleEditor, role=editor.role, [,intro,goalLabel,secretLabel]=roleModeMeta();
 const scriptedDocument=state.wizardDraft.worldMode==="scripted"?`<label>该角色的专属剧本文档</label><input class="field" type="file" accept=".txt,.md,text/plain,text/markdown" data-role-document><div class="tutorial-tip"><b>${role.scriptFilename||"尚未导入文档"}</b><span>支持 TXT 与 Markdown。导入后仍可在下方继续修订角色正文。</span></div><label>角色剧本正文</label><textarea class="field" rows="7" data-role-field="scriptBody">${role.scriptBody||""}</textarea>`:"";
 return `<p class="section-kicker">STEP 02 · ROLE EDITOR</p><h2>${editor.index<0?"新增角色席位":`编辑「${role.name}」`}</h2><p class="wizard-intro">${intro}</p><div class="form-group"><label>角色名称</label><input class="field" data-role-field="name" value="${role.name}"><label>${goalLabel}</label><input class="field" data-role-field="goal" value="${role.goal}"><label>公开身份</label><textarea class="field" data-role-field="publicProfile">${role.publicProfile}</textarea><label>${secretLabel}</label><textarea class="field" data-role-field="privateProfile">${role.privateProfile}</textarea>${scriptedDocument}</div><div class="modal-actions">${editor.index>=0?`<button class="secondary-btn" type="button" data-role-delete>删除席位</button>`:""}<button class="secondary-btn" type="button" data-role-cancel>取消</button><button class="primary-btn" type="button" data-role-save>保存席位</button></div>`;
}
async function importRoleDocument(event){
 const file=event.target.files[0];if(!file)return;
 if(!/\.(txt|md)$/i.test(file.name))return showToast("当前支持 TXT 或 Markdown 剧本文档");
 state.wizardRoleEditor.role.scriptFilename=file.name;
 state.wizardRoleEditor.role.scriptBody=await file.text();
 openWizard(1);showToast("角色剧本文档已导入");
}
function saveRoleEditor(){
 const editor=state.wizardRoleEditor;
 modal.querySelectorAll("[data-role-field]").forEach(input=>editor.role[input.dataset.roleField]=input.value.trim());
 if(!editor.role.name)return showToast("请填写角色名称");
 if(editor.index<0)currentRoles().push(editor.role);else currentRoles()[editor.index]=editor.role;
 state.wizardRoleEditor=null;openWizard(1);showToast("角色席位已保存");
}
function deleteRoleEditor(){
 if(currentRoles().length<=1)return showToast("至少需要保留一个角色席位");
 currentRoles().splice(state.wizardRoleEditor.index,1);state.wizardRoleEditor=null;openWizard(1);showToast("角色席位已删除");
}
function check(title,status){return `<div class="check-item"><i>✓</i><div><strong>${title}</strong><p>${status}</p></div></div>`}
function closeModal(){modalBackdrop.classList.remove("show");modal.className="modal"}
async function finishWizard(){
 const button=modal.querySelector("[data-wizard-next]");button.disabled=true;button.textContent="正在写入云端...";
 try{
  const d=state.wizardDraft;
  const content=currentContent();
  const world=await zhimuApi.createWorld({name:d.worldName,summary:d.summary,settings:{worldMode:d.worldMode,contentSource:d.contentSource,automationTemplates:d.automationTemplates}});
  const chapter=await zhimuApi.createChapter(world.id,{title:content.chapterTitle,summary:d.summary,sequence:1});
  for(const [index,roleDraft] of currentRoles().entries()){
   const role=await zhimuApi.createRole(world.id,{name:roleDraft.name,publicProfile:roleDraft.publicProfile,privateProfile:roleDraft.privateProfile,sequence:index+1});
   await zhimuApi.createSection(world.id,role.id,{chapterId:chapter.id,title:content.sectionTitle,body:roleDraft.scriptBody||`${roleDraft.privateProfile}\n\n${content.sectionBody}`,sequence:1});
  }
  const inviteCode=`TEST-${Date.now().toString(36).toUpperCase()}`;
  const room=await zhimuApi.createRoom(world.id,{name:`${d.worldName} · 测试房`,inviteCode});
  closeModal();go("studio");
  openModal("测试房间已创建",`世界、角色、章节和序章已经真实写入云端。<br><br><strong>邀请码：${inviteCode}</strong><br><small>房间 ID：${room.id}</small>`,"开始继续编排");
 }catch(error){button.disabled=false;button.textContent="重新创建测试房间";showToast(error.message)}
}
function showToast(text){toast.textContent=text; toast.classList.add("show");setTimeout(()=>toast.classList.remove("show"),2200)}
function go(view){state.view=view;render()}

document.querySelectorAll(".nav-item[data-view]").forEach(btn=>btn.addEventListener("click",()=>go(btn.dataset.view)));
document.querySelector("#run-btn").onclick=()=>go("director");
document.querySelector("#preview-btn").onclick=()=>go("player");
document.querySelector("#search-btn").onclick=()=>openModal("全局搜索尚未接入","搜索界面仍在设计中，当前不会执行查询。后续将检索角色、线索、场景、事件与规则。","知道了");
document.querySelector("#notify-btn").onclick=()=>showToast((state.cloudHostEvents||[]).length?`${state.cloudHostEvents.length} 条运行事件等待处理`:"当前世界没有待处理运行事件");
document.querySelector("#create-world-btn").onclick=()=>openWizard();
document.querySelector(".world-switcher").onclick=()=>openWorldLibrary();
document.querySelector(".profile").onclick=()=>openAuth();
modalBackdrop.onclick=e=>{if(e.target===modalBackdrop) closeModal()};
render();
async function loadCloudData(withToast=false){
 const hasRoom=Boolean(zhimuApi.context.roomId),skipRoom=()=>Promise.resolve(null);
 const requests=[hasRoom?zhimuApi.getPlayerHome():skipRoom(),hasRoom?zhimuApi.getHostProgress():skipRoom(),zhimuApi.getStorageUsage(),zhimuApi.getAssets(),hasRoom?zhimuApi.getExploration():skipRoom(),hasRoom?zhimuApi.getHostEvents():skipRoom(),zhimuApi.getStudio(),zhimuApi.getCreatorChecks(),zhimuApi.getRules()];
 const [playerHome,hostProgress,usage,assets,exploration,hostEvents,studioData,creatorChecks,rulesData]=await Promise.allSettled(requests),errors=[];
 const take=(result,apply)=>result.status==="fulfilled"?apply(result.value):errors.push(result.reason.message);
 take(playerHome,value=>state.cloudPlayer=value);take(hostProgress,value=>state.cloudHost=value||[]);take(usage,value=>state.storageUsage=value);take(assets,value=>state.cloudAssets=value);take(exploration,value=>state.cloudExploration=value);take(hostEvents,value=>state.cloudHostEvents=value||[]);take(studioData,value=>state.cloudStudio=value);take(creatorChecks,value=>state.cloudCreatorChecks=value.checks);take(rulesData,value=>state.cloudRules=value);
 const voiceRooms=state.cloudPlayer?.voiceRooms||[],currentRoom=voiceRooms.find(room=>room.id===state.voiceRoomId)||voiceRooms[0];if(currentRoom){state.voiceRoomId=currentRoom.id;state.voiceRoom=currentRoom.name;try{state.voiceMessages=await zhimuApi.getVoiceMessages(currentRoom.id)}catch(error){errors.push(error.message)}}
 state.apiError=errors.join(" · ");render();if(withToast)showToast(errors.length?`部分运行数据尚未连接：${errors[0]}`:"云端数据已刷新");
}
loadCloudData();
