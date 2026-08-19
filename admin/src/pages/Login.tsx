import { Banner, Button, Input } from "@cloudflare/kumo";
import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { authClient } from "../auth-client";
import { AuthScreen } from "../layout/AuthScreen";

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
		<AuthScreen title="Sign in" description="Use the account created during first-run setup.">
			{error ? <Banner variant="error">{error}</Banner> : null}
			<form onSubmit={onSubmit}>
				<Input name="email" label="Email" type="email" required autoComplete="username" />
				<Input name="password" label="Password" type="password" required autoComplete="current-password" />
				<Button type="submit" variant="primary" disabled={pending} loading={pending}>
					Sign in
				</Button>
			</form>
		</AuthScreen>
	);
}
