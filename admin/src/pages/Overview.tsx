import { Banner, Link, LinkButton, Text } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import { api } from "../api";
import { Page } from "../layout/Page";
import type { Pkg, Remote } from "../types";

export function Overview() {
	const [error, setError] = useState("");
	const [packagistEnabled, setPackagistEnabled] = useState(true);
	const [contactEmail, setContactEmail] = useState("");
	const [remotes, setRemotes] = useState<Remote[]>([]);
	const [packages, setPackages] = useState<Pkg[]>([]);

	useEffect(() => {
		Promise.all([
			api<{ packagist_enabled: boolean; contact_email: string }>("/admin/api/settings"),
			api<{ remotes: Remote[] }>("/admin/api/remotes"),
			api<{ packages: Pkg[] }>("/admin/api/packages"),
		])
			.then(([settings, remoteData, pkgData]) => {
				setPackagistEnabled(settings.packagist_enabled);
				setContactEmail(settings.contact_email || "");
				setRemotes(remoteData.remotes);
				setPackages(pkgData.packages);
			})
			.catch((err: Error) => setError(err.message));
	}, []);

	return (
		<Page
			title="Overview"
			description="Composer clients use this Worker as packagist.org. Remotes and hosted packages stay on the same origin."
			actions={
				<>
					<LinkButton href="/remotes" variant="secondary">
						Add remote
					</LinkButton>
					<LinkButton href="/packages" variant="primary">
						Add package
					</LinkButton>
				</>
			}
		>
			{error ? <Banner variant="error">{error}</Banner> : null}
			<div className="stat-grid">
				<div className="stat-card">
					<p className="stat-label">Packagist.org</p>
					<p className="stat-value">{packagistEnabled ? "On" : "Off"}</p>
					<p className="stat-meta">{packagistEnabled ? "Mirrored at /" : "Disabled in settings"}</p>
				</div>
				<div className="stat-card">
					<p className="stat-label">Remotes</p>
					<p className="stat-value">{remotes.length}</p>
					<p className="stat-meta">Available under /r/:slug</p>
				</div>
				<div className="stat-card">
					<p className="stat-label">Hosted packages</p>
					<p className="stat-value">{packages.length}</p>
					<p className="stat-meta">Served at /hosted</p>
				</div>
				<div className="stat-card">
					<p className="stat-label">Contact</p>
					<p className="stat-value" style={{ fontSize: "1.05rem", paddingTop: "0.45rem" }}>
						{contactEmail || "Not set"}
					</p>
					<p className="stat-meta">
						<Link href="/settings">Edit settings</Link>
					</p>
				</div>
			</div>
			<div className="panel">
				<div style={{ padding: "1.15rem 1.25rem" }}>
					<h2 className="page-title" style={{ fontSize: "1.05rem" }}>
						Composer endpoint
					</h2>
					<Text variant="secondary">Point Composer at this Worker instead of repo.packagist.org.</Text>
					<pre className="mono" style={{ margin: "0.85rem 0 0" }}>
						composer config -g repos.packagist composer {window.location.origin}
					</pre>
				</div>
			</div>
		</Page>
	);
}
