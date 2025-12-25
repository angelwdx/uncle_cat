
import React, { useState, useEffect, useRef } from 'react';
import {
    BookOpen, Users, Globe, GitMerge, List, Activity, PenTool,
    Settings, RefreshCw, Sparkles, Copy, FileText, Play, Gavel,
    Clock, Archive, LayoutDashboard, LayoutList, ArrowRight
} from 'lucide-react';
import {
    ApiConfig, Chapter, GeneratedData, UserInputs, StepDefinition, StateArchive
} from './types';
import { PROMPTS, TAGS, STORY_TONES, ENDING_TYPES, NARRATIVE_PERSPECTIVES, THEME_MATCH_PROMPT, PLOT_STRUCTURES, THEME_LIBRARY_CONTENT } from './constants';
import { generateContent, formatPrompt } from './services/apiService';
import StepCard from './components/StepCard';
import MarkdownViewer from './components/MarkdownViewer';
import WritingStep from './components/WritingStep';
import {
    CustomRequestModal, JudgeResultModal, ConfigModal, PromptManagerModal, PlotStructureModal, PlotCritiqueModal
} from './components/Modals';
import { useAlert } from './components/CustomAlert';

// 定义环境变量类型，用于控制是否显示提示词管理功能
declare const __HIDE_PROMPT_MANAGEMENT__: boolean;

const STEPS: StepDefinition[] = [
    { id: 'init', title: '创作初始化', icon: BookOpen },
    { id: 'dna', title: '核心DNA', icon: Activity, promptKey: 'DNA' },
    { id: 'characters', title: '角色动力学', icon: Users, promptKey: 'CHARACTERS' },
    { id: 'world', title: '世界观', icon: Globe, promptKey: 'WORLD' },
    { id: 'plot', title: '情节架构', icon: GitMerge, promptKey: 'PLOT' },
    { id: 'blueprint', title: '章节蓝图', icon: List, promptKey: 'BLUEPRINT' },
    { id: 'state', title: '角色状态库', icon: Activity, promptKey: 'STATE_INIT' },
    { id: 'writing', title: '正文创作', icon: PenTool, promptKey: 'CHAPTER_1' }
];

export default function App() {
    const { showAlert, showConfirm } = useAlert();
    const [currentStep, setCurrentStep] = useState(0);
    const [inputs, setInputs] = useState<UserInputs>({
        topic: '',
        genre: '',
        tone: '',
        ending: '',
        perspective: '',
        numberOfChapters: 12,
        wordCount: 2000,
        customRequirements: '',
        novelTitle: ''
    });

    const [apiConfig, setApiConfig] = useState<ApiConfig>({
        provider: 'google',
        baseUrl: 'https://gemini.txtbg.cn',
        apiKey: '',
        textModel: 'gemini-3-flash'
    });

    const [generatedData, setGeneratedData] = useState<GeneratedData>({
        dna: null,
        globalSummary: null,
        characters: null,
        world: null,
        plot: null,
        blueprint: null,
        state: null,
        chapters: [],
        stateHistory: []
    });

    const [customPrompts, setCustomPrompts] = useState<Record<string, string>>({});

    const [isGenerating, setIsGenerating] = useState(false);
    const [isJudging, setIsJudging] = useState(false);
    const [isSyncingContext, setIsSyncingContext] = useState(false);
    const [loadingMessage, setLoadingMessage] = useState<string>("");
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [showPromptManager, setShowPromptManager] = useState(false);



    // 存储各步骤的自定义修改要求
    const [stepCustomInstructions, setStepCustomInstructions] = useState<Record<string, string>>({});

    const [showCustomRequestModal, setShowCustomRequestModal] = useState(false);
    const [customModalTitle, setCustomModalTitle] = useState("");

    // 控制移动端侧边栏显示/隐藏
    const [isSidebarOpen, setIsSidebarOpen] = useState(false);

    // 使用ref保存回调函数，确保同步更新
    const customPromptCallbackRef = useRef<(val: string) => void>(() => { });
    // 保存当前模态框对应的步骤标题
    const currentModalTitleRef = useRef<string>("");

    const [judgeResult, setJudgeResult] = useState("");
    const [showJudgeModal, setShowJudgeModal] = useState(false);

    const [isPlotCritiquing, setIsPlotCritiquing] = useState(false);
    const [plotCritiqueResult, setPlotCritiqueResult] = useState("");
    const [showPlotCritiqueModal, setShowPlotCritiqueModal] = useState(false);

    const [viewArchiveChapter, setViewArchiveChapter] = useState<number>(0);
    const [isInitCompleted, setIsInitCompleted] = useState<boolean>(false);
    // 用于跟踪正文创作步骤的状态，包括当前查看的章节、选中的题材等
    const [writingStepState, setWritingStepState] = useState<any>({
        viewChapter: 1,
        selectedTheme: null
    });

    // 文件输入元素引用，用于导入功能
    const fileInputRef = useRef<HTMLInputElement>(null);

    // 导入项目功能
    const handleImport = () => {
        // 创建或获取文件输入元素
        if (!fileInputRef.current) {
            const input = document.createElement('input');
            input.type = 'file';
            input.accept = '.json';
            input.onchange = handleFileSelect;
            input.style.display = 'none';
            document.body.appendChild(input);
            fileInputRef.current = input;
        }
        // 触发文件选择
        fileInputRef.current.click();
    };

    // 处理文件选择事件
    const handleFileSelect = (event: Event) => {
        const input = event.target as HTMLInputElement;
        if (!input.files || input.files.length === 0) return;

        const file = input.files[0];
        const reader = new FileReader();

        reader.onload = (e) => {
            try {
                // 解析JSON数据
                const content = e.target?.result as string;
                const projectData = JSON.parse(content);

                // 验证数据结构
                if (!projectData.inputs || !projectData.generatedData) {
                    throw new Error('无效的项目文件格式！');
                }

                // 更新所有相关状态
                setInputs(projectData.inputs);
                setGeneratedData(projectData.generatedData);
                setStepCustomInstructions(projectData.stepCustomInstructions || {});
                // 如果有小说名称，设置isInitCompleted为true
                if (projectData.inputs.novelTitle) {
                    setIsInitCompleted(true);
                }

                // 提示导入成功
                showAlert('项目导入成功！', 'success');

                // 重置文件输入
                if (fileInputRef.current) {
                    fileInputRef.current.value = '';
                }
            } catch (error) {
                console.error('导入项目失败:', error);
                showAlert('项目导入失败，请检查文件格式！', 'error');
            }
        };

        reader.onerror = () => {
            showAlert('文件读取失败，请重试！', 'error');
        };

        reader.readAsText(file);
    };

    // 重置项目功能
    const handleReset = async () => {
        // 确认是否重置项目
        const confirmed = await showConfirm('确定要清空/重置当前项目吗？此操作不可恢复！', 'warning');
        if (!confirmed) return;

        try {
            // 重置所有相关状态
            setInputs({
                topic: '',
                genre: '',
                tone: '',
                ending: '',
                perspective: '',
                numberOfChapters: 12,
                wordCount: 2000,
                customRequirements: '',
                novelTitle: ''
            });
            setGeneratedData({
                dna: null,
                globalSummary: null,
                characters: null,
                world: null,
                plot: null,
                blueprint: null,
                state: null,
                chapters: [],
                stateHistory: []
            });
            setStepCustomInstructions({});
            setIsInitCompleted(false);
            setWritingStepState({
                viewChapter: 1,
                selectedTheme: null
            });
            setCurrentStep(0);

            // Clear local storage
            localStorage.removeItem('storymind_inputs');
            localStorage.removeItem('storymind_data');
            localStorage.removeItem('storymind_step');
            localStorage.removeItem('storymind_instructions');
            localStorage.removeItem('storymind_prompts');
            localStorage.removeItem('storymind_init_completed');
            localStorage.removeItem('storymind_writing_state');
            // Do NOT clear config

            // 提示重置成功
            showAlert('项目已成功重置！', 'success');
        } catch (error) {
            console.error('重置项目失败:', error);
            showAlert('项目重置失败，请重试！', 'error');
        }
    };

    // 剧情结构选择相关状态
    const [showPlotStructureModal, setShowPlotStructureModal] = useState(false);
    const [selectedPlotStructure, setSelectedPlotStructure] = useState<string>(PLOT_STRUCTURES[0]?.name || "三幕式结构（Three-Act Structure）");

    // Flag to track if data has been loaded from local storage
    const [isLoaded, setIsLoaded] = useState(false);

    // Load data from localStorage on mount
    useEffect(() => {
        try {
            const savedInputs = localStorage.getItem('storymind_inputs');
            const savedData = localStorage.getItem('storymind_data');
            const savedStep = localStorage.getItem('storymind_step');
            const savedInstructions = localStorage.getItem('storymind_instructions');
            const savedPrompts = localStorage.getItem('storymind_prompts');
            const savedInit = localStorage.getItem('storymind_init_completed');
            const savedWritingState = localStorage.getItem('storymind_writing_state');

            if (savedInputs) setInputs(JSON.parse(savedInputs));
            if (savedData) setGeneratedData(JSON.parse(savedData));
            if (savedStep) setCurrentStep(parseInt(savedStep));
            if (savedInstructions) setStepCustomInstructions(JSON.parse(savedInstructions));
            if (savedPrompts) setCustomPrompts(JSON.parse(savedPrompts));
            if (savedInit) setIsInitCompleted(JSON.parse(savedInit));
            if (savedWritingState) setWritingStepState(JSON.parse(savedWritingState));

            // Load config
            const savedConfig = localStorage.getItem('deepstory_config');
            if (savedConfig) {
                const parsedConfig = JSON.parse(savedConfig);
                setApiConfig(prev => ({ ...prev, ...parsedConfig }));
            }
        } catch (e) {
            console.error("Failed to load local storage data:", e);
        } finally {
            setIsLoaded(true);
        }
    }, []);

    // Auto-save effects - Only save if loaded
    useEffect(() => {
        if (isLoaded) localStorage.setItem('storymind_inputs', JSON.stringify(inputs));
    }, [inputs, isLoaded]);

    useEffect(() => {
        if (isLoaded) localStorage.setItem('storymind_data', JSON.stringify(generatedData));
    }, [generatedData, isLoaded]);

    useEffect(() => {
        if (isLoaded) localStorage.setItem('storymind_step', currentStep.toString());
    }, [currentStep, isLoaded]);

    useEffect(() => {
        if (isLoaded) localStorage.setItem('storymind_instructions', JSON.stringify(stepCustomInstructions));
    }, [stepCustomInstructions, isLoaded]);

    useEffect(() => {
        if (isLoaded) localStorage.setItem('storymind_prompts', JSON.stringify(customPrompts));
    }, [customPrompts, isLoaded]);

    useEffect(() => {
        if (isLoaded) localStorage.setItem('storymind_init_completed', JSON.stringify(isInitCompleted));
    }, [isInitCompleted, isLoaded]);

    useEffect(() => {
        if (isLoaded) localStorage.setItem('storymind_writing_state', JSON.stringify(writingStepState));
    }, [writingStepState, isLoaded]);

    const handleConfigSave = (config: ApiConfig) => {
        setApiConfig(config);
        try {
            localStorage.setItem('deepstory_config', JSON.stringify(config));
        } catch (e) {
            console.error("localStorage save error", e);
        }
    };

    // 查找最合适的状态存档
    const findLatestStateArchive = (targetChapterNum: number) => {
        // 对于第1章，直接使用初始状态
        if (targetChapterNum === 1) {
            return {
                characterState: generatedData.state || "暂无角色状态",
                globalSummary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
                chapterSummary: "暂无章节摘要"
            };
        }

        // 对于后续章节，查找最大的章节号 ≤ targetChapterNum - 1 的存档
        const sortedArchives = [...(generatedData.stateHistory || [])].sort((a, b) => b.chapterNum - a.chapterNum);

        // 查找第一个章节号小于 targetChapterNum 的存档
        const latestArchive = sortedArchives.find(archive => archive.chapterNum < targetChapterNum);

        // 如果找到存档，使用存档中的状态；否则使用当前全局状态
        if (latestArchive) {
            return {
                characterState: latestArchive.characterState,
                globalSummary: latestArchive.globalSummary,
                chapterSummary: latestArchive.chapterSummary
            };
        }

        // 没有找到存档，使用当前全局状态
        return {
            characterState: generatedData.state || "暂无角色状态",
            globalSummary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
            chapterSummary: "暂无章节摘要"
        };
    };

    // 导出项目功能
    const handleExport = () => {
        try {
            // 创建包含所有项目数据的对象
            const projectData = {
                version: "1.0.0", // 导出版本号
                inputs,
                generatedData,
                stepCustomInstructions,
                exportDate: new Date().toISOString()
            };

            // 转换为JSON字符串，格式化输出
            const jsonString = JSON.stringify(projectData, null, 2);

            // 创建Blob对象
            const blob = new Blob([jsonString], { type: "application/json" });

            // 生成下载链接
            const url = URL.createObjectURL(blob);

            // 创建下载链接元素
            const a = document.createElement("a");
            a.href = url;
            // 使用小说名称或默认名称作为文件名
            a.download = `${inputs.novelTitle || "deepstory-project"}.json`;

            // 触发下载
            document.body.appendChild(a);
            a.click();

            // 清理
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            // 提示导出成功
            showAlert("项目导出成功！", "success");
        } catch (error) {
            console.error("导出项目失败:", error);
            showAlert("项目导出失败，请重试！", "error");
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
    };

    const cleanCodeBlock = (text: string) => {
        if (!text || typeof text !== 'string') return "";

        let clean = text
            // 移除开头的代码块标记（支持带语言和不带语言的格式）
            .replace(/^```[a-z]*\s*/i, '')
            // 移除结尾的代码块标记
            .replace(/\s*```$/, '')
            // 移除任何格式的代码块标记（包括中间的）
            .replace(/```[a-z]*\s*/gi, '')
            // 移除多余的空白行
            .replace(/\n\s*\n/g, '\n\n')
            // 移除首尾空白
            .trim();

        return clean;
    };

    // 解析AI生成的基础设定和核心DNA
    const parseGeneratedResult = (result: string) => {
        const cleanedResult = cleanCodeBlock(result);

        // 提取基础设定部分 - 精确匹配，只到下一个标题前或结束
        const basicSettingsRegex = /(?:^|\n)(?:##\s*)?基础设定\s*\(BASIC_SETTINGS\)[\s\S]*?(?=(?:\n|^)(?:##\s*)?(?!基础设定|核心DNA))/i;
        const basicSettingsMatch = cleanedResult.match(basicSettingsRegex);
        const basicSettingsText = basicSettingsMatch ? basicSettingsMatch[0] : "";

        // 提取核心DNA部分 - 精确匹配，只到下一个标题前或结束
        const coreDNARegex = /(?:^|\n)(?:##\s*)?核心DNA\s*\(STORY_DNA\)[\s\S]*?(?=(?:\n|^)(?:##\s*)?(?!基础设定|核心DNA))/i;
        const coreDNAMatch = cleanedResult.match(coreDNARegex);
        const coreDNAText = coreDNAMatch ? coreDNAMatch[0] : "";

        // 解析基础设定键值对
        const settings: Partial<UserInputs> = {};

        // 小说名称
        const novelTitleMatch = basicSettingsText.match(/小说名称\s*[:：]\s*([^\n]+)/);
        if (novelTitleMatch) {
            settings.novelTitle = novelTitleMatch[1].trim();
        }

        // 故事基调
        const toneMatch = basicSettingsText.match(/故事基调\s*[:：]\s*([^\n]+)/);
        if (toneMatch) {
            settings.tone = toneMatch[1].trim();
        }

        // 结局倾向
        const endingMatch = basicSettingsText.match(/结局倾向\s*[:：]\s*([^\n]+)/);
        if (endingMatch) {
            settings.ending = endingMatch[1].trim();
        }

        // 叙事视角
        const perspectiveMatch = basicSettingsText.match(/叙事视角\s*[:：]\s*([^\n]+)/);
        if (perspectiveMatch) {
            settings.perspective = perspectiveMatch[1].trim();
        }

        // 预计章节数
        const chaptersMatch = basicSettingsText.match(/预计章节数\s*[:：]\s*(\d+)/);
        if (chaptersMatch) {
            settings.numberOfChapters = parseInt(chaptersMatch[1], 10);
        }

        // 每章字数
        const wordCountMatch = basicSettingsText.match(/每章字数\s*[:：]\s*(\d+)/);
        if (wordCountMatch) {
            settings.wordCount = parseInt(wordCountMatch[1], 10);
        }

        // 自定义特殊要求
        const customMatch = basicSettingsText.match(/自定义特殊要求\s*[:：]\s*([^\n]+)/);
        if (customMatch) {
            settings.customRequirements = customMatch[1].trim();
        }

        return { basicSettings: settings, coreDNA: coreDNAText };
    };

    const handleJudge = async () => {
        if (!inputs.topic || !inputs.genre) {
            showAlert("请先填写主题和题材", "warning");
            return;
        }
        setLoadingMessage("判官正在审阅您的选题...");
        setIsJudging(true);
        try {
            // 构建包含完整基础设定的用户提示词
            let userPrompt = `题材：${inputs.genre}\n核心脑洞：${inputs.topic}\n`;
            userPrompt += `小说名称：${inputs.novelTitle || "未命名"}\n`;
            userPrompt += `故事基调：${inputs.tone || "未指定"}\n`;
            userPrompt += `结局倾向：${inputs.ending || "未指定"}\n`;
            userPrompt += `叙事视角：${inputs.perspective || "未指定"}\n`;
            userPrompt += `预计章节数：${inputs.numberOfChapters || 10}章\n`;
            userPrompt += `每章字数：${inputs.wordCount || 2000}字\n`;
            userPrompt += `自定义特殊要求：${inputs.customRequirements || "无"}\n`;

            if (generatedData.dna) {
                userPrompt += `\n当前核心DNA：\n${generatedData.dna}`;
            }

            // 注入独家题材公式库
            userPrompt += `\n\n【重要资源：独家题材公式库 (THEME_LIBRARY)】\n请务必参考以下公式库进行S级方案设计：\n${THEME_LIBRARY_CONTENT}\n`;

            const template = customPrompts['JUDGE'] || PROMPTS.JUDGE;
            const result = await generateContent(template, userPrompt, apiConfig);
            setJudgeResult(result);
            setShowJudgeModal(true);
        } catch (e: any) {
            showAlert("判官请假了：" + e.message, "error");
        } finally {
            setIsJudging(false);
        }
    };

    const handlePlotCritique = async () => {
        if (!generatedData.dna) {
            showAlert("请先生成核心DNA后再进行问诊", "warning");
            return;
        }
        setLoadingMessage("正在进行剧情深度诊疗...");
        setIsPlotCritiquing(true);
        try {
            // 构建问诊需要的上下文
            let userPrompt = `【当前情节架构】\n${generatedData.plot || "尚未生成"}\n\n`;
            userPrompt += `【核心DNA参考】\n${generatedData.dna || "尚未生成"}\n\n`;
            userPrompt += `题材：${inputs.genre}\n核心脑洞：${inputs.topic}\n`;
            userPrompt += `故事基调：${inputs.tone || "未指定"}\n`;
            userPrompt += `当前选用的剧情结构：${selectedPlotStructure}\n`;

            const template = customPrompts['PLOT_CRITIQUE'] || PROMPTS.PLOT_CRITIQUE;
            const result = await generateContent(template, userPrompt, apiConfig);
            setPlotCritiqueResult(result);
            setShowPlotCritiqueModal(true);
        } catch (e: any) {
            showAlert("诊疗失败：" + e.message, "error");
        } finally {
            setIsPlotCritiquing(false);
        }
    };

    const handleSelectJudgeProposal = async (proposalIndex: number) => {
        if (!judgeResult) return;

        setLoadingMessage(`正在根据方案${proposalIndex}重写核心DNA...`);
        setIsGenerating(true);
        try {
            // 从完整评审结果中提取用户选择的具体方案
            const extractSelectedProposal = (result: string, index: number) => {
                // 方案匹配正则，提取指定索引的方案
                const targetIndex = index; // 已经是1-based索引，无需转换

                // 提取完整的方案内容（包括方案内的所有方向）
                const proposalRegex = new RegExp(`【方案${targetIndex}：.*?】[\s\S]*?(?=【方案${targetIndex + 1}：|$)`, 'i');
                const proposalMatch = result.match(proposalRegex);

                // 如果找到匹配的方案，返回该方案的完整内容
                // 注意：每个方案内部的方向编号都是从1开始的，不是从方案索引开始的
                return proposalMatch ? proposalMatch[0] : result;
            };

            // 提取用户选择的具体方案
            const selectedProposal = extractSelectedProposal(judgeResult, proposalIndex);

            // 使用PROMPTS.DNA模板生成DNA
            const template = customPrompts['DNA'] || PROMPTS.DNA;

            // 构建完整变量，包含所有基础设定
            const variables = {
                novel_title: String(inputs.novelTitle || "未命名"),
                topic: String(inputs.topic || ""),
                genre: String(inputs.genre || ""),
                tone: String(inputs.tone || "未指定"),
                ending: String(inputs.ending || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                number_of_chapters: String(inputs.numberOfChapters || 10),
                word_count: String(inputs.wordCount || 2000),
                custom_requirements: String(inputs.customRequirements || "无"),
                custom_instruction: `严格根据判官评审方案${proposalIndex}重写核心DNA，只生成该方案的内容，不要生成其他方案或方向：${selectedProposal}`,
                user_guidance: String(inputs.customRequirements || "无")
            };

            // 使用formatPrompt函数处理所有变量替换
            const prompt = formatPrompt(template, variables);

            // 生成新的DNA
            const newContent = await generateContent(prompt, "开始生成任务", apiConfig);

            // 清理生成结果，只保留基础设定和核心DNA部分
            const cleanGeneratedResult = (result: string) => {
                // 1. 先清理代码块格式和多余内容
                let cleaned = result
                    // 移除代码块格式
                    .replace(/^```[a-z]*\s*/i, '')
                    .replace(/\s*```$/g, '')
                    // 移除开头的多余标题（如"修仙拾荒日常 - 完整故事架构"）
                    .replace(/^.*?(?=基础设定)/si, '')
                    // 移除DNA解析说明及后面的所有内容
                    .replace(/DNA解析说明[\s\S]*$/i, '')
                    // 移除所有非基础设定和非核心DNA的标题
                    .replace(/(?:^|\n)##\s*(?!基础设定|核心DNA)[^\n]*/gi, '')
                    .trim();

                // 2. 提取基础设定部分 - 改进正则，只匹配真正的基础设定内容
                // 基础设定应该是标题+列表项的形式，所以匹配到基础设定标题开始，直到遇到第一个非列表项且不是空行的内容
                const basicSettingsRegex = /(?:^|\n)(##\s*)?基础设定\s*\(BASIC_SETTINGS\)(?:\n|$)([\s\S]*?)(?=(?:^|\n)(?!(?:\s*\*|\s*-|\s*\n|$))|$)/i;
                const basicSettingsMatch = cleaned.match(basicSettingsRegex);
                let basicSettings = basicSettingsMatch ? `${basicSettingsMatch[1] || '## '}基础设定 (BASIC_SETTINGS)\n${basicSettingsMatch[2]}`.trim() : '';

                // 3. 提取核心DNA部分
                let coreDNA = '';

                // 先尝试匹配包含核心DNA标题的内容
                const coreDNARegex = /(?:^|\n)(##\s*)?核心DNA\s*\(STORY_DNA\)[\s\S]*/i;
                const coreDNAMatch = cleaned.match(coreDNARegex);

                if (coreDNAMatch) {
                    // 如果匹配到，直接使用
                    coreDNA = coreDNAMatch[0].trim();
                } else {
                    // 如果没有匹配到核心DNA标题，尝试从基础设定之后提取核心DNA内容
                    if (basicSettings) {
                        // 提取基础设定结束后的内容作为核心DNA
                        const basicSettingsEnd = cleaned.indexOf(basicSettings) + basicSettings.length;
                        const remainingContent = cleaned.slice(basicSettingsEnd).trim();

                        if (remainingContent) {
                            // 如果有剩余内容，将其作为核心DNA，并添加标题
                            coreDNA = `## 核心DNA (STORY_DNA)\n${remainingContent}`;
                        }
                    } else {
                        // 如果没有基础设定，检查是否整个内容都是核心DNA
                        if (cleaned && !cleaned.includes('基础设定')) {
                            coreDNA = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                        }
                    }
                }

                // 4. 特殊处理：如果基础设定包含了核心DNA内容（因为正则匹配问题），手动分离
                if (basicSettings && !coreDNA) {
                    // 检查基础设定中是否包含核心DNA的内容结构
                    const lines = basicSettings.split('\n');
                    let basicSettingsLines: string[] = [];
                    let coreDNALines: string[] = [];
                    let isInCoreDNA = false;

                    for (const line of lines) {
                        if (basicSettingsLines.length > 0 && !line.trim().startsWith('*') && !line.trim().startsWith('-') && line.trim()) {
                            // 遇到非列表项且非空行，开始核心DNA部分
                            isInCoreDNA = true;
                            coreDNALines.push(line);
                        } else if (isInCoreDNA) {
                            coreDNALines.push(line);
                        } else {
                            basicSettingsLines.push(line);
                        }
                    }

                    // 更新基础设定和核心DNA
                    basicSettings = basicSettingsLines.join('\n').trim();
                    const coreDNAContent = coreDNALines.join('\n').trim();

                    if (coreDNAContent) {
                        coreDNA = `## 核心DNA (STORY_DNA)\n${coreDNAContent}`;
                    }
                }

                // 5. 组合两部分内容
                let finalContent = '';
                if (basicSettings && coreDNA) {
                    finalContent = `${basicSettings}\n\n${coreDNA}`;
                } else if (basicSettings) {
                    finalContent = basicSettings;
                } else if (coreDNA) {
                    finalContent = coreDNA;
                } else {
                    // 如果都没有，确保至少返回一个有标题的内容
                    finalContent = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                }

                // 6. 确保正确的Markdown格式
                finalContent = finalContent
                    // 确保基础设定有##前缀
                    .replace(/(?:^|\n)(?!##)(基础设定\s*\(BASIC_SETTINGS\))/i, '\n## $1')
                    // 确保核心DNA有##前缀
                    .replace(/(?:^|\n)(?!##)(核心DNA\s*\(STORY_DNA\))/i, '\n## $1')
                    // 清理多余空行
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();

                return finalContent;
            };

            // 清理生成结果，去掉前面的说明文字并修复格式
            const cleanedContent = cleanGeneratedResult(newContent);

            // 将清理后的生成结果（只包含核心DNA）保存到generatedData.dna
            setGeneratedData(prev => ({ ...prev, dna: cleanedContent }));

            showAlert(`已采纳方案${proposalIndex}并重写核心DNA`, "success");
        } catch (error: any) {
            console.error('重写失败:', error);
            showAlert('重写失败：' + error.message, "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateStep = async (stepId: keyof GeneratedData, customReq: string = "") => {
        // 添加更全面的API配置检查
        if (!apiConfig.apiKey || !apiConfig.baseUrl || !apiConfig.textModel) {
            setShowConfigModal(true);
            return;
        }

        // 对于custom模型，确保customTextModel已设置
        if (apiConfig.textModel === 'custom' && !apiConfig.customTextModel) {
            setShowConfigModal(true);
            return;
        }

        const stepDef = STEPS.find(s => s.id === stepId);
        if (!stepDef || !stepDef.promptKey) return;

        setLoadingMessage(`AI 正在构建${stepDef.title}...`);
        setIsGenerating(true);
        try {
            const template = customPrompts[stepDef.promptKey] || PROMPTS[stepDef.promptKey as keyof typeof PROMPTS];

            const variables = {
                novel_title: String(inputs.novelTitle || "未命名"),
                topic: String(inputs.topic || ""),
                genre: String(inputs.genre || ""),
                tone: String(inputs.tone || "未指定"),
                ending: String(inputs.ending || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                number_of_chapters: String(inputs.numberOfChapters || 10),
                word_count: String(inputs.wordCount || 2000),
                custom_requirements: String(inputs.customRequirements || "无"),
                custom_instruction: String(customReq || "无"),
                STORY_DNA: String(generatedData.dna || "暂无核心DNA"),
                character_dynamics: String(generatedData.characters || "暂无角色设定"),
                world_building: String(generatedData.world || "暂无世界观设定"),
                plot_architecture: String(generatedData.plot || "暂无情节架构"),
                plot_structure: selectedPlotStructure
            };

            console.log('[Generate Content] Processing variables:', variables);

            // 使用formatPrompt函数处理所有变量替换，确保plot_structure被正确替换
            const prompt = formatPrompt(template, {
                ...variables,
                user_guidance: String(inputs.customRequirements || "无")
            });

            console.log('[Generate Content] Final prompt:', prompt);
            const result = await generateContent(prompt, "开始生成任务", apiConfig);

            // 清理生成结果，只保留基础设定和核心DNA部分（仅用于核心DNA步骤）
            const cleanGeneratedResult = (result: string) => {
                // 1. 先清理代码块格式和多余内容
                let cleaned = result
                    // 移除代码块格式
                    .replace(/^```[a-z]*\s*/i, '')
                    .replace(/\s*```$/g, '')
                    // 移除开头的多余标题（如"修仙拾荒日常 - 完整故事架构"）
                    .replace(/^.*?(?=基础设定)/si, '')
                    // 移除DNA解析说明及后面的所有内容
                    .replace(/DNA解析说明[\s\S]*$/i, '')
                    // 移除所有非基础设定和非核心DNA的标题
                    .replace(/(?:^|\n)##\s*(?!基础设定|核心DNA)[^\n]*/gi, '')
                    .trim();

                // 2. 提取基础设定部分 - 改进正则，只匹配真正的基础设定内容
                // 基础设定应该是标题+列表项的形式，所以匹配到基础设定标题开始，直到遇到第一个非列表项且不是空行的内容
                const basicSettingsRegex = /(?:^|\n)(##\s*)?基础设定\s*\(BASIC_SETTINGS\)(?:\n|$)([\s\S]*?)(?=(?:^|\n)(?!(?:\s*\*|\s*-|\s*\n|$))|$)/i;
                const basicSettingsMatch = cleaned.match(basicSettingsRegex);
                let basicSettings = basicSettingsMatch ? `${basicSettingsMatch[1] || '## '}基础设定 (BASIC_SETTINGS)\n${basicSettingsMatch[2]}`.trim() : '';

                // 3. 提取核心DNA部分
                let coreDNA = '';

                // 先尝试匹配包含核心DNA标题的内容
                const coreDNARegex = /(?:^|\n)(##\s*)?核心DNA\s*\(STORY_DNA\)[\s\S]*/i;
                const coreDNAMatch = cleaned.match(coreDNARegex);

                if (coreDNAMatch) {
                    // 如果匹配到，直接使用
                    coreDNA = coreDNAMatch[0].trim();
                } else {
                    // 如果没有匹配到核心DNA标题，尝试从基础设定之后提取核心DNA内容
                    if (basicSettings) {
                        // 提取基础设定结束后的内容作为核心DNA
                        const basicSettingsEnd = cleaned.indexOf(basicSettings) + basicSettings.length;
                        const remainingContent = cleaned.slice(basicSettingsEnd).trim();

                        if (remainingContent) {
                            // 如果有剩余内容，将其作为核心DNA，并添加标题
                            coreDNA = `## 核心DNA (STORY_DNA)\n${remainingContent}`;
                        }
                    } else {
                        // 如果没有基础设定，检查是否整个内容都是核心DNA
                        if (cleaned && !cleaned.includes('基础设定')) {
                            coreDNA = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                        }
                    }
                }

                // 4. 特殊处理：如果基础设定包含了核心DNA内容（因为正则匹配问题），手动分离
                if (basicSettings && !coreDNA) {
                    // 检查基础设定中是否包含核心DNA的内容结构
                    const lines = basicSettings.split('\n');
                    let basicSettingsLines: string[] = [];
                    let coreDNALines: string[] = [];
                    let isInCoreDNA = false;

                    for (const line of lines) {
                        if (basicSettingsLines.length > 0 && !line.trim().startsWith('*') && !line.trim().startsWith('-') && line.trim()) {
                            // 遇到非列表项且非空行，开始核心DNA部分
                            isInCoreDNA = true;
                            coreDNALines.push(line);
                        } else if (isInCoreDNA) {
                            coreDNALines.push(line);
                        } else {
                            basicSettingsLines.push(line);
                        }
                    }

                    // 更新基础设定和核心DNA
                    basicSettings = basicSettingsLines.join('\n').trim();
                    const coreDNAContent = coreDNALines.join('\n').trim();

                    if (coreDNAContent) {
                        coreDNA = `## 核心DNA (STORY_DNA)\n${coreDNAContent}`;
                    }
                }

                // 5. 组合两部分内容
                let finalContent = '';
                if (basicSettings && coreDNA) {
                    finalContent = `${basicSettings}\n\n${coreDNA}`;
                } else if (basicSettings) {
                    finalContent = basicSettings;
                } else if (coreDNA) {
                    finalContent = coreDNA;
                } else {
                    // 如果都没有，确保至少返回一个有标题的内容
                    finalContent = `## 核心DNA (STORY_DNA)\n${cleaned}`;
                }

                // 6. 确保正确的Markdown格式
                finalContent = finalContent
                    // 确保基础设定有##前缀
                    .replace(/(?:^|\n)(?!##)(基础设定\s*\(BASIC_SETTINGS\))/i, '\n## $1')
                    // 确保核心DNA有##前缀
                    .replace(/(?:^|\n)(?!##)(核心DNA\s*\(STORY_DNA\))/i, '\n## $1')
                    // 清理多余空行
                    .replace(/\n\s*\n/g, '\n\n')
                    .trim();

                return finalContent;
            };

            const processedResult = stepId === 'dna' ? cleanGeneratedResult(result) : result;

            setGeneratedData(prev => {
                const newData = {
                    ...prev,
                    [stepId]: processedResult
                };

                if (stepId === 'state') {
                    const initialArchive: StateArchive = {
                        chapterNum: 0,
                        title: "初始设定",
                        globalSummary: prev.dna || "暂无",
                        characterState: processedResult,
                        chapterSummary: "无 (初始状态)",
                        timestamp: Date.now()
                    };
                    newData.stateHistory = [initialArchive];
                    setViewArchiveChapter(0);
                }

                return newData;
            });
        } catch (error: any) {
            console.error("Generation failed:", error);

            // 增强错误信息，特别是针对角色动力学步骤
            let errorMessage = error.message;
            let additionalTips = "";

            if (stepId === 'characters') {
                if (errorMessage.includes('超时')) {
                    additionalTips = "\n建议：1. 尝试使用更快的模型（如Gemini 2.5 Flash）；2. 检查网络连接；3. 减少自定义要求的复杂度；4. 尝试减少生成的角色数量。";
                }
                errorMessage = `角色动力学生成失败: ${error.message}${additionalTips}`;
            } else {
                errorMessage = `生成失败: ${error.message}`;
            }

            showAlert(errorMessage, "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleGenerateChapter = async (chapterNum: number, params: any, theme: any) => {
        // 添加更全面的API配置检查
        if (!apiConfig.apiKey || !apiConfig.baseUrl || !apiConfig.textModel) {
            setShowConfigModal(true);
            return;
        }

        // 对于custom模型，确保customTextModel已设置
        if (apiConfig.textModel === 'custom' && !apiConfig.customTextModel) {
            setShowConfigModal(true);
            return;
        }
        setLoadingMessage(`AI 正在撰写 ${params.title || `第${chapterNum}章`}...`);
        setIsGenerating(true);

        try {
            const isFirstChapter = chapterNum === 1;
            const promptKey = isFirstChapter ? 'CHAPTER_1' : 'CHAPTER_NEXT';
            const template = customPrompts[promptKey] || PROMPTS[promptKey];

            let previousContent = "";
            if (!isFirstChapter) {
                const prevChap = generatedData.chapters[chapterNum - 2];
                previousContent = prevChap ? prevChap.content.slice(-800) : "无前文";
            }

            // 从章节蓝图中获取下章信息
            let nextChapterPurpose = "承接剧情";

            // 解析章节蓝图获取下章信息
            if (generatedData.blueprint) {
                const blueprintLines = generatedData.blueprint.split('\n');
                const nextChapterRegex = new RegExp(`### 第${chapterNum + 1}章 -`);

                let inNextChapter = false;
                for (const line of blueprintLines) {
                    if (nextChapterRegex.test(line)) {
                        inNextChapter = true;
                    } else if (inNextChapter) {
                        // 提取下一章的核心作用
                        if (line.includes('**核心作用：**')) {
                            nextChapterPurpose = line.replace('**核心作用：**', '').trim();
                            break; // 找到下一章作用后退出循环
                        }
                    }
                }
            }

            // 查找最合适的状态存档
            const latestArchive = findLatestStateArchive(chapterNum);

            const variables = {
                novel_number: chapterNum,
                chapter_title: params.title || `第${chapterNum}章`,
                chapter_role: params.role || "推进剧情",
                chapter_purpose: params.purpose || "承上启下",
                suspense_level: params.suspense || "正常",
                foreshadowing: params.foreshadowing || "无",
                plot_twist_level: params.twist || "低",
                short_summary: params.summary || "暂无摘要",
                selected_theme_info: theme ? `已选题材公式：${theme.name} - ${theme.desc}` : '未指定特定题材公式，请自行发挥',
                character_state: latestArchive.characterState,
                world_building: generatedData.world || "暂无世界观设定",
                plot_architecture: generatedData.plot || "暂无情节架构",
                custom_requirements: inputs.customRequirements || "无",
                novel_title: String(inputs.novelTitle || "未命名"),
                tone: String(inputs.tone || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                word_count: String(inputs.wordCount || 2000),
                CHAPTER_BLUEPRINT: generatedData.blueprint || "暂无章节蓝图",
                global_summary: latestArchive.globalSummary,
                previous_chapter_excerpt: previousContent,
                chapter_summary: latestArchive.chapterSummary || "暂无摘要",
                next_chapter_number: chapterNum + 1,
                next_chapter_title: `第${chapterNum + 1}章`,
                next_chapter_purpose: nextChapterPurpose
            };

            const prompt = formatPrompt(template, variables);
            const wordCount = inputs.wordCount || 2000;
            const rawResult = await generateContent(prompt, `请创作第${chapterNum}章`, apiConfig, wordCount);

            // 只清理标题，不裁剪内容，确保AI生成的内容完整
            const cleanContent = rawResult.replace(/^##\s*第\d+章.*$/m, '').trim();

            const newChapter: Chapter = {
                title: params.title,
                content: cleanContent,
                ...params
            };

            setGeneratedData(prev => {
                const newChapters = [...prev.chapters];
                newChapters[chapterNum - 1] = newChapter;
                return { ...prev, chapters: newChapters };
            });

        } catch (e: any) {
            showAlert("章节生成失败: " + e.message, "error");
        } finally {
            setIsGenerating(false);
        }
    };

    const handleRewriteChapter = (chapterNum: number, content: string) => {
        setGeneratedData(prev => {
            const newChapters = [...prev.chapters];
            if (newChapters[chapterNum - 1]) {
                newChapters[chapterNum - 1] = {
                    ...newChapters[chapterNum - 1],
                    content: content
                };
            }
            return { ...prev, chapters: newChapters };
        });
    };

    const handleUpdateChapterTitle = (chapterNum: number, title: string) => {
        setGeneratedData(prev => {
            const newChapters = [...prev.chapters];
            if (newChapters[chapterNum - 1]) {
                newChapters[chapterNum - 1].title = title;
            }
            return { ...prev, chapters: newChapters };
        });
    };

    const handleSyncContext = async (chapterNum: number) => {
        const currentChapter = generatedData.chapters[chapterNum - 1];
        if (!currentChapter || !currentChapter.content) {
            showAlert("当前章节无内容，无法同步。", "warning");
            return;
        }

        setLoadingMessage("正在分析章节内容，同步全局摘要与角色状态...");
        setIsSyncingContext(true);
        try {
            const template = customPrompts['STATE_UPDATE'] || PROMPTS.STATE_UPDATE;

            // 优化上下文内容，只传递关键信息，提高AI生成的准确性
            // 对于长章节，只传递最近的部分内容，避免上下文过多
            const maxChapterLength = 1000; // 最大章节内容长度
            const chapterText = currentChapter.content.length > maxChapterLength
                ? `...${currentChapter.content.slice(-maxChapterLength)}`
                : currentChapter.content;

            const variables = {
                chapter_text: chapterText,
                global_summary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
                character_state: generatedData.state || "暂无角色状态",
                // 只传递当前章节相关的蓝图内容，避免上下文过多
                chapter_blueprint: generatedData.blueprint
                    ? generatedData.blueprint.split('###').find(section => section.includes(`第${chapterNum}章`)) || "暂无当前章节蓝图"
                    : "暂无章节蓝图",
                novel_number: chapterNum,
                chapter_title: currentChapter.title || `第${chapterNum}章`
            };

            const prompt = formatPrompt(template, variables);
            const result = await generateContent(prompt, "同步上下文任务", apiConfig);

            // 添加调试日志
            console.log('[Sync Context] AI生成结果:', result);

            // 改进正则表达式，使其更灵活，能够匹配不同格式的输出
            const globalSummaryMatch = result.match(/##\s*(?:全局故事摘要|GLOBAL_SUMMARY_UPDATED)[\s\S]*?(?=##\s*(?:角色状态档案|CHARACTER_STATE_UPDATED|当前章节摘要|CURRENT_CHAPTER_SUMMARY)|$)/i);
            const charStateMatch = result.match(/##\s*(?:角色状态档案|CHARACTER_STATE_UPDATED)[\s\S]*?(?=##\s*(?:当前章节摘要|CURRENT_CHAPTER_SUMMARY|$))/i);
            const chapSummaryMatch = result.match(/##\s*(?:当前章节摘要|CURRENT_CHAPTER_SUMMARY)[\s\S]*$/i);

            // 提取匹配内容，处理不同格式
            const extractContent = (match: RegExpMatchArray | null) => {
                if (!match) return null;
                // 移除标题行，只保留内容
                return match[0].replace(/^##\s*(?:.*?)\n/i, '').trim();
            };

            const globalSummaryContent = extractContent(globalSummaryMatch);
            const charStateContent = extractContent(charStateMatch);
            const chapSummaryContent = extractContent(chapSummaryMatch);

            // 增强容错处理，确保至少有一部分内容生成
            if (globalSummaryContent || charStateContent || chapSummaryContent) {
                setGeneratedData(prev => {
                    const newData = { ...prev };

                    // 更新全局摘要
                    if (globalSummaryContent) {
                        newData.globalSummary = globalSummaryContent;
                    }

                    // 更新角色状态
                    if (charStateContent) {
                        newData.state = charStateContent;
                    }

                    // 更新章节摘要
                    if (chapSummaryContent) {
                        const newChapters = [...prev.chapters];
                        if (newChapters[chapterNum - 1]) {
                            newChapters[chapterNum - 1].summary = chapSummaryContent;
                        }
                        newData.chapters = newChapters;
                    }

                    // 创建新的存档，使用现有内容作为备份
                    const newArchive: StateArchive = {
                        chapterNum: chapterNum,
                        title: `第${chapterNum}章存档`,
                        globalSummary: globalSummaryContent || newData.globalSummary || "暂无",
                        characterState: charStateContent || newData.state || "暂无",
                        chapterSummary: chapSummaryContent || newData.chapters[chapterNum - 1]?.summary || "暂无",
                        timestamp: Date.now()
                    };

                    const history = [...(prev.stateHistory || [])];
                    const existingIdx = history.findIndex(h => h.chapterNum === chapterNum);
                    if (existingIdx >= 0) {
                        history[existingIdx] = newArchive;
                    } else {
                        history.push(newArchive);
                    }
                    newData.stateHistory = history.sort((a, b) => a.chapterNum - b.chapterNum);

                    return newData;
                });

                // 提示用户同步成功，并告知生成了哪些内容
                let successMessage = "上下文同步成功！\n已归档至角色状态库。\n\n生成内容：";
                if (globalSummaryContent) successMessage += "\n- 全局故事摘要";
                if (charStateContent) successMessage += "\n- 角色状态档案";
                if (chapSummaryContent) successMessage += "\n- 当前章节摘要";
                showAlert(successMessage, "success");
            } else {
                throw new Error("AI 返回格式不符合预期，同步失败。");
            }

        } catch (e: any) {
            showAlert("同步失败: " + e.message, "error");
        } finally {
            setIsSyncingContext(false);
        }
    };

    // 打开自定义要求模态框
    const openCustomModal = (title: string, callback: (val: string) => void) => {
        setCustomModalTitle(title);
        customPromptCallbackRef.current = callback;
        currentModalTitleRef.current = title;
        setShowCustomRequestModal(true);
    };

    // 获取提示词变量的辅助函数
    const getPromptVariables = (promptKey: string, chapterNum?: number) => {
        let variables: any = {};

        if (promptKey === 'CHAPTER_1' || promptKey === 'CHAPTER_NEXT') {
            const currentChapterNum = chapterNum || 1;
            const isFirstChapter = currentChapterNum === 1;

            let previousContent = "";
            if (!isFirstChapter) {
                const prevChap = generatedData.chapters[currentChapterNum - 2];
                previousContent = prevChap ? prevChap.content.slice(-800) : "无前文";
            }

            // 尝试查找蓝图信息
            let nextChapterPurpose = "承接剧情";
            let chapterPurpose = "承上启下";
            let chapterRole = "推进剧情";
            let suspenseLevel = "正常";
            let foreshadowing = "无";
            let plotTwistLevel = "低";
            let chapterTitle = "暂无标题";
            let shortSummary = "暂无摘要";

            if (generatedData.blueprint) {
                const blueprintLines = generatedData.blueprint.split('\n');
                // 查找当前章节
                const currentChapterRegex = new RegExp(`### 第${currentChapterNum}章 - (.*)`);
                // 查找下一章
                const nextChapterRegex = new RegExp(`### 第${currentChapterNum + 1}章 -`);

                let inCurrentChapter = false;
                let inNextChapter = false;

                for (const line of blueprintLines) {
                    const currentMatch = line.match(currentChapterRegex);
                    if (currentMatch) {
                        inCurrentChapter = true;
                        chapterTitle = currentMatch[1].trim();
                    } else if (nextChapterRegex.test(line)) {
                        inCurrentChapter = false;
                        inNextChapter = true;
                    } else if (inCurrentChapter) {
                        if (line.includes('**核心作用：**')) chapterRole = line.replace('**核心作用：**', '').trim();
                        if (line.includes('**剧情安排：**')) chapterPurpose = line.replace('**剧情安排：**', '').trim();
                        if (line.includes('**悬念设置：**')) suspenseLevel = line.replace('**悬念设置：**', '').trim();
                        if (line.includes('**伏笔埋藏：**')) foreshadowing = line.replace('**伏笔埋藏：**', '').trim();
                        if (line.includes('**反转指数：**')) plotTwistLevel = line.replace('**反转指数：**', '').trim();
                        if (line.includes('**本章摘要：**')) shortSummary = line.replace('**本章摘要：**', '').trim();
                    } else if (inNextChapter) {
                        if (line.includes('**核心作用：**')) {
                            nextChapterPurpose = line.replace('**核心作用：**', '').trim();
                            break; // 找到下一章信息后停止
                        }
                    }
                }
            }

            const latestArchive = findLatestStateArchive(currentChapterNum);

            variables = {
                novel_number: currentChapterNum,
                chapter_title: chapterTitle,
                chapter_role: chapterRole,
                chapter_purpose: chapterPurpose,
                suspense_level: suspenseLevel,
                foreshadowing: foreshadowing,
                plot_twist_level: plotTwistLevel,
                short_summary: shortSummary,
                selected_theme_info: writingStepState.selectedTheme ? `已选题材公式：${writingStepState.selectedTheme.name} - ${writingStepState.selectedTheme.desc}` : '未指定特定题材公式，请自行发挥',
                character_state: latestArchive.characterState,
                world_building: generatedData.world || "暂无世界观设定",
                plot_architecture: generatedData.plot || "暂无情节架构",
                custom_requirements: inputs.customRequirements || "无",
                novel_title: String(inputs.novelTitle || "未命名"),
                tone: String(inputs.tone || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                word_count: String(inputs.wordCount || 2000),
                CHAPTER_BLUEPRINT: generatedData.blueprint || "暂无章节蓝图",
                global_summary: latestArchive.globalSummary,
                previous_chapter_excerpt: previousContent,
                chapter_summary: latestArchive.chapterSummary || "暂无摘要",
                next_chapter_number: currentChapterNum + 1,
                next_chapter_title: `第${currentChapterNum + 1}章`,
                next_chapter_purpose: nextChapterPurpose
            };
        } else if (promptKey === 'STATE_UPDATE') {
            // 状态更新相关提示词
            const currentChapterNum = chapterNum || writingStepState.viewChapter || 1;
            const currentChapter = generatedData.chapters[currentChapterNum - 1];

            variables = {
                chapter_text: currentChapter?.content || "暂无章节内容",
                global_summary: generatedData.globalSummary || generatedData.dna || "暂无全局摘要",
                character_state: generatedData.state || "暂无角色状态",
                chapter_blueprint: generatedData.blueprint || "暂无章节蓝图",
                novel_number: currentChapterNum,
                chapter_title: currentChapter?.title || `第${currentChapterNum}章`
            };
        } else {

            // 通用提示词变量
            const step = STEPS.find(s => s.promptKey === promptKey);
            const customInstruction = step ? stepCustomInstructions[step.id] || "无" : "无";

            variables = {
                novel_title: String(inputs.novelTitle || "未命名"),
                topic: String(inputs.topic || ""),
                genre: String(inputs.genre || ""),
                tone: String(inputs.tone || "未指定"),
                ending: String(inputs.ending || "未指定"),
                perspective: String(inputs.perspective || "未指定"),
                number_of_chapters: String(inputs.numberOfChapters || 10),
                word_count: String(inputs.wordCount || 2000),
                custom_requirements: String(inputs.customRequirements || "无"),
                custom_instruction: customInstruction,
                STORY_DNA: String(generatedData.dna || "暂无核心DNA"),
                character_dynamics: String(generatedData.characters || "暂无角色设定"),
                world_building: String(generatedData.world || "暂无世界观设定"),
                plot_architecture: String(generatedData.plot || "暂无情节架构"),
                plot_structure: selectedPlotStructure
            };
        }
        return variables;
    };

    // 获取完整提示词（作为回调传递给PromptManagerModal）
    // 获取完整提示词（作为回调传递给PromptManagerModal）
    const handleGetFullPrompt = (promptKey: string, chapterNum?: number) => {
        let template = "";
        if (promptKey === 'THEME_MATCH_PROMPT') template = customPrompts[promptKey] || THEME_MATCH_PROMPT;
        else if (promptKey === 'STATE_UPDATE') template = customPrompts[promptKey] || PROMPTS.STATE_UPDATE;
        else template = customPrompts[promptKey] || PROMPTS[promptKey as keyof typeof PROMPTS] || "";

        const variables = getPromptVariables(promptKey, chapterNum);
        return formatPrompt(template, variables);
    };


    // 监听editingPromptKey变化，重新生成完整提示词


    const renderContent = () => {
        if (currentStep === 0) {
            return (
                <div className="max-w-3xl mx-auto space-y-5 animate-in fade-in slide-in-from-bottom-4 pb-6">
                    <div className="text-center space-y-1 mb-4 pt-4">
                        <h2 className="text-2xl font-serif font-bold text-gray-900 tracking-tight">
                            开启您的创作旅程
                        </h2>
                        <p className="text-gray-400 font-hand text-lg tracking-wide">Tell me your story...</p>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-xl p-5 sm:p-6 shadow-sm">
                        <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                            <BookOpen size={14} className="mr-2" />
                            Core Concept
                        </h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 font-serif">
                                    核心脑洞 (Topic) <span className="text-black ml-1">*</span>
                                </label>
                                <textarea
                                    className="w-full min-h-[100px] bg-gray-50 border-0 rounded-lg p-3 text-gray-900 placeholder:text-gray-400 focus:ring-1 focus:ring-black outline-none resize-none transition-all font-sans text-sm"
                                    placeholder="请输入您的故事核心创意，例如：一个在修仙世界卖保险的穿越者..."
                                    value={inputs.topic}
                                    onChange={(e) => setInputs(prev => ({ ...prev, topic: e.target.value }))}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-white border border-gray-100 rounded-xl p-5 sm:p-6 shadow-sm space-y-6">
                        <div>
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                <List size={14} className="mr-2" />
                                Basic Settings
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                        题材分类 (Genre)
                                    </label>
                                    <select
                                        className="w-full bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none transition-all appearance-none"
                                        value={inputs.genre}
                                        onChange={(e) => setInputs(prev => ({ ...prev, genre: e.target.value }))}
                                    >
                                        <option value="">请选择题材...</option>
                                        <optgroup label="男频">
                                            {TAGS.male.filter(t => t !== '全部').map(t => <option key={t} value={t}>{t}</option>)}
                                        </optgroup>
                                        <optgroup label="女频">
                                            {TAGS.female.filter(t => t !== '全部').map(t => <option key={t} value={t}>{t}</option>)}
                                        </optgroup>
                                        <optgroup label="耽美/纯爱">
                                            {(TAGS as any).danmei.filter((t: string) => t !== '全部').map((t: string) => <option key={t} value={t}>{t}</option>)}
                                        </optgroup>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                        叙事视角
                                    </label>
                                    <select
                                        className="w-full bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none transition-all"
                                        value={inputs.perspective}
                                        onChange={(e) => setInputs(prev => ({ ...prev, perspective: e.target.value }))}
                                    >
                                        <option value="">请选择视角...</option>
                                        {NARRATIVE_PERSPECTIVES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                        故事基调
                                    </label>
                                    <select
                                        className="w-full bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none transition-all"
                                        value={inputs.tone}
                                        onChange={(e) => setInputs(prev => ({ ...prev, tone: e.target.value }))}
                                    >
                                        <option value="">请选择故事基调...</option>
                                        {STORY_TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                        结局倾向
                                    </label>
                                    <select
                                        className="w-full bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none transition-all"
                                        value={inputs.ending}
                                        onChange={(e) => setInputs(prev => ({ ...prev, ending: e.target.value }))}
                                    >
                                        <option value="">请选择结局...</option>
                                        {ENDING_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        </div>

                        <div className="pt-5 border-t border-gray-100">
                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                <LayoutDashboard size={14} className="mr-2" />
                                Requirements
                            </h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                        小说名称
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            className="flex-1 bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none transition-all"
                                            placeholder="输入小说名称或AI生成..."
                                            value={inputs.novelTitle}
                                            onChange={(e) => setInputs(prev => ({ ...prev, novelTitle: e.target.value }))}
                                        />
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                if (!apiConfig.apiKey) {
                                                    setShowConfigModal(true);
                                                    return;
                                                }
                                                if (!inputs.topic || !inputs.genre) {
                                                    showAlert('请先填写核心脑洞和题材分类', "warning");
                                                    return;
                                                }
                                                setIsGenerating(true);
                                                try {
                                                    // 1. 使用更直接、更有网文感的系统提示
                                                    const systemPrompt = "你是一个深耕网文市场多年的爆款主编，最擅长根据题材起出极具点击率的书名。请直接输出一个最合适的书名，禁止任何解释语。";

                                                    // 2. 优化用户指令，强调基于内容而非角色本身
                                                    const userPrompt = `
                                                        请根据以下需求生成一个吸引人的小说书名：
                                                        【核心脑洞】：${inputs.topic}
                                                        【题材分类】：${inputs.genre}
                                                        【故事基调】：${inputs.tone || '未指定'}
                                                        
                                                        注意：
                                                        - 必须紧扣“${inputs.topic}”的具体内容创作。
                                                        - 禁止使用“网文”、“起名”、“实验室”等作为书名的一部分。
                                                        - 书名要通俗易懂且带有网文独有的“钩子”或“爽点”。
                                                        - 直接输出结果，格式为：书名：xxx
                                                    `;

                                                    const result = await generateContent(systemPrompt, userPrompt, apiConfig);

                                                    // 3. 增强解析逻辑：确保提取出真正的书名
                                                    let title = "";
                                                    const lines = result.split('\n').map(l => l.trim()).filter(l => l);

                                                    // 寻找包含“书名”的行
                                                    const titleLine = lines.find(l => l.includes('书名')) || lines[0];

                                                    if (titleLine) {
                                                        // 替换掉所有前缀标签（如“书名:”、“1.”、“* ”等）
                                                        title = titleLine.replace(/^.*?[：:]/, '').replace(/^[\d.*\- ]+/, '');
                                                    }

                                                    // 4. 清理杂质
                                                    title = title.replace(/[《》""'']|\*\*|__/g, '').replace(/[。，.]$/, '').trim();
                                                    // 如果解析出来的还是太长（超过20个字且包含换行），可能解析失败了，兜底只取第一行
                                                    if (title.length > 20 && title.includes('\n')) {
                                                        title = title.split('\n')[0].trim();
                                                    }

                                                    setInputs(prev => ({ ...prev, novelTitle: title }));
                                                } catch (error) {
                                                    console.error('生成书名失败:', error);
                                                    showAlert('生成失败，请检查API配置', "error");
                                                } finally {
                                                    setIsGenerating(false);
                                                }
                                            }}
                                            disabled={isGenerating || !inputs.topic || !inputs.genre}
                                            className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-900 rounded-lg transition-all disabled:opacity-50 text-sm font-medium"
                                        >
                                            {isGenerating ? <RefreshCw size={14} className="animate-spin" /> : <Sparkles size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                            预计章节数
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none transition-all"
                                            value={inputs.numberOfChapters || ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setInputs(prev => ({ ...prev, numberOfChapters: value ? parseInt(value) : 0 }));
                                            }}
                                            placeholder="12"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                            每章字数
                                        </label>
                                        <input
                                            type="text"
                                            inputMode="numeric"
                                            className="w-full bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none transition-all"
                                            value={inputs.wordCount || ''}
                                            onChange={(e) => {
                                                const value = e.target.value;
                                                setInputs(prev => ({ ...prev, wordCount: value ? parseInt(value) : 0 }));
                                            }}
                                            placeholder="2000"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5 font-serif">
                                        自定义特殊要求
                                    </label>
                                    <textarea
                                        className="w-full min-h-[60px] bg-gray-50 border-0 rounded-lg p-2.5 text-gray-900 text-sm focus:ring-1 focus:ring-black outline-none resize-none transition-all"
                                        placeholder="额外的设定要求..."
                                        value={inputs.customRequirements}
                                        onChange={(e) => setInputs(prev => ({ ...prev, customRequirements: e.target.value }))}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-center pt-2">
                        <button
                            onClick={() => {
                                if (!inputs.topic.trim()) {
                                    showAlert('请填写核心脑洞', "warning");
                                    return;
                                }
                                setIsInitCompleted(true);
                                setCurrentStep(1);
                            }}
                            className="group px-6 py-2.5 bg-white border border-gray-200 hover:border-gray-900 text-gray-900 rounded-full transition-all shadow-sm hover:shadow-md flex items-center text-sm font-medium tracking-wide"
                        >
                            下一步：生成核心架构 <ArrowRight size={16} className="ml-2" />
                        </button>
                    </div>
                </div>
            );
        }

        if (STEPS[currentStep].id === 'writing') {
            return (
                <WritingStep
                    inputs={inputs}
                    generatedData={generatedData}
                    onGenerate={handleGenerateChapter}
                    onRewrite={handleRewriteChapter}
                    onUpdateChapterTitle={handleUpdateChapterTitle}
                    isGenerating={isGenerating}
                    isSyncingContext={isSyncingContext}
                    loadingMessage={loadingMessage}
                    copyToClipboard={copyToClipboard}
                    apiConfig={apiConfig}
                    onSyncContext={handleSyncContext}
                    onUpdateViewChapter={(chapterNum) => setWritingStepState(prev => ({ ...prev, viewChapter: chapterNum }))}
                    onUpdateSelectedTheme={(theme) => setWritingStepState(prev => ({ ...prev, selectedTheme: theme }))}
                    viewChapter={writingStepState.viewChapter}
                    selectedTheme={writingStepState.selectedTheme}
                />
            );
        }

        const currentStepId = STEPS[currentStep].id as keyof GeneratedData;
        const content = generatedData[currentStepId];

        if (currentStepId === 'dna') {
            return (
                <div className="flex flex-col space-y-6">
                    {/* Action Bar */}
                    <div className="flex flex-wrap justify-between items-center gap-3 bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
                        <h2 className="text-lg font-serif font-bold text-gray-900 flex items-center">
                            {React.createElement(STEPS[currentStep].icon, { className: "mr-2 text-gray-400", size: 18 })}
                            {STEPS[currentStep].title}
                        </h2>
                        <div className="flex space-x-2 sm:space-x-3 flex-wrap justify-end w-auto">
                            {currentStepId === 'dna' && (
                                <button
                                    onClick={handleJudge}
                                    disabled={isJudging}
                                    className={`px-3 py-1.5 bg-white border border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 rounded-lg flex items-center transition-all ${isJudging ? 'opacity-50 cursor-not-allowed' : 'shadow-sm'} min-h-[36px] justify-center font-serif text-sm font-medium`}
                                >
                                    {isJudging ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <Gavel size={14} className="mr-2" />}
                                    {isJudging ? '审判中...' : '判官审题'}
                                </button>
                            )}

                            {content && (
                                <button
                                    onClick={() => openCustomModal(STEPS[currentStep].title, (val) => handleGenerateStep(currentStepId, val))}
                                    className="flex items-center px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors border border-gray-200 min-h-[36px] justify-center shadow-sm text-sm font-medium"
                                >
                                    <RefreshCw size={14} className="mr-2" /> 重写/修改
                                </button>
                            )}
                            <button
                                onClick={() => handleGenerateStep(currentStepId)}
                                disabled={isGenerating}
                                className={`flex items-center px-4 py-1.5 bg-white hover:bg-gray-50 text-stone-900 border border-gray-200 hover:border-gray-400 font-serif font-medium rounded-lg transition-all ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'shadow-sm hover:shadow'} min-h-[36px] justify-center text-sm`}
                            >
                                {isGenerating ? <RefreshCw className="animate-spin mr-2" size={14} /> : <Sparkles className="mr-2" size={14} />}
                                {content ? '重新生成' : '立即生成'}
                            </button>
                        </div>
                    </div>

                    {/* Content Area */}
                    <div className="bg-white border border-gray-100 rounded-xl p-6 sm:p-10 shadow-sm min-h-[600px] relative">
                        {isGenerating ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                                <RefreshCw className="animate-spin w-10 h-10 text-gray-900 mb-6" />
                                <p className="text-gray-500 font-serif italic text-lg animate-pulse text-center px-4">{loadingMessage || "AI 正在深度思考构建中..."}</p>
                            </div>
                        ) : content ? (
                            <div className="max-w-4xl mx-auto space-y-6">
                                <div>
                                    <div className="flex justify-end mb-4 group opacity-0 hover:opacity-100 transition-opacity">
                                        <button onClick={() => copyToClipboard(content as string)} className="text-gray-400 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
                                            title="复制核心DNA"
                                        >
                                            <Copy size={16} />
                                        </button>
                                    </div>
                                    <div className="prose prose-stone prose-lg max-w-none font-serif text-gray-800 leading-relaxed">
                                        <MarkdownViewer content={content as string} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-300 py-20">
                                <BookOpen size={64} className="mb-6 opacity-30" />
                                <p className="font-serif text-xl">点击上方“生成”按钮开始构建</p>
                            </div>
                        )}
                    </div>

                    {/* Next Step Button */}
                    {
                        currentStep < STEPS.length - 1 && content && (
                            <div className="flex justify-center p-8">
                                <button
                                    onClick={() => setCurrentStep(currentStep + 1)}
                                    className="group px-6 py-2.5 bg-white border border-gray-200 hover:border-gray-900 text-gray-900 rounded-full transition-all shadow-sm hover:shadow-md flex items-center text-sm font-medium tracking-wide"
                                >
                                    下一步：{STEPS[currentStep + 1].title} <ArrowRight size={16} className="ml-2 group-hover:translate-x-0.5 transition-transform" />
                                </button>
                            </div>
                        )
                    }
                </div >
            );
        }

        if (currentStepId === 'state') {
            const history = generatedData.stateHistory || [];
            const currentArchive = history.find(h => h.chapterNum === viewArchiveChapter) || history[0];

            return (
                <div className="h-full flex flex-col space-y-6">
                    <div className="flex flex-wrap items-center justify-between bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm gap-3">
                        <h2 className="text-lg font-serif font-bold text-gray-900 flex items-center">
                            <Activity className="mr-2 text-gray-400" size={18} />
                            角色状态库
                        </h2>

                        {/* 中间提示信息 */}
                        <div className="hidden sm:flex flex-1 justify-center mx-4">
                            <div className="flex items-center text-xs text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-200">
                                <span className="mr-2">💡</span> 提示：完成章节创作后，点击 <Activity size={14} className="inline-block mx-1" /> 更新角色状态
                            </div>
                        </div>

                        <div className="flex items-center space-x-2 sm:space-x-3 w-auto justify-end">
                            {history.length > 0 && (
                                <div className="relative flex-shrink-0">
                                    <select
                                        value={viewArchiveChapter}
                                        onChange={(e) => setViewArchiveChapter(parseInt(e.target.value))}
                                        className="appearance-none bg-white text-gray-900 pl-4 pr-10 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-1 focus:ring-black focus:border-black font-sans text-sm shadow-sm hover:border-gray-300 transition-all min-w-[140px]"
                                    >
                                        {history.map(h => (
                                            <option key={h.chapterNum} value={h.chapterNum}>
                                                {h.title}
                                            </option>
                                        ))}
                                    </select>
                                    <Clock className="absolute right-3 top-2.5 text-gray-400 pointer-events-none" size={16} />
                                </div>
                            )}

                            <button
                                onClick={() => handleGenerateStep('state')}
                                disabled={isGenerating}
                                className={`flex items-center px-4 py-1.5 bg-white hover:bg-gray-50 text-stone-900 border border-gray-200 hover:border-gray-400 font-serif font-medium rounded-lg transition-all ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'shadow-sm hover:shadow'} min-h-[36px] justify-center text-sm whitespace-nowrap`}
                            >
                                {isGenerating ? <RefreshCw size={14} className="animate-spin mr-2" /> : <RefreshCw size={14} className="mr-2" />}
                                {history.length > 0 ? '重置状态' : '生成初始状态'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden flex flex-col">
                        {currentArchive ? (
                            <div className="h-full grid grid-cols-1 lg:grid-cols-3 gap-0 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
                                {/* 左侧信息区 */}
                                <div className="col-span-1 lg:col-span-1 p-6 overflow-y-auto bg-gray-50/30">
                                    <div className="space-y-6">
                                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                                <Globe size={14} className="mr-2" />
                                                全局故事摘要
                                            </h3>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 text-sm text-gray-700 leading-relaxed font-serif">
                                                <MarkdownViewer content={currentArchive.globalSummary} compact />
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-xl p-5 border border-gray-100 shadow-sm">
                                            <h3 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center">
                                                <FileText size={14} className="mr-2" />
                                                本章摘要
                                            </h3>
                                            <div className="max-h-60 overflow-y-auto custom-scrollbar pr-2 text-sm text-gray-700 leading-relaxed font-serif">
                                                <MarkdownViewer content={currentArchive.chapterSummary} compact />
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* 右侧角色状态区 */}
                                <div className="col-span-1 lg:col-span-2 p-8 min-h-full overflow-y-auto bg-white">
                                    <div className="mb-6 pb-4 border-b border-gray-100">
                                        <h3 className="text-sm font-bold text-gray-900 uppercase tracking-widest flex items-center">
                                            <Users size={16} className="mr-2" />
                                            角色状态档案
                                        </h3>
                                    </div>
                                    <div className="text-gray-800 font-serif leading-relaxed">
                                        <MarkdownViewer content={currentArchive.characterState} />
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                <Archive size={48} className="mb-4 opacity-30" />
                                <p className="font-serif">暂无存档记录</p>
                            </div>
                        )}
                    </div>

                    {/* Next Step Button */}
                    {currentStep < STEPS.length - 1 && (
                        <div className="flex justify-center mt-6">
                            <button
                                onClick={() => {
                                    if (STEPS[currentStep + 1]) {
                                        setIsInitCompleted(true);
                                        setCurrentStep(prev => prev + 1);
                                    } else {
                                        showAlert('已经是最后一步了', "info");
                                    }
                                }}
                                className="group px-6 py-2.5 bg-white border border-gray-200 hover:border-gray-900 text-gray-900 rounded-full transition-all shadow-sm hover:shadow-md flex items-center text-sm font-medium tracking-wide"
                            >
                                下一步：{STEPS[currentStep + 1].title} <ArrowRight size={16} className="ml-2 group-hover:translate-x-0.5 transition-transform" />
                            </button>
                        </div>
                    )}
                </div>
            );
        }

        return (
            <div className="flex flex-col space-y-6">
                {/* Action Bar */}
                <div className="flex flex-wrap justify-between items-center gap-3 bg-white px-4 py-3 rounded-xl border border-gray-100 shadow-sm">
                    {/* 左侧：标题 */}
                    <h2 className="text-lg font-serif font-bold text-gray-900 flex items-center">
                        {React.createElement(STEPS[currentStep].icon, { className: "mr-2 text-gray-400", size: 18 })}
                        {STEPS[currentStep].title}
                    </h2>

                    {/* 中间：选择剧情结构按钮 */}
                    <div className="flex justify-center flex-1">
                        {currentStepId === 'plot' && (
                            <button
                                onClick={() => setShowPlotStructureModal(true)}
                                className="flex items-center px-3 py-1.5 bg-gray-50 hover:bg-white border border-gray-200 text-gray-700 rounded-lg transition-all hover:shadow-sm text-sm max-w-[160px] sm:max-w-[240px]"
                            >
                                <LayoutList size={14} className="mr-2 text-gray-500 shrink-0" />
                                <span className="truncate">结构: {selectedPlotStructure}</span>
                            </button>
                        )}
                    </div>

                    {/* 右侧：其他按钮组 */}
                    <div className="flex space-x-2 sm:space-x-3 flex-wrap justify-end w-auto">
                        {currentStepId === 'plot' && (
                            <button
                                onClick={handlePlotCritique}
                                disabled={isPlotCritiquing || !generatedData.plot}
                                className={`px-3 py-1.5 bg-white border border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:border-emerald-300 rounded-lg flex items-center transition-all ${(isPlotCritiquing || !generatedData.plot) ? 'opacity-50 cursor-not-allowed' : 'shadow-sm'} min-h-[36px] justify-center font-serif text-sm font-medium`}
                            >
                                {isPlotCritiquing ? <RefreshCw size={14} className="mr-2 animate-spin" /> : <Activity size={14} className="mr-2" />}
                                {isPlotCritiquing ? '诊疗中...' : '深度问诊'}
                            </button>
                        )}
                        {content && (
                            <button
                                onClick={() => openCustomModal(STEPS[currentStep].title, (val) => handleGenerateStep(currentStepId, val))}
                                className="flex items-center px-3 py-1.5 bg-white hover:bg-gray-50 text-gray-700 rounded-lg transition-colors border border-gray-200 min-h-[36px] justify-center shadow-sm text-sm font-medium"
                            >
                                <RefreshCw size={14} className="mr-2" /> 重写/修改
                            </button>
                        )}
                        <button
                            onClick={() => handleGenerateStep(currentStepId)}
                            disabled={isGenerating}
                            className={`flex items-center px-4 py-1.5 bg-white hover:bg-gray-50 text-stone-900 border border-gray-200 hover:border-gray-400 font-serif font-medium rounded-lg transition-all ${isGenerating ? 'opacity-50 cursor-not-allowed' : 'shadow-sm hover:shadow'} min-h-[36px] justify-center text-sm`}
                        >
                            {isGenerating ? <RefreshCw className="animate-spin mr-2" size={14} /> : <Sparkles className="mr-2" size={14} />}
                            {content ? '重新生成' : '立即生成'}
                        </button>
                    </div>
                </div>

                {/* Content Area */}
                <div className="bg-white border border-gray-100 rounded-xl p-6 sm:p-10 shadow-sm min-h-[600px] relative">
                    {isGenerating ? (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 z-10">
                            <RefreshCw className="animate-spin w-10 h-10 text-gray-900 mb-6" />
                            <p className="text-gray-500 font-serif italic text-lg animate-pulse text-center px-4">{loadingMessage || "AI 正在深度思考构建中..."}</p>
                        </div>
                    ) : content ? (
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex justify-end mb-4 group opacity-0 hover:opacity-100 transition-opacity">
                                <button onClick={() => copyToClipboard(content as string)} className="text-gray-400 hover:text-gray-900 transition-colors p-2 rounded-lg hover:bg-gray-100"
                                    title="复制内容"
                                >
                                    <Copy size={16} />
                                </button>
                            </div>
                            <div className="prose prose-stone prose-lg max-w-none font-serif text-gray-800 leading-relaxed">
                                <MarkdownViewer content={cleanCodeBlock(content as string)} />
                            </div>
                        </div>
                    ) : (
                        <div className="h-full flex flex-col items-center justify-center text-gray-300 py-20">
                            <BookOpen size={64} className="mb-6 opacity-30" />
                            <p className="font-serif text-xl">点击上方“生成”按钮开始构建</p>
                        </div>
                    )}
                </div>

                {/* Next Step Button */}
                {currentStep < STEPS.length - 1 && content && (
                    <div className="flex justify-center p-8">
                        <button
                            onClick={() => setCurrentStep(currentStep + 1)}
                            className="group px-6 py-2.5 bg-white border border-gray-200 hover:border-gray-900 text-gray-900 rounded-full transition-all shadow-sm hover:shadow-md flex items-center text-sm font-medium tracking-wide"
                        >
                            下一步：{STEPS[currentStep + 1].title} <ArrowRight size={16} className="ml-2 group-hover:translate-x-0.5 transition-transform" />
                        </button>
                    </div>
                )}
            </div>
        );
    };



    return (
        <div className="h-screen w-screen bg-stone-950 text-stone-100 flex font-sans">
            {/* 仅在未隐藏提示词管理功能时渲染提示词编辑和管理模态框 */}
            {!__HIDE_PROMPT_MANAGEMENT__ && (
                <>
                    <PromptManagerModal
                        isOpen={showPromptManager}
                        onClose={() => setShowPromptManager(false)}
                        customPrompts={customPrompts}
                        onUpdatePrompts={setCustomPrompts}
                        onGetFullPrompt={handleGetFullPrompt}
                        currentChapter={writingStepState.viewChapter}
                        totalChapters={generatedData.chapters.length}
                    />
                </>
            )}

            <CustomRequestModal
                isOpen={showCustomRequestModal}
                onClose={() => setShowCustomRequestModal(false)}
                onSubmit={(val) => {
                    // 使用ref中的回调函数和标题
                    const step = STEPS.find(s => s.title === currentModalTitleRef.current);
                    if (step) {
                        // 保存修改意见到状态中
                        setStepCustomInstructions(prev => ({
                            ...prev,
                            [step.id]: val
                        }));
                    }
                    // 调用原回调
                    customPromptCallbackRef.current(val);
                }}
                title={customModalTitle}
            />

            <ConfigModal
                isOpen={showConfigModal}
                onClose={() => setShowConfigModal(false)}
                config={apiConfig}
                onSave={handleConfigSave}
            />

            <JudgeResultModal
                isOpen={showJudgeModal}
                onClose={() => setShowJudgeModal(false)}
                content={judgeResult}
                onSelectProposal={handleSelectJudgeProposal}
            />

            <PlotCritiqueModal
                isOpen={showPlotCritiqueModal}
                onClose={() => setShowPlotCritiqueModal(false)}
                content={plotCritiqueResult}
            />

            <PlotStructureModal
                isOpen={showPlotStructureModal}
                onClose={() => setShowPlotStructureModal(false)}
                plotStructures={PLOT_STRUCTURES}
                selectedStructure={selectedPlotStructure}
                onSelectStructure={setSelectedPlotStructure}
            />

            {/* Mobile Sidebar Overlay */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm z-10 md:hidden"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* Sidebar - Minimalist White Design */}
            <div className={`w-56 sm:w-64 bg-white border-r border-gray-100 flex flex-col fixed inset-y-0 left-0 z-20 transform transition-transform duration-300 md:static md:transform-none ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:flex shadow-sm`}>
                <div className="p-8 border-b border-gray-100 flex flex-col items-center">
                    <img
                        src="/favicon.png"
                        alt="Story Mind"
                        className="w-auto h-20 mb-2 object-contain grayscale hover:grayscale-0 transition-all duration-500"
                    />
                    <h1 className="font-serif text-xl font-bold tracking-wider text-gray-900">Story Mind <span className="text-gray-400 font-light text-sm align-top">1.0</span></h1>
                    <p className="font-hand text-gray-400 text-lg -rotate-2 mt-1">智能小说创作系统</p>
                </div>

                <div className="flex-1 overflow-y-auto px-4 py-6 space-y-1">
                    {STEPS.map((step, idx) => (
                        <StepCard
                            key={step.id}
                            title={step.title}
                            icon={step.icon}
                            isActive={currentStep === idx}
                            isCompleted={idx === 0 ? isInitCompleted : (step.id === 'writing' ? generatedData.chapters.length > 0 : (idx > 0 && idx < 7 ? !!generatedData[step.id as keyof GeneratedData] : false))}
                            onClick={() => setCurrentStep(idx)}
                        />
                    ))}
                </div>

                {/* 导入导出重置功能 - 底部极简风格 */}
                <div className="p-4 border-t border-gray-100 bg-gray-50/50">
                    <div className="grid grid-cols-2 gap-2 mb-3">
                        <button
                            onClick={handleImport}
                            className="flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            导入
                        </button>
                        <button
                            onClick={handleExport}
                            className="flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium text-gray-600 hover:text-gray-900 hover:bg-white border border-gray-200 hover:border-gray-300 transition-all shadow-sm"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></svg>
                            导出
                        </button>
                    </div>
                    <button
                        onClick={handleReset}
                        className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-md text-xs font-medium text-gray-500 hover:text-red-600 hover:bg-red-50 border border-transparent hover:border-red-100 transition-all"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18" /><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" /><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                        重置项目
                    </button>
                </div>

                <div className="p-4 border-t border-gray-100 text-xs bg-gray-50">
                    <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 flex-1 min-w-0">
                            <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${apiConfig.apiKey ? 'bg-black' : 'bg-gray-300'}`} />
                            <span className="text-gray-500 font-medium truncate">
                                {apiConfig.provider === 'google' ? 'Google Gemini' :
                                    apiConfig.provider === 'deepseek' ? 'DeepSeek' :
                                        apiConfig.provider === 'openai' ? 'OpenAI' :
                                            apiConfig.provider === 'claude' ? 'Claude' :
                                                apiConfig.provider === 'custom' ? 'Custom' : '未配置'}
                            </span>
                        </div>
                        <div className="flex gap-1">
                            {!__HIDE_PROMPT_MANAGEMENT__ && (
                                <button
                                    onClick={() => setShowPromptManager(true)}
                                    className="text-gray-400 hover:text-gray-900 p-1 rounded hover:bg-gray-200 transition-colors"
                                    title="提示词管理"
                                >
                                    <FileText size={12} />
                                </button>
                            )}
                            <button
                                onClick={() => setShowConfigModal(true)}
                                className="text-gray-400 hover:text-gray-900 p-1 rounded hover:bg-gray-200 transition-colors"
                                title="配置接口"
                            >
                                <Settings size={12} />
                            </button>
                        </div>
                    </div>
                    <div className="text-[10px] text-gray-400 text-center font-serif italic">
                        Story Mind © 2025
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col min-w-0 bg-stone-50 overflow-hidden relative">
                {/* Decorative background elements */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gray-100 rounded-full blur-3xl opacity-30 -translate-y-1/2 translate-x-1/2 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-96 h-96 bg-gray-100 rounded-full blur-3xl opacity-30 translate-y-1/2 -translate-x-1/2 pointer-events-none"></div>

                <header className="md:hidden p-4 bg-white border-b border-gray-100 flex items-center justify-between z-10 shadow-sm">
                    <button
                        onClick={() => setIsSidebarOpen(true)}
                        className="p-2 rounded-lg hover:bg-gray-100 transition-colors mr-2 text-gray-600"
                        title="展开侧边栏"
                    >
                        <List size={20} />
                    </button>
                    <span className="font-serif font-bold text-gray-900">Story Mind</span>
                    <span className="text-xs text-gray-400 font-hand">{STEPS[currentStep].title}</span>
                </header>

                <main className="flex-1 flex flex-col overflow-hidden relative z-0 h-full">
                    {/* Top Step Indicator for Desktop */}
                    <div className="hidden md:flex justify-center mb-6 mt-6 shrink-0">
                        <div className="flex items-center space-x-4">
                            <div className="h-px w-12 bg-gray-200"></div>
                            <div className="w-8 h-8 rounded-full border border-black flex items-center justify-center bg-black text-white font-serif shadow-lg">
                                {currentStep + 1}
                            </div>
                            <h2 className="text-2xl font-serif font-bold text-gray-900 tracking-tight">{STEPS[currentStep].title}</h2>
                            <div className="h-px w-12 bg-gray-200"></div>
                        </div>
                    </div>

                    {/* Content Area with Conditional Scrolling */}
                    <div className={`flex-1 min-h-0 w-full p-4 lg:p-10 pt-0 ${['writing', 'state'].includes(STEPS[currentStep].id) ? 'overflow-hidden' : (STEPS[currentStep].id === 'init' ? 'overflow-y-auto no-scrollbar' : 'overflow-y-auto custom-scrollbar')}`}>
                        {renderContent()}
                    </div>
                </main>
            </div>
        </div>
    );
}
