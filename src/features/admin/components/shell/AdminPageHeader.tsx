import type { ReactNode } from "react";

interface AdminPageHeaderProps {
  title: string;
  description: string;
  actions?: ReactNode;
}

export default function AdminPageHeader({ title, description, actions }: AdminPageHeaderProps) {
  return (
    <header className="admin-page-header">
      <div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {actions && <div className="admin-page-header__actions">{actions}</div>}
    </header>
  );
}
