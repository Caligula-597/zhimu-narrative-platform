/* Auto-split from app.js — player.js */
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
  const go = window.zhimuGo;
  function render() { window.zhimuRender?.(); }
  function loadCloudData(...args) { return window.zhimuLoadCloudData(...args); }
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const viewExports = window.zhimuViews.player = window.zhimuViews.player || {};
function hostConfirmBanner(){
 const hc=state.cloudPlayer?.hostConfirm;
 if(!hc?.pendingCount)return "";
 if(hc.waitingForYou){
  const sample=hc.titles?.[0]?`「${escapeHtml(hc.titles[0])}」`:"";
  return `<section class="demo-strip host-confirm-wait"><div><span class="cloud-pill">等待主持</span><strong>剧情推进等待主持人确认</strong><p>${sample}${hc.pendingCount>1?` 等 ${hc.pendingCount} 条`:""} — 确认后你会收到通知，页面会自动刷新。</p></div></section>`;
 }
 return `<section class="demo-strip host-confirm-room"><div><span class="cloud-pill">进行中</span><strong>主持人正在处理 ${hc.pendingCount} 条待确认事件</strong><p>与你相关的解锁会在确认后实时推送。</p></div></section>`;
}

function recapEntryBanner(){
 const latest=state.cloudRecapLatest;
 if(!latest)return "";
 return `<section class="demo-strip recap-entry-strip"><div><span class="cloud-pill">复盘就绪</span><strong>${escapeHtml(latest.label)}</strong><p>主持人已生成复盘 · ${latest.summary?.cluesDiscovered??0} 条线索流转 · ${latest.summary?.investigationsCompleted??0} 次调查</p></div><button class="secondary-btn" data-action="player-view-recap">查看我的复盘</button></section>`;
}

function player(){
 const room=activeRuntimeRoom(),home=state.cloudPlayer,role=home?.role;
 if(!room)return runtimeEmpty("玩家视角","玩家视角必须来自当前世界中的具体运行房。请先建立平行房，并让玩家通过邀请码选择角色。");
 if(!role)return `${cloudStatus()}<article class="card runtime-empty"><p class="eyebrow">PLAYER ROLE REQUIRED</p><h2>${escapeHtml(room.name)} 尚无可预览角色</h2><p>当前预览账号尚未加入这个运行房，或尚未选择角色席位。玩家加入后，这里才会读取该角色的私人章节、线索和语音空间。</p><button class="primary-btn" data-action="world-rooms">切换平行房</button></article>`;
 const scene=currentCloudScene(),parts=roleParts(role.name);
 return `<section class="player-view">${cloudStatus()}${hostConfirmBanner()}${recapEntryBanner()}${voiceHub()}<article class="player-hero live-flash"><div class="player-hero-copy"><p class="eyebrow">${escapeHtml(parts.name)} · 当前开放场景</p><h2>${escapeHtml(scene.title)}</h2><p>${escapeHtml(scene.text)}</p></div><div class="scene-art">${escapeHtml(scene.art)}</div></article>
 ${reader()}
 <section class="player-layout"><div><article class="card"><div class="section-head"><div><h3>探索当前场景</h3><p>阅读完成后，可以选择地点继续调查</p></div></div>
 ${explorationRows()}
 </article></div><aside>
 <article class="card inventory-card"><div class="section-head"><div><h3>我的背包</h3><p>${escapeHtml(parts.name)} · 持有 ${(home.inventory||[]).length} 种物品</p></div></div>${inventoryRows()}</article>
 <article class="role-story"><p class="section-kicker">仅你可见 · 角色资料</p><h3>${escapeHtml(role.name)}</h3><p>${escapeHtml(role.private_profile||"当前角色尚未填写私人资料。")}</p></article>
 <article class="card"><div class="section-head"><div><h3>我的云端线索</h3><p>${escapeHtml(parts.name)} · 已获得 ${(home.clues||[]).length} 条</p></div></div>${cloudClueRows()}</article>
 ${sharedClueSection()}
 </aside></section></section>`;
}

function voiceLiveStatusLabel(){
 if(state.voiceLiveStatus==="error"&&state.voiceLiveError)return state.voiceLiveError;
 return ({idle:"音频未连接",connecting:"正在连接 LiveKit…",connected:"音频已连接",error:"音频连接失败 · 仍可使用文字频道"})[state.voiceLiveStatus]||"音频未连接";
}

function voiceHub(){const room=(state.cloudPlayer?.voiceRooms||[]).find(item=>item.id===state.voiceRoomId),participants=voiceHubParticipants(),connected=state.voiceLiveStatus==="connected",connecting=state.voiceLiveStatus==="connecting",failed=state.voiceLiveStatus==="error";return `<section class="voice-stack"><section class="voice-hub ${failed?"voice-hub-error":""}"><div class="voice-hub-left"><div class="voice-hub-icon">${connected?"🎙":connecting?"…":"♬"}</div><div><strong>语音空间 · ${escapeHtml(room?.name||"尚未选择")}</strong><p>${room?.room_type==="public"?"所有房间成员可进入":"私密通话 · 仅受邀玩家可见"} · ${voiceLiveStatusLabel()}${connected&&participants.length?` · ${participants.length} 人在线`:""}</p></div></div><div class="row voice-hub-actions"><div class="voice-hub-users">${participants.slice(0,8).map(participant=>`<div class="avatar ${participant.micEnabled===false?"avatar-muted":""}" title="${escapeHtml(participant.name)}">${escapeHtml(String(participant.name)[0])}</div>`).join("")}</div>${connected?`<button class="secondary-btn" data-action="voice-mic-toggle">${state.voiceMicEnabled?"🎙 麦克风开":"🔇 麦克风关"}</button><button class="secondary-btn" data-action="voice-live-disconnect">退出音频</button>`:(room&&!connecting?`<button class="primary-btn" data-action="voice-live-connect">${failed?"重试音频连接":"连接音频"}</button>`:"")}<button class="secondary-btn" data-action="voice-room">切换语音房</button></div></section>${voiceChat()}</section>`}

function voiceChat(){const messages=state.voiceMessages||[];return `<article class="voice-chat"><div class="voice-chat-head"><div><strong>房内文字频道</strong><p>文字消息与 LiveKit 音频并行；无音频配置时仍可使用文字讨论。</p></div><button class="text-btn" data-action="voice-chat-refresh">刷新</button></div><div class="voice-chat-log">${messages.length?messages.map(message=>`<div class="voice-message"><b>${escapeHtml(message.sender_name||"玩家")}</b><span>${formatTime(message.created_at)}</span><p>${escapeHtml(message.body)}</p></div>`).join(""):`<div class="empty-state">当前语音房还没有消息。</div>`}</div><div class="voice-chat-compose"><input class="field" data-voice-chat-input placeholder="发送给当前语音房成员"><button class="primary-btn" data-action="voice-chat-send">发送</button></div></article>`}

function currentCloudScene(){const scenes=state.cloudExploration?.scenes||[],scene=scenes[scenes.length-1];return scene?{title:scene.name,text:scene.public_text,art:scene.name[0]}:{title:"等待主持人开放场景",text:"当前运行房还没有开放探索场景。完成角色阅读或由主持人推进规则后，新场景会出现在这里。",art:"候"}}

function sectionHighlights(sectionId){
 return (state.cloudPlayer?.notes||[]).filter(note=>note.source_type==="script_section"&&note.source_id===sectionId);
}

const HIGHLIGHT_OFFSET_RE=/#(\d+):(\d+)$/;

function parseHighlightOffsets(entry){
 const match=entry?.title?.match(HIGHLIGHT_OFFSET_RE);
 if(!match)return null;
 const start=Number(match[1]),end=Number(match[2]);
 if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start)return null;
 return {start,end};
}

function highlightEntryTitle(sectionTitle,start,end){
 return `高亮 · ${sectionTitle}#${start}:${end}`;
}

function legacyHighlightRange(text,entry){
 const needle=entry.body;
 if(!needle||!text)return null;
 const idx=text.indexOf(needle);
 if(idx===-1)return null;
 return {start:idx,end:idx+needle.length,id:entry.id};
}

function collectHighlightRanges(text,entries){
 const ranges=[];
 for(const entry of entries||[]){
  const offsets=parseHighlightOffsets(entry);
  let range=null;
  if(offsets&&offsets.end<=text.length)range={...offsets,id:entry.id};
  else range=legacyHighlightRange(text,entry);
  if(!range)continue;
  const overlaps=ranges.some(item=>!(range.end<=item.start||range.start>=item.end));
  if(!overlaps)ranges.push(range);
 }
 ranges.sort((a,b)=>a.start-b.start);
 return ranges;
}

function applyStoryHighlights(text,entries){
 if(!text)return escapeHtml(text||"");
 const ranges=collectHighlightRanges(text,entries);
 if(!ranges.length)return escapeHtml(text);
 let html="",pos=0;
 for(const range of ranges){
  html+=escapeHtml(text.slice(pos,range.start));
  html+=`<mark class="story-highlight" data-highlight-id="${escapeHtml(range.id)}" title="点击取消高亮">${escapeHtml(text.slice(range.start,range.end))}</mark>`;
  pos=range.end;
 }
 html+=escapeHtml(text.slice(pos));
 return html;
}

function getSectionPlainBody(sectionId){
 return state.cloudPlayer?.sections?.find(section=>section.id===sectionId)?.body||"";
}

function getReaderSelectionOffsets(container){
 const selection=window.getSelection();
 if(!selection||selection.isCollapsed||!selection.rangeCount)return null;
 const range=selection.getRangeAt(0);
 if(!container.contains(range.commonAncestorContainer))return null;
 const prefix=document.createRange();
 prefix.selectNodeContents(container);
 prefix.setEnd(range.startContainer,range.startOffset);
 const start=prefix.toString().length;
 const end=start+range.toString().length;
 if(end<=start)return null;
 return {start,end,text:range.toString()};
}

function reader(){
 const cloudSections=state.cloudPlayer?.sections||[];
 const cloudSection=cloudSections.find(section=>!section.completed)||cloudSections[cloudSections.length-1];
 const roleName=state.cloudPlayer?.role?.name||"当前角色";
 if(cloudSection){
  const highlights=sectionHighlights(cloudSection.id);
  const isPages=cloudSection.content_mode==="pages"||cloudSection.metadata?.contentMode==="pages";
  const pages=cloudSection.pages||[];
  const highlightHint=highlights.length?`已高亮 ${highlights.length} 处`:"拖选任意词句后点「高亮」";
  const bodyHtml=isPages&&pages.length?`<div class="reader-pages">${pages.map((page,index)=>`<figure class="reader-page"><img src="${escapeHtml(page.url)}" alt="第 ${index+1} 页" loading="lazy" decoding="async"><figcaption>第 ${index+1} / ${pages.length} 页</figcaption></figure>`).join("")}</div>`:`<div class="story-body" data-reader-body data-section-id="${cloudSection.id}" data-section-title="${escapeHtml(cloudSection.title)}">${applyStoryHighlights(cloudSection.body,highlights)}</div><p class="reader-highlight-hint">${highlightHint} · 点击已高亮文字可取消</p>`;
  const footerHint=isPages?"滑动查看全部页面，读完后点击下方按钮记录进度。":"由你主动确认阅读完成，系统不会自动跳转。";
  return `<article class="reader-card ${isPages?"reader-card-pages":""}"><div class="reader-head"><div><p class="section-kicker">${escapeHtml(roleName)} · 云端私人章节</p><h3>${escapeHtml(cloudSection.title)}</h3><p>${isPages?`图片分幕 · 共 ${pages.length||cloudSection.metadata?.pageCount||"?"} 页`:"内容来自云端私人剧本。阅读完成后会保存进度并可能触发规则。"}</p></div><span class="reader-progress">${cloudSection.sequence} / ${cloudSections.length}</span></div>${bodyHtml}<div class="reader-footer"><p>${cloudSection.completed?"本章节已完成，可以继续查看已解锁内容。":footerHint}</p><button class="primary-btn" data-action="read-cloud-next" data-section="${cloudSection.id}" ${cloudSection.completed?"disabled":""}>${cloudSection.completed?"已完成":"我已读完，保存并继续"}</button></div></article>`;
 }
 return `<article class="reader-card"><div class="empty-state">当前角色尚未解锁私人章节。请由主持人检查房间规则或等待后续推进。</div></article>`;
}

function inventoryRows(){
 const items=state.cloudPlayer?.inventory||[];
 if(!items.length)return `<div class="tutorial-tip"><b>背包为空</b><span>主持人发放物品后，钥匙、证件和道具会显示在这里。</span></div>`;
 return items.map(item=>`<div class="inventory-row"><div class="inventory-icon">◆</div><div><strong>${escapeHtml(item.name)}</strong>${item.quantity>1?`<span class="status-chip draft">×${item.quantity}</span>`:""}${item.metadata?.consumable?`<span class="status-chip testing">可消耗</span>`:""}<p>${escapeHtml(item.public_text||"暂无描述")}</p></div></div>`).join("");
}

function explorationRows(){
 const scenes=state.cloudExploration?.scenes||[];
 if(!scenes.length)return `<div class="tutorial-tip"><b>暂无开放场景</b><span>请由主持人在运行台开放一个探索场景。</span></div>`;
 return scenes.map(scene=>`<div class="tutorial-tip"><b>${escapeHtml(scene.name)}</b><span>${escapeHtml(scene.public_text)}</span></div>${(scene.investigation_points||[]).map(point=>{
  const needsItem=point.requiredItemId&&!point.hasRequiredItem;
  const itemHint=point.requiredItemId?`<small class="item-requirement">${point.hasRequiredItem?`需要物品：${escapeHtml(point.requiredItemName||"指定物品")}`:`缺少物品：${escapeHtml(point.requiredItemName||"指定物品")}`}</small>`:"";
  const disabled=point.investigated||needsItem;
  const label=point.investigated?"已调查":needsItem?"无法调查":"调查";
  const btnClass=point.investigated?"secondary-btn":needsItem?"secondary-btn":"primary-btn";
  return `<div class="location-row ${needsItem?"location-locked":""}"><div class="location-icon">⌕</div><div><strong>${escapeHtml(point.name)}</strong><p>${escapeHtml(point.description)}</p>${itemHint}</div><button class="${btnClass}" data-action="investigate-cloud" data-point="${point.id}" ${disabled?"disabled":""} title="${needsItem?`需要物品：${point.requiredItemName||""}`:""}">${label}</button></div>`;
 }).join("")}`).join("");
}

function cloudClueRows(){
 const clues=state.cloudPlayer?.clues||[];
 if(!clues.length)return `<div class="tutorial-tip"><b>尚无线索</b><span>调查场景中的可交互位置，发现内容后会自动进入个人线索库。</span></div>`;
 return clues.map(item=>{
  const roleShareCount=(item.shared_with_roles||[]).length;
  const sharedRoles=roleShareCount>0;
  return `<div class="clue-row ${item.shared_with_room?"clue-row-public":sharedRoles?"clue-row-private":""}"><div class="clue-row-head"><strong>${escapeHtml(item.name)}</strong>${item.shared_with_room?`<span class="status-chip published">已公开</span>`:""}${sharedRoles?`<span class="status-chip testing">已私享 ${roleShareCount} 人</span>`:""}${item.read_at?`<span class="status-chip testing">已读</span>`:`<span class="status-chip draft">未读</span>`}</div><p>${escapeHtml(item.public_text)}</p>${item.player_note?`<div class="clue-note-box"><b>我的解读</b><p>${escapeHtml(item.player_note)}</p></div>`:""}<div class="row clue-row-actions"><button class="text-btn" data-action="read-cloud-clue" data-clue="${item.id}" ${item.read_at?"disabled":""}>${item.read_at?"已阅读":"标记已读"}</button><button class="text-btn" data-action="edit-clue-note" data-clue="${item.id}">${item.player_note?"修改解读":"添加解读"}</button><button class="text-btn" data-action="share-cloud-clue" data-clue="${item.id}">${item.shared_with_room?"取消公开":"公开到全房间"}</button><button class="text-btn" data-action="share-clue-roles" data-clue="${item.id}">${sharedRoles?"调整私享":"私享给指定玩家"}</button></div></div>`;
 }).join("");
}

function sharedClueSection(){
 const shared=state.cloudPlayer?.sharedClues||[];
 if(!shared.length)return "";
 const roomShared=shared.filter(item=>item.shared_scope!=="roles");
 const roleShared=shared.filter(item=>item.shared_scope==="roles");
 let html="";
 if(roomShared.length){
  html+=`<article class="card shared-clues-card"><div class="section-head"><div><h3>公共讨论区 · 已公开线索</h3><p>其他玩家选择公开分享的线索，全房间可见</p></div></div>${roomShared.map(item=>sharedClueRow(item,"published","来自 "+escapeHtml(item.owner_player_name||item.owner_role_name||"玩家"))).join("")}</article>`;
 }
 if(roleShared.length){
  html+=`<article class="card shared-clues-card shared-clues-private"><div class="section-head"><div><h3>私享线索 · 仅指定玩家可见</h3><p>其他玩家定向分享给你的线索，不会进入全房间讨论区</p></div></div>${roleShared.map(item=>sharedClueRow(item,"testing","私享 · "+escapeHtml(item.owner_player_name||item.owner_role_name||"玩家"))).join("")}</article>`;
 }
 return html;
}

function sharedClueRow(item,chipClass,chipLabel){
 return `<div class="clue-row shared"><div class="clue-row-head"><strong>${escapeHtml(item.name)}</strong><span class="status-chip ${chipClass}">${chipLabel}</span></div><p>${escapeHtml(item.public_text)}</p>${item.player_note?`<div class="clue-note-box"><b>分享者解读</b><p>${escapeHtml(item.player_note)}</p></div>`:""}<div class="row clue-row-actions"><button class="text-btn" data-action="read-shared-clue" data-clue="${item.id}" data-shared="1" ${item.read_by_me?"disabled":""}>${item.read_by_me?"已阅读":"标记已读"}</button></div></div>`;
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

function openInviteVoiceRoom(roomId,roomName){
 const seats=state.cloudPlayer?.roomMembers||[],currentUserId=zhimuApi.context.playerUserId;
 modal.className="modal";modal.innerHTML=`<h2>邀请成员 · ${escapeHtml(roomName)}</h2><p class="wizard-intro">从已经进入当前平行房的角色中追加邀请。新成员会立即获得这个密谈文字频道的访问权限。</p><div class="member-picker">${seats.map(member=>{const self=member.user_id===currentUserId,disabled=self||!member.online;return `<label class="${disabled?"member-disabled":""}"><input type="checkbox" data-voice-invite value="${member.user_id||""}" ${disabled?"disabled":""}> <span><b>${escapeHtml(member.role_name||"未命名角色")}</b>${member.display_name?` · ${escapeHtml(member.display_name)}`:""}${self?" · 当前角色":member.online?" · 可追加邀请":" · 尚未进入平行房"}</span></label>`}).join("")||`<div class="empty-state">当前平行房尚未建立角色成员。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-invite-submit>发送邀请</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;modal.querySelector("[data-invite-submit]").onclick=async()=>{const inviteUserIds=[...modal.querySelectorAll("[data-voice-invite]:checked")].map(input=>input.value);if(!inviteUserIds.length)return showToast("请至少选择一名已进入平行房的玩家");try{await zhimuApi.inviteVoiceRoomMembers(roomId,inviteUserIds);closeModal();await loadCloudData();showToast("密谈成员已追加邀请")}catch(error){showToast(error.message)}};
}

function voiceHubParticipants(){
 if(state.voiceParticipants?.length)return state.voiceParticipants;
 return (state.cloudPlayer?.roomMembers||[]).filter(member=>member.online).map(member=>({name:member.display_name||member.role_name||"?",micEnabled:null,isLocal:false}));
}

async function connectVoiceLive(){
 if(!state.voiceRoomId)return showToast("请先选择语音房");
 try{
  state.voiceLiveError="";
  const tokenPayload=await zhimuApi.getVoiceRoomToken(state.voiceRoomId);
  await window.zhimuLiveKitVoice.connectVoiceRoom(tokenPayload);
  showToast("LiveKit 音频已连接");
 }catch(error){
  state.voiceLiveStatus="error";
  state.voiceLiveError=error.message||"音频连接失败";
  render();
  showToast(/LiveKit|503|403|未加载/.test(error.message)?`${error.message} · 仍可使用文字频道`:error.message);
 }
}

async function disconnectVoiceLive(){
 await window.zhimuLiveKitVoice?.disconnectVoiceRoom?.();
 render();
 showToast("已退出音频连接");
}

async function toggleVoiceMic(){
 try{
  const enabled=await window.zhimuLiveKitVoice.toggleVoiceMic();
  showToast(enabled?"麦克风已开启":"麦克风已关闭");
 }catch(error){showToast(error.message)}
}

async function joinVoiceRoom(roomId,roomName){
 if(state.voiceRoomId&&state.voiceRoomId!==roomId)await window.zhimuLiveKitVoice?.disconnectVoiceRoom?.();
 state.voiceRoomId=roomId;state.voiceRoom=roomName;state.voiceLiveError="";closeModal();await refreshVoiceMessages();
 try{
  const tokenPayload=await zhimuApi.getVoiceRoomToken(roomId);
  await window.zhimuLiveKitVoice.connectVoiceRoom(tokenPayload);
  showToast(`已进入 ${roomName} · 音频已连接`);
 }catch(error){
  state.voiceLiveStatus="error";
  state.voiceLiveError=error.message||"音频连接失败";
  render();
  showToast(/LiveKit|503|403|未加载/.test(error.message)?`${error.message} · 仍可使用文字频道`:error.message);
 }
}

async function refreshVoiceMessages(){if(!state.voiceRoomId)return;try{state.voiceMessages=await zhimuApi.getVoiceMessages(state.voiceRoomId);render()}catch(error){showToast(error.message)}}

async function sendVoiceMessage(){const input=document.querySelector("[data-voice-chat-input]"),body=input?.value.trim();if(!body)return showToast("请输入聊天内容");try{await zhimuApi.sendVoiceMessage(state.voiceRoomId,body);await refreshVoiceMessages();showToast("消息已发送到当前语音房")}catch(error){showToast(error.message)}}

function hideHighlightToolbar(){
 const toolbar=document.querySelector(".highlight-toolbar");
 if(toolbar)toolbar.remove();
}

function showHighlightToolbar(rect,sectionId,sectionTitle,selection){
 hideHighlightToolbar();
 const toolbar=document.createElement("div");
 toolbar.className="highlight-toolbar";
 const preview=selection.text.length>28?`${selection.text.slice(0,28)}…`:selection.text;
 toolbar.innerHTML=`<button type="button" class="primary-btn highlight-toolbar-btn" data-highlight-add>高亮</button><span class="highlight-toolbar-preview">「${escapeHtml(preview)}」</span>`;
 document.body.appendChild(toolbar);
 const left=Math.min(Math.max(rect.left+rect.width/2,80),window.innerWidth-80);
 const top=Math.max(rect.top,56);
 toolbar.style.left=`${left}px`;
 toolbar.style.top=`${top}px`;
 toolbar.querySelector("[data-highlight-add]").onclick=async(event)=>{
  event.preventDefault();
  event.stopPropagation();
  hideHighlightToolbar();
  window.getSelection()?.removeAllRanges();
  await addStoryHighlight(sectionId,sectionTitle,selection);
 };
}

function bindPlayerReader(){
 const body=document.querySelector("[data-reader-body]");
 if(!body)return;
 hideHighlightToolbar();
 body.onmouseup=(event)=>{
  if(event.target.closest?.(".highlight-toolbar"))return;
  window.setTimeout(()=>{
   const selection=getReaderSelectionOffsets(body);
   if(!selection||selection.text.trim().length<1)return hideHighlightToolbar();
   const range=window.getSelection()?.getRangeAt(0);
   if(!range)return hideHighlightToolbar();
   showHighlightToolbar(range.getBoundingClientRect(),body.dataset.sectionId,body.dataset.sectionTitle,selection);
  },0);
 };
 body.onclick=(event)=>{
  const active=window.getSelection();
  if(active&&!active.isCollapsed)return;
  const mark=event.target.closest?.(".story-highlight");
  if(mark?.dataset.highlightId)removeStoryHighlight(mark.dataset.highlightId);
 };
 if(!window.__zhimuHighlightDocBound){
  window.__zhimuHighlightDocBound=true;
  document.addEventListener("mousedown",(event)=>{
   if(event.target.closest?.(".highlight-toolbar")||event.target.closest?.("[data-reader-body]"))return;
   hideHighlightToolbar();
  });
 }
}

async function completeCloudReading(sectionId){
 try{await zhimuApi.completeSection(sectionId);await loadCloudData();showToast("已记录阅读进度，可能触发新的剧情解锁。",3200)}catch(error){showToast(error.message)}
}

async function addStoryHighlight(sectionId,sectionTitle,selection){
 const plain=getSectionPlainBody(sectionId);
 if(!plain)return showToast("无法读取当前章节正文");
 const {start,end}=selection;
 if(end<=start||start<0||end>plain.length)return showToast("选区无效，请重新选择");
 const snippet=plain.slice(start,end);
 if(!snippet.trim())return showToast("不能只高亮空白字符");
 if(sectionHighlights(sectionId).some(entry=>{const off=parseHighlightOffsets(entry);return off&&off.start===start&&off.end===end}))return showToast("这段内容已经高亮过了");
 try{
  await zhimuApi.addNotebookEntry({sourceType:"script_section",sourceId:sectionId,title:highlightEntryTitle(sectionTitle,start,end),body:snippet});
  await loadCloudData();
  showToast("已标记高亮");
 }catch(error){showToast(error.message)}
}

async function removeStoryHighlight(entryId){
 try{
  await zhimuApi.deleteNotebookEntry(entryId);
  await loadCloudData();
  showToast("已取消高亮");
 }catch(error){showToast(error.message)}
}

async function investigateCloud(pointId){
 try{
  const result=await zhimuApi.investigate(pointId);
  await loadCloudData();
  if(result.clue?.name)showToast(`调查完成。你获得了新线索：${result.clue.name}。主持事件可能已触发。`,3600);
  else showToast("调查完成，新的线索或主持事件可能已触发。",3200);
  openModal("调查完成",`${result.resultText}${result.clue?`<br><br><strong>获得线索：${escapeHtml(result.clue.name)}</strong><br>${escapeHtml(result.clue.public_text)}`:""}${result.executedRules?.length?`<br><br><small>已触发 ${result.executedRules.length} 条自动化规则。</small>`:""}`,"继续探索");
 }catch(error){showToast(error.message)}
}

async function readCloudClue(clueId,isShared=false){
 try{
  const clue=(state.cloudPlayer?.clues||[]).find(item=>item.id===clueId)||(state.cloudPlayer?.sharedClues||[]).find(item=>item.id===clueId);
  await zhimuApi.readClue(clueId);
  await loadCloudData();
  showToast(clue?.name?`已阅读线索：${clue.name}`:isShared?"已记录公开线索阅读":"线索阅读状态已保存");
 }catch(error){showToast(error.message)}
}

async function shareCloudClue(clueId){
 const clue=(state.cloudPlayer?.clues||[]).find(item=>item.id===clueId);
 if(!clue)return showToast("线索不存在");
 const next=!clue.shared_with_room;
 try{
  await zhimuApi.shareClueToRoom(clueId,next);
  await loadCloudData();
  showToast(next?`已公开「${clue.name}」到全房间`:`已取消公开「${clue.name}」`);
 }catch(error){showToast(error.message)}
}

function openShareClueRolesModal(clueId){
 const clue=(state.cloudPlayer?.clues||[]).find(item=>item.id===clueId);
 if(!clue)return showToast("只能私享自己拥有的线索");
 const myRoleId=state.cloudPlayer?.role?.id;
 const seats=(state.cloudPlayer?.roomMembers||[]).filter(member=>member.role_slot_id!==myRoleId);
 const selected=new Set(clue.shared_with_roles||[]);
 modal.className="modal";
 modal.innerHTML=`<h2>私享线索 · ${escapeHtml(clue.name)}</h2><p class="wizard-intro">选择可以查看这条线索的玩家角色。私享不会进入全房间讨论区；保存私享时会取消「公开到全房间」状态。</p><div class="member-picker">${seats.map(member=>{const disabled=!member.online&&!selected.has(member.role_slot_id);return `<label class="${disabled&&!selected.has(member.role_slot_id)?"member-disabled":""}"><input type="checkbox" data-share-role value="${member.role_slot_id}" ${selected.has(member.role_slot_id)?"checked":""} ${disabled&&!selected.has(member.role_slot_id)?"disabled":""}> <span><b>${escapeHtml(member.role_name||"未命名角色")}</b>${member.display_name?` · ${escapeHtml(member.display_name)}`:""}${member.online?" · 已入房":" · 尚未入房"}</span></label>`}).join("")||`<div class="empty-state">当前世界没有其他角色席位。</div>`}</div><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-share-roles-submit>保存私享</button></div>`;
 modalBackdrop.classList.add("show");
 modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-share-roles-submit]").onclick=async()=>{
  try{
   const roleSlotIds=[...modal.querySelectorAll("[data-share-role]:checked")].map(input=>input.value);
   await zhimuApi.shareClueToRoles(clueId,roleSlotIds);
   closeModal();
   await loadCloudData();
   showToast(roleSlotIds.length?`已私享给 ${roleSlotIds.length} 名玩家`:"已清空私享名单");
  }catch(error){showToast(error.message)}
 };
}

function openClueNoteModal(clueId){
 const clue=(state.cloudPlayer?.clues||[]).find(item=>item.id===clueId);
 if(!clue)return showToast("只能为自己拥有的线索添加解读");
 modal.className="modal";modal.innerHTML=`<h2>我的线索解读 · ${escapeHtml(clue.name)}</h2><p class="wizard-intro">写下你对这条线索的理解。公开线索时，其他玩家也能看到你的解读。</p><textarea class="field" rows="5" data-clue-note>${escapeHtml(clue.player_note||"")}</textarea><div class="modal-actions"><button class="secondary-btn" data-close>取消</button><button class="primary-btn" data-save-clue-note>保存解读</button></div>`;
 modalBackdrop.classList.add("show");modal.querySelector("[data-close]").onclick=closeModal;
 modal.querySelector("[data-save-clue-note]").onclick=async()=>{try{const note=modal.querySelector("[data-clue-note]").value;await zhimuApi.updateCluePlayerNote(clueId,note);closeModal();await loadCloudData();showToast("线索解读已保存")}catch(error){showToast(error.message)}};
}
  viewExports.player = player;
  viewExports.voiceHub = voiceHub;
  viewExports.voiceChat = voiceChat;
  viewExports.currentCloudScene = currentCloudScene;
  viewExports.reader = reader;
  viewExports.explorationRows = explorationRows;
  viewExports.cloudClueRows = cloudClueRows;
  viewExports.sharedClueSection = sharedClueSection;
  viewExports.openVoiceRooms = openVoiceRooms;
  viewExports.openCreateVoiceRoom = openCreateVoiceRoom;
  viewExports.openInviteVoiceRoom = openInviteVoiceRoom;
  viewExports.joinVoiceRoom = joinVoiceRoom;
  viewExports.connectVoiceLive = connectVoiceLive;
  viewExports.disconnectVoiceLive = disconnectVoiceLive;
  viewExports.toggleVoiceMic = toggleVoiceMic;
  viewExports.refreshVoiceMessages = refreshVoiceMessages;
  viewExports.sendVoiceMessage = sendVoiceMessage;
  viewExports.bindPlayerReader = bindPlayerReader;
  viewExports.completeCloudReading = completeCloudReading;
  viewExports.addStoryHighlight = addStoryHighlight;
  viewExports.removeStoryHighlight = removeStoryHighlight;
  viewExports.investigateCloud = investigateCloud;
  viewExports.readCloudClue = readCloudClue;
  viewExports.shareCloudClue = shareCloudClue;
  viewExports.openShareClueRolesModal = openShareClueRolesModal;
  viewExports.openClueNoteModal = openClueNoteModal;
  viewExports.hostConfirmBanner = hostConfirmBanner;
})(window);
export {};
