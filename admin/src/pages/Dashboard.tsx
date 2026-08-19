import { Banner, Button, Input, Label, LayerCard, Table, Text } from "@cloudflare/kumo";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { authClient } from "../auth-client";

type Remote = {
	slug: string;
	url: string;
	auth_type: string;
	last_error: string | null;
};
type Pkg = {
	name: string;
	source: string;
	versions: number;
	last_error: string | null;
};

export function Dashboard() {
	const { data: session } = authClient.useSession();
	const role = (session?.user as { role?: string } | undefined)?.role;
	const [error, setError] = useState("");
	const [flash, setFlash] = useState("");
	const [packagistEnabled, setPackagistEnabled] = useState(true);
	const [contactEmail, setContactEmail] = useState("");
	const [remotes, setRemotes] = useState<Remote[]>([]);
	const [packages, setPackages] = useState<Pkg[]>([]);

	async function load() {
		const settings = await api<{ packagist_enabled: boolean; contact_email: string }>("/admin/api/settings");
		setPackagistEnabled(settings.packagist_enabled);
		setContactEmail(settings.contact_email || "");
		const remoteData = await api<{ remotes: Remote[] }>("/admin/api/remotes");
		setRemotes(remoteData.remotes);
		const pkgData = await api<{ packages: Pkg[] }>("/admin/api/packages");
		setPackages(pkgData.packages);
	}

	useEffect(() => {
		load().catch((err: Error) => setError(err.message));
	}, []);

	async function saveSettings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		await api("/admin/api/settings", {
			method: "PUT",
			body: JSON.stringify({ packagist_enabled: packagistEnabled, contact_email: contactEmail }),
		});
		setFlash("Settings saved");
	}

	async function addRemote(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = Object.fromEntries(new FormData(form).entries());
		const dist = String(data.dist_hosts || "")
			.split(",")
			.map((host) => host.trim())
			.filter(Boolean);
		try {
			await api("/admin/api/remotes", {
				method: "POST",
				body: JSON.stringify({
					slug: data.slug,
					url: data.url,
					auth_type: data.auth_type,
					token: data.token,
					username: data.username,
					password: data.token,
					dist_hosts: dist,
				}),
			});
			form.reset();
			setFlash("Remote added");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add remote");
		}
	}

	async function importVcs(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = Object.fromEntries(new FormData(form).entries());
		try {
			await api("/admin/api/packages/vcs", { method: "POST", body: JSON.stringify(data) });
			form.reset();
			setFlash("VCS import started");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Import failed");
		}
	}

	async function uploadZip(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		try {
			await api("/admin/api/packages/upload", { method: "POST", body: new FormData(event.currentTarget) });
			event.currentTarget.reset();
			setFlash("Zip uploaded");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		}
	}

	return (
		<main style={{ maxWidth: 860, margin: "2rem auto", padding: "0 1rem 4rem", display: "grid", gap: "1.5rem" }}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
				<Text size="xl" weight="semibold">
					Packagist mirror
				</Text>
				<div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
					{role === "admin" ? <Link to="/users">Users</Link> : null}
					<Button variant="secondary" onClick={() => authClient.signOut()}>
						Sign out
					</Button>
				</div>
			</div>
			{error ? <Banner variant="error">{error}</Banner> : null}
			{flash ? <Banner>{flash}</Banner> : null}

			<LayerCard>
				<div style={{ padding: "1.25rem", display: "grid", gap: "0.75rem" }}>
					<Text weight="semibold">Settings</Text>
					<form onSubmit={saveSettings} style={{ display: "grid", gap: "0.75rem" }}>
						<Label>
							<input
								type="checkbox"
								checked={packagistEnabled}
								onChange={(event) => setPackagistEnabled(event.target.checked)}
							/>{" "}
							Mirror packagist.org at /
						</Label>
						<Label>
							Contact email
							<Input value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} type="email" />
						</Label>
						<Button type="submit">Save settings</Button>
					</form>
				</div>
			</LayerCard>

			<LayerCard>
				<div style={{ padding: "1.25rem", display: "grid", gap: "0.75rem" }}>
					<Text weight="semibold">Composer remotes</Text>
					<Text>Each remote is available at /r/&lt;slug&gt;</Text>
					<form onSubmit={addRemote} style={{ display: "grid", gap: "0.75rem" }}>
						<Label>
							Slug
							<Input name="slug" required placeholder="drupal" />
						</Label>
						<Label>
							Repository URL
							<Input name="url" required placeholder="https://packages.drupal.org/8" />
						</Label>
						<Label>
							Auth
							<select name="auth_type" defaultValue="none">
								<option value="none">None</option>
								<option value="bearer">Bearer token</option>
								<option value="basic">HTTP basic</option>
							</select>
						</Label>
						<Label>
							Token / password
							<Input name="token" type="password" />
						</Label>
						<Label>
							Username
							<Input name="username" />
						</Label>
						<Label>
							Extra dist hosts
							<Input name="dist_hosts" placeholder="ftp.drupal.org" />
						</Label>
						<Button type="submit">Add remote</Button>
					</form>
					<Table>
						<Table.Header>
							<Table.Row>
								<Table.Head>Slug</Table.Head>
								<Table.Head>URL</Table.Head>
								<Table.Head>Error</Table.Head>
								<Table.Head />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{remotes.map((remote) => (
								<Table.Row key={remote.slug}>
									<Table.Cell>/r/{remote.slug}</Table.Cell>
									<Table.Cell>{remote.url}</Table.Cell>
									<Table.Cell>{remote.last_error || ""}</Table.Cell>
									<Table.Cell>
										<Button
											variant="secondary"
											onClick={async () => {
												await api(`/admin/api/remotes/${remote.slug}`, { method: "DELETE" });
												await load();
											}}
										>
											Delete
										</Button>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</div>
			</LayerCard>

			<LayerCard>
				<div style={{ padding: "1.25rem", display: "grid", gap: "0.75rem" }}>
					<Text weight="semibold">Hosted packages</Text>
					<Text>Served at /hosted</Text>
					<form onSubmit={importVcs} style={{ display: "grid", gap: "0.75rem" }}>
						<Label>
							VCS URL
							<Input name="url" required placeholder="https://github.com/acme/lib" />
						</Label>
						<Label>
							Token (optional)
							<Input name="token" type="password" />
						</Label>
						<Button type="submit">Import VCS</Button>
					</form>
					<form onSubmit={uploadZip} style={{ display: "grid", gap: "0.75rem" }}>
						<Label>
							Zip
							<input name="file" type="file" accept=".zip" required />
						</Label>
						<Label>
							Name override
							<Input name="name" placeholder="vendor/package" />
						</Label>
						<Label>
							Version override
							<Input name="version" placeholder="1.0.0" />
						</Label>
						<Button type="submit">Upload zip</Button>
					</form>
					<Table>
						<Table.Header>
							<Table.Row>
								<Table.Head>Package</Table.Head>
								<Table.Head>Source</Table.Head>
								<Table.Head>Versions</Table.Head>
								<Table.Head>Error</Table.Head>
								<Table.Head />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{packages.map((pkg) => (
								<Table.Row key={pkg.name}>
									<Table.Cell>{pkg.name}</Table.Cell>
									<Table.Cell>{pkg.source}</Table.Cell>
									<Table.Cell>{pkg.versions}</Table.Cell>
									<Table.Cell>{pkg.last_error || ""}</Table.Cell>
									<Table.Cell>
										{pkg.source === "vcs" ? (
											<Button
												variant="secondary"
												onClick={async () => {
													await api(`/admin/api/packages/sync?name=${encodeURIComponent(pkg.name)}`, {
														method: "POST",
														body: "{}",
													});
													await load();
												}}
											>
												Sync
											</Button>
										) : null}
										<Button
											variant="secondary"
											onClick={async () => {
												await api(`/admin/api/packages?name=${encodeURIComponent(pkg.name)}`, { method: "DELETE" });
												await load();
											}}
										>
											Delete
										</Button>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				</div>
			</LayerCard>
		</main>
	);
}
