import { Button, Dialog } from "@cloudflare/kumo";
import { X } from "@phosphor-icons/react";
import type { FormEvent, ReactNode } from "react";

export function FormDialog({
	open,
	onOpenChange,
	title,
	description,
	submitLabel,
	pending,
	onSubmit,
	children,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description?: string;
	submitLabel: string;
	pending?: boolean;
	onSubmit: (event: FormEvent<HTMLFormElement>) => void | Promise<void>;
	children: ReactNode;
}) {
	return (
		<Dialog.Root open={open} onOpenChange={onOpenChange}>
			<Dialog size="lg" className="p-6">
				<div className="dialog-head">
					<div>
						<Dialog.Title>{title}</Dialog.Title>
						{description ? <Dialog.Description>{description}</Dialog.Description> : null}
					</div>
					<Dialog.Close
						aria-label="Close"
						render={(props) => (
							<Button {...props} variant="ghost" shape="square" icon={<X />} aria-label="Close" />
						)}
					/>
				</div>
				<form
					className="dialog-form"
					onSubmit={async (event) => {
						await onSubmit(event);
					}}
				>
					{children}
					<div className="dialog-actions">
						<Dialog.Close render={(props) => <Button variant="secondary" {...props} type="button" />}>
							Cancel
						</Dialog.Close>
						<Button type="submit" variant="primary" disabled={pending} loading={pending}>
							{submitLabel}
						</Button>
					</div>
				</form>
			</Dialog>
		</Dialog.Root>
	);
}
