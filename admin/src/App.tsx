import { Banner, Loader, Text } from "@cloudflare/kumo";
import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { api } from "./api";
import { authClient } from "./auth-client";
import { Shell } from "./layout/Shell";
import { Login } from "./pages/Login";
import { Overview } from "./pages/Overview";
import { Packages } from "./pages/Packages";
import { Remotes } from "./pages/Remotes";
import { Settings } from "./pages/Settings";
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
			<div className="auth-screen">
				<div className="auth-card">
					<Banner variant="error">{error}</Banner>
				</div>
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
				element={setupNeeded ? <Navigate to="/setup" replace /> : signedIn ? <Navigate to="/" replace /> : <Login />}
			/>
			<Route element={<Shell setupNeeded={setupNeeded} signedIn={signedIn} />}>
				<Route path="/" element={<Overview />} />
				<Route path="/remotes" element={<Remotes />} />
				<Route path="/packages" element={<Packages />} />
				<Route path="/settings" element={<Settings />} />
				<Route
					path="/users"
					element={
						role === "admin" ? (
							<Users />
						) : (
							<div className="page">
								<Text variant="secondary">You need to be an admin to manage users.</Text>
							</div>
						)
					}
				/>
			</Route>
			<Route path="*" element={<Navigate to="/" replace />} />
		</Routes>
	);
}
