import type { ReactNode } from "react";

export function Page({
	title,
	description,
	actions,
	children,
}: {
	title: string;
	description?: string;
	actions?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="page">
			<header className="page-header">
				<div>
					<h1 className="page-title">{title}</h1>
					{description ? <p className="page-desc">{description}</p> : null}
				</div>
				{actions ? <div className="page-actions">{actions}</div> : null}
			</header>
			<div className="page-stack">{children}</div>
		</div>
	);
}
