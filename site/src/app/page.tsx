import Demo from "@/components/Demo"
import CopyInstall from "@/components/CopyInstall"
import CodeBlock from "@/components/CodeBlock"
import ToolDirectory from "@/components/ToolDirectory"
import { version } from "../../../package.json"
import { version as siteVersion } from "../../package.json"
import SiteFooter from "../components/SiteFooter"
import { MagnetChar } from "@liiift-studio/magnettype"

export default function Home() {
	return (
		<main className="flex flex-col items-center px-6 py-20 gap-24">

			{/* Hero */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex flex-col gap-2">
					<p className="text-xs uppercase tracking-[0.18em] font-medium text-muted">stabiltype</p>
					<h1 className="text-4xl lg:text-8xl xl:text-9xl" style={{ fontFamily: "var(--font-merriweather), serif", fontVariationSettings: '"wght" 300, "opsz" 144', lineHeight: "1.05em" }}>
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }}>Motion adapts</MagnetChar><br />
						<MagnetChar as="span" minWeight={300} maxWeight={800} spreadRadius={220} fixedAxes={{ opsz: 144 }} style={{ color: "var(--foreground-subtle)", fontStyle: "italic" }}>your type.</MagnetChar>
					</h1>
				</div>
				<div className="flex items-center gap-4">
					<CopyInstall />
					<a
						href="https://github.com/Liiift-Studio/StabilType"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="StabilType on GitHub (opens in new tab)"
						className="text-sm text-muted hover:text-foreground transition-colors"
					>
						GitHub ↗
					</a>
				</div>
				<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted tracking-wide">
					<span>TypeScript</span><span aria-hidden="true">·</span><span>Zero dependencies</span><span aria-hidden="true">·</span><span>React + Vanilla JS</span>
				</div>
				<p className="text-base leading-relaxed max-w-lg">
					On smart glasses, head motion creates perceptual blur on anchored text. CSS has no motion context — it can&rsquo;t adjust tracking or weight in response to velocity. stabilType bridges that gap, interpolating letter&#8209;spacing, wght, and opsz in real time as velocity changes.
				</p>
			</section>

			{/* Demo */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-4" aria-label="Live demo">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Live demo — scroll this page, or use cursor / gyro</h2>
				<div className="rounded-xl -mx-8 px-8 py-12" style={{ background: "rgba(0,0,0,0.25)" }}>
					<Demo />
				</div>
			</section>

			{/* Explanation */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">How it works</h2>
				<div className="prose-grid grid grid-cols-1 sm:grid-cols-2 gap-12 text-sm leading-relaxed">
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">Velocity in two dimensions</p>
						<p>stabilType tracks both vertical and horizontal scroll velocity, each as a signed value — downscroll and rightscroll are positive; upscroll and leftscroll are negative. The combined magnitude drives font adaptation. The sign drives direction-specific tilt and lean.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">Perspective compression + directional tilt</p>
						<p>As speed increases, a CSS <code className="text-xs font-mono">perspective()</code> function tightens — the text plane compresses toward the viewer, like a dolly zoom. Simultaneously, <code className="text-xs font-mono">rotateX</code> and <code className="text-xs font-mono">rotateY</code> tilt the element in the direction of travel. Both effects decay the moment scrolling stops.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">EMA smoothing prevents jitter</p>
						<p>Raw velocity signals are noisy. stabilType applies an exponential moving average before mapping velocity to type properties — so the typography transitions feel deliberate rather than jittery. The smoothing factor is tunable per element.</p>
					</div>
					<div className="flex flex-col gap-3">
						<p className="font-semibold text-base">Runs in a rAF loop or on demand</p>
						<p><code className="text-xs font-mono">startStabilType</code> wires up a <code className="text-xs font-mono">requestAnimationFrame</code> loop and accepts a <code className="text-xs font-mono">getVelocity</code> callback — connect your platform&rsquo;s IMU or head&#8209;tracking API directly. <code className="text-xs font-mono">applyStabilType</code> lets you drive it frame&#8209;by&#8209;frame from your own loop.</p>
					</div>
				</div>
			</section>

			{/* Usage */}
			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="flex items-baseline gap-4">
					<h2 className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Usage</h2>
					<p className="text-xs text-muted tracking-wide">TypeScript + React · Vanilla JS</p>
				</div>
				<div className="flex flex-col gap-8 text-sm">
					<div className="flex flex-col gap-3">
						<p className="text-muted">Drop-in component</p>
						<CodeBlock code={`import { StabilTypeText, useScrollVelocity } from '@liiift-studio/stabiltype'

// useScrollVelocity returns a Velocity2D ref updated each frame
const velocity = useScrollVelocity()

<StabilTypeText velocity={velocity}>
  Heading text
</StabilTypeText>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Hook — attach to any element</p>
						<CodeBlock code={`import { useStabilType, useScrollVelocity } from '@liiift-studio/stabiltype'
import { useRef } from 'react'

// useScrollVelocity returns a Velocity2D ref ({ x, y }) updated each frame
const velocity = useScrollVelocity()
const ref = useRef(null)
useStabilType(ref, velocity, { weightRange: [300, 700] })
<h1 ref={ref}>Heading text</h1>`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">rAF loop — vanilla JS with IMU callback</p>
						<CodeBlock code={`import { startStabilType } from '@liiift-studio/stabiltype'

const el = document.querySelector('h1')

// Built-in scroll listener — tracks both X and Y axes automatically
const stop = startStabilType(el, {
  trackingRange: [0, 0.06], // default
  weightRange: [300, 600],
  perspective: 600,
  tilt: 3, // default
})

// External 2D velocity source — e.g. IMU or pointer
const stop = startStabilType(el, () => ({ x: imu.vx, y: imu.vy }), options)

stop() // cancel loop and restore styles`} />
					</div>
					<div className="flex flex-col gap-3">
						<p className="text-muted">Options</p>
						<table className="w-full text-xs" aria-label="StabilTypeOptions reference">
							<caption className="sr-only">StabilTypeOptions reference</caption>
							<thead>
								<tr className="text-subtle text-left">
									<th className="pb-2 pr-6 font-normal">Option</th>
									<th className="pb-2 pr-6 font-normal">Default</th>
									<th className="pb-2 font-normal">Description</th>
								</tr>
							</thead>
							<tbody className="text-muted">
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">trackingRange</td><td className="py-2 pr-6">[0, 0.06]</td><td className="py-2">Letter-spacing range in em: [at rest, at max velocity].</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">weightRange</td><td className="py-2 pr-6">[300, 600]</td><td className="py-2">wght axis range: [at rest, at max velocity].</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">opszRange</td><td className="py-2 pr-6">[12, 24]</td><td className="py-2">opsz axis range: [at rest, at max velocity].</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">opacityRange</td><td className="py-2 pr-6">[1, 0.7]</td><td className="py-2">Opacity range: [at rest, at max velocity].</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">smoothing</td><td className="py-2 pr-6">0.15</td><td className="py-2">EMA weight of the new sample per frame, 0–1. Higher = faster response (less lag); 1 snaps instantly; 0 freezes.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">velocityMax</td><td className="py-2 pr-6">15</td><td className="py-2">Scroll velocity in px/frame that maps to maximum typography adjustment. Only used by <code className="font-mono text-xs">startStabilType</code> in built-in scroll mode — <code className="font-mono text-xs">applyStabilType</code> and <code className="font-mono text-xs">useStabilType</code> expect a pre-normalised –1…+1 velocity and ignore this option.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">weightAxis</td><td className="py-2 pr-6">&apos;wght&apos;</td><td className="py-2">Variable font weight axis tag.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">opszAxis</td><td className="py-2 pr-6">&apos;opsz&apos;</td><td className="py-2">Variable font optical size axis tag.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">perspective</td><td className="py-2 pr-6">600</td><td className="py-2">CSS perspective depth in px at peak velocity. Tighter = more dramatic compression. 0 to disable.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">tilt</td><td className="py-2 pr-6">3</td><td className="py-2">rotateX/rotateY in degrees at peak velocity. Sign follows scroll direction.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">slntRange</td><td className="py-2 pr-6">[8, -8]</td><td className="py-2">slnt axis range: [at peak upscroll, at peak downscroll]. No-op on fonts without a slnt axis.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">slntAxis</td><td className="py-2 pr-6">&apos;slnt&apos;</td><td className="py-2">Variable font slant axis tag.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">liveBaseFVS</td><td className="py-2 pr-6">false</td><td className="py-2">When false (default), font-variation-settings is read from the computed cascade once on activation and cached — eliminating a getComputedStyle() call per frame. Set to true only if external CSS dynamically changes font-variation-settings on the element after stabilType has started.</td></tr>
								<tr className="border-t border-foreground/10 hover:bg-foreground/5 transition-colors"><td className="py-2 pr-6 font-mono">as</td><td className="py-2 pr-6">&apos;p&apos;</td><td className="py-2">HTML element to render. (StabilTypeText only)</td></tr>
							</tbody>
						</table>
					</div>
				</div>
			</section>

			<section className="w-full max-w-2xl lg:max-w-5xl flex flex-col gap-6">
				<div className="prose-grid flex flex-col gap-4">
					<p className="text-xs uppercase tracking-[0.18em] font-medium text-muted">Accessibility</p>
					<p className="text-sm leading-relaxed">
						stabilType respects <code className="font-mono text-xs">prefers-reduced-motion</code> — when the user has requested reduced motion, <code className="font-mono text-xs">startStabilType</code> returns without installing the scroll listener or rAF loop, leaving the element unmodified.
					</p>
				</div>
			</section>

			<SiteFooter current="stabilType" npmVersion={version} siteVersion={siteVersion} />

		</main>
	)
}
