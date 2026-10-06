// stabilType/src/react/useStabilType.ts — React hook for stabilType: runs the shared loop on the element
// with the latest velocity, so the text eases to each new value and all the way back to rest.
import { useEffect, useRef, type RefObject } from 'react'
import { startStabilType } from '../core/adjust'
import type { StabilTypeOptions, Velocity2D } from '../core/types'

/**
 * React hook that applies motion-adaptive typography to a referenced element. The velocity is read every
 * frame, so the text keeps easing (and returns fully to rest) between renders. Restarts when the options
 * or the element change; stops and restores the element on unmount.
 *
 * @param ref      - Ref to the target HTMLElement
 * @param velocity - Signed scalar –1…+1 or Velocity2D { x, y } (the latest render's value is used)
 * @param options  - StabilTypeOptions
 */
export function useStabilType(ref: RefObject<HTMLElement | null>, velocity: number | Velocity2D, options?: StabilTypeOptions): void {
	const velocityRef = useRef(velocity)
	velocityRef.current = velocity
	const optionsKey = JSON.stringify(options ?? {})
	const running = useRef<{ el: HTMLElement; key: string; stop: () => void } | null>(null)

	// Every render: (re)start when the element or the options changed.
	useEffect(() => {
		const el = ref.current
		const current = running.current
		if (current && current.el === el && current.key === optionsKey) return
		current?.stop()
		running.current = null
		if (!el) return
		const stop = startStabilType(el, () => velocityRef.current, JSON.parse(optionsKey) as StabilTypeOptions)
		running.current = { el, key: optionsKey, stop }
	})

	// Stop on unmount.
	useEffect(() => () => {
		running.current?.stop()
		running.current = null
	}, [])
}
