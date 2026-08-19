import { Badge, Banner, Button, Empty, Input, Select, Table } from "@cloudflare/kumo";
import { Plus, Users as UsersIcon } from "@phosphor-icons/react";
import { FormEvent, useEffect, useState } from "react";
import { api } from "../api";
import { Page } from "../layout/Page";
import type { UserRow } from "../types";
import { FormDialog } from "../ui/FormDialog";

export function Users() {
	const [users, setUsers] = useState<UserRow[]>([]);
	const [error, setError] = useState("");
	const [flash, setFlash] = useState("");
	const [open, setOpen] = useState(false);
	const [pending, setPending] = useState(false);
	const [role, setRole] = useState("user");

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
		setPending(true);
		setError("");
		try {
			await api("/admin/api/users", { method: "POST", body: JSON.stringify({ ...body, role }) });
			form.reset();
			setRole("user");
			setOpen(false);
			setFlash("User created");
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Could not create user");
		} finally {
			setPending(false);
		}
	}

	return (
		<Page
			title="Users"
			description="There is no public signup. Only an admin can create accounts."
			actions={
				<Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
					Add user
				</Button>
			}
		>
			{error ? <Banner variant="error">{error}</Banner> : null}
			{flash ? <Banner>{flash}</Banner> : null}
			<div className="panel">
				{users.length === 0 ? (
					<div className="panel-empty">
						<Empty
							icon={<UsersIcon size={40} />}
							title="No users"
							description="Create the first additional account."
							contents={
								<Button variant="primary" icon={<Plus />} onClick={() => setOpen(true)}>
									Add user
								</Button>
							}
						/>
					</div>
				) : (
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
									<Table.Cell>
										<Badge variant={user.role === "admin" ? "blue" : "neutral"}>{user.role || "user"}</Badge>
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
				title="Add user"
				description="They can sign in at /admin. Admins can manage other users."
				submitLabel="Create user"
				pending={pending}
				onSubmit={onCreate}
			>
				<Input name="name" label="Name" required />
				<Input name="email" label="Email" type="email" required />
				<Input name="password" label="Password" type="password" required minLength={8} />
				<Select
					label="Role"
					value={role}
					onValueChange={(value) => setRole(String(value ?? "user"))}
					items={{ user: "User", admin: "Admin" }}
				/>
			</FormDialog>
		</Page>
	);
}
