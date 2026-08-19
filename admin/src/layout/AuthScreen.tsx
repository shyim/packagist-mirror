import { CloudflareLogo, LayerCard, Text } from "@cloudflare/kumo";
import type { ReactNode } from "react";

export function AuthScreen({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) {
	return (
		<div className="auth-screen">
			<div className="auth-card">
				<div className="brand">
					<CloudflareLogo variant="glyph" color="color" className="brand-mark" />
					<div className="brand-copy">
						<span className="brand-name">Packagist</span>
						<span className="brand-sub">Composer mirror</span>
					</div>
				</div>
				<LayerCard>
					<LayerCard.Secondary>{title}</LayerCard.Secondary>
					<LayerCard.Primary>
						<div style={{ display: "grid", gap: "1rem" }}>
							{description ? <Text variant="secondary">{description}</Text> : null}
							{children}
						</div>
					</LayerCard.Primary>
				</LayerCard>
			</div>
		</div>
	);
}
