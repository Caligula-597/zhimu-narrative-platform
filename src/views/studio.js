/* Auto-split from app.js — studio.js */
(function (window) {
  const state = window.zhimuState;
  const zhimuApi = window.zhimuApi;
  const { content, toast, modal, modalBackdrop } = window.zhimuDom;
  const F = window.zhimuFormat || {};
  const U = window.zhimuUi || {};
  const T = window.zhimuToast || {};
  const M = window.zhimuModal || {};
  const R = window.zhimuRuntime || {};
  const V = window.zhimuViews || {};
  const escapeHtml = F.escapeHtml || ((v = "") => String(v));
  const formatTime = F.formatTime || (() => "");
  const formatBytes = F.formatBytes || (() => "");
  const formatRelativeTime = F.formatRelativeTime || (() => "");
  const roleParts = F.roleParts || (() => ({ name: "", role: "" }));
  const hostOperationLabel = F.hostOperationLabel || ((t, m) => m || t);
  const hostPlayerColor = F.hostPlayerColor || (() => "#666");
  const logActivityType = F.logActivityType || (() => "ok");
  const chapterPublicationLabel = F.chapterPublicationLabel || ((s) => s);
  const chapterFlowClass = F.chapterFlowClass || (() => "");
  const activeRuntimeRoom = U.activeRuntimeRoom || (() => null);
  const cloudStatus = U.cloudStatus || (() => "");
  const runtimeEmpty = U.runtimeEmpty || (() => "");
  const stat = U.stat || (() => "");
  const flow = U.flow || (() => "");
  const activity = U.activity || (() => "");
  const readingRow = U.readingRow || (() => "");
  const task = U.task || (() => "");
  const taskAction = U.taskAction || (() => "");
  const capability = U.capability || (() => "");
  const check = U.check || (() => "");
  const voiceOption = U.voiceOption || (() => "");
  const showToast = T.showToast || (() => {});
  const closeModal = M.closeModal || (() => {});
  const openModal = M.openModal || (() => {});
  const studioModal = M.studioModal || (() => {});
  const studioField = M.studioField || (() => "");
  const studioValues = M.studioValues || (() => ({}));
  const studioSelect = M.studioSelect || (() => "");
  const go = R.go || (() => {});
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.studio = window.zhimuViews.studio || {};
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
   <div class="story-toolbar"><div class="story-toolbar-row"><div class="tool-group"><button class="tool" data-action="studio-add-scene">＋ 场景</button><button class="tool" data-action="studio-add-clue">＋ 线索</button><button class="tool" data-action="studio-add-item">＋ 物品</button><button class="tool" data-action="studio-add-point">＋ 调查点</button><button class="tool" data-action="studio-add-chapter">＋ 章节</button></div><div class="tool-group"><button class="tool" data-action="studio-auto-layout">自动布局</button><button class="tool" data-action="studio-zoom-out">−</button><span class="zoom-label">${Math.round(state.studioZoom*100)}%</span><button class="tool" data-action="studio-zoom-in">＋</button></div></div>
   <div class="story-toolbar-row"><div class="filter-tabs">${studioFilterButton("all","全部节点")}${studioFilterButton("scene","场景")}${studioFilterButton("clue","线索")}${studioFilterButton("item","物品")}${studioFilterButton("investigation_point","调查点")}</div><div class="graph-legend"><span><i class="relation-mainline"></i>主线</span><span><i class="relation-parallel"></i>并列</span><span><i class="relation-extension"></i>延伸</span></div></div>${studioCompactSelection(data)}</div>
   <div class="node-board"><button class="canvas-add-btn" data-action="studio-add-node-menu">＋ 在画布中新增节点</button><div class="graph-canvas" style="transform:scale(${state.studioZoom})">
      ${studioEdges(data)}${studioNodes(data)}
   </div></div>
  </div>
  <aside class="panel inspector"><div class="panel-title">节点编辑</div><div class="inspector-body">
   <p class="section-kicker">SCRIPTED WORLD</p><h3 style="margin-top:7px">${data.world.name}</h3>
   <label>公共章节</label><div class="rule-block">${data.chapters.map(chapter=>`${chapter.sequence}. ${chapter.title}`).join("<br>")||"尚未创建"}</div>
   <label>角色专属剧本</label><div class="rule-block">${data.roles.map(role=>`${role.name}：${data.sections.filter(section=>section.role_slot_id===role.id).length} 段私人内容`).join("<br>")||"尚未创建"}</div>
   <label>已写入节点</label><div><span class="tag">${data.scenes.length} 场景</span><span class="tag">${data.clues.length} 线索</span><span class="tag">${(data.items||[]).length} 物品</span><span class="tag">${data.investigationPoints.length} 调查点</span><span class="tag">${data.edges.length} 连线</span></div>
   ${studioSelection(data)}
   <div class="tutorial-tip"><b>剧本杀编排</b><span>公共剧情线负责章节、场景和线索关系；每位玩家的私人文本单独存储，不会混成同一份剧本。</span></div>
  </div></aside>
 </section>`;
}

function studioNodes(data){
 const nodes=[],visible=studioVisibleNodes(data);
 visible.forEach(node=>{const position=studioNodePosition(node,data);nodes.push(studioNode(position.x,position.y,node.type,node.id,node.badge,node.title,node.desc,node.cls,node.metadata))});
 return nodes.join("")||`<article class="node" style="left:30px;top:120px"><span class="badge">开始</span><strong>建立公共剧情线</strong><small>请添加章节、公共场景和线索</small></article>`;
}

function studioNode(x,y,type,id,badge,title,desc,cls,metadata={}){const selected=state.studioSelectedNode?.type===type&&state.studioSelectedNode?.id===id,anchors=studioNodeAnchors({metadata});return `<button class="node ${cls} ${selected?"selected":""}" style="left:${x}px;top:${y}px;text-align:left" data-action="studio-select-node" data-node-type="${type}" data-node-id="${id}"><span class="node-drag-handle">⠿ 拖动</span>${anchors.map(anchor=>`<span class="node-link-handle ${state.studioAnchorEditing&&selected?"anchor-editing":""}" style="left:${anchor.x}px;top:${anchor.y}px" data-anchor-id="${anchor.id}" title="${state.studioAnchorEditing&&selected?"拖动调整连接点位置":"拖到其他节点创建连线"}"></span>`).join("")}<span class="badge">${badge}</span><strong>${title}</strong><small>${desc}</small></button>`}

function studioNodeList(data){return [...data.scenes.map(node=>({type:"scene",id:node.id,name:`场景 · ${node.name}`,title:node.name,badge:"公共场景",desc:node.public_text||"等待补充场景说明",cls:"",metadata:node.metadata})),...data.clues.map(node=>({type:"clue",id:node.id,name:`线索 · ${node.name}`,title:node.name,badge:"线索",desc:node.public_text||"等待补充线索说明",cls:"current",metadata:node.metadata})),...(data.items||[]).map(node=>({type:"item",id:node.id,name:`物品 · ${node.name}`,title:node.name,badge:"物品",desc:node.public_text||"等待补充物品说明",cls:"item",metadata:node.metadata})),...data.investigationPoints.map(node=>({type:"investigation_point",id:node.id,name:`调查点 · ${node.name}`,title:node.name,badge:"调查点",desc:node.description||"等待补充调查说明",cls:"event",metadata:node.metadata}))]}

function studioVisibleNodes(data){const all=studioNodeList(data);return state.studioFilter==="all"?all:all.filter(node=>node.type===state.studioFilter)}

function studioFilterButton(value,label){return `<button class="filter-tab ${state.studioFilter===value?"active":""}" data-action="studio-filter" data-filter="${value}">${label}</button>`}

function studioCompactSelection(data){const selected=state.studioSelectedNode;if(!selected)return `<div class="canvas-tip">拖动卡片调整位置；拖动画布空白处平移；选中节点后可以添加连接点，再从圆点拖到另一张卡快速连线。</div>`;return `<div class="compact-selection"><span>当前节点：${studioNodeName(data,selected.type,selected.id)} · ${studioNodeAnchors(studioNodeRecord(data,selected.type,selected.id)).length} 个连接点</span><div class="row"><button class="text-btn" data-action="studio-add-anchor">＋ 连接点</button><button class="text-btn" data-action="studio-toggle-anchor-edit">${state.studioAnchorEditing?"完成调整":"调整连接点"}</button><button class="text-btn" data-action="studio-connect-node">＋ 创建连线</button><button class="text-btn danger-text" data-action="studio-delete-node">删除节点</button></div></div>`}

function studioDefaultPositions(data){const positions=new Map();data.scenes.forEach((scene,index)=>positions.set(`scene:${scene.id}`,{x:48,y:92+index*142}));data.clues.forEach((clue,index)=>positions.set(`clue:${clue.id}`,{x:294,y:92+index*142}));(data.items||[]).forEach((item,index)=>positions.set(`item:${item.id}`,{x:786,y:92+index*142}));data.investigationPoints.forEach((point,index)=>positions.set(`investigation_point:${point.id}`,{x:540,y:92+index*142}));return positions}

function studioNodePosition(node,data){return node.metadata?.graphPosition||studioDefaultPositions(data).get(`${node.type}:${node.id}`)||{x:40,y:100}}

function studioNodeRecord(data,type,id){return ({scene:data.scenes,clue:data.clues,item:data.items||[],investigation_point:data.investigationPoints})[type]?.find(node=>node.id===id)}

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
 if(!selected)return `<label>剧情连线</label>${edges||`<p class="wizard-intro">点击节点后可以编辑内容，并建立主线、并列或延伸关系。</p>`}`;
 const anchors=studioNodeAnchors(studioNodeRecord(data,selected.type,selected.id));
 return `${studioNodeEditPanel(data,selected)}<div class="anchor-toolbar"><button class="secondary-btn" data-action="studio-add-anchor">＋ 添加连接点</button><button class="secondary-btn" data-action="studio-toggle-anchor-edit">${state.studioAnchorEditing?"完成位置调整":"拖动调整连接点"}</button></div><div class="anchor-list">${anchors.map((anchor,index)=>`<div class="anchor-row"><span><i></i> 连接点 ${index+1}</span>${anchors.length>1?`<button class="text-btn danger-text" data-action="studio-delete-anchor" data-anchor-id="${anchor.id}">删除</button>`:""}</div>`).join("")}</div><button class="secondary-btn full-btn" data-action="studio-connect-node">＋ 创建剧情连线</button><button class="danger-btn full-btn" data-action="studio-delete-node">删除当前节点</button><label>剧情连线</label>${edges||`<p class="wizard-intro">尚未创建连线。</p>`}`;
}

function studioEditField(label,key,type="input",value=""){
 return `<label>${label}</label>${type==="textarea"?`<textarea class="field" data-studio-edit-field="${key}" rows="4">${escapeHtml(value)}</textarea>`:`<input class="field" data-studio-edit-field="${key}" value="${escapeHtml(value)}">`}`;
}

function studioEditSelect(label,key,options,selected=""){
 return `<label>${label}</label><select class="field" data-studio-edit-field="${key}">${options.map(option=>`<option value="${option.id}" ${String(option.id)===String(selected)?"selected":""}>${escapeHtml(option.name||option.title||"")}</option>`).join("")}</select>`;
}

function studioEditValues(){
 const values={};
 document.querySelectorAll("[data-studio-edit-field]").forEach(input=>{values[input.dataset.studioEditField]=input.value.trim();});
 values.visibleRoleSlotIds=[...document.querySelectorAll('[data-studio-edit-checkbox="visibleRoleSlotIds"]:checked')].map(input=>input.value);
 document.querySelectorAll("[data-studio-edit-boolean]").forEach(input=>{values[input.dataset.studioEditBoolean]=input.checked;});
 return values;
}

function studioNodeEditPanel(data,selected){
 const record=studioNodeRecord(data,selected.type,selected.id);
 if(!record)return `<p class="wizard-intro">节点数据不可用，请刷新后重试。</p>`;
 const meta=record.metadata||{};
 if(selected.type==="scene"){
  const chapters=[{id:"",name:"暂不绑定章节"},...data.chapters];
  const visibleIds=Array.isArray(meta.visibleRoleSlotIds)?meta.visibleRoleSlotIds:[];
  return `<div class="studio-edit-panel"><p class="section-kicker">编辑场景</p>${studioEditField("场景标题","name","input",record.name)}${studioEditField("场景摘要","summary","textarea",meta.summary||"")}${studioEditField("场景正文 / 描述","publicText","textarea",record.public_text||"")}${studioEditSelect("开放状态","openStatus",[{id:"locked",name:"锁定 · 需规则或主持开放"},{id:"unlocked",name:"已开放 · 初始可见"}],meta.openStatus||"locked")}${studioEditSelect("所属章节","chapterId",chapters.map(chapter=>({id:chapter.id,name:chapter.title})),record.chapter_id||"")}<label>可见角色范围</label><div class="studio-role-checks">${data.roles.map(role=>`<label class="studio-check-row"><input type="checkbox" data-studio-edit-checkbox="visibleRoleSlotIds" value="${role.id}" ${visibleIds.includes(role.id)?"checked":""}> ${escapeHtml(role.name)}</label>`).join("")||`<span class="wizard-intro">请先创建角色席位。</span>`}</div>${studioEditField("主持备注","hostText","textarea",record.host_text||"")}<button class="primary-btn full-btn" data-action="studio-save-node">保存场景</button></div>`;
 }
 if(selected.type==="clue"){
  const assets=[{id:"",name:"不关联附件"},...(state.cloudAssets||[]).map(asset=>({id:asset.id,name:asset.original_filename}))];
  return `<div class="studio-edit-panel"><p class="section-kicker">编辑线索</p>${studioEditField("线索标题","name","input",record.name)}${studioEditField("线索正文","publicText","textarea",record.public_text||"")}${studioEditSelect("线索类型","clueType",[{id:"text",name:"文字"},{id:"image",name:"图片"},{id:"file",name:"文件"},{id:"audio",name:"音频"}],meta.clueType||"text")}${studioEditSelect("关联资产","assetId",assets,meta.assetId||"")}${studioEditSelect("默认可见性","visibility",[{id:"role",name:"私密 · 仅获得角色可见"},{id:"public",name:"房间公开"},{id:"host",name:"主持可见"}],record.visibility||"role")}${studioEditSelect("重要程度","importance",[{id:"normal",name:"普通"},{id:"key",name:"关键"},{id:"red_herring",name:"烟雾弹"}],meta.importance||"normal")}${studioEditField("主持提示","hostText","textarea",record.host_text||"")}<button class="primary-btn full-btn" data-action="studio-save-node">保存线索</button></div>`;
 }
 if(selected.type==="item"){
  const assets=[{id:"",name:"不关联附件"},...(state.cloudAssets||[]).map(asset=>({id:asset.id,name:asset.original_filename}))];
  return `<div class="studio-edit-panel"><p class="section-kicker">编辑物品</p>${studioEditField("物品名称","name","input",record.name)}${studioEditField("物品描述","publicText","textarea",record.public_text||"")}<label class="studio-check-row"><input type="checkbox" data-studio-edit-boolean="unique" ${meta.unique?"checked":""}> 是否唯一（同一角色不可重复获得）</label><label class="studio-check-row"><input type="checkbox" data-studio-edit-boolean="consumable" ${meta.consumable?"checked":""}> 是否可消耗（使用后消失）</label>${studioEditSelect("关联资产","assetId",assets,meta.assetId||"")}${studioEditField("主持备注","hostText","textarea",record.host_text||"")}<button class="primary-btn full-btn" data-action="studio-save-node">保存物品</button></div>`;
 }
 const scenes=data.scenes||[],clues=[{id:"",name:"不发放线索"},...(data.clues||[])],items=[{id:"",name:"不需要物品"},...(data.items||[])];
 return `<div class="studio-edit-panel"><p class="section-kicker">编辑调查点</p>${studioEditField("调查点标题","name","input",record.name)}${studioEditField("调查描述","description","textarea",record.description||"")}${studioEditSelect("所属场景","sceneId",scenes.map(scene=>({id:scene.id,name:scene.name})),record.scene_id||"")}${studioEditField("调查结果","resultText","textarea",record.result_text||"")}${studioEditSelect("成功后发放线索","clueId",clues,record.clue_id||"")}${studioEditSelect("是否需要物品","requiredItemId",items,record.required_item_id||"")}<label class="studio-check-row"><input type="checkbox" data-studio-edit-boolean="hostConfirmRequired" ${meta.hostConfirmRequired?"checked":""}> 是否需要主持确认</label><label class="studio-check-row"><input type="checkbox" data-studio-edit-boolean="oneTime" ${meta.oneTime!==false?"checked":""}> 是否一次性</label>${studioEditField("主持备注","hostNote","textarea",meta.hostNote||"")}<button class="primary-btn full-btn" data-action="studio-save-node">保存调查点</button></div>`;
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

async function saveSelectedStudioNode(){
 const selected=state.studioSelectedNode;if(!selected)return;
 const values=studioEditValues();
 try{
  if(selected.type==="scene"){
   await zhimuApi.updateScene(selected.id,{name:values.name,publicText:values.publicText,hostText:values.hostText,chapterId:values.chapterId||null,metadata:{summary:values.summary,openStatus:values.openStatus,visibleRoleSlotIds:values.visibleRoleSlotIds||[]}});
  }else if(selected.type==="clue"){
   await zhimuApi.updateClue(selected.id,{name:values.name,publicText:values.publicText,hostText:values.hostText,visibility:values.visibility||"role",metadata:{clueType:values.clueType||"text",assetId:values.assetId||null,importance:values.importance||"normal"}});
  }else if(selected.type==="item"){
   await zhimuApi.updateItem(selected.id,{name:values.name,publicText:values.publicText,hostText:values.hostText,unique:Boolean(values.unique),consumable:Boolean(values.consumable),assetId:values.assetId||null});
  }else{
   await zhimuApi.updateInvestigationPoint(selected.id,{name:values.name,description:values.description,resultText:values.resultText,sceneId:values.sceneId,clueId:values.clueId||null,requiredItemId:values.requiredItemId||null,metadata:{hostConfirmRequired:Boolean(values.hostConfirmRequired),oneTime:values.oneTime!==false,hostNote:values.hostNote||""}});
  }
  await loadCloudData();showToast("节点已保存");
 }catch(error){showToast(error.message)}
}

async function deleteSelectedStudioNode(){
 const selected=state.studioSelectedNode;if(!selected)return;
 try{
  const refs=await zhimuApi.getStudioNodeReferences(selected.type,selected.id),parts=[];
  if(refs.edgeCount)parts.push(`${refs.edgeCount} 条剧情连线`);
  if(refs.investigationPointCount)parts.push(`${refs.investigationPointCount} 个调查点`);
  if(refs.clueGrantCount)parts.push(`${refs.clueGrantCount} 个调查点引用此线索`);
  if(refs.requiredItemCount)parts.push(`${refs.requiredItemCount} 个调查点需要此物品`);
  if(refs.ruleReferenceCount)parts.push(`${refs.ruleReferenceCount} 条规则引用`);
  const detail=parts.length?`<p>检测到 ${parts.join("、")}。</p>`:"";
  studioModal("确认删除节点",`${detail}<p>这个节点可能被规则、边或调查点引用。删除后可能影响运行房。</p><div class="rule-block"><strong>${escapeHtml(studioNodeName(state.cloudStudio,selected.type,selected.id))}</strong></div>`,"确认删除",async()=>{try{await zhimuApi.deleteStudioNode(selected.type,selected.id);state.studioSelectedNode=null;closeModal();await loadCloudData();showToast("节点及相关连线已删除")}catch(error){showToast(error.message)}});
 }catch(error){showToast(error.message)}
}

async function deleteStudioEdge(edgeId){
 try{await zhimuApi.deleteStoryEdge(edgeId);await loadCloudData();showToast("剧情连线已删除")}catch(error){showToast(error.message)}
}

function openStudioChapter(){
 studioModal("新增公共章节",studioField("章节名称","title")+studioField("章节摘要","summary","textarea"),"写入云端",async()=>{try{const values=studioValues();await zhimuApi.createStudioChapter({...values,sequence:(state.cloudStudio?.chapters.length||0)+1});closeModal();await loadCloudData();showToast("公共章节已写入剧情线")}catch(error){showToast(error.message)}});
}

function openStudioNodeMenu(){
 modal.className="modal";modal.innerHTML=`<h2>在画布中新增节点</h2><p>先选择节点类型，再填写内容。新增后节点会直接进入当前剧情画布。</p><div class="node-type-grid"><button data-node-create="scene"><b>场景节点</b><span>公开地点、房间或可进入区域</span></button><button data-node-create="clue"><b>线索节点</b><span>玩家获得后可阅读的证据</span></button><button data-node-create="item"><b>物品节点</b><span>钥匙、证件、道具等可发放物品</span></button><button data-node-create="point"><b>调查点节点</b><span>场景内可点击搜证的位置</span></button><button data-node-create="chapter"><b>章节</b><span>公共剧情阶段与发布单位</span></button></div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelectorAll("[data-node-create]").forEach(button=>button.onclick=()=>{closeModal();({scene:openStudioScene,clue:openStudioClue,item:openStudioItem,point:openStudioPoint,chapter:openStudioChapter})[button.dataset.nodeCreate]()});
}

function openStudioScene(){
 const chapters=state.cloudStudio?.chapters||[];
 studioModal("新增公共场景",(chapters.length?studioSelect("所属章节","chapterId",chapters):"")+studioField("场景名称","name")+studioField("玩家可见说明","publicText","textarea")+studioField("主持人备注","hostText","textarea"),"写入云端",async()=>{try{await zhimuApi.createScene(studioValues());closeModal();await loadCloudData();showToast("公共场景已加入剧情线")}catch(error){showToast(error.message)}});
}

function openStudioClue(){
 studioModal("新增剧本杀线索",studioField("线索名称","name")+studioField("获得后可见内容","publicText","textarea")+studioField("主持人解释","hostText","textarea"),"写入云端",async()=>{try{await zhimuApi.createClue({...studioValues(),visibility:"role"});closeModal();await loadCloudData();showToast("线索已加入剧情线")}catch(error){showToast(error.message)}});
}

function openStudioItem(){
 const assets=state.cloudAssets||[];
 studioModal("新增物品",
  studioField("物品名称","name")+
  studioField("物品描述","publicText","textarea")+
  `<label class="studio-check-row"><input type="checkbox" data-studio-boolean="unique"> 是否唯一（同一角色不可重复获得）</label>`+
  `<label class="studio-check-row"><input type="checkbox" data-studio-boolean="consumable"> 是否可消耗（使用后消失）</label>`+
  (assets.length?studioSelect("关联资产","assetId",[{id:"",name:"不关联附件"},...assets.map(asset=>({id:asset.id,name:asset.original_filename}))]):"")+
  studioField("主持备注","hostText","textarea"),
  "写入云端",async()=>{try{const values=studioValues();document.querySelectorAll("[data-studio-boolean]").forEach(input=>{values[input.dataset.studioBoolean]=input.checked});await zhimuApi.createItem({name:values.name,publicText:values.publicText,hostText:values.hostText,unique:Boolean(values.unique),consumable:Boolean(values.consumable),assetId:values.assetId||null});closeModal();await loadCloudData();showToast("物品已加入剧情线")}catch(error){showToast(error.message)}});
}

function openStudioPoint(){
 const scenes=state.cloudStudio?.scenes||[], clues=state.cloudStudio?.clues||[], items=state.cloudStudio?.items||[];
 if(!scenes.length)return showToast("请先创建一个公共场景");
 studioModal("新增场景调查点",studioSelect("所属场景","sceneId",scenes)+studioField("调查点名称","name")+studioField("玩家看到的描述","description","textarea")+studioField("调查结果","resultText","textarea")+(clues.length?studioSelect("发现线索","clueId",[{id:"",name:"不发放线索"},...clues]):"")+(items.length?studioSelect("需要物品","requiredItemId",[{id:"",name:"不需要物品"},...items]):""),"写入云端",async()=>{try{const values=studioValues();const sceneId=values.sceneId;delete values.sceneId;if(!values.clueId)delete values.clueId;if(!values.requiredItemId)delete values.requiredItemId;await zhimuApi.createInvestigationPoint(sceneId,values);closeModal();await loadCloudData();showToast("调查点已加入公共场景")}catch(error){showToast(error.message)}});
}

function openStudioConnection(){
 const selected=state.studioSelectedNode,nodes=studioNodeList(state.cloudStudio).filter(node=>!(node.type===selected.type&&node.id===selected.id));
 if(!nodes.length)return showToast("请先创建另一个场景、线索或调查点");
 studioModal("创建剧情连线",studioSelect("目标节点","target",nodes.map(node=>({id:`${node.type}:${node.id}`,name:node.name})))+studioSelect("关系类型","relationType",[{id:"mainline",name:"主线 · 核心推进路径"},{id:"parallel",name:"并列 · 同阶段可同时发生"},{id:"extension",name:"延伸 · 支线或后续补充"}])+studioField("连线备注","label"),"写入云端",async()=>{try{const values=studioValues(),[toType,toId]=values.target.split(":");await zhimuApi.createStoryEdge({fromType:selected.type,fromId:selected.id,toType,toId,relationType:values.relationType,label:values.label});closeModal();await loadCloudData();showToast("剧情连线已写入云端")}catch(error){showToast(error.message)}});
}

function openStudioDragConnection(from,to){
 studioModal("确认拖拽连线",`<div class="rule-block">${studioNodeName(state.cloudStudio,from.type,from.id)} → ${studioNodeName(state.cloudStudio,to.type,to.id)}</div>`+studioSelect("关系类型","relationType",[{id:"mainline",name:"主线 · 核心推进路径"},{id:"parallel",name:"并列 · 同阶段可同时发生"},{id:"extension",name:"延伸 · 支线或后续补充"}])+studioField("连线备注","label"),"写入云端",async()=>{try{const values=studioValues();await zhimuApi.createStoryEdge({fromType:from.type,fromId:from.id,toType:to.type,toId:to.id,relationType:values.relationType,label:values.label});closeModal();await loadCloudData();showToast("拖拽连线已写入云端")}catch(error){showToast(error.message)}});
}
  viewExports.studioCloud = studioCloud;
  viewExports.studioNodes = studioNodes;
  viewExports.studioNode = studioNode;
  viewExports.studioNodeList = studioNodeList;
  viewExports.studioVisibleNodes = studioVisibleNodes;
  viewExports.studioFilterButton = studioFilterButton;
  viewExports.studioCompactSelection = studioCompactSelection;
  viewExports.studioDefaultPositions = studioDefaultPositions;
  viewExports.studioNodePosition = studioNodePosition;
  viewExports.studioNodeRecord = studioNodeRecord;
  viewExports.studioNodeAnchors = studioNodeAnchors;
  viewExports.setStudioNodePosition = setStudioNodePosition;
  viewExports.setStudioNodeAnchors = setStudioNodeAnchors;
  viewExports.closestStudioAnchorPair = closestStudioAnchorPair;
  viewExports.studioNodeName = studioNodeName;
  viewExports.studioEdges = studioEdges;
  viewExports.studioSelection = studioSelection;
  viewExports.studioEditField = studioEditField;
  viewExports.studioEditSelect = studioEditSelect;
  viewExports.studioEditValues = studioEditValues;
  viewExports.studioNodeEditPanel = studioNodeEditPanel;
  viewExports.bindStudioDragging = bindStudioDragging;
  viewExports.addStudioAnchor = addStudioAnchor;
  viewExports.deleteStudioAnchor = deleteStudioAnchor;
  viewExports.refreshStudioConnectors = refreshStudioConnectors;
  viewExports.autoLayoutStudio = autoLayoutStudio;
  viewExports.saveSelectedStudioNode = saveSelectedStudioNode;
  viewExports.deleteSelectedStudioNode = deleteSelectedStudioNode;
  viewExports.deleteStudioEdge = deleteStudioEdge;
  viewExports.openStudioChapter = openStudioChapter;
  viewExports.openStudioNodeMenu = openStudioNodeMenu;
  viewExports.openStudioScene = openStudioScene;
  viewExports.openStudioClue = openStudioClue;
  viewExports.openStudioItem = openStudioItem;
  viewExports.openStudioPoint = openStudioPoint;
  viewExports.openStudioConnection = openStudioConnection;
  viewExports.openStudioDragConnection = openStudioDragConnection;
})(window);
