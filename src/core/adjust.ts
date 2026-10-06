// stabilType/src/core/adjust.ts — framework-agnostic motion-adaptive typography: scroll velocity (or any
// velocity you supply) drives weight, optical size, tracking, slant, opacity and tilt around the text's own
// values. One shared loop for every element; it sleeps when nothing moves.

import type { StabilTypeOptions, Velocity2D } from './types'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Default option values (default ranges describe a change from the text's own values) */
const DEFAULTS = {
	trackingRange: [0, 0.06] as [number, number],
	weightRange: [300, 600] as [number, number],
	opszRange: [12, 24] as [number, number],
	opacityRange: [1, 0.7] as [number, number],
	smoothing: 0.15,
	velocityMax: 15,
	weightAxis: 'wght',
	opszAxis: 'opsz',
	perspective: 600,
	tilt: 3,
	slntRange: [8, -8] as [number, number],
	slntAxis: 'slnt',
}

/** perspective() at the start of the motion — effectively flat (px) */
const FLAT_PERSPECTIVE = 5000

/** Smoothed velocity below which an element counts as at rest */
const REST_EPSILON = 0.002

/** Per-frame decay of a scroller's velocity when no new scroll arrives (0–1) */
const VELOCITY_DECAY = 0.85

// ─── Warnings and validation ──────────────────────────────────────────────────

/** Warnings already printed, so a per-frame problem warns once. */
const warned = new Set<string>()

/** Prints a console warning the first time it is seen. */
function warnOnce(message: string): void {
	if (warned.has(message)) return
	warned.add(message)
	console.warn(message)
}

/** A [number, number] range with finite values, or undefined (with a warning) when the option is malformed. */
function validRange(value: unknown, name: string): [number, number] | undefined {
	if (value === undefined) return undefined
	if (Array.isArray(value) && value.length === 2 && value.every((v) => typeof v === 'number' && Number.isFinite(v))) {
		return [value[0], value[1]]
	}
	warnOnce(`[stabilType] ${name} must be two finite numbers; using the default`)
	return undefined
}

/** A finite number, or the fallback (with a warning) when the value is not one. */
function finiteOr(value: unknown, fallback: number, name: string): number {
	if (value === undefined) return fallback
	if (typeof value === 'number' && Number.isFinite(value)) return value
	warnOnce(`[stabilType] ${name} must be a finite number; got ${String(value)}, using ${fallback}`)
	return fallback
}

/** A four-character axis tag, or the fallback (with a warning). */
function validAxis(value: unknown, fallback: string, name: string): string {
	if (value === undefined) return fallback
	if (typeof value === 'string' && /^[A-Za-z0-9]{4}$/.test(value)) return value
	warnOnce(`[stabilType] ${name} must be a four-letter axis tag; got ${JSON.stringify(value)}, using '${fallback}'`)
	return fallback
}

/** Options with every value validated; ranges the author didn't set are left undefined (relative defaults). */
interface Resolved {
	trackingRange?: [number, number]
	weightRange?: [number, number]
	opszRange?: [number, number]
	opacityRange?: [number, number]
	slntRange?: [number, number]
	smoothing: number
	velocityMax: number
	weightAxis: string
	opszAxis: string
	slntAxis: string
	perspective: number
	tilt: number
	liveBaseFVS: boolean
}

/** Validate options (cached per options object, so a per-frame call costs nothing). */
const resolvedCache = new WeakMap<object, Resolved>()
function resolve(options: StabilTypeOptions = {}): Resolved {
	const cached = resolvedCache.get(options)
	if (cached) return cached
	const opacityRange = validRange(options.opacityRange, 'opacityRange')
	let velocityMax = finiteOr(options.velocityMax, DEFAULTS.velocityMax, 'velocityMax')
	if (velocityMax <= 0) {
		warnOnce(`[stabilType] velocityMax must be greater than 0; using ${DEFAULTS.velocityMax}`)
		velocityMax = DEFAULTS.velocityMax
	}
	const r: Resolved = {
		trackingRange: validRange(options.trackingRange, 'trackingRange'),
		weightRange: validRange(options.weightRange, 'weightRange'),
		opszRange: validRange(options.opszRange, 'opszRange'),
		opacityRange: opacityRange && [clamp01(opacityRange[0]), clamp01(opacityRange[1])],
		slntRange: validRange(options.slntRange, 'slntRange'),
		smoothing: clamp01(finiteOr(options.smoothing, DEFAULTS.smoothing, 'smoothing')),
		velocityMax,
		weightAxis: validAxis(options.weightAxis, DEFAULTS.weightAxis, 'weightAxis'),
		opszAxis: validAxis(options.opszAxis, DEFAULTS.opszAxis, 'opszAxis'),
		slntAxis: validAxis(options.slntAxis, DEFAULTS.slntAxis, 'slntAxis'),
		perspective: Math.max(0, finiteOr(options.perspective, DEFAULTS.perspective, 'perspective')),
		tilt: Math.max(-45, Math.min(45, finiteOr(options.tilt, DEFAULTS.tilt, 'tilt'))),
		liveBaseFVS: options.liveBaseFVS === true,
	}
	resolvedCache.set(options, r)
	return r
}

/** Clamp to [0, 1]. */
function clamp01(n: number): number {
	return Math.min(1, Math.max(0, n))
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Linear interpolation between a and b by factor t (clamped 0–1).
 *
 * @param a - Value at t = 0
 * @param b - Value at t = 1
 * @param t - Interpolation factor, clamped to [0, 1]
 */
export function lerp(a: number, b: number, t: number): number {
	const tc = Math.min(1, Math.max(0, t))
	return a + (b - a) * tc
}

/** Escape a string for use inside a RegExp. */
function escapeRegExp(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Override a single axis value inside a font-variation-settings string,
 * preserving all other axis values. Adds the axis if not already present.
 *
 * e.g. overrideAxis('"wght" 300', 'opsz', 18) → '"wght" 300, "opsz" 18'
 *
 * @param baseFVS - Existing font-variation-settings string
 * @param axis    - Axis tag to set (e.g. 'wght', 'opsz')
 * @param value   - Numeric value to assign
 */
export function overrideAxis(baseFVS: string, axis: string, value: number): string {
	const tag = axis.replace(/["'\\,]/g, '')
	if (!baseFVS || baseFVS === 'normal') return `"${tag}" ${value}`
	const pattern = new RegExp(`(["'])${escapeRegExp(tag)}\\1\\s+-?[\\d.eE+-]+`)
	const replacement = `"${tag}" ${value}`
	return pattern.test(baseFVS) ? baseFVS.replace(pattern, replacement) : `${baseFVS}, ${replacement}`
}

/** Parse a computed font-variation-settings value into [tag, value] pairs. */
function parseAxes(fvs: string): [string, number][] {
	if (!fvs || fvs === 'normal') return []
	const out: [string, number][] = []
	for (const m of fvs.matchAll(/["']([^"']{4})["']\s+(-?[\d.]+(?:e[+-]?\d+)?)/gi)) out.push([m[1], parseFloat(m[2])])
	return out
}

// ─── Per-element state ────────────────────────────────────────────────────────

/** The text's own values, read before stabilType writes anything. */
interface Author {
	axes: [string, number][]
	wght: number
	opsz: number
	slnt: number
	letterSpacingEm: number
	opacity: number
	transform: string
}

/** Original inline styles, the author's values and the smoothed velocity, per element. */
interface SavedState {
	fvs: string
	letterSpacing: string
	opacity: string
	transform: string
	hadStyle: boolean
	author: Author
	smoothedVY: number
	smoothedVX: number
	/** Whether the element currently carries stabilType's styles */
	styled: boolean
	/** Last written style key, so unchanged frames write nothing */
	lastKey: string
}

/** Per-element state; the first apply saves the originals, removeStabilType restores them. */
const savedState = new WeakMap<HTMLElement, SavedState>()

/** Read the text's own values from the cascade. */
function readAuthor(el: HTMLElement): Author {
	const cs = getComputedStyle(el)
	const axes = parseAxes(cs.getPropertyValue?.('font-variation-settings') || cs.fontVariationSettings || '')
	const fontSize = parseFloat(cs.fontSize) || 16
	const axis = (tag: string) => axes.find(([t]) => t === tag)?.[1]
	const weight = parseFloat(cs.fontWeight)
	const opacity = parseFloat(cs.opacity)
	return {
		axes,
		wght: axis('wght') ?? (Number.isFinite(weight) ? weight : 400),
		// With optical sizing on, the browser uses the font size in px as opsz.
		opsz: axis('opsz') ?? fontSize,
		slnt: axis('slnt') ?? 0,
		letterSpacingEm: (parseFloat(cs.letterSpacing) || 0) / fontSize,
		opacity: Number.isFinite(opacity) ? opacity : 1,
		transform: cs.transform && cs.transform !== 'none' ? cs.transform : '',
	}
}

/** Get (or create, saving the originals) an element's state. */
function stateFor(el: HTMLElement): SavedState {
	let state = savedState.get(el)
	if (!state) {
		state = {
			fvs: el.style.fontVariationSettings,
			letterSpacing: el.style.letterSpacing,
			opacity: el.style.opacity,
			transform: el.style.transform,
			hadStyle: el.getAttribute?.('style') != null,
			author: readAuthor(el),
			smoothedVY: 0,
			smoothedVX: 0,
			styled: false,
			lastKey: '',
		}
		savedState.set(el, state)
	}
	return state
}

/** Put back the element's original inline styles. */
function restoreStyles(el: HTMLElement, state: SavedState): void {
	el.style.fontVariationSettings = state.fvs
	el.style.letterSpacing = state.letterSpacing
	el.style.opacity = state.opacity
	el.style.transform = state.transform
	if (!state.hadStyle && !el.getAttribute?.('style')) el.removeAttribute?.('style')
	state.styled = false
	state.lastKey = ''
}

/**
 * Write the styles for the element's current smoothed velocity. At rest (and with no explicit ranges)
 * the element carries no styles of its own, so the author's weight, spacing, opacity and transform show.
 */
function write(el: HTMLElement, state: SavedState, o: Resolved): void {
	const ty = state.smoothedVY
	const tx = state.smoothedVX
	const speed = Math.min(1, Math.hypot(ty, tx))
	const atRest = Math.abs(ty) < REST_EPSILON && Math.abs(tx) < REST_EPSILON
	const explicit = !!(o.trackingRange || o.weightRange || o.opszRange || o.opacityRange || o.slntRange)

	if (atRest && !explicit) {
		if (state.styled) restoreStyles(el, state)
		return
	}

	let a = state.author
	if (o.liveBaseFVS) {
		// Read the cascade without stabilType's own inline value.
		const current = el.style.fontVariationSettings
		el.style.fontVariationSettings = state.fvs
		a = { ...a, axes: parseAxes(getComputedStyle(el).fontVariationSettings) }
		el.style.fontVariationSettings = current
	}

	// Explicit ranges are absolute [at rest, at peak]; default ranges are a change from the text's own value.
	const d = DEFAULTS
	const weight = o.weightRange ? lerp(o.weightRange[0], o.weightRange[1], speed) : a.wght + (d.weightRange[1] - d.weightRange[0]) * speed
	const opsz = o.opszRange ? lerp(o.opszRange[0], o.opszRange[1], speed) : a.opsz + (d.opszRange[1] - d.opszRange[0]) * speed
	const tracking = o.trackingRange ? lerp(o.trackingRange[0], o.trackingRange[1], speed) : a.letterSpacingEm + (d.trackingRange[1] - d.trackingRange[0]) * speed
	const opacity = o.opacityRange ? lerp(o.opacityRange[0], o.opacityRange[1], speed) : a.opacity * lerp(d.opacityRange[0], d.opacityRange[1], speed)
	const slntSpan = o.slntRange ?? d.slntRange
	const slnt = (o.slntRange ? 0 : a.slnt) + lerp(slntSpan[0], slntSpan[1], (ty + 1) / 2)

	const axes = new Map(a.axes)
	axes.set(o.weightAxis, Math.round(Math.max(1, Math.min(1000, weight))))
	axes.set(o.opszAxis, Math.round(opsz * 10) / 10)
	if (!atRest || o.slntRange) axes.set(o.slntAxis, Math.round(slnt * 10) / 10)
	const fvs = Array.from(axes, ([t, v]) => `"${t}" ${v}`).join(', ')
	const ls = `${tracking.toFixed(4)}em`
	const op = clamp01(opacity).toFixed(3)
	let transform = state.transform
	if (o.perspective > 0 && !atRest) {
		const persp = lerp(FLAT_PERSPECTIVE, o.perspective, speed)
		transform = `${a.transform ? a.transform + ' ' : ''}perspective(${persp.toFixed(0)}px) rotateX(${(ty * -o.tilt).toFixed(2)}deg) rotateY(${(tx * o.tilt).toFixed(2)}deg)`
	}

	const key = `${fvs}|${ls}|${op}|${transform}`
	if (key === state.lastKey) return
	el.style.fontVariationSettings = fvs
	el.style.letterSpacing = ls
	el.style.opacity = op
	el.style.transform = transform
	state.styled = true
	state.lastKey = key
}

/** Advance an element's smoothed velocity by one frame toward the given input. */
function smooth(state: SavedState, velocity: number | Velocity2D, s: number): void {
	const raw = typeof velocity === 'object' && velocity !== null ? velocity : { x: 0, y: velocity as number }
	const vy = Number.isFinite(raw.y) ? Math.min(1, Math.max(-1, raw.y)) : 0
	const vx = Number.isFinite(raw.x) ? Math.min(1, Math.max(-1, raw.x)) : 0
	state.smoothedVY = state.smoothedVY * (1 - s) + vy * s
	state.smoothedVX = state.smoothedVX * (1 - s) + vx * s
	if (Math.abs(state.smoothedVY) < REST_EPSILON / 4) state.smoothedVY = 0
	if (Math.abs(state.smoothedVX) < REST_EPSILON / 4) state.smoothedVX = 0
}

// ─── Public: one step ─────────────────────────────────────────────────────────

/**
 * Apply one frame of motion-adaptive typography for a pre-normalised velocity. The velocity is smoothed
 * (see `smoothing`), so call this once per frame — startStabilType does that for you and runs until the
 * text is back at rest.
 *
 * Velocity can be a signed scalar –1 to +1 (vertical) or a Velocity2D { x, y }. Speed drives wght, opsz,
 * tracking and opacity; the signed vertical component drives slnt and rotateX, the horizontal one rotateY.
 *
 * @param el       - Element to adapt
 * @param velocity - Signed velocity scalar or 2D vector (non-finite values count as 0)
 * @param options  - StabilTypeOptions (merged with defaults)
 */
export function applyStabilType(
	el: HTMLElement,
	velocity: number | Velocity2D,
	options: StabilTypeOptions = {},
): void {
	if (typeof window === 'undefined' || !el) return
	const o = resolve(options)
	const state = stateFor(el)
	smooth(state, velocity, o.smoothing)
	write(el, state, o)
}

// ─── The shared loop ──────────────────────────────────────────────────────────

/** A scroll container (or the window) and its measured velocity in px per 60 Hz frame. */
interface Scroller {
	pos: () => { x: number; y: number }
	last: { x: number; y: number }
	/** Position just before this frame's style writes (to spot scroll anchoring) */
	beforeWrite: { x: number; y: number } | null
	/** Scroll caused by layout (scroll anchoring reacting to our own size changes) — not user motion */
	anchorShift: { x: number; y: number }
	vx: number
	vy: number
	users: number
}

/** One running element. */
interface Instance {
	el: HTMLElement
	options: StabilTypeOptions
	getVelocity: (() => number | Velocity2D) | null
	scroller: Scroller | null
	stop: () => void
}

const instances = new Set<Instance>()
const instanceByElement = new WeakMap<HTMLElement, Instance>()
const scrollers = new Map<Element | Window, Scroller>()
let rafId = 0
let lastFrame = 0

/** The nearest scrolling ancestor of an element, or the window. */
function scrollParent(el: HTMLElement): Element | Window {
	let p = el.parentElement
	while (p && p !== document.body && p !== document.documentElement) {
		const cs = getComputedStyle(p)
		if (/(auto|scroll|overlay)/.test(cs.overflowY + cs.overflowX)) return p
		p = p.parentElement
	}
	return window
}

/** The tracked scroller for a container (created on first use). */
function scrollerFor(target: Element | Window): Scroller {
	let s = scrollers.get(target)
	if (!s) {
		const pos = target === window
			? () => ({ x: window.scrollX, y: window.scrollY })
			: () => ({ x: (target as Element).scrollLeft, y: (target as Element).scrollTop })
		s = { pos, last: pos(), beforeWrite: null, anchorShift: { x: 0, y: 0 }, vx: 0, vy: 0, users: 0 }
		scrollers.set(target, s)
	}
	return s
}

/** Runs after layout: scroll that changed since our writes was scroll anchoring, not the reader. */
const layoutObserver = typeof ResizeObserver !== 'undefined'
	? new ResizeObserver(() => {
		scrollers.forEach((s) => {
			if (!s.beforeWrite) return
			const now = s.pos()
			s.anchorShift.x += now.x - s.beforeWrite.x
			s.anchorShift.y += now.y - s.beforeWrite.y
			s.beforeWrite = null
		})
	})
	: null

/** Wake the loop (on any scroll). */
function wake(): void {
	if (!rafId && instances.size > 0) {
		lastFrame = performance.now()
		rafId = requestAnimationFrame(frame)
	}
}

/** One frame for every running element. */
function frame(now: number): void {
	rafId = 0
	const dt = Math.max(1, now - lastFrame)
	lastFrame = now

	// 1. Scroll velocity per scroller, minus scroll caused by layout.
	scrollers.forEach((s) => {
		const p = s.pos()
		const dx = p.x - s.last.x - s.anchorShift.x
		const dy = p.y - s.last.y - s.anchorShift.y
		s.last = p
		s.anchorShift = { x: 0, y: 0 }
		const fx = (dx / dt) * 16.67
		const fy = (dy / dt) * 16.67
		// A frame without new scroll lets the velocity decay instead of dropping to zero.
		s.vx = Math.abs(fx) >= Math.abs(s.vx * VELOCITY_DECAY) ? fx : s.vx * VELOCITY_DECAY
		s.vy = Math.abs(fy) >= Math.abs(s.vy * VELOCITY_DECAY) ? fy : s.vy * VELOCITY_DECAY
		if (Math.abs(s.vx) < 0.01) s.vx = 0
		if (Math.abs(s.vy) < 0.01) s.vy = 0
		s.beforeWrite = p
	})

	// 2. Smooth and write each element.
	let busy = false
	instances.forEach((inst) => {
		if (inst.el.isConnected === false) { inst.stop(); return }
		const o = resolve(inst.options)
		const state = stateFor(inst.el)
		let velocity: number | Velocity2D
		if (inst.getVelocity) {
			busy = true // a velocity callback is polled every frame
			try { velocity = inst.getVelocity() } catch { velocity = 0 }
		} else {
			const s = inst.scroller!
			velocity = {
				x: Math.sign(s.vx) * Math.min(Math.abs(s.vx) / o.velocityMax, 1),
				y: Math.sign(s.vy) * Math.min(Math.abs(s.vy) / o.velocityMax, 1),
			}
			if (s.vx || s.vy) busy = true
		}
		smooth(state, velocity, o.smoothing)
		write(inst.el, state, o)
		if (state.smoothedVX || state.smoothedVY) busy = true
	})

	if (busy && instances.size > 0) rafId = requestAnimationFrame(frame)
	else scrollers.forEach((s) => { s.beforeWrite = null })
}

/** Stop everything if the reader turns on reduced motion. */
let motionQuery: MediaQueryList | undefined
function onMotionChange(): void {
	if (motionQuery?.matches) Array.from(instances).forEach((i) => i.stop())
}

/** Attach the shared listeners when the first element starts. */
function attachShared(): void {
	document.addEventListener('scroll', wake, { capture: true, passive: true })
	motionQuery = window.matchMedia?.('(prefers-reduced-motion: reduce)')
	motionQuery?.addEventListener?.('change', onMotionChange)
}

/** Detach the shared listeners when the last element stops. */
function detachShared(): void {
	document.removeEventListener('scroll', wake, { capture: true })
	motionQuery?.removeEventListener?.('change', onMotionChange)
	if (rafId) { cancelAnimationFrame(rafId); rafId = 0 }
	scrollers.clear()
}

// ─── Public: start / remove ───────────────────────────────────────────────────

/**
 * Start motion-adaptive typography on an element. Returns a stop function that restores the element.
 *
 * Two calling conventions:
 *
 * 1. `startStabilType(el, options?)` — scroll velocity of the element's scroll container (the window, or
 *    the nearest scrolling ancestor), normalised by `velocityMax`. The loop runs while the text is moving
 *    and sleeps once it is back at rest. Scroll caused by the browser's scroll anchoring (reacting to the
 *    text's own size changes) is not counted as motion.
 *
 * 2. `startStabilType(el, getVelocity, options?)` — your own velocity source (device motion, pointer,
 *    audio…), polled every frame. Returns –1…+1 or { x, y }.
 *
 * Every element shares one requestAnimationFrame loop and one scroll listener. An element removed from the
 * page stops by itself; starting again on the same element replaces the earlier run. Under
 * prefers-reduced-motion nothing runs, and turning it on stops every element.
 *
 * @param el                   - Element to adapt
 * @param getVelocityOrOptions - Velocity callback OR options object (selects mode)
 * @param options              - StabilTypeOptions when using callback mode
 */
export function startStabilType(el: HTMLElement, options?: StabilTypeOptions): () => void
export function startStabilType(
	el: HTMLElement,
	getVelocity: () => number | Velocity2D,
	options?: StabilTypeOptions,
): () => void
export function startStabilType(
	el: HTMLElement,
	getVelocityOrOptions?: (() => number | Velocity2D) | StabilTypeOptions,
	options?: StabilTypeOptions,
): () => void {
	if (typeof window === 'undefined' || !el) return () => undefined
	if (window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches) return () => undefined

	instanceByElement.get(el)?.stop()

	const getVelocity = typeof getVelocityOrOptions === 'function' ? getVelocityOrOptions : null
	const opts = (getVelocity ? options : getVelocityOrOptions as StabilTypeOptions | undefined) ?? {}
	resolve(opts) // validate (and warn) up front
	stateFor(el)

	if (instances.size === 0) attachShared()
	const scroller = getVelocity ? null : scrollerFor(scrollParent(el))
	if (scroller) scroller.users++
	try { layoutObserver?.observe(el) } catch { /* not an Element (tests) */ }

	let stopped = false
	const inst: Instance = {
		el,
		options: opts,
		getVelocity,
		scroller,
		stop: () => {
			if (stopped) return
			stopped = true
			instances.delete(inst)
			if (instanceByElement.get(el) === inst) instanceByElement.delete(el)
			try { layoutObserver?.unobserve(el) } catch { /* not an Element */ }
			if (scroller && --scroller.users <= 0) scrollers.forEach((s, k) => { if (s === scroller) scrollers.delete(k) })
			const state = savedState.get(el)
			if (state) restoreStyles(el, state)
			savedState.delete(el)
			if (instances.size === 0) detachShared()
		},
	}
	instances.add(inst)
	instanceByElement.set(el, inst)
	if (getVelocity) wake()
	return inst.stop
}

/**
 * Stop any running loop on the element and restore its original inline styles.
 * No-op if stabilType never touched the element.
 *
 * @param el - The element previously adjusted by applyStabilType or startStabilType
 */
export function removeStabilType(el: HTMLElement): void {
	if (!el) return
	instanceByElement.get(el)?.stop()
	const state = savedState.get(el)
	if (!state) return
	restoreStyles(el, state)
	savedState.delete(el)
}
