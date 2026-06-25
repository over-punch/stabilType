// OG image for stabiltype.com — generated at build time via next/og
// Satori (used by ImageResponse) supports TTF and WOFF but not WOFF2.
import { ImageResponse } from 'next/og'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'

export const alt = 'stabilType — Motion-adaptive variable font typography'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function Image() {
	const interLightBuf = await readFile(join(process.cwd(), 'public/fonts/inter-300.woff'))
	const interLight = interLightBuf.buffer as ArrayBuffer
	return new ImageResponse(
		(
			<div style={{ background: '#00395d', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '72px 80px', fontFamily: 'Inter, sans-serif' }}>
				{/* Label */}
				<span style={{ fontSize: 13, letterSpacing: '0.18em', color: '#afc1cc', textTransform: 'uppercase' }}>stabiltype</span>

				{/* Motion bar preview + headline */}
				<div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
					<div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 48 }}>
						{[0.4, 0.7, 1.0].map((scale, i) => (
							<div key={i} style={{ width: `${30 + scale * 70}%`, height: 4, background: i === 2 ? '#afc1cc' : '#727c82', borderRadius: 2 }} />
						))}
					</div>
					<div style={{ fontSize: 76, color: '#f0f6fa', lineHeight: 1.06, fontWeight: 300 }}>Motion adapts</div>
					<div style={{ fontSize: 76, color: '#afc1cc', lineHeight: 1.06, fontWeight: 300, fontStyle: 'italic' }}>your type.</div>
				</div>

				{/* Footer */}
				<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
					<div style={{ fontSize: 14, color: '#afc1cc', letterSpacing: '0.04em', display: 'flex', gap: 20 }}>
						<span>TypeScript</span><span style={{ opacity: 0.4 }}>·</span>
						<span>Zero dependencies</span><span style={{ opacity: 0.4 }}>·</span>
						<span>React + Vanilla JS</span>
					</div>
					<div style={{ fontSize: 13, color: '#8d9ba3', letterSpacing: '0.04em' }}>stabiltype.com</div>
				</div>
			</div>
		),
		{ ...size, fonts: [{ name: 'Inter', data: interLight, style: 'normal' as const, weight: 300 }] },
	)
}
