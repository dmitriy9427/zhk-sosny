/**
 * Шейдеры 3D-ленты: слайды на цилиндре (барабан), изгиб листа на
 * скорости, отражение в «полу», затенение краёв и RGB-сдвиг.
 * @module kit/modules/infinite-slider/glsl
 */

export const slideVertex = /* glsl */ `
  // Вершины считаются прямо в пикселях сцены (начало в центре окна, Y вверх).
  uniform vec2 uCenter;
  uniform vec2 uPlane;
  // Радиус цилиндра, px: > 0 — барабан (края уходят вглубь), 0 — плоско.
  uniform float uCurve;
  uniform float uSpeed;
  uniform float uBend;
  uniform float uMirror;
  uniform float uGap;

  varying vec2 vUv;
  varying float vAngle;

  const float PI = 3.14159265;

  void main() {
    vec3 pos = position;

    // Лист прогибается против движения: середина отстаёт от краёв.
    pos.x -= sin(uv.y * PI) * uSpeed * uBend * 0.12;

    vec3 world = vec3(pos.x * uPlane.x + uCenter.x, pos.y * uPlane.y + uCenter.y, 0.0);

    if (uMirror > 0.5) {
      float floorY = uCenter.y - uPlane.y * 0.5 - uGap * 0.5;
      world.y = 2.0 * floorY - world.y;
    }

    float angle = 0.0;

    if (uCurve != 0.0) {
      angle = world.x / uCurve;
      world.x = uCurve * sin(angle);
      world.z = uCurve * (cos(angle) - 1.0);
    }

    vUv = uv;
    vAngle = angle;
    gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
  }
`

export const slideFragment = /* glsl */ `
  uniform sampler2D uTexture;
  uniform vec2 uPlane;
  uniform vec2 uImage;
  uniform float uSpeed;
  uniform float uRgb;
  uniform float uShade;
  uniform float uMirror;
  uniform float uReflection;
  uniform float uRadius;

  varying vec2 vUv;
  varying float vAngle;

  vec2 cover(vec2 box, vec2 image, vec2 uv) {
    float boxRatio = box.x / box.y;
    float imageRatio = image.x / image.y;
    vec2 scale = boxRatio < imageRatio
      ? vec2(boxRatio / imageRatio, 1.0)
      : vec2(1.0, imageRatio / boxRatio);

    return (uv - 0.5) * scale + 0.5;
  }

  // Расстояние до края скруглённого прямоугольника, px: < 0 внутри.
  float roundedDistance(vec2 uv) {
    vec2 halfSize = uPlane * 0.5;
    vec2 q = abs(uv * uPlane - halfSize) - (halfSize - vec2(uRadius));

    return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - uRadius;
  }

  void main() {
    vec2 uv = cover(uPlane, uImage, vUv);
    vec2 shift = vec2(uSpeed * uRgb * 0.025, 0.0);
    vec4 base = texture2D(uTexture, uv);
    vec3 color = vec3(texture2D(uTexture, uv + shift).r, base.g, texture2D(uTexture, uv - shift).b);

    color *= 1.0 - uShade * clamp(abs(vAngle) / 1.1, 0.0, 1.0);

    float distance = roundedDistance(vUv);
    float alpha = clamp(0.5 - distance, 0.0, 1.0);

    // Светлая кромка в 1.5 px по краю — как рамка у DOM-карточек.
    color += vec3(0.85, 0.95, 1.0) * 0.22 * (1.0 - smoothstep(0.0, 1.5, abs(distance + 1.0)));

    if (uMirror > 0.5) {
      // Отражение гаснет по мере удаления от «пола» (низ оригинала — vUv.y = 0).
      alpha *= uReflection * (1.0 - smoothstep(0.0, 0.5, vUv.y));
      color *= 0.8;
    }

    gl_FragColor = vec4(color, alpha);
    #include <colorspace_fragment>
  }
`
