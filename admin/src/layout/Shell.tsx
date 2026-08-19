import { Button, CloudflareLogo, Sidebar } from "@cloudflare/kumo";
import { Gear, Globe, House, Package, SignOut, Users } from "@phosphor-icons/react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { authClient } from "../auth-client";

export function Shell({ setupNeeded, signedIn }: { setupNeeded: boolean; signedIn: boolean }) {
	const location = useLocation();
	const { data: session } = authClient.useSession();
	const role = (session?.user as { role?: string } | undefined)?.role;
	const email = session?.user?.email ?? "";

	if (!signedIn) {
		return <Navigate to={setupNeeded ? "/setup" : "/login"} replace />;
	}

	return (
		<div className="app-frame">
			<Sidebar.Provider defaultOpen>
				<Sidebar>
					<Sidebar.Header>
						<div className="brand">
							<CloudflareLogo variant="glyph" color="color" className="brand-mark" />
							<div className="brand-copy">
								<span className="brand-name">Packagist</span>
								<span className="brand-sub">Composer mirror</span>
							</div>
						</div>
						<Sidebar.Trigger />
					</Sidebar.Header>
					<Sidebar.Content>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Mirror</Sidebar.GroupLabel>
							<Sidebar.Menu>
								<Sidebar.MenuButton href="/" icon={House} active={location.pathname === "/"} tooltip="Overview">
									Overview
								</Sidebar.MenuButton>
								<Sidebar.MenuButton
									href="/remotes"
									icon={Globe}
									active={location.pathname.startsWith("/remotes")}
									tooltip="Remotes"
								>
									Remotes
								</Sidebar.MenuButton>
								<Sidebar.MenuButton
									href="/packages"
									icon={Package}
									active={location.pathname.startsWith("/packages")}
									tooltip="Packages"
								>
									Packages
								</Sidebar.MenuButton>
							</Sidebar.Menu>
						</Sidebar.Group>
						<Sidebar.Group>
							<Sidebar.GroupLabel>Manage</Sidebar.GroupLabel>
							<Sidebar.Menu>
								<Sidebar.MenuButton
									href="/settings"
									icon={Gear}
									active={location.pathname.startsWith("/settings")}
									tooltip="Settings"
								>
									Settings
								</Sidebar.MenuButton>
								{role === "admin" ? (
									<Sidebar.MenuButton
										href="/users"
										icon={Users}
										active={location.pathname.startsWith("/users")}
										tooltip="Users"
									>
										Users
									</Sidebar.MenuButton>
								) : null}
							</Sidebar.Menu>
						</Sidebar.Group>
					</Sidebar.Content>
					<Sidebar.Footer>
						<div className="account">
							<div className="account-name">{session?.user?.name || "Signed in"}</div>
							<div className="account-email" title={email}>
								{email}
							</div>
							<Button variant="ghost" size="sm" icon={<SignOut />} onClick={() => authClient.signOut()}>
								Sign out
							</Button>
						</div>
					</Sidebar.Footer>
				</Sidebar>
				<div className="app-main">
					<Outlet />
				</div>
			</Sidebar.Provider>
		</div>
	);
}
