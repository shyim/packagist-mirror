import { Banner, Button, Input, Label, LayerCard, Table, Text } from "@cloudflare/kumo";
import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api";
import { authClient } from "../auth-client";

type UserRow = { id: string; name: string; email: string; role: string | null };

export function Users() {
	const [users, setUsers] = useState<UserRow[]>([]);
	const [error, setError] = useState("");
	const [flash, setFlash] = useState("");

	async function load() {
		const data = await api<{ users: UserRow[] }>("/admin/api/users");
		setUsers(data.users);
	}

	useEffect(() => {
		load().catch((err: Error) => setError(err.message));
	}, []);

	async function onCreate(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = event.currentTarget;
		const body = Object.fromEntries(new FormData(form).entries());
		try {
			await api("/admin/api/users", { method: "POST", body: JSON.stringify(body) });
			form.reset();
			setFlash("User created");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not create user");
		}
	}

	return (
		<main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem 4rem" }}>
			<Text size="xl" weight="semibold">
				Users
			</Text>
			<Text>
				<Link to="/">Back to dashboard</Link>
			</Text>
			{error ? <Banner variant="error">{error}</Banner> : null}
			{flash ? <Banner>{flash}</Banner> : null}
			<LayerCard>
				<div style={{ padding: "1.25rem" }}>
					<form onSubmit={onCreate} style={{ display: "grid", gap: "0.75rem" }}>
						<Label>
							Name
							<Input name="name" required />
						</Label>
						<Label>
							Email
							<Input name="email" type="email" required />
						</Label>
						<Label>
							Password
							<Input name="password" type="password" required minLength={8} />
						</Label>
						<Label>
							Role
							<select name="role" defaultValue="user">
								<option value="user">user</option>
								<option value="admin">admin</option>
							</select>
						</Label>
						<Button type="submit">Create user</Button>
					</form>
				</div>
			</LayerCard>
			<Table>
				<Table.Header>
					<Table.Row>
						<Table.Head>Name</Table.Head>
						<Table.Head>Email</Table.Head>
						<Table.Head>Role</Table.Head>
					</Table.Row>
				</Table.Header>
				<Table.Body>
					{users.map((user) => (
						<Table.Row key={user.id}>
							<Table.Cell>{user.name}</Table.Cell>
							<Table.Cell>{user.email}</Table.Cell>
							<Table.Cell>{user.role || "user"}</Table.Cell>
						</Table.Row>
					))}
				</Table.Body>
			</Table>
			<div style={{ marginTop: "1rem" }}>
				<Button variant="secondary" onClick={() => authClient.signOut()}>
					Sign out
				</Button>
			</div>
		</main>
	);
}
