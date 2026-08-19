import { Banner, Button, Input, Switch } from "@cloudflare/kumo";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { Page } from "../layout/Page";

export function Settings() {
	const [error, setError] = useState("");
	const [flash, setFlash] = useState("");
	const [packagistEnabled, setPackagistEnabled] = useState(true);
	const [contactEmail, setContactEmail] = useState("");
	const [pending, setPending] = useState(false);

	useEffect(() => {
		api<{ packagist_enabled: boolean; contact_email: string }>("/admin/api/settings")
			.then((settings) => {
				setPackagistEnabled(settings.packagist_enabled);
				setContactEmail(settings.contact_email || "");
			})
			.catch((err: Error) => setError(err.message));
	}, []);

	async function saveSettings(event?: FormEvent) {
		event?.preventDefault();
		setPending(true);
		setError("");
		try {
			await api("/admin/api/settings", {
				method: "PUT",
				body: JSON.stringify({ packagist_enabled: packagistEnabled, contact_email: contactEmail }),
			});
			setFlash("Settings saved");
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not save settings");
		} finally {
			setPending(false);
		}
	}

	return (
		<Page title="Settings" description="Control the public Packagist mirror and the contact address shown to Composer.">
			{error ? <Banner variant="error">{error}</Banner> : null}
			{flash ? <Banner>{flash}</Banner> : null}
			<div className="panel">
				<div className="settings-list">
					<div className="settings-row">
						<div className="settings-copy">
							<h2>Mirror packagist.org</h2>
							<p>Serve rewritten packagist.org metadata at the Worker root (/).</p>
						</div>
						<div className="settings-control">
							<Switch
								label="Enabled"
								checked={packagistEnabled}
								onCheckedChange={(checked) => {
									setPackagistEnabled(checked);
									void api("/admin/api/settings", {
										method: "PUT",
										body: JSON.stringify({ packagist_enabled: checked, contact_email: contactEmail }),
									})
										.then(() => setFlash(checked ? "Packagist mirroring enabled" : "Packagist mirroring disabled"))
										.catch((err: Error) => setError(err.message));
								}}
							/>
						</div>
					</div>
					<div className="settings-row">
						<div className="settings-copy">
							<h2>Contact email</h2>
							<p>Shown on the public status page and used as a contact hint.</p>
						</div>
						<div className="settings-control">
							<form onSubmit={saveSettings}>
								<Input
									label="Email"
									value={contactEmail}
									onChange={(event) => setContactEmail(event.target.value)}
									type="email"
								/>
								<div className="dialog-actions">
									<Button type="submit" variant="primary" disabled={pending} loading={pending}>
										Save
									</Button>
								</div>
							</form>
						</div>
					</div>
				</div>
			</div>
		</Page>
	);
}
