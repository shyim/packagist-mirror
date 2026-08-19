import { KumoPortalProvider, LinkProvider } from "@cloudflare/kumo";
import { StrictMode, forwardRef } from "react";
import "./index.css";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Link as RouterLink } from "react-router-dom";
import { App } from "./App";

const AppLink = forwardRef<HTMLAnchorElement, React.ComponentProps<"a">>(function AppLink(
	{ href, ...rest },
	ref,
) {
	return <RouterLink ref={ref} to={href ?? ""} {...rest} />;
});

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<KumoPortalProvider container={document.body}>
			<BrowserRouter basename="/admin">
				<LinkProvider component={AppLink}>
					<App />
				</LinkProvider>
			</BrowserRouter>
		</KumoPortalProvider>
	</StrictMode>,
);
