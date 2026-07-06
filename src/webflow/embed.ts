// stabilType/src/webflow/embed.ts — zero-config browser bundle for Webflow Custom Code Embed.
// Auto-initialises stabilType on any element marked with [data-stabiltype], reading options
// from data-* attributes, and exposes a small window.StabilType API for manual control.
// stabilType adapts typography (tracking, wght, opsz, slnt, opacity, 3D tilt) to scroll velocity
// via a built-in scroll listener — it mutates only inline styles, never the element's markup.
import { startStabilType, removeStabilType } from '../core/adjust'
import type { StabilTypeOptions } from '../core/types'

/** Attribute that opts an element in to motion-adaptive typography. */
const OPT_IN_ATTR = 'data-stabiltype'

/** Per-element teardown record so destroy() can stop the loop and restore inline styles. */
interface Instance {
	/** Stop function returned by startStabilType — cancels the rAF loop and restores styles. */
	stop: () => void
}

/** Tracks live instances keyed by their element — WeakMap so removed nodes are GC'd. */
const INSTANCES = new WeakMap<HTMLElement, Instance>()

/**
 * Parse a two-number range from a comma-separated attribute (e.g. "300,600").
 * Returns undefined when the value is missing or does not yield exactly two finite numbers,
 * so the caller falls through to the library default.
 *
 * @param raw - Raw attribute value, or undefined when unset
 */
function parseRange(raw: string | undefined): [number, number] | undefined {
	if (!raw) return undefined
	const parts = raw.split(',').map((s) => parseFloat(s.trim()))
	if (parts.length !== 2 || parts.some((n) => isNaN(n))) return undefined
	return [parts[0], parts[1]]
}

/**
 * Read stabilType options from an element's data-* attributes.
 * Unset or malformed attributes fall through to the library defaults.
 *
 * Supported attributes (prefix data-st-):
 *   data-st-tracking-range  — letter-spacing em range "atRest,atMax"      (default "0,0.06")
 *   data-st-weight-range    — wght axis range "atRest,atMax"              (default "300,600")
 *   data-st-opsz-range      — opsz axis range "atRest,atMax"             (default "12,24")
 *   data-st-opacity-range   — opacity range "atRest,atMax"               (default "1,0.7")
 *   data-st-slnt-range      — slnt axis range "peakUp,peakDown"          (default "8,-8")
 *   data-st-smoothing       — EMA factor 0–1, higher = snappier          (default 0.15)
 *   data-st-velocity-max    — px/frame mapping to max adjustment          (default 15)
 *   data-st-perspective     — CSS perspective depth in px at peak, 0=off  (default 600)
 *   data-st-tilt            — rotateX/rotateY tilt in degrees at peak      (default 3)
 *   data-st-weight-axis     — variable font weight axis tag               (default "wght")
 *   data-st-opsz-axis       — variable font optical size axis tag         (default "opsz")
 *   data-st-slnt-axis       — variable font slant axis tag                (default "slnt")
 *   data-st-live-base-fvs   — "true" to re-read cascade FVS every frame   (default false)
 *
 * @param el - The opted-in element
 */
function readOptions(el: HTMLElement): StabilTypeOptions {
	const d = el.dataset
	const opts: StabilTypeOptions = {}

	const trackingRange = parseRange(d.stTrackingRange)
	if (trackingRange) opts.trackingRange = trackingRange
	const weightRange = parseRange(d.stWeightRange)
	if (weightRange) opts.weightRange = weightRange
	const opszRange = parseRange(d.stOpszRange)
	if (opszRange) opts.opszRange = opszRange
	const opacityRange = parseRange(d.stOpacityRange)
	if (opacityRange) opts.opacityRange = opacityRange
	const slntRange = parseRange(d.stSlntRange)
	if (slntRange) opts.slntRange = slntRange

	if (d.stSmoothing !== undefined) { const n = parseFloat(d.stSmoothing); if (!isNaN(n)) opts.smoothing = n }
	if (d.stVelocityMax !== undefined) { const n = parseFloat(d.stVelocityMax); if (!isNaN(n)) opts.velocityMax = n }
	if (d.stPerspective !== undefined) { const n = parseFloat(d.stPerspective); if (!isNaN(n)) opts.perspective = n }
	if (d.stTilt !== undefined) { const n = parseFloat(d.stTilt); if (!isNaN(n)) opts.tilt = n }

	if (d.stWeightAxis) opts.weightAxis = d.stWeightAxis
	if (d.stOpszAxis) opts.opszAxis = d.stOpszAxis
	if (d.stSlntAxis) opts.slntAxis = d.stSlntAxis

	if (d.stLiveBaseFvs === 'true') opts.liveBaseFVS = true

	return opts
}

/**
 * Initialise a single element: start the built-in scroll-velocity loop.
 * Idempotent — re-initialising an element tears down the previous instance first.
 * The core skips the loop entirely under prefers-reduced-motion (returns a no-op stop).
 *
 * @param el - Element to animate
 */
function initElement(el: HTMLElement): void {
	// Tear down any previous run so re-init doesn't stack scroll listeners.
	destroy(el)

	const stop = startStabilType(el, readOptions(el))
	INSTANCES.set(el, { stop })
}

/**
 * Stop and restore a single element if it has a live instance.
 * The stop function returned by startStabilType already calls removeStabilType,
 * but we also call it directly as a safety net for the reduced-motion no-op case.
 *
 * @param el - Element previously initialised
 */
function destroy(el: HTMLElement): void {
	const inst = INSTANCES.get(el)
	if (!inst) return
	inst.stop()
	removeStabilType(el)
	INSTANCES.delete(el)
}

/**
 * Scan a root for opted-in elements and initialise each one.
 *
 * @param root - Element or document to search (default: document)
 */
function init(root: ParentNode = document): void {
	root.querySelectorAll<HTMLElement>(`[${OPT_IN_ATTR}]`).forEach(initElement)
}

/**
 * Auto-initialise once the DOM is parsed and web fonts have loaded.
 * Fonts must settle first: the variable-axis effects (wght, opsz, slnt) depend on
 * final glyph metrics, which shift when a web font swaps in.
 */
function autoInit(): void {
	const run = () => {
		if (document.fonts?.ready) {
			document.fonts.ready.then(() => init()).catch(() => init())
		} else {
			init()
		}
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', run, { once: true })
	} else {
		run()
	}
}

autoInit()

// Public browser API — assigned to window.StabilType via the IIFE global name.
export { init, destroy }
