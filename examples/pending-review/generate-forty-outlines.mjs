import fs from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  createDeepseekStoryOutline,
  mergeStoryOutlineAssembly,
  validateOutlineBatchDiversity,
  validateStoryOutline,
  validateStoryOutlineBlueprint
} from "../../backend/src/deepseek.js";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const outputDir = path.join(scriptDir, "四十题材大纲-V2.4语义宪章版-20260801");
const itemDir = path.join(outputDir, "items");
const checkpointDir = path.join(outputDir, "checkpoints");
const markdownOutputFile = path.join(outputDir, "织幕四十题材剧情大纲_V2.4语义宪章版.md");
const batchId = path.basename(outputDir);
const sessionId = new Date().toISOString().replace(/[-:.TZ]/g, "");
const historyFile = path.join(scriptDir, "outline-fingerprint-history.json");
const concurrency = Math.max(1, Math.min(40, Number(process.env.OUTLINE_BATCH_CONCURRENCY) || 10));
const maxDraftAttempts = Math.max(1, Math.min(2, Number(process.env.OUTLINE_FULL_DRAFT_ATTEMPTS) || 1));
const blueprintStageAttempts = Math.max(1, Math.min(5, Number(process.env.OUTLINE_BLUEPRINT_ATTEMPTS) || 3));
const assemblyStageAttempts = Math.max(1, Math.min(5, Number(process.env.OUTLINE_ASSEMBLY_ATTEMPTS) || 3));
const requestTimeoutMs = Math.max(30000, Math.min(240000, Number(process.env.OUTLINE_REQUEST_TIMEOUT_MS) || 240000));
const lockedFingerprintFields = [
  "storyEngine",
  "antagonistType",
  "finalChoiceType",
  "themeExpression",
  "mysteryObjectType",
  "truthRevealMethod",
  "playerRelationshipTopology",
  "chapterCausalPattern",
  "evidenceModalityMix",
  "powerStructure",
  "endingMechanism",
  "existenceStatusMechanism",
  "truthKnowledgeDistribution"
];

const catalog = [
  {
    id: "01",
    title: "吞星者的墓志铭",
    genre: "硬科幻考古悬疑",
    style: "冷峻硬科幻与考古报告体交错，强调物理约束、文明尺度和证据复原",
    premise: "六名深空考古队员进入一颗被人工掏空的流浪行星，发现失落文明为一台恒星级机器留下了墓志铭。队伍的返航燃料随后被锁死，而记录显示其中一人早在三年前已经死亡。",
    anchors: ["流浪行星", "墓志铭", "返航燃料"],
    requirements: "真相必须符合现实物理假设；核心谜题围绕身份连续性、考古污染和机器使命；不得用梦境或模拟世界一笔带过。"
  },
  {
    id: "02",
    title: "月桂街最后一壶茶",
    genre: "治愈系植物魔法谜案",
    style: "英式乡野舒适推理混合东方草木志，温暖、幽默、低暴力",
    premise: "月桂街的植物会记住最后触碰它们的人。六位邻居参加老茶馆的告别茶会，却发现店主把房契、遗嘱和一段被所有人遗忘的夏天分别藏进六种香气里。",
    anchors: ["月桂街", "老茶馆", "六种香气"],
    requirements: "非命案型；谜底围绕记忆、继承与邻里关系；植物魔法规则必须稳定，结局温暖但不能廉价和解。"
  },
  {
    id: "03",
    title: "无灯站台",
    genre: "民国谍战黑色电影",
    style: "1940年代黑色电影质感，短句、雨夜、火车时刻表和多重身份",
    premise: "一列不在时刻表上的军列将在无灯站台停靠七分钟。六名身份互不相认的乘客都奉命取走同一只皮箱，却没人知道箱中名单其实记录着他们未来的死亡日期。",
    anchors: ["无灯站台", "军列", "皮箱名单"],
    requirements: "谍战信息差必须公平；避免脸谱化阵营；核心选择在任务、信仰和私人救赎之间。"
  },
  {
    id: "04",
    title: "长安十二面镜",
    genre: "唐代法理探案",
    style: "盛唐宫廷笔记体与严谨司法程序结合，华丽但克制",
    premise: "大明宫新铸的十二面铜镜在献礼前夜各映出不同的死者。六名相关者被召入尚书省复核一宗已经定案的谋逆案，而第十二面镜背后刻着主审官自己的供词。",
    anchors: ["十二面铜镜", "尚书省", "谋逆案"],
    requirements: "不出现真实超自然；镜像现象必须来自工艺与光学；突出唐代证据制度、权力与法理冲突。"
  },
  {
    id: "05",
    title: "证词在云端死去",
    genre: "赛博法庭悬疑",
    style: "近未来法庭剧、数字取证和冷感赛博朋克，不靠动作场面",
    premise: "在算法可以代替陪审团的城市，一名被执行死刑的黑客突然以合法数字人格出庭翻供。六名案件参与者必须证明哪一份证词仍然属于人类。",
    anchors: ["数字人格", "算法陪审团", "合法证词"],
    requirements: "核心争议是数字人格的证据资格；既要有技术证据也要有法理辩论；事实真相唯一，判决价值可以分歧。"
  },
  {
    id: "06",
    title: "第七码头不加班",
    genre: "职场荒诞黑色喜剧",
    style: "快速对白、办公室政治和冷幽默，像一场失控的绩效复盘",
    premise: "港口公司宣布第七码头实现全自动化，当晚六名员工却收到来自已注销工号的加班任务。若在天亮前没人签字，整个部门将被系统判定为从未存在。",
    anchors: ["第七码头", "已注销工号", "加班任务"],
    requirements: "非命案型；谜题围绕数据造假、外包责任和集体甩锅；喜剧外壳下保留真实职场刺痛。"
  },
  {
    id: "07",
    title: "极昼之后",
    genre: "极地生存伦理剧",
    style: "纪录片式写实、极简对白、压迫性的白色空间",
    premise: "极昼结束前，南极站的六名越冬队员发现补给机只够带走五人，而一份冰芯样本证明其中一人的研究可能引发全球生态恐慌。",
    anchors: ["南极站", "补给机", "冰芯样本"],
    requirements: "生存资源计算必须可信；不设置传统凶手；真相围绕研究伦理、伪造数据和牺牲决定。"
  },
  {
    id: "08",
    title: "借骨人",
    genre: "西南民俗惊悚",
    style: "潮湿山村民俗、口述传说和身体恐怖感，最终落回现实人性",
    premise: "封山多年的村寨举行最后一次借骨仪式，六名离乡者被要求各自带回一件祖物。祖祠打开后，族谱里所有人的父母都被改成了同一个名字。",
    anchors: ["借骨仪式", "祖祠", "族谱"],
    requirements: "民俗必须服务家族权力和身份买卖真相；不得污名化真实民族；超自然可保留余味但事实链必须可解释。"
  },
  {
    id: "09",
    title: "未寄出的第九封校刊",
    genre: "青春书信情感谜题",
    style: "清新克制的书信体、青春群像与非线性回忆",
    premise: "毕业十年后，六名旧校刊编辑收到一份从未出版的第九期校刊。每篇文章都准确写出了他们后来的人生，唯独主编留下的最后一封信无人记得。",
    anchors: ["第九期校刊", "旧校刊编辑", "最后一封信"],
    requirements: "非命案型；重点是创作署名、友谊背叛和被偷走的人生选择；避免校园埋尸和传统凶杀模板。"
  },
  {
    id: "10",
    title: "睡眠舱里的国王",
    genre: "世代飞船政治寓言",
    style: "宏大太空歌剧与密闭议会剧结合，庄严、悲剧性",
    premise: "世代飞船抵达新家园前，六名轮值执政官发现始祖船长仍活在第一号睡眠舱里，并持续通过宪法后门否决每一次登陆。",
    anchors: ["世代飞船", "第一号睡眠舱", "宪法后门"],
    requirements: "围绕合法性、代际契约和殖民伦理；不是简单暴君故事；登陆风险和飞船资源必须形成真实约束。"
  },
  {
    id: "11",
    title: "盐焗钟声",
    genre: "岭南饮食文化谜案",
    style: "烟火气、味觉叙事和家族轻悬疑，温热而锋利",
    premise: "百年盐焗铺闭店前举行最后一席，六名传人发现祖传配方不是菜谱，而是一套用盐量记录的走私救人名单。午夜钟响后，老店所有盐都变苦了。",
    anchors: ["盐焗铺", "祖传配方", "救人名单"],
    requirements: "味觉线索必须可验证；非传统命案；把家族传承、战争记忆和商业拆迁结合。"
  },
  {
    id: "12",
    title: "零点十三分",
    genre: "时间循环列车推理",
    style: "高概念科幻、精确时刻表和重复场景的细微变奏",
    premise: "一列地铁每天在零点十三分多停靠一座不存在的车站。六名末班乘客每次下车都会回到十三分钟前，但每轮都会永久失去一段共同记忆。",
    anchors: ["零点十三分", "不存在的车站", "共同记忆"],
    requirements: "时间循环规则明确且可推导；谜底不能只是梦；每轮信息损耗必须影响玩家合作。"
  },
  {
    id: "13",
    title: "鲸落城",
    genre: "海洋朋克生态悬疑",
    style: "明亮海洋朋克、美丽生态奇观与慢性灾难并置",
    premise: "漂浮城市依靠一具人工鲸落供能。六名城市维护者发现鲸骨正在发出人类心跳，而市政档案从未记录这座城的建造成本由谁支付。",
    anchors: ["人工鲸落", "漂浮城市", "人类心跳"],
    requirements: "生态循环和城市能源设定自洽；真相涉及被牺牲的迁徙社区；避免邪恶科学家单因解释。"
  },
  {
    id: "14",
    title: "所有玩具都说谎",
    genre: "成人童话推理",
    style: "黑色童话、可爱表象与严肃伦理，语言简洁寓言化",
    premise: "玩具王国的孩子失踪后，六件会说话的旧玩具接受审问。它们都无法说假话，却能决定一句话从哪里开始、在哪里结束。",
    anchors: ["玩具王国", "六件旧玩具", "无法说假话"],
    requirements: "利用语言逻辑而非魔法漏洞推理；结局讨论保护、占有和成长；适合无血腥演绎。"
  },
  {
    id: "15",
    title: "沙海遗嘱",
    genre: "沙漠考古冒险",
    style: "古典冒险小说、地图解谜和烈日下的道德选择",
    premise: "六名联合考古队员在移动沙丘下发现一座每天改变结构的陵城。领队留下遗嘱：谁找到真正的出口，谁就必须亲手封死它。",
    anchors: ["移动沙丘", "陵城", "封死出口"],
    requirements: "遗址变化由工程与地质机制解释；谜题兼顾文物归属、学术欺诈和当地社区权利。"
  },
  {
    id: "16",
    title: "失声的第七乐章",
    genre: "音乐学院心理悬疑",
    style: "室内乐结构、声音意象和压抑的学院派美学",
    premise: "青年作曲家决赛前失去听觉，六名室内乐团成员收到一份不存在的第七乐章。每个人演奏时，谱面都会删掉另一个人的声部。",
    anchors: ["第七乐章", "室内乐团", "删掉声部"],
    requirements: "音乐线索能被非专业玩家理解；核心不是嫉妒杀人，而是署名、听力损伤与集体创作剥夺。"
  },
  {
    id: "17",
    title: "热搜死于凌晨三点",
    genre: "互联网舆论讽刺剧",
    style: "弹幕、群聊、直播切片组成的碎片化叙事，尖锐快速",
    premise: "一名千万粉主播宣布自己将在凌晨三点被全网忘记。六名利益相关者进入直播后台后，发现每撤下一条热搜，现实中就会消失一份证据。",
    anchors: ["凌晨三点", "直播后台", "撤下热搜"],
    requirements: "讨论平台治理、营销操控和公众记忆；所有数字证据有备份与传播逻辑；避免单纯网暴说教。"
  },
  {
    id: "18",
    title: "县城没有秘密",
    genre: "县城家族现实主义",
    style: "朴素现实主义、多年时间跨度和克制的家庭对白",
    premise: "老电影院拆除前，六名亲属发现墙里藏着过去三十年的匿名举报信。每封信都改变过县城一个家庭的命运，最后一封尚未寄出。",
    anchors: ["老电影院", "匿名举报信", "最后一封"],
    requirements: "非命案型；展现熟人社会中的善意、报复和制度缝隙；不把县城写成猎奇符号。"
  },
  {
    id: "19",
    title: "剑不见血",
    genre: "武侠门派政治",
    style: "古龙式留白与政治寓言，动作少、对话锋利",
    premise: "武林盟主在封剑大典上宣布天下再无仇杀，六派掌门却同时收到自己已经杀人的判词。现场没有尸体，只有一柄从未出鞘却不断滴血的剑。",
    anchors: ["封剑大典", "六派掌门", "未出鞘的剑"],
    requirements: "核心谜题围绕名誉杀人、替罪契约和江湖叙事权；滴血现象有机关解释。"
  },
  {
    id: "20",
    title: "白塔夜班",
    genre: "医疗伦理惊悚",
    style: "实时夜班结构、临床细节和冷白色压迫感",
    premise: "停电夜，六名医护被困在只剩一台备用呼吸机的白塔医院。系统显示七名患者都已签署放弃治疗，但其中六份签名来自同一只手。",
    anchors: ["白塔医院", "备用呼吸机", "放弃治疗签名"],
    requirements: "医疗流程尽量可信；不把患者当道具；真相涉及资源分配、代签与临床试验伦理。"
  },
  {
    id: "21",
    title: "赝品先说真话",
    genre: "艺术盗窃喜剧",
    style: "轻快骗局片、机智对话和多层身份反转",
    premise: "六名艺术从业者计划在拍卖夜偷回一幅赝品，却发现展厅里的七幅画都宣称自己是赝品，唯一的真迹从目录中主动删除了自己。",
    anchors: ["拍卖夜", "七幅画", "唯一真迹"],
    requirements: "非命案型；骗局步骤可复盘；讨论真伪、出处和艺术市场共同制造的价值。"
  },
  {
    id: "22",
    title: "最后一座温室",
    genre: "太阳朋克末世希望剧",
    style: "明亮太阳朋克、社区协商和生态工程感，拒绝灰暗末世套路",
    premise: "荒漠城市的最后一座种子温室将在黎明开放。六名社区代表发现门票不是按贡献分配，而是由一株会记录照料者体温的古树决定。",
    anchors: ["种子温室", "社区代表", "记录体温的古树"],
    requirements: "非命案型；谜题围绕资源治理和照护劳动；科技与生态机制可解释，结局保留建设性选择。"
  },
  {
    id: "23",
    title: "霸王不卸甲",
    genre: "戏曲后台历史悬疑",
    style: "戏曲唱词、后台实景和双时空舞台调度",
    premise: "百年戏楼谢幕演出中，扮演霸王的演员拒绝卸甲。六名剧团成员发现戏服夹层里缝着一份战乱年代的救命名单，而台下有人要求今晚必须唱错最后一句。",
    anchors: ["百年戏楼", "霸王戏服", "救命名单"],
    requirements: "尊重戏曲专业；真假唱词和舞台调度构成线索；主题是传承、政治记忆与角色吞噬演员。"
  },
  {
    id: "24",
    title: "午夜甲板无月",
    genre: "豪华邮轮密室推理",
    style: "黄金时代本格、海上封闭空间和优雅恶意",
    premise: "一艘只在无月夜航行的旧邮轮举办最后一次航程。六名乘客在午夜甲板看到一具倒映在海中的尸体，甲板上却没有任何人死亡。",
    anchors: ["无月夜", "旧邮轮", "海中倒影"],
    requirements: "视觉诡计必须可操作；乘客秘密来自不同阶层；避免双胞胎、替身尸体和纯监控盲区。"
  },
  {
    id: "25",
    title: "敦煌来信",
    genre: "丝路历史冒险",
    style: "书信体历史叙事、风沙旅行和多语言误读",
    premise: "六名不同来历的旅人护送一封从敦煌寄往长安的信。每经过一座驿站，信上的文字就会变成另一种语言，而收信人早在出发前已经去世。",
    anchors: ["敦煌", "驿站", "变换语言的信"],
    requirements: "语言变化来自材料、抄写和密码；尊重丝路多元文化；核心选择涉及知识归属与战争情报。"
  },
  {
    id: "26",
    title: "被删除的员工",
    genre: "AI职场存在主义悬疑",
    style: "极简企业科幻、冷幽默和身份哲学",
    premise: "公司上线全自动绩效系统后，六名员工发现团队里一直存在第七个人，但所有考勤、照片和工资记录正实时删除他。更诡异的是，每个人都记得自己曾经是他。",
    anchors: ["绩效系统", "第七个人", "实时删除"],
    requirements: "非传统命案；真相围绕训练数据、岗位拆分和劳动身份；AI不是万能恶魔，必须有人类决策链。"
  },
  {
    id: "27",
    title: "雨巷只下星期四",
    genre: "都市魔幻现实主义",
    style: "温柔荒诞、南方雨季和社区群像，现实与奇迹不做硬切割",
    premise: "旧城雨巷每逢星期四只为六户人家下雨。拆迁前最后一个星期四，雨水开始倒流，把每户丢失的东西送到错误的人家。",
    anchors: ["星期四", "旧城雨巷", "雨水倒流"],
    requirements: "非命案型；失物构成人物秘密交换；可以保留魔幻不解释，但现实因果与拆迁利益必须清晰。"
  },
  {
    id: "28",
    title: "第十二把空椅",
    genre: "陪审团法庭群像",
    style: "单场景高密度对白、法理辩论和实时投票",
    premise: "六名临时陪审员被要求复核一宗零证据定罪案。会议室里有十二把椅子，每改变一次投票，便会有一把空椅出现新的使用痕迹。",
    anchors: ["临时陪审员", "十二把椅子", "零证据定罪"],
    requirements: "单场景也要有持续推进；使用证据规则、偏见与程序正义冲突；不可用幽灵直接给答案。"
  },
  {
    id: "29",
    title: "静默频率",
    genre: "战争年代无线电谍报",
    style: "电报码、静默段落和克制战争叙事",
    premise: "战争结束前夜，六名地下电台成员收到一段没有任何声音的广播。频谱显示它完整播出了七分钟，而这七分钟正对应一支失踪撤离队的路线。",
    anchors: ["地下电台", "无声广播", "撤离队"],
    requirements: "无线电线索基本可信；避免宏大口号替代人物；谜底围绕救援、泄密和谁有权决定牺牲。"
  },
  {
    id: "30",
    title: "雪地里的红门",
    genre: "东北冰雪民俗悬疑",
    style: "粗粝现实、黑色幽默和雪原孤绝感",
    premise: "暴雪封山后，六名返乡者发现废弃林场多出一扇红门。每次有人打开它，门后都会少一间真实存在过的工人宿舍。",
    anchors: ["废弃林场", "红门", "工人宿舍"],
    requirements: "红门现象由建筑标记、集体记忆和矿权争夺共同解释；保持东北人物的生活质感，拒绝地域刻板印象。"
  },
  {
    id: "31",
    title: "彗星不告别",
    genre: "天文台爱情悲剧",
    style: "浪漫科学叙事、低饱和情感与跨年时间线",
    premise: "彗星回归之夜，六名旧天文台成员重聚，发现二十年前的观测底片记录了一颗从未存在的伴星，也记录了他们共同答应却没有完成的告别。",
    anchors: ["彗星回归", "观测底片", "不存在的伴星"],
    requirements: "非命案型；天文误差有科学解释；重点是爱情、事业选择和被集体修改的观测记录。"
  },
  {
    id: "32",
    title: "决赛第五局",
    genre: "电子竞技心理群像",
    style: "高速赛事解说与安静赛后复盘交替，现代青春但不偶像化",
    premise: "世界赛决胜局前，六名战队成员发现官方隔离服务器已经结算了一场由双方数字孪生实时完成的第五局。录像显示他们获胜，但真人选手从未开赛；赛事方却依据赛前签署的紧急连续竞赛条款要求立即确认赛果。",
    anchors: ["世界赛", "数字孪生第五局", "紧急连续竞赛条款"],
    requirements: "六名玩家均属于同一支战队，赛事监督、对手和联盟人员只能是NPC；这不是预测、预录或未来录像：双方正式注册的数字孪生已经在隔离官方服务器实时对战；比赛策略能让非玩家理解；核心争议是授权、代理赛效力、伤病隐瞒与职业代价，伤病或退出绝不自动判胜。"
  },
  {
    id: "33",
    title: "黑裙裁缝",
    genre: "高级时装哥特悬疑",
    style: "奢华哥特、服装工艺细节和冷艳家族斗争",
    premise: "传奇裁缝去世后，六名继承人必须共同完成一条从未量体的黑裙。每缝上一片布，裙子就显出一位客人曾被抹去的身体尺寸。",
    anchors: ["黑裙", "六名继承人", "身体尺寸"],
    requirements: "服装工艺成为证据；哥特氛围不依赖超自然；真相关联时尚产业剥削、身体规训和署名盗用。"
  },
  {
    id: "34",
    title: "消失的十四号线",
    genre: "城市规划阴谋悬疑",
    style: "城市档案、地图叠图和现实主义公共议题",
    premise: "新地铁开通前，六名规划参与者发现城市地图上曾存在一条十四号线，却没有任何人乘坐过。沿线拆迁档案证明，数万人曾为它搬离。",
    anchors: ["十四号线", "城市地图", "拆迁档案"],
    requirements: "非传统命案；谜题围绕虚构基建、土地利益和统计抹除；地图证据必须可交叉验证。"
  },
  {
    id: "35",
    title: "闭馆后请勿回头",
    genre: "博物馆夜游历史谜案",
    style: "展签叙事、夜间博物馆奇观和历史反思",
    premise: "地方博物馆闭馆搬迁前，六名工作人员发现所有展品的背面都有另一张展签，讲述与正面完全相反的历史。午夜后，馆藏目录开始删除捐赠者姓名。",
    anchors: ["博物馆闭馆", "另一张展签", "捐赠者姓名"],
    requirements: "展品不必真正复活；真相围绕来源伦理、掠夺性收藏和地方叙事；保持调查可玩性。"
  },
  {
    id: "36",
    title: "珊瑚胚胎",
    genre: "生物科技海岛伦理惊悚",
    style: "洁净实验室美学、生态身体恐怖和科学伦理",
    premise: "六名研究者在海岛实验室培育出能修复白化海域的珊瑚胚胎，却发现它携带人类线粒体标记。台风来临前，他们必须决定是否把第一批胚胎投向大海。",
    anchors: ["珊瑚胚胎", "线粒体标记", "海岛实验室"],
    requirements: "生物设定以合理推演为主；不靠变异怪物；真相涉及样本同意、专利与生态不可逆风险。"
  },
  {
    id: "37",
    title: "河伯拒婚",
    genre: "上古神话法庭喜剧",
    style: "神话新编、古今混合官司和机锋喜剧",
    premise: "一年一度的河伯娶亲仪式上，河伯本人突然拒绝成婚。六位神、人、巫共同审理婚约，却发现祭文的每个版本都由不同的人签署。",
    anchors: ["河伯娶亲", "拒绝成婚", "祭文"],
    requirements: "非命案型；重写献祭叙事但不简单现代说教；神力规则与契约逻辑一致。"
  },
  {
    id: "38",
    title: "完美匹配失败",
    genre: "恋爱综艺荒诞喜剧",
    style: "综艺字幕、采访间独白和快节奏关系反转",
    premise: "六名嘉宾进入号称百分百匹配的恋爱节目，系统却在最终夜宣布所有人都与同一个不存在的第七位嘉宾最契合。",
    anchors: ["恋爱节目", "百分百匹配", "第七位嘉宾"],
    requirements: "非命案型；笑点来自节目机制与自我表演；真相涉及数据画像、剧本操控和真实关系选择。"
  },
  {
    id: "39",
    title: "第七次日出",
    genre: "假释审查现实主义",
    style: "克制社会派、访谈记录和一天内完成的伦理抉择",
    premise: "同一名服刑者第七次申请假释，六名与旧案有关的人被要求共同参加修复性司法会议。日出前，系统显示受害者本人也提交了一票赞成。",
    anchors: ["第七次假释", "修复性司法", "受害者一票"],
    requirements: "事实调查与价值判断分开；不美化犯罪也不把惩罚当唯一答案；电子投票来源可查。"
  },
  {
    id: "40",
    title: "昨日保管处",
    genre: "非线性记忆档案科幻",
    style: "博尔赫斯式档案迷宫、非线性叙事和哲思悬疑",
    premise: "城市允许居民把不愿记住的一天存进昨日保管处。六名管理员发现仓库里出现同一天的七个版本，而城市历史只允许其中一个被归还。",
    anchors: ["昨日保管处", "同一天的七个版本", "归还记忆"],
    requirements: "记忆技术规则明确；不是全员失忆反转；主题涉及公共历史、私人创伤和谁有权定义真实。"
  }
];

const requestedItemIds = new Set(
  String(process.env.OUTLINE_ONLY_IDS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => value.padStart(2, "0"))
);
const activeCatalog = requestedItemIds.size
  ? catalog.filter((item) => requestedItemIds.has(item.id))
  : catalog;
if (!activeCatalog.length) {
  throw new Error(`OUTLINE_ONLY_IDS 未匹配任何题材：${[...requestedItemIds].join(", ")}`);
}

const genreModes = {
  mystery: new Set(["01", "03", "04", "05", "08", "12", "14", "15", "16", "20", "21", "23", "24", "25", "26", "29", "30", "33", "35"]),
  emotional: new Set(["02", "09", "18", "27", "31"]),
  political: new Set(["06", "10", "13", "17", "19", "28", "34", "37", "39"]),
  variety: new Set(["38"]),
  survival: new Set(["07", "22", "36"])
};

// 人名是创作合同的一部分，不再使用“同中间字 + 固定六尾字”的可预测矩阵。
// 每组均按时代、地域与题材单独策划；二字名、三字名、字号与代号混用。
const playerNamesById = {
  "01": ["闻昼", "乔蔚", "许峤", "唐弥", "隼九", "伊澜"],
  "02": ["桂生", "程又晴", "罗槿", "阿芷", "周叙白", "丁禾"],
  "03": ["顾砚秋", "苏曼卿", "贺长庚", "乔十七", "叶静澜", "韩策"],
  "04": ["裴玄度", "袁令仪", "崔行简", "武承晏", "沈七郎", "卢绛"],
  "05": ["陆岫", "岑未央", "阮真", "简述", "方凛", "周弧"],
  "06": ["宋芮", "马临川", "赵闻达", "纪小满", "吴惟实", "李可"],
  "07": ["安可", "程砾", "何湫", "戚航", "包以宁", "童牧"],
  "08": ["林守约", "石阿蛮", "钟小鹤", "孟兰英", "欧阳策", "范九斤"],
  "09": ["姜小雨", "章越", "黎蔓", "徐未迟", "唐好", "俞北"],
  "10": ["舰长洛萨", "米娅·陈", "阿蒙-3", "郑启", "柳真纪", "维克托·萨恩"],
  "11": ["邱三娘", "何大有", "余满仓", "蒋禾香", "唐一勺", "陈福生"],
  "12": ["顾鸣", "夏树", "杜妍", "柏舟", "马迢", "小荼"],
  "13": ["高澜", "殷朵", "吕瀚", "沙鸥", "齐岳", "苗炽"],
  "14": ["陶知知", "王梨", "阿蛮", "孔星野", "蒋小葵", "傅冬青"],
  "15": ["屠四海", "马青鬃", "古丽娜", "方寸", "尉迟璟", "何望朔"],
  "16": ["林弦", "余不凡", "秦晞", "黎笙", "周野渡", "丁默声"],
  "17": ["罗迦", "胡青青", "魏观", "江素", "马丁", "彭灼"],
  "18": ["方春桃", "许家栋", "郑爱群", "吴米兰", "彭向东", "何小玉"],
  "19": ["谢无咎", "柳停云", "燕小楼", "公孙砚", "杜衡之", "花十娘"],
  "20": ["金妍", "徐彻", "梁芃", "郝伟民", "梅珂", "孙朴"],
  "21": ["黎墨", "朱不器", "欧阳甜", "钱佑", "石榴", "龚伯乐"],
  "22": ["唐青苔", "莫小溪", "伍辛夷", "赵朴", "林阿翠", "郑柚"],
  "23": ["白玉枝", "戚少亭", "罗巧凤", "陈二两", "季红绡", "高闻莺"],
  "24": ["许闻潮", "宋迢", "阿黛", "关韬", "卢海生", "沈佩"],
  "25": ["康九", "阿史那月", "石迦", "李无尘", "娜依拉", "巴图尔"],
  "26": ["严知行", "蒋可乐", "高原", "周青", "莫凡", "孔令清"],
  "27": ["王桂香", "刘晓峰", "周慧", "赵小蝶", "谭勇", "何守成"],
  "28": ["曹真", "梅丽", "唐恕", "吴正南", "林雁", "宋和"],
  "29": ["贺声", "岳峤", "阮棠", "邱远山", "杜鹃", "韩小北"],
  "30": ["孙宝林", "于雪琴", "郭大勇", "邢春生", "刘燕子", "马占奎"],
  "31": ["叶迢迢", "苏牧星", "吴以南", "郝澄宇", "陈俞", "乔槿"],
  "32": ["邵竞", "小满", "温齐", "Nox", "庞越", "沈夺"],
  "33": ["顾弥", "乔伊", "阮黛", "白榛", "宋司南", "孟琪"],
  "34": ["韩路", "毛佳", "郑图南", "许小川", "陶葳", "陈矩"],
  "35": ["杜兰", "秦石", "阿娜尔", "易青", "徐放", "段小满"],
  "36": ["沈汐", "苏玳", "胡海燕", "邓嵘", "叶真珠", "费蓝"],
  "37": ["柳三喜", "云织", "祝长生", "田小七", "白阿九", "巫咸宁"],
  "38": ["夏予", "韩桃", "陆一一", "罗然", "费可", "戚南"],
  "39": ["林晓雨", "张强", "郑岚", "欧阳直", "任小麦", "王祺"],
  "40": ["顾今", "魏昔", "朱令", "何以安", "沈酌", "罗七月"]
};

function genreModeFor(item) {
  return Object.entries(genreModes).find(([, ids]) => ids.has(item.id))?.[0] || "hybrid";
}

function genreProgressConstraint(mode) {
  return {
    mystery: "本题材以可推理证据推进；每个核心结论必须由 sourceType 与 provenanceGroup 都独立的双源信息支持。",
    emotional: "本题材以关系揭示、承诺兑现和记忆触发推进；不强迫每章塞物证，不得把情感冲突改写成找凶手。",
    political: "本题材以权限、资源和联盟变化推进；每章必须改变至少一项可执行权力条件。",
    variety: "本题材以节目任务、公开表演、采访间选择和观众叙事推进；笑点和冲突必须来自玩法。",
    survival: "本题材以资源消耗、风险转移和生存责任推进；每章必须产生不可无代价撤回的资源或风险变化。",
    hybrid: "按题材的主要体验选择 evidence、relationship、authority、task 或 risk 推进，不得强行套用统一查档案流程。"
  }[mode];
}

function allocatedPlayerNames(item) {
  const names = playerNamesById[item.id];
  if (!Array.isArray(names) || names.length !== 6) {
    throw new Error(`题材 ${item.id} 缺少六名人工策划玩家姓名`);
  }
  return [...names];
}

const allocatedNameRows = Object.entries(playerNamesById).flatMap(([id, names]) => names.map((name) => ({ id, name })));
const duplicatedAllocatedNames = allocatedNameRows.filter((row, index, rows) => (
  rows.findIndex((candidate) => candidate.name.toLocaleLowerCase("zh-CN") === row.name.toLocaleLowerCase("zh-CN")) !== index
));
if (duplicatedAllocatedNames.length) {
  throw new Error(`V2.4 人名合同存在跨篇重名：${duplicatedAllocatedNames.map((row) => `${row.id}:${row.name}`).join("、")}`);
}

const coreStateKeysById = {
  "01": ["state-identity-continuity", "state-return-propulsion", "state-machine-recognition"],
  "02": ["state-inheritance-consent", "state-scent-memory-integrity", "state-teahouse-stewardship"],
  "03": ["state-cover-identity", "state-train-interception", "state-list-exposure"],
  "04": ["state-case-reopening", "state-mirror-custody", "state-judicial-liability"],
  "05": ["state-testimony-admissibility", "state-personhood-status", "state-jury-procedure"],
  "06": ["state-department-existence", "state-signature-liability", "state-automation-authority"],
  "07": ["state-evacuation-seat", "state-ecology-disclosure", "state-station-survival"],
  "08": ["state-ancestral-identity", "state-ritual-custody", "state-village-return"],
  "09": ["state-letter-authorship", "state-memory-consent", "state-reunion-commitment"],
  "10": ["state-landing-mandate", "state-founder-veto", "state-charter-legitimacy"],
  "11": ["state-recipe-custody", "state-rescue-list-exposure", "state-shop-tenancy"],
  "12": ["state-loop-memory", "state-station-exit", "state-shared-sacrifice"],
  "13": ["state-energy-custody", "state-community-recognition", "state-city-buoyancy"],
  "14": ["state-answer-obligation", "state-silence-declared", "state-child-location"],
  "15": ["state-sand-route-confidence", "state-tomb-seal-authority", "state-community-claim"],
  "16": ["state-score-integrity", "state-authorship-recognition", "state-performance-eligibility"],
  "17": ["state-retention-chain", "state-broadcast-control", "state-public-memory"],
  "18": ["state-letter-custody", "state-family-disclosure", "state-cinema-demolition"],
  "19": ["state-oath-validity", "state-sect-reputation", "state-sword-custody"],
  "20": ["state-treatment-priority", "state-consent-validity", "state-backup-capacity"],
  "21": ["state-note-authorship", "state-painting-custody", "state-auction-standing"],
  "22": ["state-seed-access", "state-care-recognition", "state-community-survival"],
  "23": ["state-list-authenticity", "state-performance-continuity", "state-troupe-ownership"],
  "24": ["state-reflection-geometry", "state-deck-access", "state-witness-credibility"],
  "25": ["state-letter-translation", "state-caravan-safety", "state-recipient-duty"],
  "26": ["state-employee-identity", "state-record-restoration", "state-team-liability"],
  "27": ["state-object-return", "state-relocation-consent", "state-neighbor-obligation"],
  "28": ["state-evidence-admissibility", "state-procedure-validity", "state-verdict-burden"],
  "29": ["state-route-secrecy", "state-rescue-window", "state-transmission-authority"],
  "30": ["state-hydraulic-access", "state-dormitory-record", "state-mine-liability"],
  "31": ["state-companion-star-proof", "state-farewell-promise", "state-observatory-future"],
  "32": [
    "state-match-authenticity",
    "state-match-integrity",
    "state-authorization-validity",
    "state-clause-applicability",
    "state-result-recognition"
  ],
  "33": ["state-measurement-custody", "state-design-authorship", "state-runway-access"],
  "34": ["state-line-legal-status", "state-compensation-validity", "state-map-disclosure"],
  "35": ["state-provenance-restoration", "state-donor-recognition", "state-museum-opening"],
  "36": ["state-algae-containment", "state-release-authority", "state-reef-recovery"],
  "37": ["state-marriage-consent", "state-ritual-jurisdiction", "state-river-obligation"],
  "38": ["state-editing-control", "state-audience-perception", "state-match-consent"],
  "39": ["state-ballot-authenticity", "state-release-eligibility", "state-repair-agreement"],
  "40": ["state-version-custody", "state-memory-consent", "state-history-publication"]
};

const contributionTypesByMode = {
  mystery: ["evidence", "authority", "task", "relationship", "commitment", "evidence"],
  emotional: ["relationship", "commitment", "memory", "relationship", "commitment", "memory"],
  political: ["authority", "resource", "commitment", "relationship", "authority", "resource"],
  variety: ["task", "audience", "relationship", "commitment", "task", "audience"],
  survival: ["resource", "risk", "authority", "commitment", "resource", "risk"],
  hybrid: ["evidence", "relationship", "authority", "task", "commitment", "resource"]
};

const storyEnginesById = {
  "01": "身份连续性审判决定恒星机器是否释放返航推进剂，玩家的自证方式会改写机器对“人”的定义",
  "02": "六种香气只能在对应关系承诺被履行后释放记忆，继承不是找文件而是重建照料链",
  "03": "七分钟停靠窗把身份揭露、皮箱转交和军列拦截绑定为不可同时完成的三项任务",
  "04": "铜镜光学复现改变证词可采性，玩家每次选择公开哪面镜子都会重排案件程序责任",
  "05": "数字人格的证词资格随保管链与人格连续性裁定逐章变化，判决先决定谁有资格说话",
  "06": "注销工号仍掌握自动化签字权，六人必须用真实责任承接系统中不存在的部门",
  "07": "撤离席位、冰芯公开与站点生存互相争夺同一时间窗口，任何保全都会转移风险给另一人",
  "08": "祖物归位会重写族谱继承关系，借骨仪式本身成为玩家争夺身份与返乡权的操作系统",
  "09": "校刊文章只有在作者兑现旧承诺后才恢复完整段落，人生预言由共同编辑史反向生成",
  "10": "宪法仲裁通过动议、席位与否决范围累计改写登陆合法性，而不是最终一次投票",
  "11": "盐焗配方的步骤顺序同时对应救援路线与店铺继承，烹饪操作会改变名单可验证性",
  "12": "每次选择保留哪段共同记忆都会关闭一条出站路径，循环出口由记忆损失的组合决定",
  "13": "人工鲸落能源配额与迁徙社区的法律承认相互锁定，城市浮力由承认谁的贡献来维持",
  "14": "玩具必须真实回答封闭式问题，但可以明确拒答；玩家以问题设计和可见沉默构造逻辑证明",
  "15": "沙图依据风向、承重和旧测绘数据推演移动结构，错误预测会永久封闭一条陵城路线",
  "16": "演奏声部的保留与删除直接改变署名证据和参赛资格，音乐选择本身就是归责行动",
  "17": "撤下热搜会触发分布式保全链的自动销毁指令，玩家必须在传播控制与证据留存间抢时间",
  "18": "举报信的保管与公开会改变拆迁协商席位，家族关系不是秘密清单而是现实谈判资源",
  "19": "未出鞘之剑依据旧契约自动转移名誉责任，六派用承认、继承或拒绝契约来发动攻防",
  "20": "呼吸机容量、签名资格和治疗优先级通过医疗程序逐章锁定，伦理选择立即改变可执行方案",
  "21": "七张匿名便签的笔迹、粘贴时间和画作保管链组成可操作鉴定，喜剧来自争抢错误赝品",
  "22": "古树按持续照料而非功绩评分开启种子权限，社区承诺的履行顺序决定温室能否共同开放",
  "23": "戏词唱法会显影不同名单层，演员对最后一句的选择改变救命名单的公开范围与剧团归属",
  "24": "镜面视线、甲板权限与潮汐高度共同决定倒影证词，玩家可重建或破坏同一视觉条件",
  "25": "每次翻译都会赋予下一位护送者新的法律义务，信件意义由旅途中的行动而非字面谜底完成",
  "26": "第七人的工作权限分散寄存在六人账户中，恢复某段记录就会让对应玩家失去既得身份",
  "27": "倒流雨水按旧承诺而非物权归还物品，错误归还会改变拆迁联盟和邻里责任",
  "28": "空椅只记录被程序排除的参与权，六人通过恢复程序而非猜凶手逐步改变裁决有效性",
  "29": "无声频谱需要以不同监听位置复原，公开一个频段会同时暴露一段撤离路线",
  "30": "液压暗门按矿区旧工号与压力序列折叠空间，维护记录决定哪些宿舍可被重新看见",
  "31": "伴星证据只有在六份观测承诺对齐时成立，爱情抉择会改变科学署名与告别是否完成",
  "32": "双方正式注册的数字孪生依据紧急连续竞赛条款在隔离官方服务器实时完成第五局；玩家通过授权链、服务器对局与申诉程序决定代理赛效力",
  "33": "黑裙尺寸必须由六种身体经验共同校准，缝合选择会恢复或继续抹去设计署名",
  "34": "十四号线作为法律项目存在却从未建成，玩家操作征迁、预算与地图三套互不从属的效力",
  "35": "展签翻面会改变馆藏来源声明和开馆资格，玩家必须用归还、共管或公开重新配置展品权利",
  "36": "人类线粒体DNA片段被整合进珊瑚共生藻，释放流程通过隔离级别与生态监测逐章裁决",
  "37": "三版婚约在神、人、巫三套法域中各自有效，喜剧冲突来自同一句祭文被不同程序执行",
  "38": "不存在的第七嘉宾是合成人群画像而非被删除的人，节目任务会决定画像是否继续代替真实选择",
  "39": "原始赞成票被篡改为反对，六人通过投票保管链与修复协议分别判断事实和是否假释",
  "40": "七个昨日版本各自控制一项现实公共记录，归还某版会永久关闭另一版的社会后果"
};

const hardCorrectionsById = {
  "03": "身份关系必须明确：名单同时包含沈云起要清除的军统内部叛徒与用于栽赃的中共地下党；每名玩家所属阵营和被列入原因逐一写清。",
  "14": "玩具面对可判定的是非问题必须如实回答；它们可以拒答，但拒答必须公开显示为“沉默”，不能用语义绕开“你是否隐瞒”这类元问题。",
  "15": "沙图推演必须明确使用风向、承重、旧测绘点等可见输入和固定计算步骤，不能让玩家盲猜。",
  "17": "记忆或证据碎片必须由具体玩家行动触发取得；撤热搜与证据消失之间必须有可追踪的自动销毁链，不得泛化成收买所有人。",
  "21": "七幅画不准超自然说话；机制固定为七张不同笔迹和粘贴时间的匿名“我是赝品”便签，并通过笔迹与保管链鉴定。",
  "30": "红门固定为旧林场施工时留下、由赵恪持续维护的液压暗门系统；空间变化来自液压折叠，不得写成无声坍塌。",
  "32": "第五局必须整体重构：不是预测、预录、训练模拟或未来录像。双方正式注册的数字孪生依据赛前紧急连续竞赛条款，在隔离官方服务器实时读取版本、阵容与对手孪生策略并完成真实对局；比分来自服务器对战，伤病或退出绝不自动判胜。争议只围绕授权是否有效、代理赛是否具有赛事效力以及是否启动真人重赛。",
  "36": "不得把完整人类线粒体移植进珊瑚；固定为将陈阿婆的线粒体DNA标记片段整合进珊瑚共生藻，并交代技术边界。",
  "39": "票务逻辑固定为：林晓雨本人投赞成，张强篡改成反对；系统表面异常与溯源痕迹围绕这一次方向明确的篡改展开。"
};

const resourceContractsById = {
  "06": [{ key: "resource-06-compliance-appeal", name: "合规申诉次数", meaning: "团队可要求人工复核注销工号签字链的正式申诉次数", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "07": [{ key: "resource-07-evacuation-seat", name: "可确认撤离席位", meaning: "暴风雪关闭窗口前仍可实名确认的撤离座位", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "10": [{ key: "resource-10-charter-motion", name: "宪法动议次数", meaning: "执政官仍可提交并进入正式表决的临时宪法动议", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "11": [{ key: "resource-11-rescue-fire-window", name: "救援炉火时窗", meaning: "盐焗炉在断电前还能维持可验证烹饪与救援信号的时窗", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "13": [{ key: "resource-13-buoyancy-quota", name: "浮力能源配额", meaning: "鲸落城可在迁徙社区与核心城区之间重新分配的三段浮力能源", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "17": [{ key: "resource-17-preservation-node", name: "异地保全节点", meaning: "撤下热搜前可写入且不会被平台联动销毁的独立保全节点", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "19": [{ key: "resource-19-oath-challenge", name: "剑契质证印", meaning: "六派能在公开场合冻结一次剑契责任转移的公证印", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "22": [{ key: "resource-22-water-allotment", name: "温室水配额", meaning: "社区在停水周期内可分配给古树、幼苗或居民的灌溉批次", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "28": [{ key: "resource-28-procedure-review", name: "程序复议席", meaning: "恢复性司法会议中可暂停议程并要求重新确认参与资格的席位", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "32": [{ key: "resource-32-official-review", name: "赛事认证复核席位", meaning: "可要求联盟调取数字孪生授权链、服务器镜像或发起真人重赛的正式复核席位", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "34": [{ key: "resource-34-public-hearing", name: "公开听证席位", meaning: "城市议会留给征迁、预算或线路资格争议的公开陈述席位", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "36": [{ key: "resource-36-quarantine-tank", name: "生态隔离舱位", meaning: "珊瑚共生藻样本在释放前可使用的独立隔离与观察舱位", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "37": [{ key: "resource-37-oath-seal", name: "三界验誓印", meaning: "可让神、人、巫任一法域暂停执行婚约并接受交叉质证的验誓印", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "38": [{ key: "resource-38-edit-veto", name: "剪辑否决权", meaning: "嘉宾可阻止节目组使用一次合成人群画像替代真实采访的否决权", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "39": [{ key: "resource-39-ballot-recount", name: "原票复核次数", meaning: "假释听证前可开封原始投票载体并重建一次保管链的正式复核次数", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }],
  "40": [{ key: "resource-40-version-restore-window", name: "记忆归还窗口", meaning: "昨日保管处仍可把某一版本写回公共历史且不覆盖其他版本的操作窗口", initialValue: 3, minimum: 0, maximum: 3, ownerType: "group", ownerKey: "", recoverable: false }]
};

const semanticInvariantsById = {
  "01": [
    { key: "timeline-fuel-lock", statement: "返航推进剂在考古队抵达前已被机器锁死；第一章只能发现、确认或误判这一事实，不能再次触发锁死。", requiredPatterns: ["(?:(?:考古队|队伍).{0,12}(?:抵达|登陆).{0,12}(?:之前|以前|前).{0,30}(?:锁死|封存)|(?:锁死|封存).{0,80}(?:考古队|队伍).{0,20}(?:抵达|登陆))"], forbiddenPatterns: ["采集.{0,30}(?:后|时).{0,20}锁死", "感知入侵.{0,30}锁死", "\"action\":\"[^\"]*(?:触发|导致)[^\"]*(?:燃料|推进剂)[^\"]*锁死"] },
    { key: "propulsion-ending", statement: "凡结局判定推进剂已经释放或可用，就不得同时宣称燃料被摧毁或队伍无法返航。", requiredPatterns: ["返航推进剂"], forbiddenPatterns: ["\"consequence\":\"[^\"]*(?:推进剂|燃料)[^\"]*(?:释放|可用|解锁)[^\"]*(?:燃料被摧毁|无法返航)"] }
  ],
  "14": [
    { key: "visible-silence", statement: "玩具拒答时必须公开显示并留下可见的沉默记录。", requiredPatterns: ["拒答.{0,30}(?:公开|可见).{0,20}(?:沉默|记录)"], forbiddenPatterns: ["沉默.{0,20}(?:不被记录|不记录|未记录)", "拒答.{0,20}(?:不被记录|不记录|未记录)", "沉默记录.{0,20}(?:被覆盖|被删除|不再可见)", "拒答.{0,20}不再可见"] }
  ],
  "32": [
    { key: "actual-twin-match", statement: "第五局由双方正式注册的数字孪生在官方隔离服务器实时对战完成，不是预测、预录、未来录像或训练模拟；伤病不会自动使战队获胜。", requiredPatterns: ["数字孪生.{0,80}实时.{0,40}(?:对战|完成)", "紧急连续竞赛条款", "伤病.{0,20}(?:不能|不会|不得|绝不|并不).{0,12}(?:自动|直接).{0,10}(?:获胜|判胜)"], forbiddenPatterns: ["第五局.{0,20}(?:只是|实为|本质是).{0,12}(?:预测|预录|训练模拟)", "(?:通过|使用|依靠|根据).{0,12}(?:预测模型|预测算法).{0,30}(?:生成|制作).{0,12}(?:录像|第五局)"] }
  ]
};

const playerIdentityRequirementsById = {
  "32": [
    "战队数据官",
    "战队主力选手",
    "战队领队",
    "战队替补选手",
    "战队战术教练",
    "战队经理"
  ]
};

const evidenceSourceContractsById = {
  "32": [
    { evidenceKey: "evidence-1", provenanceGroup: "system-official-isolated-server", sourceType: "设备日志", originRootKeys: ["system-official-isolated-server"], commonCauseKeys: [], independenceDomain: "官方隔离服务器及其可信时钟", methodDomain: "digital-forensics" },
    { evidenceKey: "evidence-2", provenanceGroup: "system-league-rule-registry", sourceType: "制度记录", originRootKeys: ["system-league-rule-registry"], commonCauseKeys: [], independenceDomain: "联盟条款版本库与签署服务", methodDomain: "records-authentication" },
    { evidenceKey: "evidence-3", provenanceGroup: "npc-match-supervisor", sourceType: "独立证词", originRootKeys: ["npc-match-supervisor"], commonCauseKeys: [], independenceDomain: "赛事监督亲历的程序行为", methodDomain: "witness-interview" },
    { evidenceKey: "evidence-4", provenanceGroup: "object-fifth-game-server-image", sourceType: "数字物证", originRootKeys: ["system-official-isolated-server"], commonCauseKeys: ["system-official-isolated-server"], independenceDomain: "官方隔离服务器及其可信时钟", methodDomain: "digital-forensics" },
    { evidenceKey: "evidence-5", provenanceGroup: "system-opponent-telemetry", sourceType: "设备日志", originRootKeys: ["system-opponent-telemetry"], commonCauseKeys: [], independenceDomain: "对手方遥测终端与外部时间戳", methodDomain: "telemetry-forensics" }
  ]
};

const stateSetChapterKeysById = {
  "32": ["chapter-1", "chapter-2", "chapter-2", "chapter-3", "chapter-4"]
};

const stateControlModesById = {
  "32": ["observed", "observed", "adjudicated", "adjudicated", "player-decision"]
};

const fixedStateValuesById = {
  "32": ["authentic", "intact", "", "", ""]
};

const roleEndingInfluencesById = {
  "32": [
    { roleKey: "role-1", stateKey: "state-authorization-validity", chapterKey: "chapter-2", influenceMode: "causal-path", causalAnchorKey: "evidence-1" },
    { roleKey: "role-2", stateKey: "state-result-recognition", chapterKey: "chapter-4", influenceMode: "causal-path", causalAnchorKey: "evidence-2" },
    { roleKey: "role-3", stateKey: "state-clause-applicability", chapterKey: "chapter-3", influenceMode: "causal-path", causalAnchorKey: "evidence-2" },
    { roleKey: "role-4", stateKey: "state-match-integrity", chapterKey: "chapter-2", influenceMode: "causal-path", causalAnchorKey: "evidence-4" },
    { roleKey: "role-5", stateKey: "state-result-recognition", chapterKey: "chapter-4", influenceMode: "causal-path", causalAnchorKey: "evidence-5" },
    { roleKey: "role-6", stateKey: "state-result-recognition", chapterKey: "chapter-4", influenceMode: "causal-path", causalAnchorKey: "evidence-1" }
  ]
};

function chapterCountFor(item) {
  return item.id === "07" || item.id === "28" ? 4 : item.id === "10" || item.id === "40" ? 6 : 5;
}

function generationContractFor(item) {
  const genreMode = genreModeFor(item);
  const exactPremiseAnchors = [
    ...item.anchors.filter((anchor) => item.premise.includes(anchor)),
    ...item.premise
      .split(/[，。；;]/u)
      .map((segment) => segment.trim())
      .filter((segment) => segment.length >= 4 && segment.length <= 160)
  ].filter((anchor, index, rows) => rows.indexOf(anchor) === index).slice(0, 3);
  const chapterCount = chapterCountFor(item);
  const chapterKeys = Array.from({ length: chapterCount }, (_, index) => `chapter-${index + 1}`);
  const splitIndex = Math.floor((chapterCount - 1) / 2);
  const stateKeys = coreStateKeysById[item.id];
  const stateSetChapterKeys = stateSetChapterKeysById[item.id] || stateKeys.map((_, index) => {
    if (index === 0) return chapterKeys[0];
    if (index === stateKeys.length - 1) return chapterKeys[Math.max(1, chapterCount - 2)];
    const distributedIndex = Math.min(chapterCount - 2, Math.max(1, Math.round((index / Math.max(1, stateKeys.length - 1)) * (chapterCount - 2))));
    return chapterKeys[distributedIndex];
  });
  const spotlightChapterKeys = chapterCount >= 6
    ? chapterKeys.slice(0, 6)
    : [
        chapterKeys[0],
        chapterKeys[0],
        chapterKeys[Math.min(1, chapterCount - 1)],
        chapterKeys[Math.min(2, chapterCount - 1)],
        chapterKeys[Math.min(3, chapterCount - 1)],
        chapterKeys.at(-1)
      ];
  const styleDeviceSeeds = [
    item.anchors[0],
    ...String(item.style).split(/[、，,；;]|与/u)
  ]
    .map((value) => value.trim())
    .filter(Boolean)
    .map((value) => (value.length >= 4 ? value : `${item.title}·${value}表现`))
    .slice(0, 3);
  const roleEndingInfluences = roleEndingInfluencesById[item.id] || [
    ["role-1", stateKeys[0], stateSetChapterKeys[0]],
    ["role-2", stateKeys[0], stateSetChapterKeys[0]],
    ["role-3", stateKeys[1], stateSetChapterKeys[1]],
    ["role-4", stateKeys[1], stateSetChapterKeys[1]],
    ["role-5", stateKeys[2], stateSetChapterKeys[2]],
    ["role-6", stateKeys[2], stateSetChapterKeys[2]]
  ].map(([roleKey, stateKey, chapterKey]) => ({ roleKey, stateKey, chapterKey, influenceMode: "causal-path", causalAnchorKey: "" }));
  const minimumActionChapters = Math.ceil(chapterCount * 0.6);
  const roleActionChapterKeys = roleEndingInfluences.map((influence, index) => {
    const assigned = new Set([
      influence.chapterKey,
      spotlightChapterKeys[index]
    ]);
    for (let offset = 0; assigned.size < minimumActionChapters && offset < chapterCount * 2; offset += 1) {
      assigned.add(chapterKeys[(index * 2 + offset) % chapterCount]);
    }
    return {
      roleKey: influence.roleKey,
      chapterKeys: chapterKeys.filter((chapterKey) => assigned.has(chapterKey))
    };
  });
  const resourceContracts = resourceContractsById[item.id] || [];
  const evidenceSourceContracts = evidenceSourceContractsById[item.id] || [];
  const resourceKeys = resourceContracts.map((resource) => resource.key);
  const resourceUsagePlans = [];
  const resourcePolicies = resourceContracts.map((resource) => ({
    resourceKey: resource.key,
    minimumOptionalUses: Math.min(2, Math.max(1, chapterCount - 2)),
    maximumMandatoryUses: 0,
    placement: "chapterBeats.decision.options.effects",
    optionalUseChapterKeys: item.id === "32"
      ? ["chapter-1", "chapter-5"]
      : [...new Set([chapterKeys[Math.min(1, chapterCount - 1)], chapterKeys[Math.max(0, chapterCount - 2)]])]
  }));
  const endingTitleTokens = [];
  const topologyPatterns = [
    "六人分成两个互相依赖但目标冲突的三人组",
    "一名程序守门人连接五条互不对称的私人关系",
    "三组双人旧关系在公共任务中交叉换边",
    "六人构成责任传递环，任何人退出都会让下一人承担代价",
    "两名公开盟友、两名隐性竞争者与两名跨阵营调停者形成动态三角",
    "六人共享同一目标但分别控制互斥的执行权限"
  ];
  const index = Number(item.id) - 1;
  return {
    batchItemId: item.id,
    premiseAnchors: exactPremiseAnchors,
    playerNames: allocatedPlayerNames(item),
    playerIdentityRequirements: playerIdentityRequirementsById[item.id] || [],
    genreMode,
    contributionTypes: contributionTypesByMode[genreMode],
    stateKeys,
    stateKeysAreExhaustive: item.id === "32",
    stateTypes: stateKeys.map(() => "enum"),
    stateSetChapterKeys,
    stateControlModes: stateControlModesById[item.id] || stateKeys.map(() => ""),
    fixedStateValues: fixedStateValuesById[item.id] || stateKeys.map(() => ""),
    resourceKeys,
    resourceContracts,
    resourceUsagePlans,
    resourcePolicies,
    evidenceProvenanceGroups: evidenceSourceContracts.map((entry) => entry.provenanceGroup),
    evidenceSourceTypes: evidenceSourceContracts.map((entry) => entry.sourceType),
    evidenceSourceContracts,
    requiredConclusionEvidenceKeys: item.id === "32" ? ["evidence-1", "evidence-2", "evidence-5"] : [],
    hookEvidenceRequirements: item.id === "32" ? [
      { hookIndex: 0, evidenceKeys: ["evidence-1", "evidence-5"] },
      { hookIndex: 1, evidenceKeys: ["evidence-4", "evidence-5"] }
    ] : [],
    spotlightChapterKeys,
    roleEndingInfluences,
    roleActionChapterKeys,
    forbiddenStateKeys: ["state-trust", "state-team-trust", "team-trust", "group-trust"],
    outlineRevision: "2.4",
    semanticInvariants: semanticInvariantsById[item.id] || [],
    endingTitleTokens,
    storyEngine: storyEnginesById[item.id],
    existenceStatusMechanism: ["03", "06", "17", "26", "34", "38"].includes(item.id)
      ? {
          "03": "军列物理存在但被从公开时刻表隐藏",
          "06": "员工主体已注销而遗留自动化授权继续有效",
          "17": "数字证据被联动销毁但人物与物理现实没有消失",
          "26": "第七人真实存在过，其记录与权限被企业系统主动删除",
          "34": "线路作为法律和征迁项目存在，但物理线路从未建成",
          "38": "第七嘉宾从未作为真人存在，只是合成人群画像"
        }[item.id]
      : `${item.anchors[0]}本体持续存在；异常只改变${item.anchors[1]}对${item.anchors[2]}的作用结果`,
    truthKnowledgeDistribution: `role-1掌握${item.anchors[0]}起因；role-2与role-3分持${item.anchors[1]}判定；role-4控制${stateKeys[1]}；role-5与role-6只见${item.anchors[2]}后果`,
    playerRelationshipTopology: `${item.title}：${topologyPatterns[index % topologyPatterns.length]}`,
    finalChoiceType: `${item.title}由${stateKeys.join("、")}的累计组合触发，不使用最终章临时公开或隐瞒投票`,
    themeExpression: `${item.title}通过${item.anchors.join("、")}检验：${item.requirements}`,
    antagonistType: `${item.anchors[0]}执行权、${stateKeys[1]}锁定权与${item.anchors[2]}代价承担者互为阻力`,
    mysteryObjectType: `${item.title}以${item.anchors.join("、")}组成唯一异常对象组，不替换成删除档案模板`,
    truthRevealMethod: `${item.anchors[0]}现场操作、${item.anchors[1]}保管链与${item.anchors[2]}后果回读三向确认`,
    chapterCausalPattern: `${item.title}先写入${stateKeys[0]}，再由${stateKeys[1]}改变中段权限，最后让${stateKeys[2]}关闭或开放结局资源`,
    evidenceModalityMix: `${item.title}采用${genreMode}题材的${styleDeviceSeeds.join("、")}三类可见载体与行动结果`,
    powerStructure: `${item.anchors[0]}控制${stateKeys[0]}；${item.anchors[1]}控制${stateKeys[1]}；${item.anchors[2]}受${stateKeys[2]}反向制衡`,
    endingMechanism: `${item.title}按${stateKeys.join("、")}${resourceKeys.length ? `及${resourceKeys.join("、")}` : ""}的可达组合和最高优先级路线判定结局`,
    styleDeviceSeeds
  };
}

function buildSpec(item) {
  const chapterCount = chapterCountFor(item);
  const playerCount = 6;
  const chapterKeys = Array.from({ length: chapterCount }, (_, index) => `chapter-${index + 1}`);
  const genreMode = genreModeFor(item);
  const playerNames = allocatedPlayerNames(item);
  const generationContract = generationContractFor(item);
  return {
    title: item.title,
    playerCount,
    chapterCount,
    chapterKeys,
    targetWordCount: chapterCount * 3600,
    wordsPerSectionMin: 280,
    sceneCount: chapterCount * 2 + 2,
    investigationPointCount: chapterCount * 3 + 3,
    clueCount: chapterCount * 3 + 4,
    constraints: [
      `必须围绕这些题材锚点展开：${item.anchors.join("、")}`,
      item.requirements,
      hardCorrectionsById[item.id] || "不得用普通剪辑、全能黑客、NPC自白或最后突然出现的文件降级解释高概念。",
      `genreProfile.mode 必须为 ${genreMode}。${genreProgressConstraint(genreMode)}`,
      `为支持 40 篇高并发且在写作前完成姓名去重，六名玩家必须逐字使用这组本批次独占姓名，不得换成常见占位名：${playerNames.join("、")}`,
      `核心状态只能使用：${generationContract.stateKeys.join("、")}；不得创建通用信任值。`,
      "误导必须符合题材，可以是错误嫌疑、关系误解、阵营误判、公众叙事或风险误判；不得用无关污点或作者欺骗凑数",
      "每章都要改变嫌疑排序、目标冲突或人物联盟",
      "不要使用跑团数值、骰点或战斗数值",
      "不得擅自改写成校园同学会、普通埋尸旧案或泛化豪门争产"
    ],
    notes: [
      `题材：${item.genre}`,
      `文风：${item.style}`,
      "本轮只输出总纲，不展开场景正文与角色私人本"
    ]
  };
}

function buildBrief(item, spec, attempt) {
  const genreMode = genreModeFor(item);
  const playerNames = allocatedPlayerNames(item);
  const generationContract = generationContractFor(item);
  const retryNote = attempt > 1
    ? `这是第 ${attempt} 份从零开始的完整草稿。上一份未形成可保存的机械合格结果；不要读取、修补或模仿上一份内容，只按同一份生成前合同重新完成蓝图与章节装配。`
    : "";
  return {
    title: item.title,
    premise: item.premise,
    style: item.style,
    audience: "喜欢多人互动叙事、信息差、推理或情感抉择的成年玩家",
    playerCount: spec.playerCount,
    chapterCount: spec.chapterCount,
    targetWordCount: spec.targetWordCount,
    wordsPerChapter: Math.round(spec.targetWordCount / spec.chapterCount),
    sceneCount: spec.sceneCount,
    investigationPointCount: spec.investigationPointCount,
    clueCount: spec.clueCount,
    conflicts: `${item.requirements}\n${hardCorrectionsById[item.id] || ""}\n题材推进模式固定为 ${genreMode}：${genreProgressConstraint(genreMode)}\n${retryNote}`,
    roleRequirements: `角色身份、利益与秘密必须互相咬合；贡献锚点应随题材落在证据、关系、承诺、权限、资源、任务或风险上，并形成通往结局条件的因果路径；避免纯工具人。六名玩家姓名必须依次且逐字使用：${playerNames.join("、")}。这些姓名混合二字名、三字名、字号或代号，不得擅自统一中间字、尾字或改造成姓名矩阵。`,
    evaluationFocus: "题材忠实度、责任类型拆分、真实来源实体、实体语义类型、世界内选择文案、类型一致的状态机、非装饰性题材资源、因果时间线、条件失败分支、玩家因果贡献、累计结局和逐章文风落地；只有 mystery 强制核心结论双源印证。",
    generationContract
  };
}

function summarizeGeneratorOutput(item, spec, outline) {
  const text = JSON.stringify(outline);
  const anchorHits = item.anchors.filter((anchor) => text.includes(anchor));
  const chapterKeys = outline.chapterBeats?.map((beat) => beat.chapterKey) || [];
  return {
    anchorHits,
    outlineRevision: outline.outlineRevision || null,
    deliveryAcceptance: outline.readiness?.strictValidated ? "strict-mechanical-contract" : "rejected",
    strictMechanicalAcceptance: outline.readiness?.strictValidated === true,
    playerCount: outline.players?.length || 0,
    chapterCount: chapterKeys.length,
    expectedPlayerCount: spec.playerCount,
    expectedChapterCount: spec.chapterKeys.length,
    constraintSource: "v2.4-semantic-constitution-preflight"
  };
}

async function readExisting(item) {
  if (process.env.OUTLINE_FORCE_REGENERATE === "1") return null;
  const file = path.join(itemDir, `${item.id}.json`);
  try {
    const parsed = JSON.parse(await fs.readFile(file, "utf8"));
    if (!(parsed?.generationStatus === "complete"
      && parsed?.outline?.outlineVersion === 2
      && parsed?.outline?.outlineRevision === "2.4"
      && parsed?.outline?.readiness?.strictValidated === true)) return null;
    const spec = buildSpec(item);
    const brief = buildBrief(item, spec, Number(parsed.attempt) || 1);
    parsed.outline.batchFingerprint = parsed.outline.batchFingerprint || {};
    for (const field of lockedFingerprintFields) {
      if (brief.generationContract?.[field]) {
        parsed.outline.batchFingerprint[field] = brief.generationContract[field];
      }
    }
    const outline = validateStoryOutline(parsed.outline, spec, { strict: true, brief });
    const refreshed = {
      ...parsed,
      model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
      spec,
      outline,
      generatorSummary: summarizeGeneratorOutput(item, spec, outline)
    };
    await fs.writeFile(file, `${JSON.stringify(refreshed, null, 2)}\n`, "utf8");
    return refreshed;
  } catch {
    await fs.rm(file, { force: true });
    return null;
  }
}

async function recoverCompletedCheckpoint(item) {
  if (process.env.OUTLINE_FORCE_REGENERATE === "1") return null;
  let statusFiles = [];
  try {
    statusFiles = (await fs.readdir(checkpointDir))
      .filter((name) => (
        name.startsWith(`${item.id}.`)
        && name.includes(".draft-")
        && name.includes(".assembly.")
        && name.endsWith(".status.json")
      ))
      .sort()
      .reverse();
  } catch {
    return null;
  }
  const spec = buildSpec(item);
  for (const statusName of statusFiles) {
    try {
      const statusPath = path.join(checkpointDir, statusName);
      const status = JSON.parse(await fs.readFile(statusPath, "utf8"));
      if (status.status !== "accepted") continue;
      const partialPath = statusPath.replace(/\.status\.json$/, ".partial.json");
      const rawAssembly = JSON.parse(await fs.readFile(partialPath, "utf8"));
      const blueprintPath = statusPath.replace(/\.assembly\.status\.json$/, ".blueprint.partial.json");
      const rawBlueprint = JSON.parse(await fs.readFile(blueprintPath, "utf8"));
      const brief = buildBrief(item, spec, Number(status.draftAttempt) || 1);
      const blueprint = validateStoryOutlineBlueprint(rawBlueprint, spec, { brief });
      const outline = validateStoryOutline(
        mergeStoryOutlineAssembly(blueprint, rawAssembly, spec, {
          generationContract: brief.generationContract
        }),
        spec,
        { strict: true, brief }
      );
      const generatorSummary = summarizeGeneratorOutput(item, spec, outline);
      const completionBudget = Math.min(20000, Math.max(12000, 8000 + (spec.chapterCount * 1600)));
      const record = {
        id: item.id,
        title: item.title,
        genre: item.genre,
        style: item.style,
        anchors: item.anchors,
        provider: "deepseek",
        model: process.env.DEEPSEEK_MODEL || "deepseek-v4-flash",
        attempt: Number(status.draftAttempt) || 1,
        generationStatus: "complete",
        recoveredFromCheckpoint: true,
        generationMetrics: status.usage ? {
          attempts: [{
            attempt: 1,
            stage: "assembly",
            finishReason: status.finishReason || null,
            promptTokens: Number(status.usage.promptTokens) || 0,
            completionTokens: Number(status.usage.completionTokens) || 0,
            totalTokens: Number(status.usage.totalTokens) || 0,
            completionBudget,
            nearCompletionLimit: Number(status.usage.completionTokens) >= Math.floor(completionBudget * 0.9)
          }],
          totalPromptTokens: Number(status.usage.promptTokens) || 0,
          totalCompletionTokens: Number(status.usage.completionTokens) || 0,
          nearCompletionLimit: Number(status.usage.completionTokens) >= Math.floor(completionBudget * 0.9)
        } : null,
        spec,
        generatorSummary,
        outline
      };
      await fs.writeFile(path.join(itemDir, `${item.id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
      console.log(`RECOVER ${item.id}/40 ${item.title} checkpoint=${statusName}`);
      return record;
    } catch {
      // Try the next completed checkpoint for this item.
    }
  }
  return null;
}

async function recoverAcceptedBlueprintCheckpoint(item, spec, brief) {
  if (process.env.OUTLINE_REUSE_ACCEPTED_BLUEPRINT !== "1") return null;
  let statusFiles = [];
  try {
    statusFiles = (await fs.readdir(checkpointDir))
      .filter((name) => (
        name.startsWith(`${item.id}.`)
        && name.includes(".draft-")
        && name.includes(".blueprint.")
        && !name.includes(".attempt-")
        && name.endsWith(".status.json")
      ))
      .sort()
      .reverse();
  } catch {
    return null;
  }
  let latestInvalid = null;
  for (const statusName of statusFiles) {
    try {
      const statusPath = path.join(checkpointDir, statusName);
      const status = JSON.parse(await fs.readFile(statusPath, "utf8"));
      if (status.status !== "accepted" || status.stage !== "blueprint") continue;
      const partialPath = statusPath.replace(/\.status\.json$/u, ".partial.json");
      const rawBlueprint = JSON.parse(await fs.readFile(partialPath, "utf8"));
      const blueprint = validateStoryOutlineBlueprint(rawBlueprint, spec, { brief });
      console.log(`REUSE-BLUEPRINT ${item.id}/40 ${item.title} checkpoint=${statusName}`);
      return { blueprint, checkpointSessionId: statusName.split(".")[1] || "" };
    } catch (error) {
      if (!latestInvalid) {
        try {
          const statusPath = path.join(checkpointDir, statusName);
          const partialPath = statusPath.replace(/\.status\.json$/u, ".partial.json");
          latestInvalid = {
            blueprint: null,
            candidate: JSON.parse(await fs.readFile(partialPath, "utf8")),
            issues: Array.isArray(error?.details?.issues) ? error.details.issues : [error?.message || String(error)],
            checkpointSessionId: statusName.split(".")[1] || ""
          };
        } catch {
          // Ignore an unreadable invalid checkpoint.
        }
      }
      // The latest validator may invalidate an older accepted blueprint; try the next one.
    }
  }
  const attemptPartials = await fs.readdir(checkpointDir).catch(() => []);
  const candidatePartials = (Array.isArray(attemptPartials) ? attemptPartials : [])
    .filter((name) => (
      name.startsWith(`${item.id}.`)
      && name.includes(".draft-")
      && name.includes(".blueprint.attempt-")
      && name.endsWith(".partial.json")
    ))
    .sort()
    .reverse();
  for (const partialName of candidatePartials) {
    try {
      const rawBlueprint = JSON.parse(await fs.readFile(path.join(checkpointDir, partialName), "utf8"));
      const blueprint = validateStoryOutlineBlueprint(rawBlueprint, spec, { brief });
      console.log(`REVALIDATE-BLUEPRINT ${item.id}/40 ${item.title} checkpoint=${partialName}`);
      return { blueprint, checkpointSessionId: partialName.split(".")[1] || "" };
    } catch {
      // A formerly rejected candidate is only recoverable if it passes every current gate.
    }
  }
  return latestInvalid;
}

async function recoverAcceptedAssemblyComponents(item, checkpointSessionId) {
  if (process.env.OUTLINE_REUSE_ACCEPTED_BLUEPRINT !== "1") return undefined;
  if (!checkpointSessionId) return undefined;
  const stageByComponent = {
    playerActions: "assembly-player-actions",
    chapterBeats: "assembly-chapter-beats",
    styleExpressions: "assembly-style-expressions"
  };
  let names = [];
  try {
    names = await fs.readdir(checkpointDir);
  } catch {
    return undefined;
  }
  const recovered = {};
  for (const [componentKey, stage] of Object.entries(stageByComponent)) {
    const candidates = names
      .filter((name) => (
        name.startsWith(`${item.id}.${checkpointSessionId}.`)
        && name.includes(".draft-")
        && name.includes(`.${stage}.`)
        && !name.includes(".attempt-")
        && name.endsWith(".status.json")
      ))
      .sort()
      .reverse();
    for (const statusName of candidates) {
      try {
        const statusPath = path.join(checkpointDir, statusName);
        const status = JSON.parse(await fs.readFile(statusPath, "utf8"));
        if (status.status !== "accepted" || status.stage !== stage) continue;
        const partialPath = statusPath.replace(/\.status\.json$/u, ".partial.json");
        recovered[componentKey] = JSON.parse(await fs.readFile(partialPath, "utf8"));
        console.log(`REUSE-COMPONENT ${item.id}/40 ${stage} checkpoint=${statusName}`);
        break;
      } catch {
        // Try the next accepted checkpoint for this component.
      }
    }
  }
  return Object.keys(recovered).length ? recovered : undefined;
}

async function recoverLatestRejectedBlueprint(item) {
  const names = await fs.readdir(checkpointDir).catch(() => []);
  const candidates = (Array.isArray(names) ? names : [])
    .filter((name) => name.startsWith(`${item.id}.`) && name.includes(".blueprint") && name.endsWith(".status.json"))
    .sort()
    .reverse();
  for (const statusName of candidates) {
    try {
      const status = JSON.parse(await fs.readFile(path.join(checkpointDir, statusName), "utf8"));
      const issues = Array.isArray(status?.details?.issues) ? status.details.issues : [];
      if (status.status !== "failed" || status.stage !== "blueprint" || !issues.length) continue;
      const partialName = statusName.replace(/\.status\.json$/u, ".partial.json");
      const candidate = JSON.parse(await fs.readFile(path.join(checkpointDir, partialName), "utf8"));
      console.log(`CARRY-ISSUES ${item.id}/40 ${item.title} checkpoint=${statusName} issues=${issues.length}`);
      return { issues: issues.slice(0, 20), candidate };
    } catch {
      // Ignore malformed historic checkpoints and keep searching.
    }
  }
  return { issues: [], candidate: null };
}

async function recoverLatestRejectedAssembly(item, checkpointSessionId) {
  if (!checkpointSessionId) return { issues: [], candidate: null };
  const names = await fs.readdir(checkpointDir).catch(() => []);
  const candidates = (Array.isArray(names) ? names : [])
    .filter((name) => (
      name.startsWith(`${item.id}.`)
      && name.includes(".assembly")
      && !name.includes("assembly-revalidate")
      && name.endsWith(".status.json")
    ))
    .sort((left, right) => {
      const leftCurrent = left.startsWith(`${item.id}.${checkpointSessionId}.`) ? 1 : 0;
      const rightCurrent = right.startsWith(`${item.id}.${checkpointSessionId}.`) ? 1 : 0;
      return leftCurrent === rightCurrent ? left.localeCompare(right) : leftCurrent - rightCurrent;
    })
    .reverse();
  for (const statusName of candidates) {
    try {
      const status = JSON.parse(await fs.readFile(path.join(checkpointDir, statusName), "utf8"));
      const issues = Array.isArray(status?.details?.issues) ? status.details.issues : [];
      if (status.status !== "failed" || !["assembly", "assembly-patch"].includes(status.stage) || !issues.length) continue;
      const partialName = status.stage === "assembly-patch"
        ? `${statusName.split(".assembly-patch")[0]}.assembly.partial.json`
        : statusName.replace(/\.status\.json$/u, ".partial.json");
      const candidate = JSON.parse(await fs.readFile(path.join(checkpointDir, partialName), "utf8"));
      console.log(`REVALIDATE-ASSEMBLY ${item.id}/40 ${item.title} checkpoint=${statusName} issues=${issues.length}`);
      return { issues: issues.slice(0, 30), candidate };
    } catch {
      // Ignore incomplete or malformed streamed checkpoints.
    }
  }
  return { issues: [], candidate: null };
}

function checkpointPaths(item, draftAttempt, stage) {
  const stem = `${item.id}.${sessionId}.draft-${draftAttempt}.${stage}`;
  return {
    partial: path.join(checkpointDir, `${stem}.partial.json`),
    status: path.join(checkpointDir, `${stem}.status.json`)
  };
}

function createCheckpointWriter(item, draftAttempt) {
  const stages = new Map();
  const stageContext = (stage) => {
    if (!stages.has(stage)) {
      stages.set(stage, {
        paths: checkpointPaths(item, draftAttempt, stage),
        writer: null,
        closed: false,
        activeAttemptPartial: "",
        responseMetadata: {}
      });
    }
    return stages.get(stage);
  };
  const closeWriter = async (context) => {
    if (!context?.writer || context.closed) return;
    context.closed = true;
    await new Promise((resolve, reject) => {
      context.writer.once("error", reject);
      context.writer.end(resolve);
    });
  };
  const writeStatus = async (context, stage, status, extra = {}, targetPath = context.paths.status) => {
    await fs.writeFile(targetPath, `${JSON.stringify({
      itemId: item.id,
      title: item.title,
      draftAttempt,
      stage,
      status,
      updatedAt: new Date().toISOString(),
      ...extra
    }, null, 2)}\n`, "utf8");
  };
  return async (event) => {
    const stage = event.stage || "assembly";
    const context = stageContext(stage);
    if (event.type === "stage-start") {
      await closeWriter(context);
      context.activeAttemptPartial = context.paths.partial.replace(
        /\.partial\.json$/u,
        `.attempt-${event.stageAttempt}.partial.json`
      );
      context.writer = createWriteStream(context.activeAttemptPartial, { flags: "w", encoding: "utf8" });
      context.closed = false;
      context.responseMetadata = {};
      await writeStatus(context, stage, "streaming", {
        generatorMode: event.mode,
        stageAttempt: event.stageAttempt,
        temperature: event.temperature,
        maxTokens: event.maxTokens
      });
      return;
    }
    if (event.type === "stage-reused") {
      await closeWriter(context);
      await fs.writeFile(context.paths.partial, `${JSON.stringify(event.value, null, 2)}\n`, "utf8");
      context.responseMetadata = {
        stageAttempt: 0,
        finishReason: "reused-accepted-checkpoint",
        usage: null
      };
      await writeStatus(context, stage, "accepted", context.responseMetadata);
      return;
    }
    if (event.type === "stage-composed") {
      await closeWriter(context);
      await fs.writeFile(context.paths.partial, `${JSON.stringify(event.value, null, 2)}\n`, "utf8");
      context.responseMetadata = {
        stageAttempt: event.stageAttempt,
        finishReason: "parallel-components-composed",
        usage: null
      };
      await writeStatus(context, stage, "accepted", context.responseMetadata);
      return;
    }
    if (event.type === "stage-checkpoint") {
      await closeWriter(context);
      await fs.writeFile(context.paths.partial, `${JSON.stringify(event.value, null, 2)}\n`, "utf8");
      context.responseMetadata = {
        stageAttempt: event.stageAttempt,
        finishReason: "targeted-patch-checkpoint",
        usage: null
      };
      await writeStatus(context, stage, "failed", {
        ...context.responseMetadata,
        willRetry: true,
        code: "DEEPSEEK_OUTPUT_INVALID",
        message: `定点修复后仍有 ${Array.isArray(event.issues) ? event.issues.length : 1} 项装配问题`,
        details: {
          repairMode: "continue-targeted-assembly-patch",
          issues: Array.isArray(event.issues) ? event.issues : []
        }
      });
      return;
    }
    if (event.type === "stage-delta") {
      if (context.writer && !context.writer.write(event.delta)) await once(context.writer, "drain");
      return;
    }
    if (event.type === "stage-response") {
      await closeWriter(context);
      context.responseMetadata = {
        stageAttempt: event.stageAttempt,
        finishReason: event.finishReason,
        usage: event.usage || null
      };
      await writeStatus(context, stage, "response-complete", {
        ...context.responseMetadata
      });
      return;
    }
    if (event.type === "stage-accepted") {
      await closeWriter(context);
      if (context.activeAttemptPartial) {
        await fs.copyFile(context.activeAttemptPartial, context.paths.partial);
      }
      await writeStatus(context, stage, "accepted", context.responseMetadata);
      return;
    }
    if (event.type === "stage-error") {
      await closeWriter(context);
      const failureDetails = {
        stageAttempt: event.stageAttempt,
        willRetry: event.willRetry === true,
        code: event.code,
        message: event.message,
        details: event.details || null
      };
      await writeStatus(context, stage, "failed", failureDetails);
      const attemptStatus = context.paths.status.replace(
        /\.status\.json$/u,
        `.attempt-${event.stageAttempt}.status.json`
      );
      await writeStatus(context, stage, "failed", failureDetails, attemptStatus);
      const issuePreview = Array.isArray(event.details?.issues)
        ? event.details.issues.slice(0, 3).join(" | ")
        : event.message;
      console.log(`REJECT ${item.id}/40 ${stage} attempt=${event.stageAttempt}: ${issuePreview}`);
    }
  };
}

async function waitBeforeDraftRestart(attempt) {
  const delay = Math.min(8000, 750 * (2 ** Math.max(0, attempt - 1))) + Math.floor(Math.random() * 300);
  await new Promise((resolve) => setTimeout(resolve, delay));
}

async function generateItem(item) {
  const existing = await readExisting(item);
  if (existing) {
    console.log(`RESUME ${item.id}/40 ${item.title}`);
    return existing;
  }
  const recovered = await recoverCompletedCheckpoint(item);
  if (recovered) return recovered;

  const spec = buildSpec(item);
  let lastError = null;
  for (let attempt = 1; attempt <= maxDraftAttempts; attempt += 1) {
    try {
      const brief = buildBrief(item, spec, attempt);
      const reusableBlueprintCheckpoint = attempt === 1
        ? await recoverAcceptedBlueprintCheckpoint(item, spec, brief)
        : null;
      const reusableAssemblyComponents = attempt === 1
        ? await recoverAcceptedAssemblyComponents(item, reusableBlueprintCheckpoint?.checkpointSessionId)
        : undefined;
      const rejectedAssembly = attempt === 1 && reusableBlueprintCheckpoint?.checkpointSessionId
        ? await recoverLatestRejectedAssembly(item, reusableBlueprintCheckpoint.checkpointSessionId)
        : { issues: [], candidate: null };
      const rejectedBlueprint = attempt === 1 && !reusableBlueprintCheckpoint?.blueprint
        ? (reusableBlueprintCheckpoint?.candidate
            ? { issues: reusableBlueprintCheckpoint.issues || [], candidate: reusableBlueprintCheckpoint.candidate }
            : await recoverLatestRejectedBlueprint(item))
        : { issues: [], candidate: null };
      const result = await createDeepseekStoryOutline({
        ...brief,
        spec,
        blueprint: reusableBlueprintCheckpoint?.blueprint || undefined,
        blueprintIssues: rejectedBlueprint.issues,
        blueprintCandidate: rejectedBlueprint.candidate,
        assemblyComponents: reusableAssemblyComponents,
        assemblyCandidate: rejectedAssembly.candidate,
        assemblyIssues: rejectedAssembly.issues,
        stream: true,
        timeoutMs: requestTimeoutMs,
        blueprintAttempts: blueprintStageAttempts,
        assemblyAttempts: assemblyStageAttempts,
        userId: `outline-${item.id}`,
        onGenerationEvent: createCheckpointWriter(item, attempt)
      });
      const generatorSummary = summarizeGeneratorOutput(item, result.spec, result.outline);
      const record = {
        id: item.id,
        title: item.title,
        genre: item.genre,
        style: item.style,
        anchors: item.anchors,
        provider: result.provider,
        model: result.model,
        attempt,
        generationStatus: "complete",
        generationMetrics: result.generationMetrics || null,
        spec: result.spec,
        generatorSummary,
        outline: result.outline
      };
      await fs.writeFile(path.join(itemDir, `${item.id}.json`), `${JSON.stringify(record, null, 2)}\n`, "utf8");
      console.log(`DONE ${item.id}/40 ${item.title} draftAttempt=${attempt} anchors=${generatorSummary.anchorHits.length}`);
      return record;
    } catch (error) {
      lastError = error;
      console.log(`RESTART ${item.id}/40 ${item.title} draftAttempt=${attempt} error=${error.code || error.name || "ERROR"}`);
      if (attempt < maxDraftAttempts) await waitBeforeDraftRestart(attempt);
    }
  }
  const finalError = new Error(`${item.id} ${item.title}: ${lastError?.message || "generation failed"}`);
  finalError.code = lastError?.code || "OUTLINE_DRAFT_REJECTED";
  finalError.details = lastError?.details || null;
  throw finalError;
}

function inlineList(values, fallback = "无") {
  return Array.isArray(values) && values.length ? values.join("、") : fallback;
}

function formatRequirement(requirement) {
  const targetType = requirement.targetType || "state";
  const targetKey = requirement.targetKey || requirement.stateKey || "未登记目标";
  return `${targetType}:${targetKey} ${requirement.operator} ${JSON.stringify(requirement.value)}`;
}

function formatStateWrites(writes) {
  if (!Array.isArray(writes) || !writes.length) return "无";
  return writes.map((write) => `${write.stateKey} ${write.operation} ${JSON.stringify(write.value)}`).join("；");
}

function formatResourceDeltas(deltas) {
  if (!Array.isArray(deltas) || !deltas.length) return "无";
  return deltas
    .map((delta) => {
      const quantity = delta.amount ?? delta.value ?? "未注明";
      return `${delta.resourceKey} ${delta.operation} ${JSON.stringify(quantity)}`;
    })
    .join("；");
}

function formatOptionEffects(effects) {
  if (!Array.isArray(effects) || !effects.length) return "无";
  return effects.map((effect) => {
    const payload = effect.targetType === "resource"
      ? effect.amount
      : effect.targetType === "state"
        ? effect.value
        : effect.operation;
    const renderedPayload = payload === undefined || payload === null || payload === ""
      ? ""
      : ` ${JSON.stringify(payload)}`;
    return `${effect.targetType}:${effect.targetKey} ${effect.operation}${renderedPayload}（${effect.consequence || "未说明后果"}）`;
  }).join("；");
}

function markdownFor(results, generatedAt, batchReport = null) {
  const isFullBatch = results.length === catalog.length;
  const heading = isFullBatch
    ? "# 织幕四十题材剧情大纲汇总（V2.4 语义宪章版）"
    : `# 织幕 V2.4 试跑汇总（当前 ${results.length}/${catalog.length} 篇）`;
  const statusText = batchReport
    ? isFullBatch
      ? (batchReport.pass ? "四十篇跨篇机械门禁通过" : `四十篇批次拒收（${batchReport.issues.length}项）`)
      : (batchReport.pass
        ? `本轮 ${results.length} 篇单篇与当前集合门禁通过；尚未执行四十篇完整跨篇验收`
        : `本轮试跑拒收（${batchReport.issues.length}项）`)
    : "生成中，尚未执行本轮集合门禁";
  const lines = [
    heading,
    "",
    `> 生成时间：${generatedAt}`,
    "> 生成路径：语义宪章 → 原子状态与来源合同 → 分支感知章节装配 → V2.4结构与语义回归；失败草稿整篇拒收，后端不补写任何创意内容",
    `> 验收状态：${statusText}`,
    `> 模型：${results[0]?.model || "DeepSeek"}`,
    `> 数量：${results.length}`,
    "",
    "## 快速目录",
    "",
    "| 编号 | 标题 | 题材 | 规模 | 一句话梗概 |",
    "|---|---|---|---|---|"
  ];

  for (const item of results) {
    lines.push(`| ${item.id} | ${item.title} | ${item.genre} | ${item.spec.playerCount}人 / ${item.spec.chapterCount}章 | ${String(item.outline.logline || "").replace(/\|/g, "｜")} |`);
  }

  for (const item of results) {
    lines.push(
      "",
      "---",
      "",
      `## ${item.id}. 《${item.title}》`,
      "",
      `- **题材**：${item.genre}`,
      `- **文风**：${item.style}`,
      `- **规模**：${item.spec.playerCount} 人 / ${item.spec.chapterCount} 章 / 目标约 ${item.spec.targetWordCount} 字`,
      `- **生成方式**：V2.4 语义宪章前置；原子状态与分支感知装配；第 ${item.attempt} 份完整草稿通过；题材锚点 ${inlineList(item.generatorSummary?.anchorHits)}`,
      `- **交付状态**：outlineRevision=${item.outline.outlineRevision}；结构、来源、责任、状态语义与回归不变量通过；审美与惊奇强度仍需作者终审`,
      "",
      "### 一句话梗概",
      "",
      item.outline.logline,
      "",
      "### 幕后真相与事件顺序",
      "",
      item.outline.truthTimeline,
      ""
    );

    if (item.outline.semanticConstitution) {
      lines.push("### 语义宪章", "", "#### 锁定事实", "");
      for (const fact of item.outline.semanticConstitution.facts || []) {
        const factObject = fact.objectKey || JSON.stringify(fact.objectValue);
        lines.push(`- **${fact.key}**：${fact.subjectKey} ${fact.predicate} ${factObject}；真假 ${fact.truthValue}；范围 ${fact.scopeKey || "全局"}；证据 ${inlineList(fact.evidenceKeys)}`);
      }
      if (item.outline.semanticConstitution.authorizationGrants?.length) {
        lines.push("", "#### 授权边界", "");
        for (const grant of item.outline.semanticConstitution.authorizationGrants) {
          lines.push(`- **${grant.key}**：${grant.grantorKey} → ${grant.granteeKey}；资产 ${grant.assetKey}；允许 ${inlineList(grant.allowedPurposeKeys)}；禁止 ${inlineList(grant.forbiddenPurposeKeys)}；证据 ${inlineList(grant.evidenceKeys)}`);
        }
      }
      if (item.outline.semanticConstitution.branchEvents?.length) {
        lines.push("", "#### 条件事件", "");
        for (const event of item.outline.semanticConstitution.branchEvents) {
          lines.push(`- **${event.key} / ${event.chapterKey}**：${event.description}`);
        }
      }
      lines.push("", "#### 世界规则", "");
      for (const rule of item.outline.semanticConstitution.worldRules || []) {
        lines.push(`- **${rule.key} / ${rule.evaluationChapterKey}**：${rule.statement}；前置 ${inlineList((rule.preconditions || []).map(formatRequirement))}；效果 ${formatOptionEffects(rule.effects)}；失败 ${rule.failureMode}`);
      }
      lines.push("");
    }

    lines.push("### 题材适配误导", "");
    for (const misdirection of item.outline.misdirections || []) {
      lines.push(`- **${misdirection.apparentInterpretation}**（${misdirection.kind}）：真实原因是${misdirection.trueCause}；持续后果：${misdirection.lastingConsequence}`);
    }

    if (item.outline.entities?.length) {
      lines.push("", "### 实体注册表", "");
      for (const entity of item.outline.entities) {
        lines.push(`- **${entity.name}**（${entity.type} / \`${entity.key}\`）：${entity.meaning || "已登记实体"}${entity.aliases?.length ? `；别名：${entity.aliases.join("、")}` : ""}`);
      }
    }

    if (item.outline.resources?.length) {
      lines.push("", "### 资源注册表", "");
      for (const resource of item.outline.resources) {
        lines.push(`- **${resource.name || resource.meaning || resource.key}**（\`${resource.key}\`）：${resource.meaning}；初始 ${resource.initialValue}，范围 ${resource.minimum}–${resource.maximum}，归属 ${resource.ownerType}${resource.ownerKey ? `:${resource.ownerKey}` : ""}，${resource.recoverable ? "可恢复" : "不可恢复"}`);
      }
    }

    if (item.outline.responsibilityRoles?.length) {
      lines.push("", "### 玩家责任链", "");
      for (const responsibility of item.outline.responsibilityRoles) {
        const player = item.outline.players?.find((entry) => entry.key === responsibility.roleKey);
        lines.push(`- **${player?.name || responsibility.roleKey} / ${responsibility.responsibilityType}**：${responsibility.action} → ${responsibility.causalEffect}；事件 ${inlineList(responsibility.eventKeys)}`);
      }
    }
    if (item.outline.causalTimeline?.length) {
      lines.push("", "### 因果时间线（真实发生顺序）", "");
      for (const event of item.outline.causalTimeline) {
        const responsibilityPairs = (event.actorResponsibilities || []).map((entry) => `${entry.actorKey}:${entry.responsibilityType}`);
        lines.push(`- **${event.order}. ${event.key}**：${event.event}；行动者 ${inlineList(event.actorKeys)}；责任配对 ${inlineList(responsibilityPairs)}；操作 ${event.actionType || "未登记"} ${event.targetKey || ""}.${event.parameterKey || ""} ${JSON.stringify(event.beforeValue)} → ${JSON.stringify(event.afterValue)}；用途 ${event.purposeKey || "无"}；授权 ${event.authorizationStatus || "无"}${event.authorizationGrantKey ? ` / ${event.authorizationGrantKey}` : ""}；前置 ${inlineList(event.preconditionKeys)}；事实 ${inlineList(event.factKeys)}`);
      }
    }

    lines.push("", "### 六名玩家角色", "");
    for (const player of item.outline.players || []) {
      const actionSummary = (player.chapterActions || [])
        .map((action) => `${action.chapterKey}：${action.action} → ${action.consequence}`)
        .join("；");
      lines.push(
        `#### ${player.name}（${player.identity}）`,
        "",
        `- **公开目标**：${player.publicGoal}`,
        `- **隐藏目标**：${player.hiddenGoal}`,
        `- **核心秘密**：${player.coreSecret}；事实 ${inlineList(player.secretFactKeys)}；授权 ${inlineList(player.authorizationGrantKeys)}`,
        `- **主动计划**：${player.activePlan}`,
        `- **人物弧光**：${player.arc}`,
        `- **独占锚点**：\`${player.exclusiveAnchorKey}\``,
        `- **贡献类型**：${player.contribution?.anchorType || "未标记"}；锚点 ${inlineList(player.contribution?.anchorKeys)}；主线转折 ${inlineList(player.contribution?.turnChapterKeys)}`,
        `- **聚光章**：${player.spotlightChapterKey}`,
        `- **章节行动链**：${actionSummary || "无"}`,
        ""
      );
    }

    lines.push("### 高概念兑现", "");
    for (const promise of item.outline.hookPromises || []) lines.push(`- **${promise.promise}**：${promise.payoff}`);

    if (item.outline.genreMechanic) {
      lines.push(
        "",
        "### 题材玩法机制",
        "",
        `- **${item.outline.genreMechanic.name}**：${item.outline.genreMechanic.playerFacingRule}`,
        `- **玩家操作**：${item.outline.genreMechanic.playerOperation}`,
        `- **触发条件**：${item.outline.genreMechanic.trigger}`,
        `- **判定步骤**：${item.outline.genreMechanic.resolutionProcedure}`,
        `- **成功结果**：${item.outline.genreMechanic.successEffect}`,
        `- **失败结果**：${item.outline.genreMechanic.failureEffect}`,
        `- **能力边界**：${item.outline.genreMechanic.limits}`,
        ""
      );
    }

    if (item.outline.styleContract) {
      lines.push(
        "### 文风落地合同",
        "",
        `- **风格装置**：${inlineList(item.outline.styleContract.signatureDevices)}`,
        `- **禁止漂移**：${item.outline.styleContract.forbiddenDrift}`
      );
      for (const expression of item.outline.styleContract.chapterExpressions || []) {
        lines.push(`- **${expression.chapterKey} / ${expression.device}**：${expression.sceneOrDialogue}`);
      }
      lines.push("");
    }

    if (item.outline.evidenceGraph?.conclusions?.length) {
      lines.push("### 核心结论与独立来源", "");
      for (const conclusion of item.outline.evidenceGraph.conclusions) {
        const labels = (conclusion.evidenceKeys || []).map((key) => item.outline.evidenceGraph?.evidence?.find((entry) => entry.key === key)?.label || key);
        lines.push(`- **${conclusion.statement}**：${labels.join(" + ")}`);
      }
      lines.push("", "#### 证据来源根与方法", "");
      for (const evidence of item.outline.evidenceGraph.evidence || []) {
        lines.push(`- **${evidence.label}**（\`${evidence.key}\`）：来源实体 ${evidence.provenanceGroup}；原始根 ${inlineList(evidence.originRootKeys)}；共同故障域 ${inlineList(evidence.commonCauseKeys)}；独立域 ${evidence.independenceDomain || "未登记"}；方法 ${evidence.methodDomain || "未登记"} / ${evidence.methodOperation || evidence.collectionMethod}；产物 ${evidence.artifactProduced || "未登记"}`);
      }
    } else {
      lines.push("### 核心支持结构", "", "- 本题材不强制建立推理证据图；核心推进由关系、承诺、权限、资源、任务或风险状态承担。");
    }

    lines.push("", "### 分章结构", "");
    for (const beat of item.outline.chapterBeats || []) {
      lines.push(
        `#### ${beat.title}`,
        "",
        `- **本章目标**：${beat.goal}`,
        `- **阶段转折**：${beat.turn}`,
        `- **玩家行动**：${beat.playerAction}`,
        `- **行动对象**：${beat.actionObject}（\`${beat.actionTargetKey}\`）`,
        `- **不可逆后果**：${beat.irreversibleConsequence}`,
        `- **进入条件**：${beat.entryConditionMode || "none"}；读取 ${inlineList((beat.stateReads || []).map((read) => `${read.stateKey} ${read.operator} ${JSON.stringify(read.value)}`))}`,
        `- **公共必然效果**：状态 ${formatStateWrites(beat.stateWrites)}；资源 ${formatResourceDeltas(beat.resourceDeltas)}；解锁 ${inlineList(beat.unlocksEvidenceKeys)}；关闭 ${inlineList(beat.locksEvidenceKeys)}`,
        `- **通过分支效果**：${beat.onReadPass?.variantKey || "默认推进"}${beat.onReadPass?.effectSummary ? `——${beat.onReadPass.effectSummary}` : ""}`,
        `- **失败分支效果**：${beat.onReadFail?.variantKey || "无"}${beat.onReadFail?.fallbackAction ? `——${beat.onReadFail.fallbackAction}` : ""}；状态 ${formatStateWrites(beat.onReadFail?.stateWrites)}；资源代价 ${formatResourceDeltas(beat.onReadFail?.additionalCosts)}；解锁 ${inlineList(beat.onReadFail?.unlocksEvidenceKeys)}；关闭 ${inlineList(beat.onReadFail?.locksEvidenceKeys)}`,
        `- **本章决策**：${beat.decision?.key || "未登记"}；${beat.decision?.question || "无"}`,
        `- **题材机制**：${beat.genreMechanicUse}`,
        `- **主持提示**：${beat.hostNotes}`,
        ""
      );
      for (const option of beat.decision?.options || []) {
        const choiceText = option.choiceText || option.choice || "未填写玩家行为";
        const legacyMapping = option.sets?.stateKey
          ? `${option.sets.stateKey} = ${JSON.stringify(option.sets.value)}`
          : "无";
        lines.push(`  - **${option.key} 玩家可见行为**：${choiceText}；立即后果：${option.immediateConsequence}；创作者隐藏效果：${option.effects?.length ? formatOptionEffects(option.effects) : legacyMapping}`);
      }
      lines.push(`- **章节出口状态**：${beat.nextState}`, "");
    }

    lines.push("### 原子状态与控制方式", "");
    for (const state of item.outline.endingLogic?.stateVariables || []) {
      lines.push(`- **${state.key}**：主体 ${state.subjectKey || "未登记"}；维度 ${state.dimension || "未登记"}；控制 ${state.controlMode || "旧协议"}；初始 ${JSON.stringify(state.initialValue)}；首次判定 ${state.setInChapterKey}${state.derivedByRuleKey ? `；派生规则 ${state.derivedByRuleKey}` : ""}`);
    }

    lines.push("", "### 累计结局", "");
    for (const route of item.outline.endingLogic?.routes || []) {
      const requirements = route.requirements?.length
        ? route.requirements.map(formatRequirement).join("；")
        : "默认路线";
      lines.push(`- **${route.title}**（优先级 ${route.priority}；${route.requirementMode || "all"}；${requirements}；事实前置 ${inlineList(route.preconditionFactKeys)}；规则前置 ${inlineList(route.preconditionRuleKeys)}）：${route.consequence}`);
    }

    lines.push("### 后续创作建议", "");
    for (const suggestion of item.outline.suggestions || []) lines.push(`- ${suggestion}`);
  }

  lines.push(
    "",
    "---",
    "",
    "## 下一步建议",
    "",
    "本轮只生成总纲。筛选出优先题材后，再进入公共结构、角色矩阵、信息矩阵、主持手册和角色私人分幕层，避免对未选题材提前消耗完整剧本生成额度。",
    ""
  );
  return lines.join("\n");
}

if (process.env.OUTLINE_PREFLIGHT_ONLY === "1") {
  const allContracts = catalog.map((item) => generationContractFor(item));
  const suffixSignatures = new Map();
  for (const item of catalog) {
    const names = allocatedPlayerNames(item);
    const signature = names.map((name) => [...name.replace(/[^\p{Script=Han}A-Za-z0-9]/gu, "")].at(-1)).sort().join("|");
    const rows = suffixSignatures.get(signature) || [];
    rows.push(item.id);
    suffixSignatures.set(signature, rows);
    const threeHanNames = names.filter((name) => /^\p{Script=Han}{3}$/u.test(name));
    if (threeHanNames.length === names.length && new Set(threeHanNames.map((name) => [...name][1])).size === 1) {
      throw new Error(`题材 ${item.id} 仍使用同中间字姓名矩阵`);
    }
  }
  const repeatedSuffixSignatures = [...suffixSignatures.entries()].filter(([, ids]) => ids.length > 1);
  if (repeatedSuffixSignatures.length) throw new Error(`仍有跨篇六尾字循环：${JSON.stringify(repeatedSuffixSignatures)}`);
  const resourceContracts = allContracts.flatMap((contract) => contract.resourceContracts || []);
  if (resourceContracts.some((resource) => /decision[-_]?capacity|决策容量/iu.test(`${resource.key} ${resource.name} ${resource.meaning}`))) {
    throw new Error("题材资源仍包含通用决策容量");
  }
  if (allContracts.some((contract) => contract.outlineRevision !== "2.4")) {
    throw new Error("V2.4 合同版本错误");
  }
  if (allContracts.some((contract) => (contract.resourceUsagePlans || []).length)) {
    throw new Error("V2.4 合同不得继续使用 resourceUsagePlans 公共必扣计划");
  }
  for (const contract of allContracts) {
    const resourceKeys = new Set(contract.resourceKeys || []);
    const policyKeys = new Set((contract.resourcePolicies || []).map((policy) => policy.resourceKey));
    if (resourceKeys.size !== policyKeys.size || [...resourceKeys].some((key) => !policyKeys.has(key))) {
      throw new Error(`题材 ${contract.batchItemId} 的资源与可选效果策略没有逐项对应`);
    }
    if ((contract.resourcePolicies || []).some((policy) => (
      policy.maximumMandatoryUses !== 0
      || policy.minimumOptionalUses < 1
      || policy.placement !== "chapterBeats.decision.options.effects"
      || !Array.isArray(policy.optionalUseChapterKeys)
      || new Set(policy.optionalUseChapterKeys).size < policy.minimumOptionalUses
    ))) {
      throw new Error(`题材 ${contract.batchItemId} 的资源策略仍允许公共必扣或缺少选项效果路径`);
    }
  }
  const matchContract = allContracts.find((contract) => contract.batchItemId === "32");
  if (matchContract?.stateKeys.length !== 5) throw new Error("《决赛第五局》必须保留真实性、完整性、授权、条款与赛果五个原子状态");
  if (matchContract?.stateKeysAreExhaustive !== true
    || JSON.stringify(matchContract?.stateControlModes) !== JSON.stringify(["observed", "observed", "adjudicated", "adjudicated", "player-decision"])
    || JSON.stringify(matchContract?.fixedStateValues) !== JSON.stringify(["authentic", "intact", "", "", ""])) {
    throw new Error("《决赛第五局》的五状态控制权或客观真值合同未锁定");
  }
  const matchServerEvidence = (matchContract?.evidenceSourceContracts || [])
    .filter((entry) => entry.originRootKeys?.includes("system-official-isolated-server"));
  if (matchServerEvidence.length < 2 || !matchServerEvidence.some((entry) => entry.commonCauseKeys?.includes("system-official-isolated-server"))) {
    throw new Error("《决赛第五局》未把官方日志与服务器镜像登记为同根共同故障域");
  }
  if (!(matchContract?.evidenceSourceContracts || []).some((entry) => entry.originRootKeys?.includes("system-opponent-telemetry"))) {
    throw new Error("《决赛第五局》缺少对手方遥测这一独立来源根");
  }
  if (allContracts.some((contract) => (contract.evidenceProvenanceGroups || []).some(
    (key) => /^(?:source|origin|来源)[-_\d]/iu.test(key) || /原始来源|independent-origin/iu.test(key)
  ))) {
    throw new Error("V2.4 合同仍包含来源壳 key");
  }
  console.log(JSON.stringify({
    pass: true,
    revision: "2.4",
    stories: catalog.length,
    uniquePlayerNames: new Set(allocatedNameRows.map((row) => row.name.toLocaleLowerCase("zh-CN"))).size,
    worldSpecificResources: resourceContracts.length,
    semanticInvariantStories: allContracts.filter((contract) => contract.semanticInvariants.length).map((contract) => contract.batchItemId),
    outputDir
  }, null, 2));
  process.exit(0);
}

await fs.mkdir(itemDir, { recursive: true });
await fs.mkdir(checkpointDir, { recursive: true });
if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is not configured");

const results = new Array(activeCatalog.length);
let cursor = 0;
const failures = [];
let progressExportQueue = Promise.resolve();

function exportProgressMarkdown() {
  progressExportQueue = progressExportQueue.then(async () => {
    const completed = results.filter(Boolean);
    if (!completed.length) return;
    await fs.writeFile(
      markdownOutputFile,
      markdownFor(completed, new Date().toISOString()),
      "utf8"
    );
  });
  return progressExportQueue;
}

async function worker() {
  while (true) {
    const index = cursor;
    cursor += 1;
    if (index >= activeCatalog.length) return;
    try {
      results[index] = await generateItem(activeCatalog[index]);
      await exportProgressMarkdown();
    } catch (error) {
      failures.push({
        id: activeCatalog[index].id,
        title: activeCatalog[index].title,
        code: error?.code || error?.name || "ERROR",
        message: error?.message || String(error),
        details: error?.details || null
      });
      console.log(`FAILED ${activeCatalog[index].id}/${activeCatalog.length} ${activeCatalog[index].title}`);
      await exportProgressMarkdown();
    }
  }
}

await Promise.all(Array.from({ length: concurrency }, () => worker()));
await progressExportQueue;

const completedResults = results.filter(Boolean);
if (failures.length) {
  await fs.writeFile(
    path.join(outputDir, "失败项目.json"),
    `${JSON.stringify(failures, null, 2)}\n`,
    "utf8"
  );
} else {
  await fs.rm(path.join(outputDir, "失败项目.json"), { force: true });
}
if (!completedResults.length) throw new Error("Batch did not complete any outline; inspect checkpoint files");

let history = [];
try {
  const parsedHistory = JSON.parse(await fs.readFile(historyFile, "utf8"));
  history = Array.isArray(parsedHistory?.items) ? parsedHistory.items : [];
} catch {
  history = [];
}
const activeTitles = new Set(activeCatalog.map((item) => item.title));
const historicalItems = history.filter(
  (item) => item.batchId !== batchId && !activeTitles.has(item.title)
);
const diversityReport = validateOutlineBatchDiversity(completedResults, {
  throwOnFailure: false,
  historicalItems,
  similarityPolicy: {
    enforcement: process.env.OUTLINE_SIMILARITY_ENFORCEMENT || "reject",
    fieldThreshold: Number(process.env.OUTLINE_FIELD_SIMILARITY_THRESHOLD),
    compositeThreshold: Number(process.env.OUTLINE_COMPOSITE_SIMILARITY_THRESHOLD)
  }
});
const runAccepted = failures.length === 0
  && completedResults.length === activeCatalog.length
  && diversityReport.pass;
const fullBatchRequested = activeCatalog.length === catalog.length;
const batchAccepted = runAccepted && fullBatchRequested;
await fs.writeFile(
  path.join(outputDir, "batch-diversity-report.json"),
  `${JSON.stringify(diversityReport, null, 2)}\n`,
  "utf8"
);
if (!runAccepted) {
  await fs.writeFile(
    path.join(outputDir, "批次拒收原因.json"),
    `${JSON.stringify({
      generatedAt: new Date().toISOString(),
      requestedCount: activeCatalog.length,
      completedCount: completedResults.length,
      failedItems: failures,
      diversityIssues: diversityReport.issues,
      diversityWarnings: diversityReport.warnings
    }, null, 2)}\n`,
    "utf8"
  );
} else {
  await fs.rm(path.join(outputDir, "批次拒收原因.json"), { force: true });
}

const generatedAt = new Date().toISOString();
const completionTokenRows = completedResults
  .map((item) => item.generationMetrics?.totalCompletionTokens)
  .filter((value) => Number.isFinite(value) && value > 0)
  .sort((left, right) => left - right);
const completionBudgets = completedResults
  .map((item) => (item.generationMetrics?.attempts || []).reduce(
    (sum, stage) => sum + (Number(stage.completionBudget) || 0),
    0
  ))
  .filter((value) => Number.isFinite(value) && value > 0);
const p95Index = completionTokenRows.length ? Math.min(completionTokenRows.length - 1, Math.ceil(completionTokenRows.length * 0.95) - 1) : -1;
const measuredSections = ["truthTimeline", "entities", "resources", "players", "evidenceGraph", "misdirections", "chapterBeats", "endingLogic", "batchFingerprint"];
const averageFieldCharacters = Object.fromEntries(measuredSections.map((field) => {
  const values = completedResults.map((item) => JSON.stringify(item.outline?.[field] ?? "").length);
  return [field, values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0];
}));
const earlyFieldAverage = (
  averageFieldCharacters.players
  + averageFieldCharacters.entities
  + averageFieldCharacters.resources
  + averageFieldCharacters.evidenceGraph
) / 4;
const lateFieldAverage = (averageFieldCharacters.endingLogic + averageFieldCharacters.batchFingerprint) / 2;
const generationTokenReport = {
  sampleCount: completionTokenRows.length,
  averageCompletionTokens: completionTokenRows.length
    ? Math.round(completionTokenRows.reduce((sum, value) => sum + value, 0) / completionTokenRows.length)
    : null,
  p95CompletionTokens: p95Index >= 0 ? completionTokenRows[p95Index] : null,
  nearLimitCount: completedResults.filter((item) => item.generationMetrics?.nearCompletionLimit).length,
  jsonTruncationCount: failures.filter((item) => item.code === "DEEPSEEK_RESPONSE_TRUNCATED").length,
  completionBudgetMin: completionBudgets.length ? Math.min(...completionBudgets) : null,
  completionBudgetMax: completionBudgets.length ? Math.max(...completionBudgets) : null,
  averageFieldCharacters,
  lateToEarlyCharacterRatio: earlyFieldAverage ? Number((lateFieldAverage / earlyFieldAverage).toFixed(3)) : null
};
generationTokenReport.recommendTwoStageGeneration = Boolean(
  generationTokenReport.jsonTruncationCount
  || generationTokenReport.nearLimitCount > Math.max(1, Math.floor(completedResults.length * 0.1))
  || (generationTokenReport.completionBudgetMin
    && generationTokenReport.p95CompletionTokens >= Math.floor(generationTokenReport.completionBudgetMin * 0.9))
  || (generationTokenReport.lateToEarlyCharacterRatio !== null && generationTokenReport.lateToEarlyCharacterRatio < 0.35)
);
const aggregate = {
  generatedAt,
  requestedCount: activeCatalog.length,
  successCount: completedResults.length,
  failedCount: failures.length,
  provider: completedResults[0]?.provider || null,
  model: completedResults[0]?.model || null,
  generationPolicy: "preallocated batch contract; blueprint then chapter assembly; strict mechanical acceptance; no patch/rebuild",
  strictMechanicalValidationRun: true,
  creativeEditorialAuditRun: false,
  batchAccepted,
  runAccepted,
  fullBatchRequested,
  diversityReportIsAdvisory: false,
  uniqueTitleCount: new Set(completedResults.map((item) => item.title)).size,
  generationTokenReport,
  diversityReport,
  outlines: completedResults
};

if (runAccepted) {
  const nextHistoryItems = [
    ...historicalItems,
    ...completedResults.map((item) => ({
      batchId,
      generatedAt,
      title: item.title,
      outline: {
        players: (item.outline.players || []).map((player) => ({ name: player.name })),
        endingLogic: {
          routes: (item.outline.endingLogic?.routes || []).map((route) => ({ title: route.title }))
        },
        batchFingerprint: item.outline.batchFingerprint
      }
    }))
  ].slice(-400);
  await fs.writeFile(
    historyFile,
    `${JSON.stringify({ updatedAt: generatedAt, items: nextHistoryItems }, null, 2)}\n`,
    "utf8"
  );
}

await fs.writeFile(
  path.join(outputDir, "四十题材大纲汇总.json"),
  `${JSON.stringify(aggregate, null, 2)}\n`,
  "utf8"
);
await fs.writeFile(
  markdownOutputFile,
  markdownFor(completedResults, generatedAt, {
    ...diversityReport,
    pass: runAccepted,
    issues: [
      ...diversityReport.issues,
      ...failures.map((failure) => `${failure.id} ${failure.title} 未通过单篇机械门禁`)
    ]
  }),
  "utf8"
);

console.log(`COMPLETE runAccepted=${runAccepted} fullBatchAccepted=${batchAccepted} success=${completedResults.length} failed=${failures.length} model=${aggregate.model} batchIssues=${diversityReport.issues.length}`);
if (!runAccepted) process.exitCode = 2;
