/**
 * 主题配置入口 — 颜色变量 / 自定义 token
 *
 * 对应 08-技术选型与架构方案 v3.6 §12.10 四色同步 + 09-LobeHub生态集成方案 附录 B
 *
 * v0.1 Phase 0.7.2: 仅提供 UI 层 token,Monaco/LobeEditor/xterm 同步在 Phase 1+ 实现。
 */
import type { ThemeConfig } from 'antd';

/** OpenCoding 自定义 token (注入到 ThemeProvider 的 customToken) */
export const opencodeToken = {
  // 布局尺寸
  headerHeight: 40,
  contextBarHeight: 36,
  leftSidebarWidth: 240,
  leftSidebarCollapsedWidth: 48,
  rightPanelWidth: 360,
  inputEditorMinHeight: 160,
  inputEditorMaxHeight: 400,

  // 颜色 (跟随 @lobehub/ui 主题,这里仅放品牌色)
  brandColor: '#2c6fbb',
  brandColorHover: '#3a82cc',

  // 边框
  borderColor: 'rgba(255, 255, 255, 0.08)',
} as const;

/** antd 主题覆盖 (最小化,v0.1 只调圆角与字体) */
export const antdTheme: ThemeConfig = {
  token: {
    borderRadius: 6,
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
    fontSize: 13,
  },
  components: {
    Layout: {
      headerBg: 'transparent',
      bodyBg: 'transparent',
      siderBg: 'transparent',
    },
  },
};
