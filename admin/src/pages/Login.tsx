import { Banner, Button, Input, Label, LayerCard, Text } from "@cloudflare/kumo";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../auth-client";

export function Login() {
	const navigate = useNavigate();
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	async function onSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const form = new FormData(event.currentTarget);
		setPending(true);
		setError("");
		const result = await authClient.signIn.email({
			email: String(form.get("email") ?? ""),
			password: String(form.get("password") ?? ""),
		});
		setPending(false);
		if (result.error) {
			setError(result.error.message || "Invalid email or password");
			return;
		}
		navigate("/", { replace: true });
	}

	return (
		<main style={{ maxWidth: 420, margin: "4rem auto", padding: "0 1rem" }}>
			<LayerCard>
				<div style={{ padding: "1.5rem", display: "grid", gap: "1rem" }}>
					<Text size="xl" weight="semibold">
						Sign in
					</Text>
					{error ? <Banner variant="error">{error}</Banner> : null}
					<form onSubmit={onSubmit} style={{ display: "grid", gap: "0.85rem" }}>
						<Label>
							Email
							<Input name="email" type="email" required autoComplete="username" />
						</Label>
						<Label>
							Password
							<Input name="password" type="password" required autoComplete="current-password" />
						</Label>
						<Button type="submit" disabled={pending}>
							{pending ? "Signing in…" : "Sign in"}
						</Button>
					</form>
				</div>
			</LayerCard>
		</main>
	);
}
