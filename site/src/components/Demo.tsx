"use client"

// Demo: scroll velocity (both axes) drives perspective compression, directional tilt, and font adaptation
import { useState, useEffect, useRef, useCallback } from "react"
import { startStabilType } from "@liiift-studio/stabiltype"
import type { StabilTypeOptions, Velocity2D } from "@liiift-studio/stabiltype"

// Hoisted regex constants — reused each rAF tick rather than re-created
const RE_PERSPECTIVE = /perspective\((\d+)px\)/
const RE_ROTATE_X    = /rotateX\(([-.0-9]+)deg\)/
const RE_ROTATE_Y    = /rotateY\(([-.0-9]+)deg\)/
const RE_WGHT        = /"wght"\s+([\d.]+)/
const RE_TRACKING    = /([-.0-9]+)em/

const PARA_1 = "Typography has always assumed a fixed observer. The reader is still, the page is still, and every spacing decision optimises for that arrangement. But text increasingly appears in motion — on phones jostled by footsteps, on smart glasses updating while the wearer turns, on dashboards alive with road vibration."

const PARA_2 = "stabilType acknowledges the moving reader. Scroll this page to feel the perspective compress and the text plane tilt in the direction of travel. Move diagonally and both axes respond simultaneously. Everything decays the moment motion stops — a fleeting impression of the force applied, then stillness."

const OPTIONS: StabilTypeOptions = {
	trackingRange: [0, 0.07],
	weightRange: [300, 650],
	opszRange: [12, 24],
	opacityRange: [1, 1],
	perspective: 550,
	tilt: 5,
	slntRange: [6, -6],
	smoothing: 0.12,
	velocityMax: 18,
}

function CursorIcon() {
	return (
		<svg width="11" height="14" viewBox="0 0 11 14" fill="currentColor" aria-hidden>
			<path d="M0 0L0 11L3 8L5 13L6.8 12.3L4.8 7.3L8.5 7.3Z" />
		</svg>
	)
}

function GyroIcon() {
	return (
		<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
			<circle cx="7" cy="7" r="5.5" />
			<circle cx="7" cy="7" r="1.5" fill="currentColor" stroke="none" />
			<path d="M7 1.5 A5.5 5.5 0 0 1 12.5 7" />
			<path d="M11.5 5.5 L12.5 7 L13.8 6" strokeWidth="1.2" />
		</svg>
	)
}

export default function Demo() {
	const cardRef = useRef<HTMLDivElement>(null)
	const externalVRef = useRef<Velocity2D>({ x: 0, y: 0 })

	const [cursorMode, setCursorMode] = useState(false)
	const [gyroMode, setGyroMode] = useState(false)
	const [showCursor, setShowCursor] = useState(false)
	const [showGyro, setShowGyro] = useState(false)

	useEffect(() => {
		setShowCursor(window.matchMedia('(hover: hover)').matches)
		setShowGyro(window.matchMedia('(hover: none)').matches && 'DeviceMotionEvent' in window)
	}, [])

	// Wire startStabilType — swap between built-in scroll and external source on mode change
	useEffect(() => {
		const el = cardRef.current
		if (!el) return
		if (cursorMode || gyroMode) {
			return startStabilType(el, () => externalVRef.current, OPTIONS)
		}
		return startStabilType(el, OPTIONS)
	}, [cursorMode, gyroMode])

	// Cursor mode: viewport-relative signed 2D position
	useEffect(() => {
		if (!cursorMode) return
		const onMove = (e: MouseEvent) => {
			externalVRef.current = {
				x: (e.clientX / window.innerWidth - 0.5) * 2,
				y: (e.clientY / window.innerHeight - 0.5) * 2,
			}
		}
		const onKey = (e: KeyboardEvent) => {
			if (e.key === 'Escape') {
				setCursorMode(false)
				externalVRef.current = { x: 0, y: 0 }
			}
		}
		window.addEventListener('mousemove', onMove)
		window.addEventListener('keydown', onKey)
		return () => {
			window.removeEventListener('mousemove', onMove)
			window.removeEventListener('keydown', onKey)
			externalVRef.current = { x: 0, y: 0 }
		}
	}, [cursorMode])

	// Gyro mode: device acceleration → signed 2D velocity
	useEffect(() => {
		if (!gyroMode) return
		let rafId: number | null = null
		const onMotion = (e: DeviceMotionEvent) => {
			const acc = e.acceleration
			if (!acc) return
			externalVRef.current = {
				x: Math.max(-1, Math.min(1, (acc.x ?? 0) / 10)),
				y: Math.max(-1, Math.min(1, (acc.y ?? 0) / 10)),
			}
			if (rafId !== null) return
			rafId = requestAnimationFrame(() => { rafId = null })
		}
		window.addEventListener('devicemotion', onMotion)
		return () => {
			window.removeEventListener('devicemotion', onMotion)
			externalVRef.current = { x: 0, y: 0 }
			if (rafId !== null) cancelAnimationFrame(rafId)
		}
	}, [gyroMode])

	const [gyroDenied, setGyroDenied] = useState(false)

	const toggleCursor = useCallback(() => {
		setGyroMode(false)
		setCursorMode(v => !v)
	}, [])

	const toggleGyro = useCallback(async () => {
		if (gyroMode) { setGyroMode(false); return }
		setCursorMode(false)
		setGyroDenied(false)
		const DME = DeviceMotionEvent as typeof DeviceMotionEvent & {
			requestPermission?: () => Promise<PermissionState>
		}
		try {
			if (typeof DME.requestPermission === 'function') {
				const perm = await DME.requestPermission()
				if (perm === 'granted') {
					setGyroMode(true)
				} else {
					setGyroDenied(true)
				}
			} else {
				setGyroMode(true)
			}
		} catch {
			setGyroDenied(true)
		}
	}, [gyroMode])

	const activeMode = cursorMode || gyroMode

	return (
		<div className="w-full flex flex-col gap-8">

			{/* Controls */}
			<div className="flex flex-wrap items-center justify-between gap-4">
				<p className="text-xs opacity-40 italic flex-1" aria-live="polite" aria-atomic="true">
					{cursorMode
						? 'Move cursor across the screen — center is neutral, corners are max. Press Esc to exit.'
						: gyroMode
							? 'Move your device to drive the effect.'
							: gyroDenied
								? 'Motion access was denied. Re-enable it in your browser settings and try again.'
								: '↕↔ Scroll this page to feel the effect'}
				</p>

				<div className="flex items-center gap-3">
					{showCursor && (
						<button
							onClick={toggleCursor}
							aria-pressed={cursorMode}
							title="Switch to cursor mode: move your cursor across the screen to tilt the text plane and shift font weight — center is neutral, corners are maximum effect. Press Esc to exit."
							className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all"
							style={{
								borderColor: 'currentColor',
								opacity: cursorMode ? 1 : 0.5,
								background: cursorMode ? 'var(--btn-bg)' : 'transparent',
							}}
						>
							<CursorIcon />
							<span>{cursorMode ? 'Esc to exit' : 'Cursor'}</span>
						</button>
					)}
					{showGyro && (
						<button
							onClick={toggleGyro}
							aria-pressed={gyroMode}
							title="Switch to gyro mode: tilt your device to drive the effect — the accelerometer feeds live motion into stabilType, adjusting font weight and perspective to counteract perceived tilt."
							className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full border transition-all"
							style={{
								borderColor: 'currentColor',
								opacity: gyroMode ? 1 : 0.5,
								background: gyroMode ? 'var(--btn-bg)' : 'transparent',
							}}
						>
							<GyroIcon />
							<span>{gyroMode ? 'Motion active' : 'Gyro'}</span>
						</button>
					)}
				</div>
			</div>

			{/* Text card — stabilType applied to this element; whole card tilts */}
			<div
				ref={cardRef}
				className="rounded-lg p-6 flex flex-col gap-5"
				style={{
					background: 'color-mix(in oklch, var(--foreground) 4%, transparent)',
					border: '1px solid color-mix(in oklch, var(--foreground) 12%, transparent)',
					transformOrigin: 'center center',
					willChange: 'transform',
				}}
			>
				<p style={{
					fontFamily: 'var(--font-merriweather), serif',
					fontSize: 'clamp(1rem, 2.5vw, 1.35rem)',
					lineHeight: 1.7,
					margin: 0,
				}}>
					{PARA_1}
				</p>
				<p style={{
					fontFamily: 'var(--font-merriweather), serif',
					fontSize: 'clamp(1rem, 2.5vw, 1.35rem)',
					lineHeight: 1.7,
					margin: 0,
					opacity: 0.65,
				}}>
					{PARA_2}
				</p>
			</div>

			{/* Live readout */}
			<LiveReadout cardRef={cardRef} activeMode={activeMode} />
		</div>
	)
}

/** Polls el.style directly each frame — always matches what's applied */
function LiveReadout({
	cardRef,
	activeMode,
}: {
	cardRef: React.RefObject<HTMLDivElement | null>
	activeMode: boolean
}) {
	const [vals, setVals] = useState({
		perspective: 5000,
		rotateX: 0,
		rotateY: 0,
		wght: 300,
		tracking: 0,
	})

	useEffect(() => {
		let rafId: number
		const tick = () => {
			rafId = requestAnimationFrame(tick)
			const el = cardRef.current
			if (!el) return
			const transform = el.style.transform ?? ''
			const fvs = el.style.fontVariationSettings ?? ''
			const ls = el.style.letterSpacing ?? ''
			const nextPerspective = parseInt(transform.match(RE_PERSPECTIVE)?.[1] ?? '5000', 10)
			const nextRotateX     = parseFloat(transform.match(RE_ROTATE_X)?.[1] ?? '0')
			const nextRotateY     = parseFloat(transform.match(RE_ROTATE_Y)?.[1] ?? '0')
			const nextWght        = parseFloat(fvs.match(RE_WGHT)?.[1] ?? '300')
			const nextTracking    = parseFloat(ls.match(RE_TRACKING)?.[1] ?? '0')
			// Skip re-render when values are unchanged
			setVals(prev => {
				if (
					prev.perspective === nextPerspective &&
					prev.rotateX === nextRotateX &&
					prev.rotateY === nextRotateY &&
					prev.wght === nextWght &&
					prev.tracking === nextTracking
				) return prev
				return { perspective: nextPerspective, rotateX: nextRotateX, rotateY: nextRotateY, wght: nextWght, tracking: nextTracking }
			})
		}
		rafId = requestAnimationFrame(tick)
		return () => cancelAnimationFrame(rafId)
	}, [cardRef])

	// Normalise tilt to –1…+1 for the indicator dot
	const TILT_MAX = OPTIONS.tilt ?? 5
	const dotX = Math.max(-1, Math.min(1, vals.rotateY / TILT_MAX))
	const dotY = Math.max(-1, Math.min(1, -vals.rotateX / TILT_MAX))

	return (
		<div className="flex items-center gap-6" aria-hidden="true">
			{/* Direction indicator — decorative; numeric values below convey the same info */}
			<div
				aria-hidden="true"
				style={{
					width: 40,
					height: 40,
					borderRadius: '50%',
					border: '1px solid var(--panel)',
					position: 'relative',
					flexShrink: 0,
				}}
			>
				<div aria-hidden="true" style={{
					width: 6,
					height: 6,
					borderRadius: '50%',
					background: 'color-mix(in oklch, var(--foreground) 80%, transparent)',
					position: 'absolute',
					top: '50%',
					left: '50%',
					transform: `translate(calc(-50% + ${dotX * 13}px), calc(-50% + ${dotY * 13}px))`,
					transition: 'transform 40ms linear',
				}} />
			</div>

			{/* Numeric values */}
			<div className="flex flex-wrap gap-x-6 gap-y-1 text-xs opacity-50 font-mono tabular-nums">
				<span>perspective: {vals.perspective}px</span>
				<span>rotateX: {vals.rotateX.toFixed(1)}°</span>
				<span>rotateY: {vals.rotateY.toFixed(1)}°</span>
				<span>wght: {vals.wght.toFixed(0)}</span>
				<span>tracking: {vals.tracking.toFixed(4)}em</span>
			</div>
		</div>
	)
}
