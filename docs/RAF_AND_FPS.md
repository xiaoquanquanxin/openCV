# requestAnimationFrame 与实际帧率

解释 `requestAnimationFrame` 的工作原理以及为什么实际帧率可能低于显示器刷新率。

---

## ❓ 常见误解

### 误解 1: "requestAnimationFrame 保证 60 FPS"
❌ **错误**

✅ **正确**: `requestAnimationFrame` 只是在浏览器准备重绘时调用回调，**不保证你的代码能在刷新间隔内执行完**。

---

### 误解 2: "40ms/帧 = 25 FPS 是固定的"
❌ **错误**

✅ **正确**: 40ms 是**算法处理耗时的估算值**，实际耗时取决于硬件性能、浏览器、视频分辨率等因素。

---

## 🎬 requestAnimationFrame 工作原理

### 浏览器的渲染循环

```javascript
// 浏览器内部（伪代码）
function browserMainLoop() {
  while (true) {
    // 1. 等待垂直同步信号（VSync）
    waitForVSync();  // 60Hz 显示器 → 每 16.67ms

    // 2. 执行所有 requestAnimationFrame 回调
    while (rafCallbacks.length > 0) {
      const callback = rafCallbacks.shift();
      callback(timestamp);  // 执行你的代码
    }

    // 3. 重新计算布局
    recalculateLayout();

    // 4. 绘制到屏幕
    paint();
  }
}
```

**关键点**：
- VSync 信号间隔固定（60Hz = 16.67ms）
- 但你的回调执行时间**不受控制**
- 如果回调执行太久，会**延迟下一次渲染**

---

## ⏱️ 三种时间概念

### 1. **显示器刷新率** (硬件)
```
60Hz 显示器: 16.67ms/帧
120Hz 显示器: 8.33ms/帧
144Hz 显示器: 6.94ms/帧
```
这是显示器的物理刷新速度，固定不变。

---

### 2. **浏览器重绘间隔** (软件)
```
通常与显示器刷新率同步:
- 60Hz → 约 16.67ms 调用一次 requestAnimationFrame
- 120Hz → 约 8.33ms 调用一次
```
浏览器尽量同步显示器刷新率，但不保证。

---

### 3. **算法处理耗时** (你的代码)
```
本项目估算: 40ms
- 光流跟踪: 15ms
- 透视变换: 5ms
- 前景检测: 6ms
- Alpha 混合: 10ms
- 其他: 4ms
```
这是 CPU/GPU 执行你的算法需要的时间。

---

## 📊 实际帧率计算

### 公式
```
实际 FPS = 1000ms / max(处理耗时, 刷新间隔)
```

### 示例场景

#### 场景 1: 快速处理（理想情况）
```
显示器: 60Hz (16.67ms/帧)
处理耗时: 10ms

时间轴:
0ms      16.67ms   33.34ms   50ms
│────────│────────│────────│
│处理 10ms│处理 10ms│处理 10ms│
└────┘   └────┘   └────┘
  ▲         ▲         ▲
  渲染      渲染      渲染

实际 FPS = 1000 / 16.67 = 60 FPS ✅
```

**结论**: 处理快，跟上刷新率，达到 60 FPS。

---

#### 场景 2: 慢速处理（本项目当前情况）
```
显示器: 60Hz (16.67ms/帧)
处理耗时: 40ms

时间轴:
0ms      16.67ms   33.34ms   40ms     56.67ms
│────────│────────│────────│────────│
│    处理 40ms     │    处理 40ms     │
└──────────────────┘└──────────────────┘
  ▲ VSync VSync       ▲ VSync VSync
  渲染(跳过1帧)        渲染(跳过1帧)

实际 FPS = 1000 / 40 = 25 FPS ⚠️
```

**结论**: 处理慢，跟不上刷新率，**跳帧**，实际只有 25 FPS。

---

#### 场景 3: 非常慢处理
```
显示器: 60Hz (16.67ms/帧)
处理耗时: 100ms

时间轴:
0ms   16.67ms 33.34ms 50ms  66.67ms 83.34ms 100ms
│─────│─────│─────│─────│─────│─────│
│          处理 100ms          │          处理 100ms
└──────────────────────────────┘
  ▲ VSync VSync VSync VSync VSync
  渲染 (跳过 5 帧)

实际 FPS = 1000 / 100 = 10 FPS ❌
```

**结论**: 严重卡顿，用户体验很差。

---

## 🔍 如何查看实际帧率？

### 方法 1: 代码内 FPS 计数器（已实现）
```typescript
// 每秒更新一次
if (now - lastFpsUpdate >= 1000) {
  currentFps = frameCount;
  frameCount = 0;
  lastFpsUpdate = now;
}
```

**显示位置**: 控制按钮旁边的绿色数字

---

### 方法 2: 浏览器开发者工具
1. 打开 Chrome DevTools (`F12`)
2. 点击 Performance 面板
3. 点击 Record，操作一段时间，停止
4. 查看 FPS 曲线

**优势**: 能看到详细的性能瓶颈

---

### 方法 3: Chrome 内置 FPS 显示
1. `Ctrl+Shift+P` 打开命令面板
2. 输入 "Show frames per second"
3. 右上角会显示实时 FPS

**优势**: 最简单直观

---

## 📉 为什么文档中说"40ms/帧"？

### 我的表述不够准确

之前在 `docs/ALGORITHMS.md` 中写的：
> "总耗时（启用前景检测）：~40ms/帧 → 最大 25 FPS"

**应该改为**：
> "总耗时（启用前景检测）：~40ms → 实际帧率约 25 FPS"

**区别**：
- ❌ "40ms/帧" → 容易误解为"每帧间隔 40ms"
- ✅ "40ms 处理耗时" → 明确是算法执行时间

---

## 🎯 正确的理解

### requestAnimationFrame 的承诺
```
✅ 保证: 在浏览器下一次重绘前调用你的回调
✅ 保证: 避免在标签页不可见时执行（节能）
❌ 不保证: 你的代码能在刷新间隔内完成
❌ 不保证: 固定的调用频率（取决于显示器）
```

### 实际帧率的决定因素
```
实际 FPS = min(
  显示器刷新率,
  1000 / 算法处理耗时
)
```

**例子**：
| 显示器 | 处理耗时 | 理论最大 FPS | 实际 FPS |
|--------|---------|-------------|----------|
| 60Hz   | 10ms    | 60          | **60** ✅ |
| 60Hz   | 40ms    | 25          | **25** ⚠️ |
| 120Hz  | 10ms    | 100         | **100** ✅ |
| 120Hz  | 40ms    | 25          | **25** ⚠️ |
| 144Hz  | 10ms    | 100         | **100** ✅ |

**观察**：
- 即使是 144Hz 显示器，如果处理慢（40ms），也只有 25 FPS
- 只有处理耗时 < 刷新间隔，才能达到刷新率上限

---

## 🚀 如何提升帧率？

### 目标：将处理耗时从 40ms 降到 < 16.67ms（60 FPS）

### 1. 降低视频分辨率
```typescript
// 当前: 854×480
this.canvas.width = 854;
this.canvas.height = 480;

// 优化: 降低到 640×360
this.canvas.width = 640;
this.canvas.height = 360;

预期提升: 40ms → 25ms (+15 FPS)
```

---

### 2. 减少特征点数量
```typescript
// 当前: 100 个点
cv.goodFeaturesToTrack(frame, features, 100, ...);

// 优化: 50 个点
cv.goodFeaturesToTrack(frame, features, 50, ...);

预期提升: 15ms → 8ms (光流部分)
```

---

### 3. 降低光流金字塔层数
```typescript
// 当前: 3 层
cv.calcOpticalFlowPyrLK(..., maxLevel: 3, ...);

// 优化: 2 层
cv.calcOpticalFlowPyrLK(..., maxLevel: 2, ...);

预期提升: 15ms → 12ms
```

---

### 4. 简化前景检测
```typescript
// 关闭前景检测
renderer.setConfig({ useForegroundDetection: false });

预期提升: 40ms → 34ms
```

---

### 5. 使用 WebAssembly SIMD（高级）
OpenCV.js 可以编译启用 SIMD 指令集，加速向量运算。

预期提升: **2-3 倍速度**

---

### 6. GPU 加速（WebGL）
使用 WebGL 着色器处理像素级操作。

预期提升: Alpha 混合从 10ms → < 1ms

---

## 📊 性能对比表

| 优化方案 | 处理耗时 | 实际 FPS | 画质损失 |
|---------|---------|---------|---------|
| 当前配置 | 40ms | 25 FPS | 无 |
| 降分辨率 640×360 | 25ms | 40 FPS | 中 |
| 减少特征点 50 | 32ms | 31 FPS | 低 |
| 关闭前景检测 | 34ms | 29 FPS | 无（功能减少）|
| 金字塔 2 层 | 37ms | 27 FPS | 低 |
| **组合优化** | **15ms** | **60 FPS** ✅ | 中 |

**组合优化**：分辨率 640×360 + 特征点 50 + 金字塔 2 层

---

## 💡 总结

### 核心要点

1. **requestAnimationFrame ≠ 保证 60 FPS**
   - 它只是在浏览器准备重绘时调用你
   - 实际帧率取决于你的代码执行速度

2. **40ms 是处理耗时，不是帧间隔**
   - 处理耗时 40ms → 最多 25 FPS
   - 要达到 60 FPS，需要 < 16.67ms

3. **性能瓶颈是算法，不是 requestAnimationFrame**
   - 光流跟踪占 37.5%
   - Alpha 混合占 25%
   - 这两个是优化重点

4. **可以实时查看 FPS**
   - UI 右上角显示实际帧率
   - 调整参数时能立即看到性能影响

### 推荐阅读

- [MDN: requestAnimationFrame](https://developer.mozilla.org/en-US/docs/Web/API/window/requestAnimationFrame)
- [HTML5 Rocks: requestAnimationFrame for Smart Animating](https://www.html5rocks.com/en/tutorials/speed/animations/)
- [Chrome DevTools Performance Profiling](https://developer.chrome.com/docs/devtools/performance/)

---

**文档版本**: v1.1.0
**最后更新**: 2026-01-02
