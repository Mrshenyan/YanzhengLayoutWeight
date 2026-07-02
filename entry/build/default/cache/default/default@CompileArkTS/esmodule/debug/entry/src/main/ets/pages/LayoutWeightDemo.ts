if (!("finalizeConstruction" in ViewPU.prototype)) {
    Reflect.set(ViewPU.prototype, "finalizeConstruction", () => { });
}
interface LayoutWeightDemo_Params {
    scene?: DemoScene;
    detailCollapsed?: boolean;
    clipRoot?: boolean;
    detailMeasuredHeight?: number;
    rows?: RowItem[];
    details?: RowItem[];
}
/**
 * layoutWeight 异常复现与修复演示（对照官方《尺寸设置》通用属性定义）
 *
 * 官方规则（OpenHarmony 6.1）：
 *   父容器尺寸确定时，不设置 layoutWeight（或生效值为 0）的元素“优先占位”，
 *   占位后主轴剩下的空间称为“主轴剩余空间”；设置了 layoutWeight>0 的子元素
 *   从“剩余空间”中按权重占比分配尺寸，并忽略自身宽高。仅在 Row/Column/Flex 生效。
 *
 * 由此推出的两种不同机制（本页三档对照）：
 *   档1 挤出：叔子树无兄弟级 weight -> 属“优先占位”，保留内容高度，超出部分被挤出可视区。
 *   档2 压缩：叔子树设 layoutWeight(1) -> 瓜分“剩余空间”，而父子树已吃满 -> 剩余≈0 -> 高度趋近 0。
 *   档3 修复：兄弟层公平 weight + constraintSize 最小高度兜底（constraintSize 优先级高于 width/height）。
 */
interface RowItem {
    title: string;
    desc: string;
}
// 0 = 挤出（叔无 weight）；1 = 真·压缩到 0（叔有 weight）；2 = 修复
enum DemoScene {
    PushedOut = 0,
    Compressed = 1,
    Fixed = 2
}
class LayoutWeightDemo extends ViewPU {
    constructor(parent, params, __localStorage, elmtId = -1, paramsLambda = undefined, extraInfo) {
        super(parent, __localStorage, elmtId, extraInfo);
        if (typeof paramsLambda === "function") {
            this.paramsGenerator_ = paramsLambda;
        }
        this.__scene = new ObservedPropertySimplePU(DemoScene.PushedOut, this, "scene");
        this.__detailCollapsed = new ObservedPropertySimplePU(false, this, "detailCollapsed");
        this.__clipRoot = new ObservedPropertySimplePU(true, this, "clipRoot");
        this.__detailMeasuredHeight = new ObservedPropertySimplePU(0, this, "detailMeasuredHeight");
        this.rows = [
            { title: '行 1', desc: '父子树内部行' },
            { title: '行 2', desc: '父子树内部行' },
            { title: '行 3', desc: '父子树内部行' },
            { title: '行 4', desc: '父子树内部行' }
        ];
        this.details = [
            { title: '明细 A', desc: '叔子树内容' },
            { title: '明细 B', desc: '叔子树内容' },
            { title: '明细 C', desc: '叔子树内容' }
        ];
        this.setInitiallyProvidedValue(params);
        this.finalizeConstruction();
    }
    setInitiallyProvidedValue(params: LayoutWeightDemo_Params) {
        if (params.scene !== undefined) {
            this.scene = params.scene;
        }
        if (params.detailCollapsed !== undefined) {
            this.detailCollapsed = params.detailCollapsed;
        }
        if (params.clipRoot !== undefined) {
            this.clipRoot = params.clipRoot;
        }
        if (params.detailMeasuredHeight !== undefined) {
            this.detailMeasuredHeight = params.detailMeasuredHeight;
        }
        if (params.rows !== undefined) {
            this.rows = params.rows;
        }
        if (params.details !== undefined) {
            this.details = params.details;
        }
    }
    updateStateVars(params: LayoutWeightDemo_Params) {
    }
    purgeVariableDependenciesOnElmtId(rmElmtId) {
        this.__scene.purgeDependencyOnElmtId(rmElmtId);
        this.__detailCollapsed.purgeDependencyOnElmtId(rmElmtId);
        this.__clipRoot.purgeDependencyOnElmtId(rmElmtId);
        this.__detailMeasuredHeight.purgeDependencyOnElmtId(rmElmtId);
    }
    aboutToBeDeleted() {
        this.__scene.aboutToBeDeleted();
        this.__detailCollapsed.aboutToBeDeleted();
        this.__clipRoot.aboutToBeDeleted();
        this.__detailMeasuredHeight.aboutToBeDeleted();
        SubscriberManager.Get().delete(this.id__());
        this.aboutToBeDeletedInternal();
    }
    private __scene: ObservedPropertySimplePU<DemoScene>;
    get scene() {
        return this.__scene.get();
    }
    set scene(newValue: DemoScene) {
        this.__scene.set(newValue);
    }
    // 明细分支的折叠态：折叠时不应参与 weight 拉伸
    private __detailCollapsed: ObservedPropertySimplePU<boolean>;
    get detailCollapsed() {
        return this.__detailCollapsed.get();
    }
    set detailCollapsed(newValue: boolean) {
        this.__detailCollapsed.set(newValue);
    }
    // 根容器是否裁剪：关掉可看到“被挤出可视区”的叔子树仍在下方
    private __clipRoot: ObservedPropertySimplePU<boolean>;
    get clipRoot() {
        return this.__clipRoot.get();
    }
    set clipRoot(newValue: boolean) {
        this.__clipRoot.set(newValue);
    }
    // 叔子树实测高度（vp）：用于区分“被挤出(>0)”与“真压缩(≈0)”
    private __detailMeasuredHeight: ObservedPropertySimplePU<number>;
    get detailMeasuredHeight() {
        return this.__detailMeasuredHeight.get();
    }
    set detailMeasuredHeight(newValue: number) {
        this.__detailMeasuredHeight.set(newValue);
    }
    private rows: RowItem[];
    private details: RowItem[];
    // 叔子树在兄弟层的 weight：档1=0(优先占位)，档2/档3=1(瓜分剩余空间)
    private uncleWeight(): number {
        return this.scene === DemoScene.PushedOut ? 0 : 1;
    }
    private sceneDesc(): string {
        switch (this.scene) {
            case DemoScene.PushedOut:
                return '档1 挤出：叔子树无兄弟级 weight，属“优先占位”，保留高度但被挤出可视区（关掉裁剪可见其在下方）';
            case DemoScene.Compressed:
                return '档2 压缩：叔子树 layoutWeight(1) 瓜分剩余空间，而父子树已吃满 → 剩余≈0 → 高度趋近 0';
            default:
                return '档3 修复：兄弟层公平 weight + constraintSize({minHeight}) 兜底，折叠态 weight=0';
        }
    }
    initialRender() {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.height('100%');
        }, Column);
        this.controlBar.bind(this)();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
            Column.create();
            // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
            Column.width('100%');
            // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
            Column.layoutWeight(1);
            // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
            Column.padding(12);
            // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
            Column.backgroundColor('#F2F3F5');
            // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
            Column.border({ width: 2, color: '#D33A2C' });
            // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
            Column.clip(this.clipRoot);
        }, Column);
        this.firstSubtree.bind(this)() // 父：内部行使用 layoutWeight，撑满受限空间
        ;
        this.secondSubtree.bind(this)() // 叔：明细区
        ;
        // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
        Column.pop();
        Column.pop();
    }
    controlBar(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create({ space: 8 });
            Column.width('100%');
            Column.padding(12);
            Column.backgroundColor(Color.White);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 三档选择器
            Row.create({ space: 6 });
            // 三档选择器
            Row.width('100%');
        }, Row);
        this.sceneButton.bind(this)('挤出', DemoScene.PushedOut);
        this.sceneButton.bind(this)('压缩到0', DemoScene.Compressed);
        this.sceneButton.bind(this)('修复', DemoScene.Fixed);
        // 三档选择器
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('明细折叠');
            Text.fontSize(16);
            Text.fontWeight(FontWeight.Medium);
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: this.detailCollapsed });
            Toggle.onChange((v: boolean) => this.detailCollapsed = v);
        }, Toggle);
        Toggle.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Row.create();
            Row.width('100%');
        }, Row);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('根容器裁剪');
            Text.fontSize(16);
            Text.fontWeight(FontWeight.Medium);
            Text.layoutWeight(1);
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Toggle.create({ type: ToggleType.Switch, isOn: this.clipRoot });
            Toggle.onChange((v: boolean) => this.clipRoot = v);
        }, Toggle);
        Toggle.pop();
        Row.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            // 关键证据：档1 该值 > 0（被挤出）；档2 该值 ≈ 0（真压缩）
            Text.create(`叔子树实测高度：${this.detailMeasuredHeight.toFixed(1)} vp`);
            // 关键证据：档1 该值 > 0（被挤出）；档2 该值 ≈ 0（真压缩）
            Text.fontSize(13);
            // 关键证据：档1 该值 > 0（被挤出）；档2 该值 ≈ 0（真压缩）
            Text.fontColor('#1A66FF');
            // 关键证据：档1 该值 > 0（被挤出）；档2 该值 ≈ 0（真压缩）
            Text.width('100%');
        }, Text);
        // 关键证据：档1 该值 > 0（被挤出）；档2 该值 ≈ 0（真压缩）
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(this.sceneDesc());
            Text.fontSize(12);
            Text.fontColor(this.scene === DemoScene.Fixed ? '#1F8A3B' : '#D33A2C');
            Text.width('100%');
        }, Text);
        Text.pop();
        Column.pop();
    }
    sceneButton(label: string, target: DemoScene, parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create(label);
            Text.fontSize(14);
            Text.fontColor(this.scene === target ? Color.White : '#333333');
            Text.textAlign(TextAlign.Center);
            Text.layoutWeight(1);
            Text.padding(8);
            Text.borderRadius(6);
            Text.backgroundColor(this.scene === target ? '#1A66FF' : '#EEEEEE');
            Text.onClick(() => this.scene = target);
        }, Text);
        Text.pop();
    }
    // 父子树：内部行使用 layoutWeight，使父子树在受限高度下吃满空间
    firstSubtree(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding(10);
            Column.backgroundColor(Color.White);
            Column.borderRadius(8);
            Column.layoutWeight(this.scene === DemoScene.Fixed ? 1 : 0);
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('父子树（firstSubtree）');
            Text.fontSize(14);
            Text.fontColor('#1A66FF');
            Text.margin({ bottom: 8 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            ForEach.create();
            const forEachItemGenFunction = _item => {
                const item = _item;
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Row.create();
                    Row.width('100%');
                    Row.padding(10);
                    Row.backgroundColor('#E8F0FF');
                    Row.borderRadius(6);
                    Row.margin({ bottom: 6 });
                    Row.layoutWeight(this.scene === DemoScene.Fixed ? 0 : 1);
                }, Row);
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(item.title);
                    Text.fontSize(15);
                    Text.fontWeight(FontWeight.Medium);
                }, Text);
                Text.pop();
                this.observeComponentCreation2((elmtId, isInitialRender) => {
                    Text.create(item.desc);
                    Text.fontSize(12);
                    Text.fontColor('#8A8F99');
                    Text.margin({ left: 8 });
                }, Text);
                Text.pop();
                Row.pop();
            };
            this.forEachUpdateFunction(elmtId, this.rows, forEachItemGenFunction, (item: RowItem) => item.title, false, false);
        }, ForEach);
        ForEach.pop();
        Column.pop();
    }
    // 叔子树：明细区
    secondSubtree(parent = null) {
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Column.create();
            Column.width('100%');
            Column.padding(10);
            Column.backgroundColor(Color.White);
            Column.borderRadius(8);
            Column.border({ width: 2, color: '#1F8A3B' });
            Column.margin({ top: 10 });
            Column.layoutWeight(this.uncleWeight());
            Column.constraintSize(this.scene === DemoScene.Fixed ? { minHeight: 120 } : {});
            Column.onAreaChange((_: Area, newArea: Area) => {
                this.detailMeasuredHeight = Number(newArea.height);
            });
        }, Column);
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            Text.create('叔子树（secondSubtree · 明细）');
            Text.fontSize(14);
            Text.fontColor('#1A66FF');
            Text.margin({ bottom: 8 });
        }, Text);
        Text.pop();
        this.observeComponentCreation2((elmtId, isInitialRender) => {
            If.create();
            if (!this.detailCollapsed) {
                this.ifElseBranchUpdateFunction(0, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        ForEach.create();
                        const forEachItemGenFunction = _item => {
                            const item = _item;
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Row.create();
                                Row.width('100%');
                                Row.padding(10);
                                Row.backgroundColor('#FFF2E8');
                                Row.borderRadius(6);
                                Row.margin({ bottom: 6 });
                            }, Row);
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(item.title);
                                Text.fontSize(15);
                                Text.fontWeight(FontWeight.Medium);
                            }, Text);
                            Text.pop();
                            this.observeComponentCreation2((elmtId, isInitialRender) => {
                                Text.create(item.desc);
                                Text.fontSize(12);
                                Text.fontColor('#8A8F99');
                                Text.margin({ left: 8 });
                            }, Text);
                            Text.pop();
                            Row.pop();
                        };
                        this.forEachUpdateFunction(elmtId, this.details, forEachItemGenFunction, (item: RowItem) => item.title, false, false);
                    }, ForEach);
                    ForEach.pop();
                });
            }
            else {
                this.ifElseBranchUpdateFunction(1, () => {
                    this.observeComponentCreation2((elmtId, isInitialRender) => {
                        // 折叠态哨兵：固定高度，用于验证分支是否被整体裁剪
                        Text.create('明细已折叠');
                        // 折叠态哨兵：固定高度，用于验证分支是否被整体裁剪
                        Text.fontSize(12);
                        // 折叠态哨兵：固定高度，用于验证分支是否被整体裁剪
                        Text.fontColor('#8A8F99');
                        // 折叠态哨兵：固定高度，用于验证分支是否被整体裁剪
                        Text.height(16);
                    }, Text);
                    // 折叠态哨兵：固定高度，用于验证分支是否被整体裁剪
                    Text.pop();
                });
            }
        }, If);
        If.pop();
        Column.pop();
    }
    rerender() {
        this.updateDirtyElements();
    }
    static getEntryName(): string {
        return "LayoutWeightDemo";
    }
}
registerNamedRoute(() => new LayoutWeightDemo(undefined, {}), "", { bundleName: "com.cc.layoutWeight", moduleName: "entry", pagePath: "pages/LayoutWeightDemo", pageFullPath: "entry/src/main/ets/pages/LayoutWeightDemo", integratedHsp: "false", moduleType: "followWithHap" });
