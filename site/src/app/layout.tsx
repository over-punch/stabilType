import type { Metadata } from "next"
import "./globals.css"
import SiteHeader from "../components/SiteHeader"

export const metadata: Metadata = {
	title: "stabilType — Motion-adaptive variable font typography",
	icons: { icon: "/icon.svg", shortcut: "/icon.svg", apple: "/icon.svg" },
	description: "stabilType adapts letter-spacing, weight, optical size, slant, and perspective tilt in real time based on scroll velocity and device motion. Zero dependencies.",
	keywords: ["typography", "variable font", "motion", "scroll velocity", "device motion", "gyroscope", "smart glasses", "AR", "XR", "wght", "opsz", "slnt", "letter-spacing", "TypeScript", "npm", "react"],
	openGraph: {
		title: "stabilType — Motion-adaptive variable font typography",
		description: "Adapts letter-spacing, weight, optical size, slant, and perspective tilt in real time based on scroll velocity and device motion. For web, smart glasses, and AR.",
		url: "https://stabiltype.com",
		siteName: "stabilType",
		type: "website",
		images: [{ url: "https://stabiltype.com/opengraph-image.png", width: 1200, height: 630, alt: "stabilType — Motion-adaptive variable font typography" }],
	},
	twitter: {
		card: "summary_large_image",
		title: "stabilType — Motion-adaptive variable font typography",
		description: "Adapts letter-spacing, weight, optical size, and perspective tilt in real time based on scroll velocity and device motion.",
		images: [{ url: "https://stabiltype.com/opengraph-image.png", alt: "stabilType — Motion-adaptive variable font typography" }],
	},
	metadataBase: new URL("https://stabiltype.com"),
	alternates: { canonical: "https://stabiltype.com" },
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
	return (
		<html lang="en" className="h-full antialiased">
			<body className="min-h-full flex flex-col">
				<SiteHeader current="stabilType" githubUrl="https://github.com/Liiift-Studio/stabilType" />{children}</body>
		</html>
	)
}
