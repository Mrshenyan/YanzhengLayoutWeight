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

@Entry
@Component
struct LayoutWeightDemo {
  @State scene: DemoScene = DemoScene.PushedOut;
  // 明细分支的折叠态：折叠时不应参与 weight 拉伸
  @State detailCollapsed: boolean = false;
  // 根容器是否裁剪：关掉可看到“被挤出可视区”的叔子树仍在下方
  @State clipRoot: boolean = true;
  // 叔子树实测高度（vp）：用于区分“被挤出(>0)”与“真压缩(≈0)”
  @State detailMeasuredHeight: number = 0;

  private rows: RowItem[] = [
    { title: '行 1', desc: '父子树内部行' },
    { title: '行 2', desc: '父子树内部行' },
    { title: '行 3', desc: '父子树内部行' },
    { title: '行 4', desc: '父子树内部行' }
  ];

  private details: RowItem[] = [
    { title: '明细 A', desc: '叔子树内容' },
    { title: '明细 B', desc: '叔子树内容' },
    { title: '明细 C', desc: '叔子树内容' }
  ];

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

  build() {
    Column() {
      this.controlBar()

      // 根容器：受限高度 + 两个顺序测量的兄弟子树（父、叔）
      Column() {
        this.firstSubtree()   // 父：内部行使用 layoutWeight，撑满受限空间
        this.secondSubtree()  // 叔：明细区
      }
      .width('100%')
      .layoutWeight(1)
      .padding(12)
      .backgroundColor('#F2F3F5')
      // 边框标出根容器真实可视边界，便于观察叔子树是否被挤到边界外
      .border({ width: 2, color: '#D33A2C' })
      .clip(this.clipRoot)
    }
    .width('100%')
    .height('100%')
  }

  @Builder
  controlBar() {
    Column({ space: 8 }) {
      // 三档选择器
      Row({ space: 6 }) {
        this.sceneButton('挤出', DemoScene.PushedOut)
        this.sceneButton('压缩到0', DemoScene.Compressed)
        this.sceneButton('修复', DemoScene.Fixed)
      }
      .width('100%')

      Row() {
        Text('明细折叠')
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.detailCollapsed })
          .onChange((v: boolean) => this.detailCollapsed = v)
      }
      .width('100%')

      Row() {
        Text('根容器裁剪')
          .fontSize(16)
          .fontWeight(FontWeight.Medium)
          .layoutWeight(1)
        Toggle({ type: ToggleType.Switch, isOn: this.clipRoot })
          .onChange((v: boolean) => this.clipRoot = v)
      }
      .width('100%')

      // 关键证据：档1 该值 > 0（被挤出）；档2 该值 ≈ 0（真压缩）
      Text(`叔子树实测高度：${this.detailMeasuredHeight.toFixed(1)} vp`)
        .fontSize(13)
        .fontColor('#1A66FF')
        .width('100%')

      Text(this.sceneDesc())
        .fontSize(12)
        .fontColor(this.scene === DemoScene.Fixed ? '#1F8A3B' : '#D33A2C')
        .width('100%')
    }
    .width('100%')
    .padding(12)
    .backgroundColor(Color.White)
  }

  @Builder
  sceneButton(label: string, target: DemoScene) {
    Text(label)
      .fontSize(14)
      .fontColor(this.scene === target ? Color.White : '#333333')
      .textAlign(TextAlign.Center)
      .layoutWeight(1)
      .padding(8)
      .borderRadius(6)
      .backgroundColor(this.scene === target ? '#1A66FF' : '#EEEEEE')
      .onClick(() => this.scene = target)
  }

  // 父子树：内部行使用 layoutWeight，使父子树在受限高度下吃满空间
  @Builder
  firstSubtree() {
    Column() {
      Text('父子树（firstSubtree）')
        .fontSize(14)
        .fontColor('#1A66FF')
        .margin({ bottom: 8 })

      ForEach(this.rows, (item: RowItem) => {
        Row() {
          Text(item.title).fontSize(15).fontWeight(FontWeight.Medium)
          Text(item.desc).fontSize(12).fontColor('#8A8F99').margin({ left: 8 })
        }
        .width('100%')
        .padding(10)
        .backgroundColor('#E8F0FF')
        .borderRadius(6)
        .margin({ bottom: 6 })
        // 档1/档2：行 weight=1 迫使父子树吃满受限空间；档3：不在此撑满
        .layoutWeight(this.scene === DemoScene.Fixed ? 0 : 1)
      }, (item: RowItem) => item.title)
    }
    .width('100%')
    .padding(10)
    .backgroundColor(Color.White)
    .borderRadius(8)
    // 修复：父子树改为兄弟级 weight，与叔子树公平分配
    .layoutWeight(this.scene === DemoScene.Fixed ? 1 : 0)
  }

  // 叔子树：明细区
  @Builder
  secondSubtree() {
    Column() {
      Text('叔子树（secondSubtree · 明细）')
        .fontSize(14)
        .fontColor('#1A66FF')
        .margin({ bottom: 8 })

      if (!this.detailCollapsed) {
        ForEach(this.details, (item: RowItem) => {
          Row() {
            Text(item.title).fontSize(15).fontWeight(FontWeight.Medium)
            Text(item.desc).fontSize(12).fontColor('#8A8F99').margin({ left: 8 })
          }
          .width('100%')
          .padding(10)
          .backgroundColor('#FFF2E8')
          .borderRadius(6)
          .margin({ bottom: 6 })
        }, (item: RowItem) => item.title)
      } else {
        // 折叠态哨兵：固定高度，用于验证分支是否被整体裁剪
        Text('明细已折叠')
          .fontSize(12)
          .fontColor('#8A8F99')
          .height(16)
      }
    }
    .width('100%')
    .padding(10)
    .backgroundColor(Color.White)
    .borderRadius(8)
    .border({ width: 2, color: '#1F8A3B' })
    .margin({ top: 10 })
    // 档1 weight=0（优先占位→挤出）；档2/档3 weight=1（瓜分剩余空间）
    .layoutWeight(this.uncleWeight())
    // 仅修复档提供最小高度兜底（constraintSize 优先级高于 width/height）
    .constraintSize(this.scene === DemoScene.Fixed ? { minHeight: 120 } : {})
    // 上报叔子树实际测量高度：档1>0（被挤出），档2≈0（真压缩）
    .onAreaChange((_: Area, newArea: Area) => {
      this.detailMeasuredHeight = Number(newArea.height);
    })
  }
}
