import { Badge, Banner, Button, Empty, Input, Table } from "@cloudflare/kumo";
import { GitBranch, Package, Plus, UploadSimple } from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { Page } from "../layout/Page";
import type { Pkg } from "../types";
import { FormDialog } from "../ui/FormDialog";

export function Packages() {
	const [error, setError] = useState("");
	const [flash, setFlash] = useState("");
	const [packages, setPackages] = useState<Pkg[]>([]);
	const [vcsOpen, setVcsOpen] = useState(false);
	const [uploadOpen, setUploadOpen] = useState(false);
	const [pending, setPending] = useState(false);

	async function load() {
		const pkgData = await api<{ packages: Pkg[] }>("/admin/api/packages");
		setPackages(pkgData.packages);
	}

	useEffect(() => {
		load().catch((err: Error) => setError(err.message));
	}, []);

	async function importVcs(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = Object.fromEntries(new FormData(form).entries());
		setPending(true);
		setError("");
		try {
			await api("/admin/api/packages/vcs", { method: "POST", body: JSON.stringify(data) });
			form.reset();
			setVcsOpen(false);
			setFlash("VCS import started");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Import failed");
		} finally {
			setPending(false);
		}
	}

	async function uploadZip(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError("");
		try {
			await api("/admin/api/packages/upload", { method: "POST", body: new FormData(event.currentTarget) });
			event.currentTarget.reset();
			setUploadOpen(false);
			setFlash("Zip uploaded");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Upload failed");
		} finally {
			setPending(false);
		}
	}

	return (
		<Page
			title="Hosted packages"
			description="Import a Git repository or upload a zip. Packages are served at /hosted."
			actions={
				<>
					<Button variant="secondary" icon={<GitBranch />} onClick={() => setVcsOpen(true)}>
						Import VCS
					</Button>
					<Button variant="primary" icon={<UploadSimple />} onClick={() => setUploadOpen(true)}>
						Upload zip
					</Button>
				</>
			}
		>
			{error ? <Banner variant="error">{error}</Banner> : null}
			{flash ? <Banner>{flash}</Banner> : null}
			<div className="panel">
				{packages.length === 0 ? (
					<div className="panel-empty">
						<Empty
							icon={<Package size={40} />}
							title="No hosted packages"
							description="Import tags from GitHub/GitLab or upload a composer.zip."
							contents={
								<div className="page-actions">
									<Button variant="secondary" icon={<GitBranch />} onClick={() => setVcsOpen(true)}>
										Import VCS
									</Button>
									<Button variant="primary" icon={<Plus />} onClick={() => setUploadOpen(true)}>
										Upload zip
									</Button>
								</div>
							}
						/>
					</div>
				) : (
					<Table>
						<Table.Header>
							<Table.Row>
								<Table.Head>Package</Table.Head>
								<Table.Head>Source</Table.Head>
								<Table.Head>Versions</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{packages.map((pkg) => (
								<Table.Row key={pkg.name}>
									<Table.Cell>
										<span className="mono">{pkg.name}</span>
									</Table.Cell>
									<Table.Cell>
										<Badge variant="neutral">{pkg.source}</Badge>
									</Table.Cell>
									<Table.Cell>{pkg.versions}</Table.Cell>
									<Table.Cell>
										{pkg.last_error ? <Badge variant="error">Error</Badge> : <Badge variant="success">OK</Badge>}
										{pkg.last_error ? (
											<div className="mono" style={{ marginTop: 4 }}>
												{pkg.last_error}
											</div>
										) : null}
									</Table.Cell>
									<Table.Cell>
										<div className="cell-actions">
											{pkg.source === "vcs" ? (
												<Button
													variant="secondary"
													size="sm"
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
												variant="secondary-destructive"
												size="sm"
												onClick={async () => {
													await api(`/admin/api/packages?name=${encodeURIComponent(pkg.name)}`, {
														method: "DELETE",
													});
													await load();
												}}
											>
												Delete
											</Button>
										</div>
									</Table.Cell>
								</Table.Row>
							))}
						</Table.Body>
					</Table>
				)}
			</div>
			<FormDialog
				open={vcsOpen}
				onOpenChange={setVcsOpen}
				title="Import VCS"
				description="Reads composer.json from tags and branches."
				submitLabel="Import"
				pending={pending}
				onSubmit={importVcs}
			>
				<Input name="url" label="VCS URL" required placeholder="https://github.com/acme/lib" />
				<Input name="token" label="Token (optional)" type="password" />
			</FormDialog>
			<FormDialog
				open={uploadOpen}
				onOpenChange={setUploadOpen}
				title="Upload zip"
				description="The zip should contain a composer.json at the root or one directory down."
				submitLabel="Upload"
				pending={pending}
				onSubmit={uploadZip}
			>
				<label>
					Zip
					<input name="file" type="file" accept=".zip" required />
				</label>
				<Input name="name" label="Name override" placeholder="vendor/package" />
				<Input name="version" label="Version override" placeholder="1.0.0" />
			</FormDialog>
		</Page>
	);
}
