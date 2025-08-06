import { LogoPosition } from '@/app/types/bulk-video';

export interface LogoConfig {
  position: LogoPosition;
  width: number;
  height: number;
  padding?: number;
}

export interface VideoSize {
  width: number;
  height: number;
}

export function calculateLogoPosition(
  position: LogoPosition,
  logoSize: { width: number; height: number },
  videoSize: VideoSize,
  padding: number = 20
): { x: number; y: number } {
  const { width: lw, height: lh } = logoSize;
  const { width: vw, height: vh } = videoSize;

  switch (position) {
    case 'top-left':
      return { x: padding, y: padding };
    
    case 'top-right':
      return { x: vw - lw - padding, y: padding };
    
    case 'bottom-left':
      return { x: padding, y: vh - lh - padding };
    
    case 'bottom-right':
      return { x: vw - lw - padding, y: vh - lh - padding };
    
    case 'center':
      return { x: Math.round((vw - lw) / 2), y: Math.round((vh - lh) / 2) };
    
    default:
      return { x: padding, y: padding };
  }
}

export function getLogoFilterString(
  logoConfig: LogoConfig,
  videoSize: VideoSize,
  logoStreamIndex: number = 1
): string {
  const position = calculateLogoPosition(
    logoConfig.position,
    { width: logoConfig.width, height: logoConfig.height },
    videoSize,
    logoConfig.padding
  );

  return `[${logoStreamIndex}:v]scale=${logoConfig.width}:${logoConfig.height}[logo];[0:v][logo]overlay=${position.x}:${position.y}`;
}