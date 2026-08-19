import { Banner, Button, Input, Label, LayerCard, Text } from "@cloudflare/kumo";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { authClient } from "../auth-client";

export function Setup() {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		const password = String(form.get("password") ?? "");
		const confirm = String(form.get("confirm") ?? "");
		if (password !== confirm) {
			setError("Passwords do not match");
			return;
		}
		setPending(true);
		setError("");
		try {
			await api("/admin/api/setup", {
				method: "POST",
				body: JSON.stringify({
					name: form.get("name"),
					email: form.get("email"),
					password,
				}),
			});
			await authClient.getSession();
			navigate("/", { replace: true });
		} catch (err) {
			setError(err instanceof Error ? err.message : "Setup failed");
		} finally {
			setPending(false);
		}
	}

	return (
		<main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
			<LayerCard>
				<div style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
					<Text size="xl" weight="semibold">
						Create the first admin
					</Text>
					<Text tone="secondary">This wizard only runs once. There is no public signup.</Text>
					{error ? <Banner variant="error">{error}</Banner> : null}
					<form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
						<Label>
							Name
							<Input name="name" required autoComplete="name" />
						</Label>
						<Label>
							Email
							<Input name="email" type="email" required autoComplete="email" />
						</Label>
						<Label>
							Password
							<Input name="password" type="password" required minLength={8} autoComplete="new-password" />
						</Label>
						<Label>
							Confirm password
							<Input name="confirm" type="password" required minLength={8} autoComplete="new-password" />
						</Label>
						<Button type="submit" disabled={pending}>
							{pending ? "Creating…" : "Create admin"}
						</Button>
					</form>
				</div>
			</LayerCard>
		</main>
	);
}
