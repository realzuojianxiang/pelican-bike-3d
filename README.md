# 🐦 鹈鹕骑自行车 · 3D

一个纯程序化生成的 Three.js 3D 场景：一只鹈鹕在骑自行车。

## 技术亮点（能力全开）
- **Three.js (r160)** 通过 jsDelivr CDN + Import Map 加载，无需构建步骤
- **程序化几何建模**：自行车（车架/车轮/辐条/曲柄/脚踏/座垫）与鹈鹕（身体/头颈/喙+喉囊/双眼/双翼/双腿）全部由代码生成
- **实时骨架动画**：骑行时车轮转动、曲柄相位差 180° 联动、双脚实时贴合踏板、身体随踏频起伏、翅膀扇动、头部微摆
- **程序化环境光照**：`RoomEnvironment` → `PMREMGenerator` 提供真实反射
- **真实感渲染**：`ACESFilmicToneMapping` + `PCFSoftShadowMap` 软阴影 + 半球光/平行光/轮廓光三点布光 + 雾
- **CanvasTexture 渐变天空**，支持昼夜切换
- **轨道相机控制** (`OrbitControls`)：拖拽旋转 / 滚轮缩放 / 右键平移 / 自动环绕
- **控制面板**：骑行速度、自动环绕、扇翅膀、昼夜切换、性能模式
- **FPS 计数器**、响应式布局、WebGL 容错降级

## 本地预览
```bash
# 任意静态服务器即可（需联网加载 CDN 上的 three.js）
python -m http.server 8080
# 打开 http://localhost:8080
```

## CDN 访问
通过 jsDelivr 直接渲染：
- 主页面：`https://cdn.jsdelivr.net/gh/<owner>/<repo>@main/index.html`
