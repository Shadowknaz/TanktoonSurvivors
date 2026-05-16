export const RenderConfig = {
  COLOR_FOREGROUND: 0x000000,
  COLOR_BACKGROUND: 0xfdfbf7,
  HATCHING_DENSITY: 4, // pixels between lines
  CROSS_HATCHING_ANGLE_STEP: 45, // degrees
  SCREEN_WIDTH: 1280,
  SCREEN_HEIGHT: 720,

  STEP_RATE: 2, // 30fps visual update for physics objects
  ENTITY_STEP_OFFSET: true, // staggered step updates
  BOILING_JITTER_PX: 1.5,
  SMEAR_THRESHOLD: 400,
  HALFTONE_ENABLED: true,
  CHROMATIC_ABERRATION_STRENGTH: 2,
  RENDER_STYLE: 'sketch' as 'smooth' | 'sketch',
} as const;
