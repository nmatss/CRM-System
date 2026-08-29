import { Fragment } from "react";
import { Link, useLocation } from "wouter";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: React.ReactNode;
}

const routeNames: Record<string, string> = {
  dashboard: "Dashboard",
  customers: "Clientes",
  orders: "Pedidos",
  products: "Produtos",
  campaigns: "Campanhas",
  automations: "Automações",
  reports: "Relatórios",
  settings: "Configurações",
  admin: "Administração",
  goals: "Metas",
};

export function PageHeader({ title, description, children }: PageHeaderProps) {
  const [location] = useLocation();
  const pathSegments = location.split("/").filter(Boolean);

  return (
    <div className="flex flex-col gap-4 mb-6">
      <Breadcrumb>
        <BreadcrumbList className="flex-wrap">
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href="/dashboard" className="flex items-center gap-1">
                <Home className="h-3.5 w-3.5" />
                <span className="sr-only sm:not-sr-only">Início</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          {pathSegments.map((segment, index) => {
            const isLast = index === pathSegments.length - 1;
            const href = "/" + pathSegments.slice(0, index + 1).join("/");
            const name = routeNames[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

            return (
              // A Fragment keeps <li> a direct child of the breadcrumb <ol>;
              // a wrapper element breaks the list semantics for screen readers.
              <Fragment key={segment}>
                <BreadcrumbSeparator />
                <BreadcrumbItem>
                  {isLast ? (
                    <BreadcrumbPage className="max-w-[150px] sm:max-w-none truncate">
                      {name}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link href={href} className="max-w-[100px] sm:max-w-none truncate">
                        {name}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </BreadcrumbItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight truncate">{title}</h1>
          {description && (
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{description}</p>
          )}
        </div>
        {children && (
          <div className="flex items-center gap-2 shrink-0 flex-wrap sm:flex-nowrap">
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
