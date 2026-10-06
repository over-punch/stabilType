// stabilType/src/react/StabilTypeText.tsx — React component wrapper for stabilType
"use client"
import { useRef, type ElementType } from 'react'
import { useStabilType } from './useStabilType'
import type { StabilTypeOptions, Velocity2D } from '../core/types'

/** Props for the StabilTypeText component: options, velocity, and HTML attributes for the element */
interface StabilTypeTextProps extends StabilTypeOptions, Omit<React.HTMLAttributes<HTMLElement>, 'children' | 'className' | 'style'> {
	/** Signed scalar –1…+1 or Velocity2D { x, y } driving the typographic adaptation */
	velocity: number | Velocity2D
	/** HTML element to render. Default: 'p' */
	as?: ElementType
	/** Text content */
	children: React.ReactNode
	/** Inline styles passed through to the element */
	style?: React.CSSProperties
	/** Class name passed through to the element */
	className?: string
}

/** StabilTypeOptions keys: consumed by the hook, not forwarded to the DOM element. */
const OPTION_KEYS: (keyof StabilTypeOptions)[] = [
	'trackingRange', 'weightRange', 'opszRange', 'opacityRange', 'smoothing', 'weightAxis', 'opszAxis', 'velocityMax',
	'perspective', 'tilt', 'slntRange', 'slntAxis', 'liveBaseFVS',
]

/**
 * Drop-in React component that adapts its typography in real time to a normalised velocity prop
 * (0 = at rest, ±1 = max velocity). HTML attributes (id, aria-*, data-*, lang, event handlers…) are
 * forwarded to the element.
 */
export function StabilTypeText({ velocity, as: Tag = 'p', children, style, className, ...rest }: StabilTypeTextProps) {
	const options: StabilTypeOptions = {}
	const htmlProps: Record<string, unknown> = {}
	for (const [key, value] of Object.entries(rest)) {
		if ((OPTION_KEYS as string[]).includes(key)) (options as Record<string, unknown>)[key] = value
		else htmlProps[key] = value
	}
	const ref = useRef<HTMLElement>(null)
	useStabilType(ref as React.RefObject<HTMLElement | null>, velocity, options)
	return <Tag ref={ref} style={style} className={className} {...htmlProps}>{children}</Tag>
}
