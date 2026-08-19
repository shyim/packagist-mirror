import { Banner, Loader, Text } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { authClient } from "./auth-client";
import { Dashboard } from "./pages/Dashboard";
import { Login } from "./pages/Login";
import { Setup } from "./pages/Setup";
import { Users } from "./pages/Users";

export function App() {
	const { data: session, isPending } = authClient.useSession();
	const [setupNeeded, setSetupNeeded] = useState<boolean | null>(null);
	const [error, setError] = useState("");

	useEffect(() => {
		api<{ needed: boolean }>("/admin/api/setup")
			.then((data) => setSetupNeeded(data.needed))
			.catch((err: Error) => setError(err.message));
	}, [session]);

	if (isPending || setupNeeded === null) {
		return (
			<div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
				<Loader />
			</div>
		);
	}

	if (error) {
		return (
			<div style={{ maxWidth: 480, margin: "4rem auto", padding: "0 1rem" }}>
				<Banner variant="error">{error}</Banner>
			</div>
		);
	}

	const role = (session?.user as { role?: string } | undefined)?.role;
	const signedIn = Boolean(session?.user);

	return (
		<Routes>
			<Route
				path="/setup"
				element={setupNeeded ? <Setup /> : <Navigate to={signedIn ? "/" : "/login"} replace />}
			/>
			<Route
				path="/login"
				element={
					setupNeeded ? <Navigate to="/setup" replace /> : signedIn ? <Navigate to="/" replace /> : <Login />
				}
			/>
			<Route
				path="/users"
				element={
					!signedIn ? (
						<Navigate to={setupNeeded ? "/setup" : "/login"} replace />
					) : role === "admin" ? (
						<Users />
					) : (
						<Text>You need to be an admin to manage users.</Text>
					)
				}
			/>
			<Route
				path="/"
				element={
					signedIn ? (
						<Dashboard />
					) : (
						<Navigate to={setupNeeded ? "/setup" : "/login"} replace />
					)
				}
			/>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}
