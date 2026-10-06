# stabilType

[![npm](https://img.shields.io/npm/v/%40overpunch%2Fstabiltype.svg)](https://www.npmjs.com/package/@overpunch/stabiltype) [![bundle size](https://img.shields.io/badge/min%2Bgzip-~4%20kB-44cc66.svg)](https://www.npmjs.com/package/@overpunch/stabiltype) [![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT) [![part of liiift type-tools](https://img.shields.io/badge/liiift-type--tools-blueviolet)](https://github.com/over-punch/type-tools)

Motion-adaptive typography — adjusts letter-spacing, weight, optical size, slant, opacity, and perspective tilt in real time based on scroll velocity, or any velocity you supply (device motion, pointer, a physics engine). Faster movement loosens tracking, increases weight, and tilts the type away; slower movement returns to rest. The text physically registers the energy of reading.

![stabilType: a paragraph reacting to scroll velocity — at rest it sits light and flat, then loosens its tracking, gains weight, and tilts back in perspective as the scroll accelerates, settling again when motion stops](https://raw.githubusercontent.com/over-punch/stabilType/master/assets/hero.gif?v=1)

**▶ [See it live at stabiltype.com](https://stabiltype.com)** — scroll the page (or move your cursor / tilt your phone) to feel it. · [npm](https://www.npmjs.com/package/@overpunch/stabiltype) · [GitHub](https://github.com/over-punch/stabilType)

TypeScript · Zero dependencies · ~4 kB min+gzip · React + Vanilla JS

### What it looks like at each velocity

The same paragraph at three downward-scroll speeds (velocity `0`, `0.5`, `1.0`). Weight climbs `300 → 800`, optical size opens up, and the tracking loosens as velocity rises — every value is `lerp`-interpolated from the velocity through the option ranges below. (These captures push `weightRange` to `[300, 800]` to make the ramp obvious; the library default is `[300, 600]`.)

![Three copies of the same paragraph stacked vertically: at rest (velocity 0) it is light with tight tracking; at velocity 0.5 the weight and spacing increase; at velocity 1.0 it is bold with the widest tracking](https://raw.githubusercontent.com/over-punch/stabilType/master/assets/states.png?v=1)

---

## Install

```bash
npm install @overpunch/stabiltype
```

---

## Usage

> **Next.js App Router:** this library uses browser APIs. Add `"use client"` to any component file that imports from it.

### React component

`StabilTypeText` is a controlled component — pass it a `velocity` value and it adapts the typography accordingly. Velocity is a signed scalar from `–1` to `+1`: the **magnitude** drives the speed-based effects (weight, optical size, tracking, opacity) while the **sign** drives the directional ones (slant, tilt) — `0` is at rest, `+1` is peak downward/forward motion, `–1` is peak upward/backward. Compute velocity however you like (scroll delta, `devicemotion`, a spring simulation) and re-render. For a turnkey scroll source, see [Driving from scroll in React](#driving-from-scroll-in-react) below.

```tsx
import { StabilTypeText } from '@overpunch/stabiltype'

<StabilTypeText
  velocity={scrollVelocity}
  trackingRange={[0, 0.08]}
  weightRange={[300, 700]}
  opszRange={[12, 36]}
>
  Typography in motion
</StabilTypeText>
```

### React hook

`useStabilType` takes a ref, a velocity value, and options. It reads the latest velocity every frame, so the text eases toward each new value and all the way back to rest, and it stops and restores the element automatically on unmount to restore the element's original inline styles. `StabilTypeText` wraps the hook, so it cleans up the same way.

```tsx
"use client"
import { useStabilType } from '@overpunch/stabiltype'
import { useRef } from 'react'

export default function Demo({ velocity }: { velocity: number }) {
  const ref = useRef<HTMLParagraphElement>(null)

  // velocity is a number –1…+1, or a Velocity2D { x, y } for 2D motion.
  // Get one from useScrollVelocity() below, devicemotion, or any source.
  useStabilType(ref, velocity, {
    weightRange: [300, 700],
    smoothing: 0.2,
  })

  return <p ref={ref}>Typography in motion</p>
}
```

### Driving from scroll in React

The React APIs above are **controlled** — they don't listen to anything themselves, so you supply the `velocity`. In vanilla JS `startStabilType(el, options)` reads scroll for you, but the hook and component leave that to you. Here's a small, copy-paste hook that produces a normalised, decaying `–1…+1` scroll velocity — the same model `startStabilType` uses internally (normalise the per-frame scroll delta, then decay back toward rest):

```tsx
"use client"
import { useEffect, useRef, useState } from 'react'

// Returns a signed scroll velocity in –1…+1: magnitude = speed, sign = direction.
export function useScrollVelocity(velocityMax = 15) {
  const [velocity, setVelocity] = useState(0)
  const lastY = useRef(0)
  const lastT = useRef(0)
  const current = useRef(0)

  useEffect(() => {
    lastY.current = window.scrollY
    lastT.current = performance.now()

    const onScroll = () => {
      const now = performance.now()
      const dt = now - lastT.current
      if (dt > 0) {
        const dy = window.scrollY - lastY.current
        current.current = Math.sign(dy) * Math.min(Math.abs(dy / dt * 16.67) / velocityMax, 1)
      }
      lastY.current = window.scrollY
      lastT.current = now
    }

    let raf = 0
    const tick = () => {
      current.current *= 0.85          // decay back to rest after scrolling stops
      if (Math.abs(current.current) < 0.002) current.current = 0
      setVelocity(current.current)
      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('scroll', onScroll, { passive: true })
    raf = requestAnimationFrame(tick)
    return () => {
      window.removeEventListener('scroll', onScroll)
      cancelAnimationFrame(raf)
    }
  }, [velocityMax])

  return velocity
}
```

Feed it straight into the component:

```tsx
"use client"
import { StabilTypeText } from '@overpunch/stabiltype'

export default function Hero() {
  const velocity = useScrollVelocity()
  return <StabilTypeText velocity={velocity} weightRange={[300, 700]}>
    Typography in motion
  </StabilTypeText>
}
```

If all you want is **scroll-driven** behaviour with no custom velocity source, the vanilla `startStabilType(el, options)` is the least-effort path — it includes this exact scroll loop (and an idle-sleep optimisation) for free. Wrap it in a `useEffect` over a ref and you're done.

### Vanilla JS

`startStabilType` is the self-contained entry point. It starts a `requestAnimationFrame` loop, reads scroll velocity each frame, and updates the element's typography. Returns a `stop` function.

```ts
import { startStabilType } from '@overpunch/stabiltype/core'

const el = document.querySelector('p')
const stop = startStabilType(el, {
  weightRange: [300, 700],
  trackingRange: [0, 0.06],
  velocityMax: 15,
})

// Later — stop and restore the original styles (removeStabilType(el) does the same):
stop()
```

To drive from an external velocity source (device motion, pointer tracking, a physics engine), pass a velocity callback. `startStabilType` calls it every animation frame:

```ts
import { startStabilType } from '@overpunch/stabiltype/core'

const el = document.querySelector('p')

// devicemotion example — y acceleration mapped to –1…+1. stabilType doesn't listen to device motion
// itself; you supply it. iOS 13+ only sends motion events after DeviceMotionEvent.requestPermission(),
// which must be called from a user gesture (a tap):
let currentVelocity = 0
async function enableMotion() {
  if (typeof DeviceMotionEvent !== 'undefined' && typeof DeviceMotionEvent.requestPermission === 'function') {
    if (await DeviceMotionEvent.requestPermission() !== 'granted') return
  }
  window.addEventListener('devicemotion', (e) => {
    currentVelocity = Math.max(-1, Math.min(1, (e.acceleration?.y ?? 0) / 9.8))
  })
}
document.querySelector('#enable-motion').addEventListener('click', enableMotion)

const stop = startStabilType(el, () => currentVelocity, {
  weightRange: [300, 700],
  tilt: 5,
})
```

For manual control — drive velocity yourself from any source:

```ts
import { applyStabilType, removeStabilType } from '@overpunch/stabiltype/core'

const el = document.querySelector('p')

// Call on every animation frame with the current velocity –1…+1 (each call is one smoothing step):
applyStabilType(el, scrollVelocity, {
  weightRange: [300, 700],
})

// Or pass a 2D velocity (e.g. from devicemotion):
applyStabilType(el, { x: 0.3, y: 0.8 }, {
  tilt: 5,
})

// Restore original styles:
removeStabilType(el)
```

### TypeScript

```ts
import type { StabilTypeOptions, Velocity2D } from '@overpunch/stabiltype'

const opts: StabilTypeOptions = {
  trackingRange: [0, 0.06],
  weightRange: [300, 600],
  smoothing: 0.2,
  velocityMax: 20,
}

const velocity: Velocity2D = { x: 0, y: 0.7 }
```

---

## Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `trackingRange` | `[number, number]` | +0.06em | Letter-spacing in em: `[at rest, at max velocity]`. Unset, the text's own letter-spacing plus up to 0.06em |
| `weightRange` | `[number, number]` | +300 | `wght` axis: `[at rest, at max velocity]`. Unset, the text's own weight plus up to 300 |
| `opszRange` | `[number, number]` | +12 | `opsz` axis: `[at rest, at max velocity]`. Unset, the text's own optical size (its font size) plus up to 12 |
| `opacityRange` | `[number, number]` | ×0.7 | Opacity: `[at rest, at max velocity]`, clamped to 0–1. Unset, the text's own opacity down to 70% of it |
| `slntRange` | `[number, number]` | `[8, -8]` | `slnt` change: `[at peak upscroll, at peak downscroll]`. Many fonts only have negative slant (Roboto Flex: −10 to 0), so upscroll may show no slant |
| `smoothing` | `number` | `0.15` | Share of each new velocity sample per frame (0–1). Higher = faster response, less lag; 1 snaps instantly, 0 freezes |
| `velocityMax` | `number` | `15` | Scroll velocity in px/frame that maps to maximum adjustment. Only used by `startStabilType` |
| `perspective` | `number` | `600` | CSS `perspective` depth in px at peak velocity. Controls dolly compression. Set to `0` to disable |
| `tilt` | `number` | `3` | `rotateX` (vertical motion) and `rotateY` (horizontal motion) tilt in degrees at peak velocity, up to 45. Downscroll tips the top away, upscroll the bottom |
| `weightAxis` | `string` | `'wght'` | Variable font weight axis tag |
| `opszAxis` | `string` | `'opsz'` | Variable font optical size axis tag |
| `slntAxis` | `string` | `'slnt'` | Variable font slant axis tag |
| `liveBaseFVS` | `boolean` | `false` | Re-read the element's own `font-variation-settings` (from its CSS, without stabilType's inline value) every frame instead of snapshotting it on first activation. Only needed if external CSS changes the element's FVS at runtime; adds a style recalculation per frame |

---

## How it works

`applyStabilType` takes a signed velocity value (–1 = max negative direction, +1 = max positive direction), smooths it, and maps it through each option range. The values are written as `font-variation-settings` (weight, opsz, slnt, keeping the element's other axes), `letter-spacing`, `opacity`, and a CSS `transform` (perspective + tilt, after the element's own transform) on the element's inline style. At rest the element carries no styles of its own (unless you set explicit ranges), so its own weight, spacing, opacity and transform show; `removeStabilType` restores the original inline styles exactly.

`startStabilType` uses one `requestAnimationFrame` loop and one scroll listener for every element. Each frame it measures the scroll velocity of each element's scroll container (the window, or the nearest scrolling ancestor), normalises it against `velocityMax`, smooths it, and writes the styles. Scroll caused by the browser's scroll anchoring (it compensates when the text above the viewport changes height) is not counted, so the text can't push the page along by itself. Once everything is back at rest the loop sleeps until the next scroll. An element removed from the page stops by itself.

**2D velocity:** Pass a `Velocity2D { x, y }` object for device-motion or horizontal-scroll scenarios. Speed (the magnitude of both) drives weight, optical size, tracking and opacity; `y` drives `slnt` and `rotateX`; `x` drives `rotateY`.

**Layout:** letter-spacing and weight change the text's width, so lines rewrap while the text moves (in our test a paragraph went from 9 to 11 lines mid-scroll; layout shift 0.21). For no reflow, keep only the effects that don't change width: set `trackingRange: [0, 0]` and an equal `weightRange` (e.g. `[400, 400]`), or use opacity and tilt alone. While the text moves, its `transform` makes `position: fixed` children position relative to it; set `perspective: 0` if the element contains any. At peak the default opacity (70% of the text's own) can drop grey text below WCAG AA contrast.

**Variable font requirement:** The weight, opsz, and slant effects require a variable font exposing those axes. stabilType always writes `font-variation-settings`; on a font without a given axis the browser simply ignores it, so the effect degrades to whatever the font *does* support plus the always-available opacity and letter-spacing. There is no axis sniffing — load a variable font (with the axes you reference) to get the full effect.

---

## Accessibility

**`startStabilType`, `useStabilType` and `StabilTypeText` honour `prefers-reduced-motion`.** When the user's OS-level "reduce motion" setting is on, they never start — no scroll listener, no style writes — and turning it on while they run stops them and restores the element.

**`applyStabilType` does not gate itself.** It applies exactly what you pass it, because you own the velocity source. If you drive it yourself, honour the preference at the source. You can also do that in React, so the velocity source does no work:

```tsx
"use client"
import { StabilTypeText } from '@overpunch/stabiltype'
import { useScrollVelocity } from './useScrollVelocity' // from "Driving from scroll in React" above

export default function Hero() {
  const reduce = typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const velocity = useScrollVelocity()
  return <StabilTypeText velocity={reduce ? 0 : velocity}>Typography in motion</StabilTypeText>
}
```

Passing `0` keeps the type at its at-rest values, so the content stays fully legible with no animation.

---

## API reference

| Export | Description |
|--------|-------------|
| `applyStabilType(el, velocity, options?)` | Apply one frame of typography adaptation. Velocity is `number` or `Velocity2D`. |
| `startStabilType(el, options?)` | Start a rAF scroll loop. Returns `stop()`. |
| `removeStabilType(el)` | Stop any running loop and restore original inline styles. |
| `lerp(a, b, t)` | Linear interpolation utility exported for custom velocity mapping. |
| `overrideAxis(baseFVS, axis, value)` | Override one axis in a `font-variation-settings` string, preserving others. |
| `useStabilType` | React hook: `(ref, velocity, options?)` |
| `StabilTypeText` | React component. Controlled via `velocity` prop. |
| `StabilTypeOptions` | TypeScript interface for all options. |
| `Velocity2D` | Interface for 2D velocity input `{ x: number, y: number }`. |

---

## Next.js

`StabilTypeText`, `useStabilType`, and `startStabilType` all require a browser environment. Add `"use client"` to any component that imports them:

```tsx
"use client"
import { StabilTypeText } from '@overpunch/stabiltype'
```

---

## Dev notes

### `next` in root devDependencies

`package.json` at the repo root lists `next` as a devDependency. This is a **Vercel detection workaround** — not a real dependency of the npm package. Vercel's build system inspects the root `package.json` to detect the framework; without `next` present it falls back to a static build and skips the Next.js pipeline, breaking the `/site` subdirectory deploy.

The package itself has zero runtime dependencies. Do not remove this entry.
