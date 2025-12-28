# OpenCV TypeScript 项目

这是一个使用 TypeScript 和 OpenCV.js 的项目。

## 项目结构

```
openCV/
├── src/
│   └── index.ts          # 主入口文件
├── dist/                 # 编译输出目录
├── package.json          # 项目配置
├── tsconfig.json         # TypeScript 配置
└── README.md            # 项目说明
```

## 可用命令

- `npm run build` - 编译 TypeScript 代码
- `npm start` - 运行编译后的代码
- `npm run dev` - 直接运行 TypeScript 代码（开发模式）

## 依赖

- **@techstark/opencv-js**: OpenCV JavaScript 绑定
- **typescript**: TypeScript 编译器
- **ts-node**: 直接运行 TypeScript 文件

## 开始使用

1. 安装依赖：`npm install`
2. 编译项目：`npm run build`
3. 运行项目：`npm start`

或者直接运行开发模式：`npm run dev`