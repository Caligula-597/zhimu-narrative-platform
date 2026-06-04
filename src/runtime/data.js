/* Auto-split from app.js — data.js */
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
  const bindDynamic = R.bindDynamic || (() => {});
  const openWizard = R.openWizard || (() => {});
  const openJoinRoom = R.openJoinRoom || (() => {});
  window.zhimuViews = window.zhimuViews || {};
  const updateNotifyBadge = T.updateNotifyBadge || (() => {});
  let directorPollTimer = null;
  const DIRECTOR_POLL_MS = 15000;
  let roomEventAbort = null;
  let roomEventReconnectTimer = null;
  let loadCloudDataPromise = null;
  let loadCloudDataKey = "";

  async function ensureActiveWorld() {
    let worlds;
    try {
      worlds = await zhimuApi.getWorlds();
    } catch (error) {
      state.cloudWorlds = [];
      throw error;
    }
    state.cloudWorlds = worlds;
    if (!worlds.length) {
      zhimuApi.clearWorld();
      return null;
    }
    const current = zhimuApi.context.worldId;
    if (current && worlds.some((world) => world.id === current)) return current;
    const demoId = window.zhimuConfig?.demoWorld?.worldId;
    const fallback = demoId && worlds.some((world) => world.id === demoId) ? demoId : worlds[0].id;
    zhimuApi.selectWorld(fallback);
    zhimuApi.clearRoom();
    return fallback;
  }

  async function loadCloudData(withToast = false, force = false) {
    const key = zhimuApi.loadKey();
    if (force) {
      loadCloudDataPromise = null;
      loadCloudDataKey = "";
    }
    if (loadCloudDataPromise && loadCloudDataKey === key) return loadCloudDataPromise;
    loadCloudDataKey = key;
    loadCloudDataPromise = loadCloudDataInternal(withToast).finally(() => {
      if (loadCloudDataKey === key) {
        loadCloudDataPromise = null;
        loadCloudDataKey = "";
      }
    });
    return loadCloudDataPromise;
  }

async function loadCloudDataInternal(withToast=false){
 state.cloudLoading=true;
 render();
 const errors=[];
 let hasRoom=Boolean(zhimuApi.context.roomId);
 const take=(result,apply,onError=()=>{})=>result.status==="fulfilled"?apply(result.value):(onError(),errors.push(result.reason?.message||String(result.reason)));

 try{
  try{
   await ensureActiveWorld();
   const hasSession=Boolean(localStorage.getItem("zhimuSessionToken"));
   if(hasSession){
    try{
     state.cloudCatalog=await zhimuApi.getWorldCatalog();
     state.cloudCatalogError="";
    }catch(catalogErr){
     state.cloudCatalog=[];
     state.cloudCatalogError=catalogErr.message||String(catalogErr);
     if(/catalog_public|does not exist/i.test(state.cloudCatalogError)){
      errors.push("公开剧本库尚未就绪：请在 backend 执行 node scripts/migrate.js");
     }
    }
   }else{
    state.cloudCatalog=[];
    state.cloudCatalogError="";
   }
   if(!zhimuApi.context.worldId){
    state.cloudStudio=null;
    errors.push("当前账号还没有可访问的剧本");
   }else{
    try{
     state.cloudStudio=await zhimuApi.getStudio();
     const roles=state.cloudStudio?.roles?.length||0;
     const sections=state.cloudStudio?.sections?.length||0;
     if(roles===0){
      errors.push("当前剧本在数据库中尚无角色/分幕。若体验《雾港来信》，请执行 npm run staging:catalog 后刷新。");
     }
    }catch(studioErr){
     state.cloudStudio=null;
     const msg=studioErr.message||String(studioErr);
     if(studioErr.code==="WORLD_EDITOR_REQUIRED"||/WORLD_EDITOR_REQUIRED/i.test(msg)){
      errors.push("无法读取剧本正文：后端版本过旧。请执行 npm run staging:rebuild-api 后硬刷新页面。");
     }else{
      errors.push(msg);
     }
    }
    const listed=(state.cloudWorlds||[]).find((w)=>w.id===zhimuApi.context.worldId);
    if(listed&&state.cloudStudio?.world){
     if(!state.cloudStudio.world.membership_role)state.cloudStudio.world.membership_role=listed.membership_role;
     if(listed.catalog_public!=null)state.cloudStudio.world.catalog_public=listed.catalog_public;
    }
   }
  }catch(error){
   state.cloudStudio=null;
   if (/Authentication required/i.test(error.message) && window.zhimuConfig?.requireAuth) {
    errors.push("请先登录账号后再继续");
    window.zhimuAuthSession?.promptAuthIfNeeded?.();
   } else if (/Authentication required/i.test(error.message) && !localStorage.getItem("zhimuSessionToken") && window.zhimuConfig?.demoMode) {
    errors.push("无法连接云端：请登录账号，或在 backend/.env 设置 ALLOW_DEMO_USER_HEADER=true 后重启后端");
   } else {
    errors.push(error.message);
   }
  }

  state.apiError=errors.join(" · ");
  state.cloudLoading=false;
  render();

  if(hasRoom&&state.cloudStudio&&!activeRuntimeRoom()){zhimuApi.clearRoom();clearRuntimeState();hasRoom=false;errors.push("当前运行房不属于所选世界，已自动解除绑定")}
  if(!hasRoom)clearRuntimeState();

  const worldReady=Boolean(zhimuApi.context.worldId);
  if(worldReady){
  const logParams={limit:"20"};
  if(hasRoom)logParams.roomId=zhimuApi.context.roomId;
  const phase2=await Promise.allSettled([
   hasRoom?zhimuApi.getPlayerHome():Promise.resolve(null),
   hasRoom?zhimuApi.getHostPlayers():Promise.resolve(null),
   hasRoom?zhimuApi.getExploration():Promise.resolve(null),
   hasRoom?zhimuApi.getHostEvents():Promise.resolve(null),
   hasRoom?zhimuApi.getHostClueMatrix():Promise.resolve(null),
   hasRoom?zhimuApi.getCheckpoints().catch(()=>[]):Promise.resolve([]),
   hasRoom?zhimuApi.getRecaps().catch(()=>[]):Promise.resolve([]),
   hasRoom?zhimuApi.getLatestRecap(state.view==="player").catch(()=>null):Promise.resolve(null),
   zhimuApi.getWorldLogs(logParams),
   zhimuApi.getRules()
  ]);
  take(phase2[0],value=>state.cloudPlayer=value,()=>state.cloudPlayer=null);
  take(phase2[1],value=>applyHostPlayersPayload(value),()=>{state.cloudHostPlayers=[];state.cloudHostStuckCount=0;state.cloudHost=[]});
  take(phase2[2],value=>state.cloudExploration=value,()=>state.cloudExploration=null);
  take(phase2[3],value=>state.cloudHostEvents=value||[],()=>state.cloudHostEvents=[]);
  take(phase2[4],value=>state.cloudHostClueMatrix=value,()=>state.cloudHostClueMatrix=null);
  take(phase2[5],value=>state.cloudCheckpoints=value||[],()=>state.cloudCheckpoints=[]);
  take(phase2[6],value=>state.cloudRecaps=value||[],()=>state.cloudRecaps=[]);
  take(phase2[7],value=>state.cloudRecapLatest=value,()=>state.cloudRecapLatest=null);
  take(phase2[8],value=>state.cloudWorldLogs=value||[],()=>state.cloudWorldLogs=[]);
  take(phase2[9],value=>state.cloudRules=value,()=>state.cloudRules=[]);
  }else{
   state.cloudPlayer=null;
   state.cloudHostPlayers=[];state.cloudHostStuckCount=0;state.cloudHost=[];
   state.cloudExploration=null;state.cloudHostEvents=[];state.cloudHostClueMatrix=null;
   state.cloudCheckpoints=[];state.cloudRecaps=[];state.cloudRecapLatest=null;
   state.cloudWorldLogs=[];state.cloudRules=[];state.cloudAssets=[];state.assetTotal=0;
   state.cloudCreatorChecks=[];state.storageUsage=null;
  }

  state.apiError=errors.join(" · ");
  syncDirectorPolling();
  if(worldReady)connectRoomEventStream();
  render();

  void (async()=>{
   if(!zhimuApi.context.worldId)return;
   const params={};
   if(state.assetKindFilter)params.kind=state.assetKindFilter;
   if(state.assetSearchQuery)params.q=state.assetSearchQuery;
   const phase3=await Promise.allSettled([zhimuApi.getStorageUsage(),zhimuApi.getAssets(Object.keys(params).length?params:{}),zhimuApi.getCreatorChecks()]);
   take(phase3[0],value=>state.storageUsage=value);
   take(phase3[1],value=>{
    if(Array.isArray(value)){state.cloudAssets=value;state.assetTotal=value.length}
    else{state.cloudAssets=value.assets||[];state.assetTotal=value.total??state.cloudAssets.length}
   });
   take(phase3[2],value=>state.cloudCreatorChecks=value.checks);
   if(state.view==="overview"||state.view==="assets"||state.view==="writer")render();
  })();

  void (async()=>{
   const voiceRooms=state.cloudPlayer?.voiceRooms||[];
   const currentRoom=voiceRooms.find(room=>room.id===state.voiceRoomId)||voiceRooms[0];
   if(!currentRoom)return;
   state.voiceRoomId=currentRoom.id;
   state.voiceRoom=currentRoom.name;
   try{state.voiceMessages=await zhimuApi.getVoiceMessages(currentRoom.id);if(state.view==="player")render()}catch(error){state.apiError=[state.apiError,error.message].filter(Boolean).join(" · ")}
  })();

  if(withToast)showToast(errors.length?`部分运行数据尚未连接：${errors[0]}`:"云端数据已刷新");
 }finally{
  if(state.cloudLoading){
   state.cloudLoading=false;
   render();
  }
 }
}

function clearRuntimeState(){disconnectRoomEventStream();window.zhimuLiveKitVoice?.disconnectVoiceRoom?.();state.cloudPlayer=null;state.cloudHost=[];state.cloudHostPlayers=[];state.cloudHostStuckCount=0;state.cloudExploration=null;state.cloudHostEvents=[];state.cloudHostClueMatrix=null;state.cloudCheckpoints=[];state.cloudRecaps=[];state.cloudRecapLatest=null;state.cloudRecapDetail=null;state.activeRecapId=null;state.voiceRoomId=null;state.voiceRoom="尚未选择";state.voiceMessages=[];state.voiceLiveStatus="idle";state.voiceMicEnabled=false;state.voiceParticipants=[]}

function applyHostPlayersPayload(value){
 state.cloudHostPlayers=value?.players||[];
 state.cloudHostStuckCount=value?.stuckCount||0;
 state.cloudHost=state.cloudHostPlayers.map(player=>({role_slot_id:player.role_slot_id,name:player.role_name,total_sections:player.total_sections,completed_sections:player.completed_sections,current_scene_id:player.current_scene_id,updated_at:player.last_activity_at}));
}

async function refreshPlayerHome(){
 if(!zhimuApi.context.roomId)return;
 try{state.cloudPlayer=await zhimuApi.getPlayerHome();if(state.view==="player")render()}catch(error){/* stream refresh best-effort */}
}

async function refreshExploration(){
 if(!zhimuApi.context.roomId)return;
 try{state.cloudExploration=await zhimuApi.getExploration();if(state.view==="player")render()}catch(error){/* stream refresh best-effort */}
}

function syncDirectorPolling(){
 if(state.roomEventsConnected){if(directorPollTimer){clearInterval(directorPollTimer);directorPollTimer=null}return}
 if(state.view==="director"&&zhimuApi.context.roomId){
  if(!directorPollTimer){
   directorPollTimer=setInterval(async()=>{
    if(state.view!=="director"||!zhimuApi.context.roomId){clearInterval(directorPollTimer);directorPollTimer=null;return}
    await refreshDirectorPoll();
   },DIRECTOR_POLL_MS);
  }
 }else if(directorPollTimer){clearInterval(directorPollTimer);directorPollTimer=null}
}

 async function refreshDirectorPoll(){
 try{
  await Promise.all([refreshHostEvents(false,true),refreshHostPlayers(false,true),refreshHostClueMatrix(false,true)]);
  if(state.view==="director")render();
 }catch(error){state.apiError=error.message}
}

async function refreshHostEvents(withToast=false,silent=false){
 if(!zhimuApi.context.roomId){if(withToast&&!silent)showToast("请先选择运行房");return}
 try{
  state.cloudHostEvents=await zhimuApi.getHostEvents()||[];
  updateNotifyBadge();
  if(state.view==="director"||state.view==="overview")render();
  if(withToast&&!silent)showToast(`待确认事件已刷新（${state.cloudHostEvents.length} 条）`);
 }catch(error){if(withToast&&!silent)showToast(error.message)}
}

async function refreshHostPlayers(withToast=false,silent=false){
 if(!zhimuApi.context.roomId){if(withToast&&!silent)showToast("请先选择运行房");return}
 try{
  applyHostPlayersPayload(await zhimuApi.getHostPlayers());
  if(state.view==="director"||state.view==="overview")render();
  if(withToast&&!silent)showToast(`玩家进度已刷新（${state.cloudHostPlayers.filter(player=>player.joined).length} 人已加入）`);
 }catch(error){if(withToast&&!silent)showToast(error.message)}
}

async function refreshHostClueMatrix(withToast=false,silent=false){
 if(!zhimuApi.context.roomId)return;
 try{
  state.cloudHostClueMatrix=await zhimuApi.getHostClueMatrix();
  if(state.view==="director")render();
  if(withToast&&!silent)showToast("线索矩阵已刷新");
 }catch(error){if(withToast&&!silent)showToast(error.message)}
}

async function refreshHostRoom(withToast=false){
 if(!zhimuApi.context.roomId){if(withToast)showToast("请先选择运行房");return}
 try{
  const logParams={limit:"20",roomId:zhimuApi.context.roomId};
  const [hostPlayers,hostEvents,worldLogs,clueMatrix]=await Promise.all([zhimuApi.getHostPlayers(),zhimuApi.getHostEvents(),zhimuApi.getWorldLogs(logParams),zhimuApi.getHostClueMatrix()]);
  applyHostPlayersPayload(hostPlayers);
  state.cloudHostEvents=hostEvents||[];
  state.cloudWorldLogs=worldLogs||[];
  state.cloudHostClueMatrix=clueMatrix;
  updateNotifyBadge();
  if(state.view==="director"||state.view==="overview")render();
  if(withToast)showToast(`房间状态已刷新 · 待确认 ${state.cloudHostEvents.length} 条 · 玩家 ${state.cloudHostPlayers.filter(player=>player.joined).length} 人`);
 }catch(error){if(withToast)showToast(error.message)}
}

function disconnectRoomEventStream(){
 if(roomEventReconnectTimer){clearTimeout(roomEventReconnectTimer);roomEventReconnectTimer=null}
 if(roomEventAbort){roomEventAbort.abort();roomEventAbort=null}
 if(state.roomEventsConnected){state.roomEventsConnected=false;syncDirectorPolling();if(state.view==="director")render()}
}

function scheduleRoomEventReconnect(){
 if(roomEventReconnectTimer||!zhimuApi.context.roomId)return;
 roomEventReconnectTimer=setTimeout(()=>{roomEventReconnectTimer=null;connectRoomEventStream()},5000);
}

function connectRoomEventStream(){
 disconnectRoomEventStream();
 const roomId=zhimuApi.context.roomId;
 if(!roomId)return;
 const boundRoom=roomId;
 roomEventAbort=new AbortController();
 const signal=roomEventAbort.signal;
 zhimuApi.streamRoomEvents(roomId,async(type,data)=>{
  if(type==="__connected__"){state.roomEventsConnected=true;syncDirectorPolling();if(state.view==="director")render();return}
  await handleRoomEvent(type,data);
 },signal,streamUserIdForRoom()).catch(()=>{}).finally(()=>{
  const shouldReconnect=state.roomEventsConnected&&zhimuApi.context.roomId===boundRoom&&!signal.aborted;
  state.roomEventsConnected=false;
  syncDirectorPolling();
  if(shouldReconnect)scheduleRoomEventReconnect();
 });
}

async function handleRoomEvent(type,data){
 if(!zhimuApi.context.roomId)return;
 switch(type){
  case "room.player_joined":
   if(state.view==="director"||state.view==="overview"){await refreshHostPlayers(false,true);showToast("有新玩家加入房间",2800)}
   break;
  case "room.section_completed":
   if(state.view==="director"||state.view==="overview")await refreshHostPlayers(false,true);
   else if(state.view==="player"&&data.roleSlotId===state.cloudPlayer?.role?.id)await refreshPlayerHome();
   break;
  case "room.clue_granted":
   if(state.view==="director"||state.view==="overview"){await refreshHostPlayers(false,true);await refreshHostClueMatrix(false,true)}
   else if(state.view==="player"){await refreshPlayerHome();if(data.source!=="shared_room")showToast(data.clueName?`获得新线索：${data.clueName}`:"获得新线索",2800);else showToast(data.clueName?`房间内有新公开线索：${data.clueName}`:"有新的公开线索",2800)}
   break;
  case "room.item_granted":
   if(state.view==="director"||state.view==="overview")await refreshHostPlayers(false,true);
   else if(state.view==="player"){await refreshPlayerHome();await refreshExploration();if(data.roleSlotId===state.cloudPlayer?.role?.id)showToast(data.itemName?`获得物品：${data.itemName}`:"获得新物品",2800)}
   break;
  case "room.host_event_pending":
   await refreshHostEvents(false,true);
   if(!data.action&&state.view==="director")showToast("有新的待确认事件",2800);
   break;
  case "room.scene_unlocked":
   if(state.view==="player"){await refreshExploration();showToast("新场景已开放",2800)}
   else if(state.view==="director"||state.view==="overview")await refreshHostPlayers(false,true);
   break;
  case "room.voice_message_created":
   if(data.voiceRoomId===state.voiceRoomId)await (V.player?.refreshVoiceMessages || (async () => {}))();
   break;
  case "room.checkpoint_restored":
   if(state.view==="director"||state.view==="overview"||state.view==="archive"){
    await refreshHostRoom(false);
    showToast("房间已从存档恢复",2800);
   }
   break;
 }
}

function streamUserIdForRoom(){return state.view==="player"&&zhimuApi.context.playerUserId?zhimuApi.context.playerUserId:zhimuApi.context.hostUserId}

function enhanceCloudPanels(){
}
  window.zhimuRuntime = Object.assign(window.zhimuRuntime || {}, { loadCloudData, ensureActiveWorld, clearRuntimeState, go: window.zhimuRuntime?.go, render: window.zhimuRuntime?.render, applyHostPlayersPayload, refreshPlayerHome, refreshExploration, syncDirectorPolling, refreshDirectorPoll, refreshHostEvents, refreshHostPlayers, refreshHostClueMatrix, refreshHostRoom, disconnectRoomEventStream, scheduleRoomEventReconnect, connectRoomEventStream, handleRoomEvent, streamUserIdForRoom, enhanceCloudPanels });
})(window);
export {};
