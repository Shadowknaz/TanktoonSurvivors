export const RenderConfig = {
  COLOR_FOREGROUND: 0x000000,
  COLOR_BACKGROUND: 0xfdfbf7,
  HATCHING_DENSITY: 4, // pixels between lines
  CROSS_HATCHING_ANGLE_STEP: 45, // degrees
  SCREEN_WIDTH: 1920,
  SCREEN_HEIGHT: 1080,

  STEP_RATE: 1, // Full smooth visual update
  ENTITY_STEP_OFFSET: true, // staggered step updates
  BOILING_JITTER_PX: 1.5,
  SMEAR_THRESHOLD: 400,
  HALFTONE_ENABLED: true,
  CHROMATIC_ABERRATION_STRENGTH: 2,
  RENDER_STYLE: 'sketch' as 'smooth' | 'sketch',
  CAMERA_ZOOM_DESKTOP: 1.0,
  CAMERA_ZOOM_MOBILE: 0.8, // Zoom out more on mobile to see the battlefield
} as const;
