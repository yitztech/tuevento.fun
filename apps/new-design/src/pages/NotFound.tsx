import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";

export function NotFound() {
  return (
    <div className="mx-auto max-w-xl px-4 py-24 text-center">
      <p className="eyebrow mb-3">404</p>
      <h1 className="section-title">{copy.notFound.title}</h1>
      <p className="mt-3 text-muted-foreground">{copy.notFound.text}</p>
      <Button asChild className="mt-6">
        <Link to="/">{copy.notFound.home}</Link>
      </Button>
    </div>
  );
}
