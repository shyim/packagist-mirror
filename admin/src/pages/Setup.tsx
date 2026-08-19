import { Banner, Button, Input } from "@cloudflare/kumo";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";
import { authClient } from "../auth-client";
import { AuthScreen } from "../layout/AuthScreen";

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
		<AuthScreen title="Create the first admin" description="This wizard only runs once. There is no public signup.">
			{error ? <Banner variant="error">{error}</Banner> : null}
			<form onSubmit={onSubmit}>
				<Input name="name" label="Name" required autoComplete="name" />
				<Input name="email" label="Email" type="email" required autoComplete="email" />
				<Input name="password" label="Password" type="password" required minLength={8} autoComplete="new-password" />
				<Input
					name="confirm"
					label="Confirm password"
					type="password"
					required
					minLength={8}
					autoComplete="new-password"
				/>
				<Button type="submit" variant="primary" disabled={pending} loading={pending}>
					Create admin
				</Button>
			</form>
		</AuthScreen>
	);
}
