// stabilType/src/__tests__/adjust.test.ts — unit tests for the stabilType core algorithm

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { applyStabilType, removeStabilType, startStabilType, lerp, overrideAxis } from '../core/adjust'

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Create a minimal HTMLElement mock with trackable style properties */
function makeEl(): HTMLElement {
	const style: Record<string, string> = {
		fontVariationSettings: '',
		letterSpacing: '',
		opacity: '',
	}
	return {
		style,
		getAttribute: () => null,
	} as unknown as HTMLElement
}

// ─── lerp ────────────────────────────────────────────────────────────────────

describe('lerp', () => {
	it('returns a at t=0', () => {
		expect(lerp(10, 20, 0)).toBe(10)
	})
	it('returns b at t=1', () => {
		expect(lerp(10, 20, 1)).toBe(20)
	})
	it('returns midpoint at t=0.5', () => {
		expect(lerp(0, 100, 0.5)).toBe(50)
	})
	it('clamps t below 0', () => {
		expect(lerp(10, 20, -1)).toBe(10)
	})
	it('clamps t above 1', () => {
		expect(lerp(10, 20, 2)).toBe(20)
	})
})

// ─── overrideAxis ────────────────────────────────────────────────────────────

describe('overrideAxis', () => {
	it('creates a new FVS string from empty/normal', () => {
		expect(overrideAxis('', 'wght', 400)).toBe('"wght" 400')
		expect(overrideAxis('normal', 'wght', 400)).toBe('"wght" 400')
	})
	it('appends a new axis when not present', () => {
		expect(overrideAxis('"wght" 300', 'opsz', 18)).toBe('"wght" 300, "opsz" 18')
	})
	it('overrides an existing axis value', () => {
		expect(overrideAxis('"wght" 300, "opsz" 12', 'wght', 600)).toBe('"wght" 600, "opsz" 12')
	})
})

// ─── applyStabilType ─────────────────────────────────────────────────────────

describe('applyStabilType', () => {
	beforeEach(() => {
		// Stub getComputedStyle to return empty FVS
		vi.stubGlobal('getComputedStyle', () => ({
			fontVariationSettings: 'normal',
			fontSize: '16px',
		}))
		vi.stubGlobal('window', { scrollY: 0 })
	})

	it('at velocity 0 applies rest values', () => {
		const el = makeEl()
		applyStabilType(el, 0, {
			trackingRange: [0, 0.06],
			weightRange: [300, 600],
			opszRange: [12, 24],
			opacityRange: [1, 0.7],
			smoothing: 0, // no smoothing so values are immediate
		})
		// Smoothed velocity should move toward 0
		expect(el.style.letterSpacing).toMatch(/^0\./)
		// opacity should be close to 1
		const opacity = parseFloat(el.style.opacity)
		expect(opacity).toBeGreaterThan(0.95)
	})

	it('at velocity 1 after many calls applies near-max values', () => {
		const el = makeEl()
		// Call many times at velocity 1 to let EMA converge
		for (let i = 0; i < 100; i++) {
			applyStabilType(el, 1, {
				trackingRange: [0, 0.06],
				weightRange: [300, 600],
				opszRange: [12, 24],
				opacityRange: [1, 0.7],
				smoothing: 0.15,
			})
		}
		const ls = parseFloat(el.style.letterSpacing)
		const opacity = parseFloat(el.style.opacity)
		expect(ls).toBeGreaterThan(0.05)
		expect(opacity).toBeLessThan(0.75)
		// FVS should contain wght close to 600
		expect(el.style.fontVariationSettings).toContain('"wght"')
		expect(el.style.fontVariationSettings).toContain('"opsz"')
	})

	it('uses custom axis tags', () => {
		const el = makeEl()
		applyStabilType(el, 1, {
			weightAxis: 'WGHT',
			opszAxis: 'OPSZ',
			smoothing: 1, // 1 = snap to the input (0 would freeze the velocity at rest)
		})
		expect(el.style.fontVariationSettings).toContain('"WGHT"')
		expect(el.style.fontVariationSettings).toContain('"OPSZ"')
	})
})

// ─── startStabilType ─────────────────────────────────────────────────────────

describe('startStabilType — getVelocity callback form', () => {
	beforeEach(() => {
		vi.stubGlobal('getComputedStyle', () => ({ fontVariationSettings: 'normal', fontSize: '16px' }))
		// happy-dom doesn't implement matchMedia — stub it on window directly
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			configurable: true,
			value: (_query: string) => ({ matches: false }),
		})
		// Fire the first rAF callback once synchronously, then return an ID for all
		// subsequent calls without invoking them (prevents infinite recursion).
		let firstCall = true
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
			if (firstCall) { firstCall = false; cb(0) }
			return 1
		})
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
	})

	afterEach(() => { vi.unstubAllGlobals() })

	it('calls getVelocity on each frame and applies styles', () => {
		const el = makeEl()
		const getVelocity = vi.fn(() => 0.5)
		const stop = startStabilType(el, getVelocity)
		expect(getVelocity).toHaveBeenCalled()
		// After applying velocity=0.5, FVS should have been written
		expect(el.style.fontVariationSettings).toContain('"wght"')
		stop()
	})

	it('cleanup calls cancelAnimationFrame and removeStabilType', () => {
		const el = makeEl()
		// Use a rAF that only returns an ID without firing the callback
		vi.stubGlobal('requestAnimationFrame', (_cb: FrameRequestCallback) => 42)
		const stop = startStabilType(el, () => 0)
		stop()
		expect(cancelAnimationFrame).toHaveBeenCalledWith(42)
	})

	it('is a no-op when prefers-reduced-motion is set', () => {
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			configurable: true,
			value: (_query: string) => ({ matches: true }),
		})
		const el = makeEl()
		const getVelocity = vi.fn(() => 1)
		const stop = startStabilType(el, getVelocity)
		// Loop should not have started — getVelocity never called
		expect(getVelocity).not.toHaveBeenCalled()
		// stop should be a no-op function
		expect(() => stop()).not.toThrow()
	})
})

describe('startStabilType — built-in scroll form', () => {
	let origAddEventListener: typeof window.addEventListener
	let origRemoveEventListener: typeof window.removeEventListener

	beforeEach(() => {
		vi.stubGlobal('getComputedStyle', () => ({ fontVariationSettings: 'normal', fontSize: '16px' }))
		Object.defineProperty(window, 'matchMedia', {
			writable: true,
			configurable: true,
			value: (_query: string) => ({ matches: false }),
		})
		vi.stubGlobal('requestAnimationFrame', (_cb: FrameRequestCallback) => 1)
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
		// Spy on window event listener methods
		origAddEventListener    = window.addEventListener
		origRemoveEventListener = window.removeEventListener
		window.addEventListener    = vi.fn()
		window.removeEventListener = vi.fn()
	})

	afterEach(() => {
		window.addEventListener    = origAddEventListener
		window.removeEventListener = origRemoveEventListener
		vi.unstubAllGlobals()
	})

	it('adds one shared scroll listener (capturing scrolls from any container) on start', () => {
		const add = vi.spyOn(document, 'addEventListener')
		const el = makeEl()
		const stop = startStabilType(el)
		expect(add).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true, passive: true })
		stop()
	})

	it('cleanup removes the scroll listener when the last element stops', () => {
		const remove = vi.spyOn(document, 'removeEventListener')
		const el = makeEl()
		const stop = startStabilType(el)
		stop()
		expect(remove).toHaveBeenCalledWith('scroll', expect.any(Function), { capture: true })
	})
})

// ─── removeStabilType ────────────────────────────────────────────────────────

describe('removeStabilType', () => {
	beforeEach(() => {
		vi.stubGlobal('getComputedStyle', () => ({
			fontVariationSettings: 'normal',
			fontSize: '16px',
		}))
		vi.stubGlobal('window', { scrollY: 0 })
	})

	it('restores original inline styles', () => {
		const el = makeEl()
		el.style.fontVariationSettings = '"wght" 350'
		el.style.letterSpacing = '0.02em'
		el.style.opacity = '0.9'

		applyStabilType(el, 0.5, { smoothing: 1 })
		// Styles should have been changed
		expect(el.style.fontVariationSettings).not.toBe('"wght" 350')

		removeStabilType(el)
		// Styles should be restored
		expect(el.style.fontVariationSettings).toBe('"wght" 350')
		expect(el.style.letterSpacing).toBe('0.02em')
		expect(el.style.opacity).toBe('0.9')
	})

	it('is a no-op if applyStabilType was never called', () => {
		const el = makeEl()
		el.style.opacity = '1'
		// Should not throw
		removeStabilType(el)
		expect(el.style.opacity).toBe('1')
	})
})

// ─── Review fixes (2026-10) ──────────────────────────────────────────────────

describe('review fixes', () => {
	afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })

	/** A real element in the document. */
	function realEl(): HTMLElement {
		const el = document.createElement('p')
		el.textContent = 'Typography in motion'
		document.body.appendChild(el)
		return el
	}

	it("returns to the author's own styles at rest (no inline styles, no transform)", () => {
		const el = realEl()
		for (let i = 0; i < 5; i++) applyStabilType(el, 1, { smoothing: 1 })
		expect(el.style.transform).not.toBe('')
		applyStabilType(el, 0, { smoothing: 1 })
		expect(el.getAttribute('style')).toBeNull()
	})

	it('a NaN velocity counts as 0 and does not poison later frames', () => {
		const el = realEl()
		applyStabilType(el, NaN, { smoothing: 1 })
		applyStabilType(el, 0.5, { smoothing: 1 })
		expect(el.style.fontVariationSettings).toContain('"wght"')
	})

	it('rejects axis tags that are not four letters, with a warning', () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
		const el = realEl()
		applyStabilType(el, 1, { smoothing: 1, weightAxis: 'wght" 900, "XOPQ' })
		expect(el.style.fontVariationSettings).not.toContain('XOPQ')
		expect(warn).toHaveBeenCalled()
	})

	it('clamps opacity ranges and tilt', () => {
		const el = realEl()
		applyStabilType(el, 1, { smoothing: 1, opacityRange: [1, -5], tilt: 1e6 })
		expect(parseFloat(el.style.opacity)).toBe(0)
		expect(el.style.transform).toContain('rotateX(-45')
	})

	it('removeStabilType stops a running loop', () => {
		Object.defineProperty(window, 'matchMedia', { writable: true, configurable: true, value: () => ({ matches: false }) })
		let pending: FrameRequestCallback | null = null
		vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { pending = cb; return 7 })
		vi.stubGlobal('cancelAnimationFrame', vi.fn())
		const el = realEl()
		startStabilType(el, () => 1, { smoothing: 1 })
		removeStabilType(el)
		const cb = pending as FrameRequestCallback | null
		cb?.(16)
		expect(el.getAttribute('style')).toBeNull()
	})
})
