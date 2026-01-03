import { Point, MarkingState } from '../types';

export class MarkingUI {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: MarkingState = {
    points: [],
    isComplete: false,
    isMarking: false
  };
  private clickHandler: ((event: MouseEvent) => void) | null = null;

  public onComplete?: (points: Point[]) => void;

  constructor(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
    this.canvas = canvas;
    this.ctx = ctx;
  }

  startMarking(): void {
    // 强制重置状态
    this.forceReset();

    this.state.isMarking = true;
    this.canvas.style.cursor = 'crosshair';

    // 创建新的点击处理器
    this.clickHandler = this.handleClick.bind(this);
    this.canvas.addEventListener('click', this.clickHandler);
  }

  private handleClick(event: MouseEvent): void {
    if (!this.state.isMarking || this.state.points.length >= 4) return;

    const rect = this.canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    this.state.points.push({ x, y });

    if (this.state.points.length === 4) {
      this.state.isComplete = true;
      this.state.isMarking = false;
      this.canvas.style.cursor = 'default';
      this.removeClickListener();
      this.onComplete?.(this.state.points);
    }

    this.drawMarkers();
  }

  drawMarkers(): void {
    // 绘制标记点
    this.ctx.fillStyle = 'rgba(255, 0, 0, 0.5)';
    this.ctx.strokeStyle = 'red';
    this.ctx.lineWidth = 2;

    this.state.points.forEach((p, i) => {
      this.ctx.beginPath();
      this.ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      // 绘制编号
      this.ctx.fillStyle = 'white';
      this.ctx.font = '12px Arial';
      this.ctx.fillText(`${i + 1}`, p.x - 4, p.y + 4);
    });

    // 绘制连线
    if (this.state.points.length > 1) {
      this.ctx.strokeStyle = 'yellow';
      this.ctx.setLineDash([5, 5]);
      this.ctx.beginPath();
      this.ctx.moveTo(this.state.points[0].x, this.state.points[0].y);
      for (let i = 1; i < this.state.points.length; i++) {
        this.ctx.lineTo(this.state.points[i].x, this.state.points[i].y);
      }
      if (this.state.points.length === 4) {
        this.ctx.closePath();
      }
      this.ctx.stroke();
      this.ctx.setLineDash([]);
    }

    // 完成后绘制区域
    if (this.state.isComplete) {
      this.ctx.fillStyle = 'rgba(0, 255, 0, 0.2)';
      this.ctx.beginPath();
      this.ctx.moveTo(this.state.points[0].x, this.state.points[0].y);
      for (let i = 1; i < 4; i++) {
        this.ctx.lineTo(this.state.points[i].x, this.state.points[i].y);
      }
      this.ctx.closePath();
      this.ctx.fill();
    }
  }

  private removeClickListener(): void {
    if (this.clickHandler) {
      this.canvas.removeEventListener('click', this.clickHandler);
      this.clickHandler = null;
    }
  }

  // 强制重置 - 彻底清空所有数据
  forceReset(): void {
    // 移除事件监听器
    this.removeClickListener();

    // 强制清空状态
    this.state = {
      points: [],
      isComplete: false,
      isMarking: false
    };

    this.canvas.style.cursor = 'default';
  }

  reset(): void {
    this.forceReset();
  }

  getMarkedPoints(): Point[] {
    return [...this.state.points]; // 返回副本
  }
}
