# 开发日志

记录项目从零到一的完整开发过程、遇到的问题及解决方案。

---

## 2026-01-02 - 项目启动与完成 v1.0.0

### 🎯 初始需求
用户希望实现类似 NBA 赛事转播中的**动态广告牌替换**技术：
- 识别视频中的特定区域（广告牌）
- 手动标记 4 个角点
- 实时跟踪该区域
- 将自定义广告图片透视变换后贴合到该区域

### 📊 初始状态
项目只有一个简单的演示代码（79 行），功能是在固定位置 (20, 20) 叠加广告图片。

---

## 第一阶段：核心功能实现

### Step 1: 标记 UI 模块
**实现内容**：
- 创建 `types.ts` - 定义 Point、MarkingState 等类型
- 创建 `state.ts` - 状态管理器
- 创建 `markingUI.ts` - 4 点标记交互系统
- 修改 `index.html` - 添加控制按钮和说明

**技术要点**：
- Canvas 点击事件监听
- 实时绘制标记点、连线、高亮区域
- 完成后回调机制

### Step 2: 光流跟踪
**实现内容**：
- 创建 `tracker.ts` - 光流跟踪器
- 集成到 `main.ts`

**核心算法**：
```typescript
cv.goodFeaturesToTrack()        // 特征点检测
cv.calcOpticalFlowPyrLK()       // Lucas-Kanade 光流
```

**技术细节**：
- 在每个角点周围 30px 半径内检测 100 个特征点
- 使用 Pyramidal LK 算法跟踪特征点移动
- 计算所有成功跟踪点的平均偏移量
- 应用偏移到 4 个角点
- 3 帧移动平均平滑，减少抖动

**参数配置**：
- 光流窗口: 21x21
- 金字塔层数: 3
- 终止条件: 30 次迭代 or 误差 < 0.01

### Step 3: 透视变换
**实现内容**：
- 创建 `transform.ts` - 透视变换模块

**核心算法**：
```typescript
cv.getPerspectiveTransform(srcPoints, dstPoints)  // 计算变换矩阵
cv.warpPerspective(adMat, warped, M, dsize)      // 执行变换
```

**技术要点**：
- 将广告图片的 4 个角映射到跟踪的 4 个角点
- 边界检查：至少 3 个角点在画面内才执行变换

### Step 4: 渲染优化
**实现内容**：
- 创建 `renderer.ts` - 独立渲染模块
- 实现 Alpha 通道混合

**渲染逻辑**：
```typescript
// 像素级 Alpha 融合
for (let i = 0; i < rows; i++) {
  for (let j = 0; j < cols; j++) {
    const alpha = warpedAd.ucharPtr(i, j)[3] / 255.0;
    if (alpha > 0.1) {
      for (let c = 0; c < 3; c++) {
        result.ucharPtr(i, j)[c] =
          videoPixel[c] * (1 - alpha) + adPixel[c] * alpha;
      }
    }
  }
}
```

---

## 遇到的关键问题及解决方案

### ❌ 问题 1: `cv.Mat is not a constructor`
**现象**：transform.initialize() 调用 cv.imread() 时报错

**原因**：OpenCV.js 异步加载，广告图片的 onload 可能在 cv.Mat 构造函数可用之前触发

**解决方案**：
```typescript
function onOpenCvReady() {
  const cv = (window as any).cv;
  if (!cv || typeof cv.Mat !== 'function') {
    setTimeout(onOpenCvReady, 100);  // 等待 cv.Mat 可用
    return;
  }
  // 现在安全加载广告图片
  app.loadResources();
}
```

### ❌ 问题 2: 重置按钮保留之前的点
**现象**：点击重置后，再次标记时会记住之前的点

**原因**：事件监听器没有正确移除

**解决方案**：
```typescript
private clickHandler: ((event: MouseEvent) => void) | null = null;

startMarking(): void {
  this.clickHandler = this.handleClick.bind(this);
  this.canvas.addEventListener('click', this.clickHandler);
}

private removeClickListener(): void {
  if (this.clickHandler) {
    this.canvas.removeEventListener('click', this.clickHandler);
    this.clickHandler = null;
  }
}

forceReset(): void {
  this.removeClickListener();  // 强制移除监听器
  // 清空所有状态...
}
```

### ❌ 问题 3: 跟踪初始化但广告不显示
**现象**：控制台显示跟踪成功，但画面没有广告

**调试过程**：
1. 添加边界检查日志 → 发现边界检查通过
2. 添加透视变换日志 → 发现 warpedAd 为 null
3. 发现 transform.adMat 未初始化

**根本原因**：资源加载时序混乱，transform 在广告图片加载完成前就被调用

**解决方案**：引入资源管理系统（见第二阶段）

---

## 第二阶段：架构重构

### 🏗️ 用户反馈
> "我也是开发者，我是不会犯这种错的。要什么资源都提前准备好...如果将来不止一个广告了？得有广告和'块'的对应关系。"

> "删除没用的 console，重置按钮的逻辑还是不对，就很强硬的把数据清空就行了。"

### 重构目标
1. ✅ 支持 n 个广告 → n 个区域的映射关系
2. ✅ 统一的资源管理
3. ✅ 清理所有调试日志
4. ✅ 彻底的强制重置机制

### 新增模块

#### `resourceManager.ts` - 资源管理器
```typescript
export class ResourceManager {
  private adSources: Map<string, AdSource> = new Map();

  async loadAdImage(id: string, url: string): Promise<AdSource> {
    // 异步加载广告图片
    // 存储到 Map 中
  }

  getAdSource(id: string): AdSource | undefined {
    return this.adSources.get(id);
  }
}
```

**职责**：
- 预加载所有广告资源
- 统一管理广告资源的生命周期

#### `placementManager.ts` - 广告位管理器
```typescript
export class PlacementManager {
  private placements: Map<string, AdPlacement> = new Map();
  private trackers: Map<string, Tracker> = new Map();
  private transforms: Map<string, Transform> = new Map();

  addPlacement(placement: AdPlacement): void {
    // 添加新的广告位
  }

  initializeTracking(id, corners, frame): void {
    const tracker = new Tracker(this.cv);
    tracker.initialize(corners, frame);
    this.trackers.set(id, tracker);
  }

  forceReset(): void {
    // 清理所有跟踪器和变换器
    this.trackers.forEach(t => t.cleanup());
    this.trackers.clear();
    this.transforms.clear();
    this.placements.clear();
  }
}
```

**职责**：
- 管理多个广告位（AdPlacement）
- 为每个广告位创建独立的 Tracker 和 Transform
- 维护 AdPlacement ↔ Tracker ↔ Transform 的映射关系

#### 数据模型设计
```typescript
// 广告资源
export interface AdSource {
  id: string;
  type: 'image' | 'video';
  element: HTMLImageElement | HTMLVideoElement;
  url: string;
}

// 广告位（标记区域）
export interface AdPlacement {
  id: string;
  adId: string;        // 关联到哪个广告
  corners: Point[];    // 4 个角点
  isActive: boolean;
}

// 应用配置
export interface AppConfig {
  videoUrl: string;
  videoSize: { width: number; height: number };
  ads: {
    id: string;
    url: string;
    type: 'image' | 'video';
  }[];
}
```

### 重写 `main.ts`
**核心改进**：
```typescript
class VideoAdReplacer {
  private resourceManager: ResourceManager;
  private placementManager: PlacementManager;

  private config: AppConfig = {
    videoUrl: '/assets/videos/stock.mp4',
    videoSize: { width: 854, height: 480 },
    ads: [
      { id: 'ad1', url: '/assets/images/ad-image.png', type: 'image' }
      // 可添加更多广告
    ]
  };

  async loadResources(): Promise<void> {
    // 预加载所有广告
    for (const ad of this.config.ads) {
      await this.resourceManager.loadAdImage(ad.id, ad.url);
    }
  }

  // 标记完成后
  this.markingUI.onComplete = (corners) => {
    const placement: AdPlacement = {
      id: 'placement-' + Date.now(),
      adId: 'ad1',  // 指定使用哪个广告
      corners,
      isActive: true
    };
    this.placementManager.addPlacement(placement);
    this.startTracking(placement.id);
  };

  // 重置按钮
  resetBtn.addEventListener('click', () => {
    this.placementManager.forceReset();  // 强制清空
    this.markingUI.forceReset();
    this.stateManager.forceReset();
  });
}
```

### 代码清理
**删除的调试日志**：
- ❌ tracker.ts 中的所有 console.log
- ❌ transform.ts 中的初始化日志
- ❌ renderer.ts 中的调试计数器
- ❌ main.ts 中的详细帧日志
- ✅ **仅保留**: 资源加载失败的错误日志

---

## 技术亮点

### 1. 内存管理
OpenCV.js 使用 Emscripten 编译，Mat 对象需要手动释放：
```typescript
const mat = cv.imread(canvas);
// ... 使用 mat
mat.delete();  // 必须手动删除，否则内存泄漏
```

所有模块都实现了 `cleanup()` 方法来清理资源。

### 2. 跟踪稳定性
- **特征点分布**：在 4 个角点周围均匀检测特征
- **运动估计**：使用所有成功跟踪点的平均偏移，而非单点跟踪
- **时间平滑**：3 帧移动平均，抑制单帧噪声
- **失败检测**：连续失败 5 帧才判定丢失，避免误报

### 3. 透视变换精度
使用 `cv.getPerspectiveTransform()` 计算精确的单应性矩阵（Homography），能够处理：
- 平移
- 旋转
- 缩放
- 透视畸变

### 4. 渲染性能
- 使用 `requestAnimationFrame` 同步浏览器刷新率
- 及时释放 Mat 对象减少 GC 压力
- Alpha 融合仅处理非透明像素（alpha > 0.1）

---

## 当前限制与未来方向

### 当前限制
1. **手动标记**：需要用户手动标记 4 个角点
2. **单广告位**：UI 暂时只支持标记一个广告位（架构已支持多个）
3. **跟踪丢失**：丢失后需要重新标记，无自动恢复
4. **无视频导出**：只能实时预览，不支持导出处理后的视频

### 未来优化方向
- [ ] **自动检测**：使用边缘检测 + Hough 变换自动识别矩形广告牌
- [ ] **多广告位 UI**：支持同时标记和跟踪多个区域
- [ ] **跟踪恢复**：丢失后尝试在附近区域重新检测特征
- [ ] **视频导出**：使用 MediaRecorder API 或 FFmpeg.wasm
- [ ] **性能优化**：
  - 使用 WebAssembly SIMD 加速
  - GPU 加速（WebGL）
  - 降采样处理（1/2 或 1/4 分辨率）
- [ ] **高级功能**：
  - 视频广告支持
  - 动态广告（动画、过渡效果）
  - 遮挡检测（检测广告牌被遮挡的部分）

---

## 开发总结

### 技术栈选择合理性
✅ **OpenCV.js**：提供了完整的计算机视觉算法，无需从头实现
✅ **TypeScript**：类型安全避免了大量运行时错误
✅ **Vite**：快速的开发体验
✅ **模块化架构**：清晰的职责划分，易于维护和扩展

### 开发体验
- **快速迭代**：4 个主要阶段，每个阶段都有可验证的效果
- **问题驱动**：遇到问题 → 调试 → 重构 → 优化
- **用户反馈及时**：根据用户（开发者）的专业反馈进行了架构重构

### 学到的经验
1. **异步资源加载**：必须严格控制加载顺序和依赖关系
2. **事件监听器管理**：一定要保存引用，确保能正确移除
3. **OpenCV.js 内存管理**：手动 delete() 是必须的
4. **架构设计**：提前考虑扩展性（如 n-to-n 映射）比后期重构成本低

---

## 版本记录

### v1.0.0 (2026-01-02)
- ✅ 完整的视频广告替换功能
- ✅ 光流跟踪 + 透视变换
- ✅ 模块化架构
- ✅ 资源管理和广告位管理系统
- ✅ 强制重置机制
- ✅ 完整的项目文档
