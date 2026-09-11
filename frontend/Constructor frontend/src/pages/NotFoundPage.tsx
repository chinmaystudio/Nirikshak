import { Icon } from "@/components/common/Icon";
import { Button } from "@/components/common/Button";
import { ROUTES } from "@/constants/routes";

export function NotFoundPage(): JSX.Element {
  return (
    <div className="max-w-lg mx-auto py-16 text-center space-y-4">
      <div className="w-20 h-20 mx-auto rounded-full bg-surface-container flex items-center justify-center text-outline">
        <Icon name="wrong_location" className="text-[40px]" />
      </div>
      <h1 className="text-headline-lg font-bold text-primary">404 — Page Not Found</h1>
      <p className="text-body-md text-on-surface-variant">The page you requested does not exist on the Nirikshan portal, or the link has expired.</p>
      <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
        <Button onClick={() => window.location.assign(ROUTES.HOME)}>Go to Home</Button>
        <Button variant="outline" onClick={() => window.location.assign(ROUTES.PROJECTS)}>
          Browse Projects
        </Button>
      </div>
    </div>
  );
}
