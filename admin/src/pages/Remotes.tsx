import { Badge, Banner, Button, Empty, Input, Select, Table } from "@cloudflare/kumo";
import { Globe, Plus } from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { Page } from "../layout/Page";
import type { Remote } from "../types";
import { FormDialog } from "../ui/FormDialog";

export function Remotes() {
	const [error, setError] = useState("");
	const [flash, setFlash] = useState("");
	const [remotes, setRemotes] = useState<Remote[]>([]);
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [authType, setAuthType] = useState("none");

	async function load() {
		const remoteData = await api<{ remotes: Remote[] }>("/admin/api/remotes");
		setRemotes(remoteData.remotes);
	}

	useEffect(() => {
		load().catch((err: Error) => setError(err.message));
	}, []);

	async function addRemote(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const data = Object.fromEntries(new FormData(form).entries());
		const dist = String(data.dist_hosts || "")
			.split(",")
			.map((host) => host.trim())
			.filter(Boolean);
		setPending(true);
		setError("");
		try {
			await api("/admin/api/remotes", {
				method: "POST",
				body: JSON.stringify({
					slug: data.slug,
					url: data.url,
					auth_type: authType,
					token: data.token,
					username: data.username,
					password: data.token,
					dist_hosts: dist,
				}),
			});
			form.reset();
			setAuthType("none");
			setOpen(false);
			setFlash("Remote added");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add remote");
		} finally {
			setPending(false);
		}
	}

	return (
		<Page
			title="Remotes"
			description="Mirror another Composer registry. Each remote is available at /r/:slug."
			actions={
				<Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
					Add remote
				</Button>
			}
		>
			{error ? <Banner variant="error">{error}</Banner> : null}
			{flash ? <Banner>{flash}</Banner> : null}
			<div className="panel">
				{remotes.length === 0 ? (
					<div className="panel-empty">
						<Empty
							icon={<Globe size={40} />}
							title="No remotes yet"
							description="Add Drupal, Private Packagist, or any other Composer 2 repository."
							contents={
								<Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
									Add remote
								</Button>
							}
						/>
					</div>
				) : (
					<Table>
						<Table.Header>
							<Table.Row>
								<Table.Head>Slug</Table.Head>
								<Table.Head>URL</Table.Head>
								<Table.Head>Auth</Table.Head>
								<Table.Head>Status</Table.Head>
								<Table.Head />
							</Table.Row>
						</Table.Header>
						<Table.Body>
							{remotes.map((remote) => (
								<Table.Row key={remote.slug}>
									<Table.Cell>
										<span className="mono">/r/{remote.slug}</span>
									</Table.Cell>
									<Table.Cell>{remote.url}</Table.Cell>
									<Table.Cell>
										<Badge variant="neutral">{remote.auth_type || "none"}</Badge>
									</Table.Cell>
									<Table.Cell>
										{remote.last_error ? (
											<Badge variant="error">Error</Badge>
										) : (
											<Badge variant="success">OK</Badge>
										)}
										{remote.last_error ? (
											<div className="mono" style={{ marginTop: 4 }}>
												{remote.last_error}
											</div>
										) : null}
									</Table.Cell>
									<Table.Cell>
										<div className="cell-actions">
											<Button
												variant="secondary-destructive"
												size="sm"
												onClick={async () => {
													await api(`/admin/api/remotes/${remote.slug}`, { method: "DELETE" });
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
				open={open}
				onOpenChange={setOpen}
				title="Add remote"
				description="The registry must speak Composer 2 metadata."
				submitLabel="Add remote"
				pending={pending}
				onSubmit={addRemote}
			>
				<Input name="slug" label="Slug" required placeholder="drupal" />
				<Input name="url" label="Repository URL" required placeholder="https://packages.drupal.org/8" />
				<Select
					label="Authentication"
					value={authType}
					onValueChange={(value) => setAuthType(String(value ?? "none"))}
					items={{ none: "None", bearer: "Bearer token", basic: "HTTP basic" }}
				/>
				<Input name="token" label="Token / password" type="password" />
				<Input name="username" label="Username" />
				<Input name="dist_hosts" label="Extra dist hosts" placeholder="ftp.drupal.org" />
			</FormDialog>
		</Page>
	);
}
