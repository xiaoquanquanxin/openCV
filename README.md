# 视频广告牌动态替换系统

类似 NBA 赛事转播的动态广告牌替换技术 - 使用 OpenCV.js 实现实时视频广告替换

## 📋 项目目标

实现一个能够在视频中**动态替换广告牌内容**的系统，功能类似于 NBA 等体育赛事转播中看到的场边广告动态替换技术。

### 核心功能
- ✅ 用户手动标记视频中广告牌的 4 个角点
- ✅ 使用光流法实时跟踪广告牌位置
- ✅ 透视变换使广告自动适配广告牌角度和形状
- ✅ 处理摄像机移动、角度变化等复杂场景
- ✅ 支持多个广告牌和多个广告的映射关系
- ✅ 完整的资源管理和状态管理

## 🎯 当前进度

### ✅ 已完成
1. **模块化架构** - 完整的分层架构设计
2. **角点标记系统** - 交互式 4 点标记 UI
3. **光流跟踪** - 基于 Lucas-Kanade 的实时跟踪
4. **透视变换** - 广告图像自适应贴合
5. **Alpha 融合渲染** - 自然的广告叠加效果
6. **资源管理系统** - 支持多广告资源预加载
7. **广告位管理** - 支持 n 个广告到 n 个区域的映射
8. **强制重置机制** - 完全清空状态和事件监听器
9. **前景检测** - 基于运动检测规避运动员
10. **双模式渲染** - 实时预览 + 离线导出 ⭐
11. **原分辨率导出** - 自动检测原视频分辨率和帧率 🆕

### 🚧 待优化
- [ ] 多广告牌同时跟踪（架构已支持，UI 待完善）
- [ ] 跟踪丢失后的自动重检测
- [ ] 更智能的特征点选择策略
- [x] ~~视频导出功能~~ ✅ 已完成
- [ ] Web Workers 多线程加速
- [ ] FFmpeg.wasm 编码支持（MP4 格式）

## 🏗️ 技术架构

### 核心技术栈
- **OpenCV.js 4.x** - 计算机视觉库
- **TypeScript** - 类型安全的开发
- **Vite** - 快速开发和构建
- **HTML5 Canvas** - 视频渲染

### 关键算法
1. **光流跟踪** - `cv.calcOpticalFlowPyrLK()`
   - 金字塔 Lucas-Kanade 算法
   - 在每个角点周围检测 100 个特征点
   - 3 帧移动平均平滑

2. **透视变换** - `cv.getPerspectiveTransform()` + `cv.warpPerspective()`
   - 从 4 个角点计算变换矩阵
   - 将广告图像投影到跟踪区域

3. **特征检测** - `cv.goodFeaturesToTrack()`
   - Shi-Tomasi 角点检测
   - 在标记区域内选择最佳特征点

4. **前景检测** - 帧差法 + 形态学处理 🆕
   - 运动检测规避运动员
   - 可调参数实时优化

📖 **详细算法文档**：
- [完整算法清单](docs/ALGORITHMS.md) - 所有算法的详细说明、数学原理、性能分析
- [算法执行流程](docs/ALGORITHM_FLOW.md) - 可视化流程图、时序图、伪代码
- [前景检测调试指南](docs/FOREGROUND_DETECTION.md) - 参数调优和使用场景
- [双模式渲染架构](docs/DUAL_MODE_RENDERING.md) - 预览 vs 导出的设计思路
- [性能分析与优化](docs/PERFORMANCE.md) - CPU/GPU 使用情况、瓶颈分析、优化建议 🆕

## 📁 项目结构

```
openCV/
├── src/
│   ├── main.ts                    # 主应用入口
│   ├── types.ts                   # 类型定义
│   └── modules/
│       ├── resourceManager.ts     # 资源管理（广告加载）
│       ├── placementManager.ts    # 广告位管理
│       ├── markingUI.ts          # 角点标记 UI
│       ├── tracker.ts            # 光流跟踪器
│       ├── transform.ts          # 透视变换
│       ├── renderer.ts           # 渲染器
│       └── state.ts              # 状态管理
├── assets/
│   ├── videos/
│   │   └── stock.mp4             # 测试视频
│   └── images/
│       └── ad-image.png          # 广告图片
├── index.html                     # 主页面
└── package.json
```

## 🚀 快速开始

### 安装依赖
```bash
npm install
```

### 启动开发服务器
```bash
npm run dev
```

### 构建生产版本
```bash
npm run build
npm run preview
```

## 📖 使用说明

### 基本流程
1. **等待系统就绪** - 页面显示 "✓ 已就绪" 后可以开始
2. **点击"开始标记"** - 视频会暂停在第一帧
3. **标记 4 个角点** - 按顺序点击广告牌的四个角：
   - 左上角
   - 右上角
   - 右下角
   - 左下角
4. **自动开始跟踪** - 标记完成后视频自动播放，广告开始替换
5. **点击"重置"** - 清空所有标记和跟踪状态

### 配置多个广告
在 `src/main.ts` 中修改配置：

```typescript
private config: AppConfig = {
  videoUrl: '/assets/videos/stock.mp4',
  videoSize: { width: 854, height: 480 },
  ads: [
    { id: 'ad1', url: '/assets/images/ad-image.png', type: 'image' },
    { id: 'ad2', url: '/assets/images/another-ad.png', type: 'image' },
    // 添加更多广告...
  ]
};
```

## 🧩 核心模块说明

### ResourceManager
负责所有广告资源的加载和管理
- `loadAdImage(id, url)` - 异步加载广告图片
- `getAdSource(id)` - 获取已加载的广告资源
- `clearAll()` - 清空所有资源

### PlacementManager
管理广告位（placement）及其对应的跟踪器和变换器
- `addPlacement(placement)` - 添加新的广告位
- `initializeTracking(id, corners, frame)` - 初始化跟踪器
- `initializeTransform(id, adElement, width, height)` - 初始化变换器
- `forceReset()` - 强制清空所有数据

### Tracker
光流跟踪器
- `initialize(corners, firstFrame)` - 初始化特征点
- `track(currentFrame)` - 跟踪当前帧，返回更新后的角点
- `cleanup()` - 清理 OpenCV Mat 资源

### Transform
透视变换
- `initialize(config)` - 加载广告图像
- `warpAd(corners)` - 执行透视变换，返回变形后的广告
- `cleanup()` - 清理资源

### Renderer
渲染器
- `render(videoFrame, warpedAd)` - Alpha 融合渲染

## ⚙️ 技术细节

### 跟踪参数
- **特征点数量**: 100 个
- **检测半径**: 30px（每个角点周围）
- **光流窗口**: 21x21
- **金字塔层数**: 3
- **平滑帧数**: 3 帧移动平均

### 跟踪失败检测
- 成功率 < 50% 时标记为可能丢失
- 连续 5 帧失败后确认跟踪丢失

### 边界检查
- 至少 3 个角点在画面内才执行透视变换
- 超出边界时跳过当前帧

## 🔧 开发说明

### 添加新的广告位
当前系统支持架构层面的多广告位，要启用 UI 支持：
1. 修改 `markingUI.ts` 支持选择当前标记对应的广告
2. 在 `main.ts` 中的 `onComplete` 回调里根据用户选择设置 `adId`
3. 更新渲染逻辑支持渲染多个广告位

### 调试模式
在 `renderer.ts` 中可以启用跟踪框显示：
```typescript
this.renderer.setShowTrackingBox(true);
```

## 📝 版本历史

### v1.0.0 (当前版本)
- ✅ 完整的单广告牌跟踪和替换功能
- ✅ 模块化架构设计
- ✅ 资源管理和状态管理系统
- ✅ 强制重置机制

## 🤝 贡献

这是一个学习和实验性项目，展示了计算机视觉技术在实际场景中的应用。

## 📄 许可

MIT License
